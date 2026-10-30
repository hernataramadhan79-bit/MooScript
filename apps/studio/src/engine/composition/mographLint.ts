/**
 * Anti-PPT linter for AI-generated scenes.
 *
 * The security validator only checks that a scene is safe and animates *something*.
 * This linter checks whether it reads as motion graphics or as a web page / slide:
 * camera life, stage composition, text load, entrance vocabulary, and hand-off.
 * It is a static heuristic — cheap enough to run on every generation and specific
 * enough that its messages can be fed straight back to the LLM as repair feedback.
 */

export interface MographLintIssue {
  id: string;
  weight: number;
  message: string;
}

export interface MographLintResult {
  score: number;
  issues: MographLintIssue[];
  needsRepair: boolean;
}

export interface MographLintOptions {
  narration?: string;
  hasWordTimestamps?: boolean;
}

/** Sum of issue weights at or above which a scene is sent back for a quality rewrite. */
export const MOGRAPH_REPAIR_THRESHOLD = 3;

const MAX_ON_SCREEN_WORDS = 14;

// ctx helpers from the runtime mograph kit that add real motion (see runtime/mographKit.ts).
const MOTION_KIT_CALLS = [
  'camera', 'hero', 'draw', 'pop', 'kinetic', 'count', 'reveal', 'punch', 'shake', 'flash', 'drift', 'orbit', 'particles', 'handoff'
];

// Move properties that only express "fade / slide in" — the default web entrance.
const BASIC_MOVE_KEYS = new Set([
  'opacity', 'fade', 'x', 'y', 'shiftX', 'shiftY',
  'dur', 'wait', 'curve', 'cascade', 'gap', 'from', 'total', 'showStart'
]);

function visibleText(html: string): string {
  return html
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}%]/gu, ''))
    .filter(Boolean);
}

/** True when `screen` contains a run of `run` consecutive words copied from `narration`. */
function containsNarrationRun(screen: string[], narration: string[], run: number): boolean {
  if (screen.length < run || narration.length < run) return false;
  const screenJoined = ` ${screen.join(' ')} `;
  for (let i = 0; i + run <= narration.length; i++) {
    if (screenJoined.includes(` ${narration.slice(i, i + run).join(' ')} `)) return true;
  }
  return false;
}

/** Collects the property keys of every move call (.go / .arrive / .travel). */
function moveKeySets(js: string): string[][] {
  const sets: string[][] = [];
  const re = /\.\s*(travel|arrive|go)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(js)) !== null) {
    const body = js.slice(m.index + m[0].length, m.index + m[0].length + 400);
    // Stop at the end of this call's argument list (first unbalanced ')').
    let depth = 0;
    let end = body.length;
    for (let i = 0; i < body.length; i++) {
      const ch = body[i];
      if (ch === '(' || ch === '{' || ch === '[') depth++;
      else if (ch === ')' || ch === '}' || ch === ']') {
        if (depth === 0) { end = i; break; }
        depth--;
      }
    }
    const keys = Array.from(body.slice(0, end).matchAll(/([A-Za-z_$][\w$]*)\s*:/g), (k) => k[1]);
    if (keys.length > 0) sets.push(keys);
  }
  return sets;
}

/** Regex alternatives matching a move's first argument when it is the camera (inline or via a variable). */
function cameraTargetPatterns(js: string): string[] {
  const cameraSelector = `root\\.querySelector(?:All)?\\(\\s*['"][^'"]*camera[^'"]*['"]\\s*\\)`;
  const targets = [cameraSelector, `['"][^'"]*camera[^'"]*['"]`];
  const bindRe = new RegExp(`(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*${cameraSelector}`, 'g');
  for (const m of js.matchAll(bindRe)) targets.push(`${m[1].replace(/\$/g, '\\$')}\\b`);
  return targets;
}

/** True when some move targets the camera, either inline or through a variable bound to it. */
function animatesCamera(js: string): boolean {
  if (/ctx\.camera\s*\(/.test(js)) return true;
  return new RegExp(`\\.\\s*(?:travel|arrive|go)\\s*\\(\\s*(?:${cameraTargetPatterns(js).join('|')})`).test(js);
}

/**
 * True when the camera, the scene root or every layer starts hidden (opacity/fade/scale 0).
 * The editor shows t=0 as the scene's still, so such a scene previews as an empty frame.
 */
function hidesWholeFrameAtStart(js: string): boolean {
  const whole = [
    ...cameraTargetPatterns(js),
    `root\\b(?!\\s*\\.\\s*querySelector)`,
    `root\\.(?:children|firstElementChild)\\b`,
    `root\\.querySelectorAll\\(\\s*['"](?:\\*|\\[data-moo-layer\\])['"]\\s*\\)`
  ].join('|');
  // .arrive(target, { ...hidden }) or .travel(target, { ...hidden }, ...) — the first object is the start state.
  const re = new RegExp(`\\.\\s*(?:travel|arrive)\\s*\\(\\s*(?:${whole})\\s*,\\s*\\{([^}]*)\\}`, 'g');
  for (const m of js.matchAll(re)) {
    if (/\b(?:opacity|fade|scale)\s*:\s*0(?:\.0*)?\s*(?:[,}]|$)/.test(m[1])) return true;
  }
  return false;
}

export function lintMographQuality(
  code: { html: string; css: string; buildJs: string },
  options: MographLintOptions = {}
): MographLintResult {
  const html = code.html || '';
  const css = code.css || '';
  const js = code.buildJs || '';
  const issues: MographLintIssue[] = [];
  const add = (id: string, weight: number, message: string) => issues.push({ id, weight, message });

  // --- Camera -----------------------------------------------------------
  const hasCamera = /moo-camera/.test(html) || /data-moo-layer\s*=\s*["']camera["']/i.test(html);
  if (!hasCamera) {
    add('no-camera', 2, 'Tidak ada lapisan kamera: bungkus seluruh isi scene dengan <div class="moo-camera" data-moo-layer="camera">.');
  } else if (!animatesCamera(js)) {
    add('static-camera', 2, 'Kamera (.moo-camera) tidak dianimasikan: gerakkan kamera (ctx.camera, atau scale/x/y/spin lewat shot.travel) sepanjang ctx.dur.');
  }
  if (hidesWholeFrameAtStart(js)) {
    add('empty-first-frame', 3, 'Frame 0 kosong: kamera/root/semua layer dimulai dari opacity 0 atau scale 0, jadi preview editor tampil hitam. Latar, kamera, dan subjek utama harus sudah terlihat di t=0; mulai dari keadaan terlihat (mis. ctx.hero, atau shot.travel scale 0.55 → 1).');
  }

  // --- Web / card layout --------------------------------------------------
  const centeredFlex =
    /display\s*:\s*(flex|grid)/i.test(css) &&
    /justify-content\s*:\s*center/i.test(css) &&
    /align-items\s*:\s*center/i.test(css);
  if (/backdrop-filter/i.test(css) || centeredFlex) {
    add('web-layout', 2, 'Layout masih bergaya halaman web/kartu (flex-center atau backdrop-filter): susun elemen dengan position:absolute dan koordinat panggung.');
  } else if (/display\s*:\s*(flex|grid)/i.test(css)) {
    add('flex-layout', 1, 'Hindari display:flex/grid untuk komposisi; tempatkan elemen di koordinat absolut.');
  }
  if (/<(p|ul|ol|li|button|nav)\b/i.test(html)) {
    add('web-tags', 1, 'Tag dokumen (<p>, <ul>, <li>, <button>) terasa seperti slide; gunakan teks kinetik pendek atau SVG.');
  }

  // --- Text load ------------------------------------------------------------
  const screenWords = words(visibleText(html));
  if (screenWords.length > MAX_ON_SCREEN_WORDS) {
    add('text-heavy', 2, `Terlalu banyak teks di layar (${screenWords.length} kata, maks ${MAX_ON_SCREEN_WORDS}). Visual yang bercerita, teks hanya kata kunci.`);
  } else if (options.narration && containsNarrationRun(screenWords, words(options.narration), 6)) {
    add('narration-pasted', 2, 'Narasi ditempel sebagai teks di layar. Narasi sudah diucapkan dan di-caption terpisah; tampilkan hanya 1-3 kata kunci.');
  }

  // --- Visual stage ------------------------------------------------------------
  if (!/<svg\b/i.test(html)) {
    add('no-svg', 1, 'Tidak ada SVG: bangun objek, garis, atau diagram bergerak dengan SVG, bukan hanya teks dan kotak.');
  }
  const layerCount = (html.match(/data-moo-layer\s*=/gi) || []).length;
  if (layerCount < 3) {
    add('flat-depth', 1, `Hanya ${layerCount} layer; buat minimal 3 lapisan kedalaman (latar, objek tengah, depan).`);
  }

  // --- Motion vocabulary -----------------------------------------------------
  // Mograph kit calls are motion vocabulary in their own right, never plain fade-ups.
  const kitMoves = (js.match(new RegExp(`ctx\\.(?:${MOTION_KIT_CALLS.join('|')})\\s*\\(`, 'g')) || []).length;
  const moves = moveKeySets(js);
  const totalMoves = moves.length + kitMoves;
  if (totalMoves > 0) {
    const basic = moves.filter((keys) => keys.every((k) => BASIC_MOVE_KEYS.has(k))).length;
    if (basic / totalMoves >= 0.6) {
      add('fade-up-only', 2, 'Animasi didominasi fade/slide masuk (opacity, x, y). Pakai bahasa gerak mograph: ctx.hero, ctx.pop, ctx.draw, ctx.kinetic, ctx.reveal, atau scale dengan overshoot dan stroke draw.');
    }
  }
  const kitHandoff = /ctx\.handoff\s*\(/.test(js) || (/ctx\.camera\s*\(/.test(js) && !/handoff\s*:\s*(false|['"]none['"])/.test(js));
  if (!kitHandoff && !/ctx\.dur\s*-|\b(D|dur|DUR)\s*-\s*\d/.test(js)) {
    add('no-handoff', 1, 'Tidak ada aksi keluar/hand-off di akhir shot: pakai ctx.camera({ handoff }) atau animasikan keluar pada posisi ctx.dur - 0.4.');
  }
  // --- Scope ----------------------------------------------------------------------
  // Selector strings in tl calls resolve inside this shot; document-wide lookups do not and can grab
  // another shot's elements that share a class name.
  if (/\bdocument\s*\.\s*(?:querySelector(?:All)?|getElementById|getElementsBy(?:ClassName|TagName|Name))\s*\(/.test(js)) {
    add('global-selector', 1, 'Pencarian elemen lewat document.* bisa mengenai elemen shot lain: pakai root.querySelector(...) atau selector string langsung di shot.go(...).');
  }
  if (options.hasWordTimestamps && !/ctx\.(at|beat)\s*\(/.test(js)) {
    add('unsynced', 1, 'Timestamp kata tersedia tapi tidak dipakai: jatuhkan aksen tepat di ctx.beat(\'kata\', detikCadangan).');
  }

  const score = issues.reduce((acc, i) => acc + i.weight, 0);
  return { score, issues, needsRepair: score >= MOGRAPH_REPAIR_THRESHOLD };
}
