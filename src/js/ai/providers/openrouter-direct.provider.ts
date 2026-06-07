/**
 * OpenRouter Direct Provider — works without localhost gateway
 * Reads settings from localStorage directly (no React store dependency)
 * This preserves the js/ ← → stores/ boundary
 */

import { AIProvider, ChatRequest, StreamCallbacks, AIError } from '../types';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const SETTINGS_KEY = 'belive:ai-settings';

/** Read a field from persisted ai-settings (localStorage) */
function readSetting<K extends string>(key: K, fallback: string = ''): string {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return (parsed?.state?.[key] as string) ?? fallback;
  } catch {
    return fallback;
  }
}

export class OpenRouterDirectProvider implements AIProvider {
  readonly id = 'openrouter-direct';
  readonly displayName = 'OpenRouter';
  readonly models = [
    {
      id: 'deepseek/deepseek-chat-v3-0324',
      shortName: 'DeepSeek V3',
      provider: 'openrouter-direct',
      contextWindow: 64000,
      costTier: 'free' as const,
      capabilities: ['chat'],
    },
    {
      id: 'deepseek/deepseek-r1',
      shortName: 'DeepSeek R1',
      provider: 'openrouter-direct',
      contextWindow: 64000,
      costTier: 'free' as const,
      capabilities: ['chat'],
    },
    {
      id: 'meta-llama/llama-4-maverick',
      shortName: 'Llama 4 Maverick',
      provider: 'openrouter-direct',
      contextWindow: 1000000,
      costTier: 'free' as const,
      capabilities: ['chat'],
    },
    {
      id: 'google/gemini-2.0-flash-001',
      shortName: 'Gemini 2.0 Flash',
      provider: 'openrouter-direct',
      contextWindow: 1000000,
      costTier: 'low' as const,
      capabilities: ['chat', 'vision'],
    },
    {
      id: 'openai/gpt-4o-mini',
      shortName: 'GPT-4o Mini',
      provider: 'openrouter-direct',
      contextWindow: 128000,
      costTier: 'low' as const,
      capabilities: ['chat', 'vision'],
    },
    {
      id: 'anthropic/claude-3.5-haiku',
      shortName: 'Claude 3.5 Haiku',
      provider: 'openrouter-direct',
      contextWindow: 200000,
      costTier: 'low' as const,
      capabilities: ['chat'],
    },
  ];

  private currentAbortController: AbortController | null = null;

  private getApiKey(): string {
    return readSetting('openRouterApiKey', '');
  }

  private getTemperature(): number {
    const val = readSetting('temperature', '0.7');
    const num = parseFloat(val);
    return isNaN(num) ? 0.7 : num;
  }

  async healthCheck(): Promise<boolean> {
    const key = this.getApiKey();
    if (!key) return false;
    try {
      // Lightweight check — /models endpoint is free, no token consumption
      const res = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'Authorization': `Bearer ${key}`,
        },
        signal: AbortSignal.timeout(8000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async sendChat(request: ChatRequest, callbacks?: StreamCallbacks): Promise<string | void> {
    if (request.stream && callbacks) {
      return this.streamChat(request, callbacks);
    }
    callbacks?.onError?.(new AIError('NOT_IMPLEMENTED', 'Non-streaming not supported', this.id));
    return;
  }

  stop(): void {
    this.currentAbortController?.abort();
    this.currentAbortController = null;
  }

  private async streamChat(request: ChatRequest, callbacks: StreamCallbacks): Promise<void> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      callbacks.onError?.(new AIError(
        'NO_API_KEY',
        'OpenRouter API key not configured. Click 🤖 in header to set up.',
        this.id
      ));
      return;
    }

    this.currentAbortController?.abort();
    this.currentAbortController = new AbortController();
    const { signal } = this.currentAbortController;

    const temperature = request.temperature ?? this.getTemperature();



    try {
      const res = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'beLive',
        },
        body: JSON.stringify({
          model: request.model,
          messages: request.messages,
          stream: true,
          temperature,
          max_tokens: request.maxTokens ?? 1024,
        }),
        signal,
      });

      if (!res.ok) {
        const errorText = await res.text();
        let errorData;
        try { errorData = JSON.parse(errorText); } catch { /* ignore */ }
        console.error('[AI] OpenRouter error:', res.status, errorText.slice(0, 200));
        callbacks.onError?.(new AIError(
          errorData?.error?.code || 'OPENROUTER_ERROR',
          errorData?.error?.message || `OpenRouter error: ${res.status}`,
          this.id,
          res.status
        ));
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';
      let tokenCount = 0;

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

            // Future: Wave C — tool call handling
            if (delta?.tool_calls) {

            }

            if (delta?.content) {
              fullText += delta.content;
              tokenCount++;
              callbacks.onToken?.(delta.content);
            }
          } catch {
            // Skip unparseable chunks
          }
        }
      }


      callbacks.onDone?.(fullText);
    } catch (e: any) {
      if (e.name === 'AbortError') {

        return;
      }
      console.error('[AI] Stream error:', e.message);
      callbacks.onError?.(new AIError(
        'STREAM_ERROR',
        e.message || 'Stream fetch failed',
        this.id
      ));
    }
  }
}
