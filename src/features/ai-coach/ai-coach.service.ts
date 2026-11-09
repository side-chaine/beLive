/**
 * AI Coach — провайдерская цепочка.
 *
 * Порядок: gateway → belive → openrouter-direct.
 * Первый доступный по конфигурации; если он падает ДО первого токена —
 * пробуем следующий. После первого токена фолбэка нет: второй провайдер
 * продублировал бы уже показанный текст.
 *
 * Single-flight: новый запрос отменяет предыдущий. В панели это дублируется
 * блокировкой композера, но сервис обязан быть безопасным сам по себе.
 */

import { AIError, type AIProvider, type ChatRequest } from '../../js/ai/types';
import { GatewayProvider } from '../../js/ai/providers/gateway-provider';
import { BeliveProvider } from '../../js/ai/providers/belive.provider';
import { OpenRouterDirectProvider } from '../../js/ai/providers/openrouter-direct.provider';
import { useUserProfileStore } from '../../stores/user-profile.store';
import { buildCoachMessages } from './ai-coach.context';
import type { AiCoachMessage } from './ai-coach.store';

export interface CoachStreamHandlers {
  onToken?: (token: string) => void;
  onDone?: (fullText: string) => void;
  onError?: (error: AIError) => void;
}

interface Candidate {
  provider: AIProvider;
  model: string;
}

type AttemptResult = 'ok' | 'aborted' | AIError;

const AI_SETTINGS_KEY = 'belive:ai-settings';

/** Есть ли у пользователя свой ключ OpenRouter (последний рубеж). */
function hasOpenRouterKey(): boolean {
  try {
    const raw = localStorage.getItem(AI_SETTINGS_KEY);
    if (!raw) return false;
    return Boolean(JSON.parse(raw)?.state?.openRouterApiKey);
  } catch {
    return false;
  }
}

export class AiCoachService {
  private readonly gateway = new GatewayProvider();
  private readonly belive = new BeliveProvider();
  private readonly openrouter = new OpenRouterDirectProvider();

  private active: AIProvider | null = null;
  private running = false;
  private pendingAbort: (() => void) | null = null;
  /** Поколение запроса: finally старого не должен гасить новый стрим. */
  private generation = 0;

  get isRunning(): boolean {
    return this.running;
  }

  /** Отправить реплику. `history` — сообщения ДО текущего вопроса. */
  async send(
    history: AiCoachMessage[],
    text: string,
    handlers: CoachStreamHandlers = {},
  ): Promise<void> {
    if (this.running) this.stop();

    const generation = ++this.generation;
    const candidates = this.candidates();
    if (!candidates.length) {
      handlers.onError?.(new AIError(
        'AI_COACH_NO_PROVIDER',
        'AI недоступен: войдите в аккаунт или добавьте ключ OpenRouter в настройках AI.',
      ));
      return;
    }

    this.running = true;
    let lastError: AIError | null = null;

    try {
      for (const candidate of candidates) {
        const result = await this.attempt(candidate, history, text, handlers);
        if (result === 'ok' || result === 'aborted') return;
        lastError = result;
      }

      handlers.onError?.(lastError ?? new AIError(
        'AI_COACH_ALL_FAILED',
        'Все AI-провайдеры не ответили. Попробуйте ещё раз.',
      ));
    } finally {
      // Пока стримили, мог стартовать следующий запрос — его состояние не трогаем.
      if (generation === this.generation) {
        this.running = false;
        this.active = null;
        this.pendingAbort = null;
      }
    }
  }

  /** Прервать текущий стрим. */
  stop(): void {
    this.generation++;
    this.pendingAbort?.();
    this.pendingAbort = null;
    this.active?.stop?.();
    this.active = null;
    this.running = false;
  }

  private candidates(): Candidate[] {
    const list: Candidate[] = [];

    if (import.meta.env.VITE_GATEWAY_URL) {
      list.push({ provider: this.gateway, model: 'openrouter/deepseek/deepseek-v3.1' });
    }

    const token = useUserProfileStore.getState().currentUser?.authToken;
    if (import.meta.env.VITE_AI_WORKER_URL && token) {
      list.push({ provider: this.belive, model: 'openrouter/free' });
    }

    if (hasOpenRouterKey()) {
      list.push({ provider: this.openrouter, model: 'deepseek/deepseek-chat-v3-0324' });
    }

    return list;
  }

  private attempt(
    candidate: Candidate,
    history: AiCoachMessage[],
    text: string,
    handlers: CoachStreamHandlers,
  ): Promise<AttemptResult> {
    return new Promise<AttemptResult>((resolve) => {
      let gotToken = false;
      let settled = false;
      let abortFn: (() => void) | null = null;

      const finish = (result: AttemptResult) => {
        if (settled) return;
        settled = true;
        // Не затираем abort нового запроса, если старый завершился позже.
        if (this.pendingAbort === abortFn) this.pendingAbort = null;
        resolve(result);
      };

      abortFn = () => finish('aborted');
      this.pendingAbort = abortFn;
      this.active = candidate.provider;

      const request: ChatRequest = {
        model: candidate.model,
        messages: buildCoachMessages(history, text),
        stream: true,
        temperature: 0.6,
        maxTokens: 400,
        // Свой промпт важнее серверного оператора — не даём гейтвею его подмешать.
        injectOperator: false,
      };

      void candidate.provider
        .sendChat(request, {
          onToken: (token) => {
            gotToken = true;
            handlers.onToken?.(token);
          },
          onDone: (fullText) => {
            handlers.onDone?.(fullText);
            finish('ok');
          },
          onError: (error) => {
            if (gotToken) {
              // Текст уже в панели. Молча продолжать нельзя, дублировать — тоже.
              handlers.onError?.(error);
              finish('ok');
              return;
            }
            finish(error);
          },
        })
        .catch((error: unknown) => {
          finish(
            error instanceof AIError
              ? error
              : new AIError('AI_COACH_UNKNOWN', String(error)),
          );
        });
    });
  }
}

export const aiCoachService = new AiCoachService();
