async function rebuildMaster() {
  console.log('Triggering build-master with proper shots config...');
  const res = await fetch('http://localhost:5173/api/mv/build-master', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      shots: [
        {
          shotIndex: 1,
          startTime: 0,
          endTime: 4.30,
          duration: 4.30,
          keyframePath: 'generated/keyframes/connect-the-thread-(1)-crop-96s-131s-shot-001.png'
        },
        {
          shotIndex: 2,
          startTime: 4.30,
          endTime: 8.80,
          duration: 4.50,
          keyframePath: 'generated/keyframes/connect-the-thread-(1)-crop-96s-131s-shot-002.png'
        },
        {
          shotIndex: 3,
          startTime: 8.80,
          endTime: 32.25,
          duration: 23.45,
          keyframePath: 'generated/keyframes/connect-the-thread-(1)-crop-96s-131s-shot-003.png'
        },
        {
          shotIndex: 4,
          startTime: 32.25,
          endTime: 35.05,
          duration: 2.80,
          keyframePath: 'generated/keyframes/connect-the-thread-(1)-crop-96s-131s-shot-004.png'
        }
      ],
      audioPath: 'generated/audio/active_track.wav',
      applyVjEffects: true,
      resolution: '720p'
    })
  });
  console.log('Build status:', res.status, await res.json());

  // Poll status until done
  let done = false;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const stRes = await fetch('http://localhost:5173/api/mv/status');
    const st = await stRes.json();
    console.log(`[${i}] ${st.progressPercent}% - ${st.statusMessage}`);
    if (!st.isBuilding) {
      done = true;
      break;
    }
  }
}
rebuildMaster();
