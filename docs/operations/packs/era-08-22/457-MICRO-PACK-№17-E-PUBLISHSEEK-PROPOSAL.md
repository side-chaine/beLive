# 457-MICRO-PACK · №17-E · ПУБЛИКАЦИЯ SEEK + ЗАПИСЬ КЭША (v2 APPROVED)

**Статус:** ✅ APPROVED — `REVIEW: AGREE` от 006 (цепочка 001→002→001→009, 22.08). Включены AMEND-1 (EDIT 6: кэш в _onStateChange) и AMEND-2 (смягчение формулировки в Цели). Dispatch разрешён.

**Цель:** кэш `__belive.currentTime` замерзает на паузе навсегда (пишется только тик-лупом при playing); publishSeek кэш не пишет; внутренние seek'и (REC-preroll, возврат превью) идут без публикации. Основная точка UI/flow-seek'ов = `TransportV3.seek` (HybridPipelineService.seek НЕ подходит — early-return `!isPlaying` пропустил бы именно паузные). Нюанс (AMEND-2, 006): точек входа clock.seek три; seeks из idle-state молча отбрасываются гейтом TransportV3.seek:204 без события — они невидимы и сегодня, не регрессия.

## EDIT 1 · src/audio/engine-v3/core/TransportV3.ts — событие seek
OLD:
```
    this.stems.pauseAll();
    this.clock.seek(time);
```
NEW:
```
    this.stems.pauseAll();
    this.clock.seek(time);
    // №17-E (457): публикуем факт seek для V3StatePublisher — обновление кэша
    // __belive.currentTime, который иначе замерзает на паузе (006/TASK-010).
    // CustomEvent вместо импорта публикатора — без циклических зависимостей.
    this.dispatchEvent(new CustomEvent('seek', { detail: { time } }));
```

## EDIT 2 · src/audio/engine-v3/integration/V3StatePublisher.ts — подписка в конструкторе
OLD:
```
    this.transport.addEventListener('statechange', this._onStateChange as EventListener);
    // 🆕 EventBus rate integration: publish rate change
    this.transport.addEventListener('ratechange', this._onRateChange as EventListener);
```
NEW:
```
    this.transport.addEventListener('statechange', this._onStateChange as EventListener);
    // 🆕 EventBus rate integration: publish rate change
    this.transport.addEventListener('ratechange', this._onRateChange as EventListener);
    // №17-E (457): дискретные seeks транспорта → publishSeek (кэш + EventBus + store)
    this.transport.addEventListener('seek', this._onSeek as EventListener);
```

## EDIT 3 · V3StatePublisher.ts — обработчик рядом с _onRateChange
OLD:
```
  private _onRateChange = (e: Event): void => {
    const { rate } = (e as CustomEvent<PlaybackRateChangeDetail>).detail;
    this.publishRateChange(rate);
  };
```
NEW:
```
  private _onRateChange = (e: Event): void => {
    const { rate } = (e as CustomEvent<PlaybackRateChangeDetail>).detail;
    this.publishRateChange(rate);
  };

  // №17-E (457): транспорт просекекся — синхронизируем кэш/store даже на паузе
  private _onSeek = (e: Event): void => {
    const detail = (e as CustomEvent<{ time?: number }>).detail;
    const t = typeof detail?.time === 'number' ? detail.time : this.transport.currentTime;
    this.publishSeek(t, this.transport.duration);
  };
```

## EDIT 4 · V3StatePublisher.ts — publishSeek пишет кэш (вторая половина фикса 006)
OLD:
```
  publishSeek(currentTime: number, duration: number): void {
    eventBus.publish(EventBusChannel.Audio, 'seek-position-changed', { currentTime, duration });
    useAudioStore.getState().setCurrentTime(currentTime);
    this._lastPublishedTime = currentTime;
  }
```
NEW:
```
  publishSeek(currentTime: number, duration: number): void {
    eventBus.publish(EventBusChannel.Audio, 'seek-position-changed', { currentTime, duration });
    useAudioStore.getState().setCurrentTime(currentTime);
    this._lastPublishedTime = currentTime;
    // №17-E (457): ОБЯЗАТЕЛЬНАЯ запись кэша (006/TASK-010 §3) — иначе кэш остаётся
    // протухшим до следующего тика, а на паузе тиков нет вообще.
    try {
      if (typeof window !== 'undefined') {
        (window as any).__belive = (window as any).__belive || {};
        (window as any).__belive.currentTime = currentTime;
      }
    } catch {}
  }
```

## EDIT 5 · V3StatePublisher.ts — dispose снимает подписку
OLD:
```
    this.transport.removeEventListener('statechange', this._onStateChange as EventListener);
    this.transport.removeEventListener('ratechange', this._onRateChange as EventListener);
```
NEW:
```
    this.transport.removeEventListener('statechange', this._onStateChange as EventListener);
    this.transport.removeEventListener('ratechange', this._onRateChange as EventListener);
    this.transport.removeEventListener('seek', this._onSeek as EventListener);
```

## EDIT 6 · V3StatePublisher.ts — кэш на сменах состояния (AMEND-1, находка 001)
OLD:
```
    const store = useAudioStore.getState();
    store.setPlaying(isPlaying);
    store.setCurrentTime(currentTime);
    store.setDuration(duration);
```
NEW:
```
    const store = useAudioStore.getState();
    store.setPlaying(isPlaying);
    store.setCurrentTime(currentTime);
    store.setDuration(duration);
    // №17-E AMEND-1 (001/006): кэш обновляется и на сменах состояния — иначе пауза
    // без seek (natural-end превью, useTakesPlayback:107-109) замораживает его навсегда,
    // а idle→play (TransportV3.ts:132) обходит событие seek. Побочка A7: после stop()
    // кэш станет 0 вместо замороженного — fallback-читатели переваривают
    // (getPlaybackTime() || startTime).
    try {
      if (typeof window !== 'undefined') {
        (window as any).__belive = (window as any).__belive || {};
        (window as any).__belive.currentTime = currentTime;
      }
    } catch {}
```

## VERIFICATION
tsc 314 (diff IDENTICAL) · vitest files 61/63 (2 legacy load-error), tests 749/749. Дубль-publish безвреден (position-sync идемпотентен — 006 §3). Cleanup сырых дублей (TransportBar:51, WaveformCanvas:448 и ручные publishSeek) — ОТДЕЛЬНЫЙ пак по single-writer Ц3, здесь не трогаем.
