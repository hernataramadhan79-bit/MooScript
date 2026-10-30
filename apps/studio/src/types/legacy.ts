/**
 * LEGACY TYPES — migration / backwards-compatibility only.
 *
 * These describe the pre-"generative mograph" project format in which every
 * scene was bound to one of five hard-coded layouts. They MUST NOT be used by
 * any generation, storyboard, sync or editing code path. The only consumers
 * are:
 *   - `engine/composition/migrate.ts`   (one-shot conversion on load/import)
 *   - `engine/legacy/*`                 (the frozen template builder used by migration)
 *   - `engine/renderer/canvasRenderer`  (frozen legacy canvas path for un-migrated projects)
 */

export type LegacyLayoutType =
  | 'KINETIC_QUOTE'
  | 'METRIC_COUNTER'
  | 'TERMINAL_MOCKUP'
  | 'VS_COMPARISON'
  | 'LIST_STAGGER';

export interface LegacyVisualData {
  title?: string;
  metricValue?: string;
  metricLabel?: string;
  codeSnippet?: string;
  codeLanguage?: string;
  leftTitle?: string;
  leftDesc?: string;
  rightTitle?: string;
  rightDesc?: string;
  bulletItems?: string[];
  accentIcon?: string;
  focusWords?: string[];
}
