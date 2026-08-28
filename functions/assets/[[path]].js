export async function onRequest({ request, env }) {
  const res = await env.ASSETS.fetch(request);
  if (!res.ok || (res.headers.get('content-type') || '').includes('text/html'))
    return new Response('Not Found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  return res;
}
