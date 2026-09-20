import fs from 'fs';
import https from 'https';

const env = fs.readFileSync('.env', 'utf8');
const match = env.match(/MINIMAX_API_KEY\s*=\s*(.*)/);
const apiKey = match[1].trim().replace(/^['"]|['"]$/g, '');
const taskId = '443792909844798';

https.get(
  {
    hostname: 'api.minimaxi.chat',
    path: '/v1/query/video_generation?task_id=' + taskId,
    headers: { Authorization: 'Bearer ' + apiKey },
  },
  (res) => {
    let body = '';
    res.on('data', (c) => (body += c));
    res.on('end', () => {
      console.log('Hailuo-2.3 Task Status:', body);
    });
  }
);
