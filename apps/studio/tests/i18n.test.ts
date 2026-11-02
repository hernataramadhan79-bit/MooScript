import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { EN } from '../src/i18n/en';
import { getStarterTemplates } from '@mooscript/presets';
import { detectLocale, getLocale, setLocale, t, tr } from '../src/i18n';
import { foreignApiMessage, validateGeneratedScene } from '../src/engine/composition/validator';

const SRC = path.resolve(__dirname, '../src');

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full) : [full];
  });
}

/** Every literal passed to t() / L() in the app source. */
function collectKeys(): Map<string, string> {
  const keys = new Map<string, string>();
  for (const file of walk(SRC).filter((f) => /\.tsx?$/.test(f) && !/[\\/]i18n[\\/]/.test(f))) {
    const sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visit = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        (node.expression.text === 't' || node.expression.text === 'L' || node.expression.text === 'lf') &&
        node.arguments.length > 0 &&
        (ts.isStringLiteral(node.arguments[0]) || ts.isNoSubstitutionTemplateLiteral(node.arguments[0]))
      ) {
        keys.set((node.arguments[0] as ts.StringLiteral).text, path.relative(SRC, file));
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return keys;
}

const INDONESIAN_WORD =
  /\b(tidak|dengan|yang|untuk|pada|gagal|sedang|silakan|dari|atau|belum|bisa|dapat|adegan|suara|berhasil|hapus|tambah|simpan|ukuran|pilih|buat|unggah|unduh|batal|tutup|selesai|siap|proyek|naskah|ekspor|pengaturan)\b/i;

const placeholders = (s: string) => (s.match(/\{\d+\}/g) ?? []).sort().join(',');

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('english dictionary', () => {
  const keys = collectKeys();

  it('finds the translation keys', () => {
    expect(keys.size).toBeGreaterThan(500);
  });

  it('translates every Indonesian source string', () => {
    const missing = [...keys].filter(([key]) => !(key in EN) && INDONESIAN_WORD.test(key)).map(([key, file]) => `${file}: ${key}`);
    expect(missing).toEqual([]);
  });

  it('has no entry for a string the app no longer uses', () => {
    const stale = Object.keys(EN).filter((key) => !keys.has(key));
    expect(stale).toEqual([]);
  });

  it('keeps the {n} placeholders of the source text', () => {
    const broken = Object.entries(EN)
      .filter(([key, value]) => placeholders(key) !== placeholders(value))
      .map(([key]) => key);
    expect(broken).toEqual([]);
  });
});

describe('t()', () => {
  it('returns the source text in Indonesian and the translation in English', () => {
    setLocale('id');
    expect(t('Batalkan pilihan layer')).toBe('Batalkan pilihan layer');
    setLocale('en');
    expect(t('Batalkan pilihan layer')).toBe('Deselect layer');
    setLocale('id');
  });

  it('fills {n} placeholders and falls back to the source when untranslated', () => {
    setLocale('en');
    expect(t('Adegan #{0} dihapus. Tekan Ctrl+Z untuk mengembalikan.', 4)).toBe(
      'Scene #4 deleted. Press Ctrl+Z to restore it.'
    );
    expect(t('Teks yang belum diterjemahkan {0}', 'x')).toBe('Teks yang belum diterjemahkan x');
    setLocale('id');
  });

  it('notifies nothing when the locale is unchanged', () => {
    setLocale('id');
    setLocale('id');
    expect(getLocale()).toBe('id');
  });
});

describe('tr()', () => {
  afterEach(() => setLocale('id'));

  it('leaves messages alone in Indonesian', () => {
    setLocale('id');
    expect(tr('Scene kosong: HTML tidak boleh kosong')).toBe('Scene kosong: HTML tidak boleh kosong');
  });

  it('translates validation errors and the parts captured inside them', () => {
    setLocale('en');
    expect(tr('Scene kosong: HTML tidak boleh kosong')).toBe('Empty scene: the HTML must not be empty');
    expect(tr('Sintaks JavaScript tidak valid: x is not defined')).toBe('Invalid JavaScript syntax: x is not defined');
    expect(tr(foreignApiMessage('yoyo'))).toBe('Not a MooScript API: yoyo — replace yoyo → pingpong');
  });

  it('keeps the messages sent to the AI in Indonesian whatever the interface language', () => {
    setLocale('en');
    const { errors } = validateGeneratedScene({ html: '<div></div>', buildJs: 'eval("1")' });
    expect(errors.some((e) => e.startsWith('Larangan keamanan'))).toBe(true);
  });
});

describe('starter templates', () => {
  it('has an English version of every Indonesian starter, with the same scenes', () => {
    const id = getStarterTemplates('id');
    const en = getStarterTemplates('en');
    expect(en.map((tpl) => tpl.id)).toEqual(id.map((tpl) => tpl.id));
    en.forEach((tpl, i) => {
      expect(tpl.scenes.length).toBe(id[i].scenes.length);
      expect(tpl.title.length).toBeGreaterThan(0);
    });
    expect(en[0].title).toBe('Three Quick Facts');
  });
});

describe('detectLocale()', () => {
  const stubBrowser = (languages: string[], timeZone: string) => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('navigator', { languages, language: languages[0] });
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({ timeZone } as Intl.ResolvedDateTimeFormatOptions);
  };

  it('picks Indonesian for visitors in Indonesia, whatever the browser language', () => {
    for (const zone of ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura', 'Asia/Pontianak']) {
      stubBrowser(['en-US'], zone);
      expect(detectLocale()).toBe('id');
    }
  });

  it('picks Indonesian when the browser prefers Indonesian', () => {
    stubBrowser(['id-ID', 'en'], 'Europe/Amsterdam');
    expect(detectLocale()).toBe('id');
  });

  it('picks English for visitors outside Indonesia', () => {
    stubBrowser(['en-US'], 'America/New_York');
    expect(detectLocale()).toBe('en');
    stubBrowser(['ms-MY'], 'Asia/Kuala_Lumpur');
    expect(detectLocale()).toBe('en');
  });

  it('keeps the source language outside a browser', () => {
    vi.stubGlobal('window', undefined);
    expect(detectLocale()).toBe('id');
  });
});
