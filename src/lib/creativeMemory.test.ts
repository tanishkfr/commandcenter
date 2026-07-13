import { describe, expect, it } from 'vitest';
import { createFreshState, findRelatedArtifactIds, normalizeCreativeMemoryState, type MemoryArtifact } from './creativeMemory';

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

  it('migrates existing memory into the reviewed provenance model',()=>{
    const state=createFreshState();
    state.artifacts=[{id:'legacy',projectId:state.projects[0].id,sessionId:null,type:'decision',title:'Legacy direction',body:'Keep it quiet',status:'active',tags:[],confidence:.8,sourceMessageIds:[],createdAt:'2025-01-01',updatedAt:'2025-01-01'} as MemoryArtifact];
    const normalized=normalizeCreativeMemoryState(state);
    expect(normalized.version).toBe(2);
    expect(normalized.artifacts[0]).toMatchObject({reviewStatus:'accepted',origin:'manual',relatedArtifactIds:[]});
  });

  it('flags a new direction when it overlaps reviewed project memory',()=>{
    const existing={id:'old',projectId:'atlas',sessionId:null,type:'decision',title:'Use ambient light for spatial wayfinding',body:'Ambient light carries orientation',status:'active',reviewStatus:'accepted',origin:'manual',relatedArtifactIds:[],tags:[],confidence:.9,sourceMessageIds:[],createdAt:'2025-01-01',updatedAt:'2025-01-01'} satisfies MemoryArtifact;
    const candidate={...existing,id:'new',title:'Replace ambient light for spatial wayfinding',body:'Directional sound should carry orientation'};
    expect(findRelatedArtifactIds(candidate,[existing])).toEqual(['old']);
  });
});
