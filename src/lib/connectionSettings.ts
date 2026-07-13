import { randomBytes } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { DEFAULT_NIM_MODEL, testNvidiaConnection } from './creativeAI.js';

export interface ConnectionStatus {
  aiConfigured:boolean;
  aiModel:string;
  aiProvider:'NVIDIA NIM';
  mcpConfigured:boolean;
  mcpUrl:string;
  mcpTokenPreview:string;
  dataFile:string;
}

const ENV_FILE=path.join(process.cwd(),'.env');
const meaningful=(value:string|undefined,placeholder:string)=>Boolean(value&&value.trim()&&value!==placeholder&&!value.includes('MY_')&&!value.includes('YOUR_'));

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
  const apiKey=process.env.NVIDIA_API_KEY||await envValue('NVIDIA_API_KEY');
  const model=process.env.NVIDIA_MODEL||await envValue('NVIDIA_MODEL')||DEFAULT_NIM_MODEL;
  const mcpToken=process.env.API_KEY||await envValue('API_KEY');
  return{
    aiConfigured:meaningful(apiKey,''),
    aiModel:model,
    aiProvider:'NVIDIA NIM',
    mcpConfigured:meaningful(mcpToken,'change-me'),
    mcpUrl:'http://localhost:3000/api/mcp/sse',
    mcpTokenPreview:meaningful(mcpToken,'change-me')?'••••'+String(mcpToken).slice(-4):'',
    dataFile:path.join(process.cwd(),'.memory','studio.json')
  };
}

export async function configureAI(apiKey:string,model:string){
  const key=apiKey.trim();const selectedModel=model.trim()||DEFAULT_NIM_MODEL;
  if(key.length<20)throw new Error('Enter a valid NVIDIA API key.');
  await testNvidiaConnection(key,selectedModel);
  process.env.NVIDIA_API_KEY=key;process.env.NVIDIA_MODEL=selectedModel;
  delete process.env.GEMINI_API_KEY;delete process.env.GEMINI_MODEL;
  await writeValues({
    NVIDIA_API_KEY:key,
    NVIDIA_MODEL:selectedModel,
    NVIDIA_BASE_URL:'https://integrate.api.nvidia.com/v1',
    GEMINI_API_KEY:undefined,
    GEMINI_MODEL:undefined
  });
  return connectionStatus();
}

export async function disconnectAI(){
  delete process.env.NVIDIA_API_KEY;delete process.env.NVIDIA_MODEL;delete process.env.NVIDIA_BASE_URL;
  await writeValues({NVIDIA_API_KEY:undefined,NVIDIA_MODEL:undefined,NVIDIA_BASE_URL:undefined});
  return connectionStatus();
}


export async function resetConnections(){
  delete process.env.NVIDIA_API_KEY;delete process.env.NVIDIA_MODEL;delete process.env.NVIDIA_BASE_URL;delete process.env.API_KEY;
  delete process.env.GEMINI_API_KEY;delete process.env.GEMINI_MODEL;
  await writeValues({
    NVIDIA_API_KEY:undefined,NVIDIA_MODEL:undefined,NVIDIA_BASE_URL:undefined,API_KEY:undefined,
    GEMINI_API_KEY:undefined,GEMINI_MODEL:undefined
  });
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
