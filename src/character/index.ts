// src/character/index.ts
// Саморегистрирующийся «слой эмоций» персонажа. Импорт в main.tsx (side-effect) регистрирует
// init в существующий initRegistry — без ручных вызовов в boot (R9: нет конфликта с миграцией v3).
import { registerInit } from '../foundation/registry/initRegistry';
import { characterSoundManager } from './sound/CharacterSoundManager';
import './notify-bridge';

registerInit({
  id: 'character-layer',
  init: () => {
    characterSoundManager.init();
  },
});
