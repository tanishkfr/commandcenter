import React, { useState, useEffect } from 'react';
import { projects } from '../data';
import { ProjectCard } from './ProjectCard';
import { motion } from 'motion/react';
import { ProjectCategory, ProjectStatus } from '../types';

export function Dashboard() {
  const [projectList, setProjectList] = useState(() => {
    const saved = localStorage.getItem('portfolio-projects');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return projects;
      }
    }
    return projects;
  });
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    localStorage.setItem('portfolio-projects', JSON.stringify(projectList));
  }, [projectList]);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleToggleTodo = (projectId: string, todoId: string) => {
    setProjectList(prev => prev.map(p => {
      if (p.id === projectId) {
        return {
          ...p,
          todos: p.todos.map(t => t.id === todoId ? { ...t, completed: !t.completed } : t)
        };
      }
      return p;
    }));
  };

  const handleAddTodo = (projectId: string, text: string) => {
    if (!text.trim()) return;
    setProjectList(prev => prev.map(p => {
      if (p.id === projectId) {
        return {
          ...p,
          todos: [...p.todos, { id: crypto.randomUUID(), text, completed: false }]
        };
      }
      return p;
    }));
  };

  const handleChangeStatus = (projectId: string, newStatus: ProjectStatus) => {
    setProjectList(prev => prev.map(p => {
      if (p.id === projectId) {
        return { ...p, status: newStatus };
      }
      return p;
    }));
  };

  const activeCount = projectList.filter(p => p.status === 'Active').length;
  const reviewCount = projectList.filter(p => p.status === 'Review').length;
  const tasksRemaining = projectList.reduce((acc, p) => acc + p.todos.filter(t => !t.completed).length, 0);
  
  const categories: ProjectCategory[] = ['Products', 'Research', 'Systems', 'Tools'];

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
        <header className="mb-32 flex flex-col items-start gap-8">
          <div className="w-full flex justify-between items-start">
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            >
              <h1 className="text-3xl md:text-4xl font-display font-semibold tracking-tight text-zinc-900 mb-3">
                Tanishk's Portfolio
              </h1>
              <p className="text-[13px] md:text-sm text-zinc-500 tracking-wide font-sans">Selected Works & Interactions</p>
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
              <span>{projectList.length} Total Projects</span>
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

        {/* Categories */}
        <div className="space-y-32">
          {categories.map((category, idx) => {
            const categoryProjects = projectList.filter(p => p.category === category);
            if (categoryProjects.length === 0) return null;

            return (
              <motion.section 
                key={category}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.2 + (idx * 0.1), ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="mb-8">
                  <h2 className="text-[11px] font-mono font-medium tracking-[0.1em] text-zinc-400 uppercase">
                    {category}
                  </h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                  {categoryProjects.map(project => (
                    <ProjectCard 
                      key={project.id}
                      project={project} 
                      onToggleTodo={handleToggleTodo}
                      onAddTodo={handleAddTodo}
                      onChangeStatus={handleChangeStatus}
                    />
                  ))}
                </div>
              </motion.section>
            );
          })}
        </div>
        
      </div>
    </div>
  );
}
