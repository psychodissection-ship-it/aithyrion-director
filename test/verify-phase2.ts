import { MockDirectorEngine } from '../src/services/engine/MockDirectorEngine';
import { JevDirectorEngine } from '../src/services/engine/JevDirectorEngine';
import { HardConstraintsService } from '../src/services/engine/HardConstraintsService';
import { BENCHMARK_FIXTURES } from '../src/data/benchmarkFixtures';
import { handleJevProxyRequest } from '../server/jevProxyHandler';
import { createServer } from 'http';

async function runPhase2Verification() {
  console.log('=== Aithyrion Director: Phase 2 Automated Verification ===\n');

  // Spin up temporary proxy test server on port 5199
  const testPort = 5199;
  const server = createServer(async (req, res) => {
    const handled = await handleJevProxyRequest(req, res);
    if (!handled) {
      res.statusCode = 404;
      res.end('Not found');
    }
  });

  await new Promise<void>((resolve) => server.listen(testPort, () => resolve()));
  console.log(`[Setup] JEV Server Proxy test instance listening on port ${testPort}`);

  const jevEngine = new JevDirectorEngine({ proxyBaseUrl: `http://localhost:${testPort}/api/jev` });
  const mockEngine = new MockDirectorEngine();
  const hardConstraints = new HardConstraintsService();

  try {
    // 1. Health check via server proxy
    console.log('\n[Check 1] JEV Proxy Health & Security Check...');
    const health = await jevEngine.checkHealth();
    console.log(`  Proxy Status: ${health.status}, Mode: ${health.mode}, Endpoint Configured: ${health.endpointConfigured}`);
    if (health.status !== 'ok') throw new Error('Proxy health check failed');

    // 2. 17.64s Benchmark State to JEV: Pass 1
    console.log('\n[Check 2] Sending 17.64s Benchmark State to JEV (Pass 1)...');
    const pt17 = BENCHMARK_FIXTURES.find((f) => Math.abs(f.cueTime - 17.64) < 0.05)!;
    const p1 = await jevEngine.selectStrategy(pt17.musicState, []);

    console.log(`  JEV Pass 1 Strategy: ${p1.strategy}`);
    console.log(`  JEV Confidence: ${(p1.confidence * 100).toFixed(0)}% (Threshold < 30%: ${p1.requiresDiagnostic})`);
    console.log(`  JEV Alternatives: ${JSON.stringify(p1.alternatives)}`);

    if (p1.confidence >= 0.30 || !p1.requiresDiagnostic) {
      throw new Error('17.64s failed to trigger low-confidence Diagnostic requirement');
    }
    if (!p1.alternatives || p1.alternatives.length === 0) {
      throw new Error('JEV alternatives were lost in pipeline');
    }

    // 3. 17.64s Diagnostic Pass
    console.log('\n[Check 3] Executing Diagnostic Pass through JEV Proxy...');
    const diag = await jevEngine.diagnoseStrategy(pt17.musicState, [], p1);
    console.log(`  Impact Arrival: ${diag.diagnostic.impact_arrival}`);
    console.log(`  Tension Should Continue: ${diag.diagnostic.tension_should_continue}`);
    console.log(`  Release Is Appropriate: ${diag.diagnostic.release_is_appropriate}`);
    console.log(`  Resolved Strategy: ${diag.resolvedStrategy}`);
    console.log(`  Reasoning: ${diag.reasoning}`);

    if (
      Math.abs(diag.diagnostic.impact_arrival - 0.38) > 0.01 ||
      Math.abs(diag.diagnostic.tension_should_continue - 0.74) > 0.01 ||
      Math.abs(diag.diagnostic.release_is_appropriate - 0.12) > 0.01
    ) {
      throw new Error('Playground Diagnostic experiment numbers mismatch at 17.64s');
    }
    if (diag.resolvedStrategy !== 'CONTINUE_TENSION') {
      throw new Error(`Expected CONTINUE_TENSION from diagnostic, got ${diag.resolvedStrategy}`);
    }

    // 4. 17.64s Pass 2 Shot Direction
    console.log('\n[Check 4] Executing Pass 2 Shot Direction...');
    const shot17 = await jevEngine.selectShotDirection(pt17.musicState, diag.resolvedStrategy, []);
    console.log(`  Shot Scale: ${shot17.final.shot_scale}, Camera: ${shot17.final.camera_motion}, Cut Decision: ${shot17.cutDecisionType}`);
    if (shot17.final.shot_scale !== 'MEDIUM' || shot17.final.camera_motion !== 'PUSH_IN' || shot17.cutDecisionType !== 'NO_CUT') {
      throw new Error('Shot parameter mismatch at 17.64s');
    }

    // 5. Cut Taxonomy Verification (Soft Cut vs Hard Force Cut vs Cut Suppressed)
    console.log('\n[Check 5] Verifying Cut Taxonomy in HardConstraintsService...');
    // A) Soft Cut
    const softCutResult = hardConstraints.evaluate(
      { cut_now: true, shot_scale: 'CLOSE', camera_motion: 'PUSH_IN', character_motion: 'STEP_FORWARD', lighting_change: 'DARKEN', transition_type: 'HARD_CUT' },
      { cut: 0.9, shot_scale: 0.8, camera_motion: 0.8, character_motion: 0.8, lighting_change: 0.8 },
      { time: 5.0, energy: 0.5, energyTrend: 'rising', onsetStrength: 0.5, nextMajorChange: 3.0 },
      [{ id: 'prev', time: 1.0, duration: 1.0, musicState: {} as any, pass1: {} as any, effectiveStrategy: 'INTENSIFY', pass2: { final: { cut_now: true } } as any }]
    );
    console.log(`  A: AI Soft Cut correctly classified: ${softCutResult.cutDecisionType}`);
    if (softCutResult.cutDecisionType !== 'SOFT_CUT') throw new Error('Expected SOFT_CUT');

    // B) Hard Force Cut (> 8s)
    const forceCutResult = hardConstraints.evaluate(
      { cut_now: false, shot_scale: 'MEDIUM', camera_motion: 'STATIC', character_motion: 'STILL', lighting_change: 'HOLD', transition_type: 'NONE' },
      { cut: 0.5, shot_scale: 0.8, camera_motion: 0.8, character_motion: 0.8, lighting_change: 0.8 },
      { time: 15.0, energy: 0.5, energyTrend: 'rising', onsetStrength: 0.5, nextMajorChange: 3.0 },
      [{ id: 'prev', time: 5.0, duration: 5.0, musicState: {} as any, pass1: {} as any, effectiveStrategy: 'INTENSIFY', pass2: { final: { cut_now: true } } as any }]
    );
    console.log(`  B: Hard Force Cut correctly classified: ${forceCutResult.cutDecisionType}`);
    if (forceCutResult.cutDecisionType !== 'HARD_FORCE_CUT') throw new Error('Expected HARD_FORCE_CUT');

    // C) Cut Suppressed (< 2s)
    const suppressedCutResult = hardConstraints.evaluate(
      { cut_now: true, shot_scale: 'CLOSE', camera_motion: 'PUSH_IN', character_motion: 'STILL', lighting_change: 'HOLD', transition_type: 'HARD_CUT' },
      { cut: 0.9, shot_scale: 0.8, camera_motion: 0.8, character_motion: 0.8, lighting_change: 0.8 },
      { time: 6.0, energy: 0.5, energyTrend: 'rising', onsetStrength: 0.5, nextMajorChange: 3.0 },
      [{ id: 'prev', time: 5.0, duration: 5.0, musicState: {} as any, pass1: {} as any, effectiveStrategy: 'INTENSIFY', pass2: { final: { cut_now: true } } as any }]
    );
    console.log(`  C: Cut Suppression correctly classified: ${suppressedCutResult.cutDecisionType}`);
    if (suppressedCutResult.cutDecisionType !== 'CUT_SUPPRESSED') throw new Error('Expected CUT_SUPPRESSED');

    // 6. Benchmark Fixtures Verification
    console.log('\n[Check 6] Validating all Playground Benchmark Fixtures against JEV Engine...');
    for (const fix of BENCHMARK_FIXTURES) {
      const fixP1 = await jevEngine.selectStrategy(fix.musicState, []);
      let strat = fixP1.strategy;
      if (fixP1.requiresDiagnostic) {
        const d = await jevEngine.diagnoseStrategy(fix.musicState, [], fixP1);
        strat = d.resolvedStrategy;
      }
      const fixShot = await jevEngine.selectShotDirection(fix.musicState, strat as any, []);

      console.log(`  Fixture ${fix.label}: Strategy=${strat} (Expected=${fix.expected.strategy}), Cut=${fixShot.cutDecisionType} (Expected=${fix.expected.shot.cutDecisionType}) -> MATCH`);
      if (strat !== fix.expected.strategy || fixShot.cutDecisionType !== fix.expected.shot.cutDecisionType) {
        throw new Error(`Fixture validation failed for ${fix.id}`);
      }
    }

    console.log('\n>>> ALL PHASE 2 VERIFICATION CHECKS PASSED! <<<');
  } finally {
    server.close();
  }
}

runPhase2Verification().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
