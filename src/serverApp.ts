import express from 'express';
import { createCreativeRouter } from '../src/lib/creativeRoutes.js';
import { creativeStorageMode } from '../src/lib/creativeMemory.js';

const app = express();
const eventClients = new Set<express.Response>();

app.disable('x-powered-by');
app.use((_req,res,next)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  next();
});
app.use(express.json({ limit: '2mb' }));

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
app.use('/api',(_req,res)=>res.status(404).json({error:'API route not found'}));

export default app;
