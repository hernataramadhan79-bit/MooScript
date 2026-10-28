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
  { pattern: /\bDate\.now\s*\(/, message: 'Larangan determinisme: gunakan ctx.dur atau ctx.beat(), dilarang membaca Date.now()' },
  { pattern: /\bperformance\s*\.\s*now/, message: 'Larangan determinisme: gunakan ctx.dur atau ctx.beat(), dilarang membaca performance.now()' },
  { pattern: /\bMath\.random\s*\(/, message: 'Larangan determinisme: gunakan ctx.rand() bukan Math.random()' },
  { pattern: /\brequestAnimationFrame\s*\(/, message: 'Larangan determinisme: taruh animasi di shot (shot.go / shot.arrive / ...), bukan requestAnimationFrame' },
  { pattern: /\[['"`]\s*(fetch|eval|parent|top)\s*['"`]\]/, message: 'Larangan keamanan: dilarang mengakses properti terlarang via bracket notation' },
  { pattern: /<script\b[^>]*>/i, message: 'Larangan HTML: dilarang menyematkan tag <script> di dalam potongan HTML scene' }
];

/**
 * Code written for another animation API (GSAP-style tl / gsap calls, option and property names,
 * curves, positions). MooScript scenes use the MooTween scene API instead; each message names the
 * replacement so the repair pass, and anyone pasting their own code, knows what to write.
 */
const FOREIGN_API: Array<{ api: string; pattern: RegExp; fix: string }> = [
  { api: 'tl', pattern: /\btl\s*\.\s*[A-Za-z]+\s*\(/, fix: 'tulis gerak di shot: tl.to → shot.go, tl.from → shot.arrive, tl.fromTo → shot.travel, tl.set → shot.pin, tl.add → shot.nest, tl.addLabel → shot.mark, tl.call → shot.cue' },
  { api: '.to/.from/.fromTo/.set', pattern: /\)\s*\.\s*(?:to|fromTo|set)\s*\(|\)\s*\.\s*from\s*\((?!\s*\))/, fix: 'rantai gerak memakai .go / .arrive / .travel / .pin' },
  { api: 'gsap', pattern: /\bgsap\b/, fix: 'mesinnya MooTween: gsap.timeline → MooTween.track, gsap.utils → MooTween.math, gsap.to → shot.go' },
  { api: 'plugin', pattern: /\b(?:registerPlugin|ScrollTrigger|SplitText|MotionPathPlugin|MorphSVG\w*|DrawSVG\w*|Draggable|TextPlugin)\b/, fix: 'MooTween tidak memakai plugin: teks pakai ctx.kinetic / ctx.split, garis pakai ctx.draw, putaran pakai ctx.orbit, morph pakai attrs: { d } dengan jumlah titik sama' },
  { api: 'duration', pattern: /[{,]\s*duration\s*:/, fix: 'ganti duration → dur' },
  { api: 'delay', pattern: /[{,]\s*delay\s*:/, fix: 'ganti delay → wait' },
  { api: 'ease', pattern: /[{,]\s*ease\s*:/, fix: "ganti ease → curve, mis. curve: 'rush-out'" },
  { api: 'stagger', pattern: /[{,]\s*stagger\s*:/, fix: "ganti stagger → cascade (each → gap, amount → total, from 'center' → 'middle', 'edges' → 'ends', 'end' → 'last')" },
  { api: 'repeat', pattern: /[{,]\s*repeat(?:Delay)?\s*:/, fix: 'ganti repeat → loop (-1 → true), repeatDelay → loopGap' },
  { api: 'yoyo', pattern: /[{,]\s*yoyo\s*:/, fix: 'ganti yoyo → pingpong' },
  { api: 'keyframes', pattern: /[{,]\s*keyframes\s*:/, fix: 'ganti keyframes → sequence' },
  { api: 'immediateRender', pattern: /[{,]\s*immediateRender\s*:/, fix: 'ganti immediateRender → showStart' },
  { api: 'onStart/onUpdate/onComplete', pattern: /[{,]\s*on(?:Start|Update|Complete|Repeat|ReverseComplete)\s*:/, fix: 'ganti onStart → onBegin, onUpdate → onFrame, onComplete → onEnd' },
  { api: 'rotation', pattern: /[{,]\s*rotation[XYZ]?\s*:/, fix: 'ganti rotation → spin, rotationX → tiltX, rotationY → tiltY' },
  { api: 'xPercent/yPercent', pattern: /[{,]\s*[xy]Percent\s*:/, fix: 'ganti xPercent → shiftX, yPercent → shiftY' },
  { api: 'transformOrigin', pattern: /[{,]\s*(?:transformOrigin|svgOrigin)\s*:/, fix: 'ganti transformOrigin → pivot, svgOrigin → pivotPoint' },
  { api: 'transformPerspective', pattern: /[{,]\s*transformPerspective\s*:/, fix: 'ganti transformPerspective → depth' },
  { api: 'autoAlpha', pattern: /[{,]\s*autoAlpha\s*:/, fix: 'ganti autoAlpha → fade' },
  { api: 'attr', pattern: /[{,]\s*attr\s*:/, fix: 'ganti attr → attrs' },
  { api: "'+=' / '-='", pattern: /:\s*(['"`])[+-]=/, fix: "nilai relatif ditulis 'by(40)' atau 'by(-0.5)'" },
  { api: "posisi '<' / '>' / '+='", pattern: /,\s*(['"`])(?:[<>][^'"`]*|[+-]=[\d.]+|[A-Za-z_][\w-]*[+-]=[\d.]+)\1\s*\)/, fix: "waktu ditulis 'with' / 'after' / 'end+0.3' / 'end-0.3' / 'mark+0.2'" },
  { api: 'curve lama', pattern: /(['"`])(?:power[0-4]|sine|expo|circ|back|elastic|quad|cubic|quart|quint|bounce)\.(?:in|out|inOut)\b/, fix: "curve ditulis nama-arah: power1/2/3/4 → soft/smooth/strong/sharp, sine → gentle, expo → rush, circ → arc, back → overshoot, elastic → spring; .inOut → -inout (mis. 'smooth-inout')" }
];

// A scene animates something when it calls a shot move or a ctx helper that adds one.
const MOVES =
  /\bshot\s*\.\s*(?:go|arrive|travel|pin|nest|cue)\b|\bctx\s*\.\s*(?:camera|hero|draw|pop|kinetic|count|reveal|punch|shake|flash|drift|orbit|particles|handoff)\b/;

/** Names of the foreign APIs this scene code uses (comments ignored). */
export function findForeignApis(buildJs: string): string[] {
  const clean = stripCommentsRespectingStrings(buildJs || '');
  return FOREIGN_API.filter(({ pattern }) => pattern.test(clean)).map(({ api }) => api);
}

/** Repair instruction for one foreign API, as used in validation errors. */
export function foreignApiMessage(api: string): string {
  const entry = FOREIGN_API.find((e) => e.api === api);
  return `Bukan API MooScript: ${api} — ${entry ? entry.fix : 'pakai shot.* atau ctx.*'}`;
}
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

  // Check structure of build function. Old tl/gsap code still passes here so saved projects and
  // backups load; findForeignApis flags it as needs-repair instead.
  if (combinedJs && !/\b(?:shot|ctx|MooTween|tl|gsap)\b/.test(combinedJs) && !combinedJs.includes('build')) {
    errors.push('Format tidak lengkap: buildJs harus menggerakkan sesuatu lewat shot atau helper ctx.*');
  }

  // Syntax check (compile only — never executed on the host)
  if (combinedJs && errors.length === 0) {
    try {
      // Strip any accidental parameter re-declarations for the syntax check
      const checkJs = combinedJs
        .replace(/(?:^|\n)\s*(?:const|let|var)\s+shot\b[^\n;]*;?/g, '\n')
        .replace(/(?:^|\n)\s*(?:const|let|var)\s+root\b[^\n;]*;?/g, '\n')
        .replace(/(?:^|\n)\s*(?:const|let|var)\s+ctx\b[^\n;]*;?/g, '\n')
        .replace(/(?:^|\n)\s*(?:const|let|var)\s+MooTween\b[^\n;]*;?/g, '\n');

      new Function('shot', 'root', 'ctx', 'MooTween', checkJs);
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

  // Not part of validateSceneCode: saved projects and backups that use these must still load (they are
  // flagged for repair instead); new code has to stay inside the MooTween subset.
  for (const api of findForeignApis(code.buildJs || '')) {
    errors.push(foreignApiMessage(api));
  }
  if (!(code.html || '').trim()) {
    errors.push('Scene kosong: HTML tidak boleh kosong');
  }
  if (!(code.buildJs || '').trim()) {
    errors.push('Scene statis: buildJs wajib menganimasikan sesuatu lewat shot');
  } else if (!MOVES.test(code.buildJs || '')) {
    errors.push('Scene statis: buildJs harus memanggil shot.go / arrive / travel / pin atau helper ctx.*');
  }

  return { valid: errors.length === 0, errors, warnings: base.warnings };
}