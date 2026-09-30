export type MarkerType = "tag" | "logo";
export type LayoutMode = "auto" | "manual";

export interface MapAsset {
  id: string;
  name: string;
  game: string;
  version: string;
  description: string;
  imageData: string;
  width: number;
  height: number;
  createdAt: number;
}

export interface Team {
  id: string;
  name: string;
  tag: string;
  color: string;
  logoData?: string;
}

export interface DropMarker {
  id: string;
  teamId: string;
  dropId: string;
  type: MarkerType;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  visible: boolean;
  locked: boolean;
}

export interface DropLocation {
  id: string;
  name: string;
  x: number;
  y: number;
  layoutMode: LayoutMode;
}

export interface Project {
  id: string;
  name: string;
  mapId: string;
  markers: DropMarker[];
  drops: DropLocation[];
  showConnectors: boolean;
  showAnchors: boolean;
  updatedAt: number;
}

export interface DropMapStore {
  maps: MapAsset[];
  teams: Team[];
  projects: Project[];
}

const STORE_KEY = "drop-map-creator-store-v1";

const uid = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

const logoData = (tag: string, color: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="${color}"/><stop offset="1" stop-color="#111827"/></linearGradient></defs><rect width="180" height="180" rx="54" fill="url(#g)"/><circle cx="90" cy="90" r="63" fill="none" stroke="white" stroke-opacity=".32" stroke-width="2"/><text x="90" y="105" text-anchor="middle" fill="white" font-family="Arial" font-size="40" font-weight="800">${tag.slice(0, 4)}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

const demoMapData = () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="1280" viewBox="0 0 2048 1280"><defs><linearGradient id="water" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#071b32"/><stop offset="1" stop-color="#12375a"/></linearGradient><linearGradient id="land" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#567a5c"/><stop offset="1" stop-color="#203f45"/></linearGradient><pattern id="grid" width="64" height="64" patternUnits="userSpaceOnUse"><path d="M64 0H0V64" fill="none" stroke="#d9f99d" stroke-opacity=".1"/></pattern></defs><rect width="2048" height="1280" fill="url(#water)"/><path d="M60 240C180 130 330 150 410 260C550 130 760 190 810 360C970 300 1120 380 1150 510C1350 430 1530 470 1640 610C1810 585 1950 710 1980 880C1860 1050 1660 1120 1480 1050C1290 1190 1040 1120 940 1010C760 1150 580 1090 520 930C330 1000 150 890 150 720C60 590 20 390 60 240Z" fill="url(#land)" stroke="#a7d7a6" stroke-opacity=".45" stroke-width="9"/><path d="M100 0L400 270L470 500L690 650L830 1000M1320 0L1190 330L1360 530L1510 820L1690 1280M0 820L440 760L790 860L1060 700L1430 690L2048 520" fill="none" stroke="#c8e6b8" stroke-opacity=".22" stroke-width="22"/><path d="M0 0H2048V1280H0Z" fill="url(#grid)"/><g fill="#d5e9c5" font-family="Arial" font-weight="700" font-size="34" letter-spacing="4"><text x="340" y="390">PEAK</text><text x="795" y="480">CLOCK TOWER</text><text x="1440" y="720">FACTORY</text><text x="575" y="850">SHIPYARD</text><text x="1130" y="920">POCHINOK</text><text x="1590" y="1010">MARS ELECTRIC</text><text x="1050" y="250">BIMASAKTI STRIP</text></g><g fill="#8bd3dd" fill-opacity=".5"><circle cx="425" cy="335" r="13"/><circle cx="875" cy="430" r="13"/><circle cx="1515" cy="680" r="13"/><circle cx="650" cy="815" r="13"/><circle cx="1220" cy="870" r="13"/></g></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

export const defaultTeams = (): Team[] => [
  { id: "team_loud", name: "LOUD Esports", tag: "LOUD", color: "#10B981", logoData: logoData("L", "#10B981") },
  { id: "team_falcons", name: "Team Falcons", tag: "FLCN", color: "#8B5CF6", logoData: logoData("F", "#8B5CF6") },
  { id: "team_evos", name: "EVOS Phoenix", tag: "EVOS", color: "#3B82F6", logoData: logoData("E", "#3B82F6") },
  { id: "team_alpha", name: "Alpha7 Esports", tag: "A7", color: "#F59E0B", logoData: logoData("A7", "#F59E0B") },
  { id: "team_nigma", name: "Nigma Galaxy", tag: "NGX", color: "#EC4899", logoData: logoData("N", "#EC4899") },
];

export const createDemoStore = (): DropMapStore => {
  const map: MapAsset = {
    id: "map_bermuda_demo",
    name: "Bermuda / Tactical",
    game: "Free Fire",
    version: "OB53",
    description: "A ready-to-edit tactical map for the first drop sheet.",
    imageData: demoMapData(),
    width: 2048,
    height: 1280,
    createdAt: Date.now(),
  };
  const teams = defaultTeams();
  const drops: DropLocation[] = [
    { id: "drop_shipyard", name: "SHIPYARD", x: 31, y: 62, layoutMode: "auto" },
    { id: "drop_clock", name: "CLOCK TOWER", x: 43, y: 34, layoutMode: "auto" },
    { id: "drop_factory", name: "FACTORY", x: 74, y: 54, layoutMode: "auto" },
  ];
  const markers: DropMarker[] = [
    { id: "marker_loud", teamId: teams[0].id, dropId: drops[0].id, type: "tag", x: 31, y: 62, scale: 1, rotation: 0, visible: true, locked: false },
    { id: "marker_falcons", teamId: teams[1].id, dropId: drops[0].id, type: "logo", x: 39, y: 62, scale: 1, rotation: 0, visible: true, locked: false },
    { id: "marker_evos", teamId: teams[2].id, dropId: drops[1].id, type: "tag", x: 43, y: 34, scale: 1, rotation: 0, visible: true, locked: false },
    { id: "marker_alpha", teamId: teams[3].id, dropId: drops[2].id, type: "logo", x: 74, y: 54, scale: 1, rotation: 0, visible: true, locked: false },
  ];
  return {
    maps: [map],
    teams,
    projects: [{ id: "project_demo", name: "Bermuda / Opening Match", mapId: map.id, markers, drops, showConnectors: true, showAnchors: true, updatedAt: Date.now() }],
  };
};

export const loadStore = (): DropMapStore => {
  if (typeof window === "undefined") return createDemoStore();
  try {
    const stored = window.localStorage.getItem(STORE_KEY);
    if (!stored) return createDemoStore();
    const parsed = JSON.parse(stored) as DropMapStore;
    if (!parsed.maps?.length || !parsed.teams?.length || !parsed.projects?.length) return createDemoStore();
    return parsed;
  } catch {
    return createDemoStore();
  }
};

export const saveStore = (store: DropMapStore) => {
  if (typeof window !== "undefined") window.localStorage.setItem(STORE_KEY, JSON.stringify(store));
};

export const clamp = (value: number, min = 2, max = 98) => Math.min(max, Math.max(min, value));

export const layoutOffsets = (count: number) => {
  const layouts: Record<number, Array<[number, number]>> = {
    1: [[0, 0]],
    2: [[-7, 0], [7, 0]],
    3: [[0, -8], [-8, 6], [8, 6]],
    4: [[-7, -6], [7, -6], [-7, 7], [7, 7]],
    5: [[0, -10], [-9, -2], [9, -2], [-6, 8], [6, 8]],
  };
  return layouts[Math.min(count, 5)] ?? layouts[1];
};

export const makeMarker = (team: Team, drop: DropLocation, type: MarkerType, existingCount: number): DropMarker => {
  const offset = layoutOffsets(existingCount + 1)[existingCount] ?? [0, 0];
  return { id: uid("marker"), teamId: team.id, dropId: drop.id, type, x: clamp(drop.x + offset[0]), y: clamp(drop.y + offset[1]), scale: 1, rotation: 0, visible: true, locked: false };
};

export const makeId = uid;