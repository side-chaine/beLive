import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PlateState {
  width: number;             // 50-100, default 80
  position: 'left' | 'center' | 'right';  // default center
  coverBg: boolean;          // default true
  glowIntensity: number;     // 0-100, default 40
  vignetteIntensity: number; // 0-100, default 30
  transitionPreset: string;

  setWidth: (w: number) => void;
  setPosition: (p: 'left' | 'center' | 'right') => void;
  setCoverBg: (v: boolean) => void;
  setGlowIntensity: (v: number) => void;
  setVignetteIntensity: (v: number) => void;
  setTransitionPreset: (preset: string) => void;
}

export const usePlateStore = create<PlateState>()(
  persist(
    (set) => ({
      width: 80,
      position: 'center',
      coverBg: true,
      glowIntensity: 40,
      vignetteIntensity: 30,
      transitionPreset: 'smooth',

      setWidth: (width) => set({ width: Math.max(50, Math.min(100, width)) }),
      setPosition: (position) => set({ position }),
      setCoverBg: (coverBg) => set({ coverBg }),
      setGlowIntensity: (glowIntensity) => set({ glowIntensity: Math.max(0, Math.min(100, glowIntensity)) }),
      setVignetteIntensity: (vignetteIntensity) => set({ vignetteIntensity: Math.max(0, Math.min(100, vignetteIntensity)) }),
      setTransitionPreset: (transitionPreset) => set({ transitionPreset }),
    }),
    { name: 'belive-plate-settings' }
  )
);
