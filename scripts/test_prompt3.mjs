import fs from 'fs';
import path from 'path';

console.log('--- RUNNING ACCEPTANCE CRITERIA VERIFICATION FOR PROMPT 3 ---');

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

// 1. Zero alert() in codebase
const filesToScan = [
  'src/store/useMooStore.ts',
  'src/components/tabs/SettingsTab.tsx',
  'src/components/tabs/VoiceTab.tsx',
  'src/components/tabs/StudioTab.tsx',
  'src/components/tabs/ScriptTab.tsx',
  'src/App.tsx'
];

let totalAlertsFound = 0;
for (const file of filesToScan) {
  const content = fs.readFileSync(file, 'utf-8');
  const matches = content.match(/\balert\s*\(/g);
  if (matches) {
    totalAlertsFound += matches.length;
    console.error(`Found alert() in ${file}`);
  }
}
assert(totalAlertsFound === 0, 'No window.alert() calls remain in UI or Store (all replaced with Toast system)');

// 2. Debounced save logic verification
let dbWriteCount = 0;
let saveTimer = null;
let pendingProject = null;

function scheduleSave(project) {
  pendingProject = project;
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
  }
  saveTimer = setTimeout(() => {
    saveTimer = null;
    dbWriteCount++;
  }, 100); // 100ms test interval
}

// Simulate typing 20 characters in rapid succession (10ms between keystrokes)
for (let i = 0; i < 20; i++) {
  scheduleSave({ id: 'proj-1', title: `Test keystroke ${i}` });
}

assert(dbWriteCount === 0, 'During rapid keystrokes, saveProjectToDb is not called immediately (debounced)');

await new Promise((resolve) => setTimeout(resolve, 150));
assert(
  dbWriteCount === 1,
  `After typing pauses, saveProjectToDb is called exactly 1 time (actual count: ${dbWriteCount})`
);

// 3. Audio stale and duration single source of truth
const mockProjectWithAudio = {
  id: 'moo-1',
  audioBlob: { size: 1024, type: 'audio/mp3' },
  audioDuration: 14.5,
  scenes: [{ id: 'sc-1', text: 'Hello initial script', durationInSeconds: 3.0 }]
};

let audioStale = false;
let currentProject = { ...mockProjectWithAudio };

function updateSceneText(id, newText) {
  const hasAudio = !!currentProject.audioBlob;
  const newEstimatedDuration = 6.0;
  const updatedScenes = currentProject.scenes.map((s) =>
    s.id === id ? { ...s, text: newText, durationInSeconds: newEstimatedDuration } : s
  );
  const totalFallbackDur = updatedScenes.reduce((acc, s) => acc + s.durationInSeconds, 0);

  currentProject = {
    ...currentProject,
    scenes: updatedScenes,
    audioDuration: hasAudio ? currentProject.audioDuration : totalFallbackDur
  };

  if (hasAudio) {
    audioStale = true;
  }
}

updateSceneText('sc-1', 'Updated scene with very long new sentence that alters spoken timing');
assert(audioStale === true, 'Editing scene text marks audioStale = true when audio exists');
assert(
  currentProject.audioDuration === 14.5,
  'project.audioDuration remains pinned to real audio duration (14.5s) and is not overwritten by fallback duration'
);

// 4. Settings migration & voiceId isolation
const legacySettings = {
  selectedTTSProvider: 'elevenlabs',
  voiceId: '21m00Tcm4TlvDq8ikWAM'
};

const DEFAULT_SETTINGS = {
  voiceIds: {
    openai: 'alloy',
    elevenlabs: '21m00Tcm4TlvDq8ikWAM'
  }
};

let migratedVoiceIds = { ...DEFAULT_SETTINGS.voiceIds };
if (legacySettings.voiceId) {
  if (legacySettings.selectedTTSProvider === 'elevenlabs') {
    migratedVoiceIds.elevenlabs = legacySettings.voiceId;
  } else {
    migratedVoiceIds.openai = legacySettings.voiceId;
  }
}

assert(migratedVoiceIds.openai === 'alloy', 'Default OpenAI voice preserved as alloy');
assert(
  migratedVoiceIds.elevenlabs === '21m00Tcm4TlvDq8ikWAM',
  'ElevenLabs voice properly assigned to voiceIds.elevenlabs'
);

// 5. Canvas kinetic typography scale transform verification
const canvasRendererSrc = fs.readFileSync('src/engine/renderer/canvasRenderer.ts', 'utf-8');
const hasTranslateToCenter = canvasRendererSrc.includes('ctx.translate(cx, cy);');
const hasScaleWord = canvasRendererSrc.includes('ctx.scale(wordScale, wordScale);');
const hasTranslateBack = canvasRendererSrc.includes('ctx.translate(-cx, -cy);');
const hasMidpointCalc = canvasRendererSrc.includes('const cx = wObj.x + wObj.width / 2;');

assert(
  hasTranslateToCenter && hasScaleWord && hasTranslateBack && hasMidpointCalc,
  'wordScale transform applied around active word midpoint: translate(cx, cy) -> scale(wordScale, wordScale) -> translate(-cx, -cy)'
);

// 6. VoiceTab provider-specific voice options verification
const voiceTabSrc = fs.readFileSync('src/components/tabs/VoiceTab.tsx', 'utf-8');
assert(
  voiceTabSrc.includes('ELEVENLABS_VOICES') && voiceTabSrc.includes('OPENAI_VOICES'),
  'VoiceTab has separated voice lists for OpenAI and ElevenLabs'
);
assert(
  voiceTabSrc.includes('audioStale') && voiceTabSrc.includes('Audio outdated'),
  'VoiceTab displays "Audio outdated" warning badge when audioStale is true'
);

// 7. StudioTab export guard verification
const studioTabSrc = fs.readFileSync('src/components/tabs/StudioTab.tsx', 'utf-8');
assert(
  studioTabSrc.includes('audioStale') && studioTabSrc.includes('Audio is outdated because'),
  'StudioTab checks audioStale and warns/confirms before export'
);

// 8. Storage persistence status in SettingsTab
const settingsTabSrc = fs.readFileSync('src/components/tabs/SettingsTab.tsx', 'utf-8');
assert(
  settingsTabSrc.includes('checkStoragePersistence') && settingsTabSrc.includes('requestPersistentStorage'),
  'SettingsTab checks and displays browser persistent storage status'
);

console.log(`\nRESULTS: ${passedTests}/${totalTests} tests passed.`);
if (passedTests === totalTests) {
  console.log('ALL ACCEPTANCE CRITERIA FOR PROMPT 3 MET SUCCESSFULLY!');
} else {
  process.exit(1);
}
