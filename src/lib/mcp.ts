import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { creativeMemoryStore } from './creativeMemory.js';
import { extractSessionMemory } from './creativeAI.js';

const textResult=(value:unknown)=>({content:[{type:'text' as const,text:JSON.stringify(value,null,2)}]});

export function createMcpServer(){
  const server=new McpServer({name:'Remainder',version:'2.1.0'});

  server.tool('listCreativeProjects','List personal creative-memory projects and their active conversation counts',{},async()=>{
    const data=await creativeMemoryStore.exportState();
    return textResult(data.projects.map(project=>({...project,sessionCount:data.sessions.filter(session=>session.projectId===project.id).length,memoryCount:data.artifacts.filter(artifact=>artifact.projectId===project.id).length})));
  });
  server.tool('getProjectMemory','Read a creative project with conversations, memory artifacts, sources, and history',{projectId:z.string().describe('Creative-memory project ID')},async({projectId})=>textResult(await creativeMemoryStore.bootstrap(projectId)));
  server.tool('searchProjectMemory','Search a project across decisions, rationale, conversations, and sources',{projectId:z.string(),query:z.string().min(1)},async({projectId,query})=>textResult(await creativeMemoryStore.search(query,projectId)));
  server.tool('createCreativeProject','Create a new personal creative-memory project',{name:z.string().min(1),description:z.string().optional(),color:z.string().optional()},async args=>textResult(await creativeMemoryStore.createProject(args)));
  server.tool('importCreativeConversation','Import a conversation into project memory from pasted text',{projectId:z.string(),title:z.string(),text:z.string().min(1)},async({projectId,title,text})=>textResult(await creativeMemoryStore.importText(projectId,{title,text})));
  server.tool('captureCreativeSession','Extract durable decisions, ideas, questions, experiments, risks, and actions from a conversation session',{sessionId:z.string()},async({sessionId})=>{
    const session=await creativeMemoryStore.getSession(sessionId);const context=await creativeMemoryStore.context(session.projectId,session.id);const extraction=await extractSessionMemory(context);const artifacts=await creativeMemoryStore.captureSession(session.id,extraction.artifacts,extraction.mode);return textResult({mode:extraction.mode,artifacts});
  });
  server.tool('addCreativeSource','Add a URL, Figma file, GitHub repository, note, or document reference to a project',{projectId:z.string(),title:z.string().min(1),url:z.string().optional(),note:z.string().optional(),type:z.enum(['link','figma','github','note','document']).optional()},async({projectId,...input})=>textResult(await creativeMemoryStore.addSource(projectId,input)));
  server.tool('updateMemoryArtifact','Edit, resolve, or archive a durable project-memory artifact',{artifactId:z.string(),title:z.string().optional(),body:z.string().optional(),status:z.enum(['active','resolved','archived']).optional(),type:z.enum(['decision','principle','question','idea','experiment','reference','risk','action','abandoned']).optional(),tags:z.array(z.string()).optional()},async({artifactId,...updates})=>textResult(await creativeMemoryStore.updateArtifact(artifactId,updates)));
  server.tool('reviewMemoryArtifact','Accept a captured memory alongside current context, explicitly supersede related earlier memory, or reject it from review',{artifactId:z.string(),action:z.enum(['accept','reject']),supersedeIds:z.array(z.string()).optional().describe('Related accepted memory IDs this direction should supersede')},async({artifactId,action,supersedeIds})=>textResult(await creativeMemoryStore.reviewArtifact(artifactId,action,supersedeIds||[])));

  server.resource('creative-memory-projects','creative-memory://projects',{description:'All personal creative-memory projects'},async uri=>{const data=await creativeMemoryStore.exportState();return{contents:[{uri:uri.href,text:JSON.stringify(data.projects,null,2),mimeType:'application/json'}]}});
  server.resource('creative-project-memory',new ResourceTemplate('creative-memory://projects/{id}',{list:undefined}),{description:'Project conversations, durable memory, sources, and history'},async(uri,{id})=>({contents:[{uri:uri.href,text:JSON.stringify(await creativeMemoryStore.bootstrap(String(id)),null,2),mimeType:'application/json'}]}));
  return server;
}

export const mcpServer=createMcpServer();
