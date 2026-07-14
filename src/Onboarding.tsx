import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Copy, Database, ExternalLink, KeyRound, Layers3, Loader2, MessageCircleMore, Plug, ShieldCheck, X } from 'lucide-react';
import { studioApi, type Bootstrap, type ConnectionStatus } from './lib/studioApi';
import BrandMark from './BrandMark';

type Props={data:Bootstrap;resetComplete?:boolean;onClose:()=>void;onConfigured:()=>Promise<void>|void};

const steps=[
  {label:'Welcome',icon:Layers3},
  {label:'Your workspace',icon:Database},
  {label:'AI',icon:Layers3},
  {label:'MCP',icon:Plug},
  {label:'Ready',icon:CheckCircle2}
];

export default function Onboarding({data,resetComplete=false,onClose,onConfigured}:Props){
  const [step,setStep]=useState(0);
  const [status,setStatus]=useState<ConnectionStatus|null>(null);
  const [apiKey,setApiKey]=useState('');
  const [model,setModel]=useState('meta/llama-3.3-70b-instruct');
  const [mcpToken,setMcpToken]=useState('');
  const [mcpConfig,setMcpConfig]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [copied,setCopied]=useState('');
  const [mcpAcknowledged,setMcpAcknowledged]=useState(false);
  const shellRef=useRef<HTMLElement>(null);

  useEffect(()=>{studioApi.connectionStatus().then(next=>{setStatus(next);setModel(next.aiModel)}).catch(()=>setError('Connection details are unavailable for a moment. You can continue and return later.'))},[]);
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null;const node=shellRef.current;if(!node)return;const items=()=>Array.prototype.slice.call(node.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled])')) as HTMLElement[];window.setTimeout(()=>items()[0]?.focus(),0);const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();onClose();return}if(event.key!=='Tab')return;const list=items();if(!list.length)return;const first=list[0],last=list[list.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}};node.addEventListener('keydown',key);return()=>{node.removeEventListener('keydown',key);previous?.focus()}},[onClose]);
  const complete=()=>{localStorage.setItem('remainder-onboarding-v2','complete');onClose()};
  const next=()=>setStep(current=>Math.min(steps.length-1,current+1));
  const previous=()=>setStep(current=>Math.max(0,current-1));

  const configureAI=async()=>{
    setBusy(true);setError('');
    try{const nextStatus=await studioApi.configureAI(apiKey,model);setStatus(nextStatus);setApiKey('');await onConfigured();next()}
    catch(err:any){setError(err.message||'Could not connect to NVIDIA NIM.')}
    finally{setBusy(false)}
  };

  const generateMcp=async()=>{
    setBusy(true);setError('');
    try{
      const result=await studioApi.generateMcp();
      setMcpToken(result.token);setMcpConfig(JSON.stringify(result.config,null,2));
      setStatus(await studioApi.connectionStatus());
    }catch(err:any){setError(err.message||'Could not generate the MCP credential.')}
    finally{setBusy(false)}
  };

  const copy=async(value:string,label:string)=>{setError('');try{await navigator.clipboard.writeText(value);setCopied(label);window.setTimeout(()=>setCopied(''),1600)}catch{setError('Copy was blocked by the browser. Select the text and copy it with Ctrl+C.')}};

  const configText=useMemo(()=>mcpConfig||JSON.stringify({
    mcpServers:{
      remainder:{
        url:status?.mcpUrl||'http://localhost:3000/api/mcp',
        headers:{Authorization:'Bearer YOUR_GENERATED_TOKEN'}
      }
    }
  },null,2),[mcpConfig,status]);

  return <div className="onboarding-backdrop">
    <section ref={shellRef} className="onboarding-shell" role="dialog" aria-modal="true" aria-label="Set up Remainder">
      <aside className="onboarding-rail">
        <div className="onboarding-brand"><BrandMark aria-label="Remainder"/><div><strong>Remainder</strong><small>Project memory setup</small></div></div>
        <nav>{steps.map((item,index)=>{const Icon=item.icon;return <button type="button" key={item.label} className={index===step?'active':index<step?'complete':''} onClick={()=>setStep(index)} disabled={index>step} aria-current={index===step?'step':undefined}><span>{index<step?<Check size={12}/>:<Icon size={13}/>}</span><em>{item.label}</em></button>})}</nav>
        <div className="onboarding-privacy"><ShieldCheck size={14}/><p><strong>{status?.runtime==='vercel'?'Private cloud':'Local by default'}</strong>{status?.runtime==='vercel'?'Project memory is stored in your private Vercel Blob. Keys stay in server environment variables.':'Your projects, memory, keys, and MCP token remain on this machine.'}</p></div>
      </aside>

      <main className="onboarding-main">
        <button type="button" className="onboarding-close" onClick={complete} aria-label="Close onboarding"><X size={17}/></button>
        <div className="onboarding-progress"><span style={{width:((step+1)/steps.length*100)+'%'}}/></div>
        <div className="onboarding-step" key={step}>
          {step===0&&<Welcome resetComplete={resetComplete}/>}
            {step===1&&<StudioSetup data={data} status={status}/>}
            {step===2&&<AiSetup status={status} apiKey={apiKey} model={model} busy={busy} onKey={setApiKey} onModel={setModel} onConnect={configureAI} onSkip={next}/>}
            {step===3&&<McpSetup status={status} token={mcpToken} config={configText} busy={busy} copied={copied} acknowledged={mcpAcknowledged} onGenerate={generateMcp} onCopy={copy} onAcknowledge={setMcpAcknowledged}/>}
            {step===4&&<Ready status={status} projectName={data.project.name}/>}
        </div>

        {error&&<div className="onboarding-error" role="alert">{error}</div>}
        <footer className="onboarding-actions">
          <button type="button" className="onboarding-back" onClick={previous} disabled={step===0}><ArrowLeft size={14}/>Back</button>
          <div>
            {step===0&&<button type="button" className="onboarding-primary" onClick={next}>Enter Remainder<ArrowRight size={14}/></button>}
            {step===1&&<button type="button" className="onboarding-primary" onClick={next}>Set up connections<ArrowRight size={14}/></button>}
            {step===2&&(status?.aiConfigured||status?.runtime==='vercel')&&<button type="button" className="onboarding-primary" onClick={next}>Continue<ArrowRight size={14}/></button>}
            {step===3&&<><button type="button" className="quiet-link" onClick={next}>Set up later</button><button type="button" className="onboarding-primary" onClick={next} disabled={!mcpAcknowledged}>Continue<ArrowRight size={14}/></button></>}
            {step===4&&<button type="button" className="onboarding-primary" onClick={complete}>Start creating<ArrowRight size={14}/></button>}
          </div>
        </footer>
      </main>
    </section>
  </div>
}

function Welcome({resetComplete}:{resetComplete:boolean}){
  return <div className="onboarding-copy welcome-copy"><p className="eyebrow">Welcome to Remainder</p><h1>Creative work<br/>should remember itself.</h1><p className="onboarding-lede">Think naturally. When something changes the work, keep it. Remainder carries decisions, questions, and unfinished threads forward with the project.</p>
    {resetComplete&&<div className="reset-success-banner" role="status"><CheckCircle2 size={17}/><div><strong>The workspace is clear.</strong><p>One blank project is ready. Hosted Vercel, NVIDIA, and MCP variables were left unchanged.</p></div></div>}
    <div className="memory-loop"><div><span><MessageCircleMore size={18}/></span><strong>Have a conversation</strong><small>Think naturally. No filing system required.</small></div><ArrowRight size={16}/><div><span><BrandMark compact/></span><strong>Keep what matters</strong><small>Review decisions, ideas, and questions.</small></div><ArrowRight size={16}/><div><span><Layers3 size={18}/></span><strong>Build project memory</strong><small>Search what changed, when, and why.</small></div></div>
  </div>
}

function StudioSetup({data,status}:{data:Bootstrap;status:ConnectionStatus|null}){
  return <div className="onboarding-copy"><p className="eyebrow">Your personal workspace</p><h1>Everything begins<br/>inside a project.</h1><p className="onboarding-lede">Conversations, sources, decisions, experiments, and history stay connected to the project they belong to.</p>
    <div className="onboarding-project-card"><span style={{background:data.project.color}}>{data.project.name[0]}</span><div><small>Current project</small><strong>{data.project.name}</strong><p>{data.project.description}</p></div><CheckCircle2 size={17}/></div>
    <div className="local-data-card"><Database size={17}/><div><strong>{status?.storageMode==='vercel-blob'?'Private cloud memory':'Your data stays local'}</strong><p>{status?.dataFile||'.memory/studio.json'}</p></div></div>
    <p className="onboarding-note">You can create more projects, import existing AI conversations, and export your complete memory at any time.</p>
  </div>
}

function AiSetup({status,apiKey,model,busy,onKey,onModel,onConnect,onSkip}:{status:ConnectionStatus|null;apiKey:string;model:string;busy:boolean;onKey:(value:string)=>void;onModel:(value:string)=>void;onConnect:()=>void;onSkip:()=>void}){
  return <div className="onboarding-copy"><p className="eyebrow">AI connection</p><h1>Choose how Remainder<br/>thinks with you.</h1><p className="onboarding-lede">NVIDIA NIM gives you richer project-aware conversation and more nuanced memory extraction. Local intelligence remains available without a key.</p>
    {status?.runtime==='vercel'&&!status.aiConfigured?<div className="cloud-setup-card"><ShieldCheck size={17}/><div><strong>Configure AI in Vercel</strong><p>Add <code>NVIDIA_API_KEY</code> and <code>NVIDIA_MODEL</code> under Project Settings → Environment Variables, then redeploy. Remainder remains usable without them.</p></div></div>:status?.aiConfigured?<div className="connection-success"><span><Check size={15}/></span><div><strong>NVIDIA NIM is configured</strong><p>{status.aiModel} will be used for conversation and capture. Run the live check in Settings after a hosted redeploy.</p></div></div>:<div className="connection-form">
      <label><span>NVIDIA API key</span><div className="secret-input"><KeyRound size={14}/><input type="password" autoComplete="off" value={apiKey} onChange={event=>onKey(event.target.value)} placeholder="Paste your NVIDIA API key"/></div><small>Validated with NVIDIA, then saved only to your local .env file.</small></label>
      <label><span>Model</span><select value={model} onChange={event=>onModel(event.target.value)}><option value="meta/llama-3.3-70b-instruct">Llama 3.3 70B - balanced</option><option value="nvidia/llama-3.3-nemotron-super-49b-v1.5">Nemotron Super 49B - deeper reasoning</option></select></label>
      <div className="connection-choice"><button type="button" className="onboarding-primary" onClick={onConnect} disabled={busy||apiKey.length<20}>{busy?<Loader2 className="spin" size={14}/>:<BrandMark compact/>}Test and connect</button><button type="button" className="quiet-link" onClick={onSkip}>Use local intelligence for now</button></div>
      <a className="external-help" href="https://build.nvidia.com/settings/api-keys" target="_blank" rel="noreferrer">Get an NVIDIA API key<ExternalLink size={12}/></a>
    </div>}
    <div className="mode-comparison"><div><strong>Local intelligence</strong><span>Always available</span><p>Heuristic conversation support and memory extraction. Private and offline.</p></div><div className="recommended"><strong>NVIDIA NIM</strong><span>Recommended</span><p>Hosted open models, deeper synthesis, and more precise capture.</p></div></div>
  </div>
}

function McpSetup({status,token,config,busy,copied,acknowledged,onGenerate,onCopy,onAcknowledge}:{status:ConnectionStatus|null;token:string;config:string;busy:boolean;copied:string;acknowledged:boolean;onGenerate:()=>void;onCopy:(value:string,label:string)=>void;onAcknowledge:(value:boolean)=>void}){
  const ready=Boolean(token)||Boolean(status?.mcpConfigured);const hosted=status?.runtime==='vercel';
  return <div className="onboarding-copy"><p className="eyebrow">MCP server</p><h1>Let other AI tools<br/>remember with you.</h1><p className="onboarding-lede">MCP lets compatible clients reach this project through its protected server endpoint.</p>
    <div className="mcp-explainer"><div><span>1</span><p><strong>{hosted?'Add an API_KEY':'Generate a credential'}</strong>{hosted?'Store one long random secret in Vercel Environment Variables.':'A personal bearer token protects the MCP endpoint.'}</p></div><div><span>2</span><p><strong>Add the configuration</strong>Paste the JSON into your MCP-compatible client.</p></div><div><span>3</span><p><strong>{hosted?'Redeploy Remainder':'Keep Remainder running'}</strong>{hosted?'The endpoint reads the credential after deployment.':'The client connects through the URL shown below.'}</p></div></div>
    {hosted&&!ready?<div className="cloud-setup-card"><ShieldCheck size={17}/><div><strong>Configure MCP in Vercel</strong><p>Add <code>API_KEY</code> under Project Settings → Environment Variables, use the same secret in your client configuration, then redeploy.</p></div></div>:!ready?<button type="button" className="generate-token" onClick={onGenerate} disabled={busy}>{busy?<Loader2 className="spin" size={15}/>:<KeyRound size={15}/>}Generate personal MCP credential</button>:<div className="connection-success compact"><span><Check size={15}/></span><div><strong>MCP credential is ready</strong><p>{token?'Copy the configuration below now. The full token is shown only in this setup step.':hosted?'API_KEY is present in Vercel. Replace the placeholder below with that same secret in your MCP client.':'A credential already exists. Rotate it to reveal a new copyable token.'}</p></div>{!token&&!hosted&&<button type="button" onClick={onGenerate}>Rotate</button>}</div>}
    <div className="config-block"><div><span>MCP client configuration</span><button type="button" onClick={()=>onCopy(config,'config')}><Copy size={12}/>{copied==='config'?'Copied':'Copy JSON'}</button></div><pre>{config}</pre></div>
    {token&&<div className="token-row"><div><span>Bearer token</span><code>{token}</code></div><button type="button" onClick={()=>onCopy(token,'token')}><Copy size={12}/>{copied==='token'?'Copied':'Copy'}</button></div>}
    <label className="setup-confirm"><input type="checkbox" checked={acknowledged} onChange={event=>onAcknowledge(event.target.checked)}/><span>{hosted?'I replaced the placeholder with my Vercel API_KEY in the MCP client.':'I copied the configuration into my MCP client.'}</span></label>
    <p className="onboarding-note">Your client may call this a remote MCP server, custom connector, or streamable HTTP transport. It must send both the URL and the Authorization bearer header shown above.</p>
  </div>
}

function Ready({status,projectName}:{status:ConnectionStatus|null;projectName:string}){
  const checklist=[
    {done:true,label:'Local project memory',detail:projectName+' is ready'},
    {done:Boolean(status?.aiConfigured),label:'NVIDIA NIM connection',detail:status?.aiConfigured?status.aiModel:'Local mode selected'},
    {done:Boolean(status?.mcpConfigured),label:'MCP server credential',detail:status?.mcpConfigured?'Protected endpoint ready':'Can be configured later'},
    {done:true,label:'Automatic persistence',detail:'Completed exchanges and reviewed memory are saved'}
  ];
  return <div className="onboarding-copy ready-copy"><p className="eyebrow">Setup complete</p><h1>The work is ready<br/>to remember.</h1><p className="onboarding-lede">Start with something unresolved: an observation, a design tension, a question, or a direction you are unsure about.</p>
    <div className="ready-checklist">{checklist.map(item=><div key={item.label}><span className={item.done?'done':''}>{item.done?<Check size={12}/>:<span/>}</span><p><strong>{item.label}</strong><small>{item.detail}</small></p></div>)}</div>
    <div className="first-prompt"><BrandMark compact/><div><small>Try this first</small><p>"I am deciding between two directions. Help me understand the tradeoff without rushing to an answer."</p></div></div>
  </div>
}
