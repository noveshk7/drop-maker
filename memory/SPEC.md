# DROP//MAP MVP Spec

## Product
DROP//MAP is a browser-local esports drop-map creator. Users reuse saved maps and teams to build project-specific tactical drop sheets and export a PNG.

## Persistence
Maps, reusable teams, projects, drops, markers, and editor toggles persist in `localStorage` under `drop-map-creator-store-v1`. The initial store seeds a functional Bermuda demo project and five sample teams. No accounts or third-party integrations are used.

## Data model
- `MapAsset`: name, game, version, source image data URL, dimensions
- `Team`: name, tag, color, optional logo data URL
- `Project`: map reference, drops, markers, connector/anchor visibility, updated timestamp
- `DropLocation`: relative x/y percentage, name, auto/manual layout mode
- `DropMarker`: team/drop references, tag or logo marker type, relative x/y, scale, rotation, visibility, locked state

## Key flows
1. Dashboard opens with demo project and saved Bermuda map.
2. Upload a PNG/JPG/WEBP map to add it to the local map library.
3. Create a project from any saved map.
4. In the editor choose Add Drop and click the map.
5. Assign reusable teams as TAG or LOGO markers. Up to five markers are auto-arranged around the drop.
6. Drag markers to switch a drop to manual layout; connector lines remain tied to the drop anchor.
7. Toggle anchor/connector layers and export a clean PNG.

## Auth and roles
No authentication. All app capabilities are available locally in the current browser.