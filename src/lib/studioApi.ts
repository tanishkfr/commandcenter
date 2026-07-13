import type { ArtifactStatus, ArtifactType, MemoryArtifact, SearchResult, SourceType, StudioProject, StudioSession, StudioSource, TimelineEvent } from './creativeMemory';

export type ConnectionStatus={
  aiConfigured:boolean;aiModel:string;aiProvider:'NVIDIA NIM';mcpConfigured:boolean;mcpUrl:string;mcpTokenPreview:string;dataFile:string;
};
export type Bootstrap={
  project:StudioProject;projects:StudioProject[];sessions:StudioSession[];activeSession:StudioSession|null;
  artifacts:MemoryArtifact[];sources:StudioSource[];events:TimelineEvent[];aiConfigured:boolean;
};

async function request<T>(url:string,init?:RequestInit):Promise<T>{
  const response=await fetch(url,{...init,headers:{'Content-Type':'application/json',...(init?.headers||{})}});
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(body.error||body.message||'Request failed');
  return body as T;
}

export const studioApi={
  bootstrap:(projectId?:string)=>request<Bootstrap>('/api/studio/bootstrap'+(projectId?'?projectId='+encodeURIComponent(projectId):'')),
  setActiveProject:(projectId:string)=>request<{success:boolean}>('/api/studio/projects/'+projectId+'/active',{method:'POST'}),
  createProject:(input:{name:string;description?:string;color?:string})=>request<{project:StudioProject;session:StudioSession}>('/api/studio/projects',{method:'POST',body:JSON.stringify(input)}),
  updateProject:(projectId:string,input:{name?:string;description?:string;color?:string})=>request<StudioProject>('/api/studio/projects/'+projectId,{method:'PATCH',body:JSON.stringify(input)}),
  createSession:(projectId:string,title?:string)=>request<StudioSession>('/api/studio/sessions',{method:'POST',body:JSON.stringify({projectId,title})}),
  getSession:(sessionId:string)=>request<StudioSession>('/api/studio/sessions/'+sessionId),
  sendMessage:(sessionId:string,content:string)=>request<{user:StudioSession['messages'][number];assistant:StudioSession['messages'][number];mode:'ai'|'local'}>('/api/studio/sessions/'+sessionId+'/messages',{method:'POST',body:JSON.stringify({content})}),
  capture:(sessionId:string)=>request<{artifacts:MemoryArtifact[];mode:'ai'|'local'}>('/api/studio/sessions/'+sessionId+'/capture',{method:'POST'}),
  updateArtifact:(artifactId:string,input:Partial<{title:string;body:string;status:ArtifactStatus;type:ArtifactType;tags:string[]}>)=>request<MemoryArtifact>('/api/studio/artifacts/'+artifactId,{method:'PATCH',body:JSON.stringify(input)}),
  reviewArtifact:(artifactId:string,action:'accept'|'reject')=>request<MemoryArtifact>('/api/studio/artifacts/'+artifactId+'/review',{method:'POST',body:JSON.stringify({action})}),
  deleteArtifact:(artifactId:string)=>request<{success:boolean}>('/api/studio/artifacts/'+artifactId,{method:'DELETE'}),
  addSource:(input:{projectId:string;type?:SourceType;title:string;url?:string;note?:string})=>request<StudioSource>('/api/studio/sources',{method:'POST',body:JSON.stringify(input)}),
  importText:(input:{projectId:string;title:string;text:string})=>request<StudioSession>('/api/studio/import',{method:'POST',body:JSON.stringify(input)}),
  search:(query:string,projectId?:string)=>request<{results:SearchResult[]}>('/api/studio/search?q='+encodeURIComponent(query)+(projectId?'&projectId='+encodeURIComponent(projectId):'')),
  connectionStatus:()=>request<ConnectionStatus>('/api/studio/settings/connections'),
  configureAI:(apiKey:string,model:string)=>request<ConnectionStatus>('/api/studio/settings/ai',{method:'POST',body:JSON.stringify({apiKey,model})}),
  disconnectAI:()=>request<ConnectionStatus>('/api/studio/settings/ai',{method:'DELETE'}),
  generateMcp:()=>request<{token:string;url:string;config:Record<string,unknown>}>('/api/studio/settings/mcp',{method:'POST'}),
  resetStudio:(clearConnections=true)=>request<{bootstrap:Bootstrap;connections:ConnectionStatus}>('/api/studio/settings/reset',{method:'POST',body:JSON.stringify({clearConnections})}),
};
