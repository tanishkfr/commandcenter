import { afterEach, describe, expect, it, vi } from 'vitest';
import { describeGatewayError, generateStudioReply, testGatewayConnection } from './creativeAI';

const context={
  project:{id:'project-1',name:'Wayfinding study',description:'A navigation concept'},
  session:{id:'session-1',projectId:'project-1',title:'Working session',messages:[]},
  artifacts:[],
  sources:[]
} as any;

describe('Vercel AI Gateway connection',()=>{
  afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs()});

  it('uses the OpenAI-compatible AI Gateway contract',async()=>{
    const fetchMock=vi.fn().mockResolvedValue(new Response(JSON.stringify({choices:[{message:{content:'CONNECTED'}}]}),{status:200,headers:{'Content-Type':'application/json'}}));
    vi.stubGlobal('fetch',fetchMock);

    await expect(testGatewayConnection('gateway-test-key-that-is-long-enough','google/gemini-2.5-flash-lite')).resolves.toBe(true);

    const [url,init]=fetchMock.mock.calls[0] as [string,RequestInit];
    expect(url).toBe('https://ai-gateway.vercel.sh/v1/chat/completions');
    expect(init.headers).toMatchObject({Authorization:'Bearer gateway-test-key-that-is-long-enough'});
    expect(JSON.parse(String(init.body))).toMatchObject({model:'google/gemini-2.5-flash-lite',messages:[{role:'user',content:'Reply with exactly CONNECTED.'}],stream:false});
  });

  it('turns a timeout into a short, actionable recovery path',()=>{
    vi.stubEnv('AI_TIMEOUT_MS','12000');
    expect(describeGatewayError(new Error('The operation was aborted due to timeout'))).toContain('within 12 seconds');
    expect(describeGatewayError(new Error('The operation was aborted due to timeout'))).toContain('Help → AI');
  });

  it('keeps unrelated offline prompts specific and visibly different',async()=>{
    vi.stubEnv('AI_GATEWAY_API_KEY','');vi.stubEnv('VERCEL_OIDC_TOKEN','');
    const color=await generateStudioReply(context,'Should the color system use warm neutrals or high contrast blue?');
    const navigation=await generateStudioReply(context,'How should we test the navigation with first-time visitors?');

    expect(color.mode).toBe('local');
    expect(navigation.mode).toBe('local');
    expect(color.text).toContain('color system');
    expect(navigation.text).toContain('navigation');
    expect(color.text).not.toBe(navigation.text);
    expect('fallbackReason' in color?color.fallbackReason:'').toContain('offline guidance');
  });

  it('falls back without losing the subject when Gateway credits are unavailable',async()=>{
    vi.stubEnv('AI_GATEWAY_API_KEY','gateway-private-value-that-stays-hidden');
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({error:{message:'Budget exceeded'}}),{status:429,headers:{'Content-Type':'application/json'}})));

    const result=await generateStudioReply(context,'I am worried the onboarding asks for too much information.');
    expect(result.mode).toBe('local');
    expect(result.text).toContain('onboarding');
    expect('fallbackReason' in result?result.fallbackReason:'').toContain('credits');
    expect('fallbackReason' in result?result.fallbackReason:'').not.toContain('gateway-private-value');
  });
});
