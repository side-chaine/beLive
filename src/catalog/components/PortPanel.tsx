/**
 * Порт + Пульт — правая колонка каталога.
 *
 * Один вход: .zip уходит в существующий импорт (onZip), аудио — в First Path.
 * Под Портом всегда стоит Пульт: в пустом состоянии он показывает финальную
 * форму (7 серых стемов), в работе — стадию, таймер, очередь и плитки.
 *
 * Правило: ни одного выдуманного числа. Процента обработки не существует,
 * `eta_seconds` от MVSEP врёт (проверено живьём) — показываем только позицию
 * в очереди и прошедшее время.
 */

import { useEffect, useRef, useState } from 'react';
import { T } from '../theme';
import { useMvsepStore, getElapsedString } from '../../stores/mvsep.store';
import type { MvsepJobState } from '../../stores/mvsep.store';
import { isZipFile, MvsepError } from '../../services/mvsep.service';
import {
  startFirstPath,
  checkFirstPathFile,
  FIRST_PATH_REJECT_TEXT,
} from '../../services/first-path.service';
import type { FirstPathReject } from '../../services/first-path.service';

// Порядок и подписи — как в живом ответе MVSEP (sep_type 63): bass, drums, other,
// vocals, guitar, piano, instrum. Слот пианино в каталоге называется `keys`.
const STEMS: ReadonlyArray<readonly [string, string, string]> = [
  ['🎤', 'vocals', 'vocals'],
  ['🥁', 'drums', 'drums'],
  ['🎸', 'bass', 'bass'],
  ['🎸', 'guitar', 'guitar'],
  ['🎹', 'piano', 'keys'],
  ['🎛', 'other', 'other'],
  ['🎼', 'instrum', 'instrumental'],
];

// Цвет стема — свой у каждой дорожки. Зелёный занят «готово», оранжевый — «активно»,
// поэтому в палитру не входят. Вокал и инструментал повторяют фейдеры Voc/Inst.
const STEM_COLORS: ReadonlyArray<string> = [
  '#3b9eff', '#f5c542', '#9b59b6', '#ec5f9e', '#26c6da', '#9aa0a6', '#e74c3c',
];
const STEM_CODE = ['VOC', 'DRM', 'BAS', 'GTR', 'KEY', 'OTH', 'INSTRUM'];
const STEM_NAME = ['Вокал', 'Ударные', 'Бас', 'Гитара', 'Клавиши', 'Прочее', 'Инструментал'];

const RAIL = ['Отправлено', 'Очередь MVSEP', 'Разделение на стемы', 'Загрузка и сборка'];

/** Ghost-курсор показываем один раз за загрузку страницы, не за сессию. */
let ghostShown = false;

/**
 * Ступень пути: 0 — отправка, 1 — очередь, 2 — разделение, 3 — загрузка и сборка,
 * 4 — всё пройдено. Ровно те же четыре ступени, что в рейле и в списке под ним:
 * если разойдутся, человек увидит две разные карты одного пути.
 */
const stageOf = (job: MvsepJobState): number => {
  if (job.status === 'uploading') {return 0;}
  if (job.status === 'queued') {return 1;}
  if (job.status === 'processing') {return 2;}
  if (job.status === 'downloading' || job.status === 'importing') {return 3;}
  if (job.status === 'done') {return 4;}
  return 0;
};

/** Значения четырёх ступеней — только реальные данные, без выдуманных процентов. */
const stepValues = (job: MvsepJobState): ReadonlyArray<string> => {
  const stage = stageOf(job);
  const val = (i: number, active: string): string => {
    if (i < stage) {return '✓';}
    if (i > stage) {return '—';}
    return active;
  };
  return [
    val(0, '…'),
    val(1, job.queue ? `${job.queue.pos} из ${job.queue.total}` : ''),
    val(2, 'идёт'),
    val(3, job.status === 'importing'
      ? 'собираю'
      : `${
        job.downloadProgress.total > 0
          ? Math.min(job.downloadProgress.downloaded, job.downloadProgress.total)
          : 0
      } из ${STEMS.length}`),
  ];
};

const litCount = (job: MvsepJobState): number => {
  if (job.status === 'done') {return STEMS.length;}
  if (job.status === 'importing') {return STEMS.length;}
  if (job.status === 'downloading') {
    const { downloaded, total } = job.downloadProgress;
    if (total <= 0) {return 0;}
    return Math.min(STEMS.length, Math.round((downloaded / total) * STEMS.length));
  }
  return 0;
};

interface Props {
  /** .zip уходит в существующий импорт — Порт его не разбирает. */
  onZip: (file: File) => void;
  /** Заблокирован, пока идёт импорт архива. */
  zipBusy?: boolean;
  /** Прогресс импорта архива (0–100) — рисуем в Пульте вместо плиток. */
  zipProgress?: number;
}

const ZIP_STEPS: ReadonlyArray<readonly [string, number]> = [
  ['Чтение архива', 10],
  ['Импорт треков', 90],
  ['Финализация', 95],
];

export function PortPanel({ onZip, zipBusy, zipProgress = 0 }: Props) {
  const jobs = useMvsepStore((s) => s.activeJobs);
  const job = [...jobs.values()].find((j) => j.status !== 'failed' && j.status !== 'timeout') ?? null;

  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reject, setReject] = useState<FirstPathReject | null>(null);
  const [fail, setFail] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [ghost, setGhost] = useState(false);
  const [, forceTick] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  // Синхронный замок: `busy` — React-состояние и читается до перерисовки,
  // поэтому двойной клик успевал отправить два submit (две квоты, второй лок).
  const busyRef = useRef(false);
  // Итог последней джобы: поллер удаляет её из стора, и без снимка провал
  // исчезает молча — Пульт просто возвращается в пустое состояние.
  const [outcome, setOutcome] = useState<{ name: string; ok: boolean; text: string } | null>(null);

  // Таймер: обновляем раз в секунду, пока джоба жива. Прошедшее время — правда.
  useEffect(() => {
    if (!job) {return;}
    const id = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [job?.hash, job?.status]);

  // Снимок финала: подписка на стор, а не на рендер. stopPolling удаляет джобу
  // сразу после updateJobStatus('failed'), поэтому в разметке этот статус
  // не появляется вообще — провал исчезал молча.
  useEffect(() => {
    return useMvsepStore.subscribe((state, prev) => {
      for (const [hash, before] of prev.activeJobs) {
        if (state.activeJobs.has(hash)) {continue;}
        if (before.status === 'failed') {
          setOutcome({ name: before.fileName, ok: false, text: before.error || 'разделение не удалось' });
        } else if (before.status === 'done') {
          setOutcome({ name: before.fileName, ok: true, text: 'готово — трек в каталоге' });
        }
      }
    });
  }, []);

  // «Готово» гаснет само; ошибка висит до следующего действия пользователя.
  useEffect(() => {
    if (!outcome?.ok) {return;}
    const id = setTimeout(() => setOutcome(null), 6000);
    return () => clearTimeout(id);
  }, [outcome]);

  // Ghost-курсор: один раз за загрузку страницы, только на пустом Порте.
  useEffect(() => {
    if (job || ghostShown) {return;}
    const id = setTimeout(() => { setGhost(true); ghostShown = true; }, 1200);
    return () => clearTimeout(id);
  }, [job]);

  // Отказ не гаснет сам: раньше строка жила 4 секунды и человек, отвернувшись,
  // видел пустой Пульт — «ничего не произошло». Сбрасывается следующей попыткой.

  const handleFile = async (file: File) => {
    if (busyRef.current) {return;}
    setGhost(false);
    setHint(null);
    setOutcome(null);
    setReject(null);
    setFail(null);

    if (isZipFile(file.name)) {onZip(file); return;}

    const early = checkFirstPathFile(file);
    if (early) {setReject(early); return;}

    busyRef.current = true;
    setBusy(true);
    try {
      const res = await startFirstPath(file);
      if (!res.ok) {setReject(res.reason);}
    } catch (err) {
      // Серверные отказы приходят исключением — переводим в те же коды, что
      // и предпроверка, иначе пользователь видит «связь» вместо «лимит».
      const code = err instanceof MvsepError ? err.code : '';
      // В консоль — код как есть: по нему ищут причину, в интерфейсе он лишний.
      console.warn('[port] отправка не удалась:', code || err);
      if (code === 'CONCURRENT_LIMIT') {setReject('concurrent');}
      else if (code === 'MVSEP_LIMIT_REACHED') {setReject('limit_reached');}
      else if (code === 'MVSEP_KEY_INVALID') {setFail('MVSEP не принял ключ — проверь его в профиле');}
      else if (code === 'AUTH_REQUIRED') {setFail('сессия истекла — войди заново, без входа разделение недоступно');}
      else if (code === 'MVSEP_SUBMIT_ERROR_401') {setFail('MVSEP отклонил запрос (401) — это на стороне сервиса, повтори позже');}
      else {setFail('не удалось отправить — связь или сессия. Попробуй ещё раз.');}
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setOver(false);
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) {return;}
    // Пока идёт разделение, второй трек не берём: воркер всё равно держит лок.
    if (job || busy || zipBusy) {return;}
    void handleFile(files[0]);
  };

  const stage = job ? stageOf(job) : -1;
  const lit = job ? litCount(job) : 0;
  const steps = job ? stepValues(job) : null;
  const timer = job ? getElapsedString(job.submittedAt) : '';

  const statusText = (() => {
    if (zipBusy) {return `распаковываю архив · ${zipProgress}%`;}
    if (fail) {return fail;}
    if (reject) {return FIRST_PATH_REJECT_TEXT[reject];}
    if (busy) {return 'отправляю на разделение…';}
    if (!job) {return 'кинь трек — разделю его на 7 дорожек';}
    if (job.status === 'uploading') {return 'загружаю файл';}
    if (job.status === 'queued' || job.status === 'processing') {
      return 'можно закрыть Каталог — вкладку лучше оставить открытой';
    }
    if (job.status === 'downloading') {return 'забираю дорожки';}
    if (job.status === 'importing') {return 'складываю в каталог';}
    if (job.status === 'done') {return 'готово';}
    if (job.status === 'limit_reached') {return FIRST_PATH_REJECT_TEXT.limit_reached;}
    if (job.status === 'concurrent') {return FIRST_PATH_REJECT_TEXT.concurrent;}
    if (job.status === 'auth_required') {return FIRST_PATH_REJECT_TEXT.auth_required;}
    return 'ошибка';
  })();

  const hintFor = (): string => {
    if (!job) {return 'Стемы — это дорожки одного трека: вокал, барабаны, бас, гитара, клавиши, прочее и инструментал. Каждую можно включить отдельно.';}
    if (job.status === 'queued') {
      return 'MVSEP отдаёт позицию в очереди, но не ETA: поле eta_seconds не убывает. Показываем место и время ожидания.';
    }
    if (job.status === 'processing') {return 'Идёт разделение. Процента нет — движок его не сообщает, а выдумывать нельзя.';}
    return 'Дорожки качаются через наш воркер и сразу попадают в «МОЮ МУЗЫКУ».';
  };

  return (
    <div className="bl-port-anim" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* ── ПОРТ ─────────────────────────────────────────── */}
      <div
        onClick={() => { if (!job && !busy && !zipBusy) {setGhost(false); inputRef.current?.click();} }}
        onMouseEnter={() => setOver(true)}
        onMouseLeave={() => setOver(false)}
        onDragOver={(e) => { e.preventDefault(); if (!job && !busy && !zipBusy) {setOver(true);} }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        style={{
          position: 'relative',
          overflow: 'hidden',
          border: over ? `1.5px solid ${T.orange}` : `1.5px dashed ${T.border2}`,
          borderRadius: T.rL,
          background: over ? 'rgba(255,140,0,0.07)' : 'transparent',
          padding: job ? '7px 12px' : '18px 12px',
          cursor: job ? 'default' : 'pointer',
          transition: 'all 0.2s',
          minHeight: job ? 0 : 96,
          display: 'flex',
          alignItems: 'center',
          justifyContent: job ? 'space-between' : 'center',
          flexDirection: job ? 'row' : 'column',
          gap: job ? 0 : 6,
          textAlign: 'center',
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".zip,audio/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {void handleFile(file);}
            e.target.value = '';
          }}
        />

        {job ? (
          <>
            <span style={{ fontSize: 12, color: T.dim }}>▸ ПОРТ · брось ещё</span>
            <span style={{ fontFamily: 'ui-monospace,monospace', fontSize: 13, fontWeight: 600, color: T.orange }}>
              {timer}
            </span>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <div style={{ display: 'flex', gap: 1 }}>
                {['›', '›', '›'].map((c, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: 19, fontWeight: 700, lineHeight: 1,
                      color: over ? 'rgba(255,140,0,0.92)' : 'rgba(255,140,0,0.16)',
                      animation: over ? `bl-port-chev 1.4s ease-in-out ${0.36 - i * 0.18}s infinite` : undefined,
                    }}
                  >{c}</span>
                ))}
              </div>
              <div style={{
                fontSize: 26, fontWeight: 800, letterSpacing: '0.24em', lineHeight: 1,
                color: over ? T.orange : 'rgba(255,255,255,0.82)', transition: 'color 0.2s',
              }}>ПОРТ</div>
              <div style={{ display: 'flex', gap: 1 }}>
                {['‹', '‹', '‹'].map((c, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: 19, fontWeight: 700, lineHeight: 1,
                      color: over ? 'rgba(255,140,0,0.92)' : 'rgba(255,140,0,0.16)',
                      animation: over ? `bl-port-chev-r 1.4s ease-in-out ${i * 0.18}s infinite` : undefined,
                    }}
                  >{c}</span>
                ))}
              </div>
            </div>
            <div style={{ fontSize: 12.5, color: over ? 'rgba(255,140,0,0.85)' : '#9a9a9a' }}>
              {over ? 'отпускай — приму' : 'перетащи .zip или трек'}
            </div>
          </>
        )}

        {ghost && (
          <div style={{
            position: 'absolute', left: '16%', top: '46%',
            display: 'flex', alignItems: 'flex-start', gap: 2,
            pointerEvents: 'none', animation: 'bl-port-ghost 3.2s cubic-bezier(.5,.05,.5,.95) 1 forwards',
          }}>
            <svg width="15" height="19" viewBox="0 0 18 22">
              <path d="M2 1 L2 17 L6.5 13 L9.5 20 L12 19 L9 12 L14.5 12 Z" fill="#fff" stroke="#000" strokeWidth="1.2" />
            </svg>
            <span style={{ fontSize: 15, opacity: 0.5, transform: 'translate(-6px,-4px)' }}>🎵</span>
          </div>
        )}
      </div>

      {/* ── ПУЛЬТ ────────────────────────────────────────── */}
      <div style={{
        border: `1px solid ${T.border}`,
        borderRadius: T.rL,
        background: 'rgba(255,255,255,0.02)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 150,
      }}>
        {job && (
          <div style={{ padding: '9px 12px 4px' }}>
            <div style={{
              fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
              overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{job.fileName || 'трек'}</div>
          </div>
        )}

        {/* рельса стадий */}
        <div style={{ display: 'flex', alignItems: 'center', padding: job ? '4px 12px 2px' : '12px 12px 2px' }}>
          {RAIL.map((label, i) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', flex: i === RAIL.length - 1 ? '0 0 auto' : 1 }}>
              <div style={{
                width: 7, height: 7, borderRadius: '50%', flex: '0 0 auto',
                background: i < stage ? T.green : i === stage ? T.orange : 'rgba(255,255,255,0.14)',
                animation: i === stage && job ? 'bl-port-breathe 4s ease-in-out infinite' : undefined,
              }} />
              {i !== RAIL.length - 1 && (
                <div style={{ height: 1, flex: 1, margin: '0 3px', background: i < stage ? 'rgba(76,175,80,0.5)' : 'rgba(255,255,255,0.1)' }} />
              )}
            </div>
          ))}
        </div>

        {/* список ступеней: рейл отвечает «где мы», список — «что это за ступень» */}
        <div style={{ padding: '2px 12px 8px' }}>
          {RAIL.map((label, i) => {
            const isDone = job !== null && i < stage;
            const isActive = job !== null && i === stage;
            const color = isDone ? T.green : isActive ? T.orange : '#767676';
            return (
              <div
                key={label}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0',
                  fontSize: 12, color: isDone ? '#9a9a9a' : isActive ? '#f0f0f0' : '#767676',
                }}
              >
                <span style={{ width: 14, flex: '0 0 auto', fontFamily: 'ui-monospace,monospace', fontSize: 11, fontWeight: 600, color }}>
                  {['①', '②', '③', '④'][i]}
                </span>
                <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {label}
                </span>
                <span style={{ flex: '0 0 auto', fontFamily: 'ui-monospace,monospace', fontSize: 11, fontWeight: 600, color }}>
                  {steps ? steps[i] : '—'}
                </span>
              </div>
            );
          })}
        </div>

        {/* строка статуса */}
        <div style={{
          padding: '7px 12px 9px', fontSize: 12, minHeight: 18,
          fontWeight: fail ? 600 : 400,
          color: fail || reject || (outcome && !outcome.ok) ? T.red : outcome?.ok ? T.green : '#9a9a9a',
        }}>
          {!job && outcome ? outcome.text : statusText}
          {job && job.status === 'queued' && (
            <span style={{ display: 'inline-block', width: 5, height: 10, marginLeft: 4, verticalAlign: -1, background: T.orange, animation: 'bl-port-caret 1s step-end infinite' }} />
          )}
        </div>

        {/* плитки стемов / прогресс архива */}
        {zipBusy ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '0 12px 8px' }}>
            {ZIP_STEPS.map(([label, at], i) => {
              const done = zipProgress > at;
              const active = (i === 0 && zipProgress <= 10) || (i === 1 && zipProgress > 10) || (i === 2 && zipProgress > 90);
              const color = done ? T.green : active ? T.orange : '#767676';
              return (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
                  <span style={{ flex: 1, fontSize: 12, color, fontWeight: active ? 600 : 400 }}>{label}</span>
                  <span style={{ fontSize: 12, color }}>{done ? '✓' : active ? `${zipProgress}%` : '—'}</span>
                </div>
              );
            })}
          </div>
        ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5, padding: '0 12px 8px' }}>
          {STEMS.map(([, , slot], i) => {
            const isLit = i < lit;
            const color = STEM_COLORS[i];
            return (
              <div
                key={slot}
                title={STEM_NAME[i]}
                style={{
                  position: 'relative', display: 'flex', flexDirection: 'column', gap: 3,
                  gridColumn: slot === 'instrumental' ? 'span 2' : undefined,
                  minHeight: 46, padding: '7px 8px', borderRadius: 6,
                  border: `1px ${isLit ? 'solid' : 'dashed'} ${isLit ? color : 'rgba(255,255,255,0.18)'}`,
                  background: isLit ? `${color}14` : 'rgba(255,255,255,0.025)',
                  opacity: job ? 1 : 0.72,
                  transition: 'all 0.3s',
                  animation: isLit ? 'bl-port-tile 0.32s ease-out' : undefined,
                }}
              >
                <span style={{
                  fontFamily: 'ui-monospace,monospace', fontSize: 10, fontWeight: 700,
                  letterSpacing: '0.06em', color: isLit ? color : 'rgba(255,255,255,0.5)',
                }}>{STEM_CODE[i]}</span>
                <span style={{
                  fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  color: isLit ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.42)',
                }}>{STEM_NAME[i]}</span>
                <span style={{
                  position: 'absolute', right: 7, top: 7,
                  fontFamily: 'ui-monospace,monospace', fontSize: 10, color: isLit ? T.green : 'rgba(255,255,255,0.3)',
                }}>{isLit ? '✓' : ''}</span>
              </div>
            );
          })}
        </div>
        )}

        {/* низ: подсказка + кнопка */}
        <div style={{
          marginTop: 'auto', borderTop: `1px solid ${T.border}`,
          padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, minHeight: 40,
        }}>
          <div style={{ flex: 1, fontSize: 11.5, color: '#9a9a9a', lineHeight: 1.4 }}>
            {hint ?? (job
              ? job.status === 'done'
                ? 'дорожки в «МОЕЙ МУЗЫКЕ»'
                : job.queue ? `впереди: ${job.queue.pos}` : 'работаю…'
              : '…или .zip с готовыми треками')}
          </div>
          {!job && (
            <button
              onClick={() => setHint(hint ? null : hintFor())}
              style={{
                background: 'transparent', border: `1px solid ${T.border2}`, color: '#9a9a9a',
                fontSize: 11.5, padding: '5px 10px', borderRadius: 6, cursor: 'pointer', flex: '0 0 auto',
              }}
            >{hint ? '×' : '? что будет'}</button>
          )}
          {job && (job.status === 'queued' || job.status === 'processing') && (
            <button
              onClick={() => setHint(hint ? null : hintFor())}
              style={{
                background: 'transparent', border: `1px solid ${T.border2}`, color: '#9a9a9a',
                fontSize: 11.5, padding: '5px 10px', borderRadius: 6, cursor: 'pointer', flex: '0 0 auto',
              }}
            >{hint ? '×' : '? сколько ещё'}</button>
          )}
        </div>
      </div>
    </div>
  );
}
