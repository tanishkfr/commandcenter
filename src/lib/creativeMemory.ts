import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { get, put } from '@vercel/blob';

export type ArtifactType = 'decision' | 'principle' | 'question' | 'idea' | 'experiment' | 'reference' | 'risk' | 'action' | 'abandoned';
export type ArtifactStatus = 'active' | 'resolved' | 'archived';
export type ArtifactReviewStatus = 'pending' | 'accepted' | 'rejected';
export type ArtifactOrigin = 'ai' | 'local' | 'manual';
export type SourceType = 'link' | 'figma' | 'github' | 'note' | 'document';

export interface StudioProject { id:string; name:string; description:string; color:string; createdAt:string; updatedAt:string }
export interface StudioMessage { id:string; role:'user'|'assistant'; content:string; createdAt:string; citedArtifactIds:string[] }
export interface StudioSession { id:string; projectId:string; title:string; createdAt:string; updatedAt:string; capturedAt:string|null; messages:StudioMessage[] }
export interface MemoryArtifact { id:string; projectId:string; sessionId:string|null; type:ArtifactType; title:string; body:string; status:ArtifactStatus; reviewStatus:ArtifactReviewStatus; origin:ArtifactOrigin; relatedArtifactIds:string[]; supersedesArtifactIds:string[]; supersededByArtifactId:string|null; tags:string[]; confidence:number; sourceMessageIds:string[]; createdAt:string; updatedAt:string }
export interface StudioSource { id:string; projectId:string; type:SourceType; title:string; url:string; note:string; createdAt:string }
export interface TimelineEvent { id:string; projectId:string; type:string; title:string; detail:string; sessionId:string|null; artifactId:string|null; createdAt:string }
export interface CreativeMemoryState { version:number; activeProjectId:string; projects:StudioProject[]; sessions:StudioSession[]; artifacts:MemoryArtifact[]; sources:StudioSource[]; events:TimelineEvent[] }
export interface DeletedProjectSnapshot { project:StudioProject; sessions:StudioSession[]; artifacts:MemoryArtifact[]; sources:StudioSource[]; events:TimelineEvent[] }
export interface ExtractedArtifact { type:ArtifactType; title:string; body?:string; confidence?:number; sourceMessageIds?:string[]; tags?:string[] }
export type SearchResultKind='project'|'artifact'|'conversation'|'source'|'history';
export interface SearchResult { id:string; kind:SearchResultKind; projectId:string; projectName:string; sessionId?:string; artifactId?:string; artifactType?:ArtifactType; url?:string; title:string; snippet:string; meta:string; score:number }

const DATA_DIR = process.env.REMAINDER_DATA_DIR ? path.resolve(process.env.REMAINDER_DATA_DIR) : path.join(process.cwd(), '.memory');
const DATA_FILE = path.join(DATA_DIR, 'studio.json');
const BLOB_PATH = 'creative-memory/studio.json';
export type CreativeStorageMode='local-file'|'vercel-blob';
export const creativeStorageMode=():CreativeStorageMode=>process.env.VERCEL?'vercel-blob':'local-file';
type StateSnapshot={state:CreativeMemoryState;etag?:string};
const isPreconditionError=(error:unknown)=>error instanceof Error&&(error.name==='BlobPreconditionFailedError'||/precondition|etag mismatch/i.test(error.message));
const cloudStorageError=()=>new Error('Cloud storage is not connected. Add a private Vercel Blob store to this project, then redeploy.');
const conflictError=()=>new Error('Project memory changed while saving. Please try again.');
const MAX_BLOB_WRITE_ATTEMPTS=7;
const waitForConflict=(attempt:number)=>new Promise<void>(resolve=>setTimeout(resolve,Math.min(25*(2**attempt),200)+Math.floor(Math.random()*25)));
const now = () => new Date().toISOString();
const daysAgo = (days:number) => new Date(Date.now() - days * 86400000).toISOString();
const makeId = (prefix:string) => prefix + '_' + randomUUID().replace(/-/g, '').slice(0, 12);
const DEFAULT_PROJECT_COLOR='#9E4935';
const ARTIFACT_TYPES=new Set<ArtifactType>(['decision','principle','question','idea','experiment','reference','risk','action','abandoned']);
const ARTIFACT_STATUSES=new Set<ArtifactStatus>(['active','resolved','archived']);
const SOURCE_TYPES=new Set<SourceType>(['link','figma','github','note','document']);
const ARTIFACT_REVIEW_STATUSES=new Set<ArtifactReviewStatus>(['pending','accepted','rejected']);
const ARTIFACT_ORIGINS=new Set<ArtifactOrigin>(['ai','local','manual']);

export function requireProjectColor(value:string|undefined,fallback=DEFAULT_PROJECT_COLOR){
  if(value===undefined||value==='')return fallback;
  const clean=String(value).trim();
  if(!/^#[0-9a-f]{6}$/i.test(clean))throw new Error('Use a six-digit hex color for the project.');
  return clean;
}

export function requireSourceUrl(value:string|undefined){
  const clean=String(value||'').trim();
  if(!clean)return '';
  try{
    const parsed=new URL(clean);
    if(parsed.protocol!=='http:'&&parsed.protocol!=='https:')throw new Error('Unsupported protocol');
    return parsed.toString();
  }catch{throw new Error('Use a complete source address beginning with http:// or https://.')}
}

const storedProjectColor=(value:unknown)=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value)?value:DEFAULT_PROJECT_COLOR;
const storedSourceUrl=(value:unknown)=>{try{return requireSourceUrl(typeof value==='string'?value:undefined)}catch{return ''}};
const sanitizeRestoredArtifact=(input:MemoryArtifact):MemoryArtifact=>{
  if(!ARTIFACT_TYPES.has(input.type)||!ARTIFACT_STATUSES.has(input.status)||!ARTIFACT_REVIEW_STATUSES.has(input.reviewStatus)||!ARTIFACT_ORIGINS.has(input.origin))throw new Error('The removed memory contains invalid project data.');
  const title=String(input.title||'').trim();if(!title)throw new Error('The removed memory needs a title before it can be restored.');
  return {...input,title,body:String(input.body||'').trim(),tags:Array.from(new Set((Array.isArray(input.tags)?input.tags:[]).map(tag=>String(tag).trim()).filter(Boolean))).slice(0,50),relatedArtifactIds:(Array.isArray(input.relatedArtifactIds)?input.relatedArtifactIds:[]).filter(id=>typeof id==='string'),supersedesArtifactIds:(Array.isArray(input.supersedesArtifactIds)?input.supersedesArtifactIds:[]).filter(id=>typeof id==='string'),supersededByArtifactId:typeof input.supersededByArtifactId==='string'?input.supersededByArtifactId:null,sourceMessageIds:(Array.isArray(input.sourceMessageIds)?input.sourceMessageIds:[]).filter(id=>typeof id==='string'),confidence:Number.isFinite(input.confidence)?Math.max(0,Math.min(1,input.confidence)):.5};
};

export function normalizeCreativeMemoryState(state:CreativeMemoryState):CreativeMemoryState {
  if(!state||!Array.isArray(state.projects)||!state.projects.length)return createFreshState();
  const legacyProjects={atlas:['Atlas','Exploring spatial wayfinding without demanding attention.'],pentimento:['Pentimento','A living record of how creative work changes.'],'invisible-interfaces':['Invisible Interfaces','Designing systems that know when to disappear.']} as const;
  const untouchedDemo=state.version<=3&&state.projects.length===3&&state.projects.every(project=>{const expected=legacyProjects[project.id as keyof typeof legacyProjects];return expected&&project.name===expected[0]&&project.description===expected[1]})&&state.sessions?.length===1&&state.sessions[0]?.id==='session_welcome'&&state.sessions[0].messages?.length===2&&state.sessions[0].messages[0]?.id==='msg_welcome_user'&&state.sessions[0].messages[1]?.id==='msg_welcome_studio'&&!(state.artifacts||[]).length&&!(state.sources||[]).length;
  if(untouchedDemo)return createFreshState();
  state.version=4;
  state.projects=(state.projects||[]).map(project=>({...project,name:String(project.name||'Untitled project').trim()||'Untitled project',description:String(project.description||'').trim(),color:storedProjectColor(project.color)}));
  state.sessions=(state.sessions||[]).map(session=>({...session,title:String(session.title||'Conversation').trim()||'Conversation',messages:(Array.isArray(session.messages)?session.messages:[]).filter(message=>message&&(message.role==='user'||message.role==='assistant')).map(message=>({...message,content:String(message.content||''),citedArtifactIds:(Array.isArray(message.citedArtifactIds)?message.citedArtifactIds:[]).filter(id=>typeof id==='string')}))}));
  state.artifacts=(state.artifacts||[]).map(artifact=>({
    ...artifact,
    type:ARTIFACT_TYPES.has(artifact.type)?artifact.type:'idea',
    title:String(artifact.title||'Untitled memory').trim()||'Untitled memory',
    body:String(artifact.body||'').trim(),
    status:ARTIFACT_STATUSES.has(artifact.status)?artifact.status:'active',
    reviewStatus:ARTIFACT_REVIEW_STATUSES.has(artifact.reviewStatus)?artifact.reviewStatus:'accepted',
    origin:ARTIFACT_ORIGINS.has(artifact.origin)?artifact.origin:'manual',
    relatedArtifactIds:(Array.isArray(artifact.relatedArtifactIds)?artifact.relatedArtifactIds:[]).filter(id=>typeof id==='string'),
    supersedesArtifactIds:(Array.isArray(artifact.supersedesArtifactIds)?artifact.supersedesArtifactIds:[]).filter(id=>typeof id==='string'),
    supersededByArtifactId:typeof artifact.supersededByArtifactId==='string'?artifact.supersededByArtifactId:null,
    tags:Array.from(new Set((Array.isArray(artifact.tags)?artifact.tags:[]).map(tag=>String(tag).trim()).filter(Boolean))).slice(0,50),
    confidence:Number.isFinite(artifact.confidence)?Math.max(0,Math.min(1,artifact.confidence)):.5,
    sourceMessageIds:(Array.isArray(artifact.sourceMessageIds)?artifact.sourceMessageIds:[]).filter(id=>typeof id==='string')
  }));
  state.sources=(state.sources||[]).map(source=>({...source,type:SOURCE_TYPES.has(source.type)?source.type:'link',title:String(source.title||'Untitled source').trim()||'Untitled source',url:storedSourceUrl(source.url),note:String(source.note||'').trim()}));
  state.events=(state.events||[]).map(event=>({...event,title:String(event.title||'Project update').trim()||'Project update',detail:String(event.detail||'').trim()}));
  for(const project of state.projects){
    if(!state.sessions.some(session=>session.projectId===project.id)){
      const timestamp=project.updatedAt||project.createdAt||now();
      state.sessions.push({id:'session_'+project.id+'_first',projectId:project.id,title:'First conversation',createdAt:timestamp,updatedAt:timestamp,capturedAt:null,messages:[]});
    }
  }
  if(!state.projects.some(project=>project.id===state.activeProjectId))state.activeProjectId=state.projects[0].id;
  return state;
}

const MEMORY_STOP_WORDS=new Set(['about','after','again','against','because','before','being','between','could','from','have','into','more','only','other','should','that','their','there','these','this','through','using','very','what','when','where','which','while','with','would']);
const memoryTerms=(value:string)=>Array.from(new Set(value.toLowerCase().split(/[^a-z0-9]+/).filter(term=>term.length>3&&!MEMORY_STOP_WORDS.has(term))));

export function findRelatedArtifactIds(candidate:Pick<MemoryArtifact,'id'|'projectId'|'type'|'title'|'body'>,artifacts:MemoryArtifact[]) {
  const candidateTerms=memoryTerms(candidate.title+' '+candidate.body);
  const changeTypes=new Set<ArtifactType>(['decision','principle','abandoned']);
  if(!changeTypes.has(candidate.type)||!candidateTerms.length)return [];
  return artifacts.filter(item=>item.id!==candidate.id&&item.projectId===candidate.projectId&&item.status==='active'&&item.reviewStatus==='accepted'&&changeTypes.has(item.type))
    .map(item=>{const terms=memoryTerms(item.title+' '+item.body);const overlap=candidateTerms.filter(term=>terms.includes(term)).length;return{item,overlap}})
    .filter(({overlap})=>overlap>=2)
    .sort((a,b)=>b.overlap-a.overlap)
    .slice(0,3)
    .map(({item})=>item.id);
}


export function releaseArtifactSupersession(artifact:MemoryArtifact,artifacts:MemoryArtifact[],timestamp:string) {
  for(const earlierId of artifact.supersedesArtifactIds){
    const earlier=artifacts.find(item=>item.id===earlierId);
    if(earlier?.supersededByArtifactId===artifact.id){
      earlier.status='active';
      earlier.supersededByArtifactId=null;
      earlier.updatedAt=timestamp;
    }
  }
  artifact.supersedesArtifactIds=[];
}

export function applyArtifactSupersession(artifact:MemoryArtifact,artifacts:MemoryArtifact[],supersedeIds:string[],timestamp:string) {
  releaseArtifactSupersession(artifact,artifacts,timestamp);
  const related=new Set(artifact.relatedArtifactIds);
  const eligible=Array.from(new Set(supersedeIds))
    .map(id=>artifacts.find(item=>item.id===id))
    .filter((item):item is MemoryArtifact=>Boolean(item&&item.id!==artifact.id&&item.projectId===artifact.projectId&&item.reviewStatus==='accepted'&&related.has(item.id)));
  artifact.supersedesArtifactIds=eligible.map(item=>item.id);
  for(const earlier of eligible){
    earlier.status='resolved';
    earlier.supersededByArtifactId=artifact.id;
    earlier.updatedAt=timestamp;
  }
  return artifact.supersedesArtifactIds;
}

export function createFreshState():CreativeMemoryState {
  const timestamp=now();
  const project:StudioProject={ id:'my-first-project', name:'My first project', description:'A fresh space for your next idea.', color:DEFAULT_PROJECT_COLOR, createdAt:timestamp, updatedAt:timestamp };
  const session:StudioSession={ id:'session_first', projectId:project.id, title:'First conversation', createdAt:timestamp, updatedAt:timestamp, capturedAt:null, messages:[] };
  return { version:4, activeProjectId:project.id, projects:[project], sessions:[session], artifacts:[], sources:[], events:[] };
}

class CreativeMemoryStore {
  private queue:Promise<unknown> = Promise.resolve();

  private async readCloud():Promise<StateSnapshot> {
    for(let attempt=0;attempt<3;attempt++){
      try {
        let result:any=await get(BLOB_PATH,{access:'private',useCache:false});
        if(!result||result.statusCode===404){
          const initial=createFreshState();
          try{const created:any=await put(BLOB_PATH,JSON.stringify(initial),{access:'private',contentType:'application/json',allowOverwrite:false});return{state:initial,etag:created.etag}}
          catch(error){if(!isPreconditionError(error))throw error;if(attempt===2)throw new Error('Project memory changed while loading. Please try again.');await waitForConflict(attempt);continue}
        }
        if(!result||result.statusCode!==200||!result.stream||!result.blob)throw cloudStorageError();
        const text=await new Response(result.stream).text();
        return{state:normalizeCreativeMemoryState(JSON.parse(text) as CreativeMemoryState),etag:result.blob.etag};
      }catch(error){
        if(isPreconditionError(error)&&attempt<2){await waitForConflict(attempt);continue}
        if(isPreconditionError(error))throw new Error('Project memory changed while loading. Please try again.');
        console.error('Vercel Blob storage error',error);throw cloudStorageError();
      }
    }
    throw cloudStorageError();
  }

  private async readSnapshot():Promise<StateSnapshot> {
    if(creativeStorageMode()==='vercel-blob')return this.readCloud();
    await fs.mkdir(DATA_DIR,{recursive:true});
    try{await fs.access(DATA_FILE)}catch{await this.writeLocal(createFreshState())}
    return{state:normalizeCreativeMemoryState(JSON.parse(await fs.readFile(DATA_FILE,'utf8')) as CreativeMemoryState)};
  }

  private async read():Promise<CreativeMemoryState>{return(await this.readSnapshot()).state}
  private async writeLocal(state:CreativeMemoryState){
    await fs.mkdir(DATA_DIR,{recursive:true});const temp=DATA_FILE+'.tmp';await fs.writeFile(temp,JSON.stringify(state,null,2),'utf8');await fs.rename(temp,DATA_FILE);
  }
  private async write(state:CreativeMemoryState,etag?:string){
    if(creativeStorageMode()==='local-file')return this.writeLocal(state);
    try{await put(BLOB_PATH,JSON.stringify(state),{access:'private',contentType:'application/json',allowOverwrite:true,...(etag?{ifMatch:etag}:{})})}
    catch(error){if(isPreconditionError(error))throw error;console.error('Vercel Blob write error',error);throw cloudStorageError()}
  }

  private mutate<T>(fn:(state:CreativeMemoryState)=>T|Promise<T>):Promise<T>{
    const operation=this.queue.then(async()=>{
      for(let attempt=0;attempt<MAX_BLOB_WRITE_ATTEMPTS;attempt++){
        const snapshot=await this.readSnapshot();const result=await fn(snapshot.state);
        try{await this.write(snapshot.state,snapshot.etag);return result}catch(error){
          if(!isPreconditionError(error))throw error;
          if(attempt===MAX_BLOB_WRITE_ATTEMPTS-1)throw conflictError();
          await waitForConflict(attempt);
        }
      }
      throw conflictError();
    });
    this.queue=operation.catch(()=>undefined);return operation;
  }

  private addEvent(state:CreativeMemoryState, projectId:string, type:string, title:string, detail:string, sessionId?:string, artifactId?:string) {
    state.events.push({ id:makeId('event'), projectId, type, title, detail, sessionId:sessionId||null, artifactId:artifactId||null, createdAt:now() });
  }

  async bootstrap(projectId?:string) {
    const state = await this.read();
    const project = state.projects.find(item=>item.id===projectId) || state.projects.find(item=>item.id===state.activeProjectId) || state.projects[0];
    if (!project) throw new Error('No project exists');
    const sessions = state.sessions.filter(item=>item.projectId===project.id).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
    return {
      project, projects:state.projects, sessions, activeSession:sessions[0]||null,
      artifacts:state.artifacts.filter(item=>item.projectId===project.id).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)),
      sources:state.sources.filter(item=>item.projectId===project.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)),
      events:state.events.filter(item=>item.projectId===project.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)),
      aiConfigured:Boolean(process.env.NVIDIA_API_KEY && !process.env.NVIDIA_API_KEY.includes('MY_NVIDIA') && !process.env.NVIDIA_API_KEY.includes('YOUR_NVIDIA')),
      storageMode:creativeStorageMode()
    };
  }

  async setActiveProject(projectId:string) {
    const state=await this.read();
    if(!state.projects.some(item=>item.id===projectId))throw new Error('Project not found');
    return projectId;
  }

  async createProject(input:{name:string;description?:string;color?:string}) {
    return this.mutate(state=>{
      const name=String(input.name||'').trim();
      if(!name)throw new Error('Project name is required');
      const timestamp=now();
      const project:StudioProject={ id:makeId('project'), name, description:String(input.description||'').trim(), color:requireProjectColor(input.color), createdAt:timestamp, updatedAt:timestamp };
      const session:StudioSession={ id:makeId('session'), projectId:project.id, title:'First conversation', createdAt:timestamp, updatedAt:timestamp, capturedAt:null, messages:[] };
      state.projects.push(project); state.sessions.push(session); state.activeProjectId=project.id;
      this.addEvent(state, project.id, 'project', 'Project created', 'A new creative memory began.', session.id);
      return {project,session};
    });
  }

  async updateProject(projectId:string, updates:Partial<Pick<StudioProject,'name'|'description'|'color'>>) {
    return this.mutate(state=>{
      const project=state.projects.find(item=>item.id===projectId);
      if (!project) throw new Error('Project not found');
      const nextName=updates.name===undefined?project.name:String(updates.name||'').trim();
      if(!nextName)throw new Error('Project name is required');
      project.name=nextName;
      if(updates.description!==undefined)project.description=String(updates.description||'').trim();
      if(updates.color!==undefined)project.color=requireProjectColor(updates.color,project.color);
      project.updatedAt=now();
      return project;
    });
  }

  async deleteProject(projectId:string) {
    return this.mutate(state=>{
      const project=state.projects.find(item=>item.id===projectId);
      if(!project)throw new Error('Project not found');
      if(state.projects.length===1)throw new Error('A workspace needs at least one project. Rename this one or begin again.');
      const snapshot:DeletedProjectSnapshot={
        project:{...project},
        sessions:state.sessions.filter(item=>item.projectId===projectId).map(item=>({...item,messages:item.messages.map(message=>({...message,citedArtifactIds:[...message.citedArtifactIds]}))})),
        artifacts:state.artifacts.filter(item=>item.projectId===projectId).map(item=>({...item,relatedArtifactIds:[...item.relatedArtifactIds],supersedesArtifactIds:[...item.supersedesArtifactIds],tags:[...item.tags],sourceMessageIds:[...item.sourceMessageIds]})),
        sources:state.sources.filter(item=>item.projectId===projectId).map(item=>({...item})),
        events:state.events.filter(item=>item.projectId===projectId).map(item=>({...item}))
      };
      state.projects=state.projects.filter(item=>item.id!==projectId);
      state.sessions=state.sessions.filter(item=>item.projectId!==projectId);
      state.artifacts=state.artifacts.filter(item=>item.projectId!==projectId);
      state.sources=state.sources.filter(item=>item.projectId!==projectId);
      state.events=state.events.filter(item=>item.projectId!==projectId);
      if(state.activeProjectId===projectId)state.activeProjectId=state.projects[0].id;
      return{snapshot,activeProjectId:state.activeProjectId};
    });
  }

  async restoreProject(snapshot:DeletedProjectSnapshot) {
    return this.mutate(state=>{
      const name=String(snapshot?.project?.name||'').trim();
      if(typeof snapshot?.project?.id!=='string'||!snapshot.project.id||!name)throw new Error('The removed project could not be restored');
      const projectId=snapshot.project.id;
      if(state.projects.some(item=>item.id===projectId))throw new Error('This project is already restored');
      const timestamp=now();
      const project={...snapshot.project,name,description:String(snapshot.project.description||'').trim(),color:requireProjectColor(snapshot.project.color),updatedAt:timestamp};
      const sessions=(Array.isArray(snapshot.sessions)?snapshot.sessions:[]).filter(item=>item?.projectId===projectId&&!state.sessions.some(existing=>existing.id===item.id)).map(item=>({...item,title:String(item.title||'').trim()||'Conversation',messages:(Array.isArray(item.messages)?item.messages:[]).filter(message=>message&&(message.role==='user'||message.role==='assistant')).map(message=>({...message,content:String(message.content||''),citedArtifactIds:(Array.isArray(message.citedArtifactIds)?message.citedArtifactIds:[]).filter(id=>typeof id==='string')}))}));
      const restoredSessions=sessions.length?sessions:[{id:makeId('session'),projectId,title:'First conversation',createdAt:timestamp,updatedAt:timestamp,capturedAt:null,messages:[]}];
      const artifacts=(Array.isArray(snapshot.artifacts)?snapshot.artifacts:[]).filter(item=>item?.projectId===projectId&&!state.artifacts.some(existing=>existing.id===item.id)).map(sanitizeRestoredArtifact);
      const sources=(Array.isArray(snapshot.sources)?snapshot.sources:[]).filter(item=>item?.projectId===projectId&&!state.sources.some(existing=>existing.id===item.id)).map(item=>({...item,type:SOURCE_TYPES.has(item.type)?item.type:'link',title:String(item.title||'').trim()||'Untitled source',url:requireSourceUrl(item.url),note:String(item.note||'').trim()}));
      const events=(Array.isArray(snapshot.events)?snapshot.events:[]).filter(item=>item?.projectId===projectId&&!state.events.some(existing=>existing.id===item.id)).map(item=>({...item,title:String(item.title||'').trim()||'Project restored',detail:String(item.detail||'').trim()}));
      state.projects.push(project);state.sessions.push(...restoredSessions);state.artifacts.push(...artifacts);state.sources.push(...sources);state.events.push(...events);state.activeProjectId=projectId;
      const activeSession=[...restoredSessions].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0]||null;
      return{project,activeSession};
    });
  }
  async createSession(projectId:string,title='New conversation') {
    return this.mutate(state=>{
      if (!state.projects.some(item=>item.id===projectId)) throw new Error('Project not found');
      const timestamp=now();
      const session:StudioSession={ id:makeId('session'), projectId, title:String(title||'').trim()||'New conversation', createdAt:timestamp, updatedAt:timestamp, capturedAt:null, messages:[] };
      state.sessions.push(session);
      this.addEvent(state,projectId,'conversation',session.title,'A new conversation started.',session.id);
      return session;
    });
  }

  async getSession(sessionId:string) {
    const state=await this.read();
    const session=state.sessions.find(item=>item.id===sessionId);
    if (!session) throw new Error('Session not found');
    return session;
  }

  async addMessage(sessionId:string,role:StudioMessage['role'],content:string,citedArtifactIds:string[] = []) {
    return this.mutate(state=>{
      const session=state.sessions.find(item=>item.id===sessionId);
      if (!session) throw new Error('Session not found');
      if (!content.trim()) throw new Error('Message cannot be empty');
      const message:StudioMessage={id:makeId('msg'),role,content:content.trim(),createdAt:now(),citedArtifactIds};
      session.messages.push(message); session.updatedAt=message.createdAt;
      if (session.messages.length===1 && /^(New conversation|First conversation)$/.test(session.title)) session.title=content.trim().slice(0,54);
      const project=state.projects.find(item=>item.id===session.projectId);
      if (project) project.updatedAt=message.createdAt;
      return message;
    });
  }

  async addExchange(sessionId:string,userContent:string,assistantContent:string,citedArtifactIds:string[] = []) {
    return this.mutate(state=>{
      const session=state.sessions.find(item=>item.id===sessionId);
      if(!session)throw new Error('Conversation not found. Open the project again and retry.');
      const cleanUser=userContent.trim();const cleanAssistant=assistantContent.trim();
      if(!cleanUser||!cleanAssistant)throw new Error('The conversation exchange was incomplete');
      const user:StudioMessage={id:makeId('msg'),role:'user',content:cleanUser,createdAt:now(),citedArtifactIds:[]};
      const assistant:StudioMessage={id:makeId('msg'),role:'assistant',content:cleanAssistant,createdAt:now(),citedArtifactIds};
      session.messages.push(user,assistant);session.updatedAt=assistant.createdAt;
      if(session.messages.length===2&&/^(New conversation|First conversation)$/.test(session.title))session.title=cleanUser.slice(0,54);
      const project=state.projects.find(item=>item.id===session.projectId);
      if(project)project.updatedAt=assistant.createdAt;
      return{user,assistant};
    });
  }

  async context(projectId:string,sessionId:string) {
    const state=await this.read();
    const project=state.projects.find(item=>item.id===projectId);
    const session=state.sessions.find(item=>item.id===sessionId);
    if (!project||!session) throw new Error('Project or session not found');
    return { project, session, artifacts:state.artifacts.filter(item=>item.projectId===projectId&&item.status==='active'&&item.reviewStatus==='accepted').slice(-20), sources:state.sources.filter(item=>item.projectId===projectId).slice(-10) };
  }

  async captureSession(sessionId:string,extracted:ExtractedArtifact[],origin:ArtifactOrigin='local') {
    return this.mutate(state=>{
      const session=state.sessions.find(item=>item.id===sessionId);
      if (!session) throw new Error('Session not found');
      const timestamp=now(); const captured:MemoryArtifact[]=[];
      for (const item of extracted) {
        if (!item.title?.trim()) continue;
        const normalized=item.title.trim().toLowerCase();
        const existing=state.artifacts.find(a=>a.projectId===session.projectId&&a.type===item.type&&a.title.trim().toLowerCase()===normalized);
        if (existing) {
          existing.body=item.body?.trim()||existing.body; existing.updatedAt=timestamp; existing.confidence=Math.max(existing.confidence,item.confidence??.75);
          existing.sourceMessageIds=Array.from(new Set([...existing.sourceMessageIds,...(item.sourceMessageIds||[])])); captured.push(existing);
          this.addEvent(state,session.projectId,'memory-strengthened',existing.title,'An existing memory was strengthened.',sessionId,existing.id);
        } else {
          const artifact:MemoryArtifact={ id:makeId('memory'), projectId:session.projectId, sessionId, type:item.type, title:item.title.trim(), body:item.body?.trim()||'', status:'active', reviewStatus:'pending', origin, relatedArtifactIds:[], supersedesArtifactIds:[], supersededByArtifactId:null, tags:item.tags||[], confidence:item.confidence??.75, sourceMessageIds:item.sourceMessageIds||[], createdAt:timestamp, updatedAt:timestamp };
          artifact.relatedArtifactIds=findRelatedArtifactIds(artifact,state.artifacts);
          state.artifacts.push(artifact); captured.push(artifact);
          this.addEvent(state,session.projectId,artifact.type,artifact.title,artifact.body||('A '+artifact.type+' was captured.'),sessionId,artifact.id);
        }
      }
      session.capturedAt=timestamp; session.updatedAt=timestamp;
      return captured;
    });
  }

  async updateArtifact(artifactId:string,updates:Partial<Pick<MemoryArtifact,'title'|'body'|'status'|'type'|'tags'>>) {
    return this.mutate(state=>{
      const artifact=state.artifacts.find(item=>item.id===artifactId);
      if (!artifact) throw new Error('Memory artifact not found');
      const timestamp=now();
      if(updates.status==='active'&&artifact.supersededByArtifactId){
        const successor=state.artifacts.find(item=>item.id===artifact.supersededByArtifactId);
        if(successor)successor.supersedesArtifactIds=successor.supersedesArtifactIds.filter(id=>id!==artifact.id);
        artifact.supersededByArtifactId=null;
      }
      if(updates.title!==undefined){const title=String(updates.title||'').trim();if(!title)throw new Error('Memory title is required');artifact.title=title}
      if(updates.body!==undefined)artifact.body=String(updates.body||'').trim();
      if(updates.type!==undefined){if(!ARTIFACT_TYPES.has(updates.type))throw new Error('Choose a valid memory type.');artifact.type=updates.type}
      if(updates.status!==undefined){if(!ARTIFACT_STATUSES.has(updates.status))throw new Error('Choose a valid memory status.');artifact.status=updates.status}
      if(updates.tags!==undefined)artifact.tags=Array.from(new Set((Array.isArray(updates.tags)?updates.tags:[]).map(tag=>String(tag).trim()).filter(Boolean))).slice(0,50);
      artifact.updatedAt=timestamp;
      this.addEvent(state,artifact.projectId,'memory-edited',artifact.title,'Project memory was edited.',artifact.sessionId||undefined,artifact.id);
      return artifact;
    });
  }

  async reviewArtifact(artifactId:string,action:'accept'|'reject'|'pending',supersedeIds:string[] = []) {
    return this.mutate(state=>{
      const artifact=state.artifacts.find(item=>item.id===artifactId);
      if(!artifact)throw new Error('Memory artifact not found');
      const timestamp=now();
      releaseArtifactSupersession(artifact,state.artifacts,timestamp);
      artifact.reviewStatus=action==='accept'?'accepted':action==='reject'?'rejected':'pending';
      if(action==='reject')artifact.status='archived';
      else artifact.status='active';
      if(action==='accept'&&supersedeIds.length)applyArtifactSupersession(artifact,state.artifacts,supersedeIds,timestamp);
      artifact.updatedAt=timestamp;
      const changed=artifact.supersedesArtifactIds.length;
      const eventType=action==='accept'&&changed?'memory-superseded':action==='accept'?'memory-accepted':action==='reject'?'memory-rejected':'memory-review-restored';
      const detail=action==='accept'&&changed?('This direction superseded '+changed+' earlier '+(changed===1?'memory.':'memories.')):action==='accept'?'A captured memory was accepted alongside existing project context.':action==='reject'?'A captured memory was dismissed.':'The memory returned to review and any earlier direction was restored.';
      this.addEvent(state,artifact.projectId,eventType,artifact.title,detail,artifact.sessionId||undefined,artifact.id);
      return artifact;
    });
  }

  async deleteArtifact(artifactId:string) {
    return this.mutate(state=>{
      const index=state.artifacts.findIndex(item=>item.id===artifactId);
      if(index<0) throw new Error('Memory artifact not found');
      const artifact=state.artifacts.splice(index,1)[0];
      const removed:MemoryArtifact={...artifact,relatedArtifactIds:[...artifact.relatedArtifactIds],supersedesArtifactIds:[...artifact.supersedesArtifactIds],tags:[...artifact.tags],sourceMessageIds:[...artifact.sourceMessageIds]};
      const timestamp=now();
      releaseArtifactSupersession(artifact,state.artifacts,timestamp);
      this.addEvent(state,artifact.projectId,'memory-removed',artifact.title,'A memory artifact was removed; any direction it superseded became active again.',artifact.sessionId||undefined);
      return removed;
    });
  }

  async restoreArtifact(input:MemoryArtifact) {
    return this.mutate(state=>{
      if(state.artifacts.some(item=>item.id===input.id))throw new Error('Memory is already restored');
      if(!state.projects.some(item=>item.id===input.projectId))throw new Error('The original project no longer exists');
      const timestamp=now();
            const restored={...sanitizeRestoredArtifact(input),updatedAt:timestamp};
      state.artifacts.push(restored);
      for(const earlierId of restored.supersedesArtifactIds){const earlier=state.artifacts.find(item=>item.id===earlierId);if(earlier){earlier.status='resolved';earlier.supersededByArtifactId=restored.id;earlier.updatedAt=timestamp}}
      this.addEvent(state,restored.projectId,'memory-restored',restored.title,'A removed memory was restored.',restored.sessionId||undefined,restored.id);
      return restored;
    });
  }

  async addSource(projectId:string,input:{type?:SourceType;title:string;url?:string;note?:string}) {
    return this.mutate(state=>{
      if (!state.projects.some(item=>item.id===projectId)) throw new Error('Project not found');
      const title=String(input.title||'').trim();
      if(!title)throw new Error('Source title is required');
      const type=input.type||'link';if(!SOURCE_TYPES.has(type))throw new Error('Choose a valid source type.');
      const source:StudioSource={id:makeId('source'),projectId,type,title,url:requireSourceUrl(input.url),note:String(input.note||'').trim(),createdAt:now()};
      state.sources.push(source); this.addEvent(state,projectId,'reference',source.title,source.note||source.url||'A reference was added.');
      return source;
    });
  }

  async importText(projectId:string,input:{title:string;text:string}) {
    const session=await this.createSession(projectId,input.title||'Imported conversation');
    const chunks=input.text.split(/\n{2,}/).map(part=>part.trim()).filter(Boolean);
    for (const [index,chunk] of chunks.entries()) {
      const match=chunk.match(/^(you|user|me|assistant|chatgpt|claude|gemini|ai)\s*:\s*/i);
      const role:StudioMessage['role']=match&&/assistant|chatgpt|claude|gemini|ai/i.test(match[1])?'assistant':index%2===0?'user':'assistant';
      await this.addMessage(session.id,role,chunk.replace(/^(you|user|me|assistant|chatgpt|claude|gemini|ai)\s*:\s*/i,''));
    }
    return this.getSession(session.id);
  }

  async search(query:string,projectId?:string):Promise<SearchResult[]> {
    if(!query.trim()) return [];
    const state=await this.read(); const normalizedQuery=query.trim().toLowerCase();const terms=normalizedQuery.split(/\s+/).filter(term=>term.length>1);
    const score=(text:string,title='')=>{const normalized=text.toLowerCase();const titleText=title.toLowerCase();return terms.reduce((sum,term)=>sum+(normalized.includes(term)?2:0)+(titleText.includes(term)?2:0),0)+(normalized.includes(normalizedQuery)?4:0)+(titleText.includes(normalizedQuery)?5:0)};
    const projectFor=(id:string)=>state.projects.find(item=>item.id===id);
    const results:SearchResult[]=[];
    for(const project of state.projects){if(projectId&&project.id!==projectId)continue;const s=score(project.name+' '+project.description,project.name);if(s)results.push({id:project.id,kind:'project',projectId:project.id,projectName:project.name,title:project.name,snippet:project.description,meta:'project',score:s})}
    for(const a of state.artifacts){if(a.reviewStatus==='rejected'||(projectId&&a.projectId!==projectId))continue;const project=projectFor(a.projectId);if(!project)continue;const s=score(a.title+' '+a.body+' '+a.tags.join(' '),a.title);if(s)results.push({id:a.id,kind:'artifact',projectId:a.projectId,projectName:project.name,sessionId:a.sessionId||undefined,artifactId:a.id,artifactType:a.type,title:a.title,snippet:a.body,meta:a.type+' · '+new Date(a.updatedAt).toLocaleDateString(),score:s})}
    for(const session of state.sessions){if(projectId&&session.projectId!==projectId)continue;const project=projectFor(session.projectId);if(!project)continue;const text=session.messages.map(m=>m.content).join(' ');const s=score(session.title+' '+text,session.title);if(s)results.push({id:session.id,kind:'conversation',projectId:session.projectId,projectName:project.name,sessionId:session.id,title:session.title,snippet:text.slice(0,220),meta:'conversation · '+new Date(session.updatedAt).toLocaleDateString(),score:s})}
    for(const source of state.sources){if(projectId&&source.projectId!==projectId)continue;const project=projectFor(source.projectId);if(!project||!source.url)continue;const s=score(source.title+' '+source.note+' '+source.url,source.title);if(s)results.push({id:source.id,kind:'source',projectId:source.projectId,projectName:project.name,url:source.url,title:source.title,snippet:source.note||source.url,meta:source.type,score:s})}
    for(const event of state.events){if(projectId&&event.projectId!==projectId)continue;if(!event.sessionId&&!event.artifactId)continue;const project=projectFor(event.projectId);if(!project)continue;const s=score(event.title+' '+event.detail,event.title);if(s)results.push({id:event.id,kind:'history',projectId:event.projectId,projectName:project.name,sessionId:event.sessionId||undefined,artifactId:event.artifactId||undefined,title:event.title,snippet:event.detail,meta:'history · '+new Date(event.createdAt).toLocaleDateString(),score:s})}
    return results.sort((a,b)=>b.score-a.score||b.meta.localeCompare(a.meta)).slice(0,60);
  }

  async resetState(){return this.mutate(state=>{const fresh=createFreshState();Object.assign(state,fresh);return fresh})}

  async exportState(){return this.read()}
}
export const creativeMemoryStore=new CreativeMemoryStore();
