import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  CircleDashed,
  Copy,
  Download,
  FolderOpen,
  Grid3X3,
  Layers3,
  Lock,
  Map as MapIcon,
  MapPin,
  MousePointer2,
  Plus,
  Redo2,
  RotateCcw,
  Save,
  Search,
  Settings2,
  Trash2,
  Undo2,
  Upload,
  Users,
  X,
  ZoomIn,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  clamp,
  createDemoStore,
  layoutOffsets,
  loadStore,
  makeId,
  makeMarker,
  saveStore,
  type DropMapStore,
  type DropLocation,
  type DropMarker,
  type MapAsset,
  type MarkerType,
  type Project,
  type Team,
} from "@/lib/drop-map";

type Tool = "select" | "drop";

const glass = "border border-white/[0.1] bg-slate-950/75 shadow-2xl shadow-black/20 backdrop-blur-xl";
const iconButton = "text-slate-400 hover:bg-white/[0.08] hover:text-white";

const readFileAsData = (file: File, callback: (data: string) => void) => {
  const reader = new FileReader();
  reader.onload = () => {
    if (typeof reader.result === "string") callback(reader.result);
  };
  reader.readAsDataURL(file);
};

const getPointFromEvent = (event: { clientX: number; clientY: number }, element: HTMLElement | null) => {
  const rect = element?.getBoundingClientRect();
  if (!rect) return { x: 50, y: 50 };
  return { x: clamp(((event.clientX - rect.left) / rect.width) * 100), y: clamp(((event.clientY - rect.top) / rect.height) * 100) };
};

function AppMark() {
  return <div data-testid="app-brand" className="flex items-center gap-3"><div className="relative grid size-9 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 shadow-lg shadow-violet-500/30"><MapPin className="size-5 text-white" strokeWidth={2.5} /><span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-white shadow-[0_0_8px_white]" /></div><div className="leading-none"><p data-testid="app-brand-title" className="font-heading text-[15px] font-bold tracking-[0.18em] text-white">DROP//MAP</p><p data-testid="app-brand-caption" className="mt-1 font-mono text-[9px] uppercase tracking-[0.25em] text-cyan-300/70">Tactical Studio</p></div></div>;
}

function EmptyState({ title, body, action, onAction, testId }: { title: string; body: string; action: string; onAction: () => void; testId: string }) {
  return <div data-testid={testId} className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-8 text-center"><div className="mb-4 grid size-12 place-items-center rounded-2xl border border-violet-400/20 bg-violet-400/10 text-violet-300"><MapIcon className="size-5" /></div><h3 data-testid={`${testId}-title`} className="font-heading text-lg font-semibold text-white">{title}</h3><p data-testid={`${testId}-body`} className="mt-2 max-w-sm text-sm leading-6 text-slate-400">{body}</p><Button data-testid={`${testId}-action`} onClick={onAction} className="mt-5 bg-violet-500 text-white hover:bg-violet-400"><Plus className="size-4" />{action}</Button></div>;
}

function TeamAvatar({ team, size = "md" }: { team: Team; size?: "sm" | "md" }) {
  return team.logoData ? <img data-testid={`team-avatar-${team.id}`} src={team.logoData} alt={`${team.name} logo`} className={`${size === "sm" ? "size-7" : "size-9"} rounded-xl object-cover ring-1 ring-white/20`} /> : <span data-testid={`team-avatar-${team.id}`} className={`${size === "sm" ? "size-7 text-[10px]" : "size-9 text-xs"} grid place-items-center rounded-xl font-bold text-white`} style={{ backgroundColor: team.color }}>{team.tag.slice(0, 3)}</span>;
}

function TeamModal({ onClose, onCreate }: { onClose: () => void; onCreate: (team: Team) => void }) {
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [color, setColor] = useState("#8B5CF6");
  const [logo, setLogo] = useState<string | undefined>();
  const submit = () => {
    if (!name.trim() || !tag.trim()) return toast.error("Add a team name and short tag first.");
    onCreate({ id: makeId("team"), name: name.trim(), tag: tag.trim().toUpperCase(), color, logoData: logo });
    toast.success("Team added to your library");
    onClose();
  };
  return <div data-testid="team-modal" className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm"><div className={`${glass} w-full max-w-md rounded-2xl p-6`}><div className="flex items-start justify-between"><div><p data-testid="team-modal-eyebrow" className="font-mono text-[10px] uppercase tracking-[0.24em] text-violet-300">Team library</p><h2 data-testid="team-modal-title" className="mt-2 font-heading text-2xl font-bold text-white">Add a reusable team</h2></div><Button data-testid="team-modal-close-button" variant="ghost" size="icon" className={iconButton} onClick={onClose}><X /></Button></div><div className="mt-6 space-y-4"><label data-testid="team-name-field" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Team name<Input data-testid="team-name-input" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Fusion Phoenix" className="mt-2 border-white/10 bg-white/[0.04] text-white" /></label><label data-testid="team-tag-field" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Short tag<Input data-testid="team-tag-input" value={tag} maxLength={6} onChange={(event) => setTag(event.target.value)} placeholder="FU" className="mt-2 border-white/10 bg-white/[0.04] font-mono uppercase text-white" /></label><div className="grid grid-cols-[1fr_auto] gap-3"><label data-testid="team-color-field" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Brand color<input data-testid="team-color-input" type="color" value={color} onChange={(event) => setColor(event.target.value)} className="mt-2 h-9 w-full cursor-pointer rounded-lg border border-white/10 bg-transparent" /></label><label data-testid="team-logo-field" className="block text-xs font-semibold uppercase tracking-wider text-slate-400">Logo<input data-testid="team-logo-input" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) readFileAsData(file, setLogo); }} className="mt-2 block w-40 text-xs text-slate-400 file:mr-2 file:rounded-lg file:border-0 file:bg-violet-500/20 file:px-3 file:py-2 file:text-xs file:text-violet-200" /></label></div><div data-testid="team-preview" className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-3"><div className="grid size-10 place-items-center overflow-hidden rounded-xl" style={{ backgroundColor: color }}>{logo ? <img src={logo} alt="Logo preview" className="size-full object-cover" /> : <span className="text-xs font-bold text-white">{tag || "TAG"}</span>}</div><div><p className="text-sm font-semibold text-white">{name || "Your team"}</p><p className="font-mono text-xs text-slate-400">{tag.toUpperCase() || "TAG"}</p></div></div></div><div className="mt-6 flex justify-end gap-2"><Button data-testid="team-modal-cancel-button" variant="ghost" className={iconButton} onClick={onClose}>Cancel</Button><Button data-testid="team-modal-save-button" onClick={submit} className="bg-violet-500 text-white hover:bg-violet-400"><Check className="size-4" />Save team</Button></div></div></div>;
}

function MapCard({ map, projectCount, onOpen, onDuplicate, onDelete }: { map: MapAsset; projectCount: number; onOpen: () => void; onDuplicate: () => void; onDelete: () => void }) {
  return <article data-testid={`map-card-${map.id}`} className={`${glass} group overflow-hidden rounded-2xl transition-transform duration-300 hover:-translate-y-1`}><div className="relative aspect-[16/8] overflow-hidden bg-slate-900"><img data-testid={`map-thumbnail-${map.id}`} src={map.imageData} alt={map.name} className="size-full object-cover opacity-75 transition duration-500 group-hover:scale-105 group-hover:opacity-100" /><div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" /><Badge data-testid={`map-game-badge-${map.id}`} className="absolute left-3 top-3 border border-cyan-300/20 bg-slate-950/70 font-mono text-[9px] uppercase tracking-widest text-cyan-200">{map.game}</Badge><span data-testid={`map-version-${map.id}`} className="absolute bottom-3 right-3 font-mono text-[10px] text-slate-300">{map.version}</span></div><div className="p-4"><div className="flex items-start justify-between gap-3"><div><h3 data-testid={`map-name-${map.id}`} className="font-heading text-lg font-semibold text-white">{map.name}</h3><p data-testid={`map-project-count-${map.id}`} className="mt-1 text-xs text-slate-400">{projectCount} {projectCount === 1 ? "project" : "projects"} · {map.width} × {map.height}</p></div><MapIcon className="size-4 text-violet-300" /></div><div className="mt-4 flex gap-2"><Button data-testid={`map-open-button-${map.id}`} onClick={onOpen} size="sm" className="flex-1 bg-violet-500 text-white hover:bg-violet-400"><FolderOpen className="size-3.5" />Open map</Button><Button data-testid={`map-duplicate-button-${map.id}`} onClick={onDuplicate} variant="ghost" size="icon-sm" className={iconButton}><Copy className="size-3.5" /></Button><Button data-testid={`map-delete-button-${map.id}`} onClick={onDelete} variant="ghost" size="icon-sm" className="text-slate-500 hover:bg-red-500/10 hover:text-red-300"><Trash2 className="size-3.5" /></Button></div></div></article>;
}

function Dashboard({ store, onOpenProject, onCreateProject, onUploadMap, onDuplicateMap, onDeleteMap, onAddTeam, onResetDemo }: { store: DropMapStore; onOpenProject: (id: string) => void; onCreateProject: (mapId: string) => void; onUploadMap: () => void; onDuplicateMap: (map: MapAsset) => void; onDeleteMap: (map: MapAsset) => void; onAddTeam: (team: Team) => void; onResetDemo: () => void }) {
  return <div data-testid="dashboard-view" className="min-h-screen bg-[#0B0F19] text-slate-100"><header data-testid="dashboard-header" className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-white/[0.08] bg-slate-950/85 px-5 backdrop-blur-xl md:px-10"><AppMark /><nav data-testid="dashboard-navigation" className="hidden items-center gap-1 md:flex"><span data-testid="nav-dashboard" className="rounded-lg bg-violet-500/15 px-4 py-2 text-sm font-semibold text-violet-200">Dashboard</span><span data-testid="nav-maps" className="px-4 py-2 text-sm text-slate-500">Map library</span><span data-testid="nav-teams" className="px-4 py-2 text-sm text-slate-500">Teams</span></nav><div className="flex items-center gap-2"><span data-testid="storage-status" className="hidden items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-emerald-300 sm:flex"><span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />Local workspace</span><Button data-testid="dashboard-add-team-button" variant="outline" onClick={() => onAddTeam({ id: "", name: "", tag: "", color: "#8B5CF6" })} className="border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/[0.08] hover:text-white"><Users className="size-4" /><span className="hidden sm:inline">Add team</span></Button></div></header><main className="mx-auto max-w-[1440px] px-5 py-10 md:px-10"><section data-testid="dashboard-hero" className="relative overflow-hidden rounded-3xl border border-violet-400/15 bg-gradient-to-br from-violet-500/15 via-slate-900/60 to-cyan-500/10 p-6 md:p-10"><div className="absolute -right-24 -top-32 size-80 rounded-full bg-violet-500/15 blur-3xl" /><div className="relative max-w-2xl"><Badge data-testid="dashboard-eyebrow" className="border border-violet-300/20 bg-violet-400/10 font-mono text-[10px] uppercase tracking-[0.2em] text-violet-200">Esports tactical workspace</Badge><h1 data-testid="dashboard-title" className="mt-5 max-w-xl font-heading text-4xl font-bold leading-[1.05] tracking-tight text-white md:text-6xl">Build drop maps that look <span className="text-transparent [background:linear-gradient(90deg,#c4b5fd,#67e8f9)] bg-clip-text">match-ready.</span></h1><p data-testid="dashboard-subtitle" className="mt-5 max-w-lg text-sm leading-7 text-slate-300 md:text-base">Store your maps once, arrange team drops in seconds, and export a polished tactical sheet without leaving the browser.</p><div className="mt-7 flex flex-wrap gap-3"><Button data-testid="dashboard-upload-map-button" onClick={onUploadMap} size="lg" className="bg-violet-500 text-white shadow-lg shadow-violet-500/20 hover:bg-violet-400"><Upload className="size-4" />Upload a map</Button><Button data-testid="dashboard-reset-demo-button" onClick={onResetDemo} variant="ghost" size="lg" className="text-slate-300 hover:bg-white/10 hover:text-white"><RotateCcw className="size-4" />Reset demo workspace</Button></div></div><div data-testid="dashboard-hero-stats" className="relative mt-10 grid max-w-xl grid-cols-3 gap-3 border-t border-white/10 pt-5 md:absolute md:bottom-10 md:right-10 md:mt-0 md:w-80 md:border-t-0 md:pt-0"><Stat label="Maps" value={store.maps.length} /><Stat label="Projects" value={store.projects.length} /><Stat label="Teams" value={store.teams.length} /></div></section><section data-testid="projects-section" className="mt-12"><div className="mb-5 flex items-end justify-between"><div><p data-testid="projects-eyebrow" className="font-mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/70">Continue building</p><h2 data-testid="projects-title" className="mt-2 font-heading text-2xl font-bold text-white">Recent projects</h2></div><Button data-testid="new-project-button" onClick={() => onCreateProject(store.maps[0]?.id ?? "")} variant="ghost" className="text-violet-200 hover:bg-violet-400/10 hover:text-white"><Plus className="size-4" />New project</Button></div>{store.projects.length ? <div className="grid gap-4 md:grid-cols-3">{store.projects.slice(0, 3).map((project) => { const map = store.maps.find((item) => item.id === project.mapId); return <button data-testid={`project-card-${project.id}`} key={project.id} onClick={() => onOpenProject(project.id)} className={`${glass} group relative overflow-hidden rounded-2xl p-5 text-left transition duration-300 hover:-translate-y-1 hover:border-violet-400/30`}><div className="absolute inset-0 opacity-25 transition duration-500 group-hover:opacity-45"><img src={map?.imageData} alt="" className="size-full object-cover" /></div><div className="relative"><div className="flex items-center justify-between"><span data-testid={`project-map-label-${project.id}`} className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">{map?.name ?? "Unlinked map"}</span><ChevronRight className="size-4 text-slate-500 transition group-hover:translate-x-1 group-hover:text-white" /></div><h3 data-testid={`project-name-${project.id}`} className="mt-12 font-heading text-xl font-semibold text-white">{project.name}</h3><p data-testid={`project-meta-${project.id}`} className="mt-2 text-xs text-slate-400">{project.drops.length} drops · {project.markers.length} team markers</p></div></button>; })}</div> : <EmptyState testId="projects-empty-state" title="Your first drop sheet is one click away" body="Start from a saved map, then place your opening drop on the canvas." action="Create project" onAction={() => onCreateProject(store.maps[0]?.id ?? "")} />}</section><section data-testid="maps-section" className="mt-14"><div className="mb-5 flex items-end justify-between"><div><p data-testid="maps-eyebrow" className="font-mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/70">Map library</p><h2 data-testid="maps-title" className="mt-2 font-heading text-2xl font-bold text-white">Saved maps</h2></div><Button data-testid="maps-upload-button" onClick={onUploadMap} variant="outline" className="border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/[0.08] hover:text-white"><Upload className="size-4" />Add map</Button></div><div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{store.maps.map((map) => <MapCard key={map.id} map={map} projectCount={store.projects.filter((project) => project.mapId === map.id).length} onOpen={() => onCreateProject(map.id)} onDuplicate={() => onDuplicateMap(map)} onDelete={() => onDeleteMap(map)} />)}</div></section><section data-testid="teams-section" className="mt-14 pb-12"><div className="mb-5 flex items-end justify-between"><div><p data-testid="teams-eyebrow" className="font-mono text-[10px] uppercase tracking-[0.22em] text-cyan-300/70">Roster cache</p><h2 data-testid="teams-title" className="mt-2 font-heading text-2xl font-bold text-white">Your teams</h2></div><span data-testid="teams-persistence-note" className="text-xs text-slate-500">Reusable across every project</span></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{store.teams.map((team) => <div data-testid={`team-card-${team.id}`} key={team.id} className={`${glass} flex items-center gap-3 rounded-xl p-3`}><TeamAvatar team={team} size="sm" /><div className="min-w-0"><p data-testid={`team-card-name-${team.id}`} className="truncate text-sm font-semibold text-white">{team.name}</p><p data-testid={`team-card-tag-${team.id}`} className="font-mono text-[10px] text-slate-500">{team.tag}</p></div></div>)}</div></section></main></div>;
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div data-testid={`stat-${label.toLowerCase()}`}><p data-testid={`stat-${label.toLowerCase()}-value`} className="font-heading text-2xl font-bold text-white">{value.toString().padStart(2, "0")}</p><p data-testid={`stat-${label.toLowerCase()}-label`} className="mt-1 font-mono text-[9px] uppercase tracking-widest text-slate-500">{label}</p></div>;
}

function ToolRail({ tool, onTool, onUndo, onRedo, canUndo, canRedo, onHome }: { tool: Tool; onTool: (tool: Tool) => void; onUndo: () => void; onRedo: () => void; canUndo: boolean; canRedo: boolean; onHome: () => void }) {
  return <aside data-testid="editor-tool-rail" className="fixed bottom-3 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-2xl border border-white/10 bg-slate-950/90 p-1.5 shadow-2xl backdrop-blur-xl md:absolute md:inset-y-16 md:left-0 md:bottom-8 md:flex-col md:translate-x-0 md:rounded-none md:rounded-r-2xl md:border-l-0 md:border-b-0 md:border-t-0 md:bg-slate-950/85 md:p-2"><Button data-testid="editor-back-button" variant="ghost" size="icon" className={iconButton} onClick={onHome}><ArrowLeft className="size-4" /></Button><div className="hidden h-px w-8 bg-white/10 md:block" /><ToolButton testId="editor-select-tool" active={tool === "select"} label="Select" icon={<MousePointer2 />} onClick={() => onTool("select")} /><ToolButton testId="editor-drop-tool" active={tool === "drop"} label="Add drop" icon={<MapPin />} onClick={() => onTool("drop")} /><div className="hidden h-px w-8 bg-white/10 md:block" /><ToolButton testId="editor-undo-button" label="Undo" icon={<Undo2 />} onClick={onUndo} disabled={!canUndo} /><ToolButton testId="editor-redo-button" label="Redo" icon={<Redo2 />} onClick={onRedo} disabled={!canRedo} /><div className="hidden h-px w-8 bg-white/10 md:block" /><ToolButton testId="editor-zoom-in-button" label="Zoom in" icon={<ZoomIn />} onClick={() => toast.info("Canvas zoom is ready for the next tuning pass.")} /></aside>;
}

function ToolButton({ testId, active, label, icon, onClick, disabled }: { testId: string; active?: boolean; label: string; icon: ReactNode; onClick: () => void; disabled?: boolean }) {
  return <Button data-testid={testId} title={label} variant="ghost" size="icon" disabled={disabled} onClick={onClick} className={`${active ? "bg-violet-500/20 text-violet-200 shadow-[0_0_16px_rgba(139,92,246,0.18)]" : iconButton} disabled:text-slate-700`}>{icon}</Button>;
}

function DropMarkerView({ marker, team, selected, onPointerDown, onSelect }: { marker: DropMarker; team?: Team; selected: boolean; onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void; onSelect: () => void }) {
  if (!team || !marker.visible) return null;
  const size = Math.round(52 * marker.scale);
  return <button data-testid={`map-marker-${marker.id}`} onPointerDown={onPointerDown} onClick={(event) => { event.stopPropagation(); onSelect(); }} style={{ left: `${marker.x}%`, top: `${marker.y}%`, width: size, height: size, transform: `translate(-50%, -50%) rotate(${marker.rotation}deg)`, borderColor: team.color, boxShadow: selected ? `0 0 0 3px rgba(255,255,255,.7), 0 0 22px ${team.color}` : `0 0 15px ${team.color}55` }} className={`absolute z-20 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 bg-slate-950/95 p-1 text-white transition-[box-shadow,transform] duration-200 ${selected ? "scale-110" : "hover:scale-110"}`}><span className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_35%_20%,rgba(255,255,255,.2),transparent_40%)]" />{marker.type === "logo" && team.logoData ? <img data-testid={`map-marker-logo-${marker.id}`} src={team.logoData} alt={`${team.name} marker`} className="relative size-full rounded-full object-cover" /> : <span data-testid={`map-marker-tag-${marker.id}`} className="relative max-w-full truncate px-1 font-heading text-[11px] font-bold tracking-tight">{team.tag}</span>}</button>;
}

function Editor({ store, project, map, onHome, onUpdateProject, onAddTeam, onDeleteMarker }: { store: DropMapStore; project: Project; map?: MapAsset; onHome: () => void; onUpdateProject: (changes: Partial<Project>) => void; onAddTeam: (teamId: string, type: MarkerType, dropId?: string) => void; onDeleteMarker: (markerId: string) => void }) {
  const [tool, setTool] = useState<Tool>("select");
  const [past, setPast] = useState<Project[]>([]);
  const [future, setFuture] = useState<Project[]>([]);
  const [selectedDropId, setSelectedDropId] = useState<string | undefined>(project.drops[0]?.id);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | undefined>();
  const [dragging, setDragging] = useState<string | null>(null);
  const [teamSearch, setTeamSearch] = useState("");
  const stageRef = useRef<HTMLDivElement>(null);
  const filteredTeams = store.teams.filter((team) => `${team.name} ${team.tag}`.toLowerCase().includes(teamSearch.toLowerCase()));
  const selectedDrop = project.drops.find((drop) => drop.id === selectedDropId);
  const selectedMarker = project.markers.find((marker) => marker.id === selectedMarkerId);
  const selectedMarkerTeam = selectedMarker ? store.teams.find((team) => team.id === selectedMarker.teamId) : undefined;
  const projectMap = map;

  const recordHistory = () => {
    setPast((items) => [...items, project]);
    setFuture([]);
  };

  const commitProject = (changes: Partial<Project>) => {
    recordHistory();
    onUpdateProject(changes);
  };

  const undo = () => {
    const previous = past[past.length - 1];
    if (!previous) return;
    setPast((items) => items.slice(0, -1));
    setFuture((items) => [project, ...items]);
    onUpdateProject(previous);
    toast.success("Change undone");
  };

  const redo = () => {
    const next = future[0];
    if (!next) return;
    setFuture((items) => items.slice(1));
    setPast((items) => [...items, project]);
    onUpdateProject(next);
    toast.success("Change redone");
  };

  useEffect(() => {
    if (!dragging) return;
    const move = (event: PointerEvent) => {
      const point = getPointFromEvent(event, stageRef.current);
      const marker = project.markers.find((item) => item.id === dragging);
      if (!marker || marker.locked) return;
      onUpdateProject({ markers: project.markers.map((item) => item.id === dragging ? { ...item, x: point.x, y: point.y } : item), drops: project.drops.map((drop) => drop.id === marker.dropId ? { ...drop, layoutMode: "manual" } : drop) });
    };
    const up = () => setDragging(null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, [dragging, onUpdateProject, project.markers, project.drops]);

  const addDrop = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (tool !== "drop") return;
    const point = getPointFromEvent(event, stageRef.current);
    const drop: DropLocation = { id: makeId("drop"), name: `DROP ${String(project.drops.length + 1).padStart(2, "0")}`, x: point.x, y: point.y, layoutMode: "auto" };
    commitProject({ drops: [...project.drops, drop] });
    setSelectedDropId(drop.id);
    setSelectedMarkerId(undefined);
    setTool("select");
    toast.success(`${drop.name} added — choose a team on the right`);
  };

  const setMarkerValue = (changes: Partial<DropMarker>) => {
    if (!selectedMarker) return;
    commitProject({ markers: project.markers.map((marker) => marker.id === selectedMarker.id ? { ...marker, ...changes } : marker) });
  };

  const autoArrange = () => {
    if (!selectedDrop) return;
    const markers = project.markers.filter((marker) => marker.dropId === selectedDrop.id);
    const offsets = layoutOffsets(markers.length);
    commitProject({ drops: project.drops.map((drop) => drop.id === selectedDrop.id ? { ...drop, layoutMode: "auto" } : drop), markers: project.markers.map((marker) => { const index = markers.findIndex((item) => item.id === marker.id); const offset = index >= 0 ? offsets[index] : undefined; return offset ? { ...marker, x: clamp(selectedDrop.x + offset[0]), y: clamp(selectedDrop.y + offset[1]) } : marker; }) });
    toast.success("Drop cluster rearranged");
  };

  const handleMarkerPointer = (event: ReactPointerEvent<HTMLButtonElement>, marker: DropMarker) => {
    event.stopPropagation();
    if (marker.locked) return;
    recordHistory();
    setSelectedMarkerId(marker.id);
    setSelectedDropId(marker.dropId);
    setDragging(marker.id);
  };

  const exportPng = async () => {
    if (!projectMap) return toast.error("This project needs a map before exporting.");
    const image = new Image();
    image.src = projectMap.imageData;
    image.onload = () => {
      const canvas = document.createElement("canvas");
      const width = 1800;
      const height = Math.round(width * (projectMap.height / projectMap.width));
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.drawImage(image, 0, 0, width, height);
      const scaleX = width / 100;
      const scaleY = height / 100;
      if (project.showConnectors) project.markers.forEach((marker) => { const drop = project.drops.find((item) => item.id === marker.dropId); const team = store.teams.find((item) => item.id === marker.teamId); if (!drop || !team || !marker.visible) return; context.beginPath(); context.moveTo(drop.x * scaleX, drop.y * scaleY); context.lineTo(marker.x * scaleX, marker.y * scaleY); context.strokeStyle = `${team.color}aa`; context.lineWidth = 3; context.setLineDash([8, 8]); context.stroke(); });
      project.markers.forEach((marker) => { const team = store.teams.find((item) => item.id === marker.teamId); if (!team || !marker.visible) return; const x = marker.x * scaleX; const y = marker.y * scaleY; const radius = 34 * marker.scale; context.setLineDash([]); context.beginPath(); context.arc(x, y, radius, 0, Math.PI * 2); context.fillStyle = "#070b13"; context.fill(); context.lineWidth = 5; context.strokeStyle = team.color; context.stroke(); context.fillStyle = "#fff"; context.font = `800 ${Math.max(18, 14 * marker.scale)}px Sora, sans-serif`; context.textAlign = "center"; context.textBaseline = "middle"; context.fillText(team.tag, x, y); });
      const link = document.createElement("a"); link.download = `${project.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`; link.href = canvas.toDataURL("image/png"); link.click(); toast.success("PNG export ready");
    };
  };

  return <div data-testid="editor-view" className="flex min-h-screen flex-col overflow-hidden bg-[#0B0F19] text-slate-100 md:h-screen"><header data-testid="editor-header" className="flex h-16 shrink-0 items-center justify-between border-b border-white/[0.08] bg-slate-950/90 px-4 backdrop-blur-xl md:px-6"><div className="flex min-w-0 items-center gap-4"><AppMark /><div className="hidden h-7 w-px bg-white/10 sm:block" /><div className="min-w-0"><p data-testid="editor-project-label" className="truncate font-heading text-sm font-semibold text-white">{project.name}</p><p data-testid="editor-map-label" className="truncate font-mono text-[9px] uppercase tracking-[0.18em] text-slate-500">{projectMap?.name ?? "No map selected"}</p></div></div><div className="flex items-center gap-2"><span data-testid="autosave-status" className="hidden items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-emerald-300 sm:flex"><Save className="size-3" />Autosaved</span><Button data-testid="editor-export-button" onClick={exportPng} className="bg-gradient-to-r from-violet-500 to-blue-500 text-white shadow-lg shadow-violet-500/20 hover:from-violet-400 hover:to-blue-400"><Download className="size-4" /><span className="hidden sm:inline">Export PNG</span></Button></div></header><div className="relative flex min-h-0 flex-1 flex-col md:flex-row"><ToolRail tool={tool} onTool={setTool} onUndo={undo} onRedo={redo} canUndo={past.length > 0} canRedo={future.length > 0} onHome={onHome} /><main data-testid="map-workspace" className="relative flex min-h-[62vh] flex-1 items-center justify-center overflow-hidden bg-[#05070D] p-4 pb-24 md:min-h-0 md:p-10 md:pb-10"><div className="pointer-events-none absolute inset-0 opacity-30 [background-image:radial-gradient(#334155_1px,transparent_1px)] [background-size:24px_24px]" /><div data-testid="map-stage" ref={stageRef} onPointerDown={addDrop} className={`relative aspect-[16/10] w-full max-w-5xl overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl shadow-black/50 ${tool === "drop" ? "cursor-crosshair ring-2 ring-violet-400/30" : "cursor-default"}`}><img data-testid="map-background-image" src={projectMap?.imageData} alt={projectMap?.name ?? "Map background"} className="absolute inset-0 size-full object-cover" /><div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(139,92,246,.10),transparent_35%,rgba(6,182,212,.08))]" /><svg data-testid="map-connector-layer" className="pointer-events-none absolute inset-0 z-10 size-full" viewBox="0 0 100 100" preserveAspectRatio="none">{project.showConnectors && project.markers.map((marker) => { const drop = project.drops.find((item) => item.id === marker.dropId); const team = store.teams.find((item) => item.id === marker.teamId); if (!drop || !team || !marker.visible) return null; return <line data-testid={`connector-line-${marker.id}`} key={marker.id} x1={drop.x} y1={drop.y} x2={marker.x} y2={marker.y} stroke={team.color} strokeOpacity=".72" strokeWidth=".32" strokeDasharray="1.3 1.3" />; })}</svg>{project.showAnchors && project.drops.map((drop) => <button data-testid={`drop-anchor-${drop.id}`} key={drop.id} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); setSelectedDropId(drop.id); setSelectedMarkerId(undefined); setTool("select"); }} style={{ left: `${drop.x}%`, top: `${drop.y}%` }} className={`absolute z-15 grid size-4 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-cyan-200 bg-cyan-400/40 shadow-[0_0_14px_rgba(34,211,238,.8)] transition-transform hover:scale-125 ${selectedDropId === drop.id ? "scale-125" : ""}`}><span className="size-1.5 rounded-full bg-white" /></button>)}{project.markers.map((marker) => <DropMarkerView key={marker.id} marker={marker} team={store.teams.find((team) => team.id === marker.teamId)} selected={selectedMarkerId === marker.id} onPointerDown={(event) => handleMarkerPointer(event, marker)} onSelect={() => { setSelectedMarkerId(marker.id); setSelectedDropId(marker.dropId); }} />)}<div data-testid="map-overlay-label" className="pointer-events-none absolute bottom-4 left-4 rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 backdrop-blur-md"><p className="font-mono text-[9px] uppercase tracking-[0.22em] text-cyan-300">{tool === "drop" ? "Click map to place drop" : "Tactical canvas"}</p><p className="mt-1 text-xs text-slate-300">{project.drops.length} drops · {project.markers.length} markers</p></div></div></main><aside data-testid="editor-properties-panel" className={`${glass} relative z-20 flex max-h-[38vh] w-full shrink-0 flex-col overflow-y-auto rounded-t-2xl border-b-0 p-4 md:max-h-none md:w-80 md:rounded-none md:rounded-l-2xl md:border-r-0 md:p-5`}><div className="flex items-start justify-between"><div><p data-testid="properties-eyebrow" className="font-mono text-[9px] uppercase tracking-[0.22em] text-cyan-300/70">Workspace controls</p><h2 data-testid="properties-title" className="mt-1 font-heading text-xl font-bold text-white">{selectedMarker ? "Marker settings" : selectedDrop ? selectedDrop.name : "Add to map"}</h2></div><Settings2 className="size-4 text-slate-500" /></div>{selectedMarker && selectedMarkerTeam ? <MarkerSettings marker={selectedMarker} team={selectedMarkerTeam} onChange={setMarkerValue} onDelete={() => { recordHistory(); onDeleteMarker(selectedMarker.id); }} /> : <><DropPanel selectedDrop={selectedDrop} project={project} store={store} filteredTeams={filteredTeams} search={teamSearch} onSearch={setTeamSearch} onSelectDrop={setSelectedDropId} onAddTeam={(teamId, type) => { recordHistory(); onAddTeam(teamId, type, selectedDropId); }} onAutoArrange={autoArrange} onToggleConnectors={() => commitProject({ showConnectors: !project.showConnectors })} onToggleAnchors={() => commitProject({ showAnchors: !project.showAnchors })} /></>}</aside></div><footer data-testid="editor-status-bar" className="hidden h-8 shrink-0 items-center justify-between border-t border-white/[0.08] bg-slate-950 px-5 font-mono text-[9px] uppercase tracking-widest text-slate-500 md:flex"><span data-testid="editor-coordinate-status">Relative coordinates · {projectMap?.width ?? 0} × {projectMap?.height ?? 0}</span><span data-testid="editor-help-status">Drag markers to fine-tune · Drop assignment stays intact</span><span data-testid="editor-saved-status" className="text-emerald-300/70">All changes saved locally</span></footer></div>;
}

function DropPanel({ selectedDrop, project, store, filteredTeams, search, onSearch, onSelectDrop, onAddTeam, onAutoArrange, onToggleConnectors, onToggleAnchors }: { selectedDrop?: DropLocation; project: Project; store: DropMapStore; filteredTeams: Team[]; search: string; onSearch: (value: string) => void; onSelectDrop: (id: string) => void; onAddTeam: (teamId: string, type: MarkerType) => void; onAutoArrange: () => void; onToggleConnectors: () => void; onToggleAnchors: () => void }) {
  const selectedMarkers = selectedDrop ? project.markers.filter((marker) => marker.dropId === selectedDrop.id) : [];
  return <div data-testid="drop-panel" className="mt-5 space-y-5"><div data-testid="drop-list-section"><div className="mb-2 flex items-center justify-between"><p data-testid="drop-list-label" className="font-mono text-[10px] uppercase tracking-widest text-slate-500">Drop locations</p><span data-testid="drop-count" className="font-mono text-[10px] text-cyan-300">{project.drops.length}</span></div><div className="space-y-1.5">{project.drops.map((drop) => { const count = project.markers.filter((marker) => marker.dropId === drop.id).length; return <button data-testid={`drop-list-item-${drop.id}`} key={drop.id} onClick={() => onSelectDrop(drop.id)} className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition ${selectedDrop?.id === drop.id ? "border-cyan-300/30 bg-cyan-300/10" : "border-transparent bg-white/[0.03] hover:border-white/10 hover:bg-white/[0.06]"}`}><span className="flex items-center gap-2"><MapPin className={`size-3.5 ${selectedDrop?.id === drop.id ? "text-cyan-300" : "text-slate-500"}`} /><span data-testid={`drop-list-name-${drop.id}`} className="font-heading text-sm font-semibold text-slate-200">{drop.name}</span></span><span data-testid={`drop-list-marker-count-${drop.id}`} className="font-mono text-[10px] text-slate-500">{count}/5</span></button>; })}</div></div>{selectedDrop ? <><div data-testid="selected-drop-team-section" className="border-t border-white/10 pt-4"><div className="flex items-center justify-between"><p data-testid="selected-drop-team-label" className="font-mono text-[10px] uppercase tracking-widest text-slate-500">Assign teams</p><Badge data-testid="selected-drop-layout-badge" className="border border-violet-300/20 bg-violet-400/10 font-mono text-[9px] uppercase text-violet-200">{selectedDrop.layoutMode}</Badge></div><div data-testid="selected-drop-markers" className="mt-3 flex flex-wrap gap-2">{selectedMarkers.length ? selectedMarkers.map((marker) => { const team = store.teams.find((item) => item.id === marker.teamId); return team ? <button data-testid={`assigned-team-${team.id}`} key={marker.id} className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-slate-200" title="Select marker" onClick={() => undefined}><TeamAvatar team={team} size="sm" /><span>{team.tag}</span></button> : null; }) : <span data-testid="selected-drop-empty" className="text-xs text-slate-500">No teams assigned yet</span>}</div><Button data-testid="auto-arrange-button" onClick={onAutoArrange} variant="outline" size="sm" className="mt-3 w-full border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.08] hover:text-white"><Grid3X3 className="size-3.5" />Auto-arrange cluster</Button></div><div data-testid="team-picker-section" className="border-t border-white/10 pt-4"><div className="flex items-center justify-between"><p data-testid="team-picker-label" className="font-mono text-[10px] uppercase tracking-widest text-slate-500">Add marker</p><span data-testid="team-picker-limit" className="font-mono text-[9px] text-slate-600">max 5 auto</span></div><div className="relative mt-2"><Search className="absolute left-2.5 top-2 size-3.5 text-slate-500" /><Input data-testid="team-search-input" value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Find a team" className="h-7 border-white/10 bg-white/[0.04] pl-8 text-xs text-white" /></div><div data-testid="team-picker-list" className="mt-2 max-h-32 space-y-1 overflow-y-auto">{filteredTeams.map((team) => <div data-testid={`team-picker-item-${team.id}`} key={team.id} className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-white/[0.05]"><span className="flex min-w-0 items-center gap-2"><TeamAvatar team={team} size="sm" /><span className="truncate text-xs text-slate-300">{team.tag}</span></span><div className="flex gap-1"><button data-testid={`add-tag-marker-${team.id}`} onClick={() => onAddTeam(team.id, "tag")} className="rounded-md border border-violet-400/20 px-2 py-1 font-mono text-[9px] text-violet-200 hover:bg-violet-400/15">TAG</button><button data-testid={`add-logo-marker-${team.id}`} onClick={() => onAddTeam(team.id, "logo")} className="rounded-md border border-cyan-400/20 px-2 py-1 font-mono text-[9px] text-cyan-200 hover:bg-cyan-400/15">LOGO</button></div></div>)}</div></div></> : <div data-testid="drop-empty-help" className="rounded-xl border border-dashed border-violet-400/20 bg-violet-400/[0.05] p-4"><p data-testid="drop-empty-help-title" className="font-heading text-sm font-semibold text-violet-100">Place your first drop</p><p data-testid="drop-empty-help-body" className="mt-1 text-xs leading-5 text-slate-400">Choose the pin tool on the left, then click anywhere on the map. Your team picker will appear here.</p></div>}<div data-testid="layers-section" className="border-t border-white/10 pt-4"><div className="mb-3 flex items-center gap-2"><Layers3 className="size-3.5 text-slate-500" /><p data-testid="layers-label" className="font-mono text-[10px] uppercase tracking-widest text-slate-500">Layers</p></div><LayerToggle testId="layer-background-toggle" label="Map background" enabled onChange={() => undefined} /><LayerToggle testId="layer-anchor-toggle" label="Drop anchors" enabled={project.showAnchors} onChange={onToggleAnchors} /><LayerToggle testId="layer-connector-toggle" label="Connector lines" enabled={project.showConnectors} onChange={onToggleConnectors} /></div></div>;
}

function LayerToggle({ testId, label, enabled, onChange }: { testId: string; label: string; enabled: boolean; onChange: () => void }) {
  return <button data-testid={testId} onClick={onChange} className="flex w-full items-center justify-between py-1.5 text-xs text-slate-300"><span className="flex items-center gap-2"><span className={`size-1.5 rounded-full ${enabled ? "bg-emerald-400 shadow-[0_0_7px_#34d399]" : "bg-slate-700"}`} />{label}</span><span data-testid={`${testId}-state`} className="font-mono text-[9px] uppercase text-slate-600">{enabled ? "on" : "off"}</span></button>;
}

function MarkerSettings({ marker, team, onChange, onDelete }: { marker: DropMarker; team: Team; onChange: (changes: Partial<DropMarker>) => void; onDelete: () => void }) {
  return <div data-testid="marker-settings" className="mt-6 space-y-5"><div data-testid="selected-team-summary" className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3"><TeamAvatar team={team} /><div><p data-testid="selected-team-name" className="font-heading text-sm font-semibold text-white">{team.name}</p><p data-testid="selected-team-tag" className="font-mono text-[10px] text-slate-500">{team.tag} · {marker.type} marker</p></div></div><div data-testid="marker-type-control"><p data-testid="marker-type-label" className="mb-2 font-mono text-[10px] uppercase tracking-widest text-slate-500">Marker style</p><div className="grid grid-cols-2 gap-2"><button data-testid="marker-type-tag-button" onClick={() => onChange({ type: "tag" })} className={`rounded-xl border p-3 text-left ${marker.type === "tag" ? "border-violet-400/40 bg-violet-400/10" : "border-white/10 bg-white/[0.03]"}`}><span className="font-heading text-sm font-bold text-white">{team.tag}</span><span className="mt-1 block font-mono text-[9px] text-slate-500">text tag</span></button><button data-testid="marker-type-logo-button" onClick={() => onChange({ type: "logo" })} className={`rounded-xl border p-3 text-left ${marker.type === "logo" ? "border-cyan-400/40 bg-cyan-400/10" : "border-white/10 bg-white/[0.03]"}`}>{team.logoData ? <img src={team.logoData} alt="" className="size-6 rounded-full" /> : <CircleDashed className="size-6 text-cyan-300" />}<span className="mt-1 block font-mono text-[9px] text-slate-500">image logo</span></button></div></div><label data-testid="marker-size-control" className="block"><span data-testid="marker-size-label" className="mb-2 flex justify-between font-mono text-[10px] uppercase tracking-widest text-slate-500"><span>Marker size</span><span data-testid="marker-size-value" className="text-cyan-300">{Math.round(marker.scale * 100)}%</span></span><input data-testid="marker-size-input" type="range" min="0.65" max="1.7" step="0.05" value={marker.scale} onChange={(event) => onChange({ scale: Number(event.target.value) })} className="w-full accent-violet-400" /></label><button data-testid="marker-lock-toggle" onClick={() => onChange({ locked: !marker.locked })} className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left text-xs text-slate-300 hover:bg-white/[0.06]"><span className="flex items-center gap-2">{marker.locked ? <Lock className="size-3.5 text-amber-300" /> : <MousePointer2 className="size-3.5 text-slate-500" />}{marker.locked ? "Position locked" : "Position unlocked"}</span><span className="font-mono text-[9px] uppercase text-slate-500">{marker.locked ? "locked" : "drag"}</span></button><Button data-testid="delete-marker-button" onClick={onDelete} variant="ghost" className="w-full justify-start text-red-300 hover:bg-red-500/10 hover:text-red-200"><Trash2 className="size-3.5" />Remove marker</Button></div>;
}

export default function Home() {
  const [store, setStore] = useState<DropMapStore>(() => loadStore());
  const [view, setView] = useState<"dashboard" | "editor">("dashboard");
  const [projectId, setProjectId] = useState(store.projects[0]?.id ?? "");
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [mapNameDraft, setMapNameDraft] = useState("");
  const mapInputRef = useRef<HTMLInputElement>(null);
  const activeProject = store.projects.find((project) => project.id === projectId);
  const activeMap = activeProject ? store.maps.find((map) => map.id === activeProject.mapId) : undefined;

  useEffect(() => { saveStore(store); }, [store]);

  const updateProject = (changes: Partial<Project>) => {
    setStore((current) => ({ ...current, projects: current.projects.map((project) => project.id === projectId ? { ...project, ...changes, updatedAt: Date.now() } : project) }));
  };

  const createProject = (mapId: string) => {
    const map = store.maps.find((item) => item.id === mapId);
    if (!map) return toast.error("Upload a map before creating a project.");
    const project: Project = { id: makeId("project"), name: `${map.name} / New drop sheet`, mapId, markers: [], drops: [], showConnectors: true, showAnchors: true, updatedAt: Date.now() };
    setStore((current) => ({ ...current, projects: [project, ...current.projects] }));
    setProjectId(project.id);
    setView("editor");
  };

  const openProject = (id: string) => { setProjectId(id); setView("editor"); };

  const addTeam = (team: Team) => {
    if (!team.name) { setShowTeamModal(true); return; }
    setStore((current) => ({ ...current, teams: [...current.teams, team] }));
  };

  const handleMapUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    readFileAsData(file, (imageData) => {
      const map: MapAsset = { id: makeId("map"), name: mapNameDraft.trim() || file.name.replace(/\.[^/.]+$/, ""), game: "Custom game", version: "Imported", description: "Uploaded from this browser.", imageData, width: 2048, height: 1280, createdAt: Date.now() };
      setStore((current) => ({ ...current, maps: [map, ...current.maps] }));
      setMapNameDraft("");
      toast.success(`${map.name} saved to your map library`);
    });
    event.target.value = "";
  };

  const duplicateMap = (map: MapAsset) => { const copy = { ...map, id: makeId("map"), name: `${map.name} / Copy`, createdAt: Date.now() }; setStore((current) => ({ ...current, maps: [copy, ...current.maps] })); toast.success("Map duplicated"); };
  const deleteMap = (map: MapAsset) => { if (store.maps.length <= 1) return toast.error("Keep at least one map in your library."); setStore((current) => ({ ...current, maps: current.maps.filter((item) => item.id !== map.id), projects: current.projects.filter((project) => project.mapId !== map.id) })); toast.success("Map removed from the library"); };
  const resetDemo = () => { setStore(createDemoStore()); setProjectId("project_demo"); setView("dashboard"); toast.success("Demo workspace restored"); };
  const addMarker = (teamId: string, type: MarkerType, selectedDropId?: string) => {
    if (!activeProject) return;
    const drop = selectedDropId ? activeProject.drops.find((item) => item.id === selectedDropId) : activeProject.drops[0];
    if (!drop) return toast.info("Place a drop on the map first.");
    const existing = activeProject.markers.filter((marker) => marker.dropId === drop.id);
    if (existing.length >= 5) return toast.error("This drop already has 5 team markers.");
    const team = store.teams.find((item) => item.id === teamId);
    if (!team) return;
    const marker = makeMarker(team, drop, type, existing.length);
    updateProject({ markers: [...activeProject.markers, marker] });
    toast.success(`${team.tag} added to ${drop.name}`);
  };
  const deleteMarker = (markerId: string) => { if (!activeProject) return; updateProject({ markers: activeProject.markers.filter((marker) => marker.id !== markerId) }); toast.success("Marker removed"); };

  if (view === "editor" && activeProject) return <Editor store={store} project={activeProject} map={activeMap} onHome={() => setView("dashboard")} onUpdateProject={updateProject} onAddTeam={(teamId, type, dropId) => addMarker(teamId, type, dropId)} onDeleteMarker={deleteMarker} />;
  return <><Dashboard store={store} onOpenProject={openProject} onCreateProject={createProject} onUploadMap={() => mapInputRef.current?.click()} onDuplicateMap={duplicateMap} onDeleteMap={deleteMap} onAddTeam={addTeam} onResetDemo={resetDemo} /><input data-testid="map-upload-input" ref={mapInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleMapUpload} className="hidden" /><div data-testid="map-name-helper" className="pointer-events-none fixed bottom-3 left-3 z-10 text-[10px] text-transparent">{mapNameDraft}</div>{showTeamModal && <TeamModal onClose={() => setShowTeamModal(false)} onCreate={addTeam} />}</>;
}