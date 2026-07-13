import { describe, expect, it } from 'vitest';
import { applyArtifactSupersession, createFreshState, findRelatedArtifactIds, normalizeCreativeMemoryState, releaseArtifactSupersession, type MemoryArtifact } from './creativeMemory';

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
    expect(normalized.version).toBe(4);
    expect(normalized.artifacts[0]).toMatchObject({reviewStatus:'accepted',origin:'manual',relatedArtifactIds:[],supersedesArtifactIds:[],supersededByArtifactId:null});
  });


  it('replaces the untouched three-project demo with a blank first workspace',()=>{
    const timestamp='2026-01-01T00:00:00.000Z';
    const demo={version:3,activeProjectId:'atlas',projects:[
      {id:'atlas',name:'Atlas',description:'Exploring spatial wayfinding without demanding attention.',color:'#111',createdAt:timestamp,updatedAt:timestamp},
      {id:'pentimento',name:'Pentimento',description:'A living record of how creative work changes.',color:'#222',createdAt:timestamp,updatedAt:timestamp},
      {id:'invisible-interfaces',name:'Invisible Interfaces',description:'Designing systems that know when to disappear.',color:'#333',createdAt:timestamp,updatedAt:timestamp}
    ],sessions:[{id:'session_welcome',projectId:'atlas',title:'Welcome',createdAt:timestamp,updatedAt:timestamp,capturedAt:null,messages:[
      {id:'msg_welcome_user',role:'user' as const,content:'Demo',createdAt:timestamp,citedArtifactIds:[]},
      {id:'msg_welcome_studio',role:'assistant' as const,content:'Demo',createdAt:timestamp,citedArtifactIds:[]}
    ]}],artifacts:[],sources:[],events:[]};
    const normalized=normalizeCreativeMemoryState(demo);
    expect(normalized).toMatchObject({version:4,activeProjectId:'my-first-project'});
    expect(normalized.projects.map(project=>project.name)).toEqual(['My first project']);
    expect(normalized.sessions[0].messages).toEqual([]);
  });

  it('gives every migrated project an accessible first conversation',()=>{
    const state=createFreshState();
    state.projects.push({id:'orphan',name:'Orphan project',description:'',color:'#333',createdAt:'2026-01-01',updatedAt:'2026-01-01'});
    const normalized=normalizeCreativeMemoryState(state);
    expect(normalized.sessions.find(session=>session.projectId==='orphan')).toMatchObject({title:'First conversation',messages:[]});
  });

  it('flags a new direction when it overlaps reviewed project memory',()=>{
    const existing={id:'old',projectId:'atlas',sessionId:null,type:'decision',title:'Use ambient light for spatial wayfinding',body:'Ambient light carries orientation',status:'active',reviewStatus:'accepted',origin:'manual',relatedArtifactIds:[],supersedesArtifactIds:[],supersededByArtifactId:null,tags:[],confidence:.9,sourceMessageIds:[],createdAt:'2025-01-01',updatedAt:'2025-01-01'} satisfies MemoryArtifact;
    const candidate={...existing,id:'new',title:'Replace ambient light for spatial wayfinding',body:'Directional sound should carry orientation'};
    expect(findRelatedArtifactIds(candidate,[existing])).toEqual(['old']);
  });

  it('requires an explicit related-memory choice before changing project truth',()=>{
    const timestamp='2026-07-13T10:00:00.000Z';
    const earlier={id:'old',projectId:'atlas',sessionId:null,type:'decision',title:'Use ambient light',body:'Light carries orientation',status:'active',reviewStatus:'accepted',origin:'manual',relatedArtifactIds:[],supersedesArtifactIds:[],supersededByArtifactId:null,tags:[],confidence:.9,sourceMessageIds:[],createdAt:timestamp,updatedAt:timestamp} satisfies MemoryArtifact;
    const next={...earlier,id:'new',title:'Use directional sound',body:'Sound carries orientation',reviewStatus:'pending' as const,origin:'ai' as const,relatedArtifactIds:['old']};
    const artifacts=[earlier,next];
    expect(applyArtifactSupersession(next,artifacts,[],timestamp)).toEqual([]);
    expect(earlier.status).toBe('active');
    expect(applyArtifactSupersession(next,artifacts,['old','unrelated'],timestamp)).toEqual(['old']);
    expect(earlier).toMatchObject({status:'resolved',supersededByArtifactId:'new'});
  });

  it('restores earlier direction when a superseding memory is undone',()=>{
    const timestamp='2026-07-13T11:00:00.000Z';
    const earlier={id:'old',projectId:'atlas',sessionId:null,type:'decision',title:'Earlier',body:'Earlier direction',status:'resolved',reviewStatus:'accepted',origin:'manual',relatedArtifactIds:[],supersedesArtifactIds:[],supersededByArtifactId:'new',tags:[],confidence:.9,sourceMessageIds:[],createdAt:timestamp,updatedAt:timestamp} satisfies MemoryArtifact;
    const next={...earlier,id:'new',title:'Next',status:'active' as const,supersededByArtifactId:null,supersedesArtifactIds:['old']};
    const undoPayload={...next,supersedesArtifactIds:[...next.supersedesArtifactIds]};
    releaseArtifactSupersession(next,[earlier,next],timestamp);
    expect(next.supersedesArtifactIds).toEqual([]);
    expect(undoPayload.supersedesArtifactIds).toEqual(['old']);
    expect(earlier).toMatchObject({status:'active',supersededByArtifactId:null});
  });

});
