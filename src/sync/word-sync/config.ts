export function getGatewayUrl(): string {
  return import.meta.env.VITE_GATEWAY_URL || 'http://localhost:8787';
}
