import { createLiveJevServer } from './liveJevDaemon';

const PORT = 5180;
const server = createLiveJevServer();

server.listen(PORT, () => {
  console.log(`[JEV Neural Core] Standalone live server running on http://localhost:${PORT}`);
  console.log(`[JEV Neural Core] Bearer authentication active.`);
});
