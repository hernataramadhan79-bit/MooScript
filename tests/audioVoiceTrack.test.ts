/**
 * The voice-over is kept apart from the background music, per project, so changing the music
 * never throws the narration away (not after a reload, not after switching projects).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as bgmMixerModule from '../src/engine/audio/bgmMixer';
import { db, saveProjectToDb, saveVoiceTrackToDb, loadVoiceTrackFromDb } from '../src/db/mooDb';
import { loadProjectVoice, NO_VOICE } from '../src/db/voiceTrack';
import { useMooStore } from '../src/store/useMooStore';
import type { MooProject } from '../src/types';

class MockAudioBuffer {
  sampleRate = 48000;
  numberOfChannels = 2;
  length: number;
  duration: number;
  constructor(_channels = 2, length = 48000 * 3, sampleRate = 48000) {
    this.length = length;
    this.sampleRate = sampleRate;
    this.duration = length / sampleRate;
  }
  getChannelData() {
    return new Float32Array(this.length);
  }
}

class MockAudioContext {
  decodeAudioData() {
    return Promise.resolve(new MockAudioBuffer());
  }
  close() {
    return Promise.resolve();
  }
}

class MockParam {
  setValueAtTime() {}
  linearRampToValueAtTime() {}
  exponentialRampToValueAtTime() {}
}

class MockOfflineAudioContext {
  destination = {};
  constructor(
    private channels: number,
    private len: number,
    private rate: number
  ) {}
  createBufferSource() {
    return { buffer: null, loop: false, connect() {}, start() {} };
  }
  createGain() {
    return { gain: new MockParam(), connect() {} };
  }
  createOscillator() {
    return { type: 'sine', frequency: new MockParam(), connect() {}, start() {}, stop() {} };
  }
  startRendering() {
    return Promise.resolve(new MockAudioBuffer(this.channels, this.len, this.rate));
  }
}

const project = (overrides: Partial<MooProject> = {}): MooProject => ({
  id: 'proj-voice-track',
  title: 'Voice Track',
  aspectRatio: '9:16',
  fps: 30,
  width: 1080,
  height: 1920,
  theme: {
    bg: '#09090b',
    textPrimary: '#ffffff',
    textHighlight: '#84cc16',
    fontFamily: 'Jakarta',
    captionStyle: 'boxed',
    captionPosition: 'center'
  },
  scenes: [
    {
      id: 'sc-1',
      narrationText: 'Satu dua tiga',
      durationInSeconds: 2,
      wordTimestamps: [{ word: 'Satu', start: 0, end: 0.6 }]
    }
  ],
  audioDuration: 2,
  bgm: { preset: 'none', level: 0.18, duckRatio: 0.15 },
  ...overrides
});

beforeEach(async () => {
  vi.restoreAllMocks();
  (globalThis as any).AudioContext = MockAudioContext;
  (globalThis as any).OfflineAudioContext = MockOfflineAudioContext;
  await db.voiceTracks.clear();
  await db.projects.clear();
  await db.audioBlobs.clear();
  useMooStore.setState({ toasts: [], audioStale: false, rawVoiceBlob: null, bgmOnlyAudio: false });
});

describe('loadProjectVoice', () => {
  it('has no voice when the project has no audio', async () => {
    expect(await loadProjectVoice(project())).toEqual(NO_VOICE);
  });

  it('returns the stored voice-over', async () => {
    const voice = new Blob(['voice'], { type: 'audio/wav' });
    await saveVoiceTrackToDb('proj-voice-track', { kind: 'voice', blob: voice });
    const result = await loadProjectVoice(project({ audioBlob: new Blob(['mix']) }));
    expect(result.rawVoiceBlob).toBeInstanceOf(Blob);
    expect(await result.rawVoiceBlob!.text()).toBe('voice');
    expect(result.bgmOnlyAudio).toBe(false);
  });

  it('knows a music-only track', async () => {
    await saveVoiceTrackToDb('proj-voice-track', { kind: 'bgm' });
    expect(await loadProjectVoice(project({ audioBlob: new Blob(['music']) }))).toEqual({
      rawVoiceBlob: null,
      bgmOnlyAudio: true
    });
  });

  it('treats older audio without music as the voice itself', async () => {
    const audio = new Blob(['voice']);
    const result = await loadProjectVoice(project({ audioBlob: audio }));
    expect(result.rawVoiceBlob).toBe(audio);
  });

  it('does not guess for older audio mixed with music', async () => {
    const result = await loadProjectVoice(
      project({ audioBlob: new Blob(['mix']), bgm: { preset: 'lofi', level: 0.2, duckRatio: 0.15 } })
    );
    expect(result).toEqual(NO_VOICE);
  });
});

describe('changing the music', () => {
  it('remixes a kept voice-over and stores the voice for the next session', async () => {
    const voice = new Blob(['voice'], { type: 'audio/wav' });
    useMooStore.setState({ project: project({ audioBlob: voice }), rawVoiceBlob: voice });

    await useMooStore.getState().updateBgmPreset('lofi');

    const state = useMooStore.getState();
    expect(state.project.bgm.preset).toBe('lofi');
    expect(state.project.audioBlob).not.toBe(voice);
    expect(state.rawVoiceBlob).toBe(voice);
    const stored = await loadVoiceTrackFromDb('proj-voice-track');
    expect(stored?.kind).toBe('voice');
  });

  it('never replaces an older mixed voice-over with music only', async () => {
    const mix = new Blob(['voice+music'], { type: 'audio/wav' });
    useMooStore.setState({
      project: project({ audioBlob: mix, bgm: { preset: 'lofi', level: 0.2, duckRatio: 0.15 } })
    });

    await useMooStore.getState().updateBgmPreset('ambient');

    const state = useMooStore.getState();
    expect(state.project.audioBlob).toBe(mix);
    expect(state.audioStale).toBe(true);
  });

  it('re-renders a music-only track and drops it when the music is switched off', async () => {
    const music = new Blob(['music'], { type: 'audio/wav' });
    useMooStore.setState({
      project: project({ audioBlob: music, bgm: { preset: 'lofi', level: 0.2, duckRatio: 0.15 } }),
      bgmOnlyAudio: true
    });

    await useMooStore.getState().updateBgmPreset('cinematic');
    expect(useMooStore.getState().project.audioBlob).not.toBe(music);
    expect(useMooStore.getState().bgmOnlyAudio).toBe(true);

    await useMooStore.getState().updateBgmPreset('none');
    const state = useMooStore.getState();
    expect(state.project.audioBlob).toBeUndefined();
    expect(state.bgmOnlyAudio).toBe(false);
    expect(await loadVoiceTrackFromDb('proj-voice-track')).toBeUndefined();
  });

  it('lets only the newest of overlapping remixes land', async () => {
    const voice = new Blob(['voice'], { type: 'audio/wav' });
    useMooStore.setState({
      project: project({ audioBlob: voice, bgm: { preset: 'lofi', level: 0.2, duckRatio: 0.15 } }),
      rawVoiceBlob: voice
    });
    const slow = new Blob(['slow mix']);
    const fast = new Blob(['fast mix']);
    let releaseSlow: () => void = () => {};
    vi.spyOn(bgmMixerModule, 'mixVoiceAndBgm')
      .mockImplementationOnce(() => new Promise((resolve) => (releaseSlow = () => resolve(slow))))
      .mockImplementationOnce(() => Promise.resolve(fast));

    const first = useMooStore.getState().updateBgmLevel(0.3);
    const second = useMooStore.getState().updateBgmLevel(0.6);
    await second;
    releaseSlow();
    await first;

    expect(useMooStore.getState().project.audioBlob).toBe(fast);
    expect(useMooStore.getState().project.bgm.level).toBe(0.6);
  });
});

describe('switching projects', () => {
  it('loads the voice of the opened project and drops editor state of the old one', async () => {
    const voice = new Blob(['voice of B'], { type: 'audio/wav' });
    const target = project({
      id: 'proj-b',
      title: 'B',
      audioBlob: new Blob(['mix of B']),
      bgm: { preset: 'lofi', level: 0.2, duckRatio: 0.15 }
    });
    await saveProjectToDb(target);
    await saveVoiceTrackToDb('proj-b', { kind: 'voice', blob: voice });

    useMooStore.setState({
      project: project({ id: 'proj-a', audioBlob: new Blob(['voice of A']) }),
      rawVoiceBlob: new Blob(['voice of A']),
      waveformPeaks: [0.2, 0.4],
      selectedLayerId: 'hero'
    });

    await useMooStore.getState().switchProject('proj-b');

    const state = useMooStore.getState();
    expect(state.project.id).toBe('proj-b');
    expect(await state.rawVoiceBlob!.text()).toBe('voice of B');
    expect(state.waveformPeaks).toBeNull();
    expect(state.selectedLayerId).toBeNull();
  });
});
