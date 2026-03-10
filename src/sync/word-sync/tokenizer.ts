export type TokenizedWord = {
  text: string;
  normalizedText: string;
  wordIndex: number;
  charStart: number;
  charEnd: number;
};

export function normalizeWord(text: string): string {
  return text
    .toLowerCase()
    .replace(/^[^\p{L}\p{N}'-]+|[^\p{L}\p{N}'-]+$/gu, '');
}

export function tokenizeLine(line: string): TokenizedWord[] {
  const result: TokenizedWord[] = [];
  const re = /\S+/gu;
  let match: RegExpExecArray | null;
  let wordIndex = 0;

  while ((match = re.exec(line)) !== null) {
    const text = match[0];
    const normalizedText = normalizeWord(text);
    result.push({
      text,
      normalizedText,
      wordIndex,
      charStart: match.index,
      charEnd: match.index + text.length,
    });
    wordIndex++;
  }

  return result;
}
