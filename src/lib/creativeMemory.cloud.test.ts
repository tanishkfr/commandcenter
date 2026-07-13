import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const blobMocks=vi.hoisted(()=>({get:vi.fn(),put:vi.fn()}));
vi.mock('@vercel/blob',()=>blobMocks);

describe('Vercel Blob creative memory storage',()=>{
  beforeEach(()=>{
    vi.resetModules();blobMocks.get.mockReset();blobMocks.put.mockReset();vi.stubEnv('VERCEL','1');
  });
  afterEach(()=>vi.unstubAllEnvs());

  it('creates the initial state when Blob returns a 404 response',async()=>{
    blobMocks.get.mockResolvedValue({statusCode:404});
    blobMocks.put.mockResolvedValue({etag:'created-etag'});
    const {creativeMemoryStore}=await import('./creativeMemory.js');
    const bootstrap=await creativeMemoryStore.bootstrap();
    expect(bootstrap.project.name).toBe('Atlas');
    expect(bootstrap.storageMode).toBe('vercel-blob');
    expect(blobMocks.put).toHaveBeenCalledWith('creative-memory/studio.json',expect.any(String),expect.objectContaining({access:'private',allowOverwrite:false}));
  });

  it('reads an existing state from a 200 Blob response',async()=>{
    const state={version:2,activeProjectId:'cloud',projects:[{id:'cloud',name:'Cloud project',description:'Stored in Blob',color:'#796bb4',createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:00:00.000Z'}],sessions:[],artifacts:[],sources:[],events:[]};
    blobMocks.get.mockResolvedValue({statusCode:200,stream:new Response(JSON.stringify(state)).body,blob:{etag:'read-etag'}});
    const {creativeMemoryStore}=await import('./creativeMemory.js');
    const bootstrap=await creativeMemoryStore.bootstrap();
    expect(bootstrap.project.name).toBe('Cloud project');
    expect(blobMocks.put).not.toHaveBeenCalled();
  });
  it('searches across projects, memory, conversations, sources, and history',async()=>{
    const timestamp='2026-01-01T00:00:00.000Z';
    const state={version:2,activeProjectId:'atlas',projects:[{id:'atlas',name:'Atlas navigation',description:'Ambient wayfinding',color:'#796bb4',createdAt:timestamp,updatedAt:timestamp}],sessions:[{id:'session-1',projectId:'atlas',title:'Navigation tension',createdAt:timestamp,updatedAt:timestamp,capturedAt:null,messages:[{id:'message-1',role:'user',content:'Could light carry navigation?',createdAt:timestamp,citedArtifactIds:[]}]}],artifacts:[{id:'memory-1',projectId:'atlas',sessionId:'session-1',type:'decision',title:'Use ambient navigation cues',body:'Light before maps',status:'active',reviewStatus:'accepted',origin:'manual',relatedArtifactIds:[],tags:['navigation'],confidence:.9,sourceMessageIds:['message-1'],createdAt:timestamp,updatedAt:timestamp}],sources:[{id:'source-1',projectId:'atlas',type:'link',title:'Navigation research',url:'https://example.com/navigation',note:'Wayfinding reference',createdAt:timestamp}],events:[{id:'event-1',projectId:'atlas',type:'decision',title:'Navigation direction changed',detail:'Ambient cues became primary',sessionId:'session-1',artifactId:'memory-1',createdAt:timestamp}]};
    blobMocks.get.mockResolvedValue({statusCode:200,stream:new Response(JSON.stringify(state)).body,blob:{etag:'search-etag'}});
    const {creativeMemoryStore}=await import('./creativeMemory.js');
    const results=await creativeMemoryStore.search('navigation');
    expect(new Set(results.map(result=>result.kind))).toEqual(new Set(['project','conversation','artifact','source','history']));
    expect(results.every(result=>result.projectName==='Atlas navigation')).toBe(true);
  });

  it('restores a removed memory with a visible history event',async()=>{
    const timestamp='2026-01-01T00:00:00.000Z';
    const state={version:2,activeProjectId:'atlas',projects:[{id:'atlas',name:'Atlas',description:'',color:'#796bb4',createdAt:timestamp,updatedAt:timestamp}],sessions:[],artifacts:[],sources:[],events:[]};
    blobMocks.get.mockResolvedValue({statusCode:200,stream:new Response(JSON.stringify(state)).body,blob:{etag:'restore-etag'}});
    blobMocks.put.mockResolvedValue({etag:'next-etag'});
    const {creativeMemoryStore}=await import('./creativeMemory.js');
    const removed={id:'memory-removed',projectId:'atlas',sessionId:null,type:'decision',title:'A recoverable direction',body:'Reasoning',status:'active',reviewStatus:'accepted',origin:'manual',relatedArtifactIds:[],tags:[],confidence:.9,sourceMessageIds:[],createdAt:timestamp,updatedAt:timestamp} as import('./creativeMemory').MemoryArtifact;
    await creativeMemoryStore.restoreArtifact(removed);
    const saved=JSON.parse(blobMocks.put.mock.calls[0][1] as string);
    expect(saved.artifacts).toEqual([expect.objectContaining({id:'memory-removed'})]);
    expect(saved.events).toEqual([expect.objectContaining({type:'memory-restored',artifactId:'memory-removed'})]);
  });

});
