import crypto from 'crypto';
import express from 'express';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createCreativeRouter } from '../src/lib/creativeRoutes.js';
import { creativeStorageMode } from '../src/lib/creativeMemory.js';
import { createMcpServer, mcpServer } from '../src/lib/mcp.js';

const app = express();
const mcpTransports = new Map<string, SSEServerTransport>();
const eventClients = new Set<express.Response>();

app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));

function verifyAuth(req:express.Request,res:express.Response,next:express.NextFunction){
  const expected=process.env.API_KEY?.trim();
  const auth=req.headers.authorization;
  if(!expected)return res.status(503).json({success:false,reason:'MCP is not configured. Set API_KEY on the server.'});
  if(!auth?.startsWith('Bearer '))return res.status(401).json({success:false,reason:'Missing or invalid Authorization header'});
  const token=auth.slice(7);
  const tokenBuffer=Buffer.from(token);const expectedBuffer=Buffer.from(expected);
  if(tokenBuffer.length!==expectedBuffer.length||!crypto.timingSafeEqual(tokenBuffer,expectedBuffer))return res.status(403).json({success:false,reason:'Forbidden'});
  next();
}

function broadcastEvent(type:string,data:unknown){
  for(const client of eventClients)client.write('event: '+type+'\ndata: '+JSON.stringify(data)+'\n\n');
}

app.get('/api/health',(_req,res)=>{
  res.setHeader('Cache-Control','no-store');
  res.json({ok:true,runtime:process.env.VERCEL?'vercel':'local',storage:creativeStorageMode()});
});

app.get('/api/events',(req,res)=>{
  res.setHeader('Content-Type','text/event-stream');res.setHeader('Cache-Control','no-cache');res.setHeader('Connection','keep-alive');res.flushHeaders();
  eventClients.add(res);
  const heartbeat=setInterval(()=>res.write(':\n\n'),25000);
  req.on('close',()=>{clearInterval(heartbeat);eventClients.delete(res)});
});

app.use('/api/studio',createCreativeRouter((event,data)=>broadcastEvent('studio-changed',{event,data})));

app.post('/api/mcp',verifyAuth,async(req,res)=>{
  const server=createMcpServer();
  try{
    const transport=new StreamableHTTPServerTransport({sessionIdGenerator:undefined});
    await server.connect(transport);await transport.handleRequest(req,res,req.body);
    res.on('close',()=>{transport.close();server.close()});
  }catch(error){console.error('MCP request failed',error);if(!res.headersSent)res.status(500).json({jsonrpc:'2.0',error:{code:-32603,message:'Internal server error'},id:null})}
});
app.get('/api/mcp',verifyAuth,(_req,res)=>res.status(405).set('Allow','POST').json({jsonrpc:'2.0',error:{code:-32000,message:'Method not allowed'},id:null}));
app.delete('/api/mcp',verifyAuth,(_req,res)=>res.status(405).set('Allow','POST').json({jsonrpc:'2.0',error:{code:-32000,message:'Method not allowed'},id:null}));

app.get('/api/mcp/sse',verifyAuth,async(req,res)=>{
  const transport=new SSEServerTransport('/api/mcp/messages',res);
  await mcpServer.connect(transport);mcpTransports.set(transport.sessionId,transport);
  req.on('close',()=>mcpTransports.delete(transport.sessionId));
});

app.post('/api/mcp/messages',verifyAuth,async(req,res)=>{
  const sessionId=String(req.query.sessionId||'');const transport=mcpTransports.get(sessionId);
  if(!transport)return res.status(404).json({error:'MCP session not found. Reconnect the client and try again.'});
  await transport.handlePostMessage(req,res,req.body);
});

app.use('/api',(_req,res)=>res.status(404).json({error:'API route not found'}));

export default app;
