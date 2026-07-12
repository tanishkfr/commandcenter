export interface ActiveContext {
  currentWorkspace: string | null;
  currentProject: string | null;
  currentCategory: string | null;
  lastReferencedTodo: string | null;
  lastReferencedInboxItem: string | null;
}

let context: ActiveContext = {
  currentWorkspace: null,
  currentProject: null,
  currentCategory: null,
  lastReferencedTodo: null,
  lastReferencedInboxItem: null,
};

export const contextManager = {
  getContext: (): ActiveContext => ({ ...context }),
  
  updateContext: (updates: Partial<ActiveContext>) => {
    context = { ...context, ...updates };
  },
  
  setCurrentWorkspace: (id: string | null) => context.currentWorkspace = id,
  setCurrentProject: (id: string | null) => context.currentProject = id,
  setCurrentCategory: (id: string | null) => context.currentCategory = id,
  setLastReferencedTodo: (id: string | null) => context.lastReferencedTodo = id,
  setLastReferencedInboxItem: (id: string | null) => context.lastReferencedInboxItem = id,
  
  clearContext: () => {
    context = {
      currentWorkspace: null,
      currentProject: null,
      currentCategory: null,
      lastReferencedTodo: null,
      lastReferencedInboxItem: null,
    };
  }
};
