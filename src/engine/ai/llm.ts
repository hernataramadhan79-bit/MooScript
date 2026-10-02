import type { Scene, MotionPreset, PersonaSkill, LLMProvider } from '../../types';

export interface GeneratedStoryboard {
  title: string;
  scenes: {
    text: string;
    focusWords: string[];
    motionPreset: MotionPreset;
    icon: string;
  }[];
}

const IMMUTABLE_ENGINE_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING", description: "Short catchy video title" },
    scenes: {
      type: "ARRAY",
      description: "List of 3 to 6 concise storyboard scenes for a 15-30s short video",
      items: {
        type: "OBJECT",
        properties: {
          text: { type: "STRING", description: "Punchy spoken script text for this scene (10-25 words max)" },
          focusWords: {
            type: "ARRAY",
            items: { type: "STRING" },
            description: "1-3 high-impact keyframe words to emphasize visually"
          },
          motionPreset: {
            type: "STRING",
            enum: ["punch_zoom", "slide_split", "fade_float", "kinetic_shake"],
            description: "Motion preset best fitting this scene's tone"
          },
          icon: {
            type: "STRING",
            enum: ["mascot", "zap", "brain", "sparkles", "flame", "code"],
            description: "Icon identifier matching the concept"
          }
        },
        required: ["text", "focusWords", "motionPreset", "icon"]
      }
    }
  },
  required: ["title", "scenes"]
};

export async function generateStoryboard(params: {
  provider: LLMProvider;
  apiKey: string;
  model?: string;
  prompt: string;
  skill: PersonaSkill;
}): Promise<GeneratedStoryboard> {
  const { provider, apiKey, prompt, skill } = params;

  if (!apiKey || apiKey.trim() === '') {
    throw new Error(`API Key for ${provider.toUpperCase()} is missing. Please configure it in the BYOK Settings tab.`);
  }

  const systemPrompt = `You are MooScript Engine's Motion Graphics Storyboard Director.
Persona Style: "${skill.name}"
Persona Guidelines: ${skill.systemPrompt}

Goal: Transform user's idea or script into high-energy, mobile-first motion graphic scenes.
Format: Return strictly valid JSON conforming to the schema.
Keep each scene concise (10 to 25 words). Select 1 to 3 punchy focus words per scene.
Available motion presets: punch_zoom, slide_split, fade_float, kinetic_shake.
Available icons: mascot, zap, brain, sparkles, flame, code.`;

  if (provider === 'gemini') {
    return generateWithGemini(apiKey, params.model || 'gemini-2.0-flash', systemPrompt, prompt);
  } else if (provider === 'openai') {
    return generateWithOpenAI(apiKey, params.model || 'gpt-4o-mini', systemPrompt, prompt);
  } else if (provider === 'groq') {
    return generateWithGroq(apiKey, params.model || 'llama-3.3-70b-versatile', systemPrompt, prompt);
  }

  throw new Error(`Unsupported LLM provider: ${provider}`);
}

async function generateWithGemini(apiKey: string, model: string, systemPrompt: string, userPrompt: string): Promise<GeneratedStoryboard> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const payload = {
    contents: [
      {
        role: "user",
        parts: [{ text: `${systemPrompt}\n\nUser Script / Concept:\n${userPrompt}` }]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: IMMUTABLE_ENGINE_SCHEMA,
      temperature: 0.7
    }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textContent) {
    throw new Error('Gemini returned an empty response.');
  }

  return JSON.parse(textContent) as GeneratedStoryboard;
}

async function generateWithOpenAI(apiKey: string, model: string, systemPrompt: string, userPrompt: string): Promise<GeneratedStoryboard> {
  const url = `https://api.openai.com/v1/chat/completions`;

  const payload = {
    model: model || 'gpt-4o-mini',
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `User Script / Concept:\n${userPrompt}` }
    ],
    response_format: { type: "json_object" },
    temperature: 0.7
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`OpenAI API error (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const textContent = data.choices?.[0]?.message?.content;
  if (!textContent) {
    throw new Error('OpenAI returned an empty response.');
  }

  return JSON.parse(textContent) as GeneratedStoryboard;
}

async function generateWithGroq(apiKey: string, model: string, systemPrompt: string, userPrompt: string): Promise<GeneratedStoryboard> {
  const url = `https://api.groq.com/openai/v1/chat/completions`;

  const payload = {
    model: model || 'llama-3.3-70b-versatile',
    messages: [
      { role: "system", content: `${systemPrompt}\nProvide response strictly in valid JSON matching schema: {"title": string, "scenes": [{"text": string, "focusWords": string[], "motionPreset": "punch_zoom"|"slide_split"|"fade_float"|"kinetic_shake", "icon": string}]}` },
      { role: "user", content: `User Script / Concept:\n${userPrompt}` }
    ],
    response_format: { type: "json_object" },
    temperature: 0.7
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Groq API error (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const textContent = data.choices?.[0]?.message?.content;
  if (!textContent) {
    throw new Error('Groq returned an empty response.');
  }

  return JSON.parse(textContent) as GeneratedStoryboard;
}
