import React, { useState, useRef, useEffect } from 'react';
import { Project, ProjectStatus } from '../types';
import { ArrowRight, Plus, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ProjectCardProps {
  key?: string;
  project: Project;
  availableCategories: string[];
  onToggleTodo: (projectId: string, todoId: string) => void;
  onAddTodo: (projectId: string, text: string) => void;
  onChangeStatus: (projectId: string, status: ProjectStatus) => void;
  onUpdateProject: (projectId: string, updates: Partial<Project>) => void;
  onDeleteProject: (projectId: string) => void;
}

export function ProjectCard({ project, availableCategories, onToggleTodo, onAddTodo, onChangeStatus, onUpdateProject, onDeleteProject }: ProjectCardProps) {
  const [newTodo, setNewTodo] = useState('');
  const [isAddingTodo, setIsAddingTodo] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editState, setEditState] = useState({
    name: project.name,
    category: project.category,
    description: project.description
  });

  const handleSaveEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdateProject(project.id, editState);
    setIsEditing(false);
  };

  const completedCount = project.todos.filter(t => t.completed).length;
  const totalCount = project.todos.length;
  const remainingTodos = project.todos.filter(t => !t.completed).slice(0, 3);
  const completedTodos = project.todos.filter(t => t.completed).slice(0, Math.max(0, 3 - remainingTodos.length));
  const previewTodos = [...remainingTodos, ...completedTodos].slice(0, 3);

  const getStatusIndicator = (status: string) => {
    switch(status) {
      case 'Active': return 'bg-emerald-500/80';
      case 'Review': return 'bg-amber-400/80';
      case 'Shipped': return 'bg-blue-500/80';
      case 'On Hold': return 'bg-zinc-300';
      default: return 'bg-zinc-300';
    }
  };

  const getStatusColorLight = (status: string) => {
    switch(status) {
      case 'Active': return 'bg-emerald-500/5';
      case 'Review': return 'bg-amber-500/5';
      case 'Shipped': return 'bg-blue-500/5';
      case 'On Hold': return 'bg-zinc-500/5';
      default: return 'bg-zinc-500/5';
    }
  };

  const statuses: ProjectStatus[] = ['Active', 'Review', 'Shipped', 'On Hold'];

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTodo.trim()) {
      onAddTodo(project.id, newTodo);
      setNewTodo('');
      setIsAddingTodo(false);
    }
  };

  if (isEditing) {
    return (
      <motion.div 
        className="group relative flex flex-col bg-white rounded-3xl p-8 shadow-[0_1px_3px_rgba(0,0,0,0.02)] border border-black/[0.03] overflow-hidden"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
      >
        <div className="flex flex-col h-full gap-4 relative z-10">
          <input 
            value={editState.name} 
            onChange={e => setEditState({...editState, name: e.target.value})}
            className="text-lg font-display font-medium text-zinc-900 border-b border-zinc-200 focus:outline-none focus:border-zinc-400 py-1 bg-transparent"
            placeholder="Project Name"
          />
          <select
            value={editState.category}
            onChange={e => setEditState({...editState, category: e.target.value})}
            className="text-[10px] text-zinc-500 font-mono uppercase border border-zinc-200 rounded px-2 py-1.5 focus:outline-none focus:border-zinc-400 bg-transparent"
          >
             {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <textarea
            value={editState.description}
            onChange={e => setEditState({...editState, description: e.target.value})}
            className="text-[13px] text-zinc-500/90 leading-relaxed font-sans border border-zinc-200 rounded-lg p-3 focus:outline-none focus:border-zinc-400 min-h-[100px] resize-none bg-transparent"
            placeholder="Project Description"
          />
          <div className="flex justify-between items-center mt-auto pt-4 border-t border-zinc-100">
            <button 
              onClick={(e) => { e.stopPropagation(); onDeleteProject(project.id); }} 
              className="px-4 py-1.5 text-[11px] font-medium text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
            >
              Delete
            </button>
            <div className="flex gap-2">
              <button 
                onClick={(e) => { e.stopPropagation(); setIsEditing(false); }} 
                className="px-4 py-1.5 text-[11px] font-medium text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveEdit} 
                className="px-4 py-1.5 text-[11px] font-medium bg-zinc-900 text-white rounded-md hover:bg-zinc-800 transition-colors shadow-sm"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="group relative flex flex-col bg-white rounded-3xl p-8 shadow-[0_1px_3px_rgba(0,0,0,0.02)] border border-black/[0.03] hover:shadow-[0_12px_30px_-8px_rgba(0,0,0,0.06),0_4px_12px_-2px_rgba(0,0,0,0.03)] hover:border-black/[0.06] transition-all duration-500 ease-out cursor-pointer overflow-hidden"
      onClick={() => {
        if (!isAddingTodo && !showStatusMenu) {
          window.open(project.url, '_blank', 'noopener,noreferrer');
        }
      }}
    >
      <div className={`absolute -top-24 -right-24 w-48 h-48 rounded-full blur-3xl transition-colors duration-500 pointer-events-none ${getStatusColorLight(project.status)}`} />
      
      <div className="flex justify-between items-start mb-6 relative z-10">
        <div className="flex flex-col gap-1.5 pr-8 min-w-0">
          <span className="text-[10px] text-zinc-400 font-mono tracking-wider uppercase opacity-60 truncate">
            {project.category}
          </span>
          <h3 className="text-lg font-display font-medium text-zinc-900 tracking-tight group-hover:text-zinc-700 transition-colors truncate">
            {project.name}
          </h3>
        </div>
        <div className="relative flex items-center gap-2">
          <button 
            onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
            className="opacity-0 group-hover:opacity-100 p-1 -m-1 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-50 rounded transition-all"
          >
            <Settings size={14} />
          </button>
          <div 
            className="flex items-center gap-2 cursor-pointer p-1 -m-1 hover:bg-zinc-50 rounded ml-1"
            onClick={(e) => {
              e.stopPropagation();
              setShowStatusMenu(!showStatusMenu);
            }}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${getStatusIndicator(project.status)} ${project.status === 'Active' ? 'animate-pulse' : ''}`} />
            <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest">{project.status}</span>
          </div>
          
          <AnimatePresence>
            {showStatusMenu && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 w-32 bg-white rounded-lg shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] border border-zinc-100 py-1 z-10"
              >
                {statuses.map(s => (
                  <button
                    key={s}
                    className="w-full text-left px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 transition-colors flex items-center gap-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      onChangeStatus(project.id, s);
                      setShowStatusMenu(false);
                    }}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${getStatusIndicator(s)}`} />
                    {s}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      
      <p className="text-[13px] text-zinc-500/90 leading-relaxed mb-10 font-sans relative z-10">
        {project.description}
      </p>

      <div className="mt-auto relative z-10">
        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {previewTodos.map(todo => (
                <motion.div 
                  key={todo.id} 
                  initial={{ opacity: 0, height: 0, marginTop: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginTop: 8 }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  transition={{ opacity: { duration: 0.2 }, height: { duration: 0.2 } }}
                  className="flex items-start gap-3 group/todo overflow-hidden first:mt-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleTodo(project.id, todo.id);
                  }}
                >
                  <button className="mt-[3px] text-zinc-300 group-hover/todo:text-zinc-400 transition-colors focus:outline-none shrink-0">
                    {todo.completed ? (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="0.5" y="0.5" width="11" height="11" rx="2.5" fill="currentColor" fillOpacity="0.2" stroke="currentColor"/>
                        <path d="M3.5 6L5.5 8L8.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-60 group-hover/todo:opacity-100 transition-opacity">
                        <rect x="0.5" y="0.5" width="11" height="11" rx="2.5" stroke="currentColor" strokeWidth="1"/>
                      </svg>
                    )}
                  </button>
                  <span className={`text-xs leading-relaxed ${todo.completed ? 'text-zinc-400 line-through decoration-zinc-200/60' : 'text-zinc-600'}`}>
                    {todo.text}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>

            {isAddingTodo ? (
              <form 
                onSubmit={handleAddSubmit} 
                className="flex items-center gap-2 mt-2"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="text"
                  autoFocus
                  value={newTodo}
                  onChange={(e) => setNewTodo(e.target.value)}
                  placeholder="Type a new task..."
                  className="w-full text-xs text-zinc-700 bg-transparent border-b border-zinc-200/60 px-0 py-1 focus:outline-none focus:border-zinc-400 transition-colors placeholder:text-zinc-400"
                  onBlur={() => {
                    if (!newTodo.trim()) setIsAddingTodo(false);
                  }}
                />
              </form>
            ) : (
              <button
                className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-600 transition-colors mt-2 py-1 group/add"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsAddingTodo(true);
                }}
              >
                <Plus size={12} className="group-hover/add:rotate-90 transition-transform duration-300" />
                <span>Add Task</span>
              </button>
            )}
          </div>

          <div className="flex justify-between items-end mt-4 pt-4 border-t border-zinc-50">
            <span className="text-[11px] font-medium text-zinc-400">
              {totalCount > 0 ? `${completedCount} / ${totalCount} complete` : ''}
            </span>
            <div className="flex items-center text-[11px] font-medium text-zinc-400 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
              <span>Open Project</span>
              <ArrowRight size={12} className="ml-1" />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
