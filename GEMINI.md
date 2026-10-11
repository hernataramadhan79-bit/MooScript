# MooScript Studio - Development & Guardrail Rules

## 1. Aturan Keamanan Engine & Integritas Kode (Strict Guardrails)
- **canvasRenderer.ts Dilindungi**: DILARANG keras memodifikasi atau menghapus `src/engine/renderer/canvasRenderer.ts` tanpa instruksi eksplisit dari pengguna. Berkas ini adalah fondasi pengekspor MP4 dan Web Worker yang memiliki pengujian regresi ketat.
- **Gerbang Kualitas Tanpa Peringatan**: Setiap perubahan kode wajib lolos verifikasi berikut tanpa kompromi:
  - `npx tsc -b` (0 error)
  - `npm run lint -- --max-warnings 0` (0 error, 0 warning)
  - `npx vitest run` (seluruh pengujian lulus)
- **Larangan Edit Kode via PowerShell Script**: Jangan pernah menggunakan inline PowerShell command (`run_command`) yang memakai string interpolasi untuk mengubah berkas kode TypeScript/JavaScript. Karakter backtick (`` ` ``) dan tanda dollar (`$var`) akan dievaluasi oleh PowerShell sehingga template literal (seperti `` `${id}` ``) terhapus. Gunakan selalu `replace_file_content` atau `write_to_file`.

## 2. Standar Arsitektur UI/UX & Siklus Hidup React
- **Hindari Rendering Ganda di DOM (Dual Layout)**: Jangan me-mount layout desktop dan mobile secara bersamaan di dalam DOM (meskipun disembunyikan via CSS `hidden lg:flex`). Gunakan hook `useMediaQuery('(min-width: 1024px)')` agar hanya satu tata letak yang di-mount. Ini mencegah duplikasi iframe preview, dobel ResizeObserver, dan kebocoran memori.
- **Debounce Iframe srcDoc**: Saat mengikat dokumen komposisi ke `srcDoc` iframe panggung, selalu terapkan debounce (misal 350ms) saat mengetik teks/naskah. Bypass debounce secara instan hanya ketika ID proyek atau resolusi kanvas berubah.
- **Input Angka & Desimal (Anti-Jumping)**: Jangan memanggil fungsi pengubah state global (`store`) secara langsung pada event `onChange` dari `<input type="number">`. Gunakan state lokal dan lakukan *commit* ke store hanya saat `onBlur` atau tombol `Enter` ditekan agar pengetikan angka desimal tidak meloncat/rusak.
- **Layar Penuh / Theater Mode via Portal**: Komponen overlay layar penuh wajib di-mount menggunakan `createPortal(..., document.body)` untuk menghindari terpotongnya kontainer (*clipping*) akibat properti CSS `transform` atau `overflow` pada elemen induk.
- **Gunakan Modal Dialog Modern**: Jangan menggunakan `window.confirm()` atau `window.alert()` bawaan browser. Gunakan komponen `ConfirmModal` yang seragam, berdesain gelap, mendukung navigasi keyboard (`Escape`), dan berbahasa Indonesia.
