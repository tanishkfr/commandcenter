import { CSSProperties, FormEvent, ReactNode, useEffect, useRef, useState } from 'react';
import {
  ArrowRight, ArrowUp, ArrowUpRight, Bookmark, Brain, Check, CheckCircle2, ChevronDown, Circle, Clock3,
  Command, Download, Edit3, Feather, CircleHelp, FileInput, Figma, Github, History, Layers3, Link2, Loader2, MessageCircleMore,
  Mic2, MoreHorizontal, Plus, Search, Settings2, Sparkles, Trash2, WandSparkles, X
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import Onboarding from './Onboarding';
import { studioApi, type Bootstrap } from './lib/studioApi';
import type { ArtifactType, MemoryArtifact, SearchResult, StudioProject, StudioSession, StudioSource, TimelineEvent } from './lib/creativeMemory';

type Surface='studio'|'memory'|'history';
type Dialog=null|'project'|'session'|'source'|'import'|'settings';
const artifactIcons:Record<ArtifactType,string>={decision:'✓',principle:'✦',question:'?',idea:'◌',experiment:'○',reference:'↗',risk:'!',action:'→',abandoned:'×'};
const colors=['#df7257','#796bb4','#5e9b86','#6682a0','#b78258','#877b70'];

function Mark(){return <div className="mark" aria-label="Studio memory"><span/><span/><span/></div>}
function relativeDate(value:string){
  const diff=Date.now()-new Date(value).getTime();const day=Math.floor(diff/86400000);
  if(day<=0)return 'Today';if(day===1)return 'Yesterday';if(day<7)return day+' days ago';
  return new Date(value).toLocaleDateString([], {month:'short',day:'numeric'});
}
function artifactClass(type:ArtifactType){return type==='decision'?'decision':type==='principle'?'principle':type==='question'?'question':type==='risk'?'risk':'experiment'}

function Sidebar({data,surface,onSurface,onProject,onNewProject}:{
  data:Bootstrap;surface:Surface;onSurface:(value:Surface)=>void;onProject:(id:string)=>void;onNewProject:()=>void
}){
  const nav=[{id:'studio' as const,label:'Studio',icon:MessageCircleMore},{id:'memory' as const,label:'Memory',icon:Brain},{id:'history' as const,label:'History',icon:History}];
  return <aside className="sidebar">
    <div className="sidebar-top"><Mark/></div>
    <nav className="primary-nav" aria-label="Workspace">{nav.map(({id,label,icon:Icon})=><button key={id} className={surface===id?'nav-item active':'nav-item'} onClick={()=>onSurface(id)}><Icon size={17}/><span>{label}</span>{id==='memory'&&<span className="nav-count">{data.artifacts.length}</span>}</button>)}</nav>
    <div className="sidebar-projects">
      <div className="sidebar-label"><span>Projects</span><button aria-label="New project" onClick={onNewProject}><Plus size={13}/></button></div>
      {data.projects.map(project=><button key={project.id} className={project.id===data.project.id?'project-nav active':'project-nav'} onClick={()=>onProject(project.id)}>
        <span className="project-sigil" style={{'--project-color':project.color} as CSSProperties}>{project.name[0]}</span><span className="project-name">{project.name}</span>{project.id===data.project.id&&<span className="live-dot"/>}
      </button>)}
    </div>
    <div className="sidebar-footer"><button className="profile-button"><span className="avatar">SN</span><span><strong>Personal studio</strong><small>Local-first memory</small></span><ChevronDown size={13}/></button></div>
  </aside>
}

function Topbar({data,onSearch,onSettings,onHelp}: {data:Bootstrap;onSearch:()=>void;onSettings:()=>void;onHelp:()=>void}){
  return <header className="topbar">
    <div className="project-switcher"><span className="project-dot" style={{background:data.project.color}}/><span>{data.project.name}</span><span className="topbar-context">/ {data.activeSession?.title||'No conversation'}</span></div>
    <div className="topbar-actions">
      <span className={'sync-state '+(data.aiConfigured?'ai-on':'')}><span/>{data.aiConfigured?'NVIDIA NIM connected':'Local intelligence'}</span>
      <button className="search-button" onClick={onSearch}><Search size={14}/><span>Find anything</span><kbd><Command size={10}/> K</kbd></button>
      <button className="icon-button" aria-label="Open setup guide" title="Setup guide" onClick={onHelp}><CircleHelp size={16}/></button><button className="icon-button" aria-label="Settings" title="Settings" onClick={onSettings}><Settings2 size={16}/></button>
    </div>
  </header>
}

function SessionMenu({sessions,active,onSelect,onNew,onImport}:{
  sessions:StudioSession[];active:StudioSession|null;onSelect:(id:string)=>void;onNew:()=>void;onImport:()=>void
}){
  const [open,setOpen]=useState(false);
  return <div className="session-switch">
    <button onClick={()=>setOpen(!open)}><span>{active?.title||'Start a conversation'}</span><ChevronDown size={13}/></button>
    <AnimatePresence>{open&&<motion.div className="session-menu" initial={{opacity:0,y:-5}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-5}}>
      <p>Conversations</p>{sessions.map(session=><button key={session.id} className={active?.id===session.id?'active':''} onClick={()=>{onSelect(session.id);setOpen(false)}}><MessageCircleMore size={13}/><span><strong>{session.title}</strong><small>{session.messages.length} messages · {relativeDate(session.updatedAt)}</small></span></button>)}
      <div className="session-menu-actions"><button onClick={()=>{onNew();setOpen(false)}}><Plus size={12}/>New</button><button onClick={()=>{onImport();setOpen(false)}}><FileInput size={12}/>Import</button></div>
    </motion.div>}</AnimatePresence>
  </div>
}

function ContextRail({data,onSource,onArtifact}: {data:Bootstrap;onSource:()=>void;onArtifact:(artifact:MemoryArtifact)=>void}){
  const memories=data.artifacts.filter(item=>item.status==='active').slice(0,4);
  return <aside className="context-rail">
    <div className="context-heading"><div><Sparkles size={14}/><span>Project context</span></div><button onClick={onSource} aria-label="Add source"><Plus size={14}/></button></div>
    <section className="context-block"><p className="eyebrow">The project</p><p className="thread-summary">{data.project.description||'Give this project a description so Studio can understand its intent.'}</p><div className="thread-evolution"><span>{data.sessions.length} conversations</span><ArrowRight size={11}/><strong>{data.artifacts.length} memories</strong></div></section>
    <section className="context-block context-list"><p className="eyebrow">Taking shape</p>
      {memories.length?memories.map(item=><button className="context-item" key={item.id} onClick={()=>onArtifact(item)}><span className={'artifact-icon '+artifactClass(item.type)}>{artifactIcons[item.type]}</span><span><small>{item.type}</small>{item.title}</span></button>):<p className="empty-hint">Capture a conversation and its durable ideas will gather here.</p>}
    </section>
    <section className="context-block"><div className="section-title"><p className="eyebrow">Nearby sources</p><button onClick={onSource}>Add</button></div>
      {data.sources.length?data.sources.slice(0,4).map(source=><a className="memory-link" key={source.id} href={source.url||undefined} target={source.url?'_blank':undefined} rel="noreferrer"><span className={'source-icon '+source.type}>{source.type==='github'?<Github size={13}/>:source.type==='figma'?<Figma size={13}/>:<Link2 size={13}/>}</span><span><strong>{source.title}</strong><small>{source.note||source.url||source.type}</small></span>{source.url&&<ArrowUpRight size={12}/>}</a>):<p className="empty-hint">Link research, Figma files, repositories, or notes.</p>}
    </section>
    <div className="context-footnote"><WandSparkles size={12}/><span>Context is retrieved from saved memory</span></div>
  </aside>
}

function Composer({disabled,thinking,onSend,onCapture}: {disabled:boolean;thinking:boolean;onSend:(text:string)=>void;onCapture:()=>void}){
  const [value,setValue]=useState('');const ref=useRef<HTMLTextAreaElement>(null);
  useEffect(()=>{const key=(event:KeyboardEvent)=>{if(event.key==='/'&&document.activeElement?.tagName!=='TEXTAREA'){event.preventDefault();ref.current?.focus()}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[]);
  const submit=(event?:FormEvent)=>{event?.preventDefault();if(value.trim()&&!disabled&&!thinking){onSend(value.trim());setValue('')}};
  return <div className="composer-wrap"><form className="composer" onSubmit={submit}>
    <textarea ref={ref} rows={1} value={value} disabled={disabled} onChange={e=>setValue(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();submit()}}} placeholder={disabled?'Start a conversation first…':'Continue the thought…'}/>
    <div className="composer-actions"><div><button type="button" className="composer-tool"><Plus size={15}/></button><button type="button" className="composer-tool"><Mic2 size={15}/></button></div><button className={value.trim()?'send-button ready':'send-button'} disabled={disabled||thinking}><ArrowUp size={15}/></button></div>
  </form><div className="capture-row"><span>{thinking?'Thinking with project memory…':'Everything here stays in this project'}</span><button className="capture-button" disabled={disabled||thinking} onClick={onCapture}><Sparkles size={14}/><span>Capture session</span><kbd>⇧ ⌘ S</kbd></button></div></div>
}

function StudioView({data,session,thinking,onSend,onCapture,onSession,onNewSession,onImport,onSource,onArtifact}:{
  data:Bootstrap;session:StudioSession|null;thinking:boolean;onSend:(text:string)=>void;onCapture:()=>void;onSession:(id:string)=>void;onNewSession:()=>void;onImport:()=>void;onSource:()=>void;onArtifact:(artifact:MemoryArtifact)=>void
}){
  const end=useRef<HTMLDivElement>(null);useEffect(()=>{end.current?.scrollIntoView({behavior:'smooth',block:'nearest'})},[session?.messages.length,thinking]);
  const date=new Date();
  return <div className="studio-layout"><main className="conversation"><div className="conversation-inner">
    <div className="studio-session-header"><div className="morning-note"><span className="date-mark">{date.toLocaleDateString([], {weekday:'short'}).toUpperCase()}<br/>{date.getDate()}</span><div><p>{data.project.name}</p><h1>{session?.messages.length?'Continue where the idea still has tension.':'What are you thinking about?'}</h1></div></div><SessionMenu sessions={data.sessions} active={session} onSelect={onSession} onNew={onNewSession} onImport={onImport}/></div>
    <div className="session-marker"><span/>{session?.title||'No conversation selected'}<span/></div>
    <div className="messages">
      {!session?.messages.length&&<div className="conversation-empty"><Sparkles size={18}/><p>Begin with an observation, question, half-formed idea, or paste something you want to think through.</p></div>}
      {session?.messages.map(message=><motion.article initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} key={message.id} className={'message '+(message.role==='user'?'you':'studio')}>
        <div>{message.role==='user'?<span className="avatar small">YOU</span>:<span className="studio-avatar"><Sparkles size={12}/></span>}</div>
        <div className="message-content"><div className="message-meta"><strong>{message.role==='user'?'You':'Studio'}</strong><time>{new Date(message.createdAt).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}</time></div><p>{message.content}</p>
          {!!message.citedArtifactIds.length&&<div className="citation-row">{message.citedArtifactIds.map(id=>{const artifact=data.artifacts.find(item=>item.id===id);return artifact?<button key={id} onClick={()=>onArtifact(artifact)}><Bookmark size={10}/>{artifact.title}</button>:null})}</div>}
        </div>
      </motion.article>)}
      {thinking&&<div className="thinking"><span/><span/><span/></div>}<div ref={end}/>
    </div>
  </div><Composer disabled={!session} thinking={thinking} onSend={onSend} onCapture={onCapture}/></main><ContextRail data={data} onSource={onSource} onArtifact={onArtifact}/></div>
}

function MemoryView({data,onArtifact}: {data:Bootstrap;onArtifact:(artifact:MemoryArtifact)=>void}){
  const [filter,setFilter]=useState<'all'|ArtifactType>('all');
  const visible=data.artifacts.filter(item=>filter==='all'||item.type===filter);
  return <main className="quiet-surface"><div className="surface-intro"><p className="eyebrow">{data.project.name} · {data.artifacts.length} durable memories</p><h1>The project remembers<br/>how it became itself.</h1><p>Decisions, principles, questions, experiments, and abandoned directions remain connected to where they came from.</p></div>
    <div className="memory-toolbar">{(['all','decision','question','principle','experiment','action'] as const).map(type=><button key={type} className={filter===type?'active':''} onClick={()=>setFilter(type)}>{type==='all'?'All memory':type+'s'}</button>)}<a className="memory-ask" href="/api/studio/export"><Download size={13}/>Export</a></div>
    {visible.length?<div className="memory-story"><div className="memory-period"><span>Now</span><small>Project memory</small></div><div className="memory-items">{visible.map((item,index)=><motion.button layout initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} transition={{delay:index*.035}} key={item.id} className="memory-card" onClick={()=>onArtifact(item)}><span className={'memory-glyph '+artifactClass(item.type)}>{artifactIcons[item.type]}</span><span><small>{item.type} · {Math.round(item.confidence*100)}%</small><strong>{item.title}</strong><em>{item.body||'No additional rationale yet.'}</em></span><ArrowUpRight size={13}/></motion.button>)}</div></div>:<div className="large-empty"><Brain size={22}/><h3>No memory here yet</h3><p>Have a conversation in Studio, then capture the session. Its durable ideas will appear here.</p></div>}
  </main>
}

function HistoryView({data,onSession,onArtifact}: {data:Bootstrap;onSession:(id:string)=>void;onArtifact:(artifact:MemoryArtifact)=>void}){
  const open=(event:TimelineEvent)=>{if(event.artifactId){const item=data.artifacts.find(a=>a.id===event.artifactId);if(item)onArtifact(item)}else if(event.sessionId)onSession(event.sessionId)};
  return <main className="quiet-surface history-surface"><div className="surface-intro"><p className="eyebrow">Project history</p><h1>What changed,<br/>and why.</h1><p>A continuous record across conversations, references, captures, and edits.</p></div><div className="history-line">
    {data.events.length?data.events.map((event,index)=><motion.button initial={{opacity:0,x:-8}} animate={{opacity:1,x:0}} transition={{delay:index*.03}} key={event.id} className="history-moment" onClick={()=>open(event)}><time>{relativeDate(event.createdAt)}</time><span className="timeline-node">{event.type==='conversation'?<MessageCircleMore size={13}/>:event.type==='reference'?<Link2 size={13}/>:<Sparkles size={13}/>}</span><span><strong>{event.title}</strong><small>{event.detail}</small></span><ArrowUpRight size={13}/></motion.button>):<div className="large-empty"><History size={22}/><h3>History begins with your first move</h3></div>}
  </div></main>
}

function DialogShell({children,onClose,wide=false}: {children:ReactNode;onClose:()=>void;wide?:boolean}){
  return <motion.div className="modal-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onMouseDown={onClose}><motion.section className={'product-modal '+(wide?'wide':'')} initial={{opacity:0,y:12,scale:.98}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:8}} onMouseDown={e=>e.stopPropagation()}>{children}</motion.section></motion.div>
}

function SimpleDialog({type,data,onClose,onDone}: {type:Exclude<Dialog,'settings'>;data:Bootstrap;onClose:()=>void;onDone:(value:any)=>void}){
  const [name,setName]=useState('');const [description,setDescription]=useState('');const [url,setUrl]=useState('');const [text,setText]=useState('');const [color,setColor]=useState(colors[1]);const [saving,setSaving]=useState(false);const [error,setError]=useState('');
  const labels={project:['New project','Give a new body of work its own memory.'],session:['New conversation','Start a clean thread inside '+data.project.name+'.'],source:['Add project source','Connect a reference that should stay nearby.'],import:['Import conversation','Paste an exported ChatGPT, Claude, or other AI conversation.']} as const;
  const submit=async(e:FormEvent)=>{e.preventDefault();setSaving(true);setError('');try{
    if(type==='project')onDone(await studioApi.createProject({name,description,color}));
    if(type==='session')onDone(await studioApi.createSession(data.project.id,name||'New conversation'));
    if(type==='source')onDone(await studioApi.addSource({projectId:data.project.id,title:name,url,note:description,type:url.includes('github')?'github':url.includes('figma')?'figma':'link'}));
    if(type==='import')onDone(await studioApi.importText({projectId:data.project.id,title:name||'Imported conversation',text}));
  }catch(err:any){setError(err.message)}finally{setSaving(false)}};
  return <DialogShell onClose={onClose} wide={type==='import'}><form onSubmit={submit}><div className="modal-heading"><div><p className="eyebrow">{type}</p><h2>{labels[type][0]}</h2><span>{labels[type][1]}</span></div><button type="button" className="icon-button" onClick={onClose}><X size={17}/></button></div>
    <label><span>{type==='session'||type==='import'?'Title':'Name'}</span><input autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder={type==='project'?'Project name':type==='source'?'Reference title':'Conversation title'}/></label>
    {type==='project'&&<><label><span>Description</span><textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="What is this project trying to understand?"/></label><div className="color-picker">{colors.map(item=><button type="button" key={item} className={color===item?'active':''} style={{background:item}} onClick={()=>setColor(item)}/>)}</div></>}
    {type==='source'&&<><label><span>URL</span><input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://…"/></label><label><span>Why it matters</span><textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="A note for future you"/></label></>}
    {type==='import'&&<label><span>Conversation text</span><textarea className="import-area" value={text} onChange={e=>setText(e.target.value)} placeholder={'You: …\n\nAssistant: …'}/></label>}
    {error&&<p className="form-error">{error}</p>}<div className="modal-actions"><button type="button" className="text-button" onClick={onClose}>Cancel</button><button className="save-memory" disabled={saving||(!name&&type!=='import')}>{saving?<Loader2 className="spin" size={13}/>:<Plus size={13}/>}Create</button></div>
  </form></DialogShell>
}

function SettingsDialog({data,onClose,onProject,onOnboarding}: {data:Bootstrap;onClose:()=>void;onProject:(project:StudioProject)=>void;onOnboarding:()=>void}){
  const [name,setName]=useState(data.project.name);const [description,setDescription]=useState(data.project.description);const [saving,setSaving]=useState(false);
  const save=async()=>{setSaving(true);try{onProject(await studioApi.updateProject(data.project.id,{name,description}));onClose()}finally{setSaving(false)}};
  return <DialogShell onClose={onClose}><div className="modal-heading"><div><p className="eyebrow">Personal studio</p><h2>Settings</h2><span>Your project data is stored locally in <code>.memory/studio.json</code>.</span></div><button className="icon-button" onClick={onClose}><X size={17}/></button></div>
    <label><span>Project name</span><input value={name} onChange={e=>setName(e.target.value)}/></label><label><span>Project description</span><textarea value={description} onChange={e=>setDescription(e.target.value)}/></label><div className="modal-actions"><button className="save-memory" onClick={save} disabled={saving||!name.trim()}>{saving?<Loader2 className="spin" size={13}/>:<Check size={13}/>}Save project</button></div>
    <div className="settings-card"><span className={'status-light '+(data.aiConfigured?'online':'')}/><div><strong>{data.aiConfigured?'NVIDIA NIM is connected':'Local intelligence is active'}</strong><p>{data.aiConfigured?'Conversations and capture use your configured NVIDIA NIM model.':'The product works offline. Connect NVIDIA NIM in the setup guide for richer conversation and extraction.'}</p></div></div>
    <a className="export-button" href="/api/studio/export"><Download size={14}/>Export all personal data</a><button className="export-button replay-setup" onClick={onOnboarding}><CircleHelp size={14}/>Replay setup guide</button>
  </DialogShell>
}

function ArtifactDialog({artifact,onClose,onSave,onDelete}: {artifact:MemoryArtifact;onClose:()=>void;onSave:(item:MemoryArtifact)=>void;onDelete:(id:string)=>void}){
  const [title,setTitle]=useState(artifact.title);const [body,setBody]=useState(artifact.body);const [type,setType]=useState(artifact.type);const [status,setStatus]=useState(artifact.status);const [saving,setSaving]=useState(false);
  const save=async()=>{setSaving(true);try{onSave(await studioApi.updateArtifact(artifact.id,{title,body,type,status}))}finally{setSaving(false)}};
  return <DialogShell onClose={onClose} wide><div className="modal-heading"><div><p className="eyebrow">Project memory</p><h2>Edit what the project remembers</h2><span>Confidence {Math.round(artifact.confidence*100)}% · {artifact.sourceMessageIds.length} source messages</span></div><button className="icon-button" onClick={onClose}><X size={17}/></button></div>
    <div className="artifact-form-row"><label><span>Type</span><select value={type} onChange={e=>setType(e.target.value as ArtifactType)}>{Object.keys(artifactIcons).map(value=><option key={value}>{value}</option>)}</select></label><label><span>Status</span><select value={status} onChange={e=>setStatus(e.target.value as any)}><option>active</option><option>resolved</option><option>archived</option></select></label></div>
    <label><span>Title</span><input value={title} onChange={e=>setTitle(e.target.value)}/></label><label><span>Rationale and context</span><textarea value={body} onChange={e=>setBody(e.target.value)} rows={6}/></label>
    <div className="modal-actions split"><button className="danger-button" onClick={()=>onDelete(artifact.id)}><Trash2 size={13}/>Delete</button><div><button className="text-button" onClick={onClose}>Cancel</button><button className="save-memory" onClick={save} disabled={saving}>{saving?<Loader2 className="spin" size={13}/>:<Check size={13}/>}Save memory</button></div></div>
  </DialogShell>
}

function CaptureDialog({state,onClose,onMemory}: {state:{status:'working'|'done';artifacts:MemoryArtifact[];mode?:string};onClose:()=>void;onMemory:()=>void}){
  return <DialogShell onClose={onClose} wide>{state.status==='working'?<div className="capture-working"><div className="capture-orbit"><span/><Sparkles size={22}/></div><h2>Letting the conversation settle…</h2><p>Finding what changed, what matters, and what should stay with this project.</p></div>:<>
    <div className="modal-heading"><div><span className="capture-complete"><CheckCircle2 size={13}/>Session captured · {state.mode}</span><h2>This is what the project will remember.</h2><span>Open any item later to refine, resolve, archive, or delete it.</span></div><button className="icon-button" onClick={onClose}><X size={17}/></button></div>
    <div className="capture-grid">{state.artifacts.map(item=><div className="captured-item" key={item.id}><span className={'artifact-icon '+artifactClass(item.type)}>{artifactIcons[item.type]}</span><span><small>{item.type}</small><strong>{item.title}</strong><em>{item.body}</em></span></div>)}</div>
    <div className="modal-actions"><button className="text-button" onClick={onClose}>Keep talking</button><button className="save-memory" onClick={onMemory}><Brain size={13}/>View project memory</button></div>
  </>}</DialogShell>
}

function SearchDialog({data,onClose,onResult}: {data:Bootstrap;onClose:()=>void;onResult:(result:SearchResult)=>void}){
  const [query,setQuery]=useState('');const [results,setResults]=useState<SearchResult[]>([]);const [loading,setLoading]=useState(false);
  useEffect(()=>{if(!query.trim()){setResults([]);return}setLoading(true);const timer=window.setTimeout(()=>studioApi.search(query,data.project.id).then(r=>setResults(r.results)).finally(()=>setLoading(false)),180);return()=>window.clearTimeout(timer)},[query,data.project.id]);
  return <motion.div className="modal-backdrop search-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onMouseDown={onClose}><motion.div className="search-modal" onMouseDown={e=>e.stopPropagation()} initial={{opacity:0,y:-10}} animate={{opacity:1,y:0}}>
    <div className="search-input">{loading?<Loader2 className="spin" size={17}/>:<Search size={17}/>}<input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search decisions, conversations, rationale…"/><kbd>esc</kbd></div>
    <div className="search-results"><p>{query?'Found in '+data.project.name:'Try “why did we…” or a remembered phrase'}</p>{results.map(result=><button key={result.kind+result.id} onClick={()=>onResult(result)}><span>{result.kind==='conversation'?<MessageCircleMore size={15}/>:result.kind==='source'?<Link2 size={15}/>:<Sparkles size={15}/>}</span><span><strong>{result.title}</strong><small>{result.snippet||result.meta}</small></span><ArrowRight size={13}/></button>)}{query&&!loading&&!results.length&&<div className="search-empty">Nothing in this project matches yet.</div>}</div>
  </motion.div></motion.div>
}

export default function App(){
  const [surface,setSurface]=useState<Surface>('studio');const [data,setData]=useState<Bootstrap|null>(null);const [session,setSession]=useState<StudioSession|null>(null);
  const [loading,setLoading]=useState(true);const [thinking,setThinking]=useState(false);const [dialog,setDialog]=useState<Dialog>(null);const [search,setSearch]=useState(false);
  const [artifact,setArtifact]=useState<MemoryArtifact|null>(null);const [onboarding,setOnboarding]=useState(()=>localStorage.getItem('creative-memory-onboarding-v1')!=='complete');const [capture,setCapture]=useState<{status:'working'|'done';artifacts:MemoryArtifact[];mode?:string}|null>(null);const [toast,setToast]=useState('');
  const showToast=(message:string)=>{setToast(message);window.setTimeout(()=>setToast(''),2600)};
  const load=async(projectId?:string,sessionId?:string)=>{setLoading(true);try{const next=await studioApi.bootstrap(projectId);setData(next);if(sessionId)setSession(await studioApi.getSession(sessionId));else setSession(next.activeSession)}catch(error:any){showToast(error.message)}finally{setLoading(false)}};
  useEffect(()=>{load()},[]);
  useEffect(()=>{const key=(e:KeyboardEvent)=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setSearch(true)}if((e.metaKey||e.ctrlKey)&&e.shiftKey&&e.key.toLowerCase()==='s'){e.preventDefault();captureSession()}if(e.key==='Escape'){setSearch(false);setDialog(null);setArtifact(null);setCapture(null)}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)});
  const selectProject=async(id:string)=>{await studioApi.setActiveProject(id);await load(id);setSurface('studio')};
  const selectSession=async(id:string)=>{setSession(await studioApi.getSession(id));setSurface('studio')};
  const send=async(text:string)=>{if(!session||!data)return;const temp={id:'temp_'+Date.now(),role:'user' as const,content:text,createdAt:new Date().toISOString(),citedArtifactIds:[]};setSession({...session,messages:[...session.messages,temp]});setThinking(true);try{const result=await studioApi.sendMessage(session.id,text);setSession(current=>current?{...current,messages:[...current.messages.filter(m=>m.id!==temp.id),result.user,result.assistant],updatedAt:result.assistant.createdAt}:current);const fresh=await studioApi.bootstrap(data.project.id);setData(fresh);if(result.mode==='local')showToast('Using local intelligence · connect NVIDIA NIM in Settings for richer responses')}catch(error:any){setSession(session);showToast(error.message)}finally{setThinking(false)}};
  const captureSession=async()=>{if(!session||thinking||!session.messages.length)return;setCapture({status:'working',artifacts:[]});try{const result=await studioApi.capture(session.id);setCapture({status:'done',artifacts:result.artifacts,mode:result.mode});const fresh=await studioApi.bootstrap(data?.project.id);setData(fresh);setSession(await studioApi.getSession(session.id))}catch(error:any){setCapture(null);showToast(error.message)}};
  const completeDialog=async(value:any)=>{const previous=dialog;setDialog(null);if(previous==='project')await load(value.project.id,value.session.id);else if(previous==='session'||previous==='import'){await load(data?.project.id,value.id);setSurface('studio')}else if(previous==='source'){await load(data?.project.id,session?.id);showToast('Source added to project context')}};
  const saveArtifact=async(item:MemoryArtifact)=>{setArtifact(null);await load(data?.project.id,session?.id);showToast('Project memory updated')};
  const deleteArtifact=async(id:string)=>{await studioApi.deleteArtifact(id);setArtifact(null);await load(data?.project.id,session?.id);showToast('Memory removed')};
  const openResult=async(result:SearchResult)=>{setSearch(false);if(result.kind==='conversation'&&result.sessionId)await selectSession(result.sessionId);else if(result.kind==='artifact'){const item=data?.artifacts.find(a=>a.id===result.id);if(item)setArtifact(item);setSurface('memory')}};
  if(loading&&!data)return <div className="app-loading"><Mark/><Loader2 className="spin" size={18}/><span>Opening your studio…</span></div>;
  if(!data)return <div className="app-loading">Could not open the studio.</div>;
  return <div className="app-shell"><Sidebar data={data} surface={surface} onSurface={setSurface} onProject={selectProject} onNewProject={()=>setDialog('project')}/><div className="workspace-shell"><Topbar data={data} onSearch={()=>setSearch(true)} onSettings={()=>setDialog('settings')} onHelp={()=>setOnboarding(true)}/><AnimatePresence mode="wait"><motion.div key={surface} className="surface-wrap" initial={{opacity:0,y:4}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-3}}>
    {surface==='studio'&&<StudioView data={data} session={session} thinking={thinking} onSend={send} onCapture={captureSession} onSession={selectSession} onNewSession={()=>setDialog('session')} onImport={()=>setDialog('import')} onSource={()=>setDialog('source')} onArtifact={setArtifact}/>}
    {surface==='memory'&&<MemoryView data={data} onArtifact={setArtifact}/>}
    {surface==='history'&&<HistoryView data={data} onSession={selectSession} onArtifact={setArtifact}/>}
  </motion.div></AnimatePresence></div>
  <AnimatePresence>
    {dialog&&dialog!=='settings'&&<SimpleDialog type={dialog} data={data} onClose={()=>setDialog(null)} onDone={completeDialog}/>}
    {dialog==='settings'&&<SettingsDialog data={data} onClose={()=>setDialog(null)} onProject={async()=>{await load(data.project.id,session?.id);showToast('Project updated')}} onOnboarding={()=>{setDialog(null);setOnboarding(true)}}/>}
    {artifact&&<ArtifactDialog artifact={artifact} onClose={()=>setArtifact(null)} onSave={saveArtifact} onDelete={deleteArtifact}/>}
    {capture&&<CaptureDialog state={capture} onClose={()=>setCapture(null)} onMemory={()=>{setCapture(null);setSurface('memory')}}/>}
    {search&&<SearchDialog data={data} onClose={()=>setSearch(false)} onResult={openResult}/>}
    {onboarding&&<Onboarding data={data} onClose={()=>setOnboarding(false)} onConfigured={()=>load(data.project.id,session?.id)}/>}
    {toast&&<motion.div className="toast" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0}}>{toast}</motion.div>}
  </AnimatePresence></div>
}
