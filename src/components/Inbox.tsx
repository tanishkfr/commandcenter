import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Inbox as InboxIcon, X, Plus } from 'lucide-react';

export function InboxPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<any[]>([]);

  const loadInbox = async () => {
    try {
      const res = await fetch('/api/inbox');
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadInbox();
    }
    const handleDataChange = () => {
      if (isOpen) loadInbox();
    };
    window.addEventListener('workspace-data-changed', handleDataChange);
    return () => window.removeEventListener('workspace-data-changed', handleDataChange);
  }, [isOpen]);

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 left-6 w-14 h-14 bg-white text-zinc-900 border border-zinc-200 rounded-full flex items-center justify-center shadow-lg hover:bg-zinc-50 transition-transform hover:scale-105 z-40"
      >
        <InboxIcon size={24} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-zinc-900/20 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 bottom-0 w-80 bg-white border-r border-zinc-200 shadow-2xl z-50 flex flex-col"
            >
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <InboxIcon size={20} className="text-zinc-400" />
                  <h2 className="font-display font-medium text-lg">Inbox</h2>
                </div>
                <button onClick={() => setIsOpen(false)} className="text-zinc-400 hover:text-zinc-900 transition-colors">
                  <X size={20} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                {items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-zinc-400 gap-2">
                    <InboxIcon size={32} className="opacity-20" />
                    <span className="text-sm">Inbox is empty</span>
                    <span className="text-xs text-center px-4">Use the Command Palette to add ideas here.</span>
                  </div>
                ) : (
                  items.map(item => (
                    <div key={item.id} className="p-4 bg-zinc-50 border border-zinc-100 rounded-xl hover:border-zinc-300 transition-colors cursor-default group">
                      <p className="text-sm text-zinc-700">{item.text}</p>
                      <div className="mt-3 text-[10px] font-mono text-zinc-400 flex justify-between items-center">
                        <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
