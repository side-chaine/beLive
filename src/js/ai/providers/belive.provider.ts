/**
 * beLive AI Provider — built-in AI proxy through CF Worker
 * No API key required from user. Uses JWT auth from OAuth login.
 * Rate limited to 20 requests/day per user.
 */

import { AIProvider, ChatRequest, StreamCallbacks, AIError } from '../types';

const AI_WORKER_URL = import.meta.env.VITE_AI_WORKER_URL;

export class BeliveProvider implements AIProvider {
  readonly id = 'belive';
  readonly displayName = 'beLive AI';
  readonly models = [
    {
      id: 'deepseek/deepseek-r1:free',
      shortName: 'DeepSeek R1',
      provider: 'belive',
      contextWindow: 64000,
      costTier: 'free' as const,
      capabilities: ['chat'],
    },
    {
      id: 'meta-llama/llama-4-maverick:free',
      shortName: 'Llama 4 Maverick',
      provider: 'belive',
      contextWindow: 1000000,
      costTier: 'free' as const,
      capabilities: ['chat'],
    },
  ];

  private currentAbortController: AbortController | null = null;

  async healthCheck(): Promise<boolean> {
    if (!AI_WORKER_URL) return false;
    try {
      const res = await fetch(AI_WORKER_URL, {
        method: 'POST',
        signal: AbortSignal.timeout(5000),
      });
      // Expect 401 (no auth) — means worker is alive
      return res.status === 401;
    } catch {
      return false;
    }
  }

  async sendChat(request: ChatRequest, callbacks?: StreamCallbacks): Promise<string | void> {
    if (request.stream && callbacks) {
      return this.streamChat(request, callbacks);
    }
    callbacks?.onError?.(new AIError('NOT_IMPLEMENTED', 'Non-streaming not supported', this.id));
  }

  stop(): void {
    this.currentAbortController?.abort();
    this.currentAbortController = null;
  }

  private async streamChat(request: ChatRequest, callbacks: StreamCallbacks): Promise<void> {
    if (!AI_WORKER_URL) {
      callbacks.onError?.(new AIError(
        'CONFIG_ERROR',
        'AI Worker URL not configured. Set VITE_AI_WORKER_URL in your environment.',
        this.id
      ));
      return;
    }

    // Get JWT token from auth store
    const { useUserProfileStore } = await import('../../../stores/user-profile.store');
    const token = useUserProfileStore.getState().currentUser?.authToken;

    if (!token) {
      callbacks.onError?.(new AIError(
        'AUTH_REQUIRED',
        'Требуется авторизация. Войдите через Google, чтобы использовать beLive AI.',
        this.id
      ));
      return;
    }

    this.currentAbortController?.abort();
    this.currentAbortController = new AbortController();
    const { signal } = this.currentAbortController;

    // Двойная защита: если модель не указана — используем дефолтную
    const modelToUse = request.model || 'meta-llama/llama-4-maverick:free';

    try {
      const res = await fetch(AI_WORKER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          model: modelToUse,
          messages: request.messages,
          stream: true,
          temperature: request.temperature ?? 0.7,
          max_tokens: request.maxTokens ?? 1024,
        }),
        signal,
      });

      if (!res.ok) {
        let msg = 'Ошибка сервера';
        if (res.status === 401) msg = 'Сессия истекла. Войдите снова.';
        if (res.status === 429) msg = 'Лимит 20 запросов в день исчерпан.';
        const errorText = await res.text();
        console.error('[BeliveAI] Error:', res.status, errorText.slice(0, 200));
        callbacks.onError?.(new AIError(
          'WORKER_ERROR',
          msg,
          this.id,
          res.status
        ));
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';

      callbacks.onStart?.(request.model);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') {
            callbacks.onDone?.(fullText);
            return;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta;
            if (delta?.content) {
              fullText += delta.content;
              callbacks.onToken?.(delta.content);
            }
          } catch {
            // Skip unparseable chunks
          }
        }
      }

      callbacks.onDone?.(fullText);
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      console.error('[BeliveAI] Stream error:', e.message);
      callbacks.onError?.(new AIError(
        'STREAM_ERROR',
        e.message || 'Stream fetch failed',
        this.id
      ));
    }
  }
}
