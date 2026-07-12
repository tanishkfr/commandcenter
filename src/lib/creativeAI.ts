import { GoogleGenAI } from '@google/genai';
import type { ArtifactType, ExtractedArtifact, MemoryArtifact, StudioMessage, StudioProject, StudioSession, StudioSource } from './creativeMemory.js';

type Context={project:StudioProject;session:StudioSession;artifacts:MemoryArtifact[];sources:StudioSource[]};
const configured=()=>{const key=process.env.GEMINI_API_KEY||'';return Boolean(key&&!key.includes('MY_GEMINI'))};
const client=()=>new GoogleGenAI({apiKey:process.env.GEMINI_API_KEY||''});

function relevant(message:string,artifacts:MemoryArtifact[]){
  const terms=message.toLowerCase().split(/\W+/).filter(term=>term.length>3);
  return artifacts.map(artifact=>({artifact,score:terms.reduce((sum,term)=>sum+((artifact.title+' '+artifact.body).toLowerCase().includes(term)?1:0),0)}))
    .filter(item=>item.score>0).sort((a,b)=>b.score-a.score).slice(0,4).map(item=>item.artifact);
}

function localReply(context:Context,message:string){
  const related=relevant(message,context.artifacts);const lower=message.toLowerCase();
  let opening='There is a useful tension in that.';
  if(/\bwhy\b/.test(lower))opening='The rationale seems to be less about the visible solution and more about the behavior it creates.';
  else if(/\bhow\b/.test(lower))opening='I would make the transition observable before deciding on the final form.';
  else if(/what if|could|maybe/.test(lower))opening='That opens a promising direction.';
  else if(/test|prototype|experiment/.test(lower))opening='A small prototype can answer this without overcommitting.';
  const memory=related.length?' This connects with “'+related[0].title+'.”':'';
  const ending=/\?$/.test(message.trim())?' Start with the smallest behavior that would prove or disprove the idea, then capture what changed.':' The next useful move is to name the assumption underneath it and design one quick way to challenge it.';
  return{text:opening+memory+ending,citedArtifactIds:related.map(item=>item.id),mode:'local' as const};
}

export async function generateStudioReply(context:Context,message:string){
  const related=relevant(message,context.artifacts);
  if(!configured())return localReply(context,message);
  try{
    const prompt=[
      'You are Studio, a calm creative collaborator for an interaction designer.',
      'Think with the designer, surface tension, and suggest one concrete next move. Keep the response below 140 words.',
      'Project: '+context.project.name+' — '+context.project.description,
      'Known memory:\n'+context.artifacts.slice(-15).map(a=>'['+a.id+'] '+a.type+': '+a.title+' — '+a.body).join('\n'),
      'Sources:\n'+context.sources.slice(-8).map(s=>s.title+' '+s.url+' '+s.note).join('\n'),
      'Recent conversation:\n'+context.session.messages.slice(-12).map(m=>(m.role==='user'?'Designer':'Studio')+': '+m.content).join('\n'),
      'Designer: '+message
    ].join('\n\n');
    const response=await client().models.generateContent({model:process.env.GEMINI_MODEL||'gemini-2.5-flash',contents:prompt});
    const text=response.text?.trim();if(!text)throw new Error('Empty AI response');
    return{text,citedArtifactIds:related.map(item=>item.id),mode:'ai' as const};
  }catch(error){console.error('Studio AI failed; using local collaborator:',error);return localReply(context,message)}
}

const allowed:ArtifactType[]=['decision','principle','question','idea','experiment','reference','risk','action','abandoned'];
const isType=(value:unknown):value is ArtifactType=>typeof value==='string'&&allowed.includes(value as ArtifactType);

function heuristicCapture(messages:StudioMessage[]):ExtractedArtifact[]{
  const artifacts:ExtractedArtifact[]=[];const seen=new Set<string>();
  const add=(type:ArtifactType,title:string,body:string,messageId:string,confidence=.68)=>{
    const clean=title.replace(/^[-–—\s]+/,'').trim().slice(0,120);const key=type+':'+clean.toLowerCase();
    if(clean.length<5||seen.has(key)||artifacts.length>=10)return;
    seen.add(key);artifacts.push({type,title:clean,body:body.trim(),confidence,sourceMessageIds:[messageId],tags:[]});
  };
  for(const message of messages){
    const sentences=message.content.match(/[^.!?]+[.!?]?/g)||[message.content];
    for(const raw of sentences){
      const sentence=raw.trim();const lower=sentence.toLowerCase();if(!sentence)continue;
      if(sentence.includes('?'))add('question',sentence.replace(/\?+$/,'')+'?',sentence,message.id,.82);
      else if(/\b(abandon|abandoned|drop|dropped|stop using|set aside|no longer)\b/.test(lower))add('abandoned',sentence,sentence,message.id,.78);
      else if(/\b(risk|concern|failure|problem|unclear|confusing)\b/.test(lower))add('risk',sentence,sentence,message.id,.7);
      else if(/\b(test|prototype|experiment|try|validate)\b/.test(lower))add('experiment',sentence,sentence,message.id,.76);
      else if(/\b(need to|next step|todo|follow up|action)\b/.test(lower))add('action',sentence,sentence,message.id,.72);
      else if(/\b(decide|decided|choose|chosen|we will|should be|want to)\b/.test(lower))add('decision',sentence,sentence,message.id,.74);
      else if(/\b(principle|always|never|on demand|default)\b/.test(lower))add('principle',sentence,sentence,message.id,.71);
      else if(/what if|\bcould\b|\bidea\b|\bmaybe\b/.test(lower))add('idea',sentence,sentence,message.id,.66);
    }
  }
  if(!artifacts.length&&messages.length){const last=messages[messages.length-1];add('idea',last.content.split(/[.!?]/)[0],last.content,last.id,.55)}
  return artifacts;
}

export async function extractSessionMemory(context:Context):Promise<{artifacts:ExtractedArtifact[];mode:'ai'|'local'}>{
  if(!configured())return{artifacts:heuristicCapture(context.session.messages),mode:'local'};
  try{
    const prompt=[
      'Extract durable creative project memory from this design conversation.',
      'Return only JSON with an artifacts array. Each item needs type, title, body, confidence, sourceMessageIds, and tags.',
      'Allowed types: decision, principle, question, idea, experiment, reference, risk, action, abandoned. Prefer 3-8 meaningful artifacts.',
      'Existing memory:\n'+context.artifacts.map(a=>a.type+': '+a.title).join('\n'),
      'Conversation:\n'+context.session.messages.map(m=>'['+m.id+'] '+(m.role==='user'?'Designer':'Studio')+': '+m.content).join('\n')
    ].join('\n\n');
    const response=await client().models.generateContent({model:process.env.GEMINI_MODEL||'gemini-2.5-flash',contents:prompt,config:{responseMimeType:'application/json'}});
    const parsed=JSON.parse(response.text||'{}') as {artifacts?:unknown[]};
    const artifacts=(parsed.artifacts||[]).filter((item):item is any=>Boolean(item&&typeof item==='object'&&isType((item as any).type)&&typeof(item as any).title==='string')).map(item=>({
      type:item.type,title:item.title,body:typeof item.body==='string'?item.body:'',confidence:typeof item.confidence==='number'?Math.min(1,Math.max(0,item.confidence)):.75,
      sourceMessageIds:Array.isArray(item.sourceMessageIds)?item.sourceMessageIds.filter((value:unknown)=>typeof value==='string'):[],tags:Array.isArray(item.tags)?item.tags.filter((value:unknown)=>typeof value==='string'):[]
    }));
    return{artifacts:artifacts.length?artifacts:heuristicCapture(context.session.messages),mode:artifacts.length?'ai':'local'};
  }catch(error){console.error('Memory extraction failed; using local extraction:',error);return{artifacts:heuristicCapture(context.session.messages),mode:'local'}}
}


export async function testGeminiConnection(apiKey:string,model:string){
  const probe=new GoogleGenAI({apiKey});
  const response=await probe.models.generateContent({model,contents:'Reply with exactly CONNECTED.'});
  if(!response.text?.trim())throw new Error('Gemini returned an empty response.');
  return true;
}
