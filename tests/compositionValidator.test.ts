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
});
