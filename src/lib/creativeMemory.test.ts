import { describe, expect, it } from 'vitest';
import { createFreshState } from './creativeMemory';

describe('fresh studio state',()=>{
  it('starts with one blank project and no retained creative history',()=>{
    const state=createFreshState();
    expect(state.projects).toHaveLength(1);
    expect(state.projects[0]).toMatchObject({id:'my-first-project',name:'My first project'});
    expect(state.sessions).toHaveLength(1);
    expect(state.sessions[0].messages).toEqual([]);
    expect(state.artifacts).toEqual([]);
    expect(state.sources).toEqual([]);
    expect(state.events).toEqual([]);
  });
});
