import type { IncomingMessage, ServerResponse } from 'http';

/** Maximum request body size in bytes (10 MB) */
const MAX_BODY_SIZE = 10 * 1024 * 1024;

/**
 * Parse JSON request body with size limit enforcement.
 * Rejects with a clear error if the payload exceeds MAX_BODY_SIZE.
 */
export function parseJsonBody<T>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;

    req.on('data', (chunk: string | Buffer) => {
      size += typeof chunk === 'string' ? Buffer.byteLength(chunk) : chunk.length;
      if (size > MAX_BODY_SIZE) {
        req.destroy();
        reject(new Error(`Request body too large (limit: ${MAX_BODY_SIZE} bytes)`));
        return;
      }
      body += chunk;
    });

    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : ({} as T));
      } catch (err) {
        reject(err);
      }
    });

    req.on('error', reject);
  });
}

/**
 * Send a JSON response with the given status code.
 */
export function sendJson(res: ServerResponse, statusCode: number, data: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

/**
 * Sanitize a user-supplied identifier to prevent path traversal.
 * Only allows alphanumeric characters, hyphens, underscores, dots, and parentheses.
 */
export function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_\-.()\s]/g, '_');
}

/**
 * Resolve a path safely within the project root boundary.
 * Throws if the resolved path escapes the allowed root directory.
 */
export function resolvePathSafe(basePath: string, relativePath: string): string {
  const resolved = require('path').resolve(basePath, relativePath);
  const normalizedBase = require('path').resolve(basePath);
  if (!resolved.startsWith(normalizedBase)) {
    throw new Error(`Path traversal blocked: ${relativePath}`);
  }
  return resolved;
}
