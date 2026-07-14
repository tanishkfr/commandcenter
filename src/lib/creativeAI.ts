import type { ArtifactType, ExtractedArtifact, MemoryArtifact, StudioMessage, StudioProject, StudioSession, StudioSource } from './creativeMemory.js';

type Context={project:StudioProject;session:StudioSession;artifacts:MemoryArtifact[];sources:StudioSource[]};
type GatewayMessage={role:'system'|'user'|'assistant';content:string};
type GatewayResponse={choices?:Array<{message?:{content?:string}}> ;error?:{message?:string}};

const DEFAULT_GATEWAY_BASE_URL='https://ai-gateway.vercel.sh/v1';
export const DEFAULT_AI_MODEL='google/gemini-2.5-flash-lite';

const meaningful=(value:string|undefined)=>Boolean(value?.trim()&&!/YOUR_|MY_|change-me/i.test(value));
const credential=(override?:string)=>override?.trim()||process.env.AI_GATEWAY_API_KEY?.trim()||process.env.VERCEL_OIDC_TOKEN?.trim()||'';
export const aiConfigured=()=>meaningful(credential());
const gatewayTimeoutMs=()=>{const value=Number(process.env.AI_TIMEOUT_MS||12000);return Number.isFinite(value)?Math.min(25000,Math.max(3000,value)):12000};

export function describeGatewayError(error:unknown){
  const raw=error instanceof Error?error.message:String(error||'');
  if(/timeout|timed out|aborted/i.test(raw)||(error instanceof Error&&error.name==='TimeoutError'))return 'Vercel AI Gateway did not respond within '+Math.round(gatewayTimeoutMs()/1000)+' seconds. Remainder used offline guidance; retry or open Help → AI.';
  if(/401|403|unauthorized|forbidden|authentication|oidc/i.test(raw))return 'Vercel AI Gateway could not verify this deployment. Redeploy on Vercel, or add AI_GATEWAY_API_KEY for local development, then run the check again.';
  if(/402|429|credits|budget|rate limit|too many requests|payment/i.test(raw))return 'Vercel AI Gateway has no available credits or is rate limited. Check AI Gateway usage in Vercel, then retry.';
  if(/404|model.*not found|unknown model/i.test(raw))return 'The selected AI model is unavailable. Remove AI_MODEL or set it to '+DEFAULT_AI_MODEL+', then redeploy.';
  return raw||'Vercel AI Gateway could not be reached. Remainder used offline guidance; open Help → AI for the exact recovery steps.';
}

async function gatewayChat(options:{apiKey?:string;model?:string;messages:GatewayMessage[];temperature?:number;maxTokens?:number}){
  const apiKey=credential(options.apiKey);
  if(!meaningful(apiKey))throw new Error('AI Gateway authentication is not available.');
  const baseUrl=(process.env.AI_GATEWAY_BASE_URL||DEFAULT_GATEWAY_BASE_URL).replace(/\/+$/,'');
  const response=await fetch(baseUrl+'/chat/completions',{
    method:'POST',
    headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json',Accept:'application/json'},
    body:JSON.stringify({model:options.model||process.env.AI_MODEL||DEFAULT_AI_MODEL,messages:options.messages,temperature:options.temperature??.35,max_tokens:options.maxTokens??800,stream:false}),
    signal:AbortSignal.timeout(gatewayTimeoutMs())
  });
  const payload=await response.json().catch(()=>({})) as GatewayResponse;
  if(!response.ok)throw new Error('AI Gateway request failed ('+response.status+'): '+(payload.error?.message||response.statusText||'Connection failed'));
  const content=payload.choices?.[0]?.message?.content?.trim();
  if(!content)throw new Error('AI Gateway returned an empty response.');
  return content;
}

function relevant(message:string,artifacts:MemoryArtifact[]){
  const terms=message.toLowerCase().split(/\W+/).filter(term=>term.length>3);
  return artifacts.map(artifact=>({artifact,score:terms.reduce((sum,term)=>sum+((artifact.title+' '+artifact.body).toLowerCase().includes(term)?1:0),0)}))
    .filter(item=>item.score>0).sort((a,b)=>b.score-a.score).slice(0,4).map(item=>item.artifact);
}

function quotedSubject(message:string){
  const clean=message.replace(/\s+/g,' ').trim().replace(/^remainder[,\s:-]*/i,'');
  const short=clean.length>126?clean.slice(0,123).replace(/\s+\S*$/,'')+'…':clean;
  return short||'this direction';
}

function localReply(context:Context,message:string,fallbackReason?:string){
  const related=relevant(message,context.artifacts);const lower=message.toLowerCase();const subject=quotedSubject(message);
  let reflection:string;let nextMove:string;
  if(/\b(vs\.?|versus|compare|between|trade[ -]?off|either)\b/.test(lower)){
    reflection='You are weighing “'+subject+'.” The useful tension is not which option sounds better, but which criterion the project cannot afford to compromise.';
    nextMove='Write that criterion in one sentence, score both directions against it, then prototype the weaker option just enough to learn what you would be giving up.';
  }else if(/\b(risk|concern|worried|failure|break|problem|unclear|confus)/.test(lower)){
    reflection='The concern in “'+subject+'” is worth making concrete before it becomes a vague reason to stop.';
    nextMove='Name the failure you could actually observe, the person who would feel it first, and the smallest test that would expose it.';
  }else if(/\b(test|prototype|experiment|validate|research)\b/.test(lower)){
    reflection='“'+subject+'” sounds testable without committing the whole project.';
    nextMove='Choose one behavior, one audience, and one signal that would change your mind. Keep the test deliberately smaller than the solution.';
  }else if(/\b(decide|decision|choose|commit|ship|launch)\b/.test(lower)){
    reflection='“'+subject+'” is becoming a decision, so the reasoning matters as much as the outcome.';
    nextMove='State what you are choosing, what you are explicitly not choosing, and the evidence that would justify revisiting it later.';
  }else if(/\bwhy\b/.test(lower)){
    reflection='The deeper question in “'+subject+'” is what behavior or belief the visible choice is meant to create.';
    nextMove='Separate the intended effect from the current solution; then ask whether a simpler form could produce the same effect.';
  }else if(/\bhow\b/.test(lower)){
    reflection='“'+subject+'” becomes easier to approach when the transition is visible instead of treated as one large implementation.';
    nextMove='Describe the first observable state, the next state, and the evidence that should move the work between them.';
  }else if(/\b(what if|could|maybe|idea|imagine|explore)\b/.test(lower)){
    reflection='“'+subject+'” opens a direction with enough tension to explore, but not enough evidence to harden into a feature yet.';
    nextMove='Sketch the smallest version, identify the assumption it depends on, and decide what result would make you keep or abandon it.';
  }else if(message.trim().endsWith('?')){
    reflection='The question “'+subject+'” contains a decision the project has not made explicit yet.';
    nextMove='Answer it provisionally, list the assumption behind that answer, and test the assumption rather than debating the whole question.';
  }else{
    reflection='I am hearing “'+subject+'” as a thread that may shape '+context.project.name+', but its consequence is not explicit yet.';
    nextMove='Finish this sentence: “If this is true, the work should change by…” Then choose one small action that makes that change observable.';
  }
  const memory=related.length?' This connects to “'+related[0].title+'” in project memory.':' No existing memory matches it yet, so this is a new thread.';
  return{text:reflection+memory+' '+nextMove,citedArtifactIds:related.map(item=>item.id),mode:'local' as const,...(fallbackReason?{fallbackReason}:{})};
}

export async function generateStudioReply(context:Context,message:string){
  const related=relevant(message,context.artifacts);
  if(!aiConfigured())return localReply(context,message,'AI Gateway is not available in this runtime, so Remainder used prompt-specific offline guidance. Open Help → AI to connect hosted responses.');
  try{
    const prompt=[
      'Project: '+context.project.name+' — '+context.project.description,
      'Known memory:\n'+context.artifacts.slice(-15).map(a=>'['+a.id+'] '+a.type+': '+a.title+' — '+a.body).join('\n'),
      'Sources:\n'+context.sources.slice(-8).map(s=>s.title+' '+s.url+' '+s.note).join('\n'),
      'Recent conversation:\n'+context.session.messages.slice(-12).map(m=>(m.role==='user'?'Designer':'Remainder')+': '+m.content).join('\n'),
      'Designer: '+message
    ].join('\n\n');
    const text=await gatewayChat({
      messages:[
        {role:'system',content:'You are Remainder, a calm creative collaborator for an interaction designer. Respond directly to the specific prompt, use relevant project context, surface one meaningful tension, and suggest one concrete next move. Never reuse a stock response. Stay below 160 words.'},
        {role:'user',content:prompt}
      ],
      temperature:.45,
      maxTokens:420
    });
    return{text,citedArtifactIds:related.map(item=>item.id),mode:'ai' as const};
  }catch(error){console.error('Remainder AI Gateway failed; using offline guidance:',error);return localReply(context,message,describeGatewayError(error))}
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
  if(!aiConfigured())return{artifacts:heuristicCapture(context.session.messages),mode:'local'};
  try{
    const prompt=[
      'Extract durable creative project memory from this design conversation.',
      'Return only JSON with an artifacts array. Each item needs type, title, body, confidence, sourceMessageIds, and tags.',
      'Allowed types: decision, principle, question, idea, experiment, reference, risk, action, abandoned. Prefer 3-8 meaningful artifacts.',
      'Existing memory:\n'+context.artifacts.map(a=>a.type+': '+a.title).join('\n'),
      'Conversation:\n'+context.session.messages.map(m=>'['+m.id+'] '+(m.role==='user'?'Designer':'Remainder')+': '+m.content).join('\n')
    ].join('\n\n');
    const content=await gatewayChat({
      messages:[
        {role:'system',content:'You extract structured creative project memory. Output JSON only, with no markdown or commentary.'},
        {role:'user',content:prompt}
      ],
      temperature:.1,
      maxTokens:1200
    });
    const start=content.indexOf('{');const end=content.lastIndexOf('}');
    if(start<0||end<=start)throw new Error('AI Gateway did not return JSON.');
    const parsed=JSON.parse(content.slice(start,end+1)) as {artifacts?:unknown[]};
    const artifacts=(parsed.artifacts||[]).filter((item):item is any=>Boolean(item&&typeof item==='object'&&isType((item as any).type)&&typeof(item as any).title==='string')).map(item=>({
      type:item.type,title:item.title,body:typeof item.body==='string'?item.body:'',confidence:typeof item.confidence==='number'?Math.min(1,Math.max(0,item.confidence)):.75,
      sourceMessageIds:Array.isArray(item.sourceMessageIds)?item.sourceMessageIds.filter((value:unknown)=>typeof value==='string'):[],tags:Array.isArray(item.tags)?item.tags.filter((value:unknown)=>typeof value==='string'):[]
    }));
    return{artifacts:artifacts.length?artifacts:heuristicCapture(context.session.messages),mode:artifacts.length?'ai':'local'};
  }catch(error){console.error('Memory extraction failed; using local extraction:',error);return{artifacts:heuristicCapture(context.session.messages),mode:'local'};}
}

export async function testGatewayConnection(apiKey?:string,model?:string){
  await gatewayChat({apiKey,model:model||process.env.AI_MODEL||DEFAULT_AI_MODEL,messages:[{role:'user',content:'Reply with exactly CONNECTED.'}],temperature:0,maxTokens:16});
  return true;
}
