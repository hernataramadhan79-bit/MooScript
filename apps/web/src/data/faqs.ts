import type { Locale } from '../config/site';

export interface FaqItem {
  question: string;
  answer: string;
}

export const FAQS: Record<Locale, FaqItem[]> = {
  en: [
    {
      question: 'Does MooScript use GSAP or require a commercial animation license?',
      answer:
        'No. MooScript runs on MooTween, our clean-room deterministic timeline and spring engine built specifically for frame-accurate SVG and DOM motion. Every video you render is free from third-party animation engine fees.'
    },
    {
      question: 'How does MooScript export MP4 and transparent WebM without a backend server?',
      answer:
        'MooScript steps your composition deterministically frame by frame, draws each vector state onto an HTML5 Canvas alongside decoded B-roll frames, and feeds hardware VideoEncoder and AudioEncoder pipelines via WebCodecs and mediabunny.'
    },
    {
      question: 'Can I overlay MooScript animations inside Premiere, DaVinci Resolve, or CapCut?',
      answer:
        'Yes. Choose Transparent WebM (VP9 + Alpha) in the export rack to strip the stage background and output a crisp alpha-channel overlay, or load up to 300 MB of B-roll video directly underneath your shots inside MooScript.'
    },
    {
      question: 'Which AI models work best with MooScript Studio?',
      answer:
        'Inside Studio you can connect Gemini, OpenAI, Anthropic Claude, DeepSeek, Groq, or OpenRouter with your own API key, or copy our official AI System Prompt into any chat assistant and paste the generated MooTween code back.'
    },
    {
      question: 'Can I generate voice-overs and sound effects completely offline?',
      answer:
        'Yes. MooScript bundles an in-browser Piper ONNX neural TTS engine for offline narration, synthesizes procedural whoosh, pop, riser, and impact SFX automatically on cuts, and aligns shot cuts to music beats.'
    },
    {
      question: 'Which browsers support hardware WebCodecs rendering?',
      answer:
        'Chromium-based browsers including Chrome 94+, Edge 94+, Brave, and Arc support full hardware MP4 and WebM encoding, plus animated GIF, Cover PNG, standalone HTML player, and SRT/VTT caption export.'
    }
  ],
  id: [
    {
      question: 'Apakah MooScript memakai GSAP atau terikat lisensi animasi berbayar?',
      answer:
        'Tidak. MooScript berjalan di atas MooTween, mesin timeline deterministik dan fisika pegas buatan sendiri yang dirancang khusus untuk adegan SVG dan DOM. Seluruh video hasil ekspor bebas dari batasan lisensi engine pihak ketiga.'
    },
    {
      question: 'Bagaimana MooScript mengekspor MP4 dan WebM transparan tanpa server cloud?',
      answer:
        'MooScript memajukan waktu adegan secara presisi per frame, menggambar elemen vektor serta frame B-roll ke HTML5 Canvas, lalu menyandikannya langsung di GPU perangkat Anda menggunakan WebCodecs dan pustaka mediabunny.'
    },
    {
      question: 'Bisakah animasi MooScript dijadikan overlay transparan di CapCut atau DaVinci Resolve?',
      answer:
        'Bisa. Pilih format WebM Transparan (VP9 + Alpha) saat ekspor untuk menghasilkan video dengan kanal alfa bersih tanpa latar belakang, atau masukkan langsung video B-roll hingga 300 MB ke bawah adegan di dalam MooScript.'
    },
    {
      question: 'Model AI apa saja yang didukung oleh MooScript Studio?',
      answer:
        'Anda dapat menghubungkan API key pribadi untuk Gemini, OpenAI, Claude, DeepSeek, Groq, atau OpenRouter langsung di Studio, atau menyalin System Prompt resmi kami ke chatbot AI favorit lalu menempelkan kodenya.'
    },
    {
      question: 'Apakah pengisi suara dan efek suara otomatis bisa berjalan tanpa internet?',
      answer:
        'Bisa. MooScript menyertakan mesin suara saraf Piper ONNX yang berjalan offline di browser, merakit efek suara otomatis (whoosh, pop, riser, impact) sesuai gerakan visual, dan menyelaraskan cut ke ketukan musik.'
    },
    {
      question: 'Browser apa yang direkomendasikan untuk ekspor video WebCodecs?',
      answer:
        'Gunakan browser berbasis Chromium seperti Google Chrome 94+, Microsoft Edge 94+, Brave, atau Arc di desktop untuk menikmati akselerasi GPU penuh untuk MP4, WebM Alpha, GIF animasi, Cover PNG, dan subtitle SRT/VTT.'
    }
  ]
};
