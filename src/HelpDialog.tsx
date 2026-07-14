import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowUpRight, Check, CircleHelp, Copy, Database, ExternalLink, KeyRound, Loader2, Plug, RotateCcw, ShieldCheck, X } from 'lucide-react';
import { motion } from 'motion/react';
import { studioApi, type ConnectionStatus, type Diagnostics } from './lib/studioApi';

type Section='vercel'|'ai'|'mcp'|'reset';
type Props={onClose:()=>void;onOpenSetup:()=>void};

const sections:Array<{id:Section;label:string}>=[
  {id:'vercel',label:'Vercel setup'},
  {id:'ai',label:'AI'},
  {id:'mcp',label:'MCP'},
  {id:'reset',label:'Reset'}
];

function StatusMark({ok}:{ok:boolean}){return <span className={ok?'help-status-mark ok':'help-status-mark needs-attention'}>{ok?<Check size={12}/>:<AlertTriangle size={12}/>}</span>}

export default function HelpDialog({onClose,onOpenSetup}:Props){
  const [section,setSection]=useState<Section>('vercel');
  const [diagnostics,setDiagnostics]=useState<Diagnostics|null>(null);
  const [connections,setConnections]=useState<ConnectionStatus|null>(null);
  const [checking,setChecking]=useState(false);
  const [error,setError]=useState('');
  const [copied,setCopied]=useState('');
  const dialogRef=useRef<HTMLElement>(null);
  const origin=typeof window==='undefined'?'https://your-production-domain.vercel.app':window.location.origin;
  const healthUrl=origin+'/api/health';
  const mcpUrl=connections?.mcpUrl||origin+'/api/mcp';

  const runChecks=useCallback(async(liveAI=false)=>{
    setChecking(true);setError('');
    try{
      const [nextDiagnostics,nextConnections]=await Promise.all([studioApi.diagnostics(liveAI),studioApi.connectionStatus()]);
      setDiagnostics(nextDiagnostics);setConnections(nextConnections);
    }catch(err:any){setError(err?.message||'The connection check could not finish. No project data was changed.')}
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

  const copy=async(value:string,label:string)=>{
    setError('');
    try{await navigator.clipboard.writeText(value);setCopied(label);window.setTimeout(()=>setCopied(''),1600)}
    catch{setError('Copy was blocked. Select the text and press Ctrl+C.')}
  };

  const mcpConfig=useMemo(()=>JSON.stringify({
    mcpServers:{
      remainder:{
        url:mcpUrl,
        headers:{Authorization:'Bearer REPLACE_WITH_YOUR_API_KEY'}
      }
    }
  },null,2),[mcpUrl]);

  const diagnosticItems=diagnostics?[
    {label:'Project memory',ok:diagnostics.storage.ok,detail:diagnostics.storage.detail,icon:Database},
    {label:'AI conversation',ok:diagnostics.ai.ok,detail:diagnostics.ai.detail,icon:KeyRound},
    {label:'MCP access',ok:diagnostics.mcp.ok,detail:diagnostics.mcp.detail,icon:Plug}
  ]:[];

  return <motion.div className="modal-backdrop help-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onMouseDown={onClose}>
    <motion.section ref={dialogRef} className="help-dialog" role="dialog" aria-modal="true" aria-label="Help and connection repair" tabIndex={-1} initial={{opacity:0,y:10,scale:.99}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:6}} onMouseDown={event=>event.stopPropagation()}>
      <header className="help-header">
        <div><p className="eyebrow">Help and connection repair</p><h2>Make every connection legible.</h2><p>Use the live check, follow the exact hosted setup, and know what Remainder will preserve if a service is unavailable.</p></div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close help"><X size={17}/></button>
      </header>

      <section className="help-health" aria-live="polite" aria-busy={checking}>
        <div className="help-health-heading"><div><ShieldCheck size={16}/><span><strong>Current deployment</strong><small>{origin}</small></span></div><button type="button" className="small-action" onClick={()=>void runChecks(true)} disabled={checking}>{checking?<Loader2 className="spin" size={12}/>:<RotateCcw size={12}/>}Run full check</button></div>
        <div className="help-health-grid">
          {diagnosticItems.length?diagnosticItems.map(item=>{const Icon=item.icon;return <div key={item.label}><Icon size={15}/><span><strong>{item.label}</strong><small>{item.detail}</small></span><StatusMark ok={item.ok}/></div>}):<p>{checking?'Checking the deployment...':'Connection details are not available yet.'}</p>}
        </div>
        {error&&<p className="form-error" role="alert">{error}</p>}
        <p className="help-health-note">“Configured” only means a variable exists. “Run full check” verifies a real Blob write and a live NVIDIA response.</p>
      </section>

      <div className="help-body">
        <nav className="help-nav" aria-label="Help topics">{sections.map(item=><button type="button" key={item.id} className={section===item.id?'active':''} aria-current={section===item.id?'page':undefined} onClick={()=>setSection(item.id)}>{item.label}</button>)}</nav>
        <main className="help-content">
          {section==='vercel'&&<VercelGuide healthUrl={healthUrl}/>}
          {section==='ai'&&<AiGuide diagnostics={diagnostics}/>}
          {section==='mcp'&&<McpGuide config={mcpConfig} copied={copied} onCopy={()=>void copy(mcpConfig,'mcp')} url={mcpUrl}/>}
          {section==='reset'&&<ResetGuide/>}
        </main>
      </div>

      <footer className="help-footer"><button type="button" className="text-button" onClick={()=>{onClose();onOpenSetup()}}><CircleHelp size={13}/>Open guided setup</button><span>Secrets stay in server environment variables. Never paste them into a project or conversation.</span></footer>
    </motion.section>
  </motion.div>
}

function VercelGuide({healthUrl}:{healthUrl:string}){
  return <article className="help-article"><p className="eyebrow">Hosted setup</p><h3>Configure Production, then redeploy.</h3><p className="help-lede">Vercel environment changes do not alter an existing deployment. Add each value to the Production environment and create a new deployment before testing.</p>
    <ol className="help-steps">
      <li><span>1</span><div><strong>Connect private project memory</strong><p>In Vercel, open the Remainder project, then <b>Storage</b>. Create or connect a <b>Private Vercel Blob</b> store. Vercel injects <code>BLOB_READ_WRITE_TOKEN</code>; do not paste a Blob URL as its value.</p></div></li>
      <li><span>2</span><div><strong>Add the server variables</strong><p>Open <b>Settings → Environment Variables</b>. Add the variables below to <b>Production</b>. Use Preview too only when you want branch deployments to call the same services.</p></div></li>
    </ol>
    <div className="help-env-list">
      <div><code>BLOB_READ_WRITE_TOKEN</code><span><b>Required.</b> Added automatically when the private Blob store is connected.</span></div>
      <div><code>NVIDIA_API_KEY</code><span><b>Required for hosted AI.</b> A build.nvidia.com key beginning with <code>nvapi-</code>.</span></div>
      <div><code>NVIDIA_MODEL</code><span><b>Recommended.</b> <code>meta/llama-3.3-70b-instruct</code></span></div>
      <div><code>NVIDIA_TIMEOUT_MS</code><span><b>Optional.</b> Use <code>30000</code> if NVIDIA is slow from your Vercel region.</span></div>
      <div><code>API_KEY</code><span><b>Required only for MCP.</b> Your own random 32-byte secret; it is not the NVIDIA key.</span></div>
      <div><code>PUBLIC_APP_URL</code><span><b>Recommended for MCP.</b> Your stable public production domain, including <code>https://</code>.</span></div>
    </div>
    <ol className="help-steps" start={3}>
      <li><span>3</span><div><strong>Redeploy the production build</strong><p>Save the variables. When Vercel offers <b>Redeploy</b>, use it; otherwise open <b>Deployments</b>, choose the latest production deployment, open its menu, and select <b>Redeploy</b>. Variables apply only to new deployments.</p></div></li>
      <li><span>4</span><div><strong>Use the production domain</strong><p>Open the stable production domain, not a commit-specific generated URL. Standard Deployment Protection can require Vercel sign-in on generated and preview URLs while leaving the production domain public.</p></div></li>
      <li><span>5</span><div><strong>Verify both layers</strong><p>Open the health endpoint below. It should return JSON with <code>"ok": true</code> and <code>"storage": "vercel-blob"</code>. Return here and run the full check to verify storage writes and NVIDIA.</p><a href={healthUrl} target="_blank" rel="noreferrer">Open API health<ArrowUpRight size={12}/></a></div></li>
    </ol>
    <div className="help-links"><a href="https://vercel.com/dashboard" target="_blank" rel="noreferrer">Vercel dashboard<ExternalLink size={12}/></a><a href="https://vercel.com/docs/environment-variables" target="_blank" rel="noreferrer">Environment variable guide<ExternalLink size={12}/></a><a href="https://vercel.com/docs/vercel-blob" target="_blank" rel="noreferrer">Vercel Blob guide<ExternalLink size={12}/></a></div>
  </article>
}

function AiGuide({diagnostics}:{diagnostics:Diagnostics|null}){
  return <article className="help-article"><p className="eyebrow">NVIDIA NIM</p><h3>A working key must answer a live request.</h3><p className="help-lede">{diagnostics?.ai.detail||'Run the full check above to test the key and model from this deployment.'}</p>
    <div className="help-callout"><KeyRound size={16}/><div><strong>The known-good hosted configuration</strong><p><code>NVIDIA_API_KEY=nvapi-...</code><br/><code>NVIDIA_MODEL=meta/llama-3.3-70b-instruct</code><br/><code>NVIDIA_TIMEOUT_MS=30000</code></p></div></div>
    <h4>If the check says “rejected”</h4><ol className="help-numbered"><li>Sign in to NVIDIA Build and create a new API key.</li><li>Replace <code>NVIDIA_API_KEY</code> in Vercel Production. Do not include quotes or the variable name in its value.</li><li>Redeploy, reopen the production domain, then run the full check again.</li></ol>
    <h4>If the check says “timed out”</h4><ol className="help-numbered"><li>Confirm the model is exactly <code>meta/llama-3.3-70b-instruct</code>.</li><li>Add <code>NVIDIA_TIMEOUT_MS=30000</code>, or use up to <code>50000</code> for a slow region.</li><li>Redeploy and retry once. A timeout is different from a missing key.</li></ol>
    <h4>What happens while NVIDIA is unavailable</h4><p>Remainder uses its local collaborator, saves both messages, and tells you why it fell back. The text box must remain usable; only the depth of the generated response changes.</p>
    <div className="help-links"><a href="https://build.nvidia.com/settings/api-keys" target="_blank" rel="noreferrer">Create NVIDIA API key<ExternalLink size={12}/></a><a href="https://build.nvidia.com/meta/llama-3_3-70b-instruct" target="_blank" rel="noreferrer">Current model page<ExternalLink size={12}/></a></div>
  </article>
}

function McpGuide({config,copied,onCopy,url}:{config:string;copied:string;onCopy:()=>void;url:string}){
  return <article className="help-article"><p className="eyebrow">Remote MCP server</p><h3>Use one secret in two places.</h3><p className="help-lede">MCP is optional. It lets another compatible AI client read and write Remainder memory through the protected endpoint.</p>
    <ol className="help-steps">
      <li><span>1</span><div><strong>Create the bearer secret</strong><p>In a Windows terminal with Node installed, run <code>node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"</code>. Copy the output once.</p></div></li>
      <li><span>2</span><div><strong>Add it to Vercel</strong><p>Create <code>API_KEY</code> in the Production environment. Paste only the generated value, redeploy, then keep the same value for the client configuration.</p></div></li>
      <li><span>3</span><div><strong>Use a stable endpoint</strong><p>Set <code>PUBLIC_APP_URL</code> to the public production domain. The endpoint should be <code>{url}</code>, not a protected commit-specific deployment URL.</p></div></li>
      <li><span>4</span><div><strong>Configure the client</strong><p>Replace the placeholder below with the exact <code>API_KEY</code>. The client must send the <code>Authorization: Bearer …</code> header.</p></div></li>
    </ol>
    <div className="help-code"><div><span>MCP client JSON</span><button type="button" onClick={onCopy}><Copy size={12}/>{copied==='mcp'?'Copied':'Copy JSON'}</button></div><pre>{config}</pre></div>
    <p className="help-fine">If your client calls this “remote MCP,” “custom connector,” or “streamable HTTP,” use the same URL and bearer header. A 401 means the client secret does not exactly match Vercel <code>API_KEY</code>.</p>
  </article>
}

function ResetGuide(){
  return <article className="help-article"><p className="eyebrow">Begin again</p><h3>Reset memory without hiding what remains.</h3><p className="help-lede">Open <b>Settings → Fresh start → Begin again</b>, confirm the warning, then choose <b>Reset everything</b>.</p>
    <div className="help-reset-grid"><div><Check size={14}/><span><strong>Removed</strong><small>All projects, conversations, captured memory, sources, and history.</small></span></div><div><ShieldCheck size={14}/><span><strong>Kept on Vercel</strong><small>Blob connection, NVIDIA key, model, MCP secret, and production domain variables.</small></span></div><div><Database size={14}/><span><strong>Created</strong><small>One blank “My first project” workspace and a fresh onboarding path.</small></span></div></div>
    <h4>How to know it worked</h4><ol className="help-numbered"><li>The Settings dialog closes.</li><li>Onboarding opens with a “workspace is clear” confirmation.</li><li>The sidebar contains only <b>My first project</b>.</li><li>Sending a new message creates a new conversation exchange; it does not restore old data.</li></ol>
    <h4>If reset fails</h4><ol className="help-numbered"><li>Do not keep clicking. Run the full check above.</li><li>If Project memory is red, reconnect Private Vercel Blob and redeploy.</li><li>If health is green but the write check is red, redeploy the latest code and try once more.</li><li>Export a backup from Settings before any further recovery work.</li></ol>
    <p className="help-fine">Reset is permanent. Hosted secrets are deliberately separate from project memory, so beginning again does not disconnect the services you already configured.</p>
  </article>
}
