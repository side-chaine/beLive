// F38: Parsing functions extracted from lyrics-display.js
// Pure functions — zero DOM deps, zero this.* deps

export function basicTextCleanup(text: string): string {
  if (!text) return '';
  let cleaned = text.replace(/[^\x20-\x7E\nа-яА-ЯёЁ]/g, '');
  cleaned = cleaned.replace(/\\{1,}/g, '\n');
  cleaned = cleaned.replace(/\s{2,}/g, ' ');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  return cleaned;
}

export function parseLrcFile(lrcText: string): string {
  if (!lrcText) return '';
  const lines = lrcText.split(/\r?\n/);
  const result: string[] = [];
  const timeTagRegex = /\[\d+:\d+(\.\d+)?\]/g;
  for (const line of lines) {
    const textOnly = line.replace(timeTagRegex, '').trim();
    if (textOnly && !textOnly.startsWith('[')
        && !textOnly.match(/^\[(ar|ti|al|by|offset):/i)) {
      result.push(textOnly);
    }
  }
  return result.join('\n');
}

export function detectLanguage(text: string): string {
  if (!text) return 'unknown';
  const cyrillicChars = (text.match(/[а-яА-ЯёЁ]/g) || []).length;
  const latinChars = (text.match(/[a-zA-Z]/g) || []).length;
  const russianKeywords = ['и', 'в', 'на', 'с', 'за', 'к', 'по', 'от', 'из', 'у'];
  const englishKeywords = ['and', 'the', 'a', 'an', 'of', 'to', 'in', 'on', 'at', 'for'];
  let russianKw = 0, englishKw = 0;
  const words = text.toLowerCase().match(/\b[а-яёa-z]+\b/g) || [];
  words.forEach(w => {
    if (russianKeywords.includes(w)) russianKw++;
    if (englishKeywords.includes(w)) englishKw++;
  });
  if (cyrillicChars > latinChars * 0.5 || russianKw > englishKw) return 'russian';
  if (latinChars > 0) return 'english';
  return 'mixed';
}

export function extractLinesDirectlyFromRtf(rtfText: string): string[] {
  if (!rtfText) return [];
  const lines: string[] = [];
  const rtfLines = rtfText.split(/\\par\s?|\n/);
  for (let line of rtfLines) {
    line = line.replace(/\\[a-z]+\d*\s?/g, '');
    line = line.replace(/\\\*[^{}\r\n]*/g, '');
    line = line.replace(/\\[\\\{\}]/g, '');
    line = line.replace(/[\{\}]/g, '');
    line = line.replace(/\\'([0-9a-fA-F]{2})/g, (_m, hex) =>
      String.fromCharCode(parseInt(hex, 16)));
    line = line.replace(/[\x00-\x1F]/g, '');
    if (line.trim().length > 0) lines.push(line.trim());
  }
  return lines;
}

export function detectTextLanguage(text: string): string {
  if (!text || text.length < 10) return 'unknown';
  let clean = text;
  if (text.includes('\\rtf')) {
    clean = text.replace(/\\[a-z]+\d*\s?/g, '');
    clean = clean.replace(/\\\*[^{}\r\n]*/g, '');
    clean = clean.replace(/\\[\\\{\}]/g, '');
    clean = clean.replace(/[\{\}]/g, '');
  }
  const ruCount = (clean.match(/[а-яёА-ЯЁ]/g) || []).length;
  const enCount = (clean.match(/[a-zA-Z]/g) || []).length;
  const ruKw = ['и','в','на','с','для','не','что','это','я','ты','он','она','мы','вы','они'];
  const enKw = ['and','in','on','with','for','not','that','this','i','you','he','she','we','they'];
  let ruKwC = 0, enKwC = 0;
  const words = clean.toLowerCase().split(/\s+/);
  for (const w of words) {
    if (ruKw.includes(w)) ruKwC++;
    if (enKw.includes(w)) enKwC++;
  }
  if (ruCount > enCount || ruKwC > enKwC) return 'russian';
  return 'english';
}

export function improveRussianLines(lines: string[]): string[] {
  const result: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.length === 0) continue;
    if (/^\s*[;:,.\\/#!$%^&*;:{}=\-_`~()]+\s*$/.test(line)) continue;
    if (line.length <= 2 && ['и','в','с','а','о','у','к'].includes(line)) {
      if (i < lines.length - 1) {
        lines[i + 1] = line + ' ' + lines[i + 1];
        continue;
      }
    }
    result.push(line);
  }
  return result;
}

export function improveEnglishLines(lines: string[]): string[] {
  const result: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.length === 0) continue;
    if (/^\s*[;:,.\\/#!$%^&*;:{}=\-_`~()]+\s*$/.test(line)) continue;
    if (line.length <= 2 && ['a','A','I','i'].includes(line)) {
      if (i < lines.length - 1) {
        lines[i + 1] = line + ' ' + lines[i + 1];
        continue;
      }
    }
    const endsWithPrep = /\b(at|in|of|to|by|for|with|on)\s*$/.test(line.toLowerCase());
    if (endsWithPrep && i < lines.length - 1) {
      const match = line.match(/\b(at|in|of|to|by|for|with|on)\s*$/i);
      if (match) {
        const prep = match[1];
        const newLine = line.substring(0, line.length - prep.length).trim();
        lines[i + 1] = prep + ' ' + lines[i + 1];
        result.push(newLine);
        continue;
      }
    }
    result.push(line);
  }
  return result;
}

export function improveRussianText(text: string): string {
  if (!text) return '';
  let improved = text.replace(/([.!?])\s*(?=[А-ЯЁ])/g, '$1\n');
  improved = improved.replace(/([а-яёА-ЯЁ])([А-ЯЁ])/g, '$1 $2');
  improved = improved.replace(/([,.!?:;])([а-яёА-ЯЁ])/g, '$1 $2');
  improved = improved.replace(/\s{2,}/g, ' ');
  improved = improved.replace(/\n{3,}/g, '\n\n');
  return improved;
}

export function improveEnglishText(text: string): string {
  if (!text) return '';
  let improved = text.replace(/([.!?])\s*(?=[A-Z])/g, '$1\n');
  improved = improved.replace(/([a-zA-Z])([A-Z])/g, '$1 $2');
  improved = improved.replace(/(Yeah|Oh|Yeah,|Oh,)(?=[A-Z])/g, '$1\n');
  improved = improved.replace(/(?<=\w)([,\.!?])(?=\s[A-Z])/g, '$1\n');
  improved = improved.replace(/Flying at the speed of light(?=\s*Thoughts)/i, 'Flying at the speed of light\n');
  improved = improved.replace(/It's out of my control(?=\s*Flying)/i, "It's out of my control\n");
  improved = improved.replace(/This is not what I had planned(?=\s*It's)/i, 'This is not what I had planned\n');
  improved = improved.replace(/(?<=\w)(\s+)(And the sun will set for you)/g, '\n\n$2');
  improved = improved.replace(/(?<=\w)(\s+)(Crawling in my skin)/g, '\n\n$2');
  improved = improved.replace(/(?<=\w)(\s+)(When my time comes)/g, '\n\n$2');
  improved = improved.replace(/(?<=\w)(\s+)(Waiting for the end)/g, '\n\n$2');
  improved = improved.replace(/\s{2,}/g, ' ');
  improved = improved.replace(/\n{3,}/g, '\n\n');
  return improved;
}

export function cleanText(text: string): string {
  if (!text) return '';
  // F39 Bug #18: fake RTF from TextEdit (Markdown with .rtf extension)
  // If text has ** (bold) but no {\rtf header → strip Markdown, treat as plain
  if (text.includes('**') && !text.trimStart().startsWith('{\\rtf')) {
    let plain = text.replace(/\*\*([^*]*)\*\*/g, '$1');  // strip bold **
    plain = plain.replace(/\*([^*]*)\*/g, '$1');          // strip italic *
    plain = plain.replace(/\\\s*$/gm, '');                // strip trailing \
    plain = plain.replace(/\\\s*\n/g, '\n');              // strip \ before newline
    return plain.trim();
  }
  const isRtf = text.includes('\\rtf') || text.includes('{\\');
  const isBOM = text.charCodeAt(0) === 0xFEFF;
  let cleaned = text;
  if (isBOM) cleaned = cleaned.slice(1);
  if (!isRtf) {
    cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
    cleaned = cleaned.replace(/\r(?!\n)/g, ' ');
    cleaned = cleaned.replace(/\r\n/g, '\n');
    cleaned = cleaned.replace(/[ \t]+/g, ' ');
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    if (cleaned.includes('\\')) cleaned = cleaned.replace(/\\+/g, '\n');
  }
  return cleaned;
}

export function intelligentLineSplitting(text: string): string[] {
  if (!text) return [];
  if (text.includes('. ') && text.split('. ').length > 3) {
    const ls = text.split('. ').map(l => l.trim()).filter(l => l.length > 0);
    if (ls.length >= 3) return ls.map(l => l.endsWith('.') ? l : l + '.');
  }
  let processed = text;
  processed = processed.replace(/([.!?])\s+([A-ZА-ЯЁ])/g, '$1\n$2');
  processed = processed.replace(/([a-zа-яё])\s+([A-ZА-ЯЁ][a-zа-яё]{2,})/g, '$1\n$2');
  const songPat = ['Chorus','Verse','Bridge','Припев','Куплет','Бридж','Yeah','Oh','Woah','Hey'];
  songPat.forEach(p => { processed = processed.replace(new RegExp(`\\b${p}\\b`, 'g'), `\n${p}`); });
  let lines = processed.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length < 3) {
    processed = text.replace(/,\s+/g, ',\n');
    lines = processed.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length < 3) {
      const newLines: string[] = [];
      lines.forEach(line => {
        if (line.length > 40) {
          const parts: string[] = [];
          let si = 0;
          const bps = [...line.matchAll(/[\s,.;:!?]/g)].map(m => m.index!);
          for (const bp of bps) {
            if (bp - si > 30) { parts.push(line.substring(si, bp).trim()); si = bp + 1; }
          }
          if (si < line.length) parts.push(line.substring(si).trim());
          newLines.push(...(parts.length > 0 ? parts : [line]));
        } else { newLines.push(line); }
      });
      return newLines;
    }
  }
  return lines;
}

export function parseRtfUniversal(rtfText: string): string {
  if (!rtfText) return '';
  try {
    let text = rtfText;
    text = text.replace(/\\par\s?/g, '\n');
    text = text.replace(/\\line\s?/g, '\n');
    text = text.replace(/\{\\rtf[^{}]*/, '');
    text = text.replace(/\{\\colortbl[^{}]*\}/g, '');
    text = text.replace(/\{\\fonttbl[^{}]*\}/g, '');
    text = text.replace(/\{\\stylesheet[^{}]*\}/g, '');
    text = text.replace(/\{\\[^{}]*\}/g, '');
    text = text.replace(/\\f\d+/g, '');
    text = text.replace(/\\fs\d+/g, '');
    text = text.replace(/\\cf\d+/g, '');
    text = text.replace(/\\[a-z]+\d*/g, ' ');
    text = text.replace(/\\'([0-9a-fA-F]{2})/g, (_m, hex) => {
      try { return String.fromCharCode(parseInt(hex, 16)); } catch { return ''; }
    });
    text = text.replace(/\\u(\d+)\s?/g, (_m, code) => {
      try { const c = parseInt(code, 10); return String.fromCharCode(c < 0 ? c + 65536 : c); } catch { return ''; }
    });
    text = text.replace(/[{}\\]/g, '');
    text = text.replace(/\s{2,}/g, ' ');
    text = text.replace(/\n{3,}/g, '\n\n');
    text = text.replace(/^\s+/mg, '');
    text = text.replace(/^[^a-zA-Zа-яА-ЯёЁ0-9]+\s*/m, '');
    return text;
  } catch { return ''; }
}

export function extractUnicodeFromRtf(rtfText: string): string {
  if (!rtfText) return '';
  const unicodeRegex = /\\u(\d+)\s?/g;
  let extracted = '';
  let match: RegExpExecArray | null;
  while ((match = unicodeRegex.exec(rtfText)) !== null) {
    const c = parseInt(match[1], 10);
    if (c > 0) extracted += String.fromCharCode(c < 0 ? c + 65536 : c);
  }
  return extracted.length > 0 ? improveRussianText(extracted) : extracted;
}

export function convertUnicodeCodesToChars(text: string): string {
  if (!text) return '';
  let r = text;
  r = r.replace(/\\u([0-9a-fA-F]{4})/g, (_m, code) => {
    try { return String.fromCharCode(parseInt(code, 16)); } catch { return _m; }
  });
  r = r.replace(/\\u-([0-9a-fA-F]+)/g, (_m, code) => {
    try { return String.fromCharCode(65536 - parseInt(code, 10)); } catch { return _m; }
  });
  r = r.replace(/\\u([0-9]+)\?/g, (_m, code) => {
    try { return String.fromCharCode(parseInt(code, 10)); } catch { return _m; }
  });
  r = r.replace(/\\'([0-9a-fA-F]{2})/g, (_m, hex) => {
    try {
      const cc = parseInt(hex, 16);
      if (cc >= 0xC0 && cc <= 0xFF) return String.fromCharCode(cc + 0x350);
      if (cc === 0xA8) return 'Ё';
      if (cc === 0xB8) return 'ё';
      return String.fromCharCode(cc);
    } catch { return _m; }
  });
  return cleanText(r);
}

export function extractStructuredContentFromRtf(rtfText: string): string | null {
  if (!rtfText || rtfText.length < 10) return null;
  try {
    let text = rtfText;
    text = text.replace(/^\{\\rtf1[^{}]*/, '');
    text = text.replace(/\{\\colortbl[^{}]*\}/g, '');
    text = text.replace(/\{\\fonttbl[^{}]*\}/g, '');
    text = text.replace(/\{\\stylesheet[^{}]*\}/g, '');
    text = text.replace(/\\par\s?/g, '###NL###');
    text = text.replace(/\\line\s?/g, '###NL###');
    text = text.replace(/\{\\[^{}]*\}/g, '');
    const fmtCmds = [/\\f\d+\s?/g,/\\fs\d+\s?/g,/\\cf\d+\s?/g,/\\b\s?/g,/\\i\s?/g,
      /\\ul\s?/g,/\\strike\s?/g,/\\super\s?/g,/\\sub\s?/g,/\\qc\s?/g,/\\ql\s?/g,
      /\\qr\s?/g,/\\li\d+\s?/g,/\\ri\d+\s?/g,/\\fi\d+\s?/g,/\\sb\d+\s?/g,
      /\\sa\d+\s?/g,/\\sl\d+\s?/g];
    fmtCmds.forEach(r => { text = text.replace(r, ''); });
    text = text.replace(/\\[a-z]+\d*\s?/g, ' ');
    text = text.replace(/\\'([0-9a-fA-F]{2})/g, (_m, h) => {
      try { return String.fromCharCode(parseInt(h, 16)); } catch { return ''; }
    });
    text = text.replace(/\\u(\d+)\s?/g, (_m, c) => {
      try { const n = parseInt(c,10); return String.fromCharCode(n < 0 ? n+65536 : n); } catch { return ''; }
    });
    text = text.replace(/###NL###/g, '\n');
    text = text.replace(/[{}\\]/g, '');
    text = text.replace(/[\x00-\x1F]/g, '');
    text = text.replace(/^\s+/gm, '').replace(/\s+$/gm, '');
    text = text.replace(/\n{3,}/g, '\n\n');
    const lines = text.split('\n');
    let start = 0;
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const l = lines[i].trim();
      if (!l.length) { start = i+1; continue; }
      const isMeta = /^[^a-zA-Zа-яА-ЯёЁ0-9]+$/.test(l)
        || /^[a-zA-Z]+;(\s*;)*$/.test(l)
        || /^[\d.]+$/.test(l)
        || /^[a-zA-Z\s]+:/.test(l);
      if (!isMeta) { start = i; break; }
      start = i+1;
    }
    return lines.slice(start).join('\n');
  } catch { return null; }
}

export function sanitizeRussianText(text: string, isRtfContent: boolean): string {
  if (!text) return '';
  let s = text;
  if (isRtfContent) {
    const structured = extractStructuredContentFromRtf(text);
    if (structured && structured.trim().length >= 20) { s = structured; }
    else {
      const unicode = extractUnicodeFromRtf(text);
      if (unicode) s = unicode;
    }
  }
  s = s.replace(/\\rtf1/g, '').replace(/\\ansi/g, '');
  s = s.replace(/\\ansicpg\d+/g, '').replace(/\\deff\d+/g, '');
  s = s.replace(/\\deflang\d+/g, '').replace(/\\deflangfe\d+/g, '');
  s = s.replace(/\\uc\d+/g, '').replace(/\\pard/g, '');
  s = s.replace(/\\par/g, '\n').replace(/\\tab/g, '\t');
  s = s.replace(/\\f\d+/g, '').replace(/\\fs\d+/g, '').replace(/\\cf\d+/g, '');
  s = s.replace(/\\'[0-9a-f]{2}/g, '');
  s = s.replace(/\\[a-z]+\d*/g, '').replace(/[{}]/g, '');
  return improveRussianText(s);
}

export function sanitizeEnglishText(text: string, isRtfContent: boolean): string {
  if (!text) return '';
  let s = text;
  if (isRtfContent) {
    const structured = extractStructuredContentFromRtf(text);
    if (structured) s = structured;
  }
  s = s.replace(/\\rtf1/g, '').replace(/\\ansi/g, '');
  s = s.replace(/\\ansicpg\d+/g, '').replace(/\\deff\d+/g, '');
  s = s.replace(/\\deflang\d+/g, '').replace(/\\deflangfe\d+/g, '');
  s = s.replace(/\\uc\d+/g, '').replace(/\\pard/g, '');
  s = s.replace(/\\par/g, '\n').replace(/\\tab/g, '\t');
  s = s.replace(/\\f\d+/g, '').replace(/\\fs\d+/g, '').replace(/\\cf\d+/g, '');
  s = s.replace(/\s{2,}/g, ' ').replace(/[\x00-\x1F]/g, '');
  return improveEnglishText(s);
}

export function sanitizeLyricsText(text: string): string {
  if (!text) return '';
  const isRtf = text.includes('\\rtf') || text.includes('\\f') ||
    text.includes('\\pard') || text.includes('\\ansi') ||
    text.includes('cocoartf') || text.includes('ansicpg');
  const language = detectTextLanguage(text);
  if (language === 'russian' && isRtf) {
    const u = extractUnicodeFromRtf(text);
    if (u && u.length > 20) return u;
  }
  if (isRtf) {
    const e = extractStructuredContentFromRtf(text);
    if (e && e.length > 20) return e;
  }
  const sanitized = language === 'english'
    ? sanitizeEnglishText(text, isRtf)
    : sanitizeRussianText(text, isRtf);
  if (!sanitized || sanitized.trim().length < 20) {
    if (isRtf) {
      const lines = extractLinesDirectlyFromRtf(text);
      if (lines && lines.length > 3) return lines.join('\n');
    }
    return text;
  }
  return sanitized;
}

export interface ParsedBlock {
  id: string;
  name: string;
  lineIndices: number[];
  type?: string;
}

export function sanitizeBlocks(blocks: unknown[], lyricsLength: number): ParsedBlock[] {
  const seen = new Set<string>();
  const result: ParsedBlock[] = [];
  const allowed = new Set(['verse','chorus','bridge','prechorus','interlude','intro','outro']);
  (blocks || []).forEach((blk: any, idx: number) => {
    if (!blk || !Array.isArray(blk.lineIndices) || !blk.lineIndices.length) return;
    const sorted = [...blk.lineIndices].sort((a: number, b: number) => a - b)
      .filter((v: number, i: number, arr: number[]) =>
        (i === 0 || v !== arr[i-1]) && v >= 0 && v < lyricsLength);
    if (!sorted.length) return;
    const key = `${sorted[0]}-${sorted[sorted.length-1]}`;
    if (seen.has(key)) return;
    seen.add(key);
    const raw = typeof blk.type === 'string' ? blk.type.toLowerCase() : undefined;
    const type = raw && allowed.has(raw) ? raw : undefined;
    result.push({
      id: blk.id || `blk-${idx}-${sorted[0]}`,
      name: blk.name || `Block ${idx+1}`,
      lineIndices: sorted,
      ...(type ? { type } : {})
    });
  });
  return result;
}

export function rtfToText(rtfContent: string): string {
  if (typeof rtfContent !== 'string') return '';
  let t = rtfContent;
  t = t.replace(/^\{\\rtf1[^{}]*\}/, '');
  t = t.replace(/\{\\.*?\}/g, '');
  t = t.replace(/\\ansicpg\d+/g, '');
  t = t.replace(/\\deff?\d+/g, '');
  t = t.replace(/\\nouicompat/g, '');
  t = t.replace(/\\par\b\s*\\par\b/g, '\n\n');
  t = t.replace(/\\line\b\s*\\line\b/g, '\n\n');
  t = t.replace(/\\par\b/g, '\n');
  t = t.replace(/\\line\b/g, '\n');
  t = t.replace(/\\u(-?\d+)\??/g, (_, c) => {
    let n = parseInt(c, 10);
    if (n < 0) n = 65536 + n;
    return String.fromCharCode(n);
  });
  try {
    const dec = new TextDecoder('windows-1251');
    t = t.replace(/\\'([0-9A-Fa-f]{2})/g, (_, h) =>
      dec.decode(new Uint8Array([parseInt(h, 16)])));
  } catch {
    t = t.replace(/\\'([0-9A-Fa-f]{2})/g,
      (_, h) => String.fromCharCode(parseInt(h, 16)));
  }
  t = t.replace(/\\[a-zA-Z]+-?\d*\s?/g, '');
  t = t.replace(/[{}]/g, '');
  t = t.replace(/\n{3,}/g, '\n\n');
  t = t.replace(/\\\s*$/gm, '');
  t = t.replace(/^\s*\\\s*$/gm, '');
  t = t.replace(/\\\s*\n/g, '\n');
  return t.trim();
}
