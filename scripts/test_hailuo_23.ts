import fs from 'fs';
import https from 'https';

const env = fs.readFileSync('.env', 'utf8');
const match = env.match(/MINIMAX_API_KEY\s*=\s*(.*)/);
const apiKey = match[1].trim().replace(/^['"]|['"]$/g, '');

const payload = {
  model: 'MiniMax-Hailuo-2.3',
  prompt: 'A cinematic shot of a glowing ethereal cathedral',
  duration: 6
};

const data = JSON.stringify(payload);
const req = https.request(
  {
    hostname: 'api.minimaxi.chat',
    path: '/v1/video_generation',
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
      console.log('HTTP Status (Hailuo-2.3):', res.statusCode);
      console.log('MiniMax Response:', body);
    });
  }
);
req.on('error', (err) => console.error(err));
req.write(data);
req.end();
