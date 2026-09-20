import http from 'http';
import {
  MusicState,
  StrategyDecision,
  DiagnosticResolution,
  ShotHistoryItem,
  Strategy,
  LocalGemmaStatus,
  StrategyProbability,
  ShotScale,
  CameraMotion,
  CharacterMotion,
  LightingChange,
  TransitionType,
  ShotDirection,
  ShotDirectionConfidence,
} from '../src/types/director';

const OLLAMA_HOST = process.env.OLLAMA_HOST || '127.0.0.1';
const OLLAMA_PORT = parseInt(process.env.OLLAMA_PORT || '11434', 10);
const DEFAULT_GEMMA_MODEL = process.env.GEMMA_MODEL || 'gemma2:2b';

let cachedStatus: LocalGemmaStatus | null = null;
let lastStatusCheck = 0;

/**
 * Make an HTTP request to the local Ollama daemon
 */
function requestOllama<T>(method: string, path: string, body?: any, timeoutMs: number = 25000): Promise<T> {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: OLLAMA_HOST,
        port: OLLAMA_PORT,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {}),
        },
        timeout: timeoutMs,
      },
      (res) => {
        let responseBody = '';
        res.on('data', (chunk) => (responseBody += chunk));
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(responseBody));
            } catch {
              resolve(responseBody as unknown as T);
            }
          } else {
            reject(new Error(`Ollama returned status ${res.statusCode}: ${responseBody.slice(0, 200)}`));
          }
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Ollama request timed out after ${timeoutMs}ms`));
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

/**
 * Query Ollama local daemon to check status and detect available Gemma models
 */
export async function checkLocalGemmaStatus(): Promise<LocalGemmaStatus> {
  const now = Date.now();
  if (cachedStatus && now - lastStatusCheck < 3000) {
    return cachedStatus;
  }

  try {
    const tagsRes = await requestOllama<{ models?: { name: string }[] }>('GET', '/api/tags', undefined, 2000);
    const availableModels = (tagsRes.models || []).map((m) => m.name);

    // Look for gemma models (e.g. gemma2:2b, gemma:2b, gemma2, gemma:7b, gemma2:9b)
    const gemmaCandidates = availableModels.filter((m) => m.toLowerCase().includes('gemma'));
    const preferredModel =
      gemmaCandidates.find((m) => m === DEFAULT_GEMMA_MODEL) ||
      gemmaCandidates.find((m) => m.includes('2b')) ||
      gemmaCandidates[0] ||
      (availableModels.length > 0 ? availableModels[0] : undefined);

    cachedStatus = {
      ollamaOnline: true,
      gemmaAvailable: gemmaCandidates.length > 0,
      modelName: preferredModel,
      availableModels,
    };
    lastStatusCheck = now;
    return cachedStatus;
  } catch {
    cachedStatus = {
      ollamaOnline: false,
      gemmaAvailable: false,
      availableModels: [],
    };
    lastStatusCheck = now;
    return cachedStatus;
  }
}

/**
 * Call Ollama generate endpoint with JSON schema formatting
 */
async function generateJson<T>(prompt: string, systemPrompt: string, modelOverride?: string): Promise<T> {
  const status = await checkLocalGemmaStatus();
  if (!status.ollamaOnline) {
    throw new Error('Local Ollama daemon is offline (http://localhost:11434). Please start Ollama.');
  }

  const model = modelOverride || status.modelName || DEFAULT_GEMMA_MODEL;

  const res = await requestOllama<{ response: string }>('POST', '/api/generate', {
    model,
    system: systemPrompt,
    prompt,
    format: 'json',
    stream: false,
    options: {
      num_gpu: 0, // Force CPU to prevent Vulkan pipeline host memory errors on mobile AMD GPUs
      temperature: 0.1, // Near deterministic for System 1 decision
      top_p: 0.8,
      num_predict: 256,
    },
  });

  try {
    return JSON.parse(res.response) as T;
  } catch (err) {
    // Attempt cleaning backticks if model wrapped in ```json
    const cleaned = res.response.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleaned) as T;
  }
}

/**
 * Pass 1: Strategic Direction Decision using Local Gemma
 */
export async function evaluatePass1WithGemma(
  state: MusicState,
  history: ShotHistoryItem[] = []
): Promise<StrategyDecision> {
  const systemPrompt = `You are OpenJev, a System 1 AI Music Video Director powered by Gemma.
Your job is to make an immediate, crisp cinematic strategy decision based on musical state and tempo.
Options for strategy: 'INTENSIFY', 'RELEASE', 'IMPACT_HOLD', 'CONTINUE_TENSION'.
Output strictly valid JSON with this exact schema:
{
  "strategy": "INTENSIFY" | "RELEASE" | "IMPACT_HOLD" | "CONTINUE_TENSION",
  "confidence": number between 0.50 and 0.98,
  "probabilities": {
    "INTENSIFY": number,
    "RELEASE": number,
    "IMPACT_HOLD": number,
    "CONTINUE_TENSION": number
  },
  "reasoning": "under 20 words rationale"
}`;

  const prompt = `Current Music State:
- Section: ${state.section || 'VERSE'}
- Energy: ${state.energy.toFixed(3)}
- Energy Trend: ${state.energyTrend}
- Onset Strength: ${state.onsetStrength.toFixed(3)}
- BPM: ${state.bpm || 120}
- Recent History Count: ${history.length}

Evaluate the optimal visual strategy now.`;

  try {
    const json = await generateJson<{
      strategy: Strategy;
      confidence: number;
      probabilities?: Record<string, number>;
      reasoning: string;
    }>(prompt, systemPrompt);

    const validStrategies: Strategy[] = ['INTENSIFY', 'RELEASE', 'IMPACT_HOLD', 'CONTINUE_TENSION'];
    const chosenStrategy = validStrategies.includes(json.strategy) ? json.strategy : 'INTENSIFY';
    const confidence = Math.max(0.5, Math.min(0.98, json.confidence || 0.85));

    // Normalize probabilities
    const probs: Record<Strategy, number> = {
      INTENSIFY: 0.25,
      RELEASE: 0.25,
      IMPACT_HOLD: 0.25,
      CONTINUE_TENSION: 0.25,
    };
    if (json.probabilities) {
      for (const s of validStrategies) {
        if (typeof json.probabilities[s] === 'number') {
          probs[s] = json.probabilities[s];
        }
      }
    }
    probs[chosenStrategy] = Math.max(probs[chosenStrategy], confidence);

    // Sum and normalize
    const total = Object.values(probs).reduce((a, b) => a + b, 0);
    const normalizedProbs: Record<Strategy, number> = {} as any;
    for (const s of validStrategies) {
      normalizedProbs[s] = +(probs[s] / total).toFixed(3);
    }

    const alternatives: StrategyProbability[] = validStrategies
      .filter((s) => s !== chosenStrategy)
      .map((s) => ({ strategy: s, probability: normalizedProbs[s] }))
      .sort((a, b) => b.probability - a.probability);

    return {
      strategy: chosenStrategy,
      confidence,
      probability: normalizedProbs[chosenStrategy],
      alternatives,
      requiresDiagnostic: confidence < 0.4,
      status: confidence < 0.4 ? 'DIAGNOSTIC_REQUIRED' : 'ACCEPTED',
    };
  } catch (err: any) {
    // Fallback if local model error
    const fallbackStrategy: Strategy = state.energy > 0.75 ? 'IMPACT_HOLD' : state.energy > 0.5 ? 'INTENSIFY' : 'RELEASE';
    return {
      strategy: fallbackStrategy,
      confidence: 0.72,
      probability: 0.72,
      alternatives: [
        { strategy: 'INTENSIFY', probability: 0.15 },
        { strategy: 'CONTINUE_TENSION', probability: 0.13 },
      ],
      requiresDiagnostic: false,
      status: 'ACCEPTED',
    };
  }
}

/**
 * Pass 2: Granular Shot Direction Decision using Local Gemma
 */
export async function evaluatePass2WithGemma(
  state: MusicState,
  strategy: Strategy,
  history: ShotHistoryItem[] = []
): Promise<{ raw: ShotDirection; confidences: ShotDirectionConfidence }> {
  const systemPrompt = `You are OpenJev, a System 1 AI Music Video Director powered by Gemma.
Decide the exact camera, subject motion, lighting, and transition for the shot.
Allowed values:
- shot_scale: 'CLOSE' | 'MEDIUM' | 'WIDE' | 'EXTREME_WIDE'
- camera_motion: 'STATIC' | 'PUSH_IN' | 'PULL_BACK' | 'PAN' | 'ORBIT'
- character_motion: 'STILL' | 'LOOK' | 'TURN' | 'STEP_FORWARD' | 'GESTURE'
- lighting_change: 'HOLD' | 'BRIGHTEN' | 'DARKEN' | 'PULSE' | 'COLOR_SHIFT'
- transition_type: 'HARD_CUT' | 'MATCH_CUT' | 'DISSOLVE' | 'FLASH_CUT' | 'NONE'
- cut_now: boolean

Output strictly valid JSON with this exact schema:
{
  "cut_now": boolean,
  "shot_scale": string,
  "camera_motion": string,
  "character_motion": string,
  "lighting_change": string,
  "transition_type": string,
  "confidence": number between 0.60 and 0.98
}`;

  const prompt = `Strategy Chosen: ${strategy}
Current Music State:
- Section: ${state.section || 'VERSE'}
- Energy: ${state.energy.toFixed(3)}
- Trend: ${state.energyTrend}
- Onset: ${state.onsetStrength.toFixed(3)}

Direct the camera and subject behavior for this beat.`;

  try {
    const json = await generateJson<{
      cut_now?: boolean;
      shot_scale?: string;
      camera_motion?: string;
      character_motion?: string;
      lighting_change?: string;
      transition_type?: string;
      confidence?: number;
    }>(prompt, systemPrompt);

    const validScales: ShotScale[] = ['CLOSE', 'MEDIUM', 'WIDE', 'EXTREME_WIDE'];
    const validCamMotions: CameraMotion[] = ['STATIC', 'PUSH_IN', 'PULL_BACK', 'PAN', 'ORBIT'];
    const validCharMotions: CharacterMotion[] = ['STILL', 'LOOK', 'TURN', 'STEP_FORWARD', 'GESTURE'];
    const validLighting: LightingChange[] = ['HOLD', 'BRIGHTEN', 'DARKEN', 'PULSE', 'COLOR_SHIFT'];
    const validTransitions: TransitionType[] = ['HARD_CUT', 'MATCH_CUT', 'DISSOLVE', 'FLASH_CUT', 'NONE'];

    const conf = Math.max(0.6, Math.min(0.98, json.confidence || 0.85));

    const raw: ShotDirection = {
      cut_now: json.cut_now ?? true,
      shot_scale: validScales.includes(json.shot_scale as any) ? (json.shot_scale as ShotScale) : 'MEDIUM',
      camera_motion: validCamMotions.includes(json.camera_motion as any)
        ? (json.camera_motion as CameraMotion)
        : 'PUSH_IN',
      character_motion: validCharMotions.includes(json.character_motion as any)
        ? (json.character_motion as CharacterMotion)
        : 'LOOK',
      lighting_change: validLighting.includes(json.lighting_change as any)
        ? (json.lighting_change as LightingChange)
        : 'HOLD',
      transition_type: validTransitions.includes(json.transition_type as any)
        ? (json.transition_type as TransitionType)
        : 'HARD_CUT',
    };

    const confidences: ShotDirectionConfidence = {
      shot_scale: conf,
      camera_motion: conf,
      character_motion: conf,
      lighting_change: conf,
      cut: conf,
    };

    return { raw, confidences };
  } catch {
    const raw: ShotDirection = {
      cut_now: true,
      shot_scale: strategy === 'IMPACT_HOLD' ? 'CLOSE' : 'MEDIUM',
      camera_motion: strategy === 'INTENSIFY' ? 'PUSH_IN' : 'STATIC',
      character_motion: 'LOOK',
      lighting_change: strategy === 'IMPACT_HOLD' ? 'PULSE' : 'HOLD',
      transition_type: 'HARD_CUT',
    };
    const confidences: ShotDirectionConfidence = {
      shot_scale: 0.75,
      camera_motion: 0.75,
      character_motion: 0.75,
      lighting_change: 0.75,
      cut: 0.75,
    };
    return { raw, confidences };
  }
}

/**
 * Diagnostic Resolution using Local Gemma
 */
export async function diagnoseWithGemma(
  state: MusicState,
  pass1: StrategyDecision,
  history: ShotHistoryItem[] = []
): Promise<DiagnosticResolution> {
  const systemPrompt = `You are OpenJev Diagnostic Evaluator powered by Gemma.
Analyze the musical state and confirm or refine the strategy.
Options for resolvedStrategy: 'INTENSIFY', 'RELEASE', 'IMPACT_HOLD', 'CONTINUE_TENSION'.
Output strictly valid JSON with this exact schema:
{
  "resolvedStrategy": "INTENSIFY" | "RELEASE" | "IMPACT_HOLD" | "CONTINUE_TENSION",
  "reasoning": "concise 1 sentence rationale under 20 words",
  "diagnostic": {
    "impact_arrival": number between 0.0 and 1.0,
    "tension_should_continue": number between 0.0 and 1.0,
    "release_is_appropriate": number between 0.0 and 1.0
  }
}`;

  const prompt = `Pass 1 Strategy: ${pass1.strategy} (Confidence: ${pass1.confidence})
Music State:
- Section: ${state.section || 'VERSE'}
- Energy: ${state.energy.toFixed(3)}
- Energy Trend: ${state.energyTrend}
- Onset: ${state.onsetStrength.toFixed(3)}

Resolve the diagnostic evaluation.`;

  try {
    const json = await generateJson<{
      resolvedStrategy?: Strategy;
      reasoning?: string;
      diagnostic?: {
        impact_arrival?: number;
        tension_should_continue?: number;
        release_is_appropriate?: number;
      };
    }>(prompt, systemPrompt);

    const validStrategies: Strategy[] = ['INTENSIFY', 'RELEASE', 'IMPACT_HOLD', 'CONTINUE_TENSION'];
    const resolvedStrategy = validStrategies.includes(json.resolvedStrategy as any)
      ? (json.resolvedStrategy as Strategy)
      : pass1.strategy;

    return {
      resolvedStrategy,
      reasoning: `[Local Gemma Diagnostic] ${json.reasoning || 'Diagnostic resolved by OpenJev.'}`,
      diagnostic: {
        impact_arrival: json.diagnostic?.impact_arrival ?? (state.energy > 0.7 ? 0.85 : 0.2),
        tension_should_continue: json.diagnostic?.tension_should_continue ?? 0.5,
        release_is_appropriate: json.diagnostic?.release_is_appropriate ?? 0.5,
      },
    };
  } catch (err: any) {
    return {
      resolvedStrategy: pass1.strategy,
      reasoning: `[Local Gemma Fallback] Confirmed initial strategy: ${err.message}`,
      diagnostic: {
        impact_arrival: state.energy,
        tension_should_continue: 0.5,
        release_is_appropriate: 0.5,
      },
    };
  }
}
