import type { ArtifactType, ExtractedArtifact, MemoryArtifact, StudioMessage, StudioProject, StudioSession, StudioSource } from './creativeMemory.js';

type Context={project:StudioProject;session:StudioSession;artifacts:MemoryArtifact[];sources:StudioSource[]};
type NimMessage={role:'system'|'user'|'assistant';content:string};
type NimResponse={choices?:Array<{message?:{content?:string}}> ;error?:{message?:string}};

const DEFAULT_NIM_BASE_URL='https://integrate.api.nvidia.com/v1';
export const DEFAULT_NIM_MODEL='meta/llama-3.3-70b-instruct';
const configured=()=>{const key=process.env.NVIDIA_API_KEY||'';return Boolean(key&&!key.includes('MY_NVIDIA')&&!key.includes('YOUR_NVIDIA'))};
const nvidiaTimeoutMs=()=>{const value=Number(process.env.NVIDIA_TIMEOUT_MS||30000);return Number.isFinite(value)?Math.min(50000,Math.max(3000,value)):30000};

export function describeNvidiaError(error:unknown){
  const raw=error instanceof Error?error.message:String(error||'');
  if(/timeout|timed out|aborted/i.test(raw)||(error instanceof Error&&error.name==='TimeoutError'))return 'NVIDIA NIM timed out after '+Math.round(nvidiaTimeoutMs()/1000)+' seconds. Confirm the model, rotate the NVIDIA API key if needed, then redeploy.';
  if(/401|unauthorized|invalid api key|authentication/i.test(raw))return 'NVIDIA rejected this API key. Create a fresh key at build.nvidia.com, update NVIDIA_API_KEY, then redeploy.';
  if(/404|model.*not found|unknown model/i.test(raw))return 'NVIDIA could not find this model. Use meta/llama-3.3-70b-instruct for NVIDIA_MODEL, then redeploy.';
  if(/429|rate limit|too many requests/i.test(raw))return 'NVIDIA is rate limiting this key. Wait a minute, then run the live check again.';
  return raw||'NVIDIA NIM could not be reached. Check the key, model, and deployment environment, then retry.';
}

async function nimChat(options:{apiKey:string;model:string;messages:NimMessage[];temperature?:number;maxTokens?:number}){
  const baseUrl=(process.env.NVIDIA_BASE_URL||DEFAULT_NIM_BASE_URL).replace(/\/+$/,'');
  const response=await fetch(baseUrl+'/chat/completions',{
    method:'POST',
    headers:{Authorization:'Bearer '+options.apiKey,'Content-Type':'application/json',Accept:'application/json'},
    body:JSON.stringify({model:options.model,messages:options.messages,temperature:options.temperature??.35,top_p:.9,max_tokens:options.maxTokens??800,stream:false}),
    signal:AbortSignal.timeout(nvidiaTimeoutMs())
  });
  const payload=await response.json().catch(()=>({})) as NimResponse;
  if(!response.ok)throw new Error('NVIDIA NIM request failed: '+(payload.error?.message||response.statusText||'Connection failed'));
  const content=payload.choices?.[0]?.message?.content?.trim();
  if(!content)throw new Error('NVIDIA NIM returned an empty response.');
  return content;
}

function relevant(message:string,artifacts:MemoryArtifact[]){
  const terms=message.toLowerCase().split(/\W+/).filter(term=>term.length>3);
  return artifacts.map(artifact=>({artifact,score:terms.reduce((sum,term)=>sum+((artifact.title+' '+artifact.body).toLowerCase().includes(term)?1:0),0)}))
    .filter(item=>item.score>0).sort((a,b)=>b.score-a.score).slice(0,4).map(item=>item.artifact);
}

function localReply(context:Context,message:string,fallbackReason?:string){
  const related=relevant(message,context.artifacts);const lower=message.toLowerCase();
  let opening='There is a useful tension in that.';
  if(/\bwhy\b/.test(lower))opening='The rationale seems to be less about the visible solution and more about the behavior it creates.';
  else if(/\bhow\b/.test(lower))opening='I would make the transition observable before deciding on the final form.';
  else if(/what if|could|maybe/.test(lower))opening='That opens a promising direction.';
  else if(/test|prototype|experiment/.test(lower))opening='A small prototype can answer this without overcommitting.';
  const memory=related.length?' This connects with “'+related[0].title+'.”':'';
  const ending=/\?$/.test(message.trim())?' Start with the smallest behavior that would prove or disprove the idea, then capture what changed.':' The next useful move is to name the assumption underneath it and design one quick way to challenge it.';
  return{text:opening+memory+ending,citedArtifactIds:related.map(item=>item.id),mode:'local' as const,...(fallbackReason?{fallbackReason}:{})};
}

export async function generateStudioReply(context:Context,message:string){
  const related=relevant(message,context.artifacts);
  if(!configured())return localReply(context,message,'NVIDIA NIM is not configured, so local intelligence answered instead.');
  try{
    const prompt=[
      'You are Remainder, a calm creative collaborator for an interaction designer.',
      'Think with the designer, surface tension, and suggest one concrete next move. Keep the response below 140 words.',
      'Project: '+context.project.name+' — '+context.project.description,
      'Known memory:\n'+context.artifacts.slice(-15).map(a=>'['+a.id+'] '+a.type+': '+a.title+' — '+a.body).join('\n'),
      'Sources:\n'+context.sources.slice(-8).map(s=>s.title+' '+s.url+' '+s.note).join('\n'),
      'Recent conversation:\n'+context.session.messages.slice(-12).map(m=>(m.role==='user'?'Designer':'Remainder')+': '+m.content).join('\n'),
      'Designer: '+message
    ].join('\n\n');
    const text=await nimChat({
      apiKey:process.env.NVIDIA_API_KEY||'',
      model:process.env.NVIDIA_MODEL||DEFAULT_NIM_MODEL,
      messages:[
        {role:'system',content:'You are Remainder, a calm creative collaborator for an interaction designer. Think with the designer, surface tension, and suggest one concrete next move. Keep the response below 140 words.'},
        {role:'user',content:prompt}
      ],
      temperature:.45,
      maxTokens:360
    });
    return{text,citedArtifactIds:related.map(item=>item.id),mode:'ai' as const};
  }catch(error){console.error('Remainder AI failed; using local collaborator:',error);return localReply(context,message,describeNvidiaError(error))}
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
      'Conversation:\n'+context.session.messages.map(m=>'['+m.id+'] '+(m.role==='user'?'Designer':'Remainder')+': '+m.content).join('\n')
    ].join('\n\n');
    const content=await nimChat({
      apiKey:process.env.NVIDIA_API_KEY||'',
      model:process.env.NVIDIA_MODEL||DEFAULT_NIM_MODEL,
      messages:[
        {role:'system',content:'You extract structured creative project memory. Output JSON only, with no markdown or commentary.'},
        {role:'user',content:prompt}
      ],
      temperature:.1,
      maxTokens:1200
    });
    const start=content.indexOf('{');const end=content.lastIndexOf('}');
    if(start<0||end<=start)throw new Error('NVIDIA NIM did not return JSON.');
    const parsed=JSON.parse(content.slice(start,end+1)) as {artifacts?:unknown[]};
    const artifacts=(parsed.artifacts||[]).filter((item):item is any=>Boolean(item&&typeof item==='object'&&isType((item as any).type)&&typeof(item as any).title==='string')).map(item=>({
      type:item.type,title:item.title,body:typeof item.body==='string'?item.body:'',confidence:typeof item.confidence==='number'?Math.min(1,Math.max(0,item.confidence)):.75,
      sourceMessageIds:Array.isArray(item.sourceMessageIds)?item.sourceMessageIds.filter((value:unknown)=>typeof value==='string'):[],tags:Array.isArray(item.tags)?item.tags.filter((value:unknown)=>typeof value==='string'):[]
    }));
    return{artifacts:artifacts.length?artifacts:heuristicCapture(context.session.messages),mode:artifacts.length?'ai':'local'};
  }catch(error){console.error('Memory extraction failed; using local extraction:',error);return{artifacts:heuristicCapture(context.session.messages),mode:'local'}}
}


export async function testNvidiaConnection(apiKey:string,model:string){
  await nimChat({
    apiKey,
    model:model||DEFAULT_NIM_MODEL,
    messages:[{role:'user',content:'Reply with exactly CONNECTED.'}],
    temperature:0,
    maxTokens:16
  });
  return true;
}
