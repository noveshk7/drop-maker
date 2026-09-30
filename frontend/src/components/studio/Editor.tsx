import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { ArrowLeft, Check, ChevronDown, Download, Expand, Hand, Layers3, MapPin, Maximize, Minus, MousePointer2, Plus, Redo2, Route as RouteIcon, Save, Type, Undo2, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { arrange, clamp, id, type Drop, type Point, type Project, type Route, type Team, type Workspace } from '@/lib/studio';
import { useProjectHistory } from '@/lib/use-project-history';
import { Action, Brand, Field, Modal, SelectField } from './Controls';
import { Inspector, type Panel } from './Inspector';
import { MapScene, type Pick, type Selection } from './MapScene';
import { ExportDialog } from './ExportDialog';

type Tool = 'select' | 'drop' | 'text' | 'route' | 'pan';
interface Drag { selection: Selection; start: Point; client: Point; before: Project; moved: boolean; pan: boolean; handle?: 'resize' | 'rotate' }
export function Editor({ workspace, initial, saveStatus, onChange, onHome, onSave, onCreateTeam, onEditTeam, onTemplate }: {
  workspace: Workspace; initial: Project; saveStatus: string; onChange: (project: Project) => void; onHome: () => void;
  onSave: (project: Project) => void; onCreateTeam: () => void; onEditTeam: (team: Team) => void; onTemplate: (name: string, project: Project) => void;
}) {
  const history = useProjectHistory(initial);
  const { project, commit, begin, end } = history;
  const map = workspace.maps.find(m => m.id === project.mapId)!;
  const [tool, setTool] = useState<Tool>('select'), [panel, setPanel] = useState<Panel>('drops');
  const [selection, setSelection] = useState<Selection>(null), [selectedDropId, setSelectedDropId] = useState<string | undefined>(project.drops[0]?.id);
  const [mobilePanel, setMobilePanel] = useState(false), [exportOpen, setExportOpen] = useState(false), [templateOpen, setTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState(''), [space, setSpace] = useState(false);
  const [routeKind, setRouteKind] = useState<Route['kind']>('arrow'), [draft, setDraft] = useState<Point[]>([]);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const rootRef = useRef<HTMLDivElement>(null), viewportRef = useRef<HTMLDivElement>(null), svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<Drag | null>(null), pointers = useRef(new Map<number, Point>());
  const gesture = useRef<{ distance: number; center: Point; view: Project['view'] } | null>(null);
  const wheelTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef({ history, tool, space }); latest.current = { history, tool, space };
  const height = 1000 * map.height / map.width;
  const fitWidth = Math.max(40, Math.min(size.width - 64, (size.height - 64) * map.width / map.height));
  const fitHeight = fitWidth * map.height / map.width;

  // Preview changes during a gesture stay in the editor. A completed gesture is
  // one history entry and one autosave, even when hundreds of pointer events fire.
  useEffect(() => { onChange(history.current.current); }, [history.revision]);
  useEffect(() => {
    const element = viewportRef.current; if (!element) return;
    const observer = new ResizeObserver(entries => { const r = entries[0].contentRect; setSize({ width: r.width, height: r.height }); });
    observer.observe(element); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const element = viewportRef.current; if (!element) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault(); const h = latest.current.history; h.begin();
      const current = h.current.current.view; const r = element.getBoundingClientRect();
      const zoom = clamp(current.zoom * Math.exp(-e.deltaY * (e.ctrlKey ? .01 : .002)), .25, 8);
      const factor = zoom / current.zoom;
      const ax = (e.clientX - r.left - r.width / 2) / r.width * 100, ay = (e.clientY - r.top - r.height / 2) / r.height * 100;
      h.commit({ view: { zoom, x: ax - (ax - current.x) * factor, y: ay - (ay - current.y) * factor } });
      clearTimeout(wheelTimer.current); wheelTimer.current = setTimeout(() => latest.current.history.end(), 200);
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => { element.removeEventListener('wheel', wheel); clearTimeout(wheelTimer.current); };
  }, []);
  useEffect(() => {
    if (!selection) return;
    const collection = selection.kind === 'marker' ? project.markers : selection.kind === 'drop' ? project.drops : selection.kind === 'label' ? project.labels : project.routes;
    if (!collection.some(item => item.id === selection.id)) setSelection(null);
  }, [project, selection]);

  const changeTool = (next: Tool) => { end(); setTool(next); setDraft([]); setMobilePanel(false); };
  const select = (s: Selection) => { setSelection(s); if (s?.kind === 'marker') setSelectedDropId(project.markers.find(m => m.id === s.id)?.dropId); if (s?.kind === 'drop') setSelectedDropId(s.id); };
  const point = (client: { clientX: number; clientY: number }): Point => {
    const matrix = svgRef.current?.getScreenCTM(); if (!matrix) return { x: 50, y: 50 };
    const p = new DOMPoint(client.clientX, client.clientY).matrixTransform(matrix.inverse()); return { x: p.x / 10, y: p.y / height * 100 };
  };
  const selectedLayer = (s: NonNullable<Selection>) => s.kind === 'marker' ? 'markers' : s.kind === 'drop' ? 'drops' : s.kind === 'label' ? 'labels' : 'routes';
  const locked = (s: Selection, p = history.current.current) => {
    if (!s) return false;
    if (p.layers.find(l => l.id === selectedLayer(s))?.locked) return true;
    return s.kind === 'marker' ? p.markers.find(m => m.id === s.id)?.locked : s.kind === 'label' ? p.labels.find(t => t.id === s.id)?.locked : s.kind === 'route' ? p.routes.find(r => r.id === s.id)?.locked : false;
  };
  const down = (e: ReactPointerEvent<HTMLElement | SVGElement>, target: Selection = null, handle?: 'resize' | 'rotate') => {
    if (e.button !== 0 && e.button !== 1) return;
    e.stopPropagation(); e.preventDefault(); viewportRef.current?.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      end(); begin(); const [a, b] = [...pointers.current.values()];
      gesture.current = { distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, view: history.current.current.view };
      drag.current = null; return;
    }
    if (pointers.current.size > 2) return;
    const pan = tool === 'pan' || space || e.button === 1;
    const chosen = tool === 'select' && !pan ? target : null;
    if (chosen) { select(chosen); setPanel(chosen.kind === 'drop' ? 'drops' : 'properties'); }
    begin(); drag.current = { selection: chosen, start: point(e), client: { x: e.clientX, y: e.clientY }, before: history.current.current, moved: false, pan, handle };
  };
  const pick: Pick = (kind, targetId, e, handle) => down(e, { kind, id: targetId }, handle);
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (g && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()], rect = viewportRef.current!.getBoundingClientRect();
      const zoom = clamp(g.view.zoom * Math.hypot(a.x - b.x, a.y - b.y) / g.distance, .25, 8), factor = zoom / g.view.zoom;
      const ax = (g.center.x - rect.left - rect.width / 2) / rect.width * 100, ay = (g.center.y - rect.top - rect.height / 2) / rect.height * 100;
      commit({ view: { zoom, x: ax - (ax - g.view.x) * factor + ((a.x + b.x) / 2 - g.center.x) / rect.width * 100, y: ay - (ay - g.view.y) * factor + ((a.y + b.y) / 2 - g.center.y) / rect.height * 100 } }); return;
    }
    const d = drag.current; if (!d) return;
    if (Math.hypot(e.clientX - d.client.x, e.clientY - d.client.y) < 3 && !d.moved) return;
    d.moved = true;
    if (d.pan) { commit({ view: { ...d.before.view, x: d.before.view.x + (e.clientX - d.client.x) / size.width * 100, y: d.before.view.y + (e.clientY - d.client.y) / size.height * 100 } }); return; }
    if (!d.selection || locked(d.selection, d.before)) return;
    const p = point(e), dx = p.x - d.start.x, dy = p.y - d.start.y;
    if (d.selection.kind === 'marker') {
      const m = d.before.markers.find(m => m.id === d.selection!.id)!;
      if (d.handle === 'resize') {
        const beforeDist = Math.hypot((d.start.x - m.x) * 10, (d.start.y - m.y) * height / 100);
        const dist = Math.hypot((p.x - m.x) * 10, (p.y - m.y) * height / 100);
        const scale = clamp(m.scale * dist / Math.max(beforeDist, 1), .3, 3);
        commit(current => arrange({ ...current, markers: current.markers.map(item => item.id === m.id ? { ...item, scale } : item) }, m.dropId, map));
      } else if (d.handle === 'rotate') {
        const rotation = Math.atan2((p.y - m.y) * height / 100, (p.x - m.x) * 10) * 180 / Math.PI + 90;
        commit({ markers: d.before.markers.map(item => item.id === m.id ? { ...item, rotation: Math.round(rotation) } : item) });
      } else {
        const marginX = 26 * m.scale / 10, marginY = 26 * m.scale / height * 100;
        commit({ markers: d.before.markers.map(item => item.id === m.id ? { ...item, x: clamp(m.x + dx, marginX, 100 - marginX), y: clamp(m.y + dy, marginY, 100 - marginY) } : item), drops: d.before.drops.map(drop => drop.id === m.dropId ? { ...drop, layoutMode: 'manual' } : drop) });
      }
    } else if (d.selection.kind === 'label') {
      commit({ labels: d.before.labels.map(t => t.id === d.selection!.id ? { ...t, x: clamp(t.x + dx, 1, 99), y: clamp(t.y + dy, 1, 99) } : t) });
    } else if (d.selection.kind === 'drop') {
      const old = d.before.drops.find(x => x.id === d.selection!.id)!; const x = clamp(old.x + dx, 1, 99), y = clamp(old.y + dy, 1, 99);
      commit(p => arrange({ ...p, drops: d.before.drops.map(drop => drop.id === old.id ? { ...drop, x, y } : drop), markers: d.before.markers.map(m => m.dropId === old.id && !m.locked ? { ...m, x: clamp(m.x + x - old.x, 3, 97), y: clamp(m.y + y - old.y, 3, 97) } : m) }, old.id, map));
    } else {
      const route = d.before.routes.find(r => r.id === d.selection!.id)!;
      const cx = clamp(dx, -Math.min(...route.points.map(p => p.x)), 100 - Math.max(...route.points.map(p => p.x)));
      const cy = clamp(dy, -Math.min(...route.points.map(p => p.y)), 100 - Math.max(...route.points.map(p => p.y)));
      commit({ routes: d.before.routes.map(r => r.id === route.id ? { ...r, points: r.points.map(p => ({ x: p.x + cx, y: p.y + cy })) } : r) });
    }
  };
  const finishRoute = (points = draft) => {
    if (points.length < 2) return toast.info('Choose at least two points for your route.');
    const route: Route = { id: id('route'), points, kind: routeKind, color: '#22d3ee', width: 3, opacity: 1, dashed: false, locked: false };
    commit(p => ({ ...p, routes: [...p.routes, route], layers: p.layers.map(l => l.id === 'routes' ? { ...l, visible: true } : l) }));
    setDraft([]); setSelection({ kind: 'route', id: route.id }); setTool('select'); setPanel('properties'); setMobilePanel(true);
  };
  const canvasClick = (p: Point) => {
    if (p.x < 0 || p.x > 100 || p.y < 0 || p.y > 100) return;
    const layer = tool === 'drop' ? 'drops' : tool === 'text' ? 'labels' : tool === 'route' ? 'routes' : null;
    if (layer && project.layers.find(l => l.id === layer)?.locked) return toast.info(`Unlock the ${layer} layer before adding items.`);
    if (tool === 'drop') {
      const drop: Drop = { ...p, id: id('drop'), name: `DROP ${String(project.drops.length + 1).padStart(2, '0')}`, layoutMode: 'auto', allowMore: false, showName: false };
      commit(current => ({ ...current, drops: [...current.drops, drop], layers: current.layers.map(l => l.id === 'drops' ? { ...l, visible: true } : l) }));
      setSelectedDropId(drop.id); setSelection({ kind: 'drop', id: drop.id }); setPanel('teams'); setMobilePanel(true); setTool('select'); toast.success('Drop placed. Assign a team to get started.');
    } else if (tool === 'text') {
      const label = { ...p, id: id('label'), text: 'ROTATION', font: 'Sora', size: 24, color: '#ffffff', background: 'none', bold: true, shadow: true, align: 'middle' as const, rotation: 0, opacity: 1, locked: false };
      commit(current => ({ ...current, labels: [...current.labels, label], layers: current.layers.map(l => l.id === 'labels' ? { ...l, visible: true } : l) }));
      setSelection({ kind: 'label', id: label.id }); setPanel('properties'); setMobilePanel(true); setTool('select');
    } else if (tool === 'route') {
      const points = [...draft, p]; if (points.length >= 2 && routeKind !== 'polyline') finishRoute(points); else setDraft(points);
    } else { setSelection(null); }
  };
  const up = (e: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
    if (gesture.current) { if (pointers.current.size < 2) { gesture.current = null; drag.current = null; pointers.current.clear(); end(); } return; }
    const d = drag.current; drag.current = null; end();
    if (d && !d.moved && !d.pan && !d.selection && e.type !== 'pointercancel') canvasClick(point(e));
    if (d?.selection && !d.moved) setMobilePanel(true);
  };
  const removeSelected = () => {
    if (!selection) return;
    if (locked(selection)) return toast.info('Unlock this item or its layer before deleting it.');
    if (selection.kind === 'marker') { const m = project.markers.find(m => m.id === selection.id); commit(p => arrange({ ...p, markers: p.markers.filter(m => m.id !== selection.id) }, m?.dropId ?? '', map)); }
    else if (selection.kind === 'drop') commit({ drops: project.drops.filter(d => d.id !== selection.id), markers: project.markers.filter(m => m.dropId !== selection.id) });
    else if (selection.kind === 'label') commit({ labels: project.labels.filter(t => t.id !== selection.id) });
    else commit({ routes: project.routes.filter(r => r.id !== selection.id) });
    setSelection(null);
  };
  const duplicateSelected = () => {
    if (!selection || locked(selection)) return toast.info('Unlock the item before duplicating it.');
    if (selection.kind === 'marker') {
      const m = project.markers.find(m => m.id === selection.id)!; const drop = project.drops.find(d => d.id === m.dropId)!;
      if (project.markers.filter(k => k.dropId === m.dropId).length >= 5 && !(drop.layoutMode === 'manual' && drop.allowMore)) return toast.info('Enable “Allow more than 5 manually” before duplicating this marker.');
      const copy = { ...m, id: id('marker'), x: clamp(m.x + 5, 3, 97), y: clamp(m.y + 5, 3, 97) };
      commit(p => arrange({ ...p, markers: [...p.markers, copy] }, m.dropId, map)); setSelection({ kind: 'marker', id: copy.id });
    } else if (selection.kind === 'label') {
      const t = project.labels.find(t => t.id === selection.id)!; const copy = { ...t, id: id('label'), x: clamp(t.x + 3), y: clamp(t.y + 3) };
      commit({ labels: [...project.labels, copy] }); setSelection({ kind: 'label', id: copy.id });
    } else if (selection.kind === 'route') {
      const r = project.routes.find(r => r.id === selection.id)!; const copy = { ...r, id: id('route'), points: r.points.map(p => ({ x: clamp(p.x + 3), y: clamp(p.y + 3) })) };
      commit({ routes: [...project.routes, copy] }); setSelection({ kind: 'route', id: copy.id });
    }
  };
  useEffect(() => {
    const keydown = (e: KeyboardEvent) => {
      const input = e.target instanceof HTMLElement && (e.target.matches('input,textarea,select') || e.target.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); end(); onSave(history.current.current); return; }
      if (input || exportOpen || templateOpen) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? history.redo() : history.undo(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); history.redo(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') { e.preventDefault(); end(); setExportOpen(true); }
      else if (e.code === 'Space') { e.preventDefault(); setSpace(true); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeSelected(); }
      else if (e.key === 'Escape') { setSelection(null); setDraft([]); setTool('select'); setMobilePanel(false); }
      else if (e.key === 'Enter' && tool === 'route' && draft.length >= 2) finishRoute();
    };
    const keyup = (e: KeyboardEvent) => { if (e.code === 'Space') setSpace(false); };
    const blur = () => { setSpace(false); drag.current = null; pointers.current.clear(); gesture.current = null; end(); };
    window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup); window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', blur); };
  });
  const zoom = (factor: number) => history.navigate({ ...project.view, zoom: clamp(project.view.zoom * factor, .25, 8) });
  const resetView = () => history.navigate({ zoom: 1, x: 0, y: 0 });
  const selectDrop = (d: Drop) => {
    select({ kind: 'drop', id: d.id }); setPanel('drops');
    history.navigate({ ...project.view, x: -(d.x - 50) / 100 * fitWidth * project.view.zoom / size.width * 100, y: -(d.y - 50) / 100 * fitHeight * project.view.zoom / size.height * 100 });
  };
  const toggleFullscreen = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else if (rootRef.current?.requestFullscreen) await rootRef.current.requestFullscreen(); else toast.info('Fullscreen is not supported by this browser. Use landscape for a larger canvas.'); } catch { toast.error('Your browser could not enter fullscreen.'); } };
  const tools = [{ id: 'select' as const, label: 'Select', Icon: MousePointer2 }, { id: 'drop' as const, label: 'Add drop', Icon: MapPin }, { id: 'text' as const, label: 'Add text', Icon: Type }, { id: 'route' as const, label: 'Draw route', Icon: RouteIcon }, { id: 'pan' as const, label: 'Pan · Space', Icon: Hand }];
  return <div data-testid="editor-view" className="studio-editor" ref={rootRef}><header className="editor-header"><Action testId="editor-back-button" title="Back to dashboard" onClick={() => { end(); onChange(history.current.current); onHome(); }}><ArrowLeft size={18} /></Action><Brand /><div className="editor-project"><Input data-testid="editor-project-name" aria-label="Project name" maxLength={120} value={project.name} onFocus={begin} onBlur={() => { if (!history.current.current.name.trim()) commit({ name: 'Untitled project' }); end(); }} onChange={e => commit({ name: e.target.value })} /><span data-testid="editor-map-label">{map.name} <b> / DROP SHEET</b></span></div><div className="header-actions"><span data-testid="autosave-status" className={`save-status ${saveStatus === 'Save failed' ? 'failed' : ''}`}><span />{saveStatus}</span><Action testId="editor-save-button" title="Save locally · Ctrl+S" onClick={() => { end(); onSave(history.current.current); }}><Save size={17} /></Action><Action testId="save-template-button" title="Save as reusable template" onClick={() => { setTemplateName(project.name); setTemplateOpen(true); }}><Layers3 size={17} /><span className="desktop-label">Template</span></Action><Action testId="editor-export-button" primary onClick={() => { end(); setExportOpen(true); }}><Download size={16} /><span>Export</span></Action></div></header>
    <div className="editor-body"><nav className="tool-rail" data-testid="editor-tool-rail">{tools.map(t => <Action key={t.id} testId={`editor-${t.id}-tool`} title={t.label} active={tool === t.id} onClick={() => changeTool(t.id)}><t.Icon size={19} /><span>{t.label.split(' ·')[0]}</span></Action>)}<div className="rail-divider" /><Action testId="editor-undo-button" title="Undo · Ctrl+Z" disabled={!history.canUndo} onClick={history.undo}><Undo2 size={19} /></Action><Action testId="editor-redo-button" title="Redo · Ctrl+Shift+Z" disabled={!history.canRedo} onClick={history.redo}><Redo2 size={19} /></Action><div className="rail-bottom"><Action testId="editor-fullscreen-button" title="Toggle fullscreen" onClick={() => void toggleFullscreen()}><Expand size={18} /></Action></div></nav>
      <main className={`canvas-workspace ${tool === 'pan' || space ? 'panning' : tool !== 'select' ? 'placing' : ''}`} data-testid="map-workspace" ref={viewportRef} onPointerDown={e => down(e)} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <div className="canvas-topline" data-testid="canvas-topline"><span><i /> LIVE CANVAS</span><span>{map.width} × {map.height} · ORIGINAL SOURCE</span></div>
        <svg data-testid="map-stage" ref={svgRef} className="map-stage" width={fitWidth} height={fitHeight} viewBox={`0 0 1000 ${height}`} style={{ width: fitWidth, height: fitHeight, transform: `translate(-50%, -50%) translate(${project.view.x / 100 * size.width}px, ${project.view.y / 100 * size.height}px) scale(${project.view.zoom})` }}>
          <MapScene project={project} map={map} teams={workspace.teams} selection={selection} pick={pick} />
          {draft.length > 0 && <g data-testid="route-draft"><polyline points={draft.map(p => `${p.x * 10},${p.y * height / 100}`).join(' ')} fill="none" stroke="#22d3ee" strokeWidth={3} strokeDasharray="5 4" />{draft.map((p, i) => <circle key={i} cx={p.x * 10} cy={p.y * height / 100} r={5} fill="#22d3ee" stroke="#ffffff" />)}</g>}
        </svg>
        {tool !== 'select' && tool !== 'pan' && <div className="canvas-instruction" data-testid="canvas-instruction" onPointerDown={e => e.stopPropagation()}>{tool === 'drop' ? 'Click the map to place a drop' : tool === 'text' ? 'Click the map to add a text label' : <><select data-testid="route-tool-kind" value={routeKind} onChange={e => { setRouteKind(e.target.value as Route['kind']); setDraft([]); }}><option value="arrow">Arrow</option><option value="line">Straight line</option><option value="polyline">Polyline</option></select><span>{draft.length ? `${draft.length} point${draft.length > 1 ? 's' : ''} · click to continue` : 'Click start, then destination'}</span>{routeKind === 'polyline' && <Action testId="finish-route-button" disabled={draft.length < 2} onClick={() => finishRoute()}><Check size={14} />Finish</Action>}</>}<Action testId="cancel-tool-button" title="Cancel tool" onClick={() => changeTool('select')}><X size={14} /></Action></div>}
        <div className="canvas-bottomline" onPointerDown={e => e.stopPropagation()}><div className="canvas-legend" data-testid="canvas-counts"><b>{project.drops.length}</b> DROPS <span /> <b>{project.markers.length}</b> MARKERS</div><div className="zoom-controls"><Action testId="editor-zoom-out-button" title="Zoom out" disabled={project.view.zoom <= .25} onClick={() => zoom(1 / 1.25)}><Minus size={15} /></Action><span data-testid="editor-zoom-value">{Math.round(project.view.zoom * 100)}%</span><Action testId="editor-zoom-in-button" title="Zoom in" disabled={project.view.zoom >= 8} onClick={() => zoom(1.25)}><Plus size={15} /></Action><Action testId="editor-fit-button" title="Fit map / reset view" onClick={resetView}><Maximize size={15} /></Action></div></div>
      </main>
      <div className={`inspector-shell ${mobilePanel ? 'mobile-open' : ''}`}><button data-testid="mobile-close-panel" className="mobile-panel-close" onClick={() => setMobilePanel(false)}><ChevronDown size={16} />Back to canvas</button><Inspector workspace={workspace} project={project} map={map} selection={selection} selectedDropId={selectedDropId} panel={panel} setPanel={setPanel} select={select} selectDrop={selectDrop} commit={commit} begin={begin} end={end} addDrop={() => changeTool('drop')} createTeam={onCreateTeam} editTeam={onEditTeam} removeSelected={removeSelected} duplicateSelected={duplicateSelected} /></div>
    </div><footer className="editor-status"><span data-testid="editor-coordinate-status">RELATIVE COORDINATES · SVG ENGINE</span><span data-testid="editor-shortcuts-hint">SPACE to pan &nbsp; / &nbsp; CTRL+Z undo &nbsp; / &nbsp; ESC deselect</span><span data-testid="editor-local-note">YOUR FILES. YOUR BROWSER.</span></footer>
    <nav className="mobile-editor-nav" data-testid="mobile-editor-nav"><Action testId="mobile-select-tool" title="Select" active={tool === 'select' && !mobilePanel} onClick={() => changeTool('select')}><MousePointer2 size={18} /><span>Select</span></Action><Action testId="mobile-add-tool" title="Add drop" active={tool === 'drop'} onClick={() => changeTool('drop')}><Plus size={18} /><span>Add</span></Action>{([{ key: 'drops', Icon: MapPin }, { key: 'teams', Icon: Users }, { key: 'layers', Icon: Layers3 }] as const).map(p => <Action key={p.key} testId={`mobile-panel-${p.key}`} title={p.key} active={mobilePanel && panel === p.key} onClick={() => { setPanel(p.key); setMobilePanel(true); }}><p.Icon size={18} /><span>{p.key}</span></Action>)}<Action testId="mobile-export-button" title="Export" onClick={() => setExportOpen(true)}><Download size={18} /><span>Export</span></Action></nav>
    {exportOpen && <ExportDialog workspace={workspace} project={project} map={map} onClose={() => setExportOpen(false)} />}
    {templateOpen && <Modal testId="template-modal" title="Save your playbook" description="Keep this map, roster, drops and annotations as a reusable starting point." onClose={() => setTemplateOpen(false)}><Field label="Template name" testId="template-name-input" value={templateName} onChange={setTemplateName} maxLength={120} /><Action testId="template-save-button" primary disabled={!templateName.trim()} onClick={() => { onTemplate(templateName.trim(), project); setTemplateOpen(false); }}>Save template</Action></Modal>}
  </div>;
}