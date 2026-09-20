import http from 'http';

http.get('http://localhost:5173/api/mv/status', (res) => {
  let b = '';
  res.on('data', (c) => (b += c));
  res.on('end', () => console.log('Master Status:', b));
});
