import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Command, CornerDownLeft, Clock, X, Check, ArrowRight, RotateCcw, AlertCircle, Sparkles } from 'lucide-react';

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [context, setContext] = useState<any>({});
  const [debouncedInput, setDebouncedInput] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Custom fetch states
  const [previewData, setPreviewData] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  
  const [isExecuting, setIsExecuting] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && isOpen) {
        if (historyOpen) setHistoryOpen(false);
        else setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, historyOpen]);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedInput(input);
    }, 300);
    return () => clearTimeout(timer);
  }, [input]);

  useEffect(() => {
    if (!debouncedInput || historyOpen) {
      setPreviewData(null);
      setPreviewError(null);
      return;
    }
    
    let isMounted = true;
    const fetchPreview = async () => {
      setPreviewLoading(true);
      setPreviewError(null);
      try {
        const res = await fetch('/api/command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: debouncedInput, dryRun: true })
        });
        if (!isMounted) return;
        
        if (!res.ok) {
          const errData = await res.json();
          if (errData.options) {
            setPreviewData(errData); // Handle ambiguous options
            setPreviewError(null);
          } else {
            setPreviewError(errData.reason || 'Failed to parse command');
            setPreviewData(null);
          }
        } else {
          const data = await res.json();
          setPreviewData(data);
          setPreviewError(null);
        }
      } catch (err: any) {
        if (!isMounted) return;
        setPreviewError(err.message);
      } finally {
        if (isMounted) setPreviewLoading(false);
      }
    };
    fetchPreview();
    
    return () => { isMounted = false; };
  }, [debouncedInput, historyOpen]);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch('/api/history');
      if (res.ok) {
        const data = await res.json();
        setHistoryData(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (historyOpen) {
      loadHistory();
    }
  }, [historyOpen]);

  const executeCommand = async () => {
    if (isExecuting) return;
    setIsExecuting(true);
    try {
      const res = await fetch('/api/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: debouncedInput })
      });
      if (res.ok) {
        setInput('');
        setDebouncedInput('');
        setIsOpen(false);
        // Dispatch custom event to tell Dashboard to reload data
        window.dispatchEvent(new CustomEvent('workspace-data-changed'));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsExecuting(false);
    }
  };

  const undoCommand = async (logId: string) => {
    if (isUndoing) return;
    setIsUndoing(true);
    try {
      const res = await fetch('/api/undo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logId })
      });
      if (res.ok) {
        window.dispatchEvent(new CustomEvent('workspace-data-changed'));
        loadHistory(); // Reload history after undo
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsUndoing(false);
    }
  };

  
  useEffect(() => {
    const fetchContext = async () => {
      try {
        const res = await fetch('/api/context');
        if (res.ok) setContext(await res.json());
      } catch (e) {}
    };
    if (isOpen) {
      fetchContext();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const renderPreviewContent = () => {
    if (previewLoading) {
       return <div className="p-4 text-sm text-gray-500 font-mono">Parsing command...</div>;
    }
    
    if (previewError) {
      return (
        <div className="p-4">
          <div className="flex items-center gap-2 text-amber-500 mb-2">
            <AlertCircle size={16} />
            <span className="text-sm font-medium">Ambiguous or Unknown Command</span>
          </div>
          <p className="text-sm text-gray-400 font-mono">{previewError}</p>
        </div>
      );
    }
    
    if (!previewData) return null;
    
    if (previewData.options) {
      return (
        <div className="p-4 flex flex-col gap-4">
          <div className="text-sm font-medium text-amber-500 mb-2">Ambiguous: {previewData.reason}</div>
          <div className="flex flex-col gap-2">
            {previewData.options.map((opt: string, i: number) => (
               <button 
                 key={i} 
                 onClick={() => {
                   const newInput = input.replace(/(project |in |to |from |['"])(.+?)(['"]|$)/, `$1'${opt}'$3`);
                   setInput(newInput);
                 }}
                 className="text-left px-3 py-2 text-sm text-gray-300 hover:text-white bg-gray-800/50 hover:bg-gray-800 rounded transition-colors"
               >
                 {opt}
               </button>
            ))}
          </div>
        </div>
      );
    }
    
    const { action, changes } = previewData;
    
    return (
      <div className="p-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
           <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Action</div>
           <div className="text-sm font-medium text-white">{action}</div>
        </div>
        
        {changes && (
           <div className="flex flex-col gap-1">
             <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Description</div>
             <div className="text-sm text-gray-300">{changes.description}</div>
           </div>
        )}
        
        <div className="mt-2 pt-4 border-t border-gray-800 flex justify-between items-center">
           <span className="text-xs text-gray-500 font-mono">
             Press Enter to confirm
           </span>
           <button 
             onClick={executeCommand}
             disabled={isExecuting}
             className="px-3 py-1.5 bg-white text-black text-xs font-medium rounded-md hover:bg-gray-200 transition-colors flex items-center gap-2"
           >
             {isExecuting ? 'Executing...' : 'Confirm'}
             <CornerDownLeft size={14} />
           </button>
        </div>
      </div>
    );
  };
  
  const renderHistoryContent = () => {
    if (historyLoading) return <div className="p-4 text-sm text-gray-500">Loading history...</div>;
    if (!historyData?.length) return <div className="p-4 text-sm text-gray-500">No command history</div>;
    
    return (
      <div className="max-h-96 overflow-y-auto">
        <div className="p-2 border-b border-gray-800 sticky top-0 bg-[#1A1A1A] z-10 flex justify-between items-center">
           <span className="text-xs text-gray-500 font-mono uppercase tracking-wider">Command Log</span>
           <button onClick={() => setHistoryOpen(false)} className="text-gray-400 hover:text-white">
             <X size={14} />
           </button>
        </div>
        <div className="flex flex-col">
          {historyData.map((item: any, i: number) => (
            <HistoryItem key={i} item={item} onUndo={(logId) => undoCommand(logId)} isUndoing={isUndoing} />
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Floating Action Button */}
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-[#1A1A1A] text-white border border-gray-800 rounded-full flex items-center justify-center shadow-2xl hover:bg-black transition-transform hover:scale-105 z-40"
      >
        <Sparkles size={24} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-2xl bg-[#1A1A1A] border border-gray-800 rounded-xl shadow-2xl overflow-hidden flex flex-col"
            >
              {!historyOpen ? (
                <>
                  {/* Search Input */}
                  <div className="flex items-center px-4 h-16 border-b border-gray-800 bg-[#1f1f1f]">
                    <Search className="text-gray-400 mr-3" size={20} />
                    <input
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && previewData) {
                           executeCommand();
                        }
                      }}
                      placeholder="Ask the assistant..."
                      className="flex-1 bg-transparent border-none outline-none text-lg text-white placeholder-gray-500 font-sans"
                    />
                    <div className="flex items-center gap-2">
                       <button 
                         onClick={() => setHistoryOpen(true)}
                         className="p-2 text-gray-400 hover:text-white rounded-md hover:bg-gray-800 transition-colors"
                         title="View History"
                       >
                         <Clock size={16} />
                       </button>
                       <div className="flex items-center gap-1 text-xs text-gray-500 font-mono bg-gray-800/50 px-2 py-1 rounded">
                         <span>esc</span>
                       </div>
                    </div>
                  </div>
                  
                  {/* Preview Area */}
                  {input && (
                     <div className="bg-[#141414] min-h-[120px]">
                       {renderPreviewContent()}
                     </div>
                  )}
                  
                  {/* Empty state hints */}
                  {!input && (
                    <div className="p-4 text-xs text-gray-500 flex flex-col gap-2 font-mono">
                       <div>Try commands like:</div>
                       <div className="text-gray-400">→ "Rewrite the onboarding in Daynero"</div>
                       <div className="text-gray-400">→ "Remember to check the case study this week"</div>
                       <div className="text-gray-400">→ "Move task x to Atlas"</div>
                    </div>
                  )}
                </>
              ) : (
                renderHistoryContent()
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

function HistoryItem({ item, onUndo, isUndoing }: { key?: string | number, item: any, onUndo: (id: string) => void | Promise<void>, isUndoing: boolean }) {
  const [expanded, setExpanded] = useState(false);
  
  const success = item.result?.success;
  
  return (
    <div className="border-b border-gray-800/50 last:border-0 text-sm">
      <div 
        className="p-3 hover:bg-gray-800/30 cursor-pointer flex items-center justify-between transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
           <div className={`p-1.5 rounded-full ${success ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
             {success ? <Check size={14} /> : <X size={14} />}
           </div>
           <div>
             <div className="text-gray-200">{item.parsedAction}</div>
             <div className="text-xs text-gray-500 font-mono">{new Date(item.timestamp).toLocaleTimeString()}</div>
           </div>
        </div>
        
        {success && item.result?.logId && (
          <button 
            onClick={(e) => { e.stopPropagation(); onUndo(item.result.logId); }}
            disabled={isUndoing}
            className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-gray-700 transition-colors"
            title="Undo"
          >
            <RotateCcw size={14} />
          </button>
        )}
      </div>
      
      {expanded && (
        <div className="px-10 pb-4 pt-1 bg-black/20 text-xs font-mono flex flex-col gap-2">
           <div className="grid grid-cols-3 gap-2 text-gray-400">
             <div className="text-gray-500 uppercase">Input</div>
             <div className="col-span-2 text-gray-300">"{item.command}"</div>
           </div>
           {item.result?.changes && (
             <div className="grid grid-cols-3 gap-2 text-gray-400">
               <div className="text-gray-500 uppercase">Changes</div>
               <div className="col-span-2 text-gray-300">{item.result.changes.description}</div>
             </div>
           )}
           <div className="grid grid-cols-3 gap-2 text-gray-400">
             <div className="text-gray-500 uppercase">Duration</div>
             <div className="col-span-2 text-gray-300">{item.duration}ms</div>
           </div>
        </div>
      )}
    </div>
  );
}
