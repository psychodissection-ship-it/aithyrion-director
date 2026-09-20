import http from 'http';

const reqData = JSON.stringify({
  shots: [
    { shotIndex: 1, startTime: 0.0, endTime: 5.98, duration: 5.98 },
    { shotIndex: 2, startTime: 5.98, endTime: 11.2, duration: 5.22 },
    { shotIndex: 3, startTime: 11.2, endTime: 16.5, duration: 5.30 },
    { shotIndex: 4, startTime: 16.5, endTime: 21.8, duration: 5.30 },
    { shotIndex: 5, startTime: 21.8, endTime: 27.0, duration: 5.20 },
    { shotIndex: 6, startTime: 27.0, endTime: 32.0, duration: 5.00 },
  ],
  applyVjEffects: true,
  resolution: '720p',
});

const req = http.request(
  {
    hostname: 'localhost',
    port: 5173,
    path: '/api/mv/build-master',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(reqData),
    },
  },
  (res) => {
    let body = '';
    res.on('data', (c) => (body += c));
    res.on('end', () => {
      console.log('Build status response:', res.statusCode, body);
    });
  }
);
req.on('error', (err) => console.error('Error:', err));
req.write(reqData);
req.end();
