# Prompt: Migrasi Total GSAP → MooTween (mesin animasi sendiri)

> Salin seluruh isi file ini sebagai prompt untuk agen coding. Kerjakan per fase, satu commit per fase, dan laporkan hasil tiap fase sebelum lanjut.

---

## 1. Konteks

MooScript Studio adalah generator motion graphics berbasis browser (React + TypeScript + Vite). Setiap shot ditulis sebagai HTML/SVG + CSS + kode timeline, lalu dijalankan di iframe sandbox dan di-*seek* per frame untuk preview dan export MP4 (WebCodecs).

Saat ini mesin animasinya **GSAP**, yang berlisensi "Standard No Charge" milik Webflow (bukan open source, dengan larangan untuk produk yang bersaing dengan builder animasi visual Webflow). Tujuan migrasi: **menghapus GSAP sepenuhnya** dan menggantinya dengan mesin sendiri bernama **MooTween**, tanpa menurunkan kualitas output AI dan tanpa merusak project user yang sudah tersimpan.

Prinsip kunci: MooTween **bukan** klon GSAP. MooTween adalah mesin *seek-only* yang mengimplementasikan **subset API bergaya GSAP** yang benar-benar dipakai app ini. App tidak pernah memakai ticker real-time; semua render terjadi lewat `seek(t)`.

## 2. Aturan kerja (wajib)

- Setiap fase harus lolos: `npx tsc -b` (0 error), `npm run lint` (0 warning), `npm test` (semua lulus), `npm run build`.
- Jangan mengedit file kode lewat perintah shell yang menginterpolasi string (backtick, `$`, dan backslash bisa rusak). Gunakan tool edit file.
- Jangan menyentuh `src/engine/renderer/canvasRenderer.ts` (renderer legacy).
- Ikuti gaya kode sekitar: komentar secukupnya, penamaan dan idiom yang sama.
- Kode yang di-embed ke runtime iframe lewat `Function.prototype.toString()` (seperti `mographKit.ts`) harus self-contained: tanpa import, tanpa referensi ke luar body fungsi.
- Satu commit per fase dengan pesan yang menjelaskan *apa* dan *kenapa*.

## 3. Peta ketergantungan saat ini

| Lapisan | File | Pemakaian GSAP |
|---|---|---|
| Runtime | `src/engine/composition/runtime/mooRuntime.ts` | `gsap.timeline({ paused: true })`, `gsap.ticker.lagSmoothing(0)`, `gsap.config(...)`, master timeline, transisi antar-shot (`set`, `to`, `fromTo`, `immediateRender: false`), `masterTl.add(sceneTl, t)`, `progress(1, true)`, `seek(t, false)`, proxy `makeSafeTimeline` / `makeSafeGsap` |
| Dokumen stage | `src/engine/composition/buildDocument.ts` | Meng-inline `gsap/dist/gsap.min.js?raw` ke dokumen stage dan ke HTML yang di-export |
| Kit | `src/engine/composition/runtime/mographKit.ts` | `tl.to/from/fromTo/set`, `keyframes`, `stagger`, `svgOrigin`, `clipPath`, `strokeDashoffset`, `onUpdate`, relative `'-='`/`'+='` |
| Kode bawaan | `proceduralCompiler.ts`, `directorPipeline.ts` (fallback & auto-synth), `motionLaws.ts` (contoh acuan) | Chain `.fromTo(...).to(...)`, ease bernama, posisi absolut |
| Prompt & validasi | `motionLaws.ts`, `validator.ts`, `mographLint.ts` | Menyebut GSAP, mengecek `tl.`/`gsap.` |
| Data user | Kode scene buatan AI tersimpan di IndexedDB (`composition.scenes[].buildJs`) | API GSAP bebas, bisa memakai fitur di luar subset |
| Dependensi | `package.json` | `gsap` |

## 4. Spesifikasi MooTween

### 4.1 Objek global

Di iframe tersedia `window.MooTween` dan **alias kompatibilitas** `window.gsap` yang hanya mengekspos subset di bawah. Kode scene menerima `(tl, root, ctx, gsap)`; `gsap` adalah alias tersebut.

- `timeline(vars?)` → Timeline (`paused` diabaikan; semua timeline selalu dikendalikan seek).
- `to / from / fromTo / set(targets, vars...)` → tween mandiri yang ditempelkan ke timeline scene aktif (perilaku setara pemakaian `gsap.to` di dalam build scene).
- `utils`: `clamp`, `interpolate` (angka), `mapRange`, `toArray`, `wrap`.
- `ticker.lagSmoothing`, `config`: no-op (ada supaya kode lama tidak error).

### 4.2 Timeline

- `to(targets, vars, position?)`, `from(targets, vars, position?)`, `fromTo(targets, fromVars, toVars, position?)`, `set(targets, vars, position?)`. Semuanya bisa di-chain (mengembalikan timeline).
- `add(childTimeline, position?)`.
- `seek(time, suppressEvents?)`, `progress(value?, suppressEvents?)`, `duration()`, `totalDuration()`, `time()`.
- **Parameter posisi**: angka (detik absolut), `'+=n'`, `'-=n'` (relatif ke akhir timeline), `'<'` (awal tween sebelumnya), `'>'` (akhir tween sebelumnya), `'<0.2'`, `'>-0.1'`, dan label string (`addLabel(name, pos)`). Tanpa posisi berarti di akhir timeline.
- Child timeline yang ditambahkan dengan `add` dirender dalam waktu lokalnya sendiri.

### 4.3 Tween vars

- `duration` (default 0.5), `delay`, `ease` (default `'power1.out'`).
- `stagger`: angka, atau objek `{ each, amount, from: 'start' | 'center' | 'end' | 'edges' | 'random' | index }`. `'random'` wajib deterministik (seed dari `ctx.rand` atau dari indeks).
- `repeat` (angka; `-1` dijepit menjadi pengulangan yang muat dalam durasi scene), `yoyo`, `repeatDelay`.
- `keyframes`: array berisi vars per segmen (masing-masing boleh punya `duration` dan `ease`).
- `immediateRender`: default `true` untuk `from` dan `fromTo`, `false` untuk `to` dan `set`.
- Callback `onStart`, `onUpdate`, `onComplete`: dipanggil secara deterministik saat seek melewati atau berada di dalam tween, kecuali `suppressEvents`.
- `overwrite`: diterima tapi diabaikan.

### 4.4 Target

- Elemen, `NodeList`, `HTMLCollection`, array, objek biasa (untuk counter seperti `{ v: 0 }`).
- **Selector string di-resolve relatif ke root scene**, bukan `document`. GSAP me-resolve ke seluruh dokumen, sehingga `tl.to('.ring')` di satu scene ikut menggerakkan `.ring` milik scene lain. Ini bug yang harus hilang saat migrasi.
- Target kosong atau tidak ditemukan → no-op tanpa error.

### 4.5 Properti

- **Transform** (disimpan per elemen dan dikomposisikan dengan urutan tetap: translate → xPercent/yPercent → rotate → rotateX/rotateY → skew → scale): `x`, `y` (px atau string berunit `'%'`/`'px'`), `xPercent`, `yPercent`, `scale`, `scaleX`, `scaleY`, `rotation`, `rotationX`, `rotationY`, `skewX`, `skewY`, `transformPerspective`, `transformOrigin`, `svgOrigin` (untuk elemen SVG, dalam koordinat viewBox).
  - Nilai awal transform dibaca sekali dari matriks computed lalu didekomposisi.
  - Tulis ke properti `transform`. Override layer dari editor memakai properti CSS individual `translate`/`scale`/`rotate` dengan `!important`, dan keduanya harus tetap bisa berkomposisi.
- `opacity`, dan `autoAlpha` (opacity sekaligus `visibility: hidden` saat bernilai 0).
- CSS numerik berunit: `width`, `height`, `left`, `top`, `fontSize`, `letterSpacing`, `borderRadius`, dan lainnya. Konversi unit cukup untuk px, %, deg, dan unit yang sama.
- Warna: hex, `rgb()`/`rgba()`, `hsl()`/`hsla()`, nama warna (lewat computed style), `var(--x)` (resolve ke nilai computed saat inisialisasi).
- String kompleks (`clipPath`, `filter`, `boxShadow`, `strokeDasharray`): interpolasi angka-demi-angka kalau struktur string awal dan akhir cocok; kalau tidak cocok, ganti nilai di akhir tween.
- SVG: `strokeDashoffset`, `strokeDasharray`, `fill`, `stroke`, `attr: { cx, cy, r, d?, ... }`. Untuk `d`, interpolasi hanya kalau jumlah dan urutan angkanya sama; morph bentuk tidak termasuk subset.
- Nilai relatif `'+=n'` dan `'-=n'`.
- Properti CSS lain yang tidak dikenal: set langsung di akhir tween dan beri warning sekali di konsol.

### 4.6 Ease

`none`/`linear`, `power0`–`power4`, `quad`, `cubic`, `quart`, `quint`, `sine`, `expo`, `circ`, masing-masing dengan `.in`, `.out`, `.inOut`, ditambah `back(overshoot)`, `elastic(amplitude, period)`, `bounce`, dan `steps(n)`. Format string harus sama dengan GSAP (`'back.out(1.7)'`, `'elastic.out(1, 0.3)'`). Ease yang tidak dikenal jatuh ke `power1.out` dengan warning sekali.

### 4.7 Semantik yang wajib sama dengan GSAP

1. **Nilai awal `to()` dicatat secara lazy**: pada render pertama tween, dari keadaan saat itu. Dengan begitu tween berantai pada properti yang sama tersambung mulus.
2. **Inisialisasi deterministik**: runtime saat ini melakukan `progress(1)` lalu `seek(0)` supaya semua tween terinisialisasi sekali dengan urutan waktu yang benar. MooTween harus memberi hasil yang sama untuk urutan ini, dan mengembalikan nilai awal dengan benar saat seek mundur.
3. **Urutan render**: dalam satu frame, tween dirender berurutan menurut waktu mulainya. Kalau dua tween aktif bersamaan pada properti yang sama, yang mulai belakangan menang.
4. **`from`/`fromTo` dengan `immediateRender`**: keadaan awalnya langsung diterapkan saat tween dibuat dan saat seek ke sebelum tween mulai.
5. **Zero-duration `set`**: diterapkan saat playhead berada pada atau setelah posisinya, dan dikembalikan saat seek mundur melewatinya.
6. Seek ke waktu yang sama dua kali menghasilkan DOM yang identik (idempoten).

## 5. Rencana per fase

### Fase 0 — Harness pembanding (golden frames)
- Buat korpus scene uji: contoh acuan di `motionLaws.ts`, fallback di `directorPipeline.ts`, 8 arketipe prosedural, setiap helper `ctx.*`, transisi antar-shot (flow, cut, fade, slide, zoom, wipe), dan sedikitnya 10 scene AI asli yang di-export dari project nyata (simpan sebagai fixture di `tests/fixtures/scenes/`).
- Tulis harness yang menjalankan setiap scene dengan GSAP (sementara jadi `devDependency`, hanya untuk tes) dan merekam computed style elemen `[data-moo-layer]` serta turunannya pada 20 titik waktu: transform matrix, opacity, visibility, warna, clip-path, dan stroke-dashoffset.
- Simpan hasilnya sebagai snapshot JSON. Butuh DOM sungguhan: pakai Vitest browser mode (Playwright/Chromium) untuk suite ini.

### Fase 1 — Implementasi MooTween
- Buat `src/engine/composition/runtime/mooTween.ts`, self-contained dan bisa di-embed lewat `toString()` seperti `mographKit.ts`.
- Unit test per fitur: ease (nilai pada titik 0, 0.25, 0.5, 0.75, 1), posisi timeline, stagger, repeat/yoyo, keyframes, transform composition, svgOrigin, interpolasi warna dan string, nilai relatif, seek mundur, callback.
- Jalankan harness Fase 0 terhadap MooTween. Toleransi: matriks transform ±1e-3, opacity ±1e-3, warna sama persis setelah dibulatkan, string sama setelah angka dibulatkan ke 3 desimal. Catat setiap selisih dan perbaiki sampai lolos.

### Fase 2 — Ganti runtime
- `mooRuntime.ts`: pakai MooTween untuk master timeline, transisi, dan `makeSafeTimeline`/`makeSafeGsap` (yang sekarang membungkus MooTween). Pertahankan semua perilaku: poster frame, `progress(1)` lalu `seek(0)`, layer rects, override CSS live, dan capture frame untuk export.
- `buildDocument.ts`: hapus inline `gsap.min.js`, ganti dengan MooTween. Export HTML standalone juga memakai MooTween.
- Hapus `gsap` dari `dependencies`. `npm ls gsap` hanya boleh muncul sebagai devDependency harness, atau tidak muncul sama sekali kalau harness sudah diganti snapshot.

### Fase 3 — Prompt, validator, linter
- `motionLaws.ts`: ganti penyebutan "GSAP" dengan "timeline API (gaya GSAP, subset MooScript)" beserta daftar fitur yang didukung. Contoh acuan dan kit tetap memakai `tl.*` dan `ctx.*`.
- `validator.ts`: tolak API di luar subset (`registerPlugin`, `ScrollTrigger`, `MotionPathPlugin`, `MorphSVG`, `SplitText`, `Draggable`, `gsap.ticker.add`, `gsap.context`, `quickTo`, `quickSetter`, `matchMedia`) dengan pesan repair yang spesifik.
- `mographLint.ts`: perbarui pengecekan yang menyebut GSAP. Tambah peringatan untuk selector string global.

### Fase 4 — Kompatibilitas project lama
- Saat project dimuat, pindai `buildJs` setiap scene. Kalau ada API di luar subset, tandai scene dengan status baru `needs-repair` (tambahkan ke tipe `GeneratedSceneStatus`). Jangan pernah mengubah kode user diam-diam.
- Di UI scene, tampilkan tombol "Perbaiki dengan AI" yang memakai alur repair yang sudah ada, dengan prompt yang menyebut API mana yang harus diganti.
- Scene yang hanya memakai subset tetap berjalan tanpa perubahan.

### Fase 5 — Pembersihan & dokumentasi
- README: hapus GSAP dari daftar lisensi pihak ketiga, jelaskan MooTween.
- Pastikan tidak ada string "gsap" yang tersisa di bundel produksi kecuali di alias kompatibilitas: `grep -ri gsap dist/` hanya boleh menemukan nama alias.
- Perbarui tes yang menyebut GSAP.

## 6. Kriteria selesai

- [ ] `gsap` tidak ada lagi di `dependencies`, dan dokumen stage maupun HTML export tidak mengandung kode GSAP.
- [ ] Harness golden frame lolos untuk seluruh korpus Fase 0 dengan toleransi di atas.
- [ ] Semua tes, typecheck, lint, dan build lulus. CI hijau.
- [ ] Performa: seek satu frame pada komposisi 20 shot ≤ 4 ms median di Chrome desktop. Export 30 detik @30fps tidak lebih lambat dari versi GSAP lebih dari 10%.
- [ ] Project lama yang hanya memakai subset tampil identik. Yang memakai fitur di luar subset ditandai `needs-repair` dan bisa diperbaiki dari UI.
- [ ] Selector string di kode scene tidak lagi bisa menyentuh elemen scene lain.

## 7. Di luar cakupan

- Plugin GSAP (MotionPath, MorphSVG, SplitText, ScrollTrigger, Draggable). Fungsi yang dibutuhkan sudah disediakan `ctx.*` (`ctx.kinetic` untuk split text, `ctx.draw` untuk stroke, `ctx.orbit` untuk gerak melingkar).
- Ticker real-time dan playback berbasis waktu nyata. App selalu digerakkan oleh seek.
- Morph path dengan jumlah titik yang berbeda.

## 8. Risiko yang harus dilaporkan

- Perbedaan halus dekomposisi matriks transform, terutama pada SVG dengan `svgOrigin` dan `transformOrigin` persen.
- Interpolasi `clipPath`/`filter` dengan struktur string yang tidak cocok.
- Kode AI lama yang bergantung pada perilaku GSAP yang tidak terdokumentasi.
- Performa `getComputedStyle` saat inisialisasi pada scene dengan banyak elemen.
