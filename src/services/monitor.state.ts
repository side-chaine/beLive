export function monitorGetState(this: any) {
  return {
    enabled: this.enabled,
    delayMs: this.delayMs,
    includeMusic: this.includeMusic,
    musicLevel: this.musicLevel,
    outputDeviceId: this.outputDeviceId,
    mainDeviceId: this.mainDeviceId,
    routeMainEnabled: this.routeMainEnabled,
    compensateOn: this.compensateOn,
    vocalToMain: this.vocalToMain,
    vocalHallLevel: this.vocalHallLevel,
    autoVerseOn: this.autoVerseOn,
    autoVerseLevel: this.autoVerseLevel,
    autoChorusOn: this.autoChorusOn,
    autoChorusLevel: this.autoChorusLevel,
    autoBridgeOn: this.autoBridgeOn,
    autoBridgeLevel: this.autoBridgeLevel,
    autoIntroOn: this.autoIntroOn,
    autoIntroLevel: this.autoIntroLevel,
    autoPreChorusOn: this.autoPreChorusOn,
    autoPreChorusLevel: this.autoPreChorusLevel,
    autoOutroOn: this.autoOutroOn,
    autoOutroLevel: this.autoOutroLevel,
  };
}

export function monitorPersist(this: any) {
  try {
    for (const [k, v] of [
      ['monitor:delayMs', String(this.delayMs)],
      ['monitor:compensateOn', this.compensateOn || 'monitor'],
      ['monitor:includeMusic', String(this.includeMusic)],
      ['monitor:musicLevel', String(this.musicLevel)],
      ['monitor:deviceId', this.outputDeviceId || ''],
      ['monitor:mainDeviceId', this.mainDeviceId || ''],
      ['monitor:routeMain', String(this.routeMainEnabled)],
      ['monitor:vocalToMain', String(this.vocalToMain)],
      ['monitor:vocalHallLevel', String(this.vocalHallLevel)],
      ['monitor:autoVerseOn', String(this.autoVerseOn)],
      ['monitor:autoVerseLevel', String(this.autoVerseLevel)],
      ['monitor:autoChorusOn', String(this.autoChorusOn)],
      ['monitor:autoChorusLevel', String(this.autoChorusLevel)],
      ['monitor:autoBridgeOn', String(this.autoBridgeOn)],
      ['monitor:autoBridgeLevel', String(this.autoBridgeLevel)],
      ['monitor:autoIntroOn', String(this.autoIntroOn)],
      ['monitor:autoIntroLevel', String(this.autoIntroLevel)],
      ['monitor:autoPreChorusOn', String(this.autoPreChorusOn)],
      ['monitor:autoPreChorusLevel', String(this.autoPreChorusLevel)],
      ['monitor:autoOutroOn', String(this.autoOutroOn)],
      ['monitor:autoOutroLevel', String(this.autoOutroLevel)],
    ]) {
      localStorage.setItem(k, v);
    }
  } catch (_) {}
}

export function monitorSetMusicLevel(this: any, level: number) {
  const v = Math.max(0, Math.min(1, Number(level) || 0));
  this.musicLevel = v;
  if (this.includeMusic) this.musicGain.gain.value = v;
  this._persist();
}

export function monitorSetAutoVerse(this: any, on: boolean) {
  this.autoVerseOn = !!on;
  this._persist();
  this._updateAutoVocalGainForLine();
}

export function monitorSetAutoVerseLevel(this: any, level: number) {
  this.autoVerseLevel = Math.max(0, Math.min(1, Number(level) || 0));
  this._persist();
  this._updateAutoVocalGainForLine();
}

export function monitorSetAutoChorus(this: any, on: boolean) {
  this.autoChorusOn = !!on;
  this._persist();
  this._updateAutoVocalGainForLine();
}

export function monitorSetAutoChorusLevel(this: any, level: number) {
  this.autoChorusLevel = Math.max(0, Math.min(1, Number(level) || 0));
  this._persist();
  this._updateAutoVocalGainForLine();
}

export function monitorSetAutoBridge(this: any, on: boolean) {
  this.autoBridgeOn = !!on;
  this._persist();
  this._updateAutoVocalGainForLine();
}

export function monitorSetAutoBridgeLevel(this: any, level: number) {
  this.autoBridgeLevel = Math.max(0, Math.min(1, Number(level) || 0));
  this._persist();
  this._updateAutoVocalGainForLine();
}

export function monitorSetAutoIntro(this: any, on: boolean) {
  this.autoIntroOn = !!on;
  this._persist();
  this._updateAutoVocalGainForLine();
}

export function monitorSetAutoIntroLevel(this: any, level: number) {
  this.autoIntroLevel = Math.max(0, Math.min(1, Number(level) || 0));
  this._persist();
  this._updateAutoVocalGainForLine();
}

export function monitorSetAutoPreChorus(this: any, on: boolean) {
  this.autoPreChorusOn = !!on;
  this._persist();
  this._updateAutoVocalGainForLine();
}

export function monitorSetAutoPreChorusLevel(this: any, level: number) {
  this.autoPreChorusLevel = Math.max(0, Math.min(1, Number(level) || 0));
  this._persist();
  this._updateAutoVocalGainForLine();
}

export function monitorSetAutoOutro(this: any, on: boolean) {
  this.autoOutroOn = !!on;
  this._persist();
  this._updateAutoVocalGainForLine();
}

export function monitorSetAutoOutroLevel(this: any, level: number) {
  this.autoOutroLevel = Math.max(0, Math.min(1, Number(level) || 0));
  this._persist();
  this._updateAutoVocalGainForLine();
}

export function monitorSetDelayMs(this: any, ms: number) {
  if (!this.delayNode) return;
  const v = Math.max(0, Math.min(1000, Number(ms) || 0));
  this.delayMs = v;
  if (this.compensateOn === 'main') {
    if (this.mainDelayNode) this.mainDelayNode.delayTime.value = v / 1000;
    this.delayNode.delayTime.value = 0;
  } else {
    this.delayNode.delayTime.value = v / 1000;
    if (this.mainDelayNode) this.mainDelayNode.delayTime.value = 0;
  }
  this._persist();
}

export function monitorSetHallVolume(this: any, v: number) {
  const vol = Math.max(0, Math.min(1, Number(v) || 0));
  if (this.mainBranchGain?.gain) {
    this.mainBranchGain.gain.linearRampToValueAtTime(vol, this.audioContext?.currentTime + 0.02 || 0);
  }
}

export function monitorSetMonitorVolume(this: any, v: number) {
  const vol = Math.max(0, Math.min(1, Number(v) || 0));
  if (this.monitorGain?.gain) {
    this.monitorGain.gain.linearRampToValueAtTime(vol, this.audioContext?.currentTime + 0.02 || 0);
  }
}
