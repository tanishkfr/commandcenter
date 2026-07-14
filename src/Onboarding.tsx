import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Database, ExternalLink, Layers3, MessageCircleMore, ShieldCheck, X } from 'lucide-react';
import { studioApi, type Bootstrap, type ConnectionStatus } from './lib/studioApi';
import BrandMark from './BrandMark';

type Props={data:Bootstrap;resetComplete?:boolean;onClose:()=>void};

const steps=[
  {label:'Welcome',icon:Layers3},
  {label:'Your workspace',icon:Database},
  {label:'AI',icon:Layers3},
  {label:'Ready',icon:CheckCircle2}
];

export default function Onboarding({data,resetComplete=false,onClose}:Props){
  const [step,setStep]=useState(0);
  const [status,setStatus]=useState<ConnectionStatus|null>(null);
  const [error,setError]=useState('');
  const shellRef=useRef<HTMLElement>(null);

  useEffect(()=>{studioApi.connectionStatus().then(setStatus).catch(()=>setError('Connection details are unavailable for a moment. You can continue and check Help later.'))},[]);
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null;const node=shellRef.current;if(!node)return;const items=()=>Array.prototype.slice.call(node.querySelectorAll<HTMLElement>('button:not([disabled]),a[href]')) as HTMLElement[];window.setTimeout(()=>items()[0]?.focus(),0);const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();onClose();return}if(event.key!=='Tab')return;const list=items();if(!list.length)return;const first=list[0],last=list[list.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}};node.addEventListener('keydown',key);return()=>{node.removeEventListener('keydown',key);previous?.focus()}},[onClose]);
  const complete=()=>{localStorage.setItem('remainder-onboarding-v2','complete');onClose()};
  const next=()=>setStep(current=>Math.min(steps.length-1,current+1));
  const previous=()=>setStep(current=>Math.max(0,current-1));

  return <div className="onboarding-backdrop">
    <section ref={shellRef} className="onboarding-shell" role="dialog" aria-modal="true" aria-label="Set up Remainder">
      <aside className="onboarding-rail">
        <div className="onboarding-brand"><BrandMark aria-label="Remainder"/><div><strong>Remainder <span className="alpha-badge">Alpha</span></strong><small>Project memory setup</small></div></div>
        <nav>{steps.map((item,index)=>{const Icon=item.icon;return <button type="button" key={item.label} className={index===step?'active':index<step?'complete':''} onClick={()=>setStep(index)} disabled={index>step} aria-current={index===step?'step':undefined}><span>{index<step?<Check size={12}/>:<Icon size={13}/>}</span><em>{item.label}</em></button>})}</nav>
        <div className="onboarding-privacy"><ShieldCheck size={14}/><p><strong>{status?.runtime==='vercel'?'Private cloud':'Local by default'}</strong>{status?.runtime==='vercel'?'Project memory is stored in your private Vercel Blob. AI authentication is managed by the deployment.':'Your projects and memory remain on this computer.'}</p></div>
      </aside>

      <main className="onboarding-main">
        <button type="button" className="onboarding-close" onClick={complete} aria-label="Close onboarding"><X size={17}/></button>
        <div className="onboarding-progress"><span style={{width:((step+1)/steps.length*100)+'%'}}/></div>
        <div className="onboarding-step" key={step}>
          {step===0&&<Welcome resetComplete={resetComplete}/>}
          {step===1&&<StudioSetup data={data} status={status}/>}
          {step===2&&<AiSetup status={status}/>}
          {step===3&&<Ready status={status} projectName={data.project.name}/>}
        </div>

        {error&&<div className="onboarding-error" role="alert">{error}</div>}
        <footer className="onboarding-actions">
          <button type="button" className="onboarding-back" onClick={previous} disabled={step===0}><ArrowLeft size={14}/>Back</button>
          <div>
            {step===0&&<button type="button" className="onboarding-primary" onClick={next}>Enter Remainder<ArrowRight size={14}/></button>}
            {step===1&&<button type="button" className="onboarding-primary" onClick={next}>Review AI connection<ArrowRight size={14}/></button>}
            {step===2&&<button type="button" className="onboarding-primary" onClick={next}>Continue<ArrowRight size={14}/></button>}
            {step===3&&<button type="button" className="onboarding-primary" onClick={complete}>Start creating<ArrowRight size={14}/></button>}
          </div>
        </footer>
      </main>
    </section>
  </div>;
}

function Welcome({resetComplete}:{resetComplete:boolean}){
  return <div className="onboarding-copy welcome-copy"><p className="eyebrow">Welcome to Remainder <span className="alpha-badge">Alpha</span></p><h1>Creative work<br/>should remember itself.</h1><p className="onboarding-lede">Think naturally. When something changes the work, keep it. Remainder carries decisions, questions, and unfinished threads forward with the project.</p><div className="alpha-notice" role="note"><strong>Currently in alpha testing</strong><p>Core project workflows are ready to use, but connections and edge cases are still being refined. Export important work regularly.</p></div>
    {resetComplete&&<div className="reset-success-banner" role="status"><CheckCircle2 size={17}/><div><strong>The workspace is clear.</strong><p>One blank project is ready. Deployment-level storage and AI settings were left unchanged.</p></div></div>}
    <div className="memory-loop"><div><span><MessageCircleMore size={18}/></span><strong>Have a conversation</strong><small>Think naturally. No filing system required.</small></div><ArrowRight size={16}/><div><span><BrandMark compact/></span><strong>Keep what matters</strong><small>Review decisions, ideas, and questions.</small></div><ArrowRight size={16}/><div><span><Layers3 size={18}/></span><strong>Build project memory</strong><small>Search what changed, when, and why.</small></div></div>
  </div>;
}

function StudioSetup({data,status}:{data:Bootstrap;status:ConnectionStatus|null}){
  return <div className="onboarding-copy"><p className="eyebrow">Your personal workspace</p><h1>Everything begins<br/>inside a project.</h1><p className="onboarding-lede">Conversations, sources, decisions, experiments, and history stay connected to the project they belong to.</p>
    <div className="onboarding-project-card"><span style={{background:data.project.color}}>{data.project.name[0]}</span><div><small>Current project</small><strong>{data.project.name}</strong><p>{data.project.description}</p></div><CheckCircle2 size={17}/></div>
    <div className="local-data-card"><Database size={17}/><div><strong>{status?.storageMode==='vercel-blob'?'Private cloud memory':'Your data stays local'}</strong><p>{status?.dataFile||'.memory/studio.json'}</p></div></div>
    <p className="onboarding-note">You can create and rename projects, import existing conversations, and export the complete workspace at any time.</p>
  </div>;
}

function AiSetup({status}:{status:ConnectionStatus|null}){
  const connected=Boolean(status?.aiConfigured);
  return <div className="onboarding-copy"><p className="eyebrow">AI connection</p><h1>Hosted when available.<br/>Useful when offline.</h1><p className="onboarding-lede">On Vercel, AI Gateway uses the deployment’s secure identity automatically. If it is unavailable, Remainder gives prompt-specific offline guidance and keeps the conversation usable.</p>
    {connected?<div className="connection-success"><span><Check size={15}/></span><div><strong>Vercel AI Gateway is ready</strong><p>{status?.aiModel} · {status?.aiManagedBy==='vercel-oidc'?'secured by the Vercel deployment':'connected with an AI Gateway key'}</p></div></div>:<div className="cloud-setup-card"><ShieldCheck size={17}/><div><strong>Offline guidance is active</strong><p>{status?.runtime==='vercel'?'Redeploy once to refresh the Vercel identity, then run the live check in Help.':'For hosted responses in local development, add AI_GATEWAY_API_KEY to .env and restart the server.'}</p></div></div>}
    <div className="mode-comparison"><div><strong>Offline guidance</strong><span>Always available</span><p>Responds to the actual subject, connects matching memory, and suggests a concrete next move.</p></div><div className="recommended"><strong>AI Gateway</strong><span>{connected?'Connected':'Optional'}</span><p>Project-aware synthesis through one Vercel-managed connection, without a provider-specific integration.</p></div></div>
    <a className="external-help" href="https://vercel.com/ai-gateway" target="_blank" rel="noreferrer">Open Vercel AI Gateway<ExternalLink size={12}/></a>
  </div>;
}

function Ready({status,projectName}:{status:ConnectionStatus|null;projectName:string}){
  const checklist=[
    {done:true,label:'Project memory',detail:projectName+' is ready'},
    {done:Boolean(status?.aiConfigured),label:status?.aiConfigured?'AI Gateway connection':'Offline guidance',detail:status?.aiConfigured?status.aiModel:'Usable now; hosted AI can be connected later'},
    {done:true,label:'Automatic persistence',detail:'Completed exchanges and reviewed memory are saved'}
  ];
  return <div className="onboarding-copy ready-copy"><p className="eyebrow">Setup complete</p><h1>The work is ready<br/>to remember.</h1><p className="onboarding-lede">Start with something unresolved: an observation, a design tension, a question, or a direction you are unsure about.</p>
    <div className="ready-checklist">{checklist.map(item=><div key={item.label}><span className={item.done?'done':''}>{item.done?<Check size={12}/>:<span/>}</span><p><strong>{item.label}</strong><small>{item.detail}</small></p></div>)}</div>
    <div className="first-prompt"><BrandMark compact/><div><small>Try this first</small><p>“I am deciding between two directions. Help me understand the tradeoff without rushing to an answer.”</p></div></div>
  </div>;
}
