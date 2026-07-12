import React, { useState, useEffect } from 'react';
import { workspaces } from '../data';
import { ProjectCard } from './ProjectCard';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, ChevronUp, ChevronDown, Edit2, Check, X } from 'lucide-react';
import { Workspace, ProjectStatus, Project } from '../types';

function CategorySection({
  category,
  projects,
  isFirst,
  isLast,
  availableCategories,
  onAddProject,
  onRename,
  onDelete,
  onMove,
  projectCardProps
}: any) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(category);

  const handleSave = () => {
    onRename(category, editName);
    setIsEditing(false);
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-8 group/header">
        {isEditing ? (
          <div className="flex items-center gap-2 flex-1">
            <input 
              value={editName}
              onChange={e => setEditName(e.target.value)}
              className="text-[11px] font-mono font-medium tracking-[0.1em] text-zinc-900 uppercase border-b border-zinc-300 focus:outline-none focus:border-zinc-500 bg-transparent px-1 py-0.5 w-full max-w-[200px]"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleSave()}
            />
            <button onClick={handleSave} className="text-zinc-400 hover:text-emerald-500 transition-colors p-1"><Check size={14} /></button>
            <button onClick={() => { setIsEditing(false); setEditName(category); }} className="text-zinc-400 hover:text-red-500 transition-colors p-1"><X size={14} /></button>
          </div>
        ) : (
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <h2 className="text-[11px] font-mono font-medium tracking-[0.1em] text-zinc-400 uppercase truncate">
              {category}
            </h2>
            <div className="flex items-center gap-1 opacity-0 group-hover/header:opacity-100 transition-opacity shrink-0">
              <button onClick={() => setIsEditing(true)} className="text-zinc-400 hover:text-zinc-700 p-1 rounded hover:bg-zinc-100" title="Rename"><Edit2 size={12} /></button>
              {!isFirst && <button onClick={() => onMove(category, 'up')} className="text-zinc-400 hover:text-zinc-700 p-1 rounded hover:bg-zinc-100" title="Move Up"><ChevronUp size={12} /></button>}
              {!isLast && <button onClick={() => onMove(category, 'down')} className="text-zinc-400 hover:text-zinc-700 p-1 rounded hover:bg-zinc-100" title="Move Down"><ChevronDown size={12} /></button>}
              <button onClick={() => onDelete(category)} className="text-zinc-400 hover:text-red-500 p-1 rounded hover:bg-red-50" title="Delete Section"><Trash2 size={12} /></button>
            </div>
          </div>
        )}
        <button 
          onClick={() => onAddProject(category)}
          className="flex items-center gap-1 text-[10px] font-medium text-zinc-400 hover:text-zinc-700 uppercase tracking-widest transition-colors ml-4 shrink-0"
        >
          <Plus size={12} />
          <span>New</span>
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        {projects.map((project: any) => (
          <ProjectCard 
            key={project.id}
            project={project} 
            availableCategories={availableCategories}
            {...projectCardProps}
          />
        ))}
        {projects.length === 0 && (
          <div className="col-span-full py-12 text-center border border-dashed border-zinc-200 rounded-2xl text-[13px] text-zinc-400 flex flex-col items-center gap-2">
            <span>No projects in this section yet.</span>
            <button onClick={() => onAddProject(category)} className="text-zinc-600 hover:text-zinc-900 font-medium underline underline-offset-4 decoration-zinc-300 hover:decoration-zinc-900 transition-all">Add your first project</button>
          </div>
        )}
      </div>
    </section>
  );
}

export function Dashboard() {
  const [workspaceList, setWorkspaceList] = useState<Workspace[]>(() => {
    const saved = localStorage.getItem('portfolio-workspaces');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Workspace[];
        return parsed.map(p => {
          const defaultWs = workspaces.find(w => w.id === p.id);
          return { ...p, color: defaultWs?.color || p.color };
        });
      } catch (e) {
        return workspaces;
      }
    }
    return workspaces;
  });

  const [activeWorkspaceId, setActiveWorkspaceId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('workspace') || workspaces[0].id;
  });

  const [time, setTime] = useState(new Date());

  useEffect(() => {
    localStorage.setItem('portfolio-workspaces', JSON.stringify(workspaceList));
  }, [workspaceList]);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get('workspace')) {
        setActiveWorkspaceId(params.get('workspace')!);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleWorkspaceChange = (id: string) => {
    setActiveWorkspaceId(id);
    const url = new URL(window.location.href);
    url.searchParams.set('workspace', id);
    window.history.pushState({}, '', url);
  };

  const updateProjectInWorkspace = (workspaceId: string, projectId: string, updater: (p: Project) => Project) => {
    setWorkspaceList(prev => prev.map(w => {
      if (w.id === workspaceId) {
        return {
          ...w,
          projects: w.projects.map(p => p.id === projectId ? updater(p) : p)
        };
      }
      return w;
    }));
  };

  const handleToggleTodo = (projectId: string, todoId: string) => {
    updateProjectInWorkspace(activeWorkspaceId, projectId, p => ({
      ...p,
      todos: p.todos.map(t => t.id === todoId ? { ...t, completed: !t.completed } : t)
    }));
  };

  const handleAddTodo = (projectId: string, text: string) => {
    if (!text.trim()) return;
    updateProjectInWorkspace(activeWorkspaceId, projectId, p => ({
      ...p,
      todos: [...p.todos, { id: crypto.randomUUID(), text, completed: false }]
    }));
  };

  const handleChangeStatus = (projectId: string, newStatus: ProjectStatus) => {
    updateProjectInWorkspace(activeWorkspaceId, projectId, p => ({ ...p, status: newStatus }));
  };

  const handleUpdateProject = (projectId: string, updates: Partial<Project>) => {
    updateProjectInWorkspace(activeWorkspaceId, projectId, p => ({ ...p, ...updates }));
  };

  const handleDeleteProject = (projectId: string) => {
    setWorkspaceList(prev => prev.map(w => {
      if (w.id === activeWorkspaceId) {
        return {
          ...w,
          projects: w.projects.filter(p => p.id !== projectId)
        };
      }
      return w;
    }));
  };

  const handleRenameCategory = (oldName: string, newName: string) => {
    if (!newName.trim() || oldName === newName || activeWorkspace.categories.includes(newName)) return;
    
    setWorkspaceList(prev => prev.map(w => {
      if (w.id === activeWorkspaceId) {
        return {
          ...w,
          categories: w.categories.map(c => c === oldName ? newName : c),
          projects: w.projects.map(p => p.category === oldName ? { ...p, category: newName } : p)
        };
      }
      return w;
    }));
  };

  const handleDeleteCategory = (category: string) => {
    setWorkspaceList(prev => prev.map(w => {
      if (w.id === activeWorkspaceId) {
        return {
          ...w,
          categories: w.categories.filter(c => c !== category),
          projects: w.projects.filter(p => p.category !== category)
        };
      }
      return w;
    }));
  };

  const handleMoveCategory = (category: string, direction: 'up' | 'down') => {
    setWorkspaceList(prev => prev.map(w => {
      if (w.id === activeWorkspaceId) {
        const idx = w.categories.indexOf(category);
        if (direction === 'up' && idx > 0) {
          const newCats = [...w.categories];
          [newCats[idx - 1], newCats[idx]] = [newCats[idx], newCats[idx - 1]];
          return { ...w, categories: newCats };
        } else if (direction === 'down' && idx < w.categories.length - 1) {
          const newCats = [...w.categories];
          [newCats[idx + 1], newCats[idx]] = [newCats[idx], newCats[idx + 1]];
          return { ...w, categories: newCats };
        }
      }
      return w;
    }));
  };

  const handleAddCategory = () => {
    let newName = "New Section";
    let counter = 1;
    while (activeWorkspace?.categories.includes(newName)) {
      newName = `New Section ${counter}`;
      counter++;
    }
    
    setWorkspaceList(prev => prev.map(w => {
      if (w.id === activeWorkspaceId) {
        return { ...w, categories: [...w.categories, newName] };
      }
      return w;
    }));
  };

  const handleAddProject = (category: string) => {
    const newProject: Project = {
      id: crypto.randomUUID(),
      name: 'New Project',
      description: 'Project description goes here.',
      category,
      status: 'Active',
      url: '',
      todos: [],
    };
    
    setWorkspaceList(prev => prev.map(w => {
      if (w.id === activeWorkspaceId) {
        return {
          ...w,
          projects: [...w.projects, newProject]
        };
      }
      return w;
    }));
  };

  const allProjects = workspaceList.flatMap(w => w.projects);
  const activeCount = allProjects.filter(p => p.status === 'Active').length;
  const reviewCount = allProjects.filter(p => p.status === 'Review').length;
  const tasksRemaining = allProjects.reduce((acc, p) => acc + p.todos.filter(t => !t.completed).length, 0);

  const activeWorkspace = workspaceList.find(w => w.id === activeWorkspaceId) || workspaceList[0];

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-zinc-900 font-sans selection:bg-zinc-200 selection:text-zinc-900 box-border relative">
      {/* Subtle canvas dot grid */}
      <div 
        className="absolute inset-0 z-0 pointer-events-none" 
        style={{ 
          backgroundImage: 'radial-gradient(circle, #e4e4e7 1px, transparent 1px)', 
          backgroundSize: '24px 24px', 
          opacity: 0.6 
        }}
      />
      {/* Soft vignette fade */}
      <div className="fixed inset-0 z-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,#FAFAFA_100%)] opacity-80" />
      
      <div className="relative z-10 max-w-4xl mx-auto p-8 md:p-16 lg:p-24">
        
        {/* Header & Overview */}
        <header className="mb-16 flex flex-col items-start gap-8">
          <div className="w-full flex justify-between items-start">
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            >
              <h1 className="text-3xl md:text-4xl font-display font-semibold tracking-tight text-zinc-900 mb-3">
                Command Center
              </h1>
              <p className="text-[13px] md:text-sm text-zinc-500 tracking-wide font-sans">Creative Studio Operating System</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 0.2 }}
              className="hidden md:flex flex-col items-end text-xs text-zinc-400 font-mono tracking-widest uppercase"
            >
              <span>{time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}</span>
              <span className="mt-1">{time.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
            </motion.div>
          </div>

          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-wrap items-center gap-6 text-[11px] font-medium text-zinc-500"
          >
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80 animate-pulse" />
              <span>{activeCount} Active</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-300" />
              <span>{allProjects.length} Projects</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-300" />
              <span>{tasksRemaining} Tasks Remaining</span>
            </div>
            {reviewCount > 0 && (
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400/80" />
                <span>{reviewCount} in Review</span>
              </div>
            )}
          </motion.div>
        </header>

        {/* Workspace Switcher */}
        <motion.div 
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex items-center gap-1.5 mb-16 bg-zinc-200/40 p-1.5 rounded-[14px] border border-zinc-200/50 w-fit backdrop-blur-sm relative z-20"
        >
          {workspaceList.map(ws => (
            <button
              key={ws.id}
              onClick={() => handleWorkspaceChange(ws.id)}
              className={`px-6 py-2 rounded-[10px] text-[13px] font-medium transition-all duration-500 ease-out relative overflow-hidden border ${
                activeWorkspaceId === ws.id 
                  ? 'bg-white border-black/5' 
                  : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200/30 border-transparent'
              }`}
              style={
                activeWorkspaceId === ws.id
                  ? {
                      color: ws.color || '#18181B', // zinc-900 fallback
                      boxShadow: ws.color 
                        ? `0 8px 24px -6px ${ws.color}30, 0 2px 6px -2px rgba(0,0,0,0.04)` 
                        : '0 2px 8px -2px rgba(0,0,0,0.08)',
                    }
                  : {}
              }
            >
              {activeWorkspaceId === ws.id && ws.color && (
                <div 
                  className="absolute inset-0 opacity-[0.08] pointer-events-none transition-opacity duration-500" 
                  style={{ backgroundColor: ws.color }}
                />
              )}
              <span className="relative z-10">{ws.name}</span>
            </button>
          ))}
        </motion.div>

        {/* Workspace Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeWorkspace.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="space-y-32"
          >
            {activeWorkspace.categories.map((category, idx) => {
              const categoryProjects = activeWorkspace.projects.filter(p => p.category === category);

              return (
                <CategorySection
                  key={category}
                  category={category}
                  projects={categoryProjects}
                  isFirst={idx === 0}
                  isLast={idx === activeWorkspace.categories.length - 1}
                  availableCategories={activeWorkspace.categories}
                  onAddProject={handleAddProject}
                  onRename={handleRenameCategory}
                  onDelete={handleDeleteCategory}
                  onMove={handleMoveCategory}
                  projectCardProps={{
                    onToggleTodo: handleToggleTodo,
                    onAddTodo: handleAddTodo,
                    onChangeStatus: handleChangeStatus,
                    onUpdateProject: handleUpdateProject,
                    onDeleteProject: handleDeleteProject,
                  }}
                />
              );
            })}

            <div className="flex justify-center pt-8 border-t border-zinc-200/50">
              <button 
                onClick={handleAddCategory}
                className="flex items-center gap-2 px-4 py-2 rounded-[10px] text-[13px] font-medium text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-all"
              >
                <Plus size={14} />
                <span>Add New Section</span>
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
        
      </div>
    </div>
  );
}
