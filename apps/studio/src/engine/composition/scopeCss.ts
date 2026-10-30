/**
 * Scopes a scene's stylesheet to its own wrapper.
 *
 * Every scene's CSS lands in one shared <style>, so a generated rule like `.moo-camera {}` or a
 * stale `.scene-s2` class (after scenes are reordered) would otherwise leak into other scenes.
 * Each selector is prefixed with `:where(<scope>)`, which adds zero specificity, so the cascade
 * between generated CSS and the editor's layer overrides stays exactly as before.
 */

// At-rules whose body is a list of style rules and must be scoped recursively.
const NESTED_AT_RULES = /^@(media|supports|container|layer|document)\b/i;

/** Splits on top-level commas, ignoring commas inside (), [] and strings. */
function splitSelectorList(prelude: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let start = 0;
  for (let i = 0; i < prelude.length; i++) {
    const ch = prelude[i];
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
    else if (ch === ',' && depth === 0) {
      parts.push(prelude.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(prelude.slice(start));
  return parts.map((p) => p.trim()).filter(Boolean);
}

function scopeSelector(selector: string, scope: string): string {
  if (selector.startsWith(scope)) return selector;
  // Document-level selectors become the scene wrapper itself.
  const docLevel = selector.match(/^(?::root|html|body)(?![\w-])((?:\s+(?:html|body)(?![\w-]))*)/i);
  if (docLevel) {
    const rest = selector.slice(docLevel[0].length);
    return `${scope}${rest}`;
  }
  return `${scope} ${selector}`;
}

/** Index of the `}` that closes the block opened at `open`, honoring strings and comments. */
function findBlockEnd(css: string, open: number): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = open; i < css.length; i++) {
    const ch = css[i];
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      if (end === -1) return css.length;
      i = end + 1;
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return css.length;
}

export function scopeCss(css: string, scopeSelectorText: string): string {
  const scope = `:where(${scopeSelectorText})`;
  const out: string[] = [];
  let i = 0;
  while (i < css.length) {
    // Skip whitespace and comments between rules.
    const ws = css.slice(i).match(/^(?:\s+|\/\*[\s\S]*?\*\/)+/);
    if (ws) {
      i += ws[0].length;
      continue;
    }
    let j = i;
    let quote: string | null = null;
    while (j < css.length) {
      const ch = css[j];
      if (quote) {
        if (ch === '\\') j++;
        else if (ch === quote) quote = null;
      } else if (ch === '"' || ch === "'") quote = ch;
      else if (ch === '{' || ch === ';' || ch === '}') break;
      j++;
    }
    const prelude = css.slice(i, j).trim();
    if (j >= css.length) {
      if (prelude) out.push(prelude);
      break;
    }
    if (css[j] === ';' || css[j] === '}') {
      // Statement at-rule (@charset ...) or a stray brace: keep statements, drop strays.
      if (css[j] === ';' && prelude) out.push(`${prelude};`);
      i = j + 1;
      continue;
    }
    const end = findBlockEnd(css, j);
    const body = css.slice(j + 1, end);
    if (prelude.startsWith('@')) {
      out.push(NESTED_AT_RULES.test(prelude) ? `${prelude} {\n${scopeCss(body, scopeSelectorText)}\n}` : `${prelude} {${body}}`);
    } else if (prelude) {
      const selectors = splitSelectorList(prelude).map((sel) => scopeSelector(sel, scope));
      out.push(`${selectors.join(', ')} {${body}}`);
    }
    i = end + 1;
  }
  return out.join('\n');
}
