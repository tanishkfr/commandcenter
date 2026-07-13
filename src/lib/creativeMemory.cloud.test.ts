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
});
