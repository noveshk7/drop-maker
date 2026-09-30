# DROP//MAP Studio — Living Spec

## Product
DROP//MAP is a browser-local esports drop-map creator with a shared SVG scene for interactive editing and high-resolution image export. Public preview: https://map-placement-pro.preview.emergentagent.com

## Persistence
Workspace version 2 uses IndexedDB database `drop-map-studio`, object store `workspace`, key `current`. It migrates existing `drop-map-creator-store-v1` localStorage data without deleting the original. Empty libraries remain empty after refresh. Saves show Saving / Saved locally / Save failed, and failure warns before closing. No account, cloud storage, or external integration. Browser storage is not cross-device storage; downloadable self-contained project files provide backups. Original map uploads are kept uncompressed at their decoded natural dimensions. Image input: PNG/JPEG/WEBP, up to 50MB and 16384px per dimension. Demo is an illustrated Bermuda-inspired practice map, explicitly not an official game asset.

## Data model
- `MapAsset`: id/name/game/version/description/source image data URL/dimensions/createdAt
- `Team`: id/name/tag/color/optional logo data URL/optional regionId, globally reusable; one region or Unassigned
- `Region`: id/name; workspace stores editable region groups with stable IDs
- `Project`: mapId, drops, markers, text labels, routes, ordered visible/locked layers, connector/grid settings, saved zoom/pan, updatedAt
- `Drop`: relative percentage x/y, name, auto/manual layout, allow-more-than-five-manually, show-name flag
- `Marker`: team/drop references; relative x/y; tag/logo; circle/pin/rounded/square/custom shape; scale/rotation/opacity; text/font/color/background/border/shadow; logo scale/fit/padding/x/y; visible/locked/connector flags
- `TextLabel`: relative x/y, text/font/size/color/background/alignment/bold/shadow/rotation/opacity/locked
- `Route`: relative points, line/polyline/arrow, color/width/opacity/dashed/locked
- `Template`: named project snapshot referencing a saved map and reusable teams
- `Preferences`: new-marker default shape, export format, trim transparent PNG padding

## Key flows
1. Functional Dashboard, Maps, Projects, Teams, Templates, Settings navigation; search in each library. Dashboard opens with demo project and five sample teams.
2. Map upload/name/description/game/version; edit details, duplicate, delete with confirmation and related-project warning. Source stays unmodified.
3. Create named project choosing any map; open, duplicate, delete, export/import self-contained .project JSON including embedded map/logos and validated relationships.
4. Create/edit/delete reusable teams. Upload and intelligently fit logos; optionally trim transparent PNG padding. Tag or logo selected on assignment. Missing logo opens team edit rather than silently exporting a tag.
5. SVG editor: click Add Drop, click map, assign teams. Entire auto group rearranges on add/remove/resize: center/horizontal/equilateral triangle/square/regular pentagon. Auto max 5; explicit manual-more-than-5 option. Automatic layout tries nearby translations to avoid other markers and app-created text and shifts clusters inside map bounds. It does not OCR underlying raster-map labels.
6. Select from canvas/drop list/assigned team chips; named drops center view. Drag a marker to switch its drop to manual without changing assignment. Drag/drop/label/route, resize/rotate marker handles, full property controls, locks, duplicate/delete. Connector styles and per-marker toggle.
7. Ordered layer panel: background, grid, connectors, drops, routes, markers, labels. Visibility and locks; reorder overlay layers. Background remains bottom and undestructive. Grid coordinates and opacity.
8. Text tool and line/arrow/polyline tools. Click route points; finish polyline with button or Enter. Edit text and route properties. Drag entire paths.
9. Undo/redo stores up to 100 project snapshots. Pointer drag and range slider gestures are one action. New edits clear redo. Undo-restored snapshots autosave. History is per open editor session, not persisted across refresh. Keyboard: Ctrl/Cmd Z, Shift Z, Y, S, E; Delete; Space pan; Esc deselect/cancel; Enter finish polyline.
10. Mouse/trackpad wheel anchored zoom, zoom buttons, pan tool/Space/middle mouse, fit/reset, fullscreen where browser supported. Touch pointer gestures support pinch zoom/two-finger pan. Responsive mobile bottom Select/Add/Drops/Teams/Layers/Export controls and collapsible inspector; text/routes/undo also available in mobile top tool rail.
11. Save project as a named reusable template; use creates independent project; rename/delete templates. Saved maps can be used as clean templates.
12. Shared SVG scene rasterized to Canvas for PNG/JPG/WEBP export, with logos, fonts, transparency where supported, all visible layers and no selection/editor UI. Original/high (up to 8192px), standard, 2K/4K; original/Instagram portrait/story/square/YouTube/custom canvases fit without cropping. Custom bounded to 8192px and 40MP. Same source SVG guarantees relative positions across editor/export. Export preview is presentation only.
13. Settings: defaults, browser storage usage/persistence request, keyboard guide, nondestructive fresh demo, confirmed workspace clear. Clear does not reseed on refresh.
14. Teams are grouped by region, with count chips and combined name/tag/region search in the Teams library. Default groups: SEA, BRAZIL, VIETNAM, BANGLA, INDIA, MENA, MALAYSIA, INDONESIA. Existing and demo teams remain Unassigned; no region is guessed. Add/edit team forms provide a one-region selector; the editor team picker has a region dropdown with counts and per-team region badges.
15. Teams → Manage groups lets users add, rename, and delete regions. Names trim/collapse whitespace and normalize to uppercase; blank, duplicate (case-insensitive), reserved All regions/Unassigned and >40-character names are rejected. Deletion requires confirmation, atomically moves members to Unassigned, and does not modify markers, drops, projects or templates. Unassigned is a built-in nondeletable category. Region changes and assignments persist in IndexedDB. Older version-2 workspaces gain defaults only when their regions field is absent; intentionally empty/deleted lists are preserved on refresh.
16. Project exports include region definitions used by their embedded teams. Import validates region names and references, merges groups by normalized name, remaps IDs safely, and preserves assignments. Older project files without region metadata still import as Unassigned.

## Auth and roles
No authentication. All app capabilities are available locally in the current browser.

## Implementation and verification
New entry page: `pages/Workspace.tsx`. Model/storage/migration/validation: `lib/studio.ts`. Project history: `lib/use-project-history.ts`. UI: `components/studio/{Library,AssetForms,Editor,Inspector,MapScene,ExportDialog,Controls}.tsx`. Existing `lib/drop-map.ts` supplies backward-compatible seed/migration input only. Backend remains template health/status API; domain data never leaves the browser. API router inclusion is last in server.py.

## Known product boundaries
- Local storage only; clearing site data can remove it. Browser may decline persistent-storage requests; project backups remain available.
- No official game-map downloads or image-label OCR; upload a current game map. Collision avoidance is best-effort, with manual override.
- Fullscreen availability depends on browser. Performance depends on image size/device; 100+ SVG markers is a target, not an unlimited-scene guarantee.
- No accounts or login credentials.