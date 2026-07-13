import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';

export type ArtifactType = 'decision' | 'principle' | 'question' | 'idea' | 'experiment' | 'reference' | 'risk' | 'action' | 'abandoned';
export type ArtifactStatus = 'active' | 'resolved' | 'archived';
export type SourceType = 'link' | 'figma' | 'github' | 'note' | 'document';

export interface StudioProject { id:string; name:string; description:string; color:string; createdAt:string; updatedAt:string }
export interface StudioMessage { id:string; role:'user'|'assistant'; content:string; createdAt:string; citedArtifactIds:string[] }
export interface StudioSession { id:string; projectId:string; title:string; createdAt:string; updatedAt:string; capturedAt:string|null; messages:StudioMessage[] }
export interface MemoryArtifact { id:string; projectId:string; sessionId:string|null; type:ArtifactType; title:string; body:string; status:ArtifactStatus; tags:string[]; confidence:number; sourceMessageIds:string[]; createdAt:string; updatedAt:string }
export interface StudioSource { id:string; projectId:string; type:SourceType; title:string; url:string; note:string; createdAt:string }
export interface TimelineEvent { id:string; projectId:string; type:string; title:string; detail:string; sessionId:string|null; artifactId:string|null; createdAt:string }
export interface CreativeMemoryState { version:number; activeProjectId:string; projects:StudioProject[]; sessions:StudioSession[]; artifacts:MemoryArtifact[]; sources:StudioSource[]; events:TimelineEvent[] }
export interface ExtractedArtifact { type:ArtifactType; title:string; body?:string; confidence?:number; sourceMessageIds?:string[]; tags?:string[] }
export interface SearchResult { id:string; kind:'artifact'|'conversation'|'source'; projectId:string; sessionId?:string; title:string; snippet:string; meta:string; score:number }

const DATA_DIR = path.join(process.cwd(), '.memory');
const DATA_FILE = path.join(DATA_DIR, 'studio.json');
const now = () => new Date().toISOString();
const daysAgo = (days:number) => new Date(Date.now() - days * 86400000).toISOString();
const makeId = (prefix:string) => prefix + '_' + randomUUID().replace(/-/g, '').slice(0, 12);

function seedState():CreativeMemoryState {
  return {
    version:1,
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

class CreativeMemoryStore {
  private queue:Promise<unknown> = Promise.resolve();

  private async ensure() {
    await fs.mkdir(DATA_DIR, { recursive:true });
    try { await fs.access(DATA_FILE); }
    catch { await this.write(seedState()); }
  }

  private async read():Promise<CreativeMemoryState> {
    await this.ensure();
    return JSON.parse(await fs.readFile(DATA_FILE, 'utf8')) as CreativeMemoryState;
  }

  private async write(state:CreativeMemoryState) {
    await fs.mkdir(DATA_DIR, { recursive:true });
    const temp = DATA_FILE + '.tmp';
    await fs.writeFile(temp, JSON.stringify(state, null, 2), 'utf8');
    await fs.rename(temp, DATA_FILE);
  }

  private mutate<T>(fn:(state:CreativeMemoryState)=>T|Promise<T>):Promise<T> {
    const operation = this.queue.then(async()=>{
      const state = await this.read();
      const result = await fn(state);
      await this.write(state);
      return result;
    });
    this.queue = operation.catch(()=>undefined);
    return operation;
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
      aiConfigured:Boolean(process.env.NVIDIA_API_KEY && !process.env.NVIDIA_API_KEY.includes('MY_NVIDIA') && !process.env.NVIDIA_API_KEY.includes('YOUR_NVIDIA'))
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
    return { project, session, artifacts:state.artifacts.filter(item=>item.projectId===projectId&&item.status==='active').slice(-20), sources:state.sources.filter(item=>item.projectId===projectId).slice(-10) };
  }

  async captureSession(sessionId:string,extracted:ExtractedArtifact[]) {
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
          const artifact:MemoryArtifact={ id:makeId('memory'), projectId:session.projectId, sessionId, type:item.type, title:item.title.trim(), body:item.body?.trim()||'', status:'active', tags:item.tags||[], confidence:item.confidence??.75, sourceMessageIds:item.sourceMessageIds||[], createdAt:timestamp, updatedAt:timestamp };
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

  async deleteArtifact(artifactId:string) {
    return this.mutate(state=>{
      const index=state.artifacts.findIndex(item=>item.id===artifactId);
      if(index<0) throw new Error('Memory artifact not found');
      const artifact=state.artifacts.splice(index,1)[0];
      this.addEvent(state,artifact.projectId,'memory-removed',artifact.title,'A memory artifact was removed.',artifact.sessionId||undefined);
      return artifact;
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
    const state=await this.read(); const terms=query.toLowerCase().split(/\s+/).filter(term=>term.length>1);
    const score=(text:string)=>terms.reduce((sum,term)=>sum+(text.toLowerCase().includes(term)?2:0),0)+(text.toLowerCase().includes(query.toLowerCase())?4:0);
    const results:SearchResult[]=[];
    for(const a of state.artifacts){if(projectId&&a.projectId!==projectId)continue;const s=score(a.title+' '+a.body+' '+a.tags.join(' '));if(s)results.push({id:a.id,kind:'artifact',projectId:a.projectId,sessionId:a.sessionId||undefined,title:a.title,snippet:a.body,meta:a.type+' · '+new Date(a.updatedAt).toLocaleDateString(),score:s})}
    for(const session of state.sessions){if(projectId&&session.projectId!==projectId)continue;const text=session.messages.map(m=>m.content).join(' ');const s=score(session.title+' '+text);if(s)results.push({id:session.id,kind:'conversation',projectId:session.projectId,sessionId:session.id,title:session.title,snippet:text.slice(0,220),meta:'conversation · '+new Date(session.updatedAt).toLocaleDateString(),score:s})}
    for(const source of state.sources){if(projectId&&source.projectId!==projectId)continue;const s=score(source.title+' '+source.note+' '+source.url);if(s)results.push({id:source.id,kind:'source',projectId:source.projectId,title:source.title,snippet:source.note||source.url,meta:source.type,score:s})}
    return results.sort((a,b)=>b.score-a.score).slice(0,30);
  }

  async exportState(){return this.read()}
}
export const creativeMemoryStore=new CreativeMemoryStore();
