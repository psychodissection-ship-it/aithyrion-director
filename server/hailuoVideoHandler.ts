import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import path from 'path';
import https from 'https';
import { parseJsonBody, sendJson } from './utils';

interface HailuoGenerateRequest {
  shotIndex: number;
  prompt: string;
  keyframePath?: string;
  model?: string;
  duration?: number;
  apiKey?: string;
}

interface MiniMaxTaskResponse {
  task_id?: string;
  base_resp?: {
    status_code: number;
    status_msg: string;
  };
}

interface MiniMaxQueryResponse {
  status?: 'Preparing' | 'Processing' | 'Success' | 'Fail';
  file_id?: string;
  download_url?: string;
  base_resp?: {
    status_code: number;
    status_msg: string;
  };
}

// In-memory task tracking
interface LocalTaskRecord {
  taskId: string;
  shotIndex: number;
  prompt: string;
  model: string;
  status: 'Preparing' | 'Processing' | 'Success' | 'Fail';
  fileId?: string;
  videoPath?: string;
  error?: string;
  createdAt: number;
  updatedAt?: number;
}

const activeTasks = new Map<string, LocalTaskRecord>();

export interface BatchItem {
  shotIndex: number;
  prompt: string;
  keyframePath?: string;
  model?: string;
  duration?: number;
  status: 'pending' | 'generating' | 'polling' | 'completed' | 'failed' | 'cancelled';
  taskId?: string;
  progressMessage?: string;
  videoUrl?: string;
  error?: string;
}

export interface BatchState {
  isRunning: boolean;
  total: number;
  completed: number;
  failed: number;
  currentShotIndex?: number;
  items: BatchItem[];
  startedAt?: number;
  statusMessage: string;
}

let activeBatchState: BatchState = {
  isRunning: false,
  total: 0,
  completed: 0,
  failed: 0,
  items: [],
  statusMessage: 'Ready',
};

let batchCancelled = false;

// Helper to make HTTPS requests
function httpsRequest(
  options: https.RequestOptions,
  postData?: string
): Promise<{ statusCode: number; headers: any; body: string }> {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode || 200,
          headers: res.headers,
          body,
        });
      });
    });

    req.on('error', (err) => reject(err));
    req.setTimeout(60000, () => {
      req.destroy(new Error('Request timeout to MiniMax API'));
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

// Helper to download binary file
function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    const file = fs.createWriteStream(destPath);
    https
      .get(url, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          // Handle redirect
          downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
          return;
        }
        res.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      })
      .on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
  });
}

/**
 * Safely normalize video duration according to model capabilities:
 * - MiniMax-H3 / H3-Max (v2): supports 5s or 10s
 * - MiniMax-Hailuo-2.3 / Hailuo-02 (v1): strictly supports 6s or 10s (5s will be rejected)
 */
export function normalizeVideoDuration(model: string = '', duration?: number): number {
  const isH3 = model.startsWith('MiniMax-H3');
  if (isH3) {
    return (duration && duration >= 8) ? 10 : 5;
  }
  return (duration && duration >= 8) ? 10 : 6;
}

function getMinimaxApiKey(): string {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    try {
      const raw = fs.readFileSync(envPath, 'utf8');
      for (const line of raw.split('\n')) {
        const match = line.match(/^\s*MINIMAX_API_KEY\s*=\s*(.*)$/);
        if (match && match[1]) {
          const val = match[1].trim().replace(/^['"]|['"]$/g, '');
          if (val) return val;
        }
      }
    } catch {}
  }
  if (process.env.MINIMAX_API_KEY) return process.env.MINIMAX_API_KEY.trim();
  return '';
}

export async function handleHailuoVideoRequest(
  req: IncomingMessage,
  res: ServerResponse
): Promise<boolean> {
  const urlObj = new URL(req.url || '', 'http://localhost:5173');
  const endpoint = urlObj.pathname;

  // 1. GET /api/hailuo/config
  if (endpoint === '/api/hailuo/config' && req.method === 'GET') {
    const envKey = getMinimaxApiKey();
    const hasEnvKey = Boolean(envKey);
    sendJson(res, 200, {
      hasEnvKey,
      availableModels: [
        { id: 'MiniMax-Hailuo-2.3', name: 'Hailuo 2.3 (Cinematic / High Fidelity)', default: true },
        { id: 'MiniMax-Hailuo-02', name: 'Hailuo 02 (Standard / Stable)' },
        { id: 'MiniMax-H3', name: 'MiniMax H3 (Native 2K / Multimodal)' },
        { id: 'MiniMax-H3-Max', name: 'MiniMax H3 Max (High Speed / Flagship)' },
      ],
      defaultModel: 'MiniMax-Hailuo-2.3',
    });
    return true;
  }

  // 2. POST /api/hailuo/generate
  if (endpoint === '/api/hailuo/generate' && req.method === 'POST') {
    try {
      const body = await parseJsonBody<HailuoGenerateRequest>(req);
      const { shotIndex, prompt, keyframePath, model = 'MiniMax-Hailuo-02', duration = 6 } = body;

      const apiKey = body.apiKey || getMinimaxApiKey();

      if (!apiKey) {
        sendJson(res, 400, {
          error: 'NO_API_KEY',
          message: 'MiniMax API Keyが指定されていません。APIキーを入力するか環境変数 MINIMAX_API_KEY を設定してください。',
        });
        return true;
      }

      // Read local keyframe image and convert to base64 if present
      let firstFrameBase64: string | undefined = undefined;
      if (keyframePath) {
        const fullKeyframePath = path.resolve(process.cwd(), keyframePath);
        if (!fullKeyframePath.startsWith(process.cwd() + path.sep) && fullKeyframePath !== process.cwd()) {
          sendJson(res, 403, { error: 'Forbidden: keyframe path escapes project root' });
          return true;
        }

        if (fs.existsSync(fullKeyframePath)) {
          const imgBuffer = fs.readFileSync(fullKeyframePath);
          const ext = path.extname(fullKeyframePath).toLowerCase().replace('.', '') || 'png';
          firstFrameBase64 = `data:image/${ext};base64,${imgBuffer.toString('base64')}`;
        }
      }

      const isH3 = model.startsWith('MiniMax-H3');
      const apiPath = isH3 ? '/v2/video_generation' : '/v1/video_generation';

      // Build API payload for v1 or v2
      let payload: Record<string, any>;
      if (isH3) {
        const content: any[] = [{ type: 'text', text: prompt }];
        if (firstFrameBase64) {
          content.push({
            type: 'image_url',
            image_url: { url: firstFrameBase64 },
            role: 'first_frame',
          });
        }
        const normalizedDur = normalizeVideoDuration(model, duration);
        payload = {
          model,
          content,
          resolution: '768P',
          duration: normalizedDur,
          ratio: firstFrameBase64 ? 'adaptive' : '16:9',
        };
      } else {
        const normalizedDur = normalizeVideoDuration(model, duration);
        payload = {
          model,
          prompt,
          prompt_optimizer: true,
          duration: normalizedDur,
        };
        if (firstFrameBase64) {
          payload.first_frame_image = firstFrameBase64;
        }
      }

      const postData = JSON.stringify(payload);

      // Post to MiniMax official international API (or mainland api.minimax.chat)
      const host = process.env.MINIMAX_API_HOST || 'api.minimaxi.chat';
      const apiRes = await httpsRequest(
        {
          hostname: host,
          path: apiPath,
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
          },
        },
        postData
      );

      let respJson: any = {};
      try {
        respJson = JSON.parse(apiRes.body);
      } catch (err) {
        sendJson(res, 502, {
          error: 'INVALID_UPSTREAM_RESPONSE',
          raw: apiRes.body,
        });
        return true;
      }

      // Handle v2 error format: { error: { message: "..." } }
      if (respJson.error && respJson.error.message) {
        sendJson(res, 400, {
          error: 'MINIMAX_API_ERROR',
          message: respJson.error.message,
        });
        return true;
      }

      if (respJson.base_resp && respJson.base_resp.status_code !== 0) {
        sendJson(res, 400, {
          error: 'MINIMAX_API_ERROR',
          code: respJson.base_resp.status_code,
          message: respJson.base_resp.status_msg,
        });
        return true;
      }

      const taskId = respJson.task_id;
      if (!taskId) {
        sendJson(res, 500, {
          error: 'NO_TASK_ID_RETURNED',
          response: respJson,
        });
        return true;
      }

      // Record task
      const record: LocalTaskRecord = {
        taskId,
        shotIndex,
        prompt,
        model,
        status: 'Preparing',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      activeTasks.set(taskId, record);

      sendJson(res, 200, {
        success: true,
        taskId,
        status: 'Preparing',
        shotIndex,
        model,
      });
    } catch (err: any) {
      sendJson(res, 500, {
        error: 'GENERATE_REQUEST_FAILED',
        message: err.message || 'Failed to submit video generation task to MiniMax',
      });
    }
    return true;
  }

  // 3. GET /api/hailuo/status?taskId=...&apiKey=...
  if (endpoint === '/api/hailuo/status' && req.method === 'GET') {
    try {
      const taskId = urlObj.searchParams.get('taskId');
      const queryApiKey = urlObj.searchParams.get('apiKey');
      const apiKey = queryApiKey || getMinimaxApiKey();

      if (!taskId) {
        sendJson(res, 400, { error: 'Missing taskId' });
        return true;
      }

      if (!apiKey) {
        sendJson(res, 400, { error: 'Missing apiKey' });
        return true;
      }

      const host = process.env.MINIMAX_API_HOST || 'api.minimaxi.chat';
      const apiRes = await httpsRequest({
        hostname: host,
        path: `/v1/query/video_generation?task_id=${encodeURIComponent(taskId)}`,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      let respJson: MiniMaxQueryResponse = {};
      try {
        respJson = JSON.parse(apiRes.body);
      } catch (err) {
        sendJson(res, 502, {
          error: 'INVALID_QUERY_RESPONSE',
          raw: apiRes.body,
        });
        return true;
      }

      const status = respJson.status || 'Processing';
      const fileId = respJson.file_id;
      const downloadUrl = respJson.download_url;

      let localVideoPath: string | undefined = undefined;
      const taskRecord = activeTasks.get(taskId);
      const shotIndex = taskRecord?.shotIndex || 1;

      // If Success, download and cache the MP4 locally
      if (status === 'Success') {
        const destFileName = `shot-${shotIndex}-${taskId.slice(-6)}.mp4`;
        const destPath = path.join(process.cwd(), 'generated', 'videos', destFileName);

        if (!fs.existsSync(destPath)) {
          let urlToDownload = downloadUrl;
          if (!urlToDownload && fileId) {
            // Retrieve file URL if not directly in query response
            const fileRes = await httpsRequest({
              hostname: host,
              path: `/v1/files/retrieve?file_id=${encodeURIComponent(fileId)}`,
              method: 'GET',
              headers: { Authorization: `Bearer ${apiKey}` },
            });
            try {
              const fileData = JSON.parse(fileRes.body);
              urlToDownload = fileData?.file?.download_url;
            } catch {}
          }

          if (urlToDownload) {
            await downloadFile(urlToDownload, destPath);
          }
        }

        if (fs.existsSync(destPath)) {
          localVideoPath = `/api/hailuo/video?file=${encodeURIComponent(destFileName)}`;
        }
      }

      if (taskRecord) {
        taskRecord.status = status;
        taskRecord.fileId = fileId;
        taskRecord.videoPath = localVideoPath;
        taskRecord.updatedAt = Date.now();
      }

      sendJson(res, 200, {
        success: true,
        taskId,
        status,
        fileId,
        downloadUrl,
        videoUrl: localVideoPath || downloadUrl,
        shotIndex,
      });
    } catch (err: any) {
      sendJson(res, 500, {
        error: 'STATUS_QUERY_FAILED',
        message: err.message || 'Failed to query video generation status',
      });
    }
    return true;
  }

  // 4. GET /api/hailuo/video?file=... or ?shotIndex=...
  if (endpoint === '/api/hailuo/video' && req.method === 'GET') {
    const fileParam = urlObj.searchParams.get('file');
    const shotParam = urlObj.searchParams.get('shotIndex');

    let targetFile = '';
    const videoDir = path.join(process.cwd(), 'generated', 'videos');

    if (fileParam) {
      targetFile = path.join(videoDir, path.basename(fileParam));
    } else if (shotParam) {
      const prefix = `shot-${shotParam}-`;
      if (fs.existsSync(videoDir)) {
        const matches = fs.readdirSync(videoDir).filter((f) => f.startsWith(prefix) && f.endsWith('.mp4'));
        if (matches.length > 0) {
          targetFile = path.join(videoDir, matches[matches.length - 1]);
        }
      }
    }

    if (targetFile && fs.existsSync(targetFile)) {
      const stat = fs.statSync(targetFile);
      res.writeHead(200, {
        'Content-Type': 'video/mp4',
        'Content-Length': stat.size,
        'Accept-Ranges': 'bytes',
      });
      const stream = fs.createReadStream(targetFile);
      stream.pipe(res);
      return true;
    }

    sendJson(res, 404, { error: 'Video file not found' });
    return true;
  }

  // 5. GET /api/hailuo/list-videos
  if (endpoint === '/api/hailuo/list-videos' && req.method === 'GET') {
    const videoDir = path.join(process.cwd(), 'generated', 'videos');
    const list: Array<{ fileName: string; shotIndex: number; url: string; size: number; createdAt: number }> = [];

    if (fs.existsSync(videoDir)) {
      const files = fs.readdirSync(videoDir);
      for (const f of files) {
        if (f.endsWith('.mp4')) {
          const p = path.join(videoDir, f);
          const stat = fs.statSync(p);
          const shotMatch = f.match(/^shot-(\d+)-/);
          list.push({
            fileName: f,
            shotIndex: shotMatch ? parseInt(shotMatch[1], 10) : 1,
            url: `/api/hailuo/video?file=${encodeURIComponent(f)}`,
            size: stat.size,
            createdAt: stat.birthtimeMs,
          });
        }
      }
    }

    sendJson(res, 200, { success: true, videos: list });
    return true;
  }

  // 6. POST /api/hailuo/batch-generate
  if (endpoint === '/api/hailuo/batch-generate' && req.method === 'POST') {
    if (activeBatchState.isRunning) {
      sendJson(res, 409, {
        error: 'BATCH_ALREADY_RUNNING',
        message: '一括生成が既に実行中です',
        state: activeBatchState,
      });
      return true;
    }

    try {
      const body = await parseJsonBody<{
        shots: Array<{
          shotIndex: number;
          prompt: string;
          keyframePath?: string;
          model?: string;
          duration?: number;
        }>;
        apiKey?: string;
        model?: string;
      }>(req);

      const apiKey = body.apiKey || getMinimaxApiKey();
      if (!apiKey) {
        sendJson(res, 400, {
          error: 'NO_API_KEY',
          message: 'MiniMax API Keyが指定されていません',
        });
        return true;
      }

      const shots = body.shots || [];
      if (shots.length === 0) {
        sendJson(res, 400, { error: 'NO_SHOTS', message: '生成対象のショットがありません' });
        return true;
      }

      const defaultModel = body.model || 'MiniMax-Hailuo-2.3';
      activeBatchState = {
        isRunning: true,
        total: shots.length,
        completed: 0,
        failed: 0,
        statusMessage: `全${shots.length}カットの一括生成を開始します...`,
        startedAt: Date.now(),
        items: shots.map((s) => ({
          shotIndex: s.shotIndex,
          prompt: s.prompt,
          keyframePath: s.keyframePath,
          model: s.model || defaultModel,
          duration: normalizeVideoDuration(s.model || defaultModel, s.duration),
          status: 'pending',
          progressMessage: '待機中',
        })),
      };

      const host = process.env.MINIMAX_API_HOST || 'api.minimaxi.chat';
      // Launch batch in background
      runBatchProcess(apiKey, host);

      sendJson(res, 202, {
        success: true,
        message: '一括動画生成を開始しました',
        state: activeBatchState,
      });
    } catch (err: any) {
      sendJson(res, 500, {
        error: 'BATCH_START_FAILED',
        message: err.message || '一括生成の開始に失敗しました',
      });
    }
    return true;
  }

  // 7. GET /api/hailuo/batch-status
  if (endpoint === '/api/hailuo/batch-status' && req.method === 'GET') {
    sendJson(res, 200, activeBatchState);
    return true;
  }

  // 8. POST /api/hailuo/batch-cancel
  if (endpoint === '/api/hailuo/batch-cancel' && req.method === 'POST') {
    batchCancelled = true;
    activeBatchState.isRunning = false;
    activeBatchState.statusMessage = '一括生成がユーザーによって中断されました';
    sendJson(res, 200, { success: true, message: '一括生成を中断しました', state: activeBatchState });
    return true;
  }

  // 9. POST /api/hailuo/reset-videos
  if (endpoint === '/api/hailuo/reset-videos' && req.method === 'POST') {
    try {
      batchCancelled = true;
      activeBatchState = {
        isRunning: false,
        total: 0,
        completed: 0,
        failed: 0,
        items: [],
        statusMessage: 'Ready',
      };
      activeTasks.clear();

      const videosDir = path.join(process.cwd(), 'generated', 'videos');
      if (fs.existsSync(videosDir)) {
        const files = fs.readdirSync(videosDir);
        for (const f of files) {
          if (f.startsWith('shot-') && f.endsWith('.mp4')) {
            try { fs.unlinkSync(path.join(videosDir, f)); } catch {}
          }
        }
      }

      console.log('🧹 Hailuo video cache reset for new music track');
      sendJson(res, 200, { success: true, message: 'All prior shot videos and batch states reset.' });
      return true;
    } catch (err: any) {
      sendJson(res, 500, { error: 'RESET_FAILED', message: err.message });
      return true;
    }
  }

  return false;
}

async function runBatchProcess(apiKey: string, host: string) {
  batchCancelled = false;
  activeBatchState.isRunning = true;
  activeBatchState.startedAt = Date.now();

  for (let i = 0; i < activeBatchState.items.length; i++) {
    if (batchCancelled) {
      for (let j = i; j < activeBatchState.items.length; j++) {
        activeBatchState.items[j].status = 'cancelled';
        activeBatchState.items[j].progressMessage = 'キャンセル済み';
      }
      break;
    }

    const item = activeBatchState.items[i];
    activeBatchState.currentShotIndex = item.shotIndex;
    item.status = 'generating';
    item.progressMessage = 'MiniMax APIへ送信中...';
    activeBatchState.statusMessage = `Shot #${item.shotIndex} (${i + 1}/${activeBatchState.total}) 生成リクエスト発行中...`;

    try {
      let firstFrameBase64: string | undefined = undefined;
      if (item.keyframePath) {
        const fullKf = path.resolve(process.cwd(), item.keyframePath);
        if (!fullKf.startsWith(process.cwd() + path.sep) && fullKf !== process.cwd()) {
          throw new Error('Forbidden: keyframe path escapes project root');
        }
        if (fs.existsSync(fullKf)) {
          const buf = fs.readFileSync(fullKf);
          const ext = path.extname(fullKf).toLowerCase().replace('.', '') || 'png';
          firstFrameBase64 = `data:image/${ext};base64,${buf.toString('base64')}`;
        }
      }

      const model = item.model || 'MiniMax-Hailuo-2.3';
      const isH3 = model.startsWith('MiniMax-H3');
      const apiPath = isH3 ? '/v2/video_generation' : '/v1/video_generation';

      const normalizedDur = normalizeVideoDuration(model, item.duration);
      let payload: Record<string, any>;
      if (isH3) {
        const content: any[] = [{ type: 'text', text: item.prompt }];
        if (firstFrameBase64) {
          content.push({
            type: 'image_url',
            image_url: { url: firstFrameBase64 },
            role: 'first_frame',
          });
        }
        payload = {
          model,
          content,
          resolution: '768P',
          duration: normalizedDur,
          ratio: firstFrameBase64 ? 'adaptive' : '16:9',
        };
      } else {
        payload = {
          model,
          prompt: item.prompt,
          prompt_optimizer: true,
          duration: normalizedDur,
        };
        if (firstFrameBase64) {
          payload.first_frame_image = firstFrameBase64;
        }
      }

      const postData = JSON.stringify(payload);
      const apiRes = await httpsRequest(
        {
          hostname: host,
          path: apiPath,
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
          },
        },
        postData
      );

      let respJson: any = {};
      try {
        respJson = JSON.parse(apiRes.body);
      } catch {}

      if (respJson?.base_resp && respJson.base_resp.status_code !== 0) {
        throw new Error(respJson.base_resp.status_msg || `API Error ${respJson.base_resp.status_code}`);
      }
      if (respJson?.error) {
        throw new Error(respJson.error.message || 'API Error');
      }

      const taskId = respJson.task_id;
      if (!taskId) {
        throw new Error('タスクIDが返却されませんでした');
      }

      item.taskId = taskId;
      item.status = 'polling';
      item.progressMessage = `レンダリング待機中 (Task ID: ${taskId})...`;
      activeBatchState.statusMessage = `Shot #${item.shotIndex} (${i + 1}/${activeBatchState.total}) GPUレンダリング中...`;

      let isDone = false;
      let attempts = 0;
      const startTime = Date.now();

      while (!isDone && attempts < 40 && !batchCancelled) {
        attempts++;
        await new Promise((r) => setTimeout(r, 6000));

        const queryRes = await httpsRequest({
          hostname: host,
          path: `/v1/query/video_generation?task_id=${encodeURIComponent(taskId)}`,
          method: 'GET',
          headers: { Authorization: `Bearer ${apiKey}` },
        });

        let qJson: any = {};
        try {
          qJson = JSON.parse(queryRes.body);
        } catch {}

        const qStatus = qJson?.status;
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        item.progressMessage = `レンダリング中 (${elapsed}s)...`;
        activeBatchState.statusMessage = `Shot #${item.shotIndex} レンダリング中 (${elapsed}s)... [${activeBatchState.completed}/${activeBatchState.total} 完了]`;

        if (qStatus === 'Success') {
          isDone = true;
          const destFileName = `shot-${item.shotIndex}-${taskId.slice(-6)}.mp4`;
          const destPath = path.join(process.cwd(), 'generated', 'videos', destFileName);

          let downloadUrl = qJson.download_url;
          if (!downloadUrl && qJson.file_id) {
            const fileRes = await httpsRequest({
              hostname: host,
              path: `/v1/files/retrieve?file_id=${encodeURIComponent(qJson.file_id)}`,
              method: 'GET',
              headers: { Authorization: `Bearer ${apiKey}` },
            });
            try {
              const fJson = JSON.parse(fileRes.body);
              downloadUrl = fJson?.file?.download_url;
            } catch {}
          }

          if (downloadUrl) {
            await downloadFile(downloadUrl, destPath);
            item.videoUrl = `/api/hailuo/video?file=${encodeURIComponent(destFileName)}`;
          }

          item.status = 'completed';
          item.progressMessage = '生成完了';
          activeBatchState.completed++;
        } else if (qStatus === 'Fail') {
          isDone = true;
          item.status = 'failed';
          item.error = qJson?.base_resp?.status_msg || 'Generation failed on MiniMax';
          activeBatchState.failed++;
        }
      }

      if (!isDone && attempts >= 40) {
        item.status = 'failed';
        item.error = 'タイムアウト (4分経過)';
        activeBatchState.failed++;
      }
    } catch (err: any) {
      item.status = 'failed';
      item.error = err.message || '生成失敗';
      activeBatchState.failed++;
    }
  }

  activeBatchState.isRunning = false;
  activeBatchState.statusMessage = batchCancelled
    ? '一括生成が中断されました'
    : `一括生成完了！ (${activeBatchState.completed}/${activeBatchState.total} 成功)`;
}
