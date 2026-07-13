import { afterEach, describe, expect, it, vi } from 'vitest';
import { testNvidiaConnection } from './creativeAI';

describe('NVIDIA NIM connection',()=>{
  afterEach(()=>{vi.unstubAllGlobals();delete process.env.NVIDIA_BASE_URL});

  it('uses the hosted OpenAI-compatible chat completions contract',async()=>{
    const fetchMock=vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices:[{message:{content:'CONNECTED'}}]
    }),{status:200,headers:{'Content-Type':'application/json'}}));
    vi.stubGlobal('fetch',fetchMock);

    await expect(testNvidiaConnection('nvapi-test-key-that-is-long-enough','meta/llama-3.3-70b-instruct')).resolves.toBe(true);

    const [url,init]=fetchMock.mock.calls[0] as [string,RequestInit];
    expect(url).toBe('https://integrate.api.nvidia.com/v1/chat/completions');
    expect(init.headers).toMatchObject({Authorization:'Bearer nvapi-test-key-that-is-long-enough'});
    expect(JSON.parse(String(init.body))).toMatchObject({
      model:'meta/llama-3.3-70b-instruct',
      messages:[{role:'user',content:'Reply with exactly CONNECTED.'}],
      stream:false
    });
  });

  it('surfaces NVIDIA API errors without exposing the key',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error:{message:'Invalid API key'}
    }),{status:401,headers:{'Content-Type':'application/json'}})));

    await expect(testNvidiaConnection('nvapi-private-value-that-stays-hidden','meta/llama-3.3-70b-instruct'))
      .rejects.toThrow('NVIDIA NIM request failed: Invalid API key');
  });
});
