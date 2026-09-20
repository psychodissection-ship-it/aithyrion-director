import fs from 'fs';
import path from 'path';
import https from 'https';

const env = fs.readFileSync('.env', 'utf8');
const match = env.match(/MINIMAX_API_KEY\s*=\s*(.*)/);
if (!match) {
  console.error('No MINIMAX_API_KEY in .env');
  process.exit(1);
}
const apiKey = match[1].trim().replace(/^['"]|['"]$/g, '');

const payload = {
  model: 'MiniMax-H3',
  content: [
    { type: 'text', text: 'Anime character standing gracefully with glowing purple butterflies' }
  ],
  duration: 5,
  ratio: '16:9',
  resolution: '768P'
};

const data = JSON.stringify(payload);
const req = https.request(
  {
    hostname: 'api.minimaxi.chat',
    path: '/v2/video_generation',
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data),
    },
  },
  (res) => {
    let body = '';
    res.on('data', (c) => (body += c));
    res.on('end', () => {
      console.log('HTTP Status:', res.statusCode);
      console.log('MiniMax Response:', body);
    });
  }
);
req.on('error', (err) => console.error(err));
req.write(data);
req.end();
