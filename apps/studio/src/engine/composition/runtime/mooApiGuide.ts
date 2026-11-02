import { L } from '../../../i18n';

/**
 * The MooScript scene API, written once and used three ways: the AI director's prompt
 * (formatMooApiGuide), the code editor's guide tab, and the README (tests check it lists every name).
 */

export interface MooApiEntry {
  /** What to type, e.g. "shot.go(target, props, at)". */
  use: string;
  /** What it does, in one line. */
  does: string;
}

export interface MooApiSection {
  id: string;
  title: string;
  intro?: string;
  entries: MooApiEntry[];
}

export const MOO_API_GUIDE: MooApiSection[] = [
  {
    id: 'basics',
    title: L('Dasar'),
    intro: L('Kode scene dijalankan sekali sebagai fungsi (shot, root, ctx, MooTween). Jangan deklarasikan ulang keempatnya.'),
    entries: [
      { use: 'shot', does: L('Track shot ini. Semua gerak ditaruh di sini dan diputar lewat seek, bukan waktu nyata.') },
      { use: 'root', does: L('Elemen pembungkus shot. Cari elemen dengan root.querySelector() atau selector string langsung.') },
      { use: 'ctx', does: L('Helper gerak (ctx.camera, ctx.hero, ...) dan info shot: ctx.dur (detik), ctx.stage {w, h}, ctx.rand().') },
      { use: 'MooTween', does: L('Mesin animasinya: MooTween.track() untuk sub-track, MooTween.math, MooTween.select().') }
    ]
  },
  {
    id: 'moves',
    title: L('Gerak (metode shot)'),
    intro: L('Target: selector string (hanya di dalam shot ini), elemen, NodeList, array, atau objek biasa untuk counter.'),
    entries: [
      { use: 'shot.go(target, props, at)', does: L('Gerak dari keadaan sekarang ke props.') },
      { use: 'shot.arrive(target, props, at)', does: L('Gerak dari props ke keadaan sekarang. Keadaan awal langsung tampil.') },
      { use: 'shot.travel(target, awal, akhir, at)', does: L('Gerak dari props awal ke props akhir. Keadaan awal langsung tampil.') },
      { use: 'shot.pin(target, props, at)', does: L('Pasang props seketika di waktu at; dibatalkan lagi kalau playhead mundur melewatinya.') },
      { use: "shot.mark('hit', at)", does: L("Beri nama sebuah waktu supaya gerak lain bisa memakai at: 'hit' atau 'hit+0.2'.") },
      { use: 'shot.cue(fn, at)', does: L('Panggil fn(progress) saat playhead melewati at, maju maupun mundur.') },
      { use: 'shot.nest(sub, at)', does: L('Taruh sub-track (const sub = MooTween.track(); sub.go(...)) di dalam shot.') },
      { use: L('Berantai'), does: L("Semua metode mengembalikan track: shot.go(a, {...}, 0).arrive(b, {...}, 'after').") }
    ]
  },
  {
    id: 'at',
    title: L('Waktu (at)'),
    intro: L('Argumen terakhir setiap gerak. Kalau dikosongkan sama dengan "end".'),
    entries: [
      { use: '1.2', does: L('Detik ke-1.2 dari awal shot.') },
      { use: "'end' | 'end+0.3' | 'end-0.3'", does: L('Di akhir semua gerak yang sudah ada, atau digeser dari situ.') },
      { use: "'with' | 'with+0.2'", does: L('Bersamaan dengan awal gerak sebelumnya (atau digeser).') },
      { use: "'after' | 'after-0.1'", does: L('Setelah gerak sebelumnya selesai (atau digeser).') },
      { use: "'hit' | 'hit+0.1'", does: L('Waktu yang diberi nama dengan shot.mark().') },
      { use: "ctx.beat('kata', 1.2)", does: L('Detik saat kata itu diucapkan di voice-over (1.2 bila kata tidak ditemukan).') }
    ]
  },
  {
    id: 'options',
    title: L('Opsi gerak'),
    intro: L('Ditulis di objek props bersama properti yang digerakkan.'),
    entries: [
      { use: 'dur: 0.6', does: L('Lama gerak dalam detik (bawaan 0.5).') },
      { use: 'wait: 0.2', does: L('Tunda mulai sekian detik setelah at.') },
      { use: "curve: 'rush-out'", does: L("Kurva percepatan (bawaan 'soft-out'). Daftar lengkap di bagian Curve.") },
      { use: 'cascade: 0.08', does: L('Beberapa target mulai bergantian dengan jeda 0.08 detik.') },
      { use: "cascade: { gap | total, from }", does: L("gap = jeda antar target, total = rentang seluruhnya; from: 'first' | 'middle' | 'last' | 'ends' | indeks | 'shuffle'.") },
      { use: 'loop: 2 | loop: true', does: L('Ulangi 2 kali, atau terus sepanjang shot.') },
      { use: 'pingpong: true', does: L('Setiap ulangan bolak-balik (maju lalu mundur).') },
      { use: 'loopGap: 0.3', does: L('Jeda antar ulangan.') },
      { use: 'sequence: [{ x: 80, dur: 0.3 }, { y: 40 }]', does: L('Langkah berurutan pada target yang sama; tiap langkah linear kecuali diberi curve.') },
      { use: 'showStart: false', does: L('Untuk arrive/travel: jangan tampilkan keadaan awal sebelum geraknya mulai.') },
      { use: 'onBegin / onFrame / onEnd', does: L('fn(progress) saat gerak mulai, tiap frame, dan selesai (this = geraknya).') },
      { use: "round: { textContent: 1 }", does: L('Bulatkan nilai sebuah properti ke kelipatan tertentu (berguna untuk angka).') }
    ]
  },
  {
    id: 'props',
    title: L('Properti'),
    entries: [
      { use: "x, y (px atau '50%')", does: L('Geser elemen. Persen dihitung dari ukuran elemen itu sendiri.') },
      { use: 'shiftX, shiftY', does: L('Geser dalam persen ukuran elemen (shiftX: -50 = setengah lebar ke kiri).') },
      { use: 'scale, scaleX, scaleY', does: L('Skala.') },
      { use: 'spin', does: L('Putar (derajat).') },
      { use: 'tiltX, tiltY + depth', does: L('Miring 3D (derajat); depth = jarak perspektif dalam px.') },
      { use: 'skewX, skewY', does: L('Miringkan bidang (derajat).') },
      { use: "pivot: '50% 100%'", does: L('Titik poros transform, relatif terhadap elemen (atau kotak SVG-nya).') },
      { use: "pivotPoint: '540 960'", does: L('Titik poros elemen SVG dalam koordinat viewBox.') },
      { use: 'opacity, fade', does: L('Transparansi; fade juga menyembunyikan elemen (visibility) saat bernilai 0.') },
      { use: 'width, height, left, top, fontSize, letterSpacing, borderRadius, ...', does: L('Properti CSS berangka (px, %, em, vw, vh).') },
      { use: "color, backgroundColor, fill, stroke", does: L('Warna: hex, rgb(), hsl(), nama warna, atau var(--moo-accent).') },
      { use: 'clipPath, filter, boxShadow', does: L('Diinterpolasi angka demi angka bila bentuk awal dan akhirnya sama.') },
      { use: 'strokeDasharray, strokeDashoffset', does: L('Menggambar garis SVG (atau pakai ctx.draw).') },
      { use: 'attrs: { cx, cy, r, d }', does: L('Atribut SVG; d hanya diinterpolasi bila jumlah titiknya sama.') },
      { use: "'by(40)' | 'by(-0.5)'", does: L('Nilai relatif terhadap nilai saat gerak dimulai.') },
      { use: 'shot.go(counter, { v: 100 })', does: L('Objek biasa juga bisa digerakkan (counter), lalu tampilkan nilainya di onFrame.') }
    ]
  },
  {
    id: 'curves',
    title: L('Curve'),
    intro: L("Tulis nama-arah: 'smooth-out', 'rush-inout'. Arah: -in (pelan di awal), -out (pelan di akhir, bawaan), -inout."),
    entries: [
      { use: "'linear'", does: L('Kecepatan tetap.') },
      { use: "'soft' | 'smooth' | 'strong' | 'sharp'", does: L('Percepatan dari halus sampai tajam.') },
      { use: "'gentle'", does: L('Sangat halus, cocok untuk drift dan napas.') },
      { use: "'rush'", does: L('Melesat lalu mengerem tajam.') },
      { use: "'arc'", does: L('Melengkung seperempat lingkaran.') },
      { use: "'overshoot-out(1.7)'", does: L('Melewati target lalu kembali; angka = seberapa jauh.') },
      { use: "'spring-out(1, 0.3)'", does: L('Memantul seperti per; (amplitudo, periode).') },
      { use: "'bounce-out'", does: L('Memantul seperti bola jatuh.') },
      { use: "'steps(5)'", does: L('Melompat bertahap.') }
    ]
  },
  {
    id: 'kit',
    title: L('Helper ctx (disarankan)'),
    intro: L('Setiap helper menaruh geraknya di shot dan menjaga semuanya di dalam [0, ctx.dur].'),
    entries: [
      { use: "ctx.camera({ move, handoff })", does: L("Kamera bergerak sepanjang shot. move: 'push' | 'pull' | 'pan-left' | 'pan-right' | 'pan-up' | 'pan-down' | 'roll'.") },
      { use: "ctx.handoff('zoom')", does: L("Gerak keluar di 0.4 detik terakhir: 'zoom' | 'whip-left' | 'whip-right' | 'whip-up' | 'drop' | 'spin'.") },
      { use: 'ctx.hero(target)', does: L('Subjek utama: terlihat di frame 0, tumbuh dengan overshoot, lalu bernapas.') },
      { use: 'ctx.draw(paths, { at, dur, cascade })', does: L('Menggambar garis SVG.') },
      { use: 'ctx.pop(targets, { at, cascade })', does: L('Muncul dengan overshoot untuk detail pendukung.') },
      { use: "ctx.kinetic(el, { style, by, at })", does: L("Teks kinetik. style: 'rise' | 'slam' | 'flip' | 'drop' | 'type'; by: 'words' | 'chars'.") },
      { use: 'ctx.count(el, { from, to, at, dur, prefix, suffix })', does: L('Angka berjalan.') },
      { use: "ctx.reveal(targets, { dir, at })", does: L("Wipe clip-path. dir: 'left' | 'right' | 'up' | 'down' | 'circle'.") },
      { use: 'ctx.punch / ctx.shake / ctx.flash', does: L('Aksen untuk kata kunci: hentakan skala, getar, kilat layar.') },
      { use: 'ctx.drift(targets) / ctx.orbit(targets, { cx, cy })', does: L('Melayang pelan, atau berputar mengelilingi titik.') },
      { use: 'ctx.particles({ count, size, color })', does: L('Partikel latar yang naik sepanjang shot.') }
    ]
  },
  {
    id: 'math',
    title: L('Utilitas'),
    entries: [
      { use: 'MooTween.math.clamp(min, max, v)', does: L('Batasi v di antara min dan max.') },
      { use: 'MooTween.math.mix(a, b, t)', does: L('Nilai di antara a dan b (angka atau warna); t = 0..1.') },
      { use: 'MooTween.math.remap(inMin, inMax, outMin, outMax, v)', does: L('Pindahkan v dari satu rentang ke rentang lain.') },
      { use: 'MooTween.math.cycle(list, i)', does: L('Ambil list[i] berputar; cycle(min, max, v) membungkus angka.') },
      { use: "MooTween.select('.dot')", does: L('Daftar elemen dari selector (di dalam shot ini).') }
    ]
  },
  {
    id: 'rules',
    title: L('Aturan'),
    entries: [
      { use: 'ctx.rand()', does: L('Satu-satunya sumber acak; Math.random, Date.now dan performance.now dilarang.') },
      { use: 'Selector', does: L('Selector string hanya mengenai elemen di shot ini; jangan pakai document.querySelector.') },
      { use: 'Durasi', does: L('Semua gerak selesai di dalam [0, ctx.dur].') },
      { use: 'Tidak tersedia', does: L('tl, gsap, plugin (ScrollTrigger, SplitText, MotionPath, MorphSVG, DrawSVG, Draggable), ticker, requestAnimationFrame.') }
    ]
  }
];

/** A complete scene that shows the vocabulary together. */
export const MOO_API_EXAMPLE = `const hit = ctx.beat('ide', 1.2);
ctx.camera({ move: 'push', handoff: 'zoom' });
ctx.hero('.core');
shot.travel('.ring', { scale: 1, opacity: 0.9, pivot: '50% 50%' },
  { scale: 4, opacity: 0, dur: 1.2, curve: 'rush-out', loop: 2 }, 0.15);
shot.mark('hit', hit);
ctx.draw('.links path', { at: 0.4, dur: 0.7, cascade: 0.12 });
shot.arrive('.word span', { shiftY: 110, spin: 8, opacity: 0, dur: 0.5,
  cascade: { gap: 0.08, from: 'middle' }, curve: 'rush-out' }, 'hit-0.15');
shot.go('.core', { scale: 1.35, dur: 0.12, pingpong: true, loop: 1 }, 'hit');`;

/** Every name a scene can use, for documentation checks. */
export const MOO_API_NAMES: string[] = [
  'shot.go', 'shot.arrive', 'shot.travel', 'shot.pin', 'shot.mark', 'shot.cue', 'shot.nest', 'MooTween.track',
  'dur', 'wait', 'curve', 'cascade', 'loop', 'pingpong', 'loopGap', 'sequence', 'showStart', 'onBegin', 'onFrame', 'onEnd',
  'shiftX', 'shiftY', 'spin', 'tiltX', 'tiltY', 'depth', 'pivot', 'pivotPoint', 'fade', 'attrs', 'by(',
  'linear', 'soft', 'smooth', 'strong', 'sharp', 'gentle', 'rush', 'arc', 'overshoot', 'spring', 'bounce', 'steps',
  'MooTween.math', 'MooTween.select'
];

/** Plain-text guide for the AI director's prompt. */
export function formatMooApiGuide(): string {
  const lines: string[] = ['=== MOOSCRIPT SCENE API (MooTween) — gunakan HANYA ini ==='];
  for (const section of MOO_API_GUIDE) {
    lines.push(`# ${section.title}`);
    if (section.intro) lines.push(section.intro);
    for (const e of section.entries) lines.push(`- ${e.use} — ${e.does}`);
  }
  lines.push('# Contoh', MOO_API_EXAMPLE);
  return lines.join('\n');
}
