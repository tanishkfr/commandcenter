import fs from 'fs';
import { describe, expect, it } from 'vitest';
import * as ts from 'typescript';

const app=fs.readFileSync(new URL('../App.tsx',import.meta.url),'utf8');
const onboarding=fs.readFileSync(new URL('../Onboarding.tsx',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../index.css',import.meta.url),'utf8');
const document=fs.readFileSync(new URL('../../index.html',import.meta.url),'utf8');

const declaredColor=(name:string)=>{
  const matches=[...css.matchAll(new RegExp('--'+name+':(#[0-9a-f]{6})','gi'))];
  if(!matches.length)throw new Error('Missing color token: '+name);
  return matches[matches.length-1][1];
};
const relativeLuminance=(color:string)=>{
  const channels=[1,3,5].map(index=>parseInt(color.slice(index,index+2),16)/255).map(value=>value<=.03928?value/12.92:Math.pow((value+.055)/1.055,2.4));
  return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;
};
const contrastRatio=(foreground:string,background:string)=>{
  const values=[relativeLuminance(foreground),relativeLuminance(background)].sort((a,b)=>b-a);
  return (values[0]+.05)/(values[1]+.05);
};

const buttonsWithoutBehavior=(source:string,fileName:string)=>{
  const file=ts.createSourceFile(fileName,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const misses:number[]=[];
  const visit=(node:ts.Node)=>{
    if(ts.isJsxOpeningElement(node)||ts.isJsxSelfClosingElement(node)){
      if(node.tagName.getText(file)==='button'){
        const attributes=node.attributes.properties.filter(ts.isJsxAttribute);
        const hasClick=attributes.some(attribute=>attribute.name.getText(file)==='onClick');
        const type=attributes.find(attribute=>attribute.name.getText(file)==='type');
        const isSubmit=Boolean(type?.initializer&&ts.isStringLiteral(type.initializer)&&type.initializer.text==='submit');
        if(!hasClick&&!isSubmit)misses.push(file.getLineAndCharacterOfPosition(node.getStart(file)).line+1);
      }
    }
    ts.forEachChild(node,visit);
  };
  visit(file);
  return misses;
};

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
    expect(app).not.toContain('studioApi.setActiveProject');
    expect(app).toContain("const ACTIVE_PROJECT_KEY='remainder-active-project-v1'");
    expect(app).toContain('const storageIssue=/cloud|blob|storage/i.test(raw)');
    expect(app).toContain('Connect Vercel Blob, redeploy, then try again.');
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

  it('keeps every visible button connected to an action',()=>{
    expect(buttonsWithoutBehavior(app,'App.tsx')).toEqual([]);
    expect(buttonsWithoutBehavior(onboarding,'Onboarding.tsx')).toEqual([]);
  });

  it('enforces the legible type scale and mobile search affordance',()=>{
    const pixelSizes=[...css.matchAll(/(?:font-size\s*:\s*|font\s*:[^;{}]*?)([0-9.]+)px/gi)].map(match=>Number(match[1]));
    expect(Math.min(...pixelSizes)).toBeGreaterThanOrEqual(11);
    expect(css).toContain('--font-caption:.6875rem');
    expect(css).toContain('--space-4:16px');
    expect(css).toContain('.search-button>svg{display:block}');
    expect(css).toContain('.search-button>span,.search-button>kbd{display:none}');
    expect(css).not.toContain('@import url(');
    expect(document).toContain('rel="preconnect" href="https://fonts.gstatic.com"');
    const paper=declaredColor('paper');
    for(const token of ['ink','muted','faint','accent'])expect(contrastRatio(declaredColor(token),paper)).toBeGreaterThanOrEqual(4.5);
  });
});
