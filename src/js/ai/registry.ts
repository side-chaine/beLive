import { AIProvider, ChatRequest, ModelInfo, StreamCallbacks, AIError } from './types';

/** Каноническое событие завершения AI-ответа. Единая точка для звука и аватара. */
export const ASSISTANT_RESPONSE_COMPLETED = 'assistant.response.completed';

export class AIHub extends EventTarget {
  private providers = new Map<string, AIProvider>();
  private models: ModelInfo[] = [];
  private _activeModel: ModelInfo | null = null;

  constructor() {
    super();
    this.loadActiveModelFromLocalStorage();
  }

  register(provider: AIProvider): void {
    this.providers.set(provider.id, provider);
    this.models = Array.from(this.providers.values()).flatMap(p => p.models);

    const savedModelId = localStorage.getItem('belive:active-model');
    if (savedModelId && this.models.some(m => m.id === savedModelId)) {
        this._activeModel = this.models.find(m => m.id === savedModelId) || null;
    } else {
        this._activeModel = null;
        localStorage.removeItem('belive:active-model');
    }
    this.dispatchEvent(new CustomEvent('modelChanged', { detail: this._activeModel }));
  }

  getAllModels(): ModelInfo[] {
    return this.models;
  }

  setActiveModel(modelId: string | null): void {
    let newActiveModel: ModelInfo | null = null;
    if (modelId !== null) {
      newActiveModel = this.models.find(m => m.id === modelId) || null;
    }

    if (this._activeModel?.id === newActiveModel?.id) {
        return; // Модель не изменилась
    }

    this._activeModel = newActiveModel;

    if (this._activeModel) {
      localStorage.setItem('belive:active-model', this._activeModel.id);
    } else {
      localStorage.removeItem('belive:active-model');
    }
    this.dispatchEvent(new CustomEvent('modelChanged', { detail: this._activeModel }));
  }

  getActiveModel(): ModelInfo | null {
    if (this._activeModel) return this._activeModel;
    // Fallback: auto-select first belive model when none is set
    const fallback = this.models.find(m => m.provider === 'belive');
    if (fallback) {
      this._activeModel = fallback;
      localStorage.setItem('belive:active-model', fallback.id);
      this.dispatchEvent(new CustomEvent('modelChanged', { detail: fallback }));
    }
    return this._activeModel;
  }

  getActiveProvider(): AIProvider | null {
    const model = this.getActiveModel();
    return model ? this.providers.get(model.provider) || null : null;
  }

  on(eventName: string, listener: EventListenerOrEventListenerObject): void {
    this.addEventListener(eventName, listener);
  }

  off(eventName: string, listener: EventListenerOrEventListenerObject): void {
    this.removeEventListener(eventName, listener);
  }

  async sendMessage(
    request: ChatRequest,
    callbacks?: StreamCallbacks
  ): Promise<string | void> {
    let model = this.getActiveModel();
    if (!model) {
      callbacks?.onError?.(new AIError('NO_MODEL_SELECTED', 'No active AI model selected.'));
      return;
    }

    // 🛡️ GUARD: Если модель от OpenRouter, но API ключа нет → fallback на beLive
    if (model.provider === 'openrouter-direct') {
      const raw = localStorage.getItem('belive:ai-settings');
      const hasKey = raw ? !!JSON.parse(raw)?.state?.openRouterApiKey : false;
      if (!hasKey) {
        const fallback = this.models.find(m => m.provider === 'belive');
        if (fallback) {
          this.setActiveModel(fallback.id);
          model = fallback;
        }
      }
    }

    const provider = this.providers.get(model.provider);
    if (!provider) {
      callbacks?.onError?.(new AIError('PROVIDER_NOT_FOUND', `AI provider ${model.provider} not found.`));
      return;
    }

    // ▼ Единый контракт завершения для ВСЕХ провайдерских стримов (React-пути).
    let completionHandled = false;
    const wrapped: StreamCallbacks = {
      ...callbacks,
      onDone: (fullText, usage) => {
        if (completionHandled) return;
        completionHandled = true;
        this.dispatchEvent(new CustomEvent(ASSISTANT_RESPONSE_COMPLETED, {
          detail: { fullText, source: 'aiHub' },
        }));
        callbacks?.onDone?.(fullText, usage);
      },
    };
    return provider.sendChat(request, wrapped);
  }

  stopAllProviders(): void {
    this.providers.forEach(p => p.stop?.());
  }

  private loadActiveModelFromLocalStorage(): void {
    // Логика перенесена в register(), чтобы гарантировать наличие моделей
  }
}

export const aiHub = new AIHub();

// === Character-AI: data-driven assistant profiles (M3) ===
import type { CueSpec } from '../../character/sound/CharacterSoundManager';

export interface AssistantProfile {
  id: string;
  name: string;
  systemPrompt: string;
  soundProfile?: CueSpec;
  guestGate?: boolean; // true → гость НЕ допускается в платный чат (D4)
}

// Литерал (НЕ импорт значения CUE_DEFAULT — избегаем runtime-цикла registry↔CharacterSoundManager)
export const ASSISTANT_PROFILES: AssistantProfile[] = [
  {
    id: 'billy',
    name: 'Билли',
    systemPrompt: 'Ты — Билли, дружелюбный ИИ-помощник beLive.',
    soundProfile: { wave: 'sine', gain: 0.15, dur: 0.2, points: [[880, 0], [1760, 0.2]] },
    guestGate: false,
  },
  // TODO(M007/Mac, GPT A–E): English / Vocal Coach / Hero — реальные soundProfile
];

export function getProfileSound(id: string): CueSpec | undefined {
  return ASSISTANT_PROFILES.find((p) => p.id === id)?.soundProfile;
}
