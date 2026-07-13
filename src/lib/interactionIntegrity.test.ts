import fs from 'fs';
import { describe, expect, it } from 'vitest';

const app=fs.readFileSync(new URL('../App.tsx',import.meta.url),'utf8');
const onboarding=fs.readFileSync(new URL('../Onboarding.tsx',import.meta.url),'utf8');

describe('visible interaction integrity',()=>{
  it('does not render known dead or destinationless controls as interactive',()=>{
    expect(app).not.toContain('composer-tool');
    expect(app).not.toContain('href={source.url||undefined}');
    expect(app).not.toContain('search-result static');
    expect(app).toContain('history-moment static');
    expect(app).toContain("if(result.kind==='source'&&result.url)");
    expect(app).toContain('captureDisabled={!session||!session.messages.length}');
    expect(app).toContain('Your draft is still in the composer.');
    expect(app).toContain('onSend:(text:string)=>Promise<boolean>');
  });

  it('labels icon-only controls and contains destructive-action recovery',()=>{
    const iconButtons=[...app.matchAll(/<button[^>]*className="icon-button[^"]*"[^>]*>/g)].map(match=>match[0]);
    expect(iconButtons.length).toBeGreaterThan(0);
    for(const button of iconButtons)expect(button).toContain('aria-label=');
    expect(app).toContain('aria-label="Send message"');
    expect(app).toContain('Remove this memory?');
    expect(app).toContain("'Undo'");
    expect(app).toContain("onReview(item.id,'accept')");
    expect(app).toContain('Keep alongside');
    expect(app).toContain('Change direction');
    expect(app).toContain('supersededByArtifactId');
    expect(app).toContain('capture-path');
    expect(app).toContain('Delete project');
    expect(app).toContain('studioApi.restoreProject(removed.snapshot)');
    expect(app).toContain('Run check');
    expect(app).toContain('onReset={applyReset}');
  });

  it('contains keyboard and dialog semantics for every overlay',()=>{
    expect(app).toContain('aria-modal="true"');
    expect(app).toContain("event.key==='Escape'");
    expect(onboarding).toContain('role="dialog"');
    expect(onboarding).toContain('disabled={index>step}');
    expect(onboarding).toContain('disabled={!mcpAcknowledged}');
    expect(onboarding).toContain("http://localhost:3000/api/mcp'");
    expect(onboarding).toContain("aria-current={index===step?'step':undefined}");
    expect(onboarding).toContain('remainder-onboarding-v2');
  });
});
