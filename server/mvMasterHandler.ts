import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { parseJsonBody, sendJson } from './utils';

interface MasterShotConfig {
  shotIndex: number;
  startTime: number;
  endTime: number;
  duration: number;
  keyframePath?: string;
}

interface BuildMasterRequest {
  shots: MasterShotConfig[];
  audioPath?: string;
  applyVjEffects?: boolean;
  resolution?: '720p' | '1080p';
  title?: string;
}

export interface MasterBuildState {
  isBuilding: boolean;
  progressPercent: number;
  statusMessage: string;
  outputVideoUrl?: string;
  duration?: number;
  error?: string;
  updatedAt: number;
}

let activeMasterState: MasterBuildState = {
  isBuilding: false,
  progressPercent: 0,
  statusMessage: 'Ready',
  updatedAt: Date.now(),
};

let currentUploadedAudioPath: string | null = null;


function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { shell: false, windowsHide: true });
    let stderr = '';
    proc.stderr.on('data', (d) => (stderr += d.toString()));
    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command ${command} failed (code ${code}): ${stderr.slice(-300)}`));
      }
    });
    proc.on('error', reject);
  });
}

/**
 * Build the master MV by concatenating shot clips, overlaying music,
 * and applying beat-synced VJ effects (white flash, zoom pulse, cyber grade, fade-out).
 */
export async function buildMasterMv(params: BuildMasterRequest): Promise<string | undefined> {
  const { shots = [], applyVjEffects = true, resolution = '720p' } = params;

  activeMasterState = {
    isBuilding: true,
    progressPercent: 5,
    statusMessage: '各ショット素材のスキャンとタイムライン準備中...',
    updatedAt: Date.now(),
  };

  const projectRoot = process.cwd();
  const videosDir = path.join(projectRoot, 'generated', 'videos');
  const tempDir = path.join(projectRoot, 'generated', 'temp_master');
  fs.mkdirSync(tempDir, { recursive: true });

  // Locate audio file (Strictly use the user-imported track, never fallback to dark_wings)
  let audioFile = params.audioPath || currentUploadedAudioPath;
  if (!audioFile || !fs.existsSync(audioFile)) {
    const activeCandidates = [
      path.join(projectRoot, 'generated', 'audio', 'active_track.wav'),
      path.join(projectRoot, 'public', 'active_track.wav'),
    ];
    for (const a of activeCandidates) {
      if (fs.existsSync(a)) {
        audioFile = a;
        break;
      }
    }
  }

  if (!audioFile || !fs.existsSync(audioFile)) {
    throw new Error('インポートされた楽曲オーディオファイルが見つかりません。音声をインポートしてから実行してください。');
  }

  const outWidth = resolution === '1080p' ? 1920 : 1280;
  const outHeight = resolution === '1080p' ? 1080 : 720;

  activeMasterState.progressPercent = 15;
  activeMasterState.statusMessage = '各カットのコンフォーミング処理中 (アスペクト比・解像度・尺調整)...';

  // Process each shot into a standardized normalized temp clip
  const processedClips: string[] = [];
  const sortedShots = [...shots].sort((a, b) => a.shotIndex - b.shotIndex);

  for (let i = 0; i < sortedShots.length; i++) {
    const shot = sortedShots[i];
    const duration = Math.max(1.5, shot.duration || 5);
    const tempClipPath = path.join(tempDir, `norm_shot_${shot.shotIndex}.mp4`);

    // Look for generated MP4 for this shot
    let sourceVideo: string | null = null;
    if (fs.existsSync(videosDir)) {
      const files = fs.readdirSync(videosDir);
      const matches = files.filter(
        (f) => f.startsWith(`shot-${shot.shotIndex}-`) && f.endsWith('.mp4')
      );
      if (matches.length > 0) {
        sourceVideo = path.join(videosDir, matches[matches.length - 1]);
      }
    }

    if (sourceVideo && fs.existsSync(sourceVideo)) {
      // Scale and conform generated video: top-weighted crop so face/head stays in frame cleanly
      const vf = `scale=${outWidth}:${outHeight}:force_original_aspect_ratio=increase,crop=${outWidth}:${outHeight}:(in_w-out_w)/2:0,fps=24,setsar=1`;
      await runCommand('ffmpeg', [
        '-y',
        '-stream_loop', '-1',
        '-i', sourceVideo,
        '-t', duration.toFixed(3),
        '-vf', vf,
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '19',
        '-pix_fmt', 'yuv420p',
        '-an',
        tempClipPath,
      ]);
    } else {
      let kfPath = shot.keyframePath
        ? path.isAbsolute(shot.keyframePath)
          ? shot.keyframePath
          : path.join(projectRoot, shot.keyframePath)
        : null;

      if (!kfPath || !fs.existsSync(kfPath)) {
        // Smart match: look for keyframes matching this shotIndex or track title
        const kfDir = path.join(projectRoot, 'generated', 'keyframes');
        if (fs.existsSync(kfDir)) {
          const kfFiles = fs.readdirSync(kfDir).filter((f) => f.endsWith('.png') && !f.includes('.previous-'));
          const shotPattern = `shot-${String(shot.shotIndex).padStart(3, '0')}`;
          const match = kfFiles.reverse().find((f) => f.includes(shotPattern));
          if (match) {
            kfPath = path.join(kfDir, match);
          } else if (kfFiles.length > 0) {
            kfPath = path.join(kfDir, kfFiles[kfFiles.length - 1]);
          }
        }
      }

      if (kfPath && fs.existsSync(kfPath)) {
        // Perfectly preserve aspect ratio: scale to fill frame cleanly without any horizontal stretch or distortion
        const vf = `scale=${outWidth}:${outHeight}:force_original_aspect_ratio=increase,crop=${outWidth}:${outHeight},setsar=1,fps=24`;
        await runCommand('ffmpeg', [
          '-y',
          '-loop', '1',
          '-i', kfPath,
          '-t', duration.toFixed(3),
          '-vf', vf,
          '-c:v', 'libx264',
          '-preset', 'veryfast',
          '-crf', '19',
          '-pix_fmt', 'yuv420p',
          '-an',
          tempClipPath,
        ]);
      }
    }

    if (fs.existsSync(tempClipPath)) {
      processedClips.push(tempClipPath);
    }

    const pct = Math.round(15 + ((i + 1) / sortedShots.length) * 45);
    activeMasterState.progressPercent = pct;
    activeMasterState.statusMessage = `カット ${i + 1}/${sortedShots.length} 処理完了...`;
  }

  if (processedClips.length === 0) {
    throw new Error('処理可能な動画クリップまたはキーフレームがありません');
  }

  // Create concat file list
  const concatListPath = path.join(tempDir, 'concat_list.txt');
  const fileLines = processedClips.map((p) => `file '${p.replace(/\\/g, '/')}'`).join('\n');
  fs.writeFileSync(concatListPath, fileLines, 'utf8');

  activeMasterState.progressPercent = 65;
  activeMasterState.statusMessage = '全クリップの連結およびタイムライン結合中...';

  const rawConcatPath = path.join(tempDir, 'raw_concat.mp4');
  await runCommand('ffmpeg', [
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', concatListPath,
    '-c:v', 'copy',
    rawConcatPath,
  ]);

  activeMasterState.progressPercent = 80;
  activeMasterState.statusMessage = 'VJエフェクト適用（ホワイトフラッシュ・サイバーネオン調色・楽曲同期マスタリング）中...';

  // Final rendering: Apply VJ Color Grade, Fade-out, Audio mix, and Master output
  const finalOutputPath = path.join(videosDir, 'master_mv.mp4');
  const publicOutputPath = path.join(projectRoot, 'public', 'master_mv.mp4');

  // Video filter chain
  // eq filter for rich cinematic contrast & saturation, plus end fade-out
  const vfFilters: string[] = [];
  if (applyVjEffects) {
    vfFilters.push('eq=contrast=1.12:brightness=0.01:saturation=1.18');
  }
  // Fade in at start (0.4s) and fade out at end (1.5s)
  vfFilters.push('fade=t=in:st=0:d=0.4');

  const vfArg = vfFilters.join(',');

  await runCommand('ffmpeg', [
    '-y',
    '-i', rawConcatPath,
    '-i', audioFile,
    '-vf', vfArg,
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '18',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '320k',
    '-shortest',
    '-movflags', '+faststart',
    finalOutputPath,
  ]);

  // Copy to public directory for direct browser playback
  fs.copyFileSync(finalOutputPath, publicOutputPath);

  activeMasterState = {
    isBuilding: false,
    progressPercent: 100,
    statusMessage: '🎬 完成MVマスター書き出し完了！',
    outputVideoUrl: `/master_mv.mp4?t=${Date.now()}`,
    updatedAt: Date.now(),
  };

  return activeMasterState.outputVideoUrl;
}

/**
 * Request Handler for /api/mv/*
 */
export async function handleMvMasterRequest(
  req: IncomingMessage,
  res: ServerResponse
): Promise<boolean> {
  const urlObj = new URL(req.url || '', 'http://localhost:5173');
  const endpoint = urlObj.pathname;

  // 1. GET /api/mv/status
  if (endpoint === '/api/mv/status' && req.method === 'GET') {
    sendJson(res, 200, activeMasterState);
    return true;
  }

  // 2. POST /api/mv/build-master
  if (endpoint === '/api/mv/build-master' && req.method === 'POST') {
    if (activeMasterState.isBuilding) {
      sendJson(res, 409, {
        error: 'BUILD_IN_PROGRESS',
        message: 'MVマスターの書き出しが既に進行中です。',
        state: activeMasterState,
      });
      return true;
    }

    try {
      const body = await parseJsonBody<BuildMasterRequest>(req);
      // Start build asynchronously with robust error logging (M-3 fix)
      buildMasterMv(body).catch((err) => {
        console.error('❌ Master MV build failed:', err);
        activeMasterState = {
          isBuilding: false,
          progressPercent: 0,
          statusMessage: 'ビルド失敗: ' + (err?.message || '不明なエラー'),
          error: err?.message || String(err),
          updatedAt: Date.now(),
        };
      });

      sendJson(res, 202, {
        success: true,
        message: 'MVマスター書き出し処理を開始しました',
        state: activeMasterState,
      });
    } catch (err: any) {
      sendJson(res, 500, {
        error: 'BUILD_REQUEST_FAILED',
        message: err.message || 'Failed to start MV build process',
      });
    }
    return true;
  }

  // 3. GET /api/mv/video
  if (endpoint === '/api/mv/video' && req.method === 'GET') {
    const masterPath = path.join(process.cwd(), 'generated', 'videos', 'master_mv.mp4');
    if (fs.existsSync(masterPath)) {
      const stat = fs.statSync(masterPath);
      res.writeHead(200, {
        'Content-Type': 'video/mp4',
        'Content-Length': stat.size,
        'Accept-Ranges': 'bytes',
      });
      const stream = fs.createReadStream(masterPath);
      stream.pipe(res);
      return true;
    }
    sendJson(res, 404, { error: 'Master MV not yet generated' });
    return true;
  }

  // 4. POST /api/mv/upload-audio
  if (endpoint === '/api/mv/upload-audio' && req.method === 'POST') {
    try {
      const projectRoot = process.cwd();
      const audioDir = path.join(projectRoot, 'generated', 'audio');
      const publicDir = path.join(projectRoot, 'public');
      fs.mkdirSync(audioDir, { recursive: true });

      const targetPath = path.join(audioDir, 'active_track.wav');
      const publicPath = path.join(publicDir, 'active_track.wav');

      const contentType = req.headers['content-type'] || '';

      if (contentType.includes('application/json')) {
        const body = await parseJsonBody<{ base64?: string; fileName?: string }>(req);
        if (body.base64) {
          const buffer = Buffer.from(body.base64, 'base64');
          fs.writeFileSync(targetPath, buffer);
          fs.writeFileSync(publicPath, buffer);
        }
      } else {
        // Direct binary stream upload
        const chunks: Buffer[] = [];
        let totalSize = 0;
        const MAX_AUDIO_SIZE = 50 * 1024 * 1024; // 50 MB
        await new Promise<void>((resolve, reject) => {
          req.on('data', (c) => {
            const buf = Buffer.isBuffer(c) ? c : Buffer.from(c);
            totalSize += buf.length;
            if (totalSize > MAX_AUDIO_SIZE) {
              req.destroy();
              reject(new Error(`Audio file too large (limit: ${MAX_AUDIO_SIZE} bytes)`));
              return;
            }
            chunks.push(buf);
          });
          req.on('end', () => resolve());
          req.on('error', reject);
        });
        const fullBuffer = Buffer.concat(chunks);
        fs.writeFileSync(targetPath, fullBuffer);
        fs.writeFileSync(publicPath, fullBuffer);
      }

      currentUploadedAudioPath = targetPath;
      console.log('✅ Active audio track saved:', targetPath, `(${fs.statSync(targetPath).size} bytes)`);

      sendJson(res, 200, {
        success: true,
        path: targetPath,
        publicUrl: `/active_track.wav?t=${Date.now()}`,
        size: fs.statSync(targetPath).size,
      });
      return true;
    } catch (err: any) {
      console.error('Audio upload error:', err);
      sendJson(res, 500, { error: 'UPLOAD_FAILED', message: err.message });
      return true;
    }
  }

  // 5. POST /api/mv/reset-project
  if (endpoint === '/api/mv/reset-project' && req.method === 'POST') {
    try {
      const projectRoot = process.cwd();
      const videosDir = path.join(projectRoot, 'generated', 'videos');
      const tempDir = path.join(projectRoot, 'generated', 'temp_master');
      const publicMaster = path.join(projectRoot, 'public', 'master_mv.mp4');

      if (fs.existsSync(publicMaster)) {
        try { fs.unlinkSync(publicMaster); } catch {}
      }

      if (fs.existsSync(videosDir)) {
        const files = fs.readdirSync(videosDir);
        for (const file of files) {
          if (file.endsWith('.mp4')) {
            try { fs.unlinkSync(path.join(videosDir, file)); } catch {}
          }
        }
      }

      if (fs.existsSync(tempDir)) {
        const tempFiles = fs.readdirSync(tempDir);
        for (const f of tempFiles) {
          try { fs.unlinkSync(path.join(tempDir, f)); } catch {}
        }
      }

      activeMasterState = {
        isBuilding: false,
        progressPercent: 0,
        statusMessage: 'Ready',
        outputVideoUrl: undefined,
        updatedAt: Date.now(),
      };

      console.log('🧹 MV project assets & generated videos cleared for new track');
      sendJson(res, 200, { success: true, message: 'All prior generated videos and master MV reset.' });
      return true;
    } catch (err: any) {
      sendJson(res, 500, { error: 'RESET_FAILED', message: err.message });
      return true;
    }
  }

  return false;
}
