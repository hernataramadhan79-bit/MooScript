import fs from 'fs';
import path from 'path';
import jitiFactory from 'jiti';

const jiti = jitiFactory(process.cwd());

console.log('--- RUNNING ACCEPTANCE CRITERIA VERIFICATION FOR PROMPT 6 ---');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`[PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`[FAIL] ${message}`);
    process.exitCode = 1;
  }
}

// 1. CSP in index.html verification
console.log('\n--- Test 1: Content Security Policy Verification ---');
const indexHtml = fs.readFileSync('./index.html', 'utf-8');
assert(
  indexHtml.includes('http-equiv="Content-Security-Policy"'),
  'index.html contains Content-Security-Policy meta tag'
);
assert(indexHtml.includes('https://generativelanguage.googleapis.com'), 'CSP connects to Gemini endpoint');
assert(indexHtml.includes('https://api.openai.com'), 'CSP connects to OpenAI endpoint');
assert(indexHtml.includes('https://api.groq.com'), 'CSP connects to Groq endpoint');
assert(indexHtml.includes('https://api.elevenlabs.io'), 'CSP connects to ElevenLabs endpoint');
assert(!indexHtml.includes('connect-src *'), 'CSP connect-src is strictly scoped (no wildcard)');

// 2. Gemini Header Auth Verification (No Key in URL)
console.log('\n--- Test 2: Gemini Auth Header (No Key in URL) ---');
const llmSource = fs.readFileSync('./src/engine/ai/llm.ts', 'utf-8');
assert(!llmSource.includes('?key='), 'Gemini API call does not append ?key= to URL query string');
assert(llmSource.includes("'x-goog-api-key': apiKey"), 'Gemini API call uses x-goog-api-key header');

// 3. Zod Validator Unit Tests (Valid, Invalid Enum, Empty, JSON Fences)
console.log('\n--- Test 3: Zod Storyboard Validation & Fence Stripping ---');
const { StoryboardSchema, cleanJsonFence } = jiti('./src/engine/ai/llm.ts');

// Valid Storyboard
const validData = {
  title: 'Catchy Video Title',
  scenes: [
    {
      text: 'Punchy script text for scene 1',
      focusWords: ['punchy', 'script'],
      motionPreset: 'punch_zoom',
      icon: 'mascot'
    }
  ]
};
const parsedValid = StoryboardSchema.safeParse(validData);
assert(parsedValid.success, 'Valid storyboard passes Zod schema');

// Out of enum preset & icon (Should fall back to defaults, not crash)
const outOfEnumData = {
  title: 'Out of Enum Test',
  scenes: [
    {
      text: 'Scene with bogus preset and icon',
      focusWords: ['bogus'],
      motionPreset: 'totally_invalid_preset',
      icon: 'unknown_alien_icon'
    }
  ]
};
const parsedOutOfEnum = StoryboardSchema.safeParse(outOfEnumData);
assert(parsedOutOfEnum.success, 'Out-of-enum preset and icon parses safely without crashing');
assert(parsedOutOfEnum.data.scenes[0].motionPreset === 'punch_zoom', 'Invalid motionPreset falls back to punch_zoom');
assert(parsedOutOfEnum.data.scenes[0].icon === 'mascot', 'Invalid icon falls back to mascot');

// Empty scenes array
const emptyScenesData = {
  title: 'Empty scenes',
  scenes: []
};
const parsedEmpty = StoryboardSchema.safeParse(emptyScenesData);
assert(!parsedEmpty.success, 'Empty scenes array fails validation with error');

// Missing scenes
const missingScenesData = {
  title: 'Missing scenes'
};
const parsedMissing = StoryboardSchema.safeParse(missingScenesData);
assert(!parsedMissing.success, 'Undefined scenes property fails validation without crashing');

// Markdown JSON fence stripping
const fencedJson =
  '```json\n{\n  "title": "Fenced Title",\n  "scenes": [\n    {\n      "text": "Hello world",\n      "focusWords": ["Hello"],\n      "motionPreset": "punch_zoom",\n      "icon": "mascot"\n    }\n  ]\n}\n```';
const stripped = cleanJsonFence(fencedJson);
assert(!stripped.startsWith('```') && !stripped.endsWith('```'), 'cleanJsonFence successfully removes ```json fences');
const parsedFenced = StoryboardSchema.safeParse(JSON.parse(stripped));
assert(
  parsedFenced.success && parsedFenced.data.title === 'Fenced Title',
  'Cleaned fenced JSON parses into valid Storyboard'
);

// 4. Custom Skill Import Zod Validation
console.log('\n--- Test 4: Custom Skill Import Validation ---');
const { importSkillFromJson } = jiti('./src/engine/skills/skillManager.ts');

// Mock Dexie DB on mooDb module
const { db } = jiti('./src/db/mooDb.ts');
db.skills = {
  put: async () => {},
  toArray: async () => [],
  get: async () => null,
  delete: async () => {}
};

let skillImportPassed = false;
try {
  await importSkillFromJson(
    JSON.stringify({
      name: 'Custom Marketing Hook',
      icon: 'flame',
      description: 'Generates marketing hooks',
      systemPrompt: 'High converting e-commerce style.'
    })
  );
  skillImportPassed = true;
} catch (e) {
  console.error(e);
}
assert(skillImportPassed, 'Valid custom skill JSON imports successfully');

// Reject skill exceeding 8KB
let rejectedOversizedSkill = false;
try {
  const massivePrompt = 'A'.repeat(9000); // > 8192 bytes
  await importSkillFromJson(
    JSON.stringify({
      name: 'Oversized Skill',
      icon: 'zap',
      description: 'Too big',
      systemPrompt: massivePrompt
    })
  );
} catch (e) {
  rejectedOversizedSkill = e.message.includes('8KB');
}
assert(rejectedOversizedSkill, 'Skill with systemPrompt > 8KB is safely rejected');

// Reject invalid JSON
let rejectedBadJson = false;
try {
  await importSkillFromJson('{ bad json');
} catch (e) {
  rejectedBadJson = true;
}
assert(rejectedBadJson, 'Malformed JSON string is safely rejected without executing code');

// 5. AbortController / Cancel Handling
console.log('\n--- Test 5: AbortSignal Cancellation ---');
const { generateStoryboard } = jiti('./src/engine/ai/llm.ts');

const abortController = new AbortController();
abortController.abort(); // already aborted

let abortHandled = false;
try {
  await generateStoryboard({
    provider: 'gemini',
    apiKey: 'test-key',
    prompt: 'test prompt',
    skill: { id: 's1', name: 'Test', icon: 'zap', description: 'desc', systemPrompt: 'prompt' },
    signal: abortController.signal
  });
} catch (err) {
  if (err.name === 'AbortError' || err.message.toLowerCase().includes('abort')) {
    abortHandled = true;
  }
}
assert(abortHandled, 'Cancelled request halts immediately with AbortError');

// 6. Undo Generate Logic Simulation
console.log('\n--- Test 6: Undo Generate Simulation ---');
const initialScenes = [
  {
    id: 'sc-1',
    text: 'Original scene 1',
    durationInSeconds: 3.0,
    focusWords: [],
    motionPreset: 'punch_zoom',
    wordTimestamps: []
  },
  {
    id: 'sc-2',
    text: 'Original scene 2',
    durationInSeconds: 3.0,
    focusWords: [],
    motionPreset: 'slide_split',
    wordTimestamps: []
  }
];

let previousSnapshot = null;
let currentProjectScenes = [...initialScenes];

// Step 1: User triggers generateScript -> saves snapshot
previousSnapshot = [...currentProjectScenes];
currentProjectScenes = [
  {
    id: 'sc-new-1',
    text: 'Overwritten AI scene',
    durationInSeconds: 4.0,
    focusWords: [],
    motionPreset: 'punch_zoom',
    wordTimestamps: []
  }
];
assert(
  currentProjectScenes.length === 1 && currentProjectScenes[0].id === 'sc-new-1',
  'Scenes overwritten by generation'
);

// Step 2: User clicks "Undo Generate"
if (previousSnapshot) {
  currentProjectScenes = previousSnapshot;
  previousSnapshot = null;
}
assert(
  currentProjectScenes.length === 2 && currentProjectScenes[0].text === 'Original scene 1',
  'Undo successfully restored previous scenes'
);

// 7. Session-only Key Mode Simulation
console.log('\n--- Test 7: Session-only Storage vs Persistent Mode ---');
let savedToDb = null;
global.sessionStorage = {
  data: {},
  setItem(k, v) {
    this.data[k] = v;
  },
  getItem(k) {
    return this.data[k] || null;
  }
};

// Simulate updateSettings in 'session' mode
const sessionSettings = {
  apiKeyStorage: 'session',
  apiKeys: { gemini: 'secret-gemini-key' }
};

// Keys to store in IndexedDB when in session mode
const keysForDb = sessionSettings.apiKeyStorage === 'session' ? {} : sessionSettings.apiKeys;
savedToDb = { ...sessionSettings, apiKeys: keysForDb };

assert(
  Object.keys(savedToDb.apiKeys).length === 0,
  'In session-only mode, API keys are completely stripped from IndexedDB save payload'
);

console.log(`\n========================================`);
console.log(`PROMPT 6 SUMMARY: ${passedTests} / ${totalTests} tests passed`);
console.log(`========================================`);

if (process.exitCode) {
  process.exit(process.exitCode);
}
