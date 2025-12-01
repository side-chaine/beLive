import { AIProvider, ChatRequest, ModelInfo, StreamCallbacks, AIError, StreamEvent } from '../types';

const GATEWAY_URL = 'http://localhost:8787'; // TODO: Replace with your Cloudflare Workers Gateway URL

interface EphemeralToken {
  token: string;
  expiresAt: number;
}

export class GatewayProvider implements AIProvider {
  readonly id = 'gateway';
  readonly displayName = 'beLive Gateway';
  readonly models: ModelInfo[] = [
    {
      id: 'openrouter/google/gemini-2.5-pro',
      shortName: 'Gemini 2.5 Pro',
      provider: 'gateway',
      contextWindow: 1000000,
      costTier: 'mid',
      capabilities: ['chat', 'vision'],
      // icon: 'https://raw.githubusercontent.com/walkxcode/dashboard-icons/main/svg/google-gemini-pro.svg', // SVG Icon for Gemini 2.5 Pro
    },
    {
      id: 'openrouter/anthropic/claude-4.5-sonnet-20250929-thinking',
      shortName: 'Claude 4.5 Sonnet',
      provider: 'gateway',
      contextWindow: 200000,
      costTier: 'mid',
      capabilities: ['chat', 'vision', 'artifacts'],
      icon: 'https://raw.githubusercontent.com/walkxcode/dashboard-icons/main/svg/claude.svg', // SVG Icon for Claude 4.5 Sonnet
    },
    {
      id: 'openrouter/openai/gpt-5-high',
      shortName: 'GPT-5 High',
      provider: 'gateway',
      contextWindow: 128000,
      costTier: 'high',
      capabilities: ['chat', 'function-calling'],
      icon: 'https://raw.githubusercontent.com/walkxcode/dashboard-icons/main/svg/openai.svg', // SVG Icon for GPT-5 High
    },
    {
      id: 'openrouter/openai/gpt-4o-mini',
      shortName: 'GPT-4o Mini',
      provider: 'gateway',
      contextWindow: 128000,
      costTier: 'low',
      capabilities: ['chat', 'vision', 'function-calling'],
      icon: 'https://raw.githubusercontent.com/walkxcode/dashboard-icons/main/svg/openai.svg', // SVG Icon for GPT-4o Mini
    },
    {
      id: 'openrouter/meta-llama/llama-3.1-8b-instruct',
      shortName: 'Llama 3.1 8B',
      provider: 'gateway',
      contextWindow: 128000,
      costTier: 'low',
      capabilities: ['chat'],
      // icon: 'https://raw.githubusercontent.com/walkxcode/dashboard-icons/main/svg/llama.svg', // SVG Icon for Llama 3.1 8B
    },
    {
      id: 'openrouter/xai/grok-1-vision',
      shortName: 'Grok 4 Vision',
      provider: 'gateway',
      contextWindow: 128000,
      costTier: 'low',
      capabilities: ['chat'],
      icon: 'https://raw.githubusercontent.com/walkxcode/dashboard-icons/main/svg/grok.svg', // SVG Icon for Grok 4 Vision
    },
    {
      id: 'openrouter/deepseek/deepseek-v3.1',
      shortName: 'DeepSeek-V3.1',
      provider: 'gateway',
      contextWindow: 1840000, // 1.84M tokens
      costTier: 'free',
      capabilities: ['chat', 'vision', 'function-calling'], // Multimodal and tool calling
    },
  ];

  private ephemeral: EphemeralToken | null = null;
  private currentAbortController: AbortController | null = null;

  constructor(private gatewayUrl: string = GATEWAY_URL) {}

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${this.gatewayUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async sendChat(
    request: ChatRequest,
    callbacks?: StreamCallbacks
  ): Promise<string | void> {
    if (request.stream && callbacks) {
      return this.streamChat(request, callbacks);
    } else {
      // For non-streaming requests, we'd implement a different endpoint or handle it differently.
      // For now, we only support streaming.
      callbacks?.onError?.(new AIError('NOT_IMPLEMENTED', 'Non-streaming chat is not implemented.'));
      return;
    }
  }

  stop(): void {
    this.currentAbortController?.abort();
    this.currentAbortController = null;
  }

  private async getEphemeralToken(): Promise<string> {
    const now = Date.now();
    if (this.ephemeral && this.ephemeral.expiresAt - now > 5000) {
      return this.ephemeral.token;
    }

    try {
      const res = await fetch(`${this.gatewayUrl}/auth/ephemeral`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new AIError('AUTH_ERROR', errorData.error?.message || 'Failed to get ephemeral token', this.id, res.status);
      }
      const data = await res.json();
      this.ephemeral = { token: data.token, expiresAt: data.expiresAt };
      return this.ephemeral.token;
    } catch (e: any) {
      throw new AIError('NETWORK_ERROR', e.message || 'Network error during ephemeral token request', this.id);
    }
  }

  private async streamChat(
    request: ChatRequest,
    callbacks: StreamCallbacks
  ): Promise<void> {
    const token = await this.getEphemeralToken();

    this.currentAbortController?.abort(); // Abort any ongoing stream
    this.currentAbortController = new AbortController();
    const { signal } = this.currentAbortController;

    try {
      const res = await fetch(`${this.gatewayUrl}/v1/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(request),
        signal, // Pass the abort signal
      });

      if (!res.ok) {
        const errorText = await res.text();
        let errorData;
        try { errorData = JSON.parse(errorText); } catch { /* ignore */ }
        callbacks.onError?.(new AIError(
          errorData?.error?.code || 'GATEWAY_ERROR',
          errorData?.error?.message || `Gateway error: ${res.status} ${errorText}`,
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
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') continue; // Handled by backend logic, but good to have fallback

          try {
            const event: StreamEvent = JSON.parse(jsonStr);
            switch (event.type) {
              case 'token':
                fullText += event.data;
                callbacks.onToken?.(event.data);
                break;
              case 'done':
                callbacks.onDone?.(event.data.fullText || fullText, event.data.usage);
                break;
              case 'error':
                callbacks.onError?.(new AIError(event.data.code, event.data.message, this.id));
                break;
              // 'start' event is handled directly by callbacks.onStart
            }
          } catch (e) {
            console.warn('Failed to parse SSE event:', line, e);
            // callbacks.onError?.(new AIError('PARSE_ERROR', `Failed to parse SSE event: ${line}`, this.id));
          }
        }
      }
      // Ensure onDone is called if not explicitly sent by gateway (fallback)
      callbacks.onDone?.(fullText);
    } catch (e: any) {
      if (e.name === 'AbortError') {
        console.log('Stream aborted.');
        return; // Stream was intentionally stopped
      }
      callbacks.onError?.(new AIError('STREAM_FETCH_ERROR', e.message || 'Failed to fetch stream', this.id));
    }
  }
}
