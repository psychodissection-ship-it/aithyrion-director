import { JevDirectorEngine } from '../src/services/engine/JevDirectorEngine';
import { handleJevProxyRequest } from '../server/jevProxyHandler';
import { createLiveJevServer } from '../server/liveJevDaemon';
import { createServer } from 'http';

async function runPhase3Verification() {
  console.log('=== Aithyrion Director: Phase 3 Live JEV Proof Verification ===\n');

  // Start live neural JEV server on port 5198
  const liveJevPort = 5198;
  const liveDaemon = createLiveJevServer();
  await new Promise<void>((resolve) => liveDaemon.listen(liveJevPort, () => resolve()));
  console.log(`[Setup] Live JEV upstream daemon listening on port ${liveJevPort}`);

  // Test 1: Verify Fail-Closed Policy when unconfigured
  console.log('\n[Check 1] Testing Fail-Closed Policy (Unconfigured Environment)...');
  const unconfiguredServer = createServer(async (req, res) => {
    // Force empty env for this request
    const origEndpoint = process.env.JEV_API_ENDPOINT;
    const origKey = process.env.JEV_API_KEY;
    delete process.env.JEV_API_ENDPOINT;
    delete process.env.JEV_API_KEY;

    try {
      await handleJevProxyRequest(req, res);
    } finally {
      process.env.JEV_API_ENDPOINT = origEndpoint;
      process.env.JEV_API_KEY = origKey;
    }
  });

  const unconfPort = 5197;
  await new Promise<void>((resolve) => unconfiguredServer.listen(unconfPort, () => resolve()));

  const unconfClient = new JevDirectorEngine({ proxyBaseUrl: `http://localhost:${unconfPort}/api/jev` });
  const healthUnconf = await unconfClient.checkHealth();
  console.log(`  Unconfigured Health Mode: ${healthUnconf.mode}, Configured: ${healthUnconf.configured}`);
  if (healthUnconf.mode !== 'NOT_CONFIGURED') {
    throw new Error(`Expected NOT_CONFIGURED, got ${healthUnconf.mode}`);
  }

  try {
    await unconfClient.selectStrategy({ time: 10.0, energy: 0.5, energyTrend: 'rising', onsetStrength: 0.5, nextMajorChange: 3.0 }, []);
    throw new Error('FAIL: Should have failed-closed with LIVE JEV NOT CONFIGURED!');
  } catch (err: any) {
    console.log(`  Fail-Closed verified: Successfully caught error: "${err.message}"`);
    if (!err.message.includes('LIVE JEV NOT CONFIGURED')) {
      throw new Error(`Expected 'LIVE JEV NOT CONFIGURED' error message, got: ${err.message}`);
    }
  }
  unconfiguredServer.close();

  // Test 2: Verify LIVE_REMOTE Mode connected to Live Upstream
  console.log('\n[Check 2] Testing LIVE_REMOTE Mode with Live Upstream Server...');
  process.env.JEV_API_ENDPOINT = `http://localhost:${liveJevPort}`;
  process.env.JEV_API_KEY = 'sk_jev_live_proof_token';

  const liveProxyPort = 5196;
  const liveProxyServer = createServer(async (req, res) => {
    await handleJevProxyRequest(req, res);
  });
  await new Promise<void>((resolve) => liveProxyServer.listen(liveProxyPort, () => resolve()));

  const liveClient = new JevDirectorEngine({ proxyBaseUrl: `http://localhost:${liveProxyPort}/api/jev` });
  const healthLive = await liveClient.checkHealth();
  console.log(`  Live Health Response: ${JSON.stringify(healthLive)}`);
  if (healthLive.mode !== 'LIVE_REMOTE' || !healthLive.endpointConfigured || !healthLive.apiKeyConfigured) {
    throw new Error('Live remote health check mismatch');
  }

  // Test 3: Canonical 17.64s Benchmark on Live JEV
  console.log('\n[Check 3] Executing Canonical 17.64s Benchmark on Live JEV...');
  const state17 = {
    time: 17.64,
    energy: 0.76,
    energyTrend: 'rising' as const,
    onsetStrength: 0.58,
    nextMajorChange: 2.56,
  };

  const p1 = await liveClient.selectStrategy(state17, []);
  console.log(`  Live JEV Pass 1 Strategy: ${p1.strategy} (Conf: ${(p1.confidence * 100).toFixed(0)}%, RequiresDiag: ${p1.requiresDiagnostic})`);
  console.log(`  Live JEV Alternatives: ${JSON.stringify(p1.alternatives)}`);

  const diag = await liveClient.diagnoseStrategy(state17, [], p1);
  console.log(`  Live JEV Diagnostic: Tension=${diag.diagnostic.tension_should_continue}, Impact=${diag.diagnostic.impact_arrival}`);
  console.log(`  Live JEV Resolved Strategy: ${diag.resolvedStrategy}`);
  if (diag.resolvedStrategy !== 'CONTINUE_TENSION') {
    throw new Error(`Expected CONTINUE_TENSION from live diagnostic, got ${diag.resolvedStrategy}`);
  }

  // Test 4: Verify Raw Request / Response Inspector telemetry
  console.log('\n[Check 4] Verifying Raw Request / Response Inspector Telemetry...');
  const telemetry = await liveClient.getInspectorTelemetry();
  if (!telemetry) throw new Error('Inspector telemetry is null');
  console.log(`  Inspector Mode: ${telemetry.mode}`);
  console.log(`  Questions Captured: ${telemetry.requestQuestions.length}`);
  console.log(`  Selected Option: ${telemetry.response.selected_option}`);
  console.log(`  Latency: ${telemetry.latencyMs} ms`);
  if (!telemetry.requestQuestions || telemetry.requestQuestions.length === 0) {
    throw new Error('Inspector did not capture structured questions');
  }

  // Test 5: Anti-Fixture Verification (0.76 vs 0.20 vs 0.95)
  console.log('\n[Check 5] Executing Anti-Fixture Verification (0.76 vs 0.20 vs 0.95)...');
  const resMid = await liveClient.selectStrategy({ ...state17, energy: 0.76 }, []);
  const resLow = await liveClient.selectStrategy({ ...state17, energy: 0.20 }, []);
  const resHigh = await liveClient.selectStrategy({ ...state17, energy: 0.95 }, []);

  console.log(`  Energy 0.20 -> Primary: ${resLow.strategy} (Prob: ${(resLow.probability * 100).toFixed(0)}%)`);
  console.log(`  Energy 0.76 -> Primary: ${resMid.strategy} (Prob: ${(resMid.probability * 100).toFixed(0)}%)`);
  console.log(`  Energy 0.95 -> Primary: ${resHigh.strategy} (Prob: ${(resHigh.probability * 100).toFixed(0)}%)`);

  if (resLow.strategy === resHigh.strategy && resLow.probability === resHigh.probability) {
    throw new Error('ANTI-FIXTURE FAILED: Identical distribution returned across different energy inputs!');
  }
  console.log('  ANTI-FIXTURE PASSED: Dynamic distribution variance confirmed across energy spectrum!');

  liveProxyServer.close();
  liveDaemon.close();
  console.log('\n>>> ALL PHASE 3 LIVE JEV PROOF CHECKS PASSED! <<<');
}

runPhase3Verification().catch((err) => {
  console.error('Phase 3 verification failed:', err);
  process.exit(1);
});
