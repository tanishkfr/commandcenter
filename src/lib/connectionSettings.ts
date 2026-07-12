import { randomBytes } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { testGeminiConnection } from './creativeAI.js';

export interface ConnectionStatus {
  aiConfigured:boolean;
  aiModel:string;
  mcpConfigured:boolean;
  mcpUrl:string;
  mcpTokenPreview:string;
  dataFile:string;
}

const ENV_FILE=path.join(process.cwd(),'.env');
const meaningful=(value:string|undefined,placeholder:string)=>Boolean(value&&value.trim()&&value!==placeholder&&!value.includes('MY_'));

async function readEnvText(){
  try{return await fs.readFile(ENV_FILE,'utf8')}catch{return ''}
}

function unquote(value:string){
  const clean=value.trim();
  if((clean.startsWith('"')&&clean.endsWith('"'))||(clean.startsWith("'")&&clean.endsWith("'")))return clean.slice(1,-1);
  return clean;
}

async function envValue(key:string){
  const text=await readEnvText();
  const line=text.split(/\r?\n/).find(item=>item.trim().startsWith(key+'='));
  return line?unquote(line.slice(line.indexOf('=')+1)):undefined;
}

async function writeValues(updates:Record<string,string|undefined>){
  const existing=await readEnvText();
  const keys=new Set(Object.keys(updates));
  const lines=existing.split(/\r?\n/).filter(line=>{
    const match=line.match(/^\s*([A-Z0-9_]+)\s*=/);
    return !match||!keys.has(match[1]);
  }).filter((line,index,all)=>line.trim()||index<all.length-1);
  for(const [key,value] of Object.entries(updates)){
    if(value)lines.push(key+'='+JSON.stringify(value));
  }
  const temp=ENV_FILE+'.tmp';
  await fs.writeFile(temp,lines.join('\n').trim()+'\n','utf8');
  await fs.rename(temp,ENV_FILE);
}

export async function connectionStatus():Promise<ConnectionStatus>{
  const apiKey=process.env.GEMINI_API_KEY||await envValue('GEMINI_API_KEY');
  const model=process.env.GEMINI_MODEL||await envValue('GEMINI_MODEL')||'gemini-2.5-flash';
  const mcpToken=process.env.API_KEY||await envValue('API_KEY');
  return{
    aiConfigured:meaningful(apiKey,''),
    aiModel:model,
    mcpConfigured:meaningful(mcpToken,'change-me'),
    mcpUrl:'http://localhost:3000/api/mcp/sse',
    mcpTokenPreview:meaningful(mcpToken,'change-me')?'••••'+String(mcpToken).slice(-4):'',
    dataFile:path.join(process.cwd(),'.memory','studio.json')
  };
}

export async function configureAI(apiKey:string,model:string){
  const key=apiKey.trim();const selectedModel=model.trim()||'gemini-2.5-flash';
  if(key.length<20)throw new Error('Enter a valid Gemini API key.');
  await testGeminiConnection(key,selectedModel);
  process.env.GEMINI_API_KEY=key;process.env.GEMINI_MODEL=selectedModel;
  await writeValues({GEMINI_API_KEY:key,GEMINI_MODEL:selectedModel});
  return connectionStatus();
}

export async function disconnectAI(){
  delete process.env.GEMINI_API_KEY;
  await writeValues({GEMINI_API_KEY:undefined});
  return connectionStatus();
}

export async function generateMcpCredential(){
  const token=randomBytes(32).toString('hex');
  process.env.API_KEY=token;
  await writeValues({API_KEY:token});
  return{
    token,
    url:'http://localhost:3000/api/mcp/sse',
    config:{
      mcpServers:{
        'creative-memory':{
          url:'http://localhost:3000/api/mcp/sse',
          headers:{Authorization:'Bearer '+token}
        }
      }
    }
  };
}
