// src/character/sound/character-sound.store.ts
//
// Звук персонажа (Билли): вкл/выкл.
// Раньше жил в src/js/ai/settings/ai-settings.store.ts и экспортировался как
// useAISettingsStore — совпадало с именем стора настроек ИИ (stores/ai-settings.store.ts),
// из-за чего это выглядело как «дубль стора». Стор другой: здесь только звук.
// Переименовано 09.11, поведение не изменилось.
import { create } from 'zustand';

interface CharacterSoundState {
  soundEnabled: boolean;
  setSoundEnabled: (v: boolean) => void;
}

export const useCharacterSoundStore = create<CharacterSoundState>((set) => ({
  soundEnabled: true,
  setSoundEnabled: (v) => set({ soundEnabled: v }),
}));

export const getSoundEnabled = (): boolean => useCharacterSoundStore.getState().soundEnabled;
