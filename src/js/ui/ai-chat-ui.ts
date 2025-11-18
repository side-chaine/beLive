import type { AIProvider } from '../types';
import { aiHub } from '../ai/registry';
import { streamOpenAI } from '../utils/stream-openai';
import { VoiceInput } from '../utils/voice-input';
import { AI_ActionExecutor } from '../ai/action-executor';
import { PerformanceMonitor } from '../utils/performance-monitor';
import { lockScroll, unlockScroll } from '../utils/scroll-lock'; // Импорт scroll-lock

export class AIChatUI {
  private chatWindow: HTMLElement;
  private messagesContainer: HTMLElement;
  private inputField: HTMLInputElement;
  private sendButton: HTMLButtonElement;
  private voiceButton: HTMLButtonElement;
  private modelSwitchButton: HTMLButtonElement;
  private closeButton: HTMLButtonElement;
  private chatTitleText: HTMLElement;
  private appRoot: HTMLElement | null; // Добавляем ссылку на app-root

  private isOpen = false;
  private isStreaming = false;
  private abortController: AbortController | null = null;
  private currentMessageElement: HTMLElement | null = null;
  private voiceInput: VoiceInput; // Тип VoiceInput уже определен

  constructor() {
    this.chatWindow = document.getElementById('ai-chat-window')!;
    this.messagesContainer = document.getElementById('ai-chat-messages')!;
    this.inputField = document.getElementById('ai-input') as HTMLInputElement;
    this.sendButton = document.getElementById('ai-send-button') as HTMLButtonElement;
    this.voiceButton = this.chatWindow.querySelector('.ai-voice-btn')!;
    this.modelSwitchButton = this.chatWindow.querySelector('.ai-model-switch-btn')!;
    this.closeButton = this.chatWindow.querySelector('.ai-close-btn')!;
    this.chatTitleText = document.getElementById('ai-chat-title-text')!;
    this.appRoot = document.getElementById('app-root'); // Получаем ссылку на app-root

    this.voiceInput = new VoiceInput({
      onPartial: (text) => {
        this.inputField.value = text;
      },
      onFinal: (text) => {
        this.inputField.value = text;
        this.handleSend();
      },
    });

    if (!this.chatWindow || !this.messagesContainer || !this.inputField || !this.sendButton || !this.voiceButton || !this.modelSwitchButton || !this.closeButton || !this.chatTitleText || !this.appRoot) {
      console.error('❌ AIChatUI: Ошибка! Не найдены один или несколько элементов UI чата или #app-root.');
      return;
    }

    this.init();
  }

  private init() {
    this.setupEventListeners();
    this.subscribeToModelChanges();
    this.updateOperatorButtonUI(aiHub.getActiveModel()?.shortName || null);
  }

  // СТРЕЛОЧНАЯ ФУНКЦИЯ ДЛЯ ОБРАБОТКИ ОТПРАВКИ СООБЩЕНИЙ
  private handleSend = async (): Promise<void> => {
    const messageText = this.inputField.value.trim();
    if (!messageText || this.isStreaming) return;

    const provider = aiHub.getActiveProvider();
    const activeModel = aiHub.getActiveModel();

    if (!provider || !activeModel) {
      this.addSystemMessage('⚠️ Модель AI не выбрана. Пожалуйста, выберите модель.');
      return;
    }

    this.addMessage(messageText, 'user');
    this.inputField.value = '';
    this.sendButton.disabled = true;
    this.inputField.disabled = true;

    const aiMessageEl = this.addMessage('', 'ai', true);
    this.currentMessageElement = aiMessageEl;

    this.abortController = new AbortController();
    performance.mark('message-sent');

    try {
      this.isStreaming = true;

      const response = await fetch('/api/gateway/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: activeModel.id,
          messages: [{ role: 'user', content: messageText }], // TODO: implement history
          stream: true,
        }),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${this.mapError(response.status)} - ${errorText}`);
      }

      let fullText = '';
      let isFirstToken = true;

      for await (const chunk of streamOpenAI(response.body!)) {
        if (isFirstToken) {
          PerformanceMonitor.measureFirstToken();
          this.updateMessage(aiMessageEl, '', false); // Удаляем индикатор "думает" после первого токена
          isFirstToken = false;
        }
        fullText += chunk;
        this.updateMessage(aiMessageEl, fullText, false);
      }

      this.checkForToolCalls(fullText);

    } catch (error: any) {
      if (error.name === 'AbortError') {
        this.updateMessage(aiMessageEl, '❌ Генерация остановлена', false);
      } else {
        console.error('AI Chat Error:', error);
        this.updateMessage(aiMessageEl, `❌ Ошибка: ${error.message}`, false);
      }
    } finally {
      this.isStreaming = false;
      this.sendButton.disabled = false;
      this.inputField.disabled = false;
      this.abortController = null;
      this.currentMessageElement = null;
      this.inputField.focus();
    }
  };

  private setupEventListeners(): void {
    document.getElementById('toggle-loopblock-mode')?.addEventListener('click', () => this.toggleChat());
    this.sendButton.addEventListener('click', this.handleSend); // Используем стрелочную функцию
    this.inputField.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSend(); // Используем стрелочную функцию
      }
    });
    this.closeButton.addEventListener('click', () => this.closeChat());
    this.voiceButton.addEventListener('click', () => this.toggleVoiceInput());

    // Обработчик для кнопки смены модели (откроет ModelDropdownUI)
    this.modelSwitchButton.addEventListener('click', (e) => {
      e.stopPropagation();
      const picker = document.getElementById('belive-ai-picker');
      if (picker) {
        const rect = this.modelSwitchButton.getBoundingClientRect();
        Object.assign(picker.style, {
          position: 'fixed',
          left: `${rect.left}px`,
          top: `${rect.bottom + 8}px`,
          transform: 'translateY(0)',
          opacity: '1',
          pointerEvents: 'all',
        });
        picker.classList.toggle('active');
      }
    });

    // Закрытие по Esc
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        e.preventDefault();
        this.closeChat();
      }
    });

    // Закрытие по клику вне чата (overlay)
    // Примечание: для fixed элемента, расположенного прямо в body, overlay не нужен, 
    // так как сам элемент не перекрывается.
    // Но для Modal Picker, который открывается поверх чата, это может быть актуально.
  }

  private subscribeToModelChanges(): void {
    aiHub.on('modelChanged', (event: Event) => {
      const customEvent = event as CustomEvent;
      const newModel = customEvent.detail;
      if (newModel) {
        this.addSystemMessage(`✅ Модель переключена на: ${newModel.shortName}`);
        this.chatTitleText.textContent = `AI Оператор (${newModel.shortName})`;
      } else {
        this.addSystemMessage('⚠️ Модель AI не выбрана.');
        this.chatTitleText.textContent = 'AI Оператор';
      }
      this.updateOperatorButtonUI(newModel?.shortName || null);
    });
  }

  private updateOperatorButtonUI(modelName: string | null): void {
    const operatorButton = document.getElementById('toggle-loopblock-mode');
    if (operatorButton) {
        if (modelName) {
            operatorButton.innerHTML = `<span class="operator-text">${modelName}</span>`;
            operatorButton.classList.add('ai-active');
        } else {
            operatorButton.innerHTML = `<span class="operator-text">Operator</span>`;
            operatorButton.classList.remove('ai-active');
        }
    }
  }

  public toggleChat(): void {
    console.log('💬 AIChatUI: toggleChat called.');
    this.isOpen ? this.closeChat() : this.openChat();
  }

  public openChat(): void {
    console.log('💬 AIChatUI: openChat called.');
    PerformanceMonitor.measureChatOpen();
    this.isOpen = true;
    this.chatWindow.classList.add('active');
    this.chatWindow.classList.remove('hidden');

    // НОВЫЙ SCROLL LOCK
    lockScroll();
    if (this.appRoot) {
      this.appRoot.setAttribute('inert', ''); // Полная блокировка фона
    }

    this.inputField.focus();

    if (this.messagesContainer.children.length === 0) {
      this.addSystemMessage('👋 Привет! Я AI Оператор beLive. Чем могу помочь?');
    }
    requestAnimationFrame(() => {
      PerformanceMonitor.measureChatOpened();
      this.afterOpenLayoutFix(); // Фикс обрезания
    });
  }

  public closeChat(): void {
    console.log('💬 AIChatUI: closeChat called.');
    this.isOpen = false;
    this.chatWindow.classList.remove('active');
    this.chatWindow.classList.add('hidden');

    // НОВЫЙ SCROLL UNLOCK
    unlockScroll();
    if (this.appRoot) {
      this.appRoot.removeAttribute('inert'); // Снимаем блокировку фона
    }

    if (this.isStreaming && this.abortController) {
      this.abortController.abort();
      this.isStreaming = false;
      this.sendButton.disabled = false;
      this.inputField.disabled = false;
      if (this.currentMessageElement) {
          this.updateMessage(this.currentMessageElement, '❌ Генерация остановлена', false);
      }
    }
    const picker = document.getElementById('belive-ai-picker');
    if (picker) picker.classList.remove('active');
  }

  private afterOpenLayoutFix() {
    // 1 кадр — применить стили, 2 кадр — стабилизировать scroll
    requestAnimationFrame(() => {
      // форс-рефлоу (любое чтение layout)
      this.chatWindow.getBoundingClientRect(); // Использовать chatWindow вместо root
      const msg = this.messagesContainer; // #ai-chat-window .ai-chat-messages
      // страхуемся: если высота изменилась — подтянем скролл
      requestAnimationFrame(() => {
        msg.scrollTop = msg.scrollHeight;
      });
    });
  }

  private addMessage(text: string, type: 'user' | 'ai', thinking = false): HTMLElement {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${type}`;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    if (thinking) {
      contentDiv.innerHTML = `
        <div class="ai-thinking">
          <span></span><span></span><span></span>
        </div>
      `;
    } else {
      contentDiv.textContent = text;
    }

    msgDiv.appendChild(contentDiv);
    this.messagesContainer.appendChild(msgDiv);
    // this.scrollToBottom(); // Удаляем, так как afterOpenLayoutFix делает это

    return msgDiv;
  }

  private updateMessage(msgEl: HTMLElement, text: string, thinking: boolean) {
    const content = msgEl.querySelector('.message-content')!;
    if (thinking) {
      content.innerHTML = `
        <div class="ai-thinking">
          <span></span><span></span><span></span>
        </div>
      `;
    } else {
      content.textContent = text;
    }
    this.scrollToBottom();
  }

  private addSystemMessage(text: string) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message system';
    msgDiv.innerHTML = `<div class="message-content">${text}</div>`;
    this.messagesContainer.appendChild(msgDiv);
    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  private toggleVoiceInput(): void {
    if (this.voiceInput.isActive()) {
      this.voiceInput.stopRecording();
      this.voiceButton.classList.remove('recording');
    } else {
      // VoiceInput теперь принимает колбэки через конструктор
      const started = this.voiceInput.startRecording(); // Изменено: не передаем колбэк здесь

      if (started) {
        this.voiceButton.classList.add('recording');
        this.addSystemMessage('🎤 Говорите...');
      } else {
        this.addSystemMessage('❌ Голосовой ввод не поддерживается');
      }
    }
  }

  private async checkForToolCalls(text: string): Promise<void> {
    const toolCalls = AI_ActionExecutor.parseToolCalls(text);

    if (toolCalls.length > 0) {
      for (const call of toolCalls) {
        const result = await AI_ActionExecutor.execute(call);
        const emoji = result.success ? '✅' : '❌';
        this.addSystemMessage(`${emoji} ${result.message}`);
      }
    }
  }

  private mapError(status: number): string {
    if (status === 401 || status === 403) return "Нужно снова войти.";
    if (status === 429) return "Слишком часто. Подождите несколько секунд…";
    if (status >= 500) return "Сервер временно недоступен. Попробуйте позже.";
    return "Не удалось получить ответ. Попробуйте ещё раз.";
  }
}
