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
export interface MemoryArtifact { id:string; projectId:string; sessionId:string|null; type:ArtifactType; title:string; body:string; status:ArtifactStatus; reviewStatus:ArtifactReviewStatus; origin:ArtifactOrigin; relatedArtifactIds:string[]; tags:string[]; confidence:number; sourceMessageIds:string[]; createdAt:string; updatedAt:string }
export interface StudioSource { id:string; projectId:string; type:SourceType; title:string; url:string; note:string; createdAt:string }
export interface TimelineEvent { id:string; projectId:string; type:string; title:string; detail:string; sessionId:string|null; artifactId:string|null; createdAt:string }
export interface CreativeMemoryState { version:number; activeProjectId:string; projects:StudioProject[]; sessions:StudioSession[]; artifacts:MemoryArtifact[]; sources:StudioSource[]; events:TimelineEvent[] }
export interface ExtractedArtifact { type:ArtifactType; title:string; body?:string; confidence?:number; sourceMessageIds?:string[]; tags?:string[] }
export type SearchResultKind='project'|'artifact'|'conversation'|'source'|'history';
export interface SearchResult { id:string; kind:SearchResultKind; projectId:string; projectName:string; sessionId?:string; artifactId?:string; artifactType?:ArtifactType; url?:string; title:string; snippet:string; meta:string; score:number }

const DATA_DIR = path.join(process.cwd(), '.memory');
const DATA_FILE = path.join(DATA_DIR, 'studio.json');
const BLOB_PATH = 'creative-memory/studio.json';
export type CreativeStorageMode='local-file'|'vercel-blob';
export const creativeStorageMode=():CreativeStorageMode=>process.env.VERCEL?'vercel-blob':'local-file';
type StateSnapshot={state:CreativeMemoryState;etag?:string};
const isPreconditionError=(error:unknown)=>error instanceof Error&&(error.name==='BlobPreconditionFailedError'||/precondition/i.test(error.message));
const cloudStorageError=()=>new Error('Cloud storage is not connected. Add a private Vercel Blob store to this project, then redeploy.');
const now = () => new Date().toISOString();
const daysAgo = (days:number) => new Date(Date.now() - days * 86400000).toISOString();
const makeId = (prefix:string) => prefix + '_' + randomUUID().replace(/-/g, '').slice(0, 12);

export function normalizeCreativeMemoryState(state:CreativeMemoryState):CreativeMemoryState {
  state.version=2;
  state.artifacts=(state.artifacts||[]).map(artifact=>({
    ...artifact,
    reviewStatus:artifact.reviewStatus||'accepted',
    origin:artifact.origin||'manual',
    relatedArtifactIds:artifact.relatedArtifactIds||[]
  }));
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

function seedState():CreativeMemoryState {
  return {
    version:2,
    activeProjectId:'atlas',
    projects:[
      { id:'atlas', name:'Atlas', description:'Exploring spatial wayfinding without demanding attention.', color:'#df7257', createdAt:daysAgo(36), updatedAt:daysAgo(1) },
      { id:'pentimento', name:'Pentimento', description:'A living record of how creative work changes.', color:'#796bb4', createdAt:daysAgo(24), updatedAt:daysAgo(4) },
      { id:'invisible-interfaces', name:'Invisible Interfaces', description:'Designing systems that know when to disappear.', color:'#5e9b86', createdAt:daysAgo(18), updatedAt:daysAgo(6) }
    ],
    sessions:[{
      id:'session_welcome', projectId:'atlas', title:'Wayfinding without maps', createdAt:daysAgo(1), updatedAt:daysAgo(1), capturedAt:null,
      messages:[
        { id:'msg_welcome_user', role:'user', createdAt:daysAgo(1), citedArtifactIds:[], content:'The minimap solves orientation, but it makes the experience feel like software. What if the environment itself could carry the sense of direction?' },
        { id:'msg_welcome_studio', role:'assistant', createdAt:daysAgo(1), citedArtifactIds:[], content:'Then orientation becomes something people feel before they need to read it. Light, density, and sound could gently build confidence, while the map remains a fallback rather than the primary interface.' }
      ]
    }],
    artifacts:[],
    sources:[],
    events:[{ id:'event_welcome', projectId:'atlas', type:'conversation', title:'Wayfinding without maps', detail:'The project began exploring ambient orientation.', sessionId:'session_welcome', artifactId:null, createdAt:daysAgo(1) }]
  };
}

export function createFreshState():CreativeMemoryState {
  const timestamp=now();
  const project:StudioProject={ id:'my-first-project', name:'My first project', description:'A fresh space for your next idea.', color:'#796bb4', createdAt:timestamp, updatedAt:timestamp };
  const session:StudioSession={ id:'session_first', projectId:project.id, title:'First conversation', createdAt:timestamp, updatedAt:timestamp, capturedAt:null, messages:[] };
  return { version:2, activeProjectId:project.id, projects:[project], sessions:[session], artifacts:[], sources:[], events:[] };
}

class CreativeMemoryStore {
  private queue:Promise<unknown> = Promise.resolve();

  private async readCloud():Promise<StateSnapshot> {
    try {
      let result:any=await get(BLOB_PATH,{access:'private',useCache:false});
      if(!result||result.statusCode===404){
        const initial=seedState();
        try{const created:any=await put(BLOB_PATH,JSON.stringify(initial),{access:'private',contentType:'application/json',allowOverwrite:false});return{state:initial,etag:created.etag}}
        catch(error){if(!isPreconditionError(error))throw error;result=await get(BLOB_PATH,{access:'private',useCache:false})}
      }
      if(!result||result.statusCode!==200||!result.stream||!result.blob)throw cloudStorageError();
      const text=await new Response(result.stream).text();
      return{state:normalizeCreativeMemoryState(JSON.parse(text) as CreativeMemoryState),etag:result.blob.etag};
    }catch(error){if(isPreconditionError(error))throw error;console.error('Vercel Blob storage error',error);throw cloudStorageError()}
  }

  private async readSnapshot():Promise<StateSnapshot> {
    if(creativeStorageMode()==='vercel-blob')return this.readCloud();
    await fs.mkdir(DATA_DIR,{recursive:true});
    try{await fs.access(DATA_FILE)}catch{await this.writeLocal(seedState())}
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
      for(let attempt=0;attempt<3;attempt++){
        const snapshot=await this.readSnapshot();const result=await fn(snapshot.state);
        try{await this.write(snapshot.state,snapshot.etag);return result}catch(error){if(!isPreconditionError(error)||attempt===2)throw error}
      }
      throw new Error('The studio changed in another request. Please try again.');
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
    return this.mutate(state=>{
      if (!state.projects.some(item=>item.id===projectId)) throw new Error('Project not found');
      state.activeProjectId=projectId;
      return projectId;
    });
  }

  async createProject(input:{name:string;description?:string;color?:string}) {
    return this.mutate(state=>{
      if (!input.name.trim()) throw new Error('Project name is required');
      const timestamp=now();
      const project:StudioProject={ id:makeId('project'), name:input.name.trim(), description:input.description?.trim()||'', color:input.color||'#796bb4', createdAt:timestamp, updatedAt:timestamp };
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
      Object.assign(project, updates, {updatedAt:now()});
      return project;
    });
  }

  async createSession(projectId:string,title='New conversation') {
    return this.mutate(state=>{
      if (!state.projects.some(item=>item.id===projectId)) throw new Error('Project not found');
      const timestamp=now();
      const session:StudioSession={ id:makeId('session'), projectId, title:title.trim()||'New conversation', createdAt:timestamp, updatedAt:timestamp, capturedAt:null, messages:[] };
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
          const artifact:MemoryArtifact={ id:makeId('memory'), projectId:session.projectId, sessionId, type:item.type, title:item.title.trim(), body:item.body?.trim()||'', status:'active', reviewStatus:'pending', origin, relatedArtifactIds:[], tags:item.tags||[], confidence:item.confidence??.75, sourceMessageIds:item.sourceMessageIds||[], createdAt:timestamp, updatedAt:timestamp };
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
      Object.assign(artifact,updates,{updatedAt:now()});
      this.addEvent(state,artifact.projectId,'memory-edited',artifact.title,'Project memory was edited.',artifact.sessionId||undefined,artifact.id);
      return artifact;
    });
  }

  async reviewArtifact(artifactId:string,action:'accept'|'reject'|'pending') {
    return this.mutate(state=>{
      const artifact=state.artifacts.find(item=>item.id===artifactId);
      if(!artifact)throw new Error('Memory artifact not found');
      artifact.reviewStatus=action==='accept'?'accepted':action==='reject'?'rejected':'pending';
      if(action==='reject')artifact.status='archived';
      else if(artifact.status==='archived')artifact.status='active';
      artifact.updatedAt=now();
      this.addEvent(state,artifact.projectId,action==='accept'?'memory-accepted':action==='reject'?'memory-rejected':'memory-review-restored',artifact.title,action==='accept'?'A captured memory was accepted into project context.':action==='reject'?'A captured memory was dismissed.':'The memory returned to review.',artifact.sessionId||undefined,artifact.id);
      return artifact;
    });
  }

  async deleteArtifact(artifactId:string) {
    return this.mutate(state=>{
      const index=state.artifacts.findIndex(item=>item.id===artifactId);
      if(index<0) throw new Error('Memory artifact not found');
      const artifact=state.artifacts.splice(index,1)[0];
      this.addEvent(state,artifact.projectId,'memory-removed',artifact.title,'A memory artifact was removed.',artifact.sessionId||undefined);
      return artifact;
    });
  }

  async restoreArtifact(input:MemoryArtifact) {
    return this.mutate(state=>{
      if(state.artifacts.some(item=>item.id===input.id))throw new Error('Memory is already restored');
      if(!state.projects.some(item=>item.id===input.projectId))throw new Error('The original project no longer exists');
      const restored={...input,updatedAt:now()};
      state.artifacts.push(restored);
      this.addEvent(state,restored.projectId,'memory-restored',restored.title,'A removed memory was restored.',restored.sessionId||undefined,restored.id);
      return restored;
    });
  }

  async addSource(projectId:string,input:{type?:SourceType;title:string;url?:string;note?:string}) {
    return this.mutate(state=>{
      if (!state.projects.some(item=>item.id===projectId)) throw new Error('Project not found');
      if (!input.title.trim()) throw new Error('Source title is required');
      const source:StudioSource={id:makeId('source'),projectId,type:input.type||'link',title:input.title.trim(),url:input.url?.trim()||'',note:input.note?.trim()||'',createdAt:now()};
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
