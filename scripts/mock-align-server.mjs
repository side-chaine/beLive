import http from 'node:http';

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

      const result = buildMockAlignmentResult(body);
      sendJson(res, 200, result, origin);
    });
    return;
  }

  sendJson(res, 404, { error: 'Not found' }, origin);
});

server.listen(PORT, () => {
  console.log(`[mock-align] listening on http://localhost:${PORT}`);
});
