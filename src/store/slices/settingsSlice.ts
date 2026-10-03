import type { StateCreator } from 'zustand';
import type { EngineSettings } from '../../types';
import { db, getCacheSize, clearAllCache, loadProjectFromDb, listProjectsFromDb, saveProjectToDb } from '../../db/mooDb';
import { BUILTIN_SKILLS, getAllSkills, initializeSkills } from '../../engine/skills/skillManager';
import { DEFAULT_PROJECT_ID, INITIAL_PROJECT } from './projectSlice';
import type { MooStoreState, SettingsSlice } from '../types';

export const DEFAULT_SETTINGS: EngineSettings = {
  apiKeys: {
    gemini: '',
    openai: '',
    groq: '',
    elevenlabs: ''
  },
  apiKeyStorage: 'persistent',
  outputLanguage: 'id',
  selectedLLMProvider: 'gemini',
  selectedTTSProvider: 'fallback',
  geminiModel: 'gemini-2.5-flash',
  openaiModel: 'gpt-4o-mini',
  groqModel: 'llama-3.3-70b-versatile',
  voiceIds: {
    openai: 'alloy',
    elevenlabs: '21m00Tcm4TlvDq8ikWAM',
    local: 'id_ID-news_tts'
  },
  speed: 1.05,
  stability: 85,
  duckingDb: -12,
  fps: 30
};

export const createSettingsSlice: StateCreator<MooStoreState, [], [], SettingsSlice> = (set, get) => ({
  settings: DEFAULT_SETTINGS,

  updateSettings: async (newSettings) => {
    const merged = { ...get().settings, ...newSettings };
    set({ settings: merged });

    const isSession = merged.apiKeyStorage === 'session';
    const settingsToPersist = isSession ? { ...merged, apiKeys: {} } : merged;

    if (isSession && typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('mooscript_session_keys', JSON.stringify(merged.apiKeys));
    }
    await db.settings.put({ id: 'current', data: settingsToPersist });
  },

  updateApiKey: async (provider, key) => {
    const updatedKeys = { ...get().settings.apiKeys, [provider]: key };
    const merged = { ...get().settings, apiKeys: updatedKeys };
    set({ settings: merged });

    if (merged.apiKeyStorage === 'session') {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('mooscript_session_keys', JSON.stringify(updatedKeys));
      }
      await db.settings.put({ id: 'current', data: { ...merged, apiKeys: {} } });
    } else {
      await db.settings.put({ id: 'current', data: merged });
    }
  },

  skills: BUILTIN_SKILLS,
  activeSkillId: BUILTIN_SKILLS[0].id,
  setActiveSkillId: (activeSkillId) => set({ activeSkillId }),
  refreshSkills: async () => {
    const all = await getAllSkills();
    set({ skills: all });
  },

  cacheSizeBytes: 0,
  refreshCacheSize: async () => {
    const size = await getCacheSize();
    set({ cacheSizeBytes: size });
  },

  clearCache: async () => {
    await clearAllCache();
    await get().refreshCacheSize();
  },

  initStore: async () => {
    await initializeSkills();
    const skills = await getAllSkills();

    // Load persisted settings & migrate legacy voiceId if needed
    const storedSettings = await db.settings.get('current');
    let settings = DEFAULT_SETTINGS;
    if (storedSettings && storedSettings.data) {
      const raw = storedSettings.data as any;
      let voiceIds = { ...DEFAULT_SETTINGS.voiceIds };
      if (raw.voiceIds && typeof raw.voiceIds === 'object') {
        voiceIds = { ...voiceIds, ...raw.voiceIds };
      } else if (raw.voiceId && typeof raw.voiceId === 'string') {
        if (raw.selectedTTSProvider === 'elevenlabs') {
          voiceIds.elevenlabs = raw.voiceId;
        } else {
          voiceIds.openai = raw.voiceId;
        }
      }
      settings = {
        ...DEFAULT_SETTINGS,
        ...raw,
        voiceIds
      };

      // Sanitize obsolete / deprecated models from previous sessions
      if (settings.geminiModel && (settings.geminiModel.includes('gemini-1.0') || settings.geminiModel === 'gemini-pro')) {
        settings.geminiModel = 'gemini-2.5-flash';
      }
      if (settings.groqModel && (settings.groqModel === 'llama3-70b-8192' || settings.groqModel === 'llama3-8b-8192')) {
        settings.groqModel = 'llama-3.3-70b-versatile';
      }

      await db.settings.put({ id: 'current', data: settings });
    }

    // Restore session keys from sessionStorage if present
    if (typeof sessionStorage !== 'undefined') {
      try {
        const sessionKeysRaw = sessionStorage.getItem('mooscript_session_keys');
        if (sessionKeysRaw) {
          const sessionKeys = JSON.parse(sessionKeysRaw);
          settings = { ...settings, apiKeys: { ...settings.apiKeys, ...sessionKeys } };
        }
      } catch {
        // Ignore session parse error
      }
    }

    // Load all projects from DB
    let allProjects = await listProjectsFromDb();
    if (allProjects.length === 0) {
      await saveProjectToDb(INITIAL_PROJECT);
      allProjects = [INITIAL_PROJECT];
    }

    let activeId = DEFAULT_PROJECT_ID;
    try {
      if (typeof localStorage !== 'undefined') {
        const savedId = localStorage.getItem('mooscript_active_project_id');
        if (savedId && allProjects.some((p) => p.id === savedId)) {
          activeId = savedId;
        } else {
          activeId = allProjects[0].id;
        }
      }
    } catch {
      activeId = allProjects[0].id;
    }

    // Load active project record (including audioBlob if present)
    const storedProject = await loadProjectFromDb(activeId);
    let project = storedProject || allProjects[0] || INITIAL_PROJECT;

    // Migration: older persisted projects won't have captionStyle / captionPosition
    if (!project.theme.captionStyle || !project.theme.captionPosition) {
      project = {
        ...project,
        theme: {
          ...project.theme,
          captionStyle: project.theme.captionStyle || 'boxed',
          captionPosition: project.theme.captionPosition || 'center'
        }
      };
    }

    // Migration: older persisted projects won't have bgm
    if (!project.bgm) {
      project = {
        ...project,
        bgm: { preset: 'none', level: 0.18, duckRatio: 0.15 }
      };
    }

    let blobUrl: string | null = null;
    if (project.audioBlob) {
      blobUrl = URL.createObjectURL(project.audioBlob);
    }

    const cacheSize = await getCacheSize();

    set({
      skills,
      settings,
      project,
      projectsList: allProjects,
      audioBlobUrl: blobUrl,
      cacheSizeBytes: cacheSize,
      audioStale: false
    });
  }
});
