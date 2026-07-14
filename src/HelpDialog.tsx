import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowUpRight, Check, CircleHelp, Database, ExternalLink, KeyRound, Loader2, RotateCcw, ShieldCheck, X } from 'lucide-react';
import { motion } from 'motion/react';
import { studioApi, type Diagnostics } from './lib/studioApi';

type Section='vercel'|'ai'|'reset';
type Props={onClose:()=>void;onOpenSetup:()=>void};

const sections:Array<{id:Section;label:string}>=[
  {id:'vercel',label:'Vercel setup'},
  {id:'ai',label:'AI'},
  {id:'reset',label:'Reset'}
];

function StatusMark({ok}:{ok:boolean}){return <span className={ok?'help-status-mark ok':'help-status-mark needs-attention'}>{ok?<Check size={12}/>:<AlertTriangle size={12}/>}</span>}

export default function HelpDialog({onClose,onOpenSetup}:Props){
  const [section,setSection]=useState<Section>('vercel');
  const [diagnostics,setDiagnostics]=useState<Diagnostics|null>(null);
  const [checking,setChecking]=useState(false);
  const [error,setError]=useState('');
  const dialogRef=useRef<HTMLElement>(null);
  const origin=typeof window==='undefined'?'https://your-production-domain.vercel.app':window.location.origin;
  const healthUrl=origin+'/api/health';

  const runChecks=useCallback(async(liveAI=false)=>{
    setChecking(true);setError('');
    try{setDiagnostics(await studioApi.diagnostics(liveAI))}
    catch(err:any){setError(err?.message||'The connection check could not finish. No project data was changed.')}
    finally{setChecking(false)}
  },[]);

  useEffect(()=>{void runChecks(false)},[runChecks]);
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null;const node=dialogRef.current;if(!node)return;
    const focusable=()=>Array.prototype.slice.call(node.querySelectorAll<HTMLElement>('button:not([disabled]),a[href]')) as HTMLElement[];
    window.setTimeout(()=>focusable()[0]?.focus(),0);
    const key=(event:globalThis.KeyboardEvent)=>{
      if(event.key==='Escape'){event.preventDefault();onClose();return}
      if(event.key!=='Tab')return;
      const items=focusable();if(!items.length)return;const first=items[0],last=items[items.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
    };
    node.addEventListener('keydown',key);return()=>{node.removeEventListener('keydown',key);if(previous?.isConnected)previous.focus()};
  },[onClose]);

  const diagnosticItems=diagnostics?[
    {label:'Project memory',ok:diagnostics.storage.ok,detail:diagnostics.storage.detail,icon:Database},
    {label:'AI conversation',ok:diagnostics.ai.ok,detail:diagnostics.ai.detail,icon:KeyRound}
  ]:[];

  return <motion.div className="modal-backdrop help-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onMouseDown={onClose}>
    <motion.section ref={dialogRef} className="help-dialog" role="dialog" aria-modal="true" aria-label="Help and connection repair" tabIndex={-1} initial={{opacity:0,y:10,scale:.99}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:6}} onMouseDown={event=>event.stopPropagation()}>
      <header className="help-header">
        <div><p className="eyebrow">Help and connection repair</p><h2>See what is working.</h2><p>Verify storage and AI from this exact deployment, then follow the matching recovery path without guessing.</p></div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close help"><X size={17}/></button>
      </header>

      <section className="help-health" aria-live="polite" aria-busy={checking}>
        <div className="help-health-heading"><div><ShieldCheck size={16}/><span><strong>Current deployment</strong><small>{origin}</small></span></div><button type="button" className="small-action" onClick={()=>void runChecks(true)} disabled={checking}>{checking?<Loader2 className="spin" size={12}/>:<RotateCcw size={12}/>}Run full check</button></div>
        <div className="help-health-grid">
          {diagnosticItems.length?diagnosticItems.map(item=>{const Icon=item.icon;return <div key={item.label}><Icon size={15}/><span><strong>{item.label}</strong><small>{item.detail}</small></span><StatusMark ok={item.ok}/></div>}):<p>{checking?'Checking the deployment…':'Connection details are not available yet.'}</p>}
        </div>
        {error&&<p className="form-error" role="alert">{error}</p>}
        <p className="help-health-note">The initial check reads configuration. “Run full check” performs a real Blob write and asks the configured model for a live response.</p>
      </section>

      <div className="help-body">
        <nav className="help-nav" aria-label="Help topics">{sections.map(item=><button type="button" key={item.id} className={section===item.id?'active':''} aria-current={section===item.id?'page':undefined} onClick={()=>setSection(item.id)}>{item.label}</button>)}</nav>
        <main className="help-content">
          {section==='vercel'&&<VercelGuide healthUrl={healthUrl}/>}
          {section==='ai'&&<AiGuide diagnostics={diagnostics}/>}
          {section==='reset'&&<ResetGuide/>}
        </main>
      </div>

      <footer className="help-footer"><button type="button" className="text-button" onClick={()=>{onClose();onOpenSetup()}}><CircleHelp size={13}/>Open guided setup</button><span>Project memory and deployment credentials are separate. Resetting one never silently changes the other.</span></footer>
    </motion.section>
  </motion.div>;
}

function VercelGuide({healthUrl}:{healthUrl:string}){
  return <article className="help-article"><p className="eyebrow">Hosted setup</p><h3>Two services, one clear check.</h3><p className="help-lede">Remainder needs private storage. Hosted AI uses Vercel’s deployment identity, so a production deployment does not need a provider key copied into Environment Variables.</p>
    <ol className="help-steps">
      <li><span>1</span><div><strong>Connect private project memory</strong><p>In the Vercel project, open <b>Storage</b>. Create or connect a <b>Private Vercel Blob</b> store. Vercel adds <code>BLOB_READ_WRITE_TOKEN</code> automatically; never paste a Blob URL as the token.</p></div></li>
      <li><span>2</span><div><strong>Let Vercel authenticate AI</strong><p>Every Vercel deployment receives <code>VERCEL_OIDC_TOKEN</code> automatically. Do not create or copy this value yourself. Remainder uses it to call Vercel AI Gateway.</p></div></li>
    </ol>
    <div className="help-env-list">
      <div><code>BLOB_READ_WRITE_TOKEN</code><span><b>Required for hosted memory.</b> Injected when the private Blob store is connected.</span></div>
      <div><code>AI_MODEL</code><span><b>Optional.</b> Defaults to <code>google/gemini-2.5-flash-lite</code>.</span></div>
      <div><code>AI_TIMEOUT_MS</code><span><b>Optional.</b> Defaults to <code>12000</code>; accepted range is 3000–25000.</span></div>
      <div><code>AI_GATEWAY_API_KEY</code><span><b>Local development only.</b> Use this when the app is not running inside Vercel.</span></div>
    </div>
    <ol className="help-steps" start={3}>
      <li><span>3</span><div><strong>Redeploy after storage or model changes</strong><p>Environment changes apply only to new deployments. Open <b>Deployments</b>, redeploy the latest production build, and wait for it to finish.</p></div></li>
      <li><span>4</span><div><strong>Verify the deployment</strong><p>Open the health endpoint below. It should return JSON with <code>"ok": true</code> and <code>"storage": "vercel-blob"</code>. Then return here and run the full check.</p><a href={healthUrl} target="_blank" rel="noreferrer">Open API health<ArrowUpRight size={12}/></a></div></li>
    </ol>
    <div className="help-callout"><AlertTriangle size={16}/><div><strong>If the app opens but memory does not</strong><p>The Blob store is missing, connected to a different Vercel project, or the deployment predates the connection. Reconnect it to this project and redeploy.</p></div></div>
  </article>;
}

function AiGuide({diagnostics}:{diagnostics:Diagnostics|null}){
  const detail=diagnostics?.ai.detail||'Run the full check above to test the deployment identity, model, and available AI Gateway credits.';
  return <article className="help-article"><p className="eyebrow">Vercel AI Gateway</p><h3>One connection, with an honest offline path.</h3><p className="help-lede">{detail}</p>
    <div className="help-callout"><KeyRound size={16}/><div><strong>Production needs no copied AI secret</strong><p>On Vercel, <code>VERCEL_OIDC_TOKEN</code> is injected automatically. The only optional production setting is <code>AI_MODEL=google/gemini-2.5-flash-lite</code>.</p></div></div>
    <h4>If the check says the deployment cannot be verified</h4><ol className="help-numbered"><li>Confirm you are testing a Vercel deployment, not an old static host.</li><li>Redeploy the latest commit so Vercel issues a fresh deployment identity.</li><li>Return to this production URL and run the full check again.</li></ol>
    <h4>If the check mentions credits, budget, or rate limits</h4><ol className="help-numbered"><li>Open Vercel AI Gateway and review Usage.</li><li>Enable or add credits for the Vercel team that owns this project.</li><li>Wait a minute, then run the full check again.</li></ol>
    <h4>If the check mentions the model</h4><ol className="help-numbered"><li>Remove an old provider-specific model variable.</li><li>Set <code>AI_MODEL</code> to <code>google/gemini-2.5-flash-lite</code>.</li><li>Redeploy before testing again.</li></ol>
    <h4>Local development</h4><p>Create an AI Gateway key in Vercel, add <code>AI_GATEWAY_API_KEY=...</code> to the local <code>.env</code>, and restart the dev server. Never expose that key through a <code>VITE_</code> variable.</p>
    <h4>What happens while hosted AI is unavailable</h4><p>The text box still works. Remainder responds to the exact subject, uses matching project memory, saves both messages, and shows a calm notice that offline guidance was used. It never presents a canned fallback as a hosted model response.</p>
    <div className="help-links"><a href="https://vercel.com/ai-gateway" target="_blank" rel="noreferrer">Open AI Gateway<ExternalLink size={12}/></a><a href="https://vercel.com/docs/ai-gateway" target="_blank" rel="noreferrer">Read Vercel’s setup guide<ExternalLink size={12}/></a></div>
  </article>;
}

function ResetGuide(){
  return <article className="help-article"><p className="eyebrow">Begin again</p><h3>Reset project memory, not infrastructure.</h3><p className="help-lede">Settings → Begin again permanently removes every project, conversation, source, memory, and history event, then creates one blank project and reopens onboarding.</p>
    <div className="help-callout"><RotateCcw size={16}/><div><strong>What reset preserves</strong><p>Your private Blob connection, Vercel deployment identity, AI Gateway configuration, and local environment variables remain unchanged. They belong to the runtime, not project memory.</p></div></div>
    <h4>Before resetting</h4><ol className="help-numbered"><li>Use <b>Export workspace backup</b> in Settings if anything may be useful later.</li><li>Choose <b>Begin again</b>, read the confirmation, and select <b>Reset everything</b>.</li><li>Wait for the welcome flow. Seeing one blank project confirms the reset finished.</li></ol>
    <h4>If reset fails</h4><p>Nothing should be partially cleared. Run the connection check and repair project storage first, then retry. On Vercel, a failed write usually means the Blob connection belongs to another project or the deployment is stale.</p>
  </article>;
}
