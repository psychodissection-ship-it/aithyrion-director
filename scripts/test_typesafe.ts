import fs from 'fs';
import path from 'path';

function loadEnv() {
  try {
    const content = fs.readFileSync(path.resolve(process.cwd(), '.env'), 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.substring(0, idx).trim();
        const val = trimmed.substring(idx + 1).trim();
        process.env[key] = val;
      }
    }
  } catch (e) {
    console.error('Failed to load .env', e);
  }
}

loadEnv();

async function testJev() {
  const endpoint = process.env.JEV_API_ENDPOINT || 'https://api.typesafe.ai/v1/systemone';
  const apiKey = process.env.JEV_API_KEY;
  console.log('Testing endpoint:', endpoint);
  console.log('API Key prefix:', apiKey ? apiKey.slice(0, 20) : 'none');

  const payload = {
    model: "jev-latest",
    state: {
      scene_context: "SaraLex Music Video",
      audio_energy: 0.88,
      section: "Chorus Drop",
      previous_shot: "Wide stage view"
    },
    questions: {
      action: {
        type: "choice",
        instructions: "What camera action should be taken for this music video cut?",
        criteria: {
          "INTENSIFY": "Rapid zoom in, Dutch angle, aggressive motion.",
          "RELEASE": "Wide shot, smooth backward drift, slow motion.",
          "HOLD": "Static intense close-up, lock on subject.",
          "PROLONG": "Gradual push in, continuous tracking shot."
        }
      },
      camera_movement: {
        type: "choice",
        instructions: "Select the best camera motion pattern.",
        criteria: {
          "PUSH_IN": "Forward dolly towards subject",
          "ORBIT": "Dynamic 360 rotation around characters",
          "CRANE_UP": "Vertical ascending perspective",
          "HANDHELD_SHAKE": "Raw energetic handheld camera"
        }
      }
    }
  };

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
      },
      body: JSON.stringify(payload)
    });
    console.log('Status:', res.status, res.statusText);
    const text = await res.text();
    console.log('Response body:', text);
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

testJev();
