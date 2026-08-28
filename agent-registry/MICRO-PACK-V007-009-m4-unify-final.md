# MICRO-PACK V007-009 — M4 unify (FINAL, after 002)

**Цепь:** recon(explore) → 002 (finalize+stress) → 009 (verify+doc) → Operator
**Канон:** `tsc --noEmit` ровно **314** · `vitest run` **763/763**
**Frozen:** `AudioEngineV2.ts`/`patchV1.ts`/`bridges/*`/`track.orchestrator.ts`/`_`-поля — НЕ трогать.

## EDIT 1 — `src/js/ui/ai-chat-ui.ts` (imports)
OLD:
```ts
import { aiHub, ASSISTANT_RESPONSE_COMPLETED } from '../ai/registry';
import { characterSoundManager } from '../../character/sound/CharacterSoundManager';
import { streamOpenAI } from '../utils/stream-openai';
```
NEW:
```ts
import { aiHub } from '../ai/registry';
import { characterSoundManager } from '../../character/sound/CharacterSoundManager';
```

## EDIT 2 — `src/js/ui/ai-chat-ui.ts` (field swap, ~:22)
OLD:
```ts
  private isStreaming = false;
  private abortController: AbortController | null = null;
```
NEW:
```ts
  private isStreaming = false;
  private wasAborted = false;
```

## EDIT 3 — `src/js/ui/ai-chat-ui.ts` handleSend core (~:85-148)
OLD:
```ts
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

      // ▼ Единый контракт завершения для ВАНИЛЬНОГО пути — ДО tool-calls,
      // чтобы кью/аватар не пропали, если checkForToolCalls бросит (G1)
      aiHub.dispatchEvent(new CustomEvent(ASSISTANT_RESPONSE_COMPLETED, {
        detail: { fullText, source: 'vanilla-chat' },
      }));

      // tool-calls — нефатально: любой throw НЕ должен гасить уже отыгранный кью/аватар
      try {
        await this.checkForToolCalls(fullText);
      } catch (toolErr) {
        console.error('[ai-chat-ui] checkForToolCalls failed (non-fatal):', toolErr);
      }

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
```
NEW:
```ts
    this.wasAborted = false;
    performance.mark('message-sent');

    try {
      this.isStreaming = true;

      let currentText = '';
      let isFirstToken = true;

      await aiHub.sendMessage(
        {
          model: activeModel.id,
          messages: [{ role: 'user', content: messageText }], // TODO: history (паритет со старым vanilla-путём)
          stream: true,
        },
        {
          onToken: (token) => {
            if (isFirstToken) {
              PerformanceMonitor.measureFirstToken();
              this.updateMessage(aiMessageEl, '', false);
              isFirstToken = false;
            }
            currentText += token;
            this.updateMessage(aiMessageEl, currentText, false);
          },
          onDone: (fullText) => {
            if (this.wasAborted) return;
            this.checkForToolCalls(fullText).catch((toolErr) => {
              console.error('[ai-chat-ui] checkForToolCalls failed (non-fatal):', toolErr);
            });
          },
          onError: (err) => {
            if (this.wasAborted) return;
            console.error('AI Chat Error:', err);
            this.updateMessage(aiMessageEl, `❌ Ошибка: ${err.message}`, false);
          },
        }
      );
    } catch (error: any) {
      console.error('AI Chat Error:', error);
      this.updateMessage(aiMessageEl, `❌ Ошибка: ${error.message}`, false);
    } finally {
      this.isStreaming = false;
      this.sendButton.disabled = false;
      this.inputField.disabled = false;
      this.currentMessageElement = null;
      this.inputField.focus();
    }
  };
```

## EDIT 4 — `src/js/ui/ai-chat-ui.ts` closeChat (~:267-275)
OLD:
```ts
    if (this.isStreaming && this.abortController) {
      this.abortController.abort();
      this.isStreaming = false;
      this.sendButton.disabled = false;
      this.inputField.disabled = false;
      if (this.currentMessageElement) {
          this.updateMessage(this.currentMessageElement, '❌ Генерация остановлена', false);
      }
    }
```
NEW:
```ts
    if (this.isStreaming) {
      this.wasAborted = true;
      aiHub.stopAllProviders();
      this.isStreaming = false;
      this.sendButton.disabled = false;
      this.inputField.disabled = false;
      if (this.currentMessageElement) {
          this.updateMessage(this.currentMessageElement, '❌ Генерация остановлена', false);
      }
    }
```

## EDIT 5 — `src/js/ui/ai-chat-ui.ts` delete dead `mapError` (~:371-377)
OLD:
```

  private mapError(status: number): string {
    if (status === 401 || status === 403) return "Нужно снова войти.";
    if (status === 429) return "Слишком часто. Подождите несколько секунд…";
    if (status >= 500) return "Сервер временно недоступен. Попробуйте позже.";
    return "Не удалось получить ответ. Попробуйте ещё раз.";
  }
}
```
NEW:
```ts
}
```

## EDIT 6 — `src/js/ai/registry.ts` sendMessage wrapper (~:108-117)
OLD:
```ts
    const wrapped: StreamCallbacks = {
      ...callbacks,
      onDone: (fullText, usage) => {
        this.dispatchEvent(new CustomEvent(ASSISTANT_RESPONSE_COMPLETED, {
          detail: { fullText, source: 'aiHub' },
        }));
        callbacks?.onDone?.(fullText, usage);
      },
    };
```
NEW:
```ts
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
```

## EDIT 7 — DELETE `src/js/utils/stream-openai.ts`

---
Диспетч: EDITS 1-5 атомарно на ai-chat-ui.ts, EDIT 6 на registry, EDIT 7 последний. Smoke: отправка → один cue/один tool; Esc посреди стрима → «Генерация остановлена», без ошибок консоли.
