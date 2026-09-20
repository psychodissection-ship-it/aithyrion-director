import http from 'http';
import fs from 'fs';
import path from 'path';
import { handleJevProxyRequest } from './jevProxyHandler';
import { handleCodexBridgeRequest } from './codexBridgeHandler';
import { handleHailuoVideoRequest } from './hailuoVideoHandler';
import { handleMvMasterRequest } from './mvMasterHandler';

// Load .env if present
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const [key, ...vals] = trimmed.split('=');
    if (key && vals.length > 0 && !process.env[key.trim()]) {
      process.env[key.trim()] = vals.join('=').trim().replace(/^["']|["']$/g, '');
    }
  });
}

const PORT = parseInt(process.env.API_PORT || '5174', 10);

const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const url = req.url || '';

  try {
    if (url.startsWith('/api/jev/')) {
      const handled = await handleJevProxyRequest(req, res);
      if (handled) return;
    }
    if (url.startsWith('/api/codex/')) {
      const handled = await handleCodexBridgeRequest(req, res);
      if (handled) return;
    }
    if (url.startsWith('/api/hailuo/')) {
      const handled = await handleHailuoVideoRequest(req, res);
      if (handled) return;
    }
    if (url.startsWith('/api/mv/')) {
      const handled = await handleMvMasterRequest(req, res);
      if (handled) return;
    }

    // Health check endpoint
    if (url === '/health' || url === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', service: 'aithyrion-director-api' }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Endpoint not found', url }));
  } catch (err: unknown) {
    console.error('Server request error:', err);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Aithyrion Director Standalone API Server listening on http://localhost:${PORT}`);
});
