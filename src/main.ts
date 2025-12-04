import '../css/main.css'; // Корректный путь
import '../css/ai-chat.css'; // Корректный абсолютный путь
import '../css/avatar-studio.css'; // Корректный путь

import { aiHub } from './js/ai/registry';
import { GatewayProvider } from './js/ai/providers/gateway-provider';
import { ModelDropdownUI } from './js/ui/model-dropdown-ui'; // Новый импорт
import { AIChatUI } from './js/ui/ai-chat-ui'; // Новый импорт

declare global { interface Window { __BELIVE_BOOTED__?: boolean } }

document.addEventListener('DOMContentLoaded', async () => {
  if (window.__BELIVE_BOOTED__) return; // Глобальный гард от повторной инициализации
  window.__BELIVE_BOOTED__ = true;

  const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:8787'; // Use environment variable or default
  const gatewayProvider = new GatewayProvider(GATEWAY_URL);
  aiHub.register(gatewayProvider);

  new AIChatUI(); // Инициализация AIChatUI
  new ModelDropdownUI(); // Инициализация ModelDropdownUI

  // Обработчик для кнопки AI Operator. Теперь он будет открывать чат.
  const aiOperatorButton = document.getElementById('toggle-loopblock-mode');
  if (aiOperatorButton) {
    // console.log('✅ Found AI Operator button'); // Закомментировано
    // aiOperatorButton.addEventListener('click', () => { // Удален дублирующий обработчик
    //   console.log('⚡ AI Operator button clicked!');
    //   aiChatUI.toggleChat(); // Переключаем видимость чата
    // });
  }

  // Подписка на изменение модели для обновления UI кнопки "Operator"
  aiHub.on('modelChanged', (event: Event) => {
      const customEvent = event as CustomEvent;
      const activeModel = customEvent.detail;
      const operatorButton = document.getElementById('toggle-loopblock-mode');
      if (operatorButton) {
          if (activeModel) {
              operatorButton.innerHTML = `<span class="operator-text">${activeModel.shortName}</span>`;
              operatorButton.classList.add('ai-active');
          } else {
              operatorButton.innerHTML = `<span class="operator-text">Operator</span>`;
              operatorButton.classList.remove('ai-active');
          }
      }
  });

  // Убедимся, что начальное состояние кнопки правильное при загрузке
  const initialActiveModel = aiHub.getActiveModel();
  const operatorButton = document.getElementById('toggle-loopblock-mode');
  if (operatorButton) {
      if (initialActiveModel) {
          operatorButton.innerHTML = `<span class="operator-text">${initialActiveModel.shortName}</span>`;
          operatorButton.classList.add('ai-active');
      } else {
          operatorButton.innerHTML = `<span class="operator-text">Operator</span>`;
          operatorButton.classList.remove('ai-active');
      }
  }
});
