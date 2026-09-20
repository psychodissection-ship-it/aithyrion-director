import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { handleJevProxyRequest } from './server/jevProxyHandler';
import { handleCodexBridgeRequest } from './server/codexBridgeHandler';
import { handleHailuoVideoRequest } from './server/hailuoVideoHandler';
import { handleMvMasterRequest } from './server/mvMasterHandler';

import type { Connect } from 'vite';
import type { ServerResponse } from 'http';

function createApiMiddleware(): Connect.NextHandleFunction {
  return async (req: Connect.IncomingMessage, res: ServerResponse, next: Connect.NextFunction) => {
    try {
      if (req.url && req.url.startsWith('/api/jev/')) {
        const handled = await handleJevProxyRequest(req, res);
        if (handled) return;
      }
      if (req.url && req.url.startsWith('/api/codex/')) {
        const handled = await handleCodexBridgeRequest(req, res);
        if (handled) return;
      }
      if (req.url && req.url.startsWith('/api/hailuo/')) {
        const handled = await handleHailuoVideoRequest(req, res);
        if (handled) return;
      }
      if (req.url && req.url.startsWith('/api/mv/')) {
        const handled = await handleMvMasterRequest(req, res);
        if (handled) return;
      }
    } catch (err) {
      console.error('[API Middleware Error]:', err);
    }
    next();
  };
}

function jevProxyPlugin(): Plugin {
  const middleware = createApiMiddleware();
  return {
    name: 'jev-and-codex-api-proxy',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  if (env.JEV_API_ENDPOINT) process.env.JEV_API_ENDPOINT = env.JEV_API_ENDPOINT;
  if (env.JEV_API_KEY) process.env.JEV_API_KEY = env.JEV_API_KEY;
  if (env.MINIMAX_API_KEY) process.env.MINIMAX_API_KEY = env.MINIMAX_API_KEY;
  if (env.MINIMAX_API_HOST) process.env.MINIMAX_API_HOST = env.MINIMAX_API_HOST;

  return {
    plugins: [react(), jevProxyPlugin()],
    server: {
      port: 5173,
      host: true,
    }
  };
});
