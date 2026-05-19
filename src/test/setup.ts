import { vi } from 'vitest';

// Mock AudioContext
const mockGainNode = {
  gain: { value: 1, setValueAtTime: vi.fn() },
  connect: vi.fn(),
  disconnect: vi.fn(),
};

const mockAudioContext = {
  createGain: vi.fn(() => mockGainNode),
  createMediaElementSource: vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn() })),
  createMediaStreamDestination: vi.fn(() => ({ stream: { getTracks: () => [] } })),
  createAnalyser: vi.fn(() => ({ connect: vi.fn(), fftSize: 2048, frequencyBinCount: 1024, getByteFrequencyData: vi.fn() })),
  resume: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
  currentTime: 0,
  state: 'running' as AudioContextState,
  destination: {} as AudioDestinationNode,
};

vi.stubGlobal('AudioContext', vi.fn(() => mockAudioContext));
vi.stubGlobal('webkitAudioContext', vi.fn(() => mockAudioContext));

// Mock HTMLAudioElement
vi.stubGlobal('HTMLAudioElement', vi.fn().mockImplementation(() => ({
  play: vi.fn().mockResolvedValue(undefined),
  pause: vi.fn(),
  load: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  currentTime: 0,
  duration: 0,
  volume: 1,
  playbackRate: 1,
  paused: true,
  src: '',
  setSinkId: vi.fn(),
})));

// Mock Canvas 2D context - minimal implementation for our needs
const mockCtx = {
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  setTransform: vi.fn(),
  beginPath: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  closePath: vi.fn(),
  quadraticCurveTo: vi.fn(),
  bezierCurveTo: vi.fn(),
  rect: vi.fn(),
  scale: vi.fn(),
  translate: vi.fn(),
  rotate: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  getImageData: vi.fn(),
  putImageData: vi.fn(),
  createLinearGradient: vi.fn(),
  createRadialGradient: vi.fn(),
  createPattern: vi.fn(),
  globalAlpha: 1,
  globalCompositeOperation: 'source-over',
  strokeStyle: '#000000',
  fillStyle: '#000000',
  lineWidth: 1,
  lineCap: 'butt',
  lineJoin: 'miter',
  miterLimit: 10,
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  shadowBlur: 0,
  shadowColor: 'rgba(0,0,0,0)',
  font: '10px sans-serif',
  textAlign: 'start',
  textBaseline: 'alphabetic',
  direction: 'inherit',
  imageSmoothingEnabled: true,
  imageSmoothingQuality: 'low',
  filter: 'none',
  setLineDash: vi.fn(),
  getLineDash: vi.fn().mockReturnValue([]),
  lineDashOffset: 0,
};

// Mock getContext on HTMLCanvasElement prototype
if (typeof HTMLCanvasElement !== 'undefined') {
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (contextType: string, ...args: any[]) {
    if (contextType === '2d') {
      return mockCtx;
    }
    return null;
  } as any;
}

// Mock HTMLCanvasElement
vi.stubGlobal('HTMLCanvasElement', vi.fn().mockImplementation(() => ({
  getContext: vi.fn().mockReturnValue(mockCtx),
  // Add any other necessary properties
})));

// Mock URL
if (!globalThis.URL.createObjectURL) {
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  globalThis.URL.revokeObjectURL = vi.fn();
}

// Mock localStorage
const storage = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => storage.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
  removeItem: vi.fn((key: string) => storage.delete(key)),
  clear: vi.fn(() => storage.clear()),
  get length() { return storage.size; },
  key: vi.fn((i: number) => [...storage.keys()][i] ?? null),
});

// Mock window.dispatchEvent
vi.stubGlobal('dispatchEvent', vi.fn());

// Mock window.devicePixelRatio
Object.defineProperty(window, 'devicePixelRatio', {
  value: 1,
  writable: true,
});

// Mock navigator properties for performance detection
Object.defineProperty(navigator, 'hardwareConcurrency', {
  value: 4,
  writable: true,
});

Object.defineProperty(navigator, 'userAgent', {
  value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  writable: true,
});

// Mock deviceMemory (Chrome-only)
Object.defineProperty(navigator, 'deviceMemory', {
  value: 8,
  writable: true,
});
