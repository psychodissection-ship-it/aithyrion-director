async function testJevProxy() {
  console.log('--- Testing /api/jev/health ---');
  try {
    const healthRes = await fetch('http://localhost:5173/api/jev/health');
    console.log('Health status:', healthRes.status, await healthRes.json());
  } catch (e) {
    console.error('Health test error:', e);
  }

  console.log('\n--- Testing /api/jev/pass1 via Vite Proxy ---');
  try {
    const p1Res = await fetch('http://localhost:5173/api/jev/pass1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        state: {
          time: 14.5,
          energy: 0.88,
          energyTrend: 'rising',
          onsetStrength: 0.92,
          nextMajorChange: 3.5,
          bpm: 128,
          section: 'Drop'
        },
        history: []
      })
    });
    console.log('Pass 1 status:', p1Res.status);
    console.log('Pass 1 body:', await p1Res.json());
  } catch (e) {
    console.error('Pass 1 test error:', e);
  }

  console.log('\n--- Testing /api/jev/pass2 via Vite Proxy ---');
  try {
    const p2Res = await fetch('http://localhost:5173/api/jev/pass2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        state: {
          time: 14.5,
          energy: 0.88,
          energyTrend: 'rising',
          onsetStrength: 0.92,
          nextMajorChange: 3.5,
          bpm: 128,
          section: 'Drop'
        },
        strategy: 'INTENSIFY',
        history: []
      })
    });
    console.log('Pass 2 status:', p2Res.status);
    console.log('Pass 2 body:', await p2Res.json());
  } catch (e) {
    console.error('Pass 2 test error:', e);
  }
}

testJevProxy();
