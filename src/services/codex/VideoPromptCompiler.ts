import { ShotDirection, Strategy, MusicState } from '../../types/director';
import { CharacterProfile } from '../../types/codexBridge';
import { MVConcept } from '../director/MVConceptService';

export interface CompiledVideoPrompt {
  englishPrompt: string;
  japanesePrompt: string;
  cameraPrompt: string;
  characterActionPrompt: string;
  lightingPrompt: string;
  negativePrompt: string;
  recommendedDurationSec: number;
  recommendedFps: number;
  motionScale: number;
  targetModels: string[];
}

export class VideoPromptCompiler {
  /**
   * Compiles an Image-to-Video (I2V) motion prompt from Aithyrion Director's shot decision
   */
  compilePrompt(params: {
    shotIndex: number;
    direction: ShotDirection;
    strategy: Strategy;
    musicState: MusicState;
    durationSec: number;
    character?: CharacterProfile | null;
    concept?: MVConcept | null;
  }): CompiledVideoPrompt {
    const { direction, strategy, musicState, durationSec, character, concept } = params;
    const charName = character?.name || 'Character';

    // 1. Camera Motion description
    let cameraEn = '';
    let cameraJa = '';
    switch (direction.camera_motion) {
      case 'PUSH_IN':
        cameraEn = 'Smooth cinematic camera push-in zooming slowly toward the subject, tightening the composition';
        cameraJa = 'カメラが被写体に向かって滑らかに寄っていく（スロー・プッシュイン）';
        break;
      case 'PULL_BACK':
        cameraEn = 'Dynamic cinematic camera pull-back gliding backward, gradually revealing the expansive environment and scale';
        cameraJa = 'カメラが後退しながら背景の広がりをダイナミックに見せる（プルバック）';
        break;
      case 'PAN':
        cameraEn = 'Slow, steady horizontal camera panning across the cinematic scene with subtle parallax';
        cameraJa = '横方向にゆっくりとスライドしながら情景を映す（パン移動）';
        break;
      case 'ORBIT':
        cameraEn = 'Dramatic 3D orbital camera arc rotating smoothly around the subject, creating depth and dimension';
        cameraJa = '被写体を中心に緩やかに回り込む立体的なカメラワーク（オービット）';
        break;
      case 'STATIC':
      default:
        cameraEn = 'Locked-off static cinematic camera maintaining stable framing, emphasizing subtle subject motion and atmosphere';
        cameraJa = '固定カメラによる静的な構図で、被写体の動きと空気感を際立たせる（スタティック）';
        break;
    }

    // 2. Character Action description
    let actionEn = '';
    let actionJa = '';
    switch (direction.character_motion) {
      case 'STEP_FORWARD':
        actionEn = `${charName} takes a deliberate, confident step forward toward the camera, with natural fabric motion, flowing hair drift, and weight transfer`;
        actionJa = `${charName}がカメラに向かって力強く一歩踏み出し、髪や衣装が風と重心移動に合わせて揺れ動く`;
        break;
      case 'LOOK':
        actionEn = `${charName} slowly turns their head and shifts their gaze directly into the camera lens with intense, captivating emotional expression and subtle eye highlights`;
        actionJa = `${charName}がゆっくりと顔をカメラへ向け、強い視線と感情のこもった眼差しを投げかける`;
        break;
      case 'TURN':
        actionEn = `${charName} gracefully rotates their torso and pivots, dress and hair trailing in a smooth arc with cinematic physics`;
        actionJa = `${charName}が優雅に身体の向きを反転させ、衣装と髪が軌跡を描いてたなびく`;
        break;
      case 'GESTURE':
        actionEn = `${charName} raises their hand in an expressive, commanding gesture, holding their signature accessory while atmospheric particles react`;
        actionJa = `${charName}が感情豊かに手をかざし、光の粒子が呼応するように漂う`;
        break;
      case 'STILL':
      default:
        actionEn = `${charName} holds poised, dramatic posture with gentle, lifelike micro-movements, breathing, and subtle hair strands drifting in the wind`;
        actionJa = `${charName}が静かに佇み、微かな呼吸と風に吹かれる髪の毛の揺れがリアルに描写される`;
        break;
    }

    // 3. Lighting & Atmosphere
    let lightEn = '';
    let lightJa = '';
    switch (direction.lighting_change) {
      case 'DARKEN':
        lightEn = 'Dramatic lighting adjustment: shadows deepen into moody cinematic contrast, enhancing the glowing magical rim light and dark atmospheric tone';
        lightJa = '陰影が深くドラマチックに落ち、輪郭の光（リムライト）が際立つダークで緊張感あるライティング';
        break;
      case 'BRIGHTEN':
        lightEn = 'Radiant cinematic illumination: soft environmental light blooms and specular highlights swell, creating an uplifting, luminous atmosphere';
        lightJa = '光量がふわっと増し、輝きとハイライトが空間全体を満たすエモーショナルなライティング';
        break;
      case 'PULSE':
        lightEn = 'Rhythmic atmospheric lighting pulse pulsating in sync with the musical beat, subtle luminescent flares throbbing in the background';
        lightJa = '音楽のビートに合わせて光が脈動し、背景の光芒がリズムを刻むライティング';
        break;
      case 'COLOR_SHIFT':
        lightEn = 'Subtle chromatic shift in ambient illumination, shifting color temperature to evoke musical tension and release';
        lightJa = '音楽の展開に合わせて空気感の色温度が滑らかに変化するカラーシフト';
        break;
      case 'HOLD':
      default:
        lightEn = 'Consistent atmospheric lighting holding steady exposure with natural ambient shadows and crystal specular reflections';
        lightJa = '安定したトーンを維持し、細部のディテールと光のきらめきを保つライティング';
        break;
    }

    // 4. Scale & Strategy Framing
    const scaleMap: Record<string, string> = {
      CLOSE: 'Close-up cinematic framing',
      MEDIUM: 'Medium cinematic shot framing with clear subject silhouette',
      WIDE: 'Wide cinematic establishing composition',
      EXTREME_WIDE: 'Epic extreme wide landscape vista framing',
    };
    const framingEn = scaleMap[direction.shot_scale] || 'Cinematic framing';

    // 5. Stage / Environment from Concept
    const stageEn = concept?.stageSettingEn
      ? `Setting: ${concept.stageSettingEn}.`
      : '';
    const stageJa = concept?.stageSetting
      ? `\n【舞台・世界観】${concept.stageSetting}`
      : '';

    // 6. Build Final English Motion Prompt (Optimized for Runway Gen-3, Kling, Wan2.1, Luma, Sora)
    const englishPrompt = `${framingEn}. ${cameraEn}. ${actionEn}. ${lightEn}. ${stageEn} 24fps high cinematic fidelity, realistic fluid cloth dynamics, photorealistic anime shading, masterpiece MV quality, perfectly continuous motion from initial frame, zero jitter.`;

    const japanesePrompt = `【構図】${direction.shot_scale}
【カメラ】${cameraJa}
【キャラクター動作】${actionJa}
【ライティング】${lightJa}${stageJa}
【動画生成用指示】24fps、映画的な滑らかな動き、衣服と髪のリアルな揺れ、手ブレ・破綻なし、第1フレームのキーフレームから連続して作画。`;

    const negativePrompt =
      'deformed anatomy, disfigured faces, extra limbs, morphing artifacts, jerky camera jumps, glitching textures, blurry noise, text, watermark, logo, subtitles, sudden jump cuts, frozen static frame, 3d rendering errors';

    return {
      englishPrompt,
      japanesePrompt,
      cameraPrompt: cameraEn,
      characterActionPrompt: actionEn,
      lightingPrompt: lightEn,
      negativePrompt,
      recommendedDurationSec: durationSec,
      recommendedFps: 24,
      motionScale: strategy === 'IMPACT_HOLD' || strategy === 'INTENSIFY' ? 0.8 : 0.5,
      targetModels: ['Runway Gen-3 Alpha', 'Kling AI (I2V)', 'Wan 2.1', 'Luma Dream Machine', 'OpenAI Sora', 'CogVideoX / ComfyUI'],
    };
  }
}

export const videoPromptCompiler = new VideoPromptCompiler();
