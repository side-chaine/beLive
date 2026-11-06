import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useMonitorStore } from './monitor.store';

/**
 * refreshDevices() asks for microphone permission once so that the browser
 * reveals device labels. The probe stream must be released in every path —
 * a live stream pins Bluetooth headsets to HFP and keeps the recording
 * indicator on.
 */
describe('monitor.store · refreshDevices probe release', () => {
  const stopTrack = vi.fn();
  const fakeStream = { getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream;
  const getUserMedia = vi.fn(async () => fakeStream);

  const installNavigator = () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    });
  };

  beforeEach(() => {
    stopTrack.mockReset();
    getUserMedia.mockReset();
    getUserMedia.mockResolvedValue(fakeStream);
    installNavigator();
  });

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).monitorMix;
  });

  const withMix = (listOutputs: ReturnType<typeof vi.fn>) => {
    (window as unknown as Record<string, unknown>).monitorMix = { listOutputs };
  };

  it('stops the probe stream after labels are read', async () => {
    const listOutputs = vi
      .fn()
      .mockResolvedValueOnce([{ deviceId: 'default', label: '' }])
      .mockResolvedValueOnce([{ deviceId: 'default', label: 'Speakers' }]);
    withMix(listOutputs);

    await useMonitorStore.getState().refreshDevices();

    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(stopTrack).toHaveBeenCalledTimes(1);
    expect(useMonitorStore.getState().devices).toEqual([
      { deviceId: 'default', label: 'Speakers' },
    ]);
  });

  it('stops the probe stream even when the second enumeration throws', async () => {
    const listOutputs = vi
      .fn()
      .mockResolvedValueOnce([{ deviceId: 'default', label: '' }])
      .mockRejectedValueOnce(new Error('device lost'));
    withMix(listOutputs);

    await useMonitorStore.getState().refreshDevices();

    expect(stopTrack).toHaveBeenCalledTimes(1);
  });

  it('does not touch MediaStream at all when permission is denied', async () => {
    getUserMedia.mockRejectedValueOnce(new Error('NotAllowedError'));
    const listOutputs = vi.fn().mockResolvedValue([{ deviceId: 'default', label: '' }]);
    withMix(listOutputs);

    await expect(useMonitorStore.getState().refreshDevices()).resolves.toBeUndefined();
    expect(stopTrack).not.toHaveBeenCalled();
  });

  it('does not request the microphone when labels are already available', async () => {
    const listOutputs = vi
      .fn()
      .mockResolvedValue([{ deviceId: 'default', label: 'Speakers' }]);
    withMix(listOutputs);

    await useMonitorStore.getState().refreshDevices();

    expect(getUserMedia).not.toHaveBeenCalled();
    expect(stopTrack).not.toHaveBeenCalled();
  });
});
