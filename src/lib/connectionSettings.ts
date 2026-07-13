import { randomBytes } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { DEFAULT_NIM_MODEL, testNvidiaConnection } from './creativeAI.js';
import { creativeStorageMode } from './creativeMemory.js';

export interface ConnectionStatus {
  aiConfigured:boolean;
  aiModel:string;
  aiProvider:'NVIDIA NIM';
  mcpConfigured:boolean;
  mcpUrl:string;
  mcpTokenPreview:string;
  dataFile:string;
  runtime:'local'|'vercel';
  configWritable:boolean;
  storageMode:'local-file'|'vercel-blob';
}

const ENV_FILE=path.join(process.cwd(),'.env');
const isVercel=()=>Boolean(process.env.VERCEL);
const meaningful=(value:string|undefined,placeholder:string)=>Boolean(value&&value.trim()&&value!==placeholder&&!value.includes('MY_')&&!value.includes('YOUR_'));

async function readEnvText(){try{return await fs.readFile(ENV_FILE,'utf8')}catch{return ''}}
function unquote(value:string){const clean=value.trim();return((clean.startsWith('"')&&clean.endsWith('"'))||(clean.startsWith("'")&&clean.endsWith("'")))?clean.slice(1,-1):clean}
async function envValue(key:string){
  if(isVercel())return undefined;
  const text=await readEnvText();const line=text.split(/\r?\n/).find(item=>item.trim().startsWith(key+'='));
  return line?unquote(line.slice(line.indexOf('=')+1)):undefined;
}
async function writeValues(updates:Record<string,string|undefined>){
  if(isVercel())throw new Error('Hosted connection settings are read-only. Add environment variables in Vercel Project Settings, then redeploy.');
  const existing=await readEnvText();const keys=new Set(Object.keys(updates));
  const lines=existing.split(/\r?\n/).filter(line=>{const match=line.match(/^\s*([A-Z0-9_]+)\s*=/);return !match||!keys.has(match[1])}).filter((line,index,all)=>line.trim()||index<all.length-1);
  for(const [key,value] of Object.entries(updates))if(value)lines.push(key+'='+JSON.stringify(value));
  const temp=ENV_FILE+'.tmp';await fs.writeFile(temp,lines.join('\n').trim()+'\n','utf8');await fs.rename(temp,ENV_FILE);
}
function publicBaseUrl(){
  const explicit=process.env.PUBLIC_APP_URL||process.env.APP_URL;
  if(explicit&&!explicit.includes('localhost'))return explicit.replace(/\/$/,'');
  const host=process.env.VERCEL_PROJECT_PRODUCTION_URL||process.env.VERCEL_URL;
  return host?'https://'+host:'http://localhost:3000';
}

export async function connectionStatus():Promise<ConnectionStatus>{
  const apiKey=process.env.NVIDIA_API_KEY||await envValue('NVIDIA_API_KEY');
  const model=process.env.NVIDIA_MODEL||await envValue('NVIDIA_MODEL')||DEFAULT_NIM_MODEL;
  const mcpToken=process.env.API_KEY||await envValue('API_KEY');const storageMode=creativeStorageMode();
  return{aiConfigured:meaningful(apiKey,''),aiModel:model,aiProvider:'NVIDIA NIM',mcpConfigured:meaningful(mcpToken,'change-me'),mcpUrl:publicBaseUrl()+'/api/mcp',mcpTokenPreview:meaningful(mcpToken,'change-me')?'••••'+String(mcpToken).slice(-4):'',dataFile:storageMode==='vercel-blob'?'Private Vercel Blob · creative-memory/studio.json':path.join(process.cwd(),'.memory','studio.json'),runtime:isVercel()?'vercel':'local',configWritable:!isVercel(),storageMode};
}

export async function configureAI(apiKey:string,model:string){
  if(isVercel())throw new Error('On Vercel, add NVIDIA_API_KEY and NVIDIA_MODEL in Project Settings → Environment Variables, then redeploy.');
  const key=apiKey.trim();const selectedModel=model.trim()||DEFAULT_NIM_MODEL;if(key.length<20)throw new Error('Enter a valid NVIDIA API key.');
  await testNvidiaConnection(key,selectedModel);process.env.NVIDIA_API_KEY=key;process.env.NVIDIA_MODEL=selectedModel;delete process.env.GEMINI_API_KEY;delete process.env.GEMINI_MODEL;
  await writeValues({NVIDIA_API_KEY:key,NVIDIA_MODEL:selectedModel,NVIDIA_BASE_URL:'https://integrate.api.nvidia.com/v1',GEMINI_API_KEY:undefined,GEMINI_MODEL:undefined});return connectionStatus();
}
export async function disconnectAI(){
  if(isVercel())throw new Error('Remove NVIDIA_API_KEY in Vercel Project Settings, then redeploy.');
  delete process.env.NVIDIA_API_KEY;delete process.env.NVIDIA_MODEL;delete process.env.NVIDIA_BASE_URL;await writeValues({NVIDIA_API_KEY:undefined,NVIDIA_MODEL:undefined,NVIDIA_BASE_URL:undefined});return connectionStatus();
}
export async function resetConnections(){
  if(isVercel())return connectionStatus();
  delete process.env.NVIDIA_API_KEY;delete process.env.NVIDIA_MODEL;delete process.env.NVIDIA_BASE_URL;delete process.env.API_KEY;delete process.env.GEMINI_API_KEY;delete process.env.GEMINI_MODEL;
  await writeValues({NVIDIA_API_KEY:undefined,NVIDIA_MODEL:undefined,NVIDIA_BASE_URL:undefined,API_KEY:undefined,GEMINI_API_KEY:undefined,GEMINI_MODEL:undefined});return connectionStatus();
}
export async function generateMcpCredential(){
  const url=publicBaseUrl()+'/api/mcp';
  if(isVercel()){
    if(!meaningful(process.env.API_KEY,'change-me'))throw new Error('Add a long random API_KEY in Vercel Project Settings → Environment Variables, then redeploy.');
    return{token:'',url,config:{mcpServers:{'creative-memory':{url,headers:{Authorization:'Bearer YOUR_VERCEL_API_KEY'}}}}};
  }
  const token=randomBytes(32).toString('hex');process.env.API_KEY=token;await writeValues({API_KEY:token});
  return{token,url,config:{mcpServers:{'creative-memory':{url,headers:{Authorization:'Bearer '+token}}}}};
}
