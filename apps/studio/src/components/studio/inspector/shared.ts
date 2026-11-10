import type { ProceduralArchetype } from '../../../engine/composition/proceduralCompiler';

/**
 * State the inspector keeps for its tabs. Only the open tab is mounted, so anything that must outlive
 * a tab switch (a half-typed revision, a voice download in progress) lives in the rack instead.
 */
export interface InspectorShared {
  revisionPrompt: string;
  setRevisionPrompt: (value: string) => void;
  selectedArchetype: ProceduralArchetype;
  setSelectedArchetype: (value: ProceduralArchetype) => void;
  isDownloadingLocalVoice: boolean;
  setIsDownloadingLocalVoice: (value: boolean) => void;
  localVoiceDownloadProgress: number;
  setLocalVoiceDownloadProgress: (value: number) => void;
}
