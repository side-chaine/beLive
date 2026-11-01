import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useMarkersStore } from '../markers.store';

// ─────────────────────────────────────────────────────────────────────────────
// Регрессия на настоящий баг из SyncEditorPanel.tsx:413.
//
// Было: addMarker(targetLine, currentTime) — два позиционных аргумента.
// Сигнатура стора: addMarker(marker: { lineIndex, time }).
// В легаси-MM уходило число, marker.lineIndex и marker.time становились
// undefined, маркер ставился в неверное место. tsc это ловил (TS2554),
// но в рантайме ошибка была тихой.
//
// Тест ниже падает, если убрать проверку типа в сторе: позиционный вызов
// снова начнёт доходить до markerManager.
// ─────────────────────────────────────────────────────────────────────────────

describe('markers.store.addMarker', () => {
  let addMarkerSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    addMarkerSpy = vi.fn();
    (window as any).markerManager = { addMarker: addMarkerSpy };
  });

  it('прокидывает объект { lineIndex, time } в легаси-MM', () => {
    useMarkersStore.getState().addMarker({ lineIndex: 7, time: 12.5 });

    expect(addMarkerSpy).toHaveBeenCalledTimes(1);
    expect(addMarkerSpy).toHaveBeenCalledWith({ lineIndex: 7, time: 12.5 });
  });

  it('позиционный вызов (старый баг) НЕ доходит до markerManager', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Ровно та форма, что была в SyncEditorPanel.tsx:413 до фикса.
    (useMarkersStore.getState().addMarker as any)(7, 12.5);

    expect(addMarkerSpy).not.toHaveBeenCalled();
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it('null тоже отсекается', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});

    (useMarkersStore.getState().addMarker as any)(null);

    expect(addMarkerSpy).not.toHaveBeenCalled();
    err.mockRestore();
  });
});
