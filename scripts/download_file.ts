import fs from 'fs';
import https from 'https';

const env = fs.readFileSync('.env', 'utf8');
const match = env.match(/MINIMAX_API_KEY\s*=\s*(.*)/);
const apiKey = match[1].trim().replace(/^['"]|['"]$/g, '');

https.get(
  {
    hostname: 'api.minimaxi.chat',
    path: '/v1/files/retrieve?file_id=443793442529582',
    headers: { Authorization: 'Bearer ' + apiKey },
  },
  (res) => {
    let body = '';
    res.on('data', (c) => (body += c));
    res.on('end', () => {
      console.log('File result:', body);
    });
  }
);
