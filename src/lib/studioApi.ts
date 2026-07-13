import type { ArtifactStatus, ArtifactType, DeletedProjectSnapshot, MemoryArtifact, SearchResult, SourceType, StudioProject, StudioSession, StudioSource, TimelineEvent } from './creativeMemory';

export type ConnectionStatus={
  aiConfigured:boolean;aiModel:string;aiProvider:'NVIDIA NIM';mcpConfigured:boolean;mcpUrl:string;mcpTokenPreview:string;dataFile:string;runtime:'local'|'vercel';configWritable:boolean;storageMode:'local-file'|'vercel-blob';
};
export type Diagnostics={runtime:'local'|'vercel';storage:{ok:boolean;detail:string};ai:{ok:boolean;mode:'nim'|'local';detail:string};mcp:{ok:boolean;detail:string;url:string};configWritable:boolean};
export type Bootstrap={
  project:StudioProject;projects:StudioProject[];sessions:StudioSession[];activeSession:StudioSession|null;
  artifacts:MemoryArtifact[];sources:StudioSource[];events:TimelineEvent[];aiConfigured:boolean;storageMode:'local-file'|'vercel-blob';
};

async function request<T>(url:string,init?:RequestInit):Promise<T>{
  const response=await fetch(url,{...init,headers:{'Content-Type':'application/json',...(init?.headers||{})}});
  const contentType=response.headers.get('content-type')||'';
  if(!contentType.includes('application/json'))throw new Error(response.ok?'The hosted API returned a web page instead of data. Check the Vercel API rewrite and redeploy.':'The studio API is unavailable ('+response.status+'). Check the deployment configuration.');
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(body.error||body.message||'Request failed');
  return body as T;
}

export const studioApi={
  bootstrap:(projectId?:string)=>request<Bootstrap>('/api/studio/bootstrap'+(projectId?'?projectId='+encodeURIComponent(projectId):'')),
  setActiveProject:(projectId:string)=>request<{success:boolean}>('/api/studio/projects/'+projectId+'/active',{method:'POST'}),
  createProject:(input:{name:string;description?:string;color?:string})=>request<{project:StudioProject;session:StudioSession}>('/api/studio/projects',{method:'POST',body:JSON.stringify(input)}),
  updateProject:(projectId:string,input:{name?:string;description?:string;color?:string})=>request<StudioProject>('/api/studio/projects/'+projectId,{method:'PATCH',body:JSON.stringify(input)}),
  deleteProject:(projectId:string)=>request<{snapshot:DeletedProjectSnapshot;activeProjectId:string}>('/api/studio/projects/'+projectId,{method:'DELETE'}),
  restoreProject:(snapshot:DeletedProjectSnapshot)=>request<{project:StudioProject;activeSession:StudioSession|null}>('/api/studio/projects/restore',{method:'POST',body:JSON.stringify({snapshot})}),
  createSession:(projectId:string,title?:string)=>request<StudioSession>('/api/studio/sessions',{method:'POST',body:JSON.stringify({projectId,title})}),
  getSession:(sessionId:string)=>request<StudioSession>('/api/studio/sessions/'+sessionId),
  sendMessage:(sessionId:string,content:string)=>request<{user:StudioSession['messages'][number];assistant:StudioSession['messages'][number];mode:'ai'|'local'}>('/api/studio/sessions/'+sessionId+'/messages',{method:'POST',body:JSON.stringify({content})}),
  capture:(sessionId:string)=>request<{artifacts:MemoryArtifact[];mode:'ai'|'local'}>('/api/studio/sessions/'+sessionId+'/capture',{method:'POST'}),
  updateArtifact:(artifactId:string,input:Partial<{title:string;body:string;status:ArtifactStatus;type:ArtifactType;tags:string[]}>)=>request<MemoryArtifact>('/api/studio/artifacts/'+artifactId,{method:'PATCH',body:JSON.stringify(input)}),
  reviewArtifact:(artifactId:string,action:'accept'|'reject'|'pending',supersedeIds:string[]=[])=>request<MemoryArtifact>('/api/studio/artifacts/'+artifactId+'/review',{method:'POST',body:JSON.stringify({action,supersedeIds})}),
  deleteArtifact:(artifactId:string)=>request<{success:boolean;artifact:MemoryArtifact}>('/api/studio/artifacts/'+artifactId,{method:'DELETE'}),
  restoreArtifact:(artifact:MemoryArtifact)=>request<MemoryArtifact>('/api/studio/artifacts/restore',{method:'POST',body:JSON.stringify({artifact})}),
  addSource:(input:{projectId:string;type?:SourceType;title:string;url?:string;note?:string})=>request<StudioSource>('/api/studio/sources',{method:'POST',body:JSON.stringify(input)}),
  importText:(input:{projectId:string;title:string;text:string})=>request<StudioSession>('/api/studio/import',{method:'POST',body:JSON.stringify(input)}),
  search:(query:string,projectId?:string,signal?:AbortSignal)=>request<{results:SearchResult[]}>('/api/studio/search?q='+encodeURIComponent(query)+(projectId?'&projectId='+encodeURIComponent(projectId):''),{signal}),
  connectionStatus:()=>request<ConnectionStatus>('/api/studio/settings/connections'),
  configureAI:(apiKey:string,model:string)=>request<ConnectionStatus>('/api/studio/settings/ai',{method:'POST',body:JSON.stringify({apiKey,model})}),
  disconnectAI:()=>request<ConnectionStatus>('/api/studio/settings/ai',{method:'DELETE'}),
  generateMcp:()=>request<{token:string;url:string;config:Record<string,unknown>}>('/api/studio/settings/mcp',{method:'POST'}),
  diagnostics:(testAI=false)=>request<Diagnostics>('/api/studio/settings/diagnostics',{method:'POST',body:JSON.stringify({testAI})}),
  resetStudio:(clearConnections=true)=>request<{bootstrap:Bootstrap;connections:ConnectionStatus;warning?:string}>('/api/studio/settings/reset',{method:'POST',body:JSON.stringify({clearConnections})}),
};
