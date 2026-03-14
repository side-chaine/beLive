import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const PORT = 8787;

function sendJson(res, status, data, origin = '*') {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(JSON.stringify(data));
}

function buildMockWords(line, lineStart, lineEnd) {
  const text = typeof line?.text === 'string' ? line.text : '';
  const parts = text.trim() ? text.trim().split(/\s+/) : [];
  if (!parts.length) return [];

  const total = lineEnd - lineStart;
  const step = total / parts.length;

  return parts.map((word, index) => ({
    id: `w-${line.rawLineIndex}-${index}`,
    text: word,
    normalizedText: word.toLowerCase(),
    start: +(lineStart + step * index).toFixed(3),
    end: +(lineStart + step * (index + 1)).toFixed(3),
    confidence: 0.75,
    rawLineIndex: line.rawLineIndex,
    contentLineIndex: line.contentLineIndex,
    wordIndex: index,
  }));
}

// TC-107: Dev-only RU artifact variant selector
// Usage: DEV_RU_ARTIFACT_VARIANT=shaped node scripts/mock-align-server.mjs
const DEV_RU_VARIANT = process.env.DEV_RU_ARTIFACT_VARIANT || 'raw';

const RU_RAW_PATH = 'research/artifacts/track2-real-alignment-mms-real.json';
const RU_SHAPED_PATH = 'research/artifacts/track2-real-alignment-mms-real.shaped.preview.json';

const RU_ACTIVE_PATH = DEV_RU_VARIANT === 'shaped' ? RU_SHAPED_PATH : RU_RAW_PATH;

const REAL_ARTIFACTS = [
  'research/artifacts/lp_crawling-alignment.json',  // EN Crawling
  'research/artifacts/packA-real-alignment-mms-real.json',  // EN
  RU_ACTIVE_PATH,  // RU (raw or shaped based on env)
];

function tryLoadRealArtifact(body) {
  for (const rel of REAL_ARTIFACTS) {
    const artifactPath = path.resolve(process.cwd(), rel);
    if (!fs.existsSync(artifactPath)) continue;
    try {
      const raw = fs.readFileSync(artifactPath, 'utf-8');
      const artifact = JSON.parse(raw);

      const sameLyricsHash =
        artifact?.lyricsHash &&
        body?.lyricsHash &&
        artifact.lyricsHash === body.lyricsHash;

      const sameAudioSource =
        artifact?.audioSource &&
        body?.audioSource &&
        artifact.audioSource === body.audioSource;

      if (sameLyricsHash && sameAudioSource && Array.isArray(artifact?.lines)) {
        console.log('[mock-align] serving real artifact:', rel);
        return artifact;
      }
    } catch (error) {
      console.warn('[mock-align] failed to load artifact:', rel, error);
    }
  }
  return null;
}

function buildMockAlignmentResult(body) {
  const alignableLines = Array.isArray(body?.alignableLines) ? body.alignableLines : [];

  const anchors = Array.isArray(body?.anchors) ? body.anchors : [];
  const anchorMap = new Map(
    anchors
      .filter((a) => a && a.kind === 'line' && typeof a.rawLineIndex === 'number' && typeof a.time === 'number')
      .map((a) => [a.rawLineIndex, a.time])
  );

  const lines = alignableLines.map((line, index) => {
    const start =
      typeof anchorMap.get(line.rawLineIndex) === 'number'
        ? Number(anchorMap.get(line.rawLineIndex).toFixed(3))
        : +(index * 2).toFixed(3);

    let end = start + 2;
    for (let i = index + 1; i < alignableLines.length; i++) {
      const next = alignableLines[i];
      const nextAnchor = anchorMap.get(next.rawLineIndex);
      if (typeof nextAnchor === 'number' && nextAnchor > start) {
        end = Number(nextAnchor.toFixed(3));
        break;
      }
    }

    return {
      rawLineIndex: line.rawLineIndex,
      contentLineIndex: line.contentLineIndex,
      text: line.text,
      start,
      end,
      confidence: 0.9,
      words: buildMockWords(line, start, end),
      anchorTime: anchorMap.get(line.rawLineIndex),
    };
  });

  return {
    source: 'ai-aligner',
    version: 1,
    trackId: body?.trackId,
    language: body?.language,
    lyricsHash: body?.lyricsHash,
    audioHash: body?.audioHash,
    audioSource: body?.audioSource,
    provider: 'mock',
    providerVersion: 'local-dev',
    mode: body?.mode,
    lines,
    separators: [],
  };
}

const server = http.createServer((req, res) => {
  const origin = req.headers.origin || '*';

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    sendJson(res, 200, { ok: true, service: 'mock-align', version: 'local-dev' }, origin);
    return;
  }

  if (req.method === 'POST' && req.url === '/v1/align') {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      let body;
      try {
        body = raw ? JSON.parse(raw) : {};
      } catch {
        sendJson(res, 400, { error: 'Invalid JSON body' }, origin);
        return;
      }

      if (!Array.isArray(body?.alignableLines) || body.alignableLines.length === 0) {
        sendJson(res, 400, { error: 'alignableLines is required' }, origin);
        return;
      }

      const realArtifact = tryLoadRealArtifact(body);
      if (realArtifact) {
        sendJson(res, 200, realArtifact, origin);
        return;
      }

      const result = buildMockAlignmentResult(body);
      sendJson(res, 200, result, origin);
    });
    return;
  }

  sendJson(res, 404, { error: 'Not found' }, origin);
});

server.listen(PORT, () => {
  console.log(`[mock-align] listening on http://localhost:${PORT}`);
  console.log(`[mock-align] RU artifact variant: ${DEV_RU_VARIANT}`);
  console.log(`[mock-align] RU artifact path: ${RU_ACTIVE_PATH}`);
  if (DEV_RU_VARIANT === 'shaped') {
    console.log(`[mock-align] NOTE: Using SHAPED preview artifact for RU`);
  }
});
