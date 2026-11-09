/**
 * Контекст трека для AI Coach.
 *
 * Собираем только то, что реально измерено сенсорами и сторами.
 * Нет данных — строки нет. Пустая строка честнее выдуманной.
 */

import { useAudioStore } from '../../stores/audio.store';
import { useBlocksStore } from '../../stores/blocks.store';
import { useLyricsStore } from '../../stores/lyrics.store';
import { useMarkersStore } from '../../stores/markers.store';
import { usePitchStore } from '../../stores/pitch.store';
import { useTrackStore } from '../../stores/track.store';
import { useWordSyncStore } from '../../stores/wordSync.store';
import { useStemStore } from '../../stem/stem.store';
import { getStructureFormula } from '../../utils/structure-formula';
import type { Message } from '../../js/ai/types';
import { AI_COACH_SYSTEM_PROMPT, AI_COACH_HISTORY_LIMIT } from './ai-coach.prompt';
import type { AiCoachMessage } from './ai-coach.store';

const formatTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const formatCents = (cents: number): string =>
  `${cents >= 0 ? '+' : ''}${Math.round(cents)}¢`;

/** Секция, в которой сейчас находится плейхед. */
function activeSectionLabel(time: number): string | null {
  const sections = useMarkersStore.getState().sections;
  if (!sections.length) return null;

  const section = sections.find(
    (s) => time >= s.start && (s.end === null || time < s.end),
  );
  return section ? section.label || section.type : null;
}

/**
 * Снимок состояния артиста в одном текстовом блоке.
 * Возвращает пустую строку, если о треке неизвестно ничего.
 */
export function buildTrackContext(): string {
  const track = useTrackStore.getState().currentTrack;
  const audio = useAudioStore.getState();
  const lyrics = useLyricsStore.getState();
  const pitch = usePitchStore.getState();
  const blocks = useBlocksStore.getState().blocks;
  const stems = useStemStore.getState();

  const lines: string[] = [];

  if (track?.title) {
    lines.push(`Трек: ${track.artist ? `${track.artist} — ` : ''}${track.title}`);
  }

  if (audio.duration > 0) {
    lines.push(
      `Позиция: ${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}` +
        ` · темп ${Math.round(audio.playbackRate * 100)}%` +
        ` · ${audio.isPlaying ? 'играет' : 'на паузе'}`,
    );
  }

  const section = activeSectionLabel(audio.currentTime);
  if (section) lines.push(`Секция: ${section}`);

  const lineText = lyrics.lines[lyrics.activeLineIndex];
  if (lineText) {
    lines.push(`Строка ${lyrics.activeLineIndex + 1}: «${lineText.trim()}»`);

    const word = useWordSyncStore
      .getState()
      .getActiveWordForLine(lyrics.activeLineIndex, audio.currentTime);
    if (word?.text) {
      lines.push(`Слово сейчас: «${word.text}» (${formatTime(word.start)})`);
    }
  }

  if (pitch.isSinging && pitch.note) {
    lines.push(
      `Питч: ${pitch.note} ${formatCents(pitch.cents)}` +
        ` · уверенность ${Math.round(pitch.confidence * 100)}%`,
    );
  } else if (pitch.status === 'running') {
    lines.push('Питч: микрофон включён, но голос сейчас не слышен');
  } else {
    lines.push('Питч: не измеряется (микрофон выключен)');
  }

  const formula = getStructureFormula(blocks);
  if (formula) lines.push(`Структура: ${formula}`);

  if (stems.loadedStems.length) {
    const muted = Object.entries(stems.stemMutes)
      .filter(([, isMuted]) => isMuted)
      .map(([id]) => id);
    const soloed = Object.entries(stems.stemSolos)
      .filter(([, isSolo]) => isSolo)
      .map(([id]) => id);

    let stemLine = `Стемы: ${stems.loadedStems.join(', ')}`;
    if (muted.length) stemLine += ` · приглушены: ${muted.join(', ')}`;
    if (soloed.length) stemLine += ` · соло: ${soloed.join(', ')}`;
    lines.push(stemLine);
  }

  return lines.join('\n');
}

/**
 * Полный список сообщений для модели:
 * системный промпт + измеренный контекст + последние реплики + текущий вопрос.
 */
export function buildCoachMessages(
  history: AiCoachMessage[],
  userText: string,
): Message[] {
  const context = buildTrackContext();
  const system = context
    ? `${AI_COACH_SYSTEM_PROMPT}\n\nКОНТЕКСТ:\n${context}`
    : AI_COACH_SYSTEM_PROMPT;

  const recent: Message[] = history
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-AI_COACH_HISTORY_LIMIT)
    .map((m) => ({ role: m.role, content: m.content }));

  return [
    { role: 'system', content: system },
    ...recent,
    { role: 'user', content: userText },
  ];
}
