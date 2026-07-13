import { Router } from 'express';
import { creativeMemoryStore } from './creativeMemory.js';
import { extractSessionMemory, generateStudioReply } from './creativeAI.js';
import { configureAI, connectionStatus, disconnectAI, generateMcpCredential, resetConnections } from './connectionSettings.js';

export function createCreativeRouter(onChange:(event:string,data:unknown)=>void){
  const router=Router();
  const handle=(fn:(req:any,res:any)=>Promise<void>)=>async(req:any,res:any)=>{
    try{await fn(req,res)}catch(error:any){console.error(error);res.status(400).json({error:error?.message||'Request failed'})}
  };

  router.get('/bootstrap',handle(async(req,res)=>{
    res.json(await creativeMemoryStore.bootstrap(typeof req.query.projectId==='string'?req.query.projectId:undefined));
  }));


  router.get('/settings/connections',handle(async(_req,res)=>{
    res.json(await connectionStatus());
  }));

  router.post('/settings/ai',handle(async(req,res)=>{
    const status=await configureAI(String(req.body?.apiKey||''),String(req.body?.model||'meta/llama-3.3-70b-instruct'));
    onChange('connections-updated',{aiConfigured:true});res.json(status);
  }));

  router.delete('/settings/ai',handle(async(_req,res)=>{
    const status=await disconnectAI();
    onChange('connections-updated',{aiConfigured:false});res.json(status);
  }));

  router.post('/settings/mcp',handle(async(_req,res)=>{
    const result=await generateMcpCredential();
    onChange('connections-updated',{mcpConfigured:true});res.status(201).json(result);
  }));


  router.post('/settings/reset',handle(async(req,res)=>{
    await creativeMemoryStore.resetState();
    const clearConnections=req.body?.clearConnections!==false;
    const connections=clearConnections?await resetConnections():await connectionStatus();
    const bootstrap=await creativeMemoryStore.bootstrap();
    onChange('studio-reset',{clearConnections});
    res.json({bootstrap,connections});
  }));

  router.post('/projects',handle(async(req,res)=>{
    const result=await creativeMemoryStore.createProject(req.body||{});
    onChange('project-created',result);res.status(201).json(result);
  }));

  router.patch('/projects/:id',handle(async(req,res)=>{
    const project=await creativeMemoryStore.updateProject(req.params.id,req.body||{});
    onChange('project-updated',project);res.json(project);
  }));

  router.post('/projects/:id/active',handle(async(req,res)=>{
    await creativeMemoryStore.setActiveProject(req.params.id);res.json({success:true});
  }));

  router.post('/sessions',handle(async(req,res)=>{
    const session=await creativeMemoryStore.createSession(req.body.projectId,req.body.title);
    onChange('session-created',session);res.status(201).json(session);
  }));

  router.get('/sessions/:id',handle(async(req,res)=>{
    res.json(await creativeMemoryStore.getSession(req.params.id));
  }));

  router.post('/sessions/:id/messages',handle(async(req,res)=>{
    const content=String(req.body?.content||'').trim();
    if(!content)throw new Error('Message cannot be empty');
    const session=await creativeMemoryStore.getSession(req.params.id);
    const user=await creativeMemoryStore.addMessage(session.id,'user',content);
    const context=await creativeMemoryStore.context(session.projectId,session.id);
    const reply=await generateStudioReply(context,content);
    const assistant=await creativeMemoryStore.addMessage(session.id,'assistant',reply.text,reply.citedArtifactIds);
    onChange('messages-created',{sessionId:session.id,user,assistant});
    res.status(201).json({user,assistant,mode:reply.mode});
  }));

  router.post('/sessions/:id/capture',handle(async(req,res)=>{
    const session=await creativeMemoryStore.getSession(req.params.id);
    if(!session.messages.length)throw new Error('There is no conversation to capture');
    const context=await creativeMemoryStore.context(session.projectId,session.id);
    const extraction=await extractSessionMemory(context);
    const artifacts=await creativeMemoryStore.captureSession(session.id,extraction.artifacts,extraction.mode);
    onChange('session-captured',{sessionId:session.id,artifacts});
    res.status(201).json({artifacts,mode:extraction.mode});
  }));

  router.patch('/artifacts/:id',handle(async(req,res)=>{
    const artifact=await creativeMemoryStore.updateArtifact(req.params.id,req.body||{});
    onChange('artifact-updated',artifact);res.json(artifact);
  }));

  router.post('/artifacts/:id/review',handle(async(req,res)=>{
    const action=req.body?.action;
    if(action!=='accept'&&action!=='reject'&&action!=='pending')throw new Error('Review action must be accept, reject, or pending');
    const supersedeIds=Array.isArray(req.body?.supersedeIds)?req.body.supersedeIds.filter((value:unknown):value is string=>typeof value==='string').slice(0,20):[];
    const artifact=await creativeMemoryStore.reviewArtifact(req.params.id,action,supersedeIds);
    onChange('artifact-reviewed',artifact);res.json(artifact);
  }));

  router.delete('/artifacts/:id',handle(async(req,res)=>{
    const artifact=await creativeMemoryStore.deleteArtifact(req.params.id);
    onChange('artifact-deleted',artifact);res.json({success:true,artifact});
  }));

  router.post('/artifacts/restore',handle(async(req,res)=>{
    const artifact=req.body?.artifact;
    if(!artifact?.id||!artifact?.projectId||!artifact?.title)throw new Error('The removed memory could not be restored');
    const restored=await creativeMemoryStore.restoreArtifact(artifact);
    onChange('artifact-restored',restored);res.status(201).json(restored);
  }));

  router.post('/sources',handle(async(req,res)=>{
    const source=await creativeMemoryStore.addSource(req.body.projectId,req.body);
    onChange('source-created',source);res.status(201).json(source);
  }));

  router.post('/import',handle(async(req,res)=>{
    if(!String(req.body?.text||'').trim())throw new Error('Import text is required');
    const session=await creativeMemoryStore.importText(req.body.projectId,{title:req.body.title||'Imported conversation',text:req.body.text});
    onChange('session-imported',session);res.status(201).json(session);
  }));

  router.get('/search',handle(async(req,res)=>{
    const query=typeof req.query.q==='string'?req.query.q:'';
    const projectId=typeof req.query.projectId==='string'?req.query.projectId:undefined;
    res.json({results:await creativeMemoryStore.search(query,projectId)});
  }));

  router.get('/export',handle(async(_req,res)=>{
    res.setHeader('Content-Disposition','attachment; filename="creative-memory-export.json"');
    res.json(await creativeMemoryStore.exportState());
  }));

  return router;
}
