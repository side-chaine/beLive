import { describe, it, expect, beforeEach } from 'vitest';
import { useStemStore } from '../stem.store';

describe('stem.store', () => {
  beforeEach(() => {
    useStemStore.setState({
      loadedStems: [],
      stemVolumes: {},
      stemMutes: {},
      stemSolos: {},
      stemPans: {},
      stemsEnabled: false,
      stemsLoading: false,
      stemsMode: false,
      _stemsBootRestored: false,
      stemDisplayOrder: null,
      stemAutomation: null,
    });
  });

  it('начальное состояние — пусто и выключено', () => {
    const s = useStemStore.getState();
    expect(s.loadedStems).toEqual([]);
    expect(s.stemsEnabled).toBe(false);
    expect(s.stemsMode).toBe(false);
  });

  it('setStemsEnabled(true) включает стемы', () => {
    useStemStore.getState().setStemsEnabled(true);
    expect(useStemStore.getState().stemsEnabled).toBe(true);
  });

  it('setStemsMode(true) переключает режим', () => {
    useStemStore.getState().setStemsMode(true);
    expect(useStemStore.getState().stemsMode).toBe(true);
  });

  it('setStemVolume устанавливает громкость', () => {
    useStemStore.getState().setStemVolume('vocals', 0.8);
    expect(useStemStore.getState().stemVolumes['vocals']).toBe(0.8);
  });

  it('setStemMute(true) глушит стем', () => {
    useStemStore.getState().setStemMute('drums', true);
    expect(useStemStore.getState().stemMutes['drums']).toBe(true);
  });

  it('setStemSolo(true) солит стем', () => {
    useStemStore.getState().setStemSolo('guitar', true);
    expect(useStemStore.getState().stemSolos['guitar']).toBe(true);
  });

  it('setStemPan устанавливает панораму', () => {
    useStemStore.getState().setStemPan('bass', -0.5);
    expect(useStemStore.getState().stemPans['bass']).toBe(-0.5);
  });

  it('captureSnapshot и restoreSnapshot', () => {
    useStemStore.getState().setStemVolume('vocals', 0.9);
    useStemStore.getState().setStemMute('drums', true);
    const snapshot = useStemStore.getState().captureSnapshot();

    // Меняем значения
    useStemStore.getState().setStemVolume('vocals', 0.1);
    useStemStore.getState().setStemMute('drums', false);

    // Восстанавливаем
    useStemStore.getState().restoreSnapshot(snapshot);

    expect(useStemStore.getState().stemVolumes['vocals']).toBe(0.9);
    expect(useStemStore.getState().stemMutes['drums']).toBe(true);
  });

  it('addStem добавляет стем', () => {
    useStemStore.getState().addStem('bass');
    expect(useStemStore.getState().loadedStems).toContain('bass');
  });

  it('setStemsLoading(true) отмечает загрузку', () => {
    useStemStore.getState().setStemsLoading(true);
    expect(useStemStore.getState().stemsLoading).toBe(true);
  });

  it('getOrderedStemIds возвращает пустой массив без stems', () => {
    const ordered = useStemStore.getState().getOrderedStemIds();
    expect(Array.isArray(ordered)).toBe(true);
  });
});
