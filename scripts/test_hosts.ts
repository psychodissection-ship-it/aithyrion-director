import fs from 'fs';
import https from 'https';

const env = fs.readFileSync('.env', 'utf8');
const match = env.match(/MINIMAX_API_KEY\s*=\s*(.*)/);
const apiKey = match[1].trim().replace(/^['"]|['"]$/g, '');

const hosts = ['api.minimax.io', 'api.minimaxi.chat', 'api.minimax.chat'];

async function checkHost(h: string) {
  return new Promise<void>((resolve) => {
    const payload = JSON.stringify({
      model: 'MiniMax-H3',
      content: [{ type: 'text', text: 'Anime character with glowing purple butterfly' }],
      duration: 5,
      ratio: '16:9',
      resolution: '768P',
    });
    const req = https.request(
      {
        hostname: h,
        path: '/v2/video_generation',
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + apiKey,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let b = '';
        res.on('data', (c) => (b += c));
        res.on('end', () => {
          console.log(`[${h}] Status: ${res.statusCode} | Body: ${b}`);
          resolve();
        });
      }
    );
    req.on('error', (e) => {
      console.log(`[${h}] Network Error: ${e.message}`);
      resolve();
    });
    req.setTimeout(8000, () => {
      console.log(`[${h}] Timeout`);
      req.destroy();
      resolve();
    });
    req.write(payload);
    req.end();
  });
}

async function run() {
  for (const h of hosts) {
    await checkHost(h);
  }
}

run();
