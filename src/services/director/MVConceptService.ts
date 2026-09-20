import { CharacterProfile } from '../../types/codexBridge';

export interface MVStoryArc {
  intro: string;
  build: string;
  climax: string;
  outro: string;
}

export interface MVConcept {
  id: string;
  title: string;
  englishTitle: string;
  genre: string;
  stageSetting: string;
  stageSettingEn: string;
  colorPalette: string[];
  moodTone: string;
  moodToneEn: string;
  storyArc: MVStoryArc;
  visualKeywords: string[];
  recommendedModelSettings: {
    motionScale: number;
    recommendedFps: number;
  };
}

export interface MVAnalysisResult {
  trackSummary: {
    title: string;
    bpm: number;
    durationSec: number;
    tempoCategory: 'SLOW' | 'MID' | 'UPBEAT' | 'HIGH_OCTANE';
    energyProfile: string;
    dropTimeSec?: number;
  };
  characterSummary: {
    name: string;
    archetype: string;
    identityRef?: string;
    visualTraits: string;
  };
  concepts: MVConcept[];
  defaultConceptId: string;
}

export class MVConceptService {
  /**
   * Analyzes acoustic metrics and character visual traits to generate 3 distinct MV concepts
   */
  analyzeAndGenerateConcepts(params: {
    trackTitle: string;
    bpm: number;
    duration: number;
    character?: CharacterProfile | null;
  }): MVAnalysisResult {
    const { trackTitle, bpm, duration, character } = params;
    const charName = character?.name || 'Lexia';
    const isSara = charName.toLowerCase().includes('sara');
    const isAmber = charName.toLowerCase().includes('amber');

    // 1. Analyze tempo and acoustic profile
    let tempoCategory: 'SLOW' | 'MID' | 'UPBEAT' | 'HIGH_OCTANE' = 'MID';
    let energyProfile = 'Balanced melodic progression with emotional swelling';
    if (bpm >= 150) {
      tempoCategory = 'HIGH_OCTANE';
      energyProfile = 'Aggressive, fast-paced rhythm with frequent explosive peaks';
    } else if (bpm >= 120) {
      tempoCategory = 'UPBEAT';
      energyProfile = 'Driving dance/trance groove with clear build-ups and high-energy drop';
    } else if (bpm <= 90) {
      tempoCategory = 'SLOW';
      energyProfile = 'Contemplative, ambient, and highly emotive with gradual crescendos';
    }

    // 2. Character Archetype Inference
    let archetype = 'Celestial Goddess / Sacred Judge';
    let visualTraits = 'White ceremonial gown, golden halo, scales of justice, luminous purple hair';
    if (isSara) {
      archetype = 'Spiritual Maiden / Guardian of Light';
      visualTraits = 'Radiant crimson & gold attire, ethereal wings, warm sunlight aura';
    } else if (isAmber) {
      archetype = 'Tactical Cyber Agent';
      visualTraits = 'High-tech combat visor, neon circuitry hoodie, urban survivalist gear';
    } else if (character?.description) {
      visualTraits = character.description;
    }

    // 3. Synthesize 3 Curated MV Concepts
    const concepts: MVConcept[] = [
      {
        id: 'sacred-sanctuary',
        title: '神聖ファンタジー・覚醒の聖域',
        englishTitle: 'Sacred Sanctuary & Celestial Awakening',
        genre: 'Sacred / Gothic Fantasy',
        stageSetting:
          '月光とステンドグラスが輝く荘厳な大聖堂、浮遊する紫の蝶、天秤のモニュメント、舞い散る光の粒子',
        stageSettingEn:
          'A majestic illuminated moonlit cathedral with stained-glass rose windows, floating crystalline scales of justice, drifting radiant violet butterflies, and holy sparkling dust',
        colorPalette: ['#8b5cf6', '#d946ef', '#f59e0b', '#ffffff', '#0f172a'],
        moodTone: '荘厳、神秘的、運命的なドラマ性',
        moodToneEn: 'Sacred, mysterious, highly emotional and epic',
        storyArc: {
          intro: '静寂の大聖堂にて、孤独な祈りと運命の始まり',
          build: 'メロディの加速とともに大聖堂の光芒が強まり、覚醒の予兆',
          climax: 'サビ（ドロップ）で光の翼が解放され、大聖堂全体が神聖な光彩に包まれる最大の見せ場',
          outro: '役目を果たした瞳が静かに閉じ、穏やかな光の粒子へと帰還する余韻',
        },
        visualKeywords: ['大聖堂', 'ステンドグラス', '光の粒子', '天秤', '神聖な翼', '紫の蝶'],
        recommendedModelSettings: {
          motionScale: 0.6,
          recommendedFps: 24,
        },
      },
      {
        id: 'cyber-noir',
        title: '近未来サイバー・ネオンパルス',
        englishTitle: 'Cyber Neon Horizon & Urban Pulse',
        genre: 'Cyberpunk / Urban Noir',
        stageSetting:
          '雨に濡れた巨大摩天楼の最上階テラス、紫とシアンのホログラムネオン、眼下に広がるメガロポリス夜景',
        stageSettingEn:
          'High-altitude wet skyscraper rooftop overlooking a sprawling futuristic megalopolis, reflective glass surfaces, vibrant violet and cyan neon holograms, cinematic volumetric rain streaks',
        colorPalette: ['#06b6d4', '#8b5cf6', '#3b82f6', '#ec4899', '#030712'],
        moodTone: '疾走感、スタイリッシュ、退廃的な美',
        moodToneEn: 'High-speed, cybernetic, stylish and atmospheric noir',
        storyArc: {
          intro: '夜の摩天楼を見下ろす孤独なシルエットと雨の滴',
          build: 'ビル群のホログラムがビートに呼応して点滅し、緊張が高まる',
          climax: 'サビの瞬間、光のパルスが都市全体へ走り抜け、ダイナミックなカメラ急上昇',
          outro: '夜明けの蒼い光が街を照らし、次の夜へ向けた静寂のフェードアウト',
        },
        visualKeywords: ['摩天楼', 'ネオン', 'ホログラム', '夜景', '反射する雨', '高速カメラ'],
        recommendedModelSettings: {
          motionScale: 0.8,
          recommendedFps: 24,
        },
      },
      {
        id: 'astral-void',
        title: '星辰の深淵・コズミックレゾナンス',
        englishTitle: 'Astral Void & Cosmic Resonance',
        genre: 'Ethereal / Cosmic Fantasy',
        stageSetting:
          '果てしない水鏡に満天の星雲とオーロラが映り込む無重力の宇宙空間、浮遊するクリスタル結晶',
        stageSettingEn:
          'An infinite reflective water-mirror plane under a vivid cosmic nebula and glowing ethereal auroras, floating zero-gravity crystals and celestial constellations',
        colorPalette: ['#6366f1', '#a855f7', '#0ea5e9', '#f43f5e', '#020617'],
        moodTone: '浮遊感、幻想的、超越的なエモーショナル',
        moodToneEn: 'Weightless, surreal, transcendent and emotionally luminous',
        storyArc: {
          intro: '水鏡の上にひとり佇み、星の光が足元から静かに波紋を広げる',
          build: '重力が失われ、周囲のクリスタルが旋回しながら光を増していく',
          climax: 'サビの衝撃で星雲が超新星のように眩く広がり、宙を舞うダイナミックな跳躍',
          outro: '星々の瞬きとともにゆっくりと足が着地し、静かな水面へ戻る',
        },
        visualKeywords: ['水鏡', '星雲', '無重力', 'オーロラ', 'クリスタル', '神秘的波紋'],
        recommendedModelSettings: {
          motionScale: 0.5,
          recommendedFps: 24,
        },
      },
    ];

    return {
      trackSummary: {
        title: trackTitle,
        bpm,
        durationSec: duration,
        tempoCategory,
        energyProfile,
        dropTimeSec: duration > 20 ? 20.2 : +(duration * 0.6).toFixed(2),
      },
      characterSummary: {
        name: charName,
        archetype,
        identityRef: character?.identity_reference,
        visualTraits,
      },
      concepts,
      defaultConceptId: 'sacred-sanctuary',
    };
  }
}

export const mvConceptService = new MVConceptService();
