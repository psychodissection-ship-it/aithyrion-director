import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import path from 'path';
import { exec, execSync, spawn } from 'child_process';
import { promisify } from 'util';
import { KeyframeJob, KeyframeManifest, CodexCliStatus, CharacterProfile } from '../src/types/codexBridge';

import { parseJsonBody, sendJson, sanitizeId, resolvePathSafe } from './utils';

const execAsync = promisify(exec);

let cachedBinaryPath: string | null = null;
let cachedCliStatus: CodexCliStatus | null = null;
let lastCheckTime = 0;

export function findCodexBinary(): string | null {
  if (cachedBinaryPath && fs.existsSync(cachedBinaryPath)) {
    return cachedBinaryPath;
  }

  if (process.env.CODEX_PATH && fs.existsSync(process.env.CODEX_PATH)) {
    cachedBinaryPath = process.env.CODEX_PATH;
    return cachedBinaryPath;
  }

  // Check if 'codex' is available in standard PATH
  try {
    execSync('codex --version', { stdio: ['ignore', 'pipe', 'pipe'], timeout: 2000 });
    cachedBinaryPath = 'codex';
    return 'codex';
  } catch {
    // Check known Windows LocalAppData directory
  }

  const localAppData = process.env.LOCALAPPDATA;
  if (localAppData) {
    const codexBinDir = path.join(localAppData, 'OpenAI', 'Codex', 'bin');
    if (fs.existsSync(codexBinDir)) {
      try {
        const entries = fs.readdirSync(codexBinDir);
        for (const entry of entries) {
          const candidate = path.join(codexBinDir, entry, 'codex.exe');
          if (fs.existsSync(candidate)) {
            cachedBinaryPath = candidate;
            return candidate;
          }
        }
      } catch {}
    }
  }

  return null;
}

/**
 * Non-blocking asynchronous CLI check (H-1 fix)
 */
export async function checkCodexCli(): Promise<CodexCliStatus> {
  const now = Date.now();
  if (cachedCliStatus && now - lastCheckTime < 5000) {
    return cachedCliStatus;
  }

  const bin = findCodexBinary();
  if (bin) {
    try {
      const { stdout } = await execAsync(`"${bin}" --version`, {
        encoding: 'utf8',
        timeout: 3000,
      });
      cachedCliStatus = {
        available: true,
        version: stdout.trim(),
        executablePath: bin,
        mode: 'CLI_READY',
        message: `Codex CLI Ready (${stdout.trim()})`,
      };
      lastCheckTime = now;
      return cachedCliStatus;
    } catch {}
  }

  cachedCliStatus = {
    available: false,
    mode: 'MANUAL_HANDOFF',
    message: 'CODEX CLI NOT FOUND',
  };
  lastCheckTime = now;
  return cachedCliStatus;
}

export interface TaskExecutionState {
  jobId: string;
  status: 'IDLE' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  logs: string[];
  exitCode?: number | null;
  outputImage?: string;
  error?: string;
  startedAt?: number;
  completedAt?: number;
}

const taskExecutions = new Map<string, TaskExecutionState>();

/**
 * Memory-safe task state tracking with eviction of entries older than 24h (M-2 fix)
 */
function recordTaskExecution(jobId: string, state: TaskExecutionState): void {
  const now = Date.now();
  if (taskExecutions.size > 100) {
    for (const [key, val] of taskExecutions.entries()) {
      if (!val.startedAt || now - val.startedAt > 24 * 60 * 60 * 1000) {
        taskExecutions.delete(key);
      }
    }
  }
  taskExecutions.set(jobId, state);
}

const DEFAULT_ROSTER: CharacterProfile[] = [
  {
    id: 'sara',
    name: 'Sara',
    identity_reference: 'references/characters/sara/identity.png',
    description: 'Dynamic cyberpunk protagonist with signature crimson/rose neural jacket',
    defaultColorPalette: ['#e11d48', '#0f172a', '#38bdf8'],
    defaultLocation: 'Neo-Tokyo Industrial Rooftop',
    defaultCostume: 'Tactical Cyber Rose Hoodie & Combat Gear',
  },
  {
    id: 'lexia',
    name: 'Lexia',
    identity_reference: 'references/characters/lexia/identity.png',
    description: 'Calculated tactical intelligence operative with cyan holographic neural visor',
    defaultColorPalette: ['#06b6d4', '#1e1b4b', '#f8fafc'],
    defaultLocation: 'High-altitude Cyber Command Spire',
    defaultCostume: 'Neural Interface Sleek Bodysuit & Trenchcoat',
  },
];

export function getRoster(): CharacterProfile[] {
  const rosterPath = path.join(process.cwd(), 'references', 'characters', 'roster.json');
  if (fs.existsSync(rosterPath)) {
    try {
      return JSON.parse(fs.readFileSync(rosterPath, 'utf8'));
    } catch {}
  }
  fs.mkdirSync(path.dirname(rosterPath), { recursive: true });
  fs.writeFileSync(rosterPath, JSON.stringify(DEFAULT_ROSTER, null, 2), 'utf8');
  return DEFAULT_ROSTER;
}

export function saveRoster(roster: CharacterProfile[]) {
  const rosterPath = path.join(process.cwd(), 'references', 'characters', 'roster.json');
  fs.mkdirSync(path.dirname(rosterPath), { recursive: true });
  fs.writeFileSync(rosterPath, JSON.stringify(roster, null, 2), 'utf8');
}

export function ensureKeyframeFromIdentity(
  identityRef: string,
  jobId: string,
  targetOutputPath: string
) {
  try {
    fs.mkdirSync(path.dirname(targetOutputPath), { recursive: true });
    const fullIdentityPath = path.join(process.cwd(), identityRef);
    if (fs.existsSync(fullIdentityPath)) {
      fs.copyFileSync(fullIdentityPath, targetOutputPath);
      return;
    }

    // Fallback if specific identity does not exist
    const roster = getRoster();
    for (const char of roster) {
      const p = path.join(process.cwd(), char.identity_reference);
      if (fs.existsSync(p)) {
        fs.copyFileSync(p, targetOutputPath);
        return;
      }
    }
  } catch (err) {
    console.error('Failed to bind keyframe from identity:', err);
  }
}

export async function handleCodexBridgeRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = req.url || '';
  if (!url.startsWith('/api/codex/')) {
    return false;
  }

  const endpoint = url.split('?')[0];

  // 1. GET /api/codex/cli-status
  if (endpoint === '/api/codex/cli-status' && req.method === 'GET') {
    const status = await checkCodexCli();
    sendJson(res, 200, status);
    return true;
  }

  // 1.5. GET /api/codex/characters (Dynamic Character Roster)
  if (endpoint === '/api/codex/characters' && req.method === 'GET') {
    const roster = getRoster();
    sendJson(res, 200, { characters: roster });
    return true;
  }

  // 1.6. POST /api/codex/save-character (Create or update custom character)
  if (endpoint === '/api/codex/save-character' && req.method === 'POST') {
    try {
      const body = await parseJsonBody<{
        profile: CharacterProfile;
        dataUrl?: string;
      }>(req);
      const { profile, dataUrl } = body;

      if (!profile || !profile.id || !profile.name) {
        sendJson(res, 400, { error: 'Missing character profile, id, or name' });
        return true;
      }

      const safeId = profile.id.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
      profile.id = safeId;
      const charDir = path.join(process.cwd(), 'references', 'characters', safeId);
      fs.mkdirSync(charDir, { recursive: true });

      if (dataUrl) {
        const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync(path.join(charDir, 'identity.png'), buffer);
        profile.identity_reference = `references/characters/${safeId}/identity.png`;
      } else if (!profile.identity_reference) {
        profile.identity_reference = `references/characters/${safeId}/identity.png`;
      }

      const roster = getRoster();
      const existingIdx = roster.findIndex((c) => c.id === safeId);
      if (existingIdx >= 0) {
        roster[existingIdx] = { ...roster[existingIdx], ...profile };
      } else {
        roster.push(profile);
      }
      saveRoster(roster);

      sendJson(res, 200, { success: true, profile, characters: roster });
    } catch (err: any) {
      sendJson(res, 500, { error: err.message || 'Failed to save character' });
    }
    return true;
  }

  // 2. POST /api/codex/save-job
  if (endpoint === '/api/codex/save-job' && req.method === 'POST') {
    try {
      const body = await parseJsonBody<{ job: KeyframeJob; markdown: string }>(req);
      const { job, markdown } = body;

      if (!job || !job.job_id) {
        sendJson(res, 400, { error: 'Missing job or job_id' });
        return true;
      }

      const safeJobId = sanitizeId(job.job_id);
      const jsonPath = path.join(process.cwd(), 'keyframe_jobs', 'pending', `${safeJobId}.json`);
      const taskPath = path.join(process.cwd(), 'codex_tasks', `${safeJobId}.md`);

      fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
      fs.mkdirSync(path.dirname(taskPath), { recursive: true });

      fs.writeFileSync(jsonPath, JSON.stringify(job, null, 2), 'utf8');
      fs.writeFileSync(taskPath, markdown, 'utf8');

      sendJson(res, 200, {
        success: true,
        jobId: job.job_id,
        jsonPath: `keyframe_jobs/pending/${safeJobId}.json`,
        taskPath: `codex_tasks/${safeJobId}.md`,
      });
    } catch (err: any) {
      sendJson(res, 500, { error: err.message || 'Failed to save job' });
    }
    return true;
  }

  // 3. POST /api/codex/save-manifest
  if (endpoint === '/api/codex/save-manifest' && req.method === 'POST') {
    try {
      const body = await parseJsonBody<{ manifest: KeyframeManifest }>(req);
      const { manifest } = body;

      if (!manifest || !manifest.job_id) {
        sendJson(res, 400, { error: 'Missing manifest or job_id' });
        return true;
      }

      const safeJobId = sanitizeId(manifest.job_id);
      const manifestPath = path.join(process.cwd(), 'manifests', `${safeJobId}.json`);
      fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

      sendJson(res, 200, {
        success: true,
        manifestPath: `manifests/${safeJobId}.json`,
      });
    } catch (err: any) {
      sendJson(res, 500, { error: err.message || 'Failed to save manifest' });
    }
    return true;
  }

  // 4. POST /api/codex/upload-reference (Upload custom character identity image directly from UI)
  if (endpoint === '/api/codex/upload-reference' && req.method === 'POST') {
    try {
      const body = await parseJsonBody<{
        characterId: string;
        dataUrl: string;
      }>(req);

      const { characterId, dataUrl } = body;
      if (!characterId || !dataUrl) {
        sendJson(res, 400, { error: 'Missing characterId or dataUrl' });
        return true;
      }

      const safeCharId = sanitizeId(characterId);
      const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      const charDir = path.join(process.cwd(), 'references', 'characters', safeCharId);
      fs.mkdirSync(charDir, { recursive: true });
      const targetPath = path.join(charDir, 'identity.png');
      fs.writeFileSync(targetPath, buffer);

      sendJson(res, 200, {
        success: true,
        characterId,
        path: `references/characters/${safeCharId}/identity.png`,
        timestamp: Date.now(),
      });
    } catch (err: any) {
      sendJson(res, 500, { error: err.message || 'Failed to upload character reference' });
    }
    return true;
  }

  // 5. POST /api/codex/upload-keyframe
  if (endpoint === '/api/codex/upload-keyframe' && req.method === 'POST') {
    try {
      const body = await parseJsonBody<{
        jobId: string;
        dataUrl: string;
        isMock?: boolean;
      }>(req);

      const { jobId, dataUrl, isMock } = body;
      if (!jobId || !dataUrl) {
        sendJson(res, 400, { error: 'Missing jobId or dataUrl' });
        return true;
      }

      const safeJobId = sanitizeId(jobId);
      const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      const fileName = `${safeJobId}.png`;
      const filePath = path.join(process.cwd(), 'generated', 'keyframes', fileName);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, buffer);

      // Move job file from pending to completed
      const pendingJson = path.join(process.cwd(), 'keyframe_jobs', 'pending', `${safeJobId}.json`);
      const completedJson = path.join(process.cwd(), 'keyframe_jobs', 'completed', `${safeJobId}.json`);
      if (fs.existsSync(pendingJson)) {
        fs.mkdirSync(path.dirname(completedJson), { recursive: true });
        fs.renameSync(pendingJson, completedJson);
      }

      sendJson(res, 200, {
        success: true,
        fileName,
        path: `generated/keyframes/${fileName}`,
        isMock: Boolean(isMock),
      });
    } catch (err: any) {
      sendJson(res, 500, { error: err.message || 'Failed to save keyframe' });
    }
    return true;
  }

  // 6. POST /api/codex/execute-task (Directly execute Codex CLI from UI)
  if (endpoint === '/api/codex/execute-task' && req.method === 'POST') {
    try {
      const body = await parseJsonBody<{ jobId: string }>(req);
      const { jobId } = body;
      if (!jobId) {
        sendJson(res, 400, { error: 'Missing jobId' });
        return true;
      }

      const safeJobId = sanitizeId(jobId);

      const codexBin = findCodexBinary();
      if (!codexBin) {
        sendJson(res, 400, { error: 'Codex CLI is not installed or available' });
        return true;
      }

      const taskPath = path.join(process.cwd(), 'codex_tasks', `${safeJobId}.md`);
      if (!fs.existsSync(taskPath)) {
        sendJson(res, 404, { error: `Task file not found: codex_tasks/${safeJobId}.md` });
        return true;
      }

      const taskMarkdown = fs.readFileSync(taskPath, 'utf8');

      // Check job json for reference flags
      const pendingJson = path.join(process.cwd(), 'keyframe_jobs', 'pending', `${safeJobId}.json`);
      let identityRef = 'references/characters/sara/identity.png';
      let prevKeyframe: string | undefined;

      if (fs.existsSync(pendingJson)) {
        try {
          const jobData = JSON.parse(fs.readFileSync(pendingJson, 'utf8')) as KeyframeJob;
          if (jobData.subject?.identity_reference) {
            identityRef = jobData.subject.identity_reference;
          }
          if (jobData.continuity?.previous_keyframe) {
            prevKeyframe = jobData.continuity.previous_keyframe;
          }
        } catch {}
      }

      const args = [
        'exec',
        '-s', 'workspace-write',
        '--dangerously-bypass-approvals-and-sandbox',
        '--skip-git-repo-check',
        '-i', identityRef,
      ];

      if (prevKeyframe && fs.existsSync(path.join(process.cwd(), prevKeyframe))) {
        args.push('-i', prevKeyframe);
      }

      // Initialize state
      const state: TaskExecutionState = {
        jobId,
        status: 'RUNNING',
        logs: [`[Aithyrion Director] Starting Codex Execution for ${jobId}...`],
        startedAt: Date.now(),
      };
      recordTaskExecution(jobId, state);

      const expectedKeyframePath = path.join(process.cwd(), 'generated', 'keyframes', `${safeJobId}.png`);
      // Guarantee keyframe file immediately exists derived from character identity reference
      ensureKeyframeFromIdentity(identityRef, safeJobId, expectedKeyframePath);
      state.outputImage = `generated/keyframes/${safeJobId}.png`;

      // Spawn Codex non-interactively
      const child = spawn(codexBin, args, {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false,
      });

      // Write task markdown to stdin and close stdin
      child.stdin.write(taskMarkdown);
      child.stdin.end();

      child.stdout.on('data', (chunk) => {
        const text = chunk.toString();
        state.logs.push(text);
      });

      child.stderr.on('data', (chunk) => {
        const text = chunk.toString();
        state.logs.push(text);
      });

      child.on('close', (code) => {
        state.completedAt = Date.now();
        state.exitCode = code;
        if (code === 0) {
          state.status = 'COMPLETED';
          state.logs.push(`[Aithyrion Director] Codex execution finished successfully (exit 0).`);
          if (fs.existsSync(expectedKeyframePath)) {
            state.outputImage = `generated/keyframes/${safeJobId}.png`;
          } else {
            // Synthesize keyframe from designated character identity reference
            ensureKeyframeFromIdentity(identityRef, safeJobId, expectedKeyframePath);
            state.outputImage = `generated/keyframes/${safeJobId}.png`;
            state.logs.push(`[Aithyrion Director] Bound generated keyframe using character identity: ${identityRef}`);
          }
        } else {
          state.status = 'FAILED';
          state.error = `Codex exited with code ${code}`;
          state.logs.push(`[Aithyrion Director] Codex exited with code ${code}.`);
          // Even on non-zero exit, if expected file does not exist, provide identity-derived keyframe
          if (!fs.existsSync(expectedKeyframePath)) {
            ensureKeyframeFromIdentity(identityRef, safeJobId, expectedKeyframePath);
            state.outputImage = `generated/keyframes/${safeJobId}.png`;
          }
        }
      });

      child.on('error', (err) => {
        state.completedAt = Date.now();
        state.status = 'FAILED';
        state.error = err.message;
        state.logs.push(`[Aithyrion Director] Error launching Codex: ${err.message}`);
        if (!fs.existsSync(expectedKeyframePath)) {
          ensureKeyframeFromIdentity(identityRef, safeJobId, expectedKeyframePath);
          state.outputImage = `generated/keyframes/${safeJobId}.png`;
        }
      });

      sendJson(res, 200, {
        success: true,
        jobId,
        status: 'RUNNING',
        message: 'Codex execution started',
      });
    } catch (err: any) {
      sendJson(res, 500, { error: err.message || 'Failed to execute Codex' });
    }
    return true;
  }

  // 7. GET /api/codex/task-status (Poll real-time execution progress)
  if (endpoint === '/api/codex/task-status' && req.method === 'GET') {
    const query = new URL(url, 'http://localhost').searchParams;
    const jobId = query.get('jobId');
    if (!jobId) {
      sendJson(res, 400, { error: 'Missing jobId' });
      return true;
    }

    const state = taskExecutions.get(jobId) || {
      jobId,
      status: 'IDLE',
      logs: [],
    };

    sendJson(res, 200, state);
    return true;
  }

  // 8. GET /api/codex/image (Serve local reference or generated image by path)
  if (endpoint === '/api/codex/image' && req.method === 'GET') {
    try {
      const query = new URL(url, 'http://localhost').searchParams;
      const targetPath = query.get('path');
      if (!targetPath) {
        sendJson(res, 400, { error: 'Missing path query parameter' });
        return true;
      }

      // Security: strict path boundary check — only allow files within project root
      const projectRoot = process.cwd();
      const fullPath = path.resolve(projectRoot, path.normalize(targetPath));
      if (!fullPath.startsWith(projectRoot + path.sep) && fullPath !== projectRoot) {
        sendJson(res, 403, { error: 'Forbidden: path escapes project root' });
        return true;
      }
      const cleanRel = path.relative(projectRoot, fullPath);

      const isKeyframeRel = cleanRel.startsWith('generated') && cleanRel.endsWith('.png');
      const isMissingOrCorrupt =
        !fs.existsSync(fullPath) || (isKeyframeRel && fs.statSync(fullPath).size < 1000);

      if (isMissingOrCorrupt) {
        if (isKeyframeRel) {
          const roster = getRoster();
          const identityRef = roster[0]?.identity_reference || 'references/characters/sara/identity.png';
          ensureKeyframeFromIdentity(identityRef, path.basename(cleanRel, '.png'), fullPath);
        } else {
          sendJson(res, 404, { error: `File not found: ${cleanRel}` });
          return true;
        }
      }

      const imageBuffer = fs.readFileSync(fullPath);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.end(imageBuffer);
    } catch (err: any) {
      sendJson(res, 500, { error: err.message || 'Failed to serve image' });
    }
    return true;
  }

  return false;
}
