export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const FORBIDDEN_PATTERNS = [
  { pattern: /\bfetch\s*\(/, message: 'Larangan keamanan: dilarang menggunakan fetch() di dalam scene' },
  { pattern: /\bXMLHttpRequest\b/, message: 'Larangan keamanan: dilarang menggunakan XMLHttpRequest' },
  { pattern: /\bWebSocket\b/, message: 'Larangan keamanan: dilarang menggunakan WebSocket' },
  { pattern: /\bimport\s+/, message: 'Larangan modul: dilarang menggunakan import di dalam kode scene' },
  { pattern: /\bimport\s*\(/, message: 'Larangan modul: dilarang menggunakan dynamic import() di dalam scene' },
  { pattern: /\beval\s*\(/, message: 'Larangan keamanan: dilarang menggunakan eval()' },
  { pattern: /\bFunction\s*\(/, message: 'Larangan keamanan: dilarang menggunakan Function constructor' },
  { pattern: /\bparent\b/, message: 'Larangan keamanan: dilarang mengakses parent window' },
  { pattern: /\btop\b\s*(\.|\[)/, message: 'Larangan keamanan: dilarang mengakses top window' },
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

  // Check forbidden patterns in JS
  for (const { pattern, message } of FORBIDDEN_PATTERNS) {
    if (pattern.test(combinedJs)) {
      errors.push(message);
    }
  }

  // Check forbidden patterns in HTML
  if (/<script\b[^>]*>/i.test(combinedHtml)) {
    errors.push('Larangan HTML: dilarang menyematkan tag <script> di dalam potongan HTML');
  }

  // Check structure of build function
  if (combinedJs && !combinedJs.includes('tl') && !combinedJs.includes('build')) {
    errors.push('Format tidak lengkap: buildJs harus memuat manipulasi timeline GSAP');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
