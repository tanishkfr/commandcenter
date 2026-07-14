import path from 'path';
import { aiConfigured, DEFAULT_AI_MODEL } from './creativeAI.js';
import { creativeStorageMode } from './creativeMemory.js';

export interface ConnectionStatus {
  aiConfigured:boolean;
  aiModel:string;
  aiProvider:'Vercel AI Gateway';
  aiManagedBy:'vercel-oidc'|'api-key'|'offline';
  dataFile:string;
  runtime:'local'|'vercel';
  configWritable:boolean;
  storageMode:'local-file'|'vercel-blob';
}

const isVercel=()=>Boolean(process.env.VERCEL);

export async function connectionStatus():Promise<ConnectionStatus>{
  const storageMode=creativeStorageMode();
  const aiManagedBy=process.env.VERCEL_OIDC_TOKEN?.trim()?'vercel-oidc':process.env.AI_GATEWAY_API_KEY?.trim()?'api-key':'offline';
  return{
    aiConfigured:aiConfigured(),
    aiModel:process.env.AI_MODEL?.trim()||DEFAULT_AI_MODEL,
    aiProvider:'Vercel AI Gateway',
    aiManagedBy,
    dataFile:storageMode==='vercel-blob'?'Private Vercel Blob · project memory':path.join(process.cwd(),'.memory','studio.json'),
    runtime:isVercel()?'vercel':'local',
    configWritable:false,
    storageMode
  };
}
