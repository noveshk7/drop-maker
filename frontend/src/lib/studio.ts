import { createDemoStore, type MapAsset, type Team, type DropMapStore } from './drop-map';

export type { MapAsset, Team } from './drop-map';
export type MarkerShape = 'circle' | 'pin' | 'rounded' | 'square' | 'custom';
export type LayerId = 'background' | 'grid' | 'connectors' | 'drops' | 'routes' | 'markers' | 'labels';
export interface Layer { id: LayerId; name: string; visible: boolean; locked: boolean }
export interface Point { x: number; y: number }
export interface Marker extends Point {
  id: string; teamId: string; dropId: string; type: 'tag' | 'logo'; scale: number; rotation: number;
  visible: boolean; locked: boolean; opacity: number; shape: MarkerShape; background: string;
  textColor: string; borderColor: string; borderWidth: number; fontSize: number; font: string;
  shadow: boolean; connector: boolean; logoScale: number; logoPadding: number; logoX: number; logoY: number;
  logoFit: 'contain' | 'cover'; cornerRadius: number;
}
export interface Drop extends Point { id: string; name: string; layoutMode: 'auto' | 'manual'; allowMore: boolean; showName: boolean }
export interface TextLabel extends Point {
  id: string; text: string; font: string; size: number; color: string; background: string; bold: boolean;
  shadow: boolean; align: 'start' | 'middle' | 'end'; rotation: number; opacity: number; locked: boolean;
}
export interface Route { id: string; points: Point[]; kind: 'line' | 'polyline' | 'arrow'; color: string; width: number; opacity: number; dashed: boolean; locked: boolean }
export interface Project {
  id: string; name: string; mapId: string; markers: Marker[]; drops: Drop[]; labels: TextLabel[]; routes: Route[];
  layers: Layer[]; connectorColor: string; connectorWidth: number; connectorDashed: boolean;
  gridOpacity: number; gridCoordinates: boolean; view: { zoom: number; x: number; y: number }; updatedAt: number;
}
export interface Template { id: string; name: string; project: Project }
export interface Preferences { markerShape: MarkerShape; exportFormat: 'png' | 'jpeg' | 'webp'; trimLogos: boolean }
export interface Workspace { version: 2; maps: MapAsset[]; teams: Team[]; projects: Project[]; templates: Template[]; preferences: Preferences }
export interface ProjectFile { format: 'dropmap-project'; version: 2; map: MapAsset; teams: Team[]; project: Project }
export const id = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;
export const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));
export const fonts = ['Sora', 'Instrument Sans', 'JetBrains Mono', 'Georgia', 'Verdana'];
export const defaultLayers = (): Layer[] => [
  { id: 'background', name: 'Map background', visible: true, locked: true },
  { id: 'grid', name: 'Coordinate grid', visible: false, locked: true },
  { id: 'connectors', name: 'Connector lines', visible: true, locked: false },
  { id: 'drops', name: 'Drop locations', visible: true, locked: false },
  { id: 'routes', name: 'Routes & arrows', visible: true, locked: false },
  { id: 'markers', name: 'Team markers', visible: true, locked: false },
  { id: 'labels', name: 'Text labels', visible: true, locked: false },
];
export const newProject = (mapId: string, name: string): Project => ({
  id: id('project'), name, mapId, markers: [], drops: [], labels: [], routes: [], layers: defaultLayers(),
  connectorColor: '#ffffff', connectorWidth: 1.5, connectorDashed: false, gridOpacity: .24,
  gridCoordinates: true, view: { zoom: 1, x: 0, y: 0 }, updatedAt: Date.now(),
});
export const newMarker = (team: Team, drop: Drop, type: 'tag' | 'logo', shape: MarkerShape = 'circle'): Marker => ({
  id: id('marker'), teamId: team.id, dropId: drop.id, type, x: drop.x, y: drop.y, scale: 1, rotation: 0,
  visible: true, locked: false, opacity: 1, shape, background: '#080d18', textColor: '#ffffff',
  borderColor: team.color, borderWidth: 2, fontSize: 13, font: 'Sora', shadow: true, connector: true,
  logoScale: 1, logoPadding: 3, logoX: 0, logoY: 0, logoFit: 'contain', cornerRadius: 12,
});

// All saved coordinates are percentages. Geometry is calculated in a 1000-unit
// viewBox so circles and automatic formations stay undistorted at every aspect ratio.
export function arrange(project: Project, dropId: string, map: MapAsset): Project {
  const drop = project.drops.find(d => d.id === dropId);
  const group = project.markers.filter(m => m.dropId === dropId);
  if (!drop || drop.layoutMode !== 'auto' || group.length > 5 || !group.length) return project;
  const h = 1000 * map.height / map.width;
  const radius = Math.max(...group.map(m => 26 * m.scale));
  const spacing = radius * 2 + 12;
  const offsets: Point[] = group.length === 1 ? [{ x: 0, y: 0 }] : group.length === 2 ? [{ x: -spacing / 2, y: 0 }, { x: spacing / 2, y: 0 }] : group.length === 4 ? [
    { x: -spacing / 2, y: -spacing / 2 }, { x: spacing / 2, y: -spacing / 2 },
    { x: -spacing / 2, y: spacing / 2 }, { x: spacing / 2, y: spacing / 2 },
  ] : Array.from({ length: group.length }, (_, i) => {
    const a = -Math.PI / 2 + i * Math.PI * 2 / group.length;
    const r = spacing / (2 * Math.sin(Math.PI / group.length));
    return { x: Math.cos(a) * r, y: Math.sin(a) * r };
  });
  const others = project.markers.filter(m => m.dropId !== dropId && m.visible);
  let best: Point[] = [], bestScore = Infinity;
  // Try small translations of the entire formation, preserving its exact shape.
  for (const [dx, dy] of [[0, 0], [0, -spacing], [0, spacing], [-spacing, 0], [spacing, 0], [-spacing, -spacing], [spacing, spacing]]) {
    const left = Math.min(...offsets.map(p => p.x)), right = Math.max(...offsets.map(p => p.x));
    const top = Math.min(...offsets.map(p => p.y)), bottom = Math.max(...offsets.map(p => p.y));
    const cx = clamp(drop.x * 10 + dx, radius - left, 1000 - radius - right);
    const cy = clamp(drop.y * h / 100 + dy, radius - top, h - radius - bottom);
    const candidate = offsets.map(p => ({ x: (cx + p.x) / 10, y: (cy + p.y) / h * 100 }));
    let score = Math.hypot(dx, dy) * .001;
    candidate.forEach(p => {
      others.forEach(m => { score += Math.max(0, radius + 26 * m.scale + 4 - Math.hypot((p.x - m.x) * 10, (p.y - m.y) * h / 100)); });
      project.labels.forEach(t => { if (Math.abs((p.x - t.x) * 10) < t.text.length * t.size * .28 + radius && Math.abs((p.y - t.y) * h / 100) < t.size + radius) score += 20; });
    });
    if (score < bestScore) { bestScore = score; best = candidate; }
  }
  return { ...project, markers: project.markers.map(m => { const i = group.findIndex(g => g.id === m.id); return i < 0 || m.locked ? m : { ...m, ...best[i] }; }) };
}

export function migrate(old: DropMapStore): Workspace {
  const projects = old.projects.map(p => ({ ...newProject(p.mapId, p.name), id: p.id, updatedAt: p.updatedAt,
    drops: p.drops.map(d => ({ ...d, allowMore: false, showName: false })),
    markers: p.markers.map(m => ({ ...newMarker(old.teams.find(t => t.id === m.teamId) ?? { id: m.teamId, color: '#ffffff', name: '', tag: '' }, { id: m.dropId, x: m.x, y: m.y, name: '', layoutMode: 'manual', allowMore: false, showName: false }, m.type), ...m })),
    layers: defaultLayers().map(l => ({ ...l, visible: l.id === 'connectors' ? p.showConnectors : l.id === 'drops' ? p.showAnchors : l.visible })),
  }));
  return { version: 2, maps: old.maps, teams: old.teams, projects, templates: [], preferences: { markerShape: 'circle', exportFormat: 'png', trimLogos: true } };
}
export function demoWorkspace(): Workspace {
  const workspace = migrate(createDemoStore());
  workspace.maps[0].name = 'Bermuda · Tactical demo';
  workspace.maps[0].description = 'Illustrated practice map inspired by Bermuda, not an official game map. Upload the current game map for tournament use.';
  workspace.projects[0] = arrange(workspace.projects[0], 'drop_shipyard', workspace.maps[0]);
  return workspace;
}

let database: Promise<IDBDatabase> | undefined;
function db(): Promise<IDBDatabase> {
  if (!database) database = new Promise((resolve, reject) => {
    const request = indexedDB.open('drop-map-studio', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('workspace');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { database = undefined; reject(new Error('Browser storage is unavailable. Enable site storage to keep your maps.')); };
    request.onblocked = () => reject(new Error('Close other Drop Map tabs and try again.'));
  });
  return database;
}
export async function loadWorkspace(): Promise<Workspace> {
  const database = await db();
  const stored = await new Promise<Workspace | undefined>((resolve, reject) => {
    const request = database.transaction('workspace').objectStore('workspace').get('current');
    request.onsuccess = () => resolve(request.result as Workspace | undefined);
    request.onerror = () => reject(request.error);
  });
  if (stored?.version === 2) return stored;
  const legacy = localStorage.getItem('drop-map-creator-store-v1');
  if (legacy) {
    try { const old = JSON.parse(legacy) as DropMapStore; if (Array.isArray(old.maps) && Array.isArray(old.teams) && Array.isArray(old.projects)) return migrate(old); } catch { /* Preserve the old entry; use the demo without deleting anything. */ }
  }
  return demoWorkspace();
}
export async function saveWorkspace(workspace: Workspace): Promise<void> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('workspace', 'readwrite');
    transaction.objectStore('workspace').put(workspace, 'current');
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(new Error('Could not save locally. Storage may be full; export your project as a backup.'));
    transaction.onabort = () => reject(new Error('Local save was interrupted. Export a project backup before closing.'));
  });
}

export const loadImage = (source: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
  const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error('The image could not be decoded. Choose a valid PNG, JPG or WEBP.')); image.src = source;
});
export async function readImage(file: File, trim = false): Promise<{ data: string; width: number; height: number }> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Please choose a PNG, JPG or WEBP image.');
  if (file.size > 50 * 1024 * 1024) throw new Error('Choose an image smaller than 50 MB.');
  const data = await new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(new Error('Unable to read this file.')); r.readAsDataURL(file); });
  const image = await loadImage(data);
  if (image.width > 16384 || image.height > 16384) throw new Error('Maximum image dimension is 16,384 pixels.');
  if (!trim || file.type !== 'image/png' || image.width * image.height > 16000000) return { data, width: image.width, height: image.height };
  const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
  const ctx = canvas.getContext('2d'); if (!ctx) return { data, width: image.width, height: image.height };
  ctx.drawImage(image, 0, 0); const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let left = image.width, top = image.height, right = -1, bottom = -1;
  for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) if (pixels[(y * image.width + x) * 4 + 3] > 8) { left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); }
  if (right < left || (left === 0 && top === 0 && right === image.width - 1 && bottom === image.height - 1)) return { data, width: image.width, height: image.height };
  const cropped = document.createElement('canvas'); cropped.width = right - left + 1; cropped.height = bottom - top + 1;
  cropped.getContext('2d')?.drawImage(canvas, left, top, cropped.width, cropped.height, 0, 0, cropped.width, cropped.height);
  return { data: cropped.toDataURL('image/png'), width: cropped.width, height: cropped.height };
}
export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export const filename = (name: string) => name.replace(/[^a-z0-9-_]+/gi, '-').replace(/^-|-$/g, '') || 'drop-map';
export function projectFile(workspace: Workspace, project: Project): ProjectFile {
  const map = workspace.maps.find(m => m.id === project.mapId);
  if (!map) throw new Error('The project map is missing.');
  return { format: 'dropmap-project', version: 2, map, project, teams: workspace.teams.filter(t => project.markers.some(m => m.teamId === t.id)) };
}
export function exportProject(workspace: Workspace, project: Project) {
  download(new Blob([JSON.stringify(projectFile(workspace, project))], { type: 'application/json' }), `${filename(project.name)}.project`);
}

// Validate imported data at the trust boundary, including every nested entity and
// asset reference. No remote image URLs or executable markup enter the renderer.
export async function importProject(file: File, workspace: Workspace): Promise<{ workspace: Workspace; project: Project }> {
  if (file.size > 120 * 1024 * 1024) throw new Error('Project file is too large (maximum 120 MB).');
  let value: unknown; try { value = JSON.parse(await file.text()); } catch { throw new Error('This is not a valid JSON project file.'); }
  const fail = () => { throw new Error('Invalid or unsupported project. Import a .project file exported by DROP//MAP.'); };
  const obj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
  const str = (x: unknown) => typeof x === 'string' && x.length <= 10000;
  const num = (x: unknown, min: number, max: number) => typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max;
  const arr = (x: unknown, max = 10000): x is Record<string, unknown>[] => Array.isArray(x) && x.length <= max && x.every(obj);
  const color = (x: unknown) => typeof x === 'string' && /^#[0-9a-f]{6}$/i.test(x);
  const point = (x: Record<string, unknown>) => num(x.x, 0, 100) && num(x.y, 0, 100);
  const asset = (x: unknown) => typeof x === 'string' && /^data:image\/(png|jpeg|webp|svg\+xml)[;,]/.test(x) && x.length <= 75000000;
  if (!obj(value) || value.format !== 'dropmap-project' || value.version !== 2 || !obj(value.map) || !obj(value.project) || !arr(value.teams, 2000)) return fail();
  const m = value.map, p = value.project;
  if (!str(m.id) || !str(m.name) || !str(m.game) || !str(m.description) || !str(m.version) || !asset(m.imageData) || !num(m.width, 1, 16384) || !num(m.height, 1, 16384)) return fail();
  if (!str(p.id) || !str(p.name) || p.mapId !== m.id || !arr(p.markers) || !arr(p.drops) || !arr(p.labels) || !arr(p.routes) || !arr(p.layers, 7) || !obj(p.view)) return fail();
  if (p.layers.length !== 7 || new Set(p.layers.map(l => l.id)).size !== 7 || !p.layers.every(l => defaultLayers().some(d => d.id === l.id) && typeof l.visible === 'boolean' && typeof l.locked === 'boolean')) return fail();
  if (!color(p.connectorColor) || !num(p.connectorWidth, .1, 12) || !num(p.gridOpacity, 0, 1) || !num(p.view.zoom, .25, 8) || !num(p.view.x, -10000, 10000) || !num(p.view.y, -10000, 10000)) return fail();
  const unique = (items: Record<string, unknown>[]) => items.every(i => str(i.id)) && new Set(items.map(i => i.id)).size === items.length;
  if (![value.teams, p.markers, p.drops, p.labels, p.routes].every(unique)) return fail();
  if (!value.teams.every(t => str(t.name) && str(t.tag) && color(t.color) && (!t.logoData || asset(t.logoData)))) return fail();
  if (!p.drops.every(d => str(d.name) && point(d) && ['auto', 'manual'].includes(String(d.layoutMode)) && typeof d.allowMore === 'boolean' && typeof d.showName === 'boolean')) return fail();
  const importedDrops = p.drops, importedTeams = value.teams;
  if (!p.markers.every(k => point(k) && importedDrops.some(d => d.id === k.dropId) && importedTeams.some(t => t.id === k.teamId) && ['tag', 'logo'].includes(String(k.type)) && ['circle', 'pin', 'rounded', 'square', 'custom'].includes(String(k.shape)) && num(k.scale, .3, 3) && num(k.rotation, -360, 360) && num(k.opacity, 0, 1) && num(k.fontSize, 6, 40) && str(k.font) && color(k.background) && color(k.textColor) && color(k.borderColor) && num(k.borderWidth, 0, 12) && num(k.logoScale, .2, 3) && num(k.logoPadding, 0, 20) && num(k.logoX, -30, 30) && num(k.logoY, -30, 30) && num(k.cornerRadius, 0, 24) && ['contain', 'cover'].includes(String(k.logoFit)) && ['visible', 'locked', 'shadow', 'connector'].every(key => typeof k[key] === 'boolean'))) return fail();
  if (!p.labels.every(t => point(t) && str(t.text) && str(t.font) && num(t.size, 8, 100) && num(t.rotation, -360, 360) && num(t.opacity, 0, 1) && color(t.color) && (t.background === 'none' || color(t.background)) && ['start', 'middle', 'end'].includes(String(t.align)) && ['bold', 'shadow', 'locked'].every(k => typeof t[k] === 'boolean'))) return fail();
  if (!p.routes.every(r => arr(r.points, 1000) && r.points.length >= 2 && r.points.every(point) && ['line', 'polyline', 'arrow'].includes(String(r.kind)) && color(r.color) && num(r.width, 1, 12) && num(r.opacity, 0, 1) && typeof r.dashed === 'boolean' && typeof r.locked === 'boolean')) return fail();
  const bundle = value as unknown as ProjectFile;
  const image = await loadImage(bundle.map.imageData);
  if (image.naturalWidth !== bundle.map.width || image.naturalHeight !== bundle.map.height) throw new Error('Map dimensions do not match the embedded image.');
  await Promise.all(bundle.teams.filter(t => t.logoData).map(t => loadImage(t.logoData!)));
  const map = { ...bundle.map, id: id('map'), createdAt: Date.now() };
  const teamIds = new Map(bundle.teams.map(t => [t.id, id('team')]));
  const teams = bundle.teams.map(t => ({ ...t, id: teamIds.get(t.id)! }));
  const project: Project = { ...bundle.project, id: id('project'), mapId: map.id, name: `${bundle.project.name} · Imported`, markers: bundle.project.markers.map(k => ({ ...k, teamId: teamIds.get(k.teamId)! })), updatedAt: Date.now() };
  return { workspace: { ...workspace, maps: [...workspace.maps, map], teams: [...workspace.teams, ...teams], projects: [project, ...workspace.projects] }, project };
}