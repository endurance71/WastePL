import http from 'node:http';

const host = '127.0.0.1';
const port = 3000;

const address = {
  id: 'addr-bedzino-dworek-1',
  prgId: '320901_2.0004.1',
  canonicalText: 'Dworek 1, 76-037 Dworek',
  municipality: {
    id: 'muni-bedzino',
    terc: '3209012',
    name: 'Będzino',
  },
};

const schedule = {
  address,
  municipality: address.municipality,
  serviceArea: {
    id: 'sa-bedzino-trasa-1',
    name: 'Będzino – Trasa 1 (Zabudowa jednorodzinna)',
  },
  events: [
    { date: '2026-09-15', fraction: 'METALS_PLASTICS', status: 'SCHEDULED' },
    { date: '2026-09-18', fraction: 'PAPER', status: 'SCHEDULED' },
  ],
  source: {
    url: 'https://bip.bedzino.pl/odpady/trasa-1.pdf',
    format: 'PDF_TEXT',
    artifactId: 'art-bedzino-123',
    sha256: 'abc123def456',
    parserKey: 'municipal-collection-pdf-text',
    parserVersion: '1.0.0',
  },
  quality: {
    verificationStatus: 'OFFICIAL_SOURCE',
    confidence: 1,
    retrievedAt: '2026-09-03T18:00:00Z',
  },
};

function json(response, statusCode, body) {
  response.writeHead(statusCode, {
    'content-type': 'application/json',
    'cache-control': 'no-store',
  });
  response.end(JSON.stringify(body));
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://${host}:${port}`);

  if (request.method === 'GET' && url.pathname === '/__health') {
    json(response, 200, { status: 'ok' });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/v1/addresses/resolve') {
    json(response, 200, {
      query: url.searchParams.get('query') ?? '',
      items: [{ address, score: 1 }],
    });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/v1/collection') {
    json(response, 200, schedule);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/v1/facilities') {
    json(response, 200, { items: [] });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/v1/telemetry/events') {
    json(response, 201, { status: 'OK', received: 1, accepted: 1, deduplicated: 0 });
    return;
  }

  json(response, 404, { code: 'NOT_FOUND', message: 'Mock route not found' });
});

server.listen(port, host, () => {
  console.log(`WastePL offline E2E mock API listening at http://${host}:${port}`);
});

const shutdown = () => server.close(() => process.exit(0));
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
