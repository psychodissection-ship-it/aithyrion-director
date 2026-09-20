import { MockDirectorEngine } from '../src/services/engine/MockDirectorEngine';
import { JevDirectorEngine } from '../src/services/engine/JevDirectorEngine';
import { DARK_WINGS_TRACK } from '../src/data/sampleTrackDarkWings';
import { ShotHistoryItem } from '../src/types/director';

async function runVerification() {
  console.log('=== Aithyrion Director: Automated Verification ===\n');

  const engine = new MockDirectorEngine();
  const history: ShotHistoryItem[] = [];

  // Check 1: Dark Wings timeline points exist
  console.log(`[Check 1] Dark Wings timeline loaded: ${DARK_WINGS_TRACK.timeline.length} cue points.`);
  if (DARK_WINGS_TRACK.timeline.length < 3) throw new Error('Missing timeline points');

  // Check 2: Benchmark Point 1: 10.18s
  const pt1 = DARK_WINGS_TRACK.timeline.find(p => Math.abs(p.time - 10.18) < 0.05)!;
  console.log(`[Check 2] Testing Point 10.18s...`);
  const p1_strat = await engine.selectStrategy(pt1.musicState, history);
  console.log(`  Pass 1 Strategy: ${p1_strat.strategy} (Conf: ${(p1_strat.confidence * 100).toFixed(0)}%)`);
  if (p1_strat.strategy !== 'INTENSIFY') throw new Error(`Expected INTENSIFY, got ${p1_strat.strategy}`);

  const p1_shot = await engine.selectShotDirection(pt1.musicState, p1_strat.strategy, history);
  console.log(`  Pass 2 Shot: Scale=${p1_shot.final.shot_scale}, Camera=${p1_shot.final.camera_motion}, Character=${p1_shot.final.character_motion}, Light=${p1_shot.final.lighting_change}`);
  if (p1_shot.final.shot_scale !== 'CLOSE' || p1_shot.final.camera_motion !== 'PUSH_IN') {
    throw new Error('Shot parameters mismatch at 10.18s');
  }

  history.push({
    id: 'h-1',
    time: pt1.time,
    duration: 5.98,
    musicState: pt1.musicState,
    pass1: p1_strat,
    effectiveStrategy: p1_strat.strategy,
    pass2: p1_shot
  });

  // Check 3: Benchmark Point 2: 14.23s
  const pt2 = DARK_WINGS_TRACK.timeline.find(p => Math.abs(p.time - 14.23) < 0.05)!;
  console.log(`[Check 3] Testing Point 14.23s...`);
  const p2_strat = await engine.selectStrategy(pt2.musicState, history);
  console.log(`  Pass 1 Strategy: ${p2_strat.strategy} (Conf: ${(p2_strat.confidence * 100).toFixed(0)}%)`);
  if (p2_strat.strategy !== 'INTENSIFY') throw new Error(`Expected INTENSIFY, got ${p2_strat.strategy}`);

  const p2_shot = await engine.selectShotDirection(pt2.musicState, p2_strat.strategy, history);
  console.log(`  Pass 2 Shot: Scale=${p2_shot.final.shot_scale}, Camera=${p2_shot.final.camera_motion}, Character=${p2_shot.final.character_motion}, Light=${p2_shot.final.lighting_change}`);
  if (p2_shot.final.shot_scale !== 'MEDIUM' || p2_shot.final.camera_motion !== 'PUSH_IN') {
    throw new Error('Shot parameters mismatch at 14.23s');
  }

  history.push({
    id: 'h-2',
    time: pt2.time,
    duration: 4.05,
    musicState: pt2.musicState,
    pass1: p2_strat,
    effectiveStrategy: p2_strat.strategy,
    pass2: p2_shot
  });

  // Check 4: Benchmark Point 3: 17.64s (Ambiguity & Diagnostic Pass)
  const pt3 = DARK_WINGS_TRACK.timeline.find(p => Math.abs(p.time - 17.64) < 0.05)!;
  console.log(`[Check 4] Testing Point 17.64s (Ambiguity Check & Diagnostic Pass)...`);
  const p3_strat = await engine.selectStrategy(pt3.musicState, history);
  console.log(`  Pass 1 Strategy Initial: ${p3_strat.strategy} (Conf: ${(p3_strat.confidence * 100).toFixed(0)}%, RequiresDiagnostic: ${p3_strat.requiresDiagnostic})`);
  if (!p3_strat.requiresDiagnostic || p3_strat.confidence >= 0.30) {
    throw new Error('Expected low confidence & diagnostic required at 17.64s');
  }

  // Diagnostic evaluation
  const diag = await engine.diagnoseStrategy(pt3.musicState, history, p3_strat);
  console.log(`  Diagnostic Result: Impact=${diag.diagnostic.impact_arrival}, TensionContinue=${diag.diagnostic.tension_should_continue}, Release=${diag.diagnostic.release_is_appropriate}`);
  console.log(`  Diagnostic Resolved Strategy: ${diag.resolvedStrategy}`);
  if (diag.resolvedStrategy !== 'CONTINUE_TENSION') {
    throw new Error(`Expected CONTINUE_TENSION from diagnostic, got ${diag.resolvedStrategy}`);
  }

  const p3_shot = await engine.selectShotDirection(pt3.musicState, diag.resolvedStrategy, history);
  console.log(`  Pass 2 Shot: Scale=${p3_shot.final.shot_scale}, Camera=${p3_shot.final.camera_motion}, Character=${p3_shot.final.character_motion}, Light=${p3_shot.final.lighting_change}, CutNow=${p3_shot.final.cut_now}`);
  if (p3_shot.final.shot_scale !== 'MEDIUM' || p3_shot.final.camera_motion !== 'PUSH_IN' || p3_shot.final.character_motion !== 'STILL') {
    throw new Error('Shot parameters mismatch at 17.64s');
  }

  // Check 5: JevDirectorEngine Swappability
  console.log(`[Check 5] Verifying JevDirectorEngine swappability...`);
  const jevEngine = new JevDirectorEngine();
  console.log(`  JevDirectorEngine instantiated successfully: ${jevEngine.engineName}`);

  console.log('\n>>> All verification checks PASSED successfully! <<<');
}

runVerification().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
