export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

const FORBIDDEN_PATTERNS = [
  { pattern: /\bfetch\s*\(/, message: 'Larangan keamanan: dilarang menggunakan fetch() di dalam scene' },
  { pattern: /\bXMLHttpRequest\b/, message: 'Larangan keamanan: dilarang menggunakan XMLHttpRequest' },
  { pattern: /\bWebSocket\b/, message: 'Larangan keamanan: dilarang menggunakan WebSocket' },
  { pattern: /\bimport\s+/, message: 'Larangan modul: dilarang menggunakan import di dalam kode scene' },
  { pattern: /\bimport\s*\(/, message: 'Larangan modul: dilarang menggunakan dynamic import() di dalam scene' },
  { pattern: /\beval\s*\(/, message: 'Larangan keamanan: dilarang menggunakan eval()' },
  { pattern: /\bFunction\s*\(/, message: 'Larangan keamanan: dilarang menggunakan Function constructor' },
  { pattern: /(?:(?:window|globalThis|self)\s*\.\s*parent\b|\bparent\s*\.\s*(?:postMessage|location|document|window|frames|eval|focus|opener)\b|\bparent\s*\[\s*['"`](?:postMessage|location|document|window|frames|eval|focus|opener|href)['"`]\s*\])/, message: 'Larangan keamanan: dilarang mengakses parent window' },
  { pattern: /(?:(?:window|globalThis|self)\s*\.\s*top\b|\btop\s*\.\s*(?:postMessage|location|document|window|frames|eval|focus|opener)\b|\btop\s*\[\s*['"`](?:postMessage|location|document|window|frames|eval|focus|opener|href)['"`]\s*\])/, message: 'Larangan keamanan: dilarang mengakses top window' },
  { pattern: /\bwindow\s*\.\s*parent/, message: 'Larangan keamanan: dilarang mengakses window.parent' },
  { pattern: /\bglobalThis\b/, message: 'Larangan keamanan: dilarang mengakses globalThis' },
  { pattern: /\bdocument\s*\.\s*cookie/, message: 'Larangan keamanan: dilarang mengakses document.cookie' },
  { pattern: /\blocalStorage\b/, message: 'Larangan keamanan: dilarang mengakses localStorage' },
  { pattern: /\bsessionStorage\b/, message: 'Larangan keamanan: dilarang mengakses sessionStorage' },
  { pattern: /\bindexedDB\b/, message: 'Larangan keamanan: dilarang mengakses indexedDB' },
  { pattern: /\bsendBeacon\b/, message: 'Larangan keamanan: dilarang menggunakan sendBeacon' },
  { pattern: /\bnew\s+Image\b/, message: 'Larangan keamanan: dilarang membuat Image dinamis' },
  { pattern: /\bDate\.now\s*\(/, message: 'Larangan determinisme: gunakan ctx.dur atau tl.time(), dilarang membaca Date.now()' },
  { pattern: /\bperformance\s*\.\s*now/, message: 'Larangan determinisme: gunakan ctx.dur atau tl.time(), dilarang membaca performance.now()' },
  { pattern: /\bMath\.random\s*\(/, message: 'Larangan determinisme: gunakan ctx.rand() bukan Math.random()' },
  { pattern: /\brequestAnimationFrame\s*\(/, message: 'Larangan determinisme: animasi harus didefinisikan lewat timeline tl GSAP' },
  { pattern: /\[['"`]\s*(fetch|eval|parent|top)\s*['"`]\]/, message: 'Larangan keamanan: dilarang mengakses properti terlarang via bracket notation' },
  { pattern: /<script\b[^>]*>/i, message: 'Larangan HTML: dilarang menyematkan tag <script> di dalam potongan HTML scene' }
];

export function validateSceneCode(code: { html?: string; css?: string; buildJs?: string }): ValidationResult {
  const errors: string[] = [];

  const combinedJs = code.buildJs || '';
  const combinedHtml = code.html || '';

  // Strip real comments ONCE (string/regex aware) instead of per-pattern.
  const cleanCode = stripCommentsRespectingStrings(combinedJs);

  // Check forbidden patterns in JS
  for (const { pattern, message } of FORBIDDEN_PATTERNS) {
    if (pattern.test(cleanCode)) {
      errors.push(message);
    }
  }

  // Check forbidden patterns in HTML
  if (/<script\b[^>]*>/i.test(combinedHtml)) {
    errors.push('Larangan HTML: dilarang menyematkan tag <script> di dalam potongan HTML');
  }

  // Dangerous / non-self-contained HTML constructs
  if (/<(iframe|object|embed|link|meta|base|form)\b/i.test(combinedHtml)) {
    errors.push('Larangan HTML: dilarang iframe/object/embed/link/meta/base/form di dalam scene');
  }
  if (/\son[a-z]+\s*=/i.test(combinedHtml)) {
    errors.push('Larangan HTML: dilarang atribut event handler inline (onclick=, onload=, ...)');
  }
  if (/(href|src|xlink:href)\s*=\s*["']?\s*(javascript:|https?:|\/\/)/i.test(combinedHtml)) {
    errors.push('Larangan HTML: dilarang javascript: atau URL eksternal pada href/src (gunakan SVG/CSS inline atau data: URI)');
  }

  // CSS must be self-contained
  const css = code.css || '';
  if (/@import\b/i.test(css)) {
    errors.push('Larangan CSS: dilarang @import');
  }
  if (/url\(\s*["']?\s*(https?:|\/\/)/i.test(css)) {
    errors.push('Larangan CSS: dilarang url() eksternal (gunakan gradient/SVG inline atau data: URI)');
  }

  // Check structure of build function
  if (combinedJs && !combinedJs.includes('tl') && !combinedJs.includes('gsap') && !combinedJs.includes('build')) {
    errors.push('Format tidak lengkap: buildJs harus memuat manipulasi timeline GSAP');
  }

  // Syntax check (compile only — never executed on the host)
  if (combinedJs && errors.length === 0) {
    try {
      // Strip any accidental parameter re-declarations for the syntax check
      const checkJs = combinedJs
        .replace(/(?:^|\n)\s*(?:const|let|var)\s+tl\b[^\n;]*;?/g, '\n')
        .replace(/(?:^|\n)\s*(?:const|let|var)\s+root\b[^\n;]*;?/g, '\n')
        .replace(/(?:^|\n)\s*(?:const|let|var)\s+ctx\b[^\n;]*;?/g, '\n')
        .replace(/(?:^|\n)\s*(?:const|let|var)\s+gsap\b[^\n;]*;?/g, '\n');

      new Function('tl', 'root', 'ctx', 'gsap', checkJs);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // CSP restrictions on the host window (disallowing unsafe-eval/new Function) are host environment
      // policies, not syntax errors in the generated scene code.
      const isCspViolation =
        msg.includes('Content Security Policy') ||
        msg.includes('unsafe-eval') ||
        (err instanceof Error && err.name === 'EvalError');

      if (!isCspViolation) {
        errors.push(`Sintaks JavaScript tidak valid: ${msg}`);
      }
    }
  }

  // Soft warnings (do not invalidate)
  const warnings: string[] = [];
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
  if (/(^|[}\s,])(html|body|\*)\s*[{,]/.test(stripped)) {
    warnings.push('CSS menyentuh html/body/* — selector global akan bocor ke scene lain, gunakan prefix class unik per scene');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Removes line comments and block comments while respecting string literals
 * (single quotes, double quotes, template quotes) and regex literals.
 *
 * The naive comment stripping deleted the rest of any line containing
 * a double slash — including code like const url = "http://..." followed by
 * a real violation — which both hid real violations (security bypass) and
 * created false positives from commented-out code. This tokenizer only
 * strips comments that appear in actual code position.
 */
export function stripCommentsRespectingStrings(code: string): string {
  let out = '';
  let i = 0;
  const n = code.length;
  let quote: "'" | '"' | '`' | null = null;

  const isRegexStart = (prev: string): boolean => {
    if (!prev) return true;
    return '=(:,!&|?{};,[+-*%^~<>'.includes(prev);
  };

  while (i < n) {
    const ch = code[i];
    const next = i + 1 < n ? code[i + 1] : '';

    if (quote) {
      out += ch;
      if (ch === '\\' && i + 1 < n) {
        out += code[i + 1];
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      i++;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      out += ch;
      i++;
      continue;
    }

    if (ch === '/' && next === '/') {
      // `//` can never open a regex literal — always a line comment here.
      while (i < n && code[i] !== '\n') i++;
      continue;
    }

    if (ch === '/' && next === '*') {
      i += 2;
      while (i < n && !(code[i] === '*' && code[i + 1] === '/')) i++;
      i += 2;
      continue;
    }

    if (ch === '/') {
      // Heuristic regex-literal skip so `//` sequences inside /.../ survive.
      let j = i - 1;
      while (j >= 0 && (code[j] === ' ' || code[j] === '\t' || code[j] === '\n' || code[j] === '\r')) j--;
      const prev = j >= 0 ? code[j] : '';
      const prevWord = code.slice(Math.max(0, j - 5), j + 1);
      if (isRegexStart(prev) || /\breturn$/.test(prevWord)) {
        let k = i + 1;
        let inClass = false;
        let closed = false;
        while (k < n) {
          const c = code[k];
          if (c === '\\') {
            k += 2;
            continue;
          }
          if (c === '[') inClass = true;
          else if (c === ']') inClass = false;
          else if (c === '/' && !inClass) {
            closed = true;
            break;
          } else if (c === '\n') break;
          k++;
        }
        if (closed) {
          let e = k + 1;
          while (e < n && /[a-z]/i.test(code[e])) e++;
          out += code.slice(i, e);
          i = e;
          continue;
        }
      }
    }

    out += ch;
    i++;
  }
  return out;
}

/**
 * Strict validation for a scene that is about to enter a composition.
 * On top of the security/determinism checks of `validateSceneCode` it requires
 * real content: non-empty markup and an animation that actually uses the timeline.
 * It deliberately does NOT require any text — purely visual scenes are valid.
 */
export function validateGeneratedScene(code: { html?: string; css?: string; buildJs?: string }): ValidationResult {
  const base = validateSceneCode(code);
  const errors = [...base.errors];

  if (!(code.html || '').trim()) {
    errors.push('Scene kosong: HTML tidak boleh kosong');
  }
  if (!(code.buildJs || '').trim()) {
    errors.push('Scene statis: buildJs wajib menganimasikan sesuatu lewat timeline tl');
  } else if (!/\btl\s*\./.test(code.buildJs || '') && !/\bgsap\s*\./.test(code.buildJs || '')) {
    errors.push('Scene statis: buildJs harus memanggil tl.to/from/fromTo/set (timeline GSAP)');
  }

  return { valid: errors.length === 0, errors, warnings: base.warnings };
}