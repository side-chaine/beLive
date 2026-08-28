import type { StemOrchestrator } from '../core/StemOrchestrator';
import type { TransportV3 } from '../core/TransportV3';
import type { HybridPipelineService } from '../pipeline/HybridPipelineService';

/**
 * Matches the IDB TrackRecord schema established earlier in this project's own recon
 * (raw ArrayBuffers per stem) — VERIFY against your actual current idb.service.ts,
 * I have not seen that file, only this shape from earlier context in this thread.
 */
export interface TrackRecord {
  instrumentalData: ArrayBuffer;
  instrumentalType: string;
  vocalsData?: ArrayBuffer | null;
  vocalsType?: string | null;
  stemsData?: Record<string, { data: ArrayBuffer; type: string }>;
}

export const MAX_MUSIC_STEMS = 6; // drums, bass, keys, guitar, backing, other
export const MASTER_CLOCK_STEM_ID = 'instrumental';

export interface LoadResult {
  loadedStemIds: string[];
  failedStemIds: string[];
}

/**
 * Pure-ish loading logic, deliberately decoupled from whatever your real EventBus
 * looks like — wire your actual 'before-track-change' subscription to call
 * loadTrack() below; that wiring is 1-2 lines once I can see the real EventBus API,
 * everything that matters is already here.
 *
 * Decode order: PARALLEL, not instrumental-first. Nothing downstream reads
 * instrumental's decode-completion as a timing signal anymore (that was the retired
 * FR-004/HTMLAudioElement world) — HybridClock is performance.now()-based and
 * StemOrchestrator.duration simply reads whatever is in the map once everything has
 * settled. Serializing would only make total load time longer for no correctness
 * benefit I can find; tell me if there's one I'm missing.
 */
export class V3DataInterceptor {
  private _loadGeneration = 0;
  private _pipeline: HybridPipelineService | null = null;

  constructor(
    private readonly ctx: AudioContext,
    private readonly orchestrator: StemOrchestrator,
    private readonly transport: TransportV3,
  ) {}

  /** Подключить HybridPipeline для загрузки стемов в WASM (REGIME 3) */
  attachPipeline(pipeline: HybridPipelineService): void {
    this._pipeline = pipeline
    console.log('[V3DataInterceptor] ✅ Pipeline attached')
  }

  async loadTrack(record: TrackRecord): Promise<LoadResult> {
    const myGeneration = ++this._loadGeneration;
    // ⏳ MP-28: V3 loading in progress — блокируем V2 fallback
    try { (window as any).__setLoadingV3?.(true) } catch {}
    // 🧹 009: сбрасываем флаг V3 при новой загрузке (cleanup предыдущей)
    try { (window as any).__setV3Active?.(false) } catch {}

    // 1. 🛑 Stop, но НЕ сбрасываем pipeline (оставляем старые WASM буферы живыми)
    this.transport.stop();
    this.orchestrator.disposeAll();

    // 2. Build decode jobs
    // MX-01: If individual stems exist, skip instrumental master (would cause phasing)
    const hasStems = record.stemsData && Object.keys(record.stemsData).length > 0;
    const jobs: Array<{ id: string; data: ArrayBuffer; type: string }> = [];
    if (!hasStems) {
      jobs.push({ id: MASTER_CLOCK_STEM_ID, data: record.instrumentalData, type: record.instrumentalType });
    }
    if (record.vocalsData) {
      jobs.push({ id: 'vocals', data: record.vocalsData, type: record.vocalsType ?? 'audio/mpeg' });
    }
    if (hasStems) {
      const allEntries = Object.entries(record.stemsData);
      // BAC-002 (VMO-005/036): «other» must never be silently dropped by slice(0,6)
      // when a track exposes >6 music stems. Keep first MAX_MUSIC_STEMS, but if
      // «other» was sliced off, swap it into the last slot (still bounded to 6).
      let chosen = allEntries.slice(0, MAX_MUSIC_STEMS);
      if (allEntries.some(([id]) => id === 'other') && !chosen.some(([id]) => id === 'other')) {
        const other = allEntries.find(([id]) => id === 'other')!;
        chosen = [...chosen.slice(0, MAX_MUSIC_STEMS - 1), other];
      }
      for (const [id, stem] of chosen) jobs.push({ id, data: stem.data, type: stem.type });
    }

    // 3. 🔄 ATOMIC: decode ВСЕ сначала (до pipeline.reset)
    type JobResult = { id: string; ok: true; buffer: AudioBuffer } | { id: string; ok: false; error: unknown };

    const results: JobResult[] = await Promise.all(
      jobs.map(async (job): Promise<JobResult> => {
        try {
          const copy = job.data.slice(0);
          const buffer = await this.ctx.decodeAudioData(copy);
          return { id: job.id, ok: true, buffer };
        } catch (error) {
          // BAC-002 (VMO-005/036): 1 retry with small backoff before giving up.
          // Transient decode failures (e.g. the «other» 5/6 stem) get a second
          // chance so the fader still renders; only a final failure is excluded.
          try {
            await new Promise<void>((r) => setTimeout(r, 120));
            const retryCopy = job.data.slice(0);
            const buffer = await this.ctx.decodeAudioData(retryCopy);
            return { id: job.id, ok: true, buffer };
          } catch {
            return { id: job.id, ok: false, error };
          }
        }
      }),
    );

    // 4. Проверка generation — если устарел, abort
    if (myGeneration !== this._loadGeneration) {
      try { (window as any).__setLoadingV3?.(false) } catch {}  // ⏳ cleanup
      return { loadedStemIds: [], failedStemIds: jobs.map((j) => j.id) };
    }

    // 5. 🧹 Теперь сбрасываем pipeline (старые буферы больше не нужны)
    if (this._pipeline) {
      await this._pipeline.reset()
    }

    // 6. Добавляем в orchestrator + pipeline
    const loadedStemIds: string[] = [];
    const failedStemIds: string[] = [];
    const pipelineJobs: Promise<void>[] = [];

    for (const r of results) {
      if (r.ok) {
        // 🔥 MP-23: когда pipeline активен, orchestrator НЕ нужен
        if (!this._pipeline) {
          this.orchestrator.addStem(r.id, r.buffer);
        }
        loadedStemIds.push(r.id);
        if (this._pipeline) {
          pipelineJobs.push(
            this._pipeline.loadStem(r.id, r.buffer).catch((e: unknown) => {
              console.warn(`[V3DataInterceptor] Pipeline load failed for ${r.id}:`, e)
            })
          )
        }
      } else {
        failedStemIds.push(r.id);
      }
    }

    // 7. Ждём загрузки всех стемов в WASM
    if (pipelineJobs.length > 0) {
      await Promise.all(pipelineJobs)
      console.log(`[V3DataInterceptor] ✅ Pipeline: ${loadedStemIds.length} stems loaded`)
    }

    // R1: generation-check ПОСЛЕ decode+reset+loadStem×N — сталый лад не активирует клетку/флаг
    if (myGeneration !== this._loadGeneration) {
      console.log('[V3DataInterceptor] stale load aborted — track superseded')
      return { loadedStemIds: [], failedStemIds }
    }

    // 8. 🎯 Zombie Kill Switch — заглушить V2 + запуск V3 с offset + safety net 🔴
    if (this._pipeline && loadedStemIds.length > 0) {
      // 8b. Помечаем V3 активным — блокируем V2.play() через interceptor
      try { (window as any).__setV3Active(true) } catch { /* ignore */ }

      // новый трек всегда стартует с 0. (Хендофф был легален только в консольном переключателе — удалён в W3.)
      const offset = 0

      // 8d. 🛡️ MP-28: safety net — запуск с timeout и rollback
      const PLAY_TIMEOUT_MS = 5000
      try {
        const timeoutPromise = new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('V3 play timeout')), PLAY_TIMEOUT_MS)
        )
        await Promise.race([this.transport.play(offset), timeoutPromise])
        // P1: тихий возврат play() без 'playing' (TransportV3.ts:135-155) = фейл → catch :177 → rollback
        if (this.transport.state !== 'playing') throw new Error('V3 play() resolved without playing state')
        console.log('[V3DataInterceptor] 🎯 Auto-play V3 at', offset.toFixed(1) + 's')
      } catch (error) {
        // R1: generation-check — stale rollback не гасит флаг/пайплайн нового трека
        if (myGeneration !== this._loadGeneration) {
          console.log('[V3DataInterceptor] stale rollback skipped — track superseded')
          return { loadedStemIds, failedStemIds }
        }
        console.error('[V3DataInterceptor] ❌ V3 activation failed — V3-native recovery:', error)
        try { this._pipeline?.stop() } catch {}                          // 🔇 ghost sound kill
        try { (window as any).__setV3Active(false) } catch {}            // ⛔ сброс флага
        // M1 (342): V3-native recovery через transport health + crash UI
        try {
          this.transport.pause?.() ?? this.transport.stop?.()
        } catch {}
        // всплываем событие для AudioCrashModal / useAudioContextHealth
        try {
          window.dispatchEvent(new CustomEvent('belive:v3-activation-failed', { detail: { error: String(error) } }))
        } catch {}
      }
    }

    // ⏳ MP-28: V3 загрузка завершена
    try { (window as any).__setLoadingV3?.(false) } catch {}

    // M1-2 (342, расширение): V3 заменяет V2 как источник 'track-loaded'.
    // UI-мосты (blocks/track/audio/text-style/block-scene/auto-lyrics) ждут это
    // событие для TrackMap, плашки текста, волн, маркеров и stem.store.
    // V2 эмитил document CustomEvent + колбэки (AudioEngineV2.ts:2147); здесь
    // публикуем и в EventBus (AudioBus.trackLoaded), и в document — для обоих
    // типов подписчиков.
    if (loadedStemIds.length > 0) {
      const duration = this.transport.duration;
      const hasVocals = !!record.vocalsData || loadedStemIds.includes('vocals');
      // M1-2 фикс: V2-эмиттер (AudioEngineV2.ts:2147) передавал markers в detail.
      // marker-manager.js (слушает document 'track-loaded') при отсутствии
      // event.detail.markers вызывает resetMarkers() → сбрасывает mm.markers в 0.
      // Берём маркеры из mm (оркестратор:333 уже вызвал setMarkers ДО нас).
      const mm = (window as any).markerManager;
      const markers = (mm?.markers && Array.isArray(mm.markers)) ? mm.markers : undefined;
      const detail: any = { duration, hasVocals, loadedStems: loadedStemIds };
      if (markers && markers.length > 0) {
        detail.markers = markers;
      }
      try {
        // EventBus-подписчики (blocks-events, track-events, audio-events, text-style-events)
        const { AudioBus } = await import('../../../foundation/event-bus');
        AudioBus.trackLoaded(detail);
      } catch (e) {
        console.warn('[V3DataInterceptor] track-loaded EventBus publish failed:', e)
      }
      try {
        // document-подписчики (block-scene.service, auto-lyrics.service)
        document.dispatchEvent(new CustomEvent('track-loaded', { detail }));
      } catch (e) {
        console.warn('[V3DataInterceptor] track-loaded document dispatch failed:', e)
      }
      // B1: bridge-compat alias — track-stem-ready + track-fully-loaded (consumers: audio.bridge.ts:109,217)
      // BAC-002 (VMO-005/036): emit ONE event per stem with `detail.stemId` so the
      // frozen incremental addStem(stemId) consumer revives (was sending {stemIds:[...]}
      // → addStem(undefined), dropping the «other» fader). Loop over loadedStemIds.
      try {
        for (const id of loadedStemIds) {
          document.dispatchEvent(new CustomEvent('track-stem-ready', { detail: { stemId: id } }));
        }
      } catch {}
      try {
        document.dispatchEvent(new CustomEvent('track-fully-loaded', { detail }));
      } catch {}
    }

    return { loadedStemIds, failedStemIds };
  }
}
