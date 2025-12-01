import { AIProvider, ChatRequest, ModelInfo, StreamCallbacks, AIError } from './types';

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
    const model = this.getActiveModel();
    if (!model) {
      callbacks?.onError?.(new AIError('NO_MODEL_SELECTED', 'No active AI model selected.'));
      return;
    }
    const provider = this.providers.get(model.provider);
    if (!provider) {
      callbacks?.onError?.(new AIError('PROVIDER_NOT_FOUND', `AI provider ${model.provider} not found.`));
      return;
    }
    return provider.sendChat(request, callbacks);
  }

  stopAllProviders(): void {
    this.providers.forEach(p => p.stop?.());
  }

  private loadActiveModelFromLocalStorage(): void {
    // Логика перенесена в register(), чтобы гарантировать наличие моделей
  }
}

export const aiHub = new AIHub();
