# Project: MooScript Studio Redesign & Modernization

## Architecture
- **Framework & Tooling**: React 18, TypeScript, Vite, Tailwind CSS v3, Zustand store, Dexie (IndexedDB), Vitest, ESLint.
- **Desktop Workstation (3-Zone)**:
  - **Zone 1 (Left)**: Storyboard / `SceneDeck` (`w-[340px] xl:w-[380px]`, permanent on `lg:flex`).
  - **Zone 2 (Center)**: Stage (`CompositionStage` iframe renderer & Theater Mode overlay) + Master Timeline (`TimelineBar`).
  - **Zone 3 (Right)**: Contextual Inspector Rack (`InspectorRack` with 4 pure tabs: Mograph, Gaya & Layer, Audio, Ekspor).
- **Mobile Ergonomics**:
  - Single bottom navigation bar: `[Naskah, Mograph, Gaya, Audio, Ekspor]`.
  - Drawer content dynamically switches between `SceneDeck` (for Naskah) and `InspectorRack` (for Mograph, Gaya, Audio, Ekspor) with internal tab bar hidden.
  - Mobile scrubber touch target enlarged to >=44px with `touch-action: none`.
- **Engine Safety**:
  - `src/engine/renderer/canvasRenderer.ts` is strictly protected (relied upon by MP4 exporter, Web Worker, and 26 unit tests).
  - Utility helpers `safeFileName` and `triggerFileDownload` decoupled to `src/utils/fileUtils.ts`.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | R1 Tailwind Token Repair | Add DEFAULT, hover, muted to accent; add on-accent, text-muted, text-faint to colors | M1 | survey_1 |
| 2 | R1 CSS Bundle Verification | Ensure .bg-accent, .text-accent, .text-on-accent, .text-text-muted, .border-accent, .ring-accent in bundle | M1 | survey_1 |
| 3 | R2 File Utility Extraction | Extract safeFileName and triggerFileDownload to src/utils/fileUtils.ts | M1 | survey_2 |
| 4 | R2 Test Import Path Update | Re-point tests/exportSliceAndStandalone.test.ts to src/utils/fileUtils.ts | M1 | survey_2 |
| 5 | R2 Safe Orphan Deletion | Safely delete 8 orphaned files (~3,148 lines) with 0 active imports | M1 | survey_2 |
| 6 | R2 Dead State Pruning | Remove deckTab and setDeckTab from types.ts and uiSlice.ts | M1 | survey_2 |
| 7 | R2 canvasRenderer Protection | Strictly preserve src/engine/renderer/canvasRenderer.ts | M1 | survey_2 |
| 8 | R3 Unused Identifiers Cleanup | Remove unused 'project' in App.tsx and 'onNavigateToMograph' in SceneDeck.tsx | M1 | survey_2 |
| 9 | R3 Zero-Warning Lint Gate | Ensure npm run lint -- --max-warnings 0 exits with code 0 | M1 | survey_2 |
| 10 | R4 Desktop 3-Zone Layout | Restore SceneDeck as permanent Zone 1 on desktop (hidden lg:flex) | M2 | survey_3 |
| 11 | R4 Inspector 4-Tab Restructure | Restructure InspectorRack to Mograph, Gaya & Layer, Audio, Ekspor; remove Ide tab | M2 | survey_3 |
| 12 | R4 Bi-Directional Scene Sync | Timeline scrub updates activeSceneId and scrolls card; card click seeks timeline to scene start | M2 | survey_3 |
| 13 | R5 Mobile Single Unified Drawer | Hide internal tab bar in InspectorRack on mobile; bottom nav as single controller | M3 | survey_3 |
| 14 | R5 Mobile Scrubber Target | Enlarge mobile scrubber touch target to min-height 44px with touch-action: none | M3 | survey_3 |
| 15 | R6 Fullscreen Theater Mode | Fullscreen overlay when previewMode === 'theater', close button, and Escape key listener | M3 | survey_3 |
| 16 | R6 Dexie Project Renaming | Add renameProject(id, newTitle) in projectSlice.ts; wire into ProjectManagerModal for all projects | M3 | survey_3 |
| 17 | R6 Vocal Character Selector | Complete vocal selector for OpenAI, ElevenLabs (+ Custom Voice ID), Local; rate slider & audition | M3 | survey_3 |
| 18 | R6 Export HUD & Watermark | Add watermark and HUD checkboxes in Ekspor tab passed to startExport | M3 | survey_3 |
| 19 | R7 Em Dash Character Elimination | Replace em dash ('—') in UI strings with ':' or clean separators | M4 | survey_1 |
| 20 | R7 Status Badge Pulse Removal | Remove infinite animate-pulse from IconButton.tsx:44 status badge | M4 | survey_1 |
| 21 | R7 Glassmorphism Reduction | Limit backdrop-blur to max 1-2 active elements; eliminate redundant nested blurs | M4 | survey_1 |
| 22 | R7 SceneDeck Empty State | Add empty state card with CTA '+ Tambah Adegan Pertama' when scenes.length === 0 | M4 | survey_1 |
| 23 | R7 Modal Escape Key Listeners | Add Escape key event listeners to SettingsDrawer.tsx and ProjectManagerModal.tsx | M4 | survey_1 |
| 24 | R7 Accessibility Focus-Visible | Enforce visible keyboard focus rings (:focus-visible) on buttons and form inputs | M4 | survey_1 |
| 25 | All 273+ Unit Tests Passing | All 26 test suites passing with 0 failures | M5 | survey_2 |
| 26 | Final Forensic Audit & Verification | Verify complete implementation authenticity without dummy shims or shortcuts | M5 | survey_all |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Foundations, Tokens, Dead Code & Lint Gate | Features 1-9 (R1, R2, R3) | none | DONE |
| M2 | Desktop 3-Zone Workstation & Scene Synchronization | Features 10-12 (R4) | M1 | DONE |
| M3 | Mobile Ergonomics, Controls Recovery & Dexie | Features 13-18 (R5, R6) | M2 | DONE |
| M4 | Antislop-UI Standards & Accessibility Compliance | Features 19-24 (R7) | M3 | PLANNED |
| M5 | Final Verification, Hardening & Forensic Audit | Features 25-26 | M4 | PLANNED |

## Interface Contracts
### `src/utils/fileUtils.ts` ↔ `tests/exportSliceAndStandalone.test.ts` & `InspectorRack.tsx`
```typescript
export function safeFileName(title?: string): string;
export function triggerFileDownload(url: string, filename: string): void;
```

### `src/store/slices/projectSlice.ts` ↔ `ProjectManagerModal.tsx`
```typescript
renameProject: (id: string, newTitle: string) => Promise<void>;
```

### `TimelineBar.tsx` ↔ `SceneDeck.tsx` (Scene Sync)
- `TimelineBar`: Playhead changes -> triggers `setActiveSceneId(activeBoundary.id)`
- `SceneDeck`: Card click -> computes cumulative start time -> calls `seekFrame(startSec * fps)` & `setActiveSceneId(scene.id)`
- `SceneDeck`: `useEffect([activeSceneId])` -> calls `cardRefs.current[activeSceneId]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })`

## Code Layout
- `tailwind.config.js`: Token definitions (`accent.DEFAULT`, `accent.hover`, `accent.muted`, `on-accent`, `text-muted`, `text-faint`) + safelist
- `src/utils/fileUtils.ts`: Decoupled file naming and download utilities
- `src/App.tsx`: 3-Zone layout container (Zone 1: SceneDeck, Zone 2: Stage+Timeline, Zone 3: InspectorRack), mobile navigation controller
- `src/components/studio/SceneDeck.tsx`: Zone 1 storyboard list, scene seeking, scrollIntoView, empty state
- `src/components/studio/InspectorRack.tsx`: Zone 3 inspector (4 contextual tabs: Mograph, Gaya, Audio, Ekspor)
- `src/components/studio/TimelineBar.tsx`: Timeline scrubbing, scene boundary sync, 44px mobile touch target
- `src/components/studio/CompositionStage.tsx`: Stage renderer + Theater Mode fullscreen overlay
- `src/store/slices/projectSlice.ts`: Project management and Dexie persistence (`renameProject`)
- `src/components/ProjectManagerModal.tsx`: Project manager modal with rename support on all projects and Escape key handler
- `src/components/SettingsDrawer.tsx`: Settings drawer with Escape key handler
- `src/components/ui/IconButton.tsx`: Clean status badge without infinite pulse
- `src/engine/renderer/canvasRenderer.ts`: PRESERVED ENGINE (DO NOT DELETE OR ALTER)
