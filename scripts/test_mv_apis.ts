async function test() {
  try {
    const resetRes1 = await fetch('http://localhost:5173/api/mv/reset-project', { method: 'POST' });
    console.log('reset-project:', await resetRes1.json());

    const resetRes2 = await fetch('http://localhost:5173/api/hailuo/reset-videos', { method: 'POST' });
    console.log('reset-videos:', await resetRes2.json());

    const testAudio = Buffer.from('RIFF....WAVEfmt ....data....');
    const uploadRes = await fetch('http://localhost:5173/api/mv/upload-audio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: testAudio
    });
    console.log('upload-audio:', await uploadRes.json());
  } catch (err) {
    console.error('Error:', err);
  }
}
test();
