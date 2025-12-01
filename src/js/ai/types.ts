export type MessageRole = 'system' | 'user' | 'assistant';

export interface Message {
  role: MessageRole;
  content: string;
  name?: string;
}

export interface ChatRequest {
  model: string;
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  user?: string;
  injectOperator?: boolean;
}

export type StreamEvent =
  | { type: 'start'; model: string; timestamp: number }
  | { type: 'token'; data: string }
  | { type: 'done'; data: { fullText: string; usage?: TokenUsage } }
  | { type: 'error'; data: { code: string; message: string } };

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface StreamCallbacks {
  onStart?: (model: string) => void;
  onToken?: (token: string) => void;
  onDone?: (fullText: string, usage?: TokenUsage) => void;
  onError?: (error: AIError) => void;
}

export class AIError extends Error {
  constructor(
    public code: string,
    message: string,
    public provider?: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'AIError';
  }
}

export interface AIProvider {
  readonly id: string;
  readonly displayName: string;
  readonly models: ModelInfo[];
  sendChat(
    request: ChatRequest,
    callbacks?: StreamCallbacks
  ): Promise<string | void>;
  healthCheck(): Promise<boolean>;
  stop?(): void; // Для остановки стриминга
}

export interface ModelInfo {
  id: string;
  shortName: string;
  provider: string;
  contextWindow: number;
  costTier: 'free' | 'low' | 'mid' | 'high';
  capabilities: string[];
  icon?: string;
}
