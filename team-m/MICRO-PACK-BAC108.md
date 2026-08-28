# 🌊 MICRO-PACK-BAC108 · gateway fail-loud (GO-чеклист, НЕ волна) · handoff (DRAFT, REVISED per 002)
> Источник: Ц3 2.3 + Соннет 5. Не волна. Применяется СЕЙЧАС (fail-loud, без молчаливого localhost). frozen: НЕ трогать.
> Якоря: prod V3 не существует (пуш 🔒) → не инцидент, но обязательная GO-строка «VITE_GATEWAY_URL задан в прод-конфиге».
> 002 ТРЕБУЕТ ПАТЧА → revised: убран top-level throw (белый экран в dev), покрыт main.tsx:782 (декуплинг), dev/prod баланс, ленивость gateway-align.

## ЦЕЛЬ
Убрать молчаливый fallback на `localhost:8787`. В dev — `warn` + пусто (приложение грузится, AI-фичи fail на вызове). В prod — явный `throw`. Никто не бьёт в localhost тихо.

## ПРАВИТЬ (SAFE)
1. **`src/js/ai/providers/gateway-provider.ts`**
   - L3: `const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL;` (убрать hardcoded, может быть `undefined`)
   - L81 оставить: `constructor(private gatewayUrl: string = GATEWAY_URL) {}` (default = env, может быть `undefined`)
   - Добавить приватный резолвер, вызывать в методах, использующих `this.gatewayUrl` (healthCheck:85, chat, stream):
     ```ts
     private resolveUrl(): string {
       if (this.gatewayUrl) return this.gatewayUrl;
       if (import.meta.env.DEV) {
         console.warn('[BAC-108] VITE_GATEWAY_URL не задан — Gateway недоступен в dev.');
         return '';
       }
       throw new Error('[BAC-108] VITE_GATEWAY_URL не задан — AI Gateway недоступен в проде.');
     }
     ```
     Заменить `` `${this.gatewayUrl}/...` `` на `` `${this.resolveUrl()}/...` `` в healthCheck/chat/stream.
2. **`src/main.tsx`**
   - L782: `const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL;` (убрать `|| 'http://localhost:8787'`)
   - L783: регистрировать только если задан:
     ```ts
     if (GATEWAY_URL) {
       const gatewayProvider = new GatewayProvider(GATEWAY_URL);
       aiHub.register(gatewayProvider);
     }
     ```
3. **`src/sync/word-sync/config.ts`**
   - L1-2:
     ```ts
     export function getGatewayUrl(): string {
       const url = import.meta.env.VITE_GATEWAY_URL;
       if (url) return url;
       if (import.meta.env.DEV) { console.warn('[BAC-108] VITE_GATEWAY_URL не задан — word-sync в dev отключён.'); return ''; }
       throw new Error('[BAC-108] VITE_GATEWAY_URL не задан — word-sync недоступен в проде.');
     }
     ```
4. **`src/sync/word-sync/providers/gateway-align.provider.ts`**
   - L20: сделать endpoint ленивым (не в конструкторе), чтобы prod-throw срабатывал при реальном использовании align, а не при старте:
     ```ts
     private _endpoint: string | null = null;
     private get endpoint(): string {
       if (this._endpoint === null) this._endpoint = this.options.endpoint ?? `${getGatewayUrl()}/v1/align`;
       return this._endpoint;
     }
     ```
     (альтернатива: оставить L20 как есть — `getGatewayUrl()` вернёт `''` в dev, не упадёт; в prod упадёт при конструировании провайдера, что допустимо, т.к. прод обязан иметь URL. Ленивый вариант — безопаснее.)

## НЕ ТРОГАТЬ
`metrics-sync.service.ts:69`, `feed-data.store.ts:8` (уже workers.dev). Frozen-зона (AudioEngineV2/patchV1/bridges/track.orchestrator/_-поля) — НЕ менять.

## ГЕЙТ (Operator, post-apply)
1. `tsc --noEmit` → 0 NEW vs canon **306**.
2. `grep -rn "localhost:8787" src` → 0 (кроме комментов/истории/док).
3. Frozen-guard 🟢 GREEN (0 новых safe→frozen).
4. Dev-старт БЕЗ `VITE_GATEWAY_URL`: приложение грузится (`warn` в консоли), GatewayProvider не зарегистрирован / не падает; AI-фичи fail на вызове явно.

## СТАТУС
DRAFT (revised per 002 ТРЕБУЕТ ПАТЧА). Chain → 001 re-check → 009 → Operator.
