export function getGatewayUrl(): string {
  const url = import.meta.env.VITE_GATEWAY_URL;
  if (url) return url;
  if (import.meta.env.DEV) { console.warn('[BAC-108] VITE_GATEWAY_URL не задан — word-sync в dev отключён.'); return ''; }
  throw new Error('[BAC-108] VITE_GATEWAY_URL не задан — word-sync недоступен в проде.');
}
