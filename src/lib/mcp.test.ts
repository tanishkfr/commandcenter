import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { mcpServer } from './mcp.js';

describe('Creative Memory MCP',()=>{
  it('advertises the creative-memory tools used by onboarding',async()=>{
    const [clientTransport,serverTransport]=InMemoryTransport.createLinkedPair();
    const client=new Client({name:'creative-memory-test',version:'1.0.0'});
    await Promise.all([mcpServer.connect(serverTransport),client.connect(clientTransport)]);
    const result=await client.listTools();
    const names=result.tools.map(tool=>tool.name);
    expect(names).toEqual(expect.arrayContaining([
      'listCreativeProjects',
      'getProjectMemory',
      'searchProjectMemory',
      'createCreativeProject',
      'importCreativeConversation',
      'captureCreativeSession',
      'addCreativeSource',
      'updateMemoryArtifact',
      'reviewMemoryArtifact'
    ]));
    await client.close();
  });
});
