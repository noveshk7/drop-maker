import { memo } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { MapAsset, Marker, Project, Team } from '@/lib/studio';

export type Selection = { kind: 'marker' | 'drop' | 'label' | 'route'; id: string } | null;
export type Pick = (kind: NonNullable<Selection>['kind'], id: string, event: ReactPointerEvent<SVGElement>, handle?: 'resize' | 'rotate') => void;
export const svgFont = (font: string) => ({ Sora: 'Sora Variable', 'Instrument Sans': 'Instrument Sans Variable', 'JetBrains Mono': 'JetBrains Mono Variable' }[font] ?? font);
function Shape({ marker, clip = false }: { marker: Marker; clip?: boolean }) {
  const props = { fill: clip ? '#fff' : marker.background, stroke: clip ? 'none' : marker.borderColor, strokeWidth: marker.borderWidth };
  if (marker.shape === 'circle' || marker.shape === 'pin') return <circle r={24} {...props} />;
  return <rect x={-24} y={-24} width={48} height={48} rx={marker.shape === 'rounded' ? 10 : marker.shape === 'custom' ? marker.cornerRadius : 0} {...props} />;
}
const TeamMarker = memo(function TeamMarker({ marker, team, height, selected, pick }: { marker: Marker; team?: Team; height: number; selected: boolean; pick?: Pick }) {
  if (!team || !marker.visible) return null;
  const logoSize = (48 - marker.logoPadding * 2) * marker.logoScale;
  const clipId = `clip-${marker.id}`;
  return <g data-testid={`map-marker-${marker.id}`} data-x={marker.x} data-y={marker.y} data-drop-id={marker.dropId} data-locked={marker.locked} role={pick ? 'button' : undefined} aria-label={`${team.name} marker`} tabIndex={pick ? 0 : undefined} onKeyDown={pick ? e => { if (e.key === 'Enter') { e.currentTarget.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); } } : undefined} onPointerDown={e => pick?.('marker', marker.id, e)} transform={`translate(${marker.x * 10} ${marker.y * height / 100}) rotate(${marker.rotation}) scale(${marker.scale})`} opacity={marker.opacity} style={{ cursor: pick ? marker.locked ? 'pointer' : 'grab' : undefined }}>
    <title>{`${team.name} · ${team.tag}${marker.locked ? ' · Locked' : ''}`}</title>
    <defs><clipPath id={clipId}><Shape marker={marker} clip /></clipPath></defs>
    {selected && <circle data-testid="marker-selection-ring" r={30} fill="none" stroke="#67e8f9" strokeWidth={1.5} strokeDasharray="4 3" />}
    <g filter={marker.shadow ? 'url(#marker-shadow)' : undefined}>
      {marker.shape === 'pin' && <path d="M-10 19 L0 37 L10 19" fill={marker.background} stroke={marker.borderColor} strokeWidth={marker.borderWidth} />}
      <Shape marker={marker} />
    </g>
    {marker.type === 'logo' && team.logoData ? <g clipPath={`url(#${clipId})`}><image data-testid={`map-marker-logo-${marker.id}`} href={team.logoData} x={-logoSize / 2 + marker.logoX} y={-logoSize / 2 + marker.logoY} width={logoSize} height={logoSize} preserveAspectRatio={marker.logoFit === 'contain' ? 'xMidYMid meet' : 'xMidYMid slice'} pointerEvents="none" /></g> : <text data-testid={`map-marker-tag-${marker.id}`} textAnchor="middle" dominantBaseline="central" fontFamily={svgFont(marker.font)} fontWeight={800} fontSize={marker.fontSize} fill={marker.textColor} pointerEvents="none">{team.tag}</text>}
    {marker.locked && selected && <text data-testid="marker-lock-indicator" x={-25} y={-31} fill="#fbbf24" fontSize={9}>LOCKED</text>}
    {selected && !marker.locked && pick && <g><rect data-testid="marker-resize-handle" aria-label="Resize marker" x={22} y={22} width={9} height={9} fill="#67e8f9" stroke="#07101c" strokeWidth={2} cursor="nwse-resize" onPointerDown={e => pick('marker', marker.id, e, 'resize')} /><path d="M0 -30V-41" stroke="#67e8f9" /><circle data-testid="marker-rotate-handle" aria-label="Rotate marker" cy={-43} r={5} fill="#67e8f9" stroke="#07101c" strokeWidth={2} cursor="crosshair" onPointerDown={e => pick('marker', marker.id, e, 'rotate')} /></g>}
  </g>;
});

export const MapScene = memo(function MapScene({ project, map, teams, selection = null, pick }: { project: Project; map: MapAsset; teams: Team[]; selection?: Selection; pick?: Pick }) {
  const h = 1000 * map.height / map.width;
  const teamIndex = new Map(teams.map(t => [t.id, t]));
  const dropIndex = new Map(project.drops.map(d => [d.id, d]));
  const markerVisible = project.layers.find(l => l.id === 'markers')?.visible;
  return <>
    <defs><filter id="marker-shadow" x="-60%" y="-60%" width="220%" height="240%"><feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#000000" floodOpacity=".65" /></filter><filter id="text-shadow" x="-20%" y="-40%" width="140%" height="180%"><feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000000" floodOpacity=".95" /></filter></defs>
    {project.layers.map(layer => !layer.visible ? null : <g key={layer.id} data-testid={`scene-layer-${layer.id}`}>
      {layer.id === 'background' && <image data-testid="map-background-image" href={map.imageData} width={1000} height={h} preserveAspectRatio="none" pointerEvents="none" />}
      {layer.id === 'grid' && <g opacity={project.gridOpacity} pointerEvents="none">{Array.from({ length: 11 }, (_, i) => <g key={i}><line x1={i * 100} y1={0} x2={i * 100} y2={h} stroke="#ffffff" strokeWidth={1} /><line x1={0} y1={i * h / 10} x2={1000} y2={i * h / 10} stroke="#ffffff" strokeWidth={1} />{project.gridCoordinates && i < 10 && <><text x={i * 100 + 50} y={18} textAnchor="middle" fill="#ffffff" fontFamily="Verdana" fontSize={13}>{String.fromCharCode(65 + i)}</text><text x={8} y={(i + .5) * h / 10} fill="#ffffff" fontFamily="Verdana" fontSize={13}>{i + 1}</text></>}</g>)}</g>}
      {layer.id === 'connectors' && markerVisible && project.markers.filter(m => m.visible && m.connector).map(m => { const d = dropIndex.get(m.dropId); return d && <line key={m.id} data-testid={`connector-line-${m.id}`} x1={m.x * 10} y1={m.y * h / 100} x2={d.x * 10} y2={d.y * h / 100} stroke={project.connectorColor} strokeWidth={project.connectorWidth} strokeDasharray={project.connectorDashed ? '6 5' : undefined} opacity={m.opacity * .8} pointerEvents="none" />; })}
      {layer.id === 'drops' && project.drops.map(d => <g data-testid={`drop-anchor-${d.id}`} key={d.id} transform={`translate(${d.x * 10} ${d.y * h / 100})`} onPointerDown={e => pick?.('drop', d.id, e)} style={{ cursor: pick ? 'pointer' : undefined }}><title>{d.name}</title><circle r={selection?.id === d.id || (selection?.kind === 'marker' && project.markers.find(m => m.id === selection.id)?.dropId === d.id) ? 8 : 5} fill="#22d3ee" fillOpacity={.45} stroke="#cffafe" strokeWidth={1.5} /><circle r={1.5} fill="#ffffff" />{d.showName && <text data-testid={`drop-map-name-${d.id}`} y={-14} textAnchor="middle" fontSize={12} fontWeight={700} fontFamily="Verdana" fill="#ffffff" filter="url(#text-shadow)">{d.name}</text>}</g>)}
      {layer.id === 'markers' && project.markers.map(m => <TeamMarker key={m.id} marker={m} team={teamIndex.get(m.teamId)} height={h} selected={selection?.kind === 'marker' && selection.id === m.id} pick={pick} />)}
      {layer.id === 'routes' && project.routes.map(r => { const points = r.points.map(p => `${p.x * 10},${p.y * h / 100}`).join(' '); return <g data-testid={`map-route-${r.id}`} key={r.id} onPointerDown={e => pick?.('route', r.id, e)} cursor={pick ? 'pointer' : undefined}><defs><marker id={`arrow-${r.id}`} viewBox="0 0 10 10" refX={9} refY={5} markerWidth={7} markerHeight={7} orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10Z" fill={r.color} /></marker></defs>{selection?.id === r.id && <polyline points={points} fill="none" stroke="#67e8f9" strokeWidth={r.width + 6} opacity={.45} />}<polyline points={points} fill="none" stroke={r.color} strokeWidth={r.width} strokeDasharray={r.dashed ? '10 7' : undefined} strokeLinecap="round" strokeLinejoin="round" opacity={r.opacity} markerEnd={r.kind === 'arrow' ? `url(#arrow-${r.id})` : undefined} />{pick && <polyline points={points} fill="none" stroke="transparent" strokeWidth={Math.max(15, r.width)} />}</g>; })}
      {layer.id === 'labels' && project.labels.map(t => { const lines = t.text.split('\n'); const width = Math.max(...lines.map(s => s.length), 1) * t.size * .64 + 14; const x = t.align === 'start' ? -7 : t.align === 'end' ? -width + 7 : -width / 2; return <g data-testid={`map-label-${t.id}`} key={t.id} transform={`translate(${t.x * 10} ${t.y * h / 100}) rotate(${t.rotation})`} opacity={t.opacity} onPointerDown={e => pick?.('label', t.id, e)} cursor={pick ? 'grab' : undefined}><rect x={x} y={-t.size * .8} width={width} height={t.size * lines.length * 1.25} rx={4} fill={t.background === 'none' ? 'transparent' : t.background} stroke={selection?.id === t.id ? '#67e8f9' : 'none'} strokeDasharray="4 3" /><text data-testid={`map-label-text-${t.id}`} fill={t.color} fontFamily={svgFont(t.font)} fontSize={t.size} fontWeight={t.bold ? 800 : 400} textAnchor={t.align} filter={t.shadow ? 'url(#text-shadow)' : undefined}>{lines.map((line, i) => <tspan key={i} x={0} dy={i ? t.size * 1.25 : 0}>{line || ' '}</tspan>)}</text></g>; })}
    </g>)}
  </>;
});