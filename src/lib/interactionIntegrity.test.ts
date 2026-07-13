import fs from 'fs';
import { describe, expect, it } from 'vitest';

const app=fs.readFileSync(new URL('../App.tsx',import.meta.url),'utf8');
const onboarding=fs.readFileSync(new URL('../Onboarding.tsx',import.meta.url),'utf8');

describe('visible interaction integrity',()=>{
  it('does not render known dead or destinationless controls as interactive',()=>{
    expect(app).not.toContain('composer-tool');
    expect(app).not.toContain('href={source.url||undefined}');
    expect(app).toContain('memory-link static');
    expect(app).toContain('history-moment static');
    expect(app).toContain('search-result static');
  });

  it('labels icon-only controls and the composer submit action',()=>{
    const iconButtons=[...app.matchAll(/<button[^>]*className="icon-button"[^>]*>/g)].map(match=>match[0]);
    expect(iconButtons.length).toBeGreaterThan(0);
    for(const button of iconButtons)expect(button).toContain('aria-label=');
    expect(app).toContain('aria-label="Send message"');
    expect(app).toContain('Delete permanently?');
    expect(app).toContain("onReview(item.id,'accept')");
  });

  it('marks unavailable onboarding steps as disabled',()=>{
    expect(onboarding).toContain('disabled={index>step}');
    expect(onboarding).toContain("aria-current={index===step?'step':undefined}");
  });
});
