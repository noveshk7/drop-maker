import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { arrange, demoWorkspace, id, importProject, loadWorkspace, newProject, saveWorkspace, type MapAsset, type Project, type Team, type Template, type Workspace as WorkspaceData } from '@/lib/studio';
import { Action, Brand, Field, Modal } from '@/components/studio/Controls';
import { MapForm, ProjectForm, TeamForm } from '@/components/studio/AssetForms';
import { Editor } from '@/components/studio/Editor';
import { Library, type LibraryPage } from '@/components/studio/Library';

type Form = { kind: 'map'; existing?: MapAsset } | { kind: 'team'; existing?: Team } | { kind: 'project'; mapId?: string } | null;
export default function Workspace() {
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [page, setPage] = useState<LibraryPage>('dashboard'), [projectId, setProjectId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(null), [saveStatus, setSaveStatus] = useState('Opening workspace…');
  const [confirmation, setConfirmation] = useState<{ title: string; body: string; run: () => void } | null>(null);
  const [rename, setRename] = useState<Template | null>(null), [renameValue, setRenameValue] = useState('');
  const [importing, setImporting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null), latest = useRef<WorkspaceData | null>(null), saveVersion = useRef(0);
  latest.current = workspace;
  useEffect(() => {
    let live = true;
    void loadWorkspace().then(w => { if (live) setWorkspace(w); }).catch(e => { if (live) { setWorkspace(demoWorkspace()); setSaveStatus('Save failed'); toast.error((e as Error).message); } });
    return () => { live = false; };
  }, []);
  const persist = useCallback(async (w: WorkspaceData) => {
    const version = ++saveVersion.current; setSaveStatus('Saving…');
    try { await saveWorkspace(w); if (version === saveVersion.current) setSaveStatus('Saved locally'); }
    catch (e) { if (version === saveVersion.current) { setSaveStatus('Save failed'); toast.error((e as Error).message); } }
  }, []);
  useEffect(() => { if (workspace) void persist(workspace); }, [workspace, persist]);
  useEffect(() => {
    const before = (e: BeforeUnloadEvent) => { if (saveStatus === 'Saving…' || saveStatus === 'Save failed') { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', before); return () => window.removeEventListener('beforeunload', before);
  }, [saveStatus]);
  const update = (fn: (w: WorkspaceData) => WorkspaceData) => setWorkspace(w => w ? fn(w) : w);
  const updateProject = useCallback((project: Project) => setWorkspace(w => {
    if (!w) return w; const old = w.projects.find(p => p.id === project.id);
    if (old === project) return w;
    return { ...w, projects: w.projects.map(p => p.id === project.id ? project : p) };
  }), []);
  const active = workspace?.projects.find(p => p.id === projectId);
  const open = (p: Project) => { setProjectId(p.id); window.scrollTo(0, 0); };
  const create = (mapId?: string) => { if (!workspace?.maps.length) { toast.info('Upload your first map, then create a project.'); setForm({ kind: 'map' }); } else setForm({ kind: 'project', mapId }); };
  const addDemo = () => {
    const demo = demoWorkspace(); const map = { ...demo.maps[0], id: id('map') };
    const teamMap = new Map(demo.teams.map(t => [t.id, id('team')])); const teams = demo.teams.map(t => ({ ...t, id: teamMap.get(t.id)! }));
    const project = { ...demo.projects[0], id: id('project'), mapId: map.id, markers: demo.projects[0].markers.map(m => ({ ...m, teamId: teamMap.get(m.teamId)! })) };
    update(w => ({ ...w, maps: [...w.maps, map], teams: [...w.teams, ...teams], projects: [project, ...w.projects] })); open(project); toast.success('Fresh practice workspace added without changing your projects.');
  };
  const uploadProject = async (file?: File) => {
    if (!file || !latest.current) return; setImporting(true);
    try {
      const result = await importProject(file, latest.current);
      // Only append imported entities; never overwrite edits completed while reading.
      const existing = new Set(latest.current.maps.map(m => m.id)), existingTeams = new Set(latest.current.teams.map(t => t.id));
      update(w => ({ ...w, maps: [...w.maps, ...result.workspace.maps.filter(m => !existing.has(m.id))], teams: [...w.teams, ...result.workspace.teams.filter(t => !existingTeams.has(t.id))], projects: [result.project, ...w.projects] }));
      open(result.project); toast.success('Project, map and logos restored.');
    } catch (e) { toast.error((e as Error).message); } finally { setImporting(false); }
  };
  if (!workspace) return <div className="studio-loading" data-testid="workspace-loading"><Brand /><span data-testid="workspace-loading-label">Opening your local workspace…</span></div>;
  return <>
    {active ? <Editor key={active.id} workspace={workspace} initial={active} saveStatus={saveStatus} onChange={updateProject} onHome={() => { setProjectId(null); setPage('projects'); }} onSave={p => { updateProject(p); const w = latest.current; if (w) void persist({ ...w, projects: w.projects.map(item => item.id === p.id ? p : item) }); }} onCreateTeam={() => setForm({ kind: 'team' })} onEditTeam={team => setForm({ kind: 'team', existing: team })} onTemplate={(name, p) => { update(w => ({ ...w, templates: [...w.templates, { id: id('template'), name, project: structuredClone(p) }] })); toast.success('Template saved. Find it in your Templates library.'); }} /> : <Library workspace={workspace} page={page} setPage={setPage} saveStatus={saveStatus} uploadMap={() => setForm({ kind: 'map' })} editMap={m => setForm({ kind: 'map', existing: m })} duplicateMap={m => { update(w => ({ ...w, maps: [...w.maps, { ...m, id: id('map'), name: `${m.name} · Copy`, createdAt: Date.now() }] })); toast.success('Map duplicated.'); }} deleteMap={m => setConfirmation({ title: `Delete ${m.name}?`, body: `This removes the saved map and its ${workspace.projects.filter(p => p.mapId === m.id).length} projects and related templates. Other maps are not affected. Export backups first.`, run: () => update(w => ({ ...w, maps: w.maps.filter(x => x.id !== m.id), projects: w.projects.filter(p => p.mapId !== m.id), templates: w.templates.filter(t => t.project.mapId !== m.id) })) })} createProject={create} openProject={open} duplicateProject={p => { update(w => ({ ...w, projects: [{ ...structuredClone(p), id: id('project'), name: `${p.name} · Copy`, updatedAt: Date.now() }, ...w.projects] })); toast.success('Project duplicated.'); }} deleteProject={p => setConfirmation({ title: `Delete ${p.name}?`, body: 'This deletes the drop sheet. Your original map and reusable teams stay in their libraries.', run: () => update(w => ({ ...w, projects: w.projects.filter(x => x.id !== p.id) })) })} addTeam={() => setForm({ kind: 'team' })} editTeam={t => setForm({ kind: 'team', existing: t })} deleteTeam={t => setConfirmation({ title: `Delete ${t.name}?`, body: 'This removes the team and its markers from all projects and templates. Export any projects you want to keep unchanged first.', run: () => update(w => { const clean = (p: Project) => { let next = { ...p, markers: p.markers.filter(m => m.teamId !== t.id) }; const map = w.maps.find(m => m.id === p.mapId); if (map) p.drops.forEach(d => { next = arrange(next, d.id, map); }); return next; }; return { ...w, teams: w.teams.filter(x => x.id !== t.id), projects: w.projects.map(clean), templates: w.templates.map(temp => ({ ...temp, project: clean(temp.project) })) }; }) })} importFile={() => inputRef.current?.click()} useTemplate={t => { const p = { ...structuredClone(t.project), id: id('project'), name: `${t.name} · New match`, updatedAt: Date.now() }; update(w => ({ ...w, projects: [p, ...w.projects] })); open(p); }} deleteTemplate={t => setConfirmation({ title: `Delete template ${t.name}?`, body: 'Projects already made from this template are not affected.', run: () => update(w => ({ ...w, templates: w.templates.filter(x => x.id !== t.id) })) })} renameTemplate={t => { setRename(t); setRenameValue(t.name); }} preferences={changes => update(w => ({ ...w, preferences: { ...w.preferences, ...changes } }))} clear={() => setConfirmation({ title: 'Clear your entire workspace?', body: 'All saved maps, teams, projects and templates will be removed from this browser. This cannot be undone. Download project backups before continuing.', run: () => { update(w => ({ ...w, maps: [], teams: [], projects: [], templates: [] })); localStorage.removeItem('drop-map-creator-store-v1'); } })} addDemo={addDemo} retrySave={() => void persist(workspace)} />}
    <input data-testid="project-import-input" ref={inputRef} type="file" accept=".project,.json,application/json" hidden onChange={e => { void uploadProject(e.target.files?.[0]); e.target.value = ''; }} />
    {form?.kind === 'map' && <MapForm existing={form.existing} onClose={() => setForm(null)} onSave={m => { update(w => ({ ...w, maps: w.maps.some(x => x.id === m.id) ? w.maps.map(x => x.id === m.id ? m : x) : [...w.maps, m] })); setPage('maps'); toast.success('Map saved at its original resolution.'); }} />}
    {form?.kind === 'team' && <TeamForm existing={form.existing} trimLogos={workspace.preferences.trimLogos} onClose={() => setForm(null)} onSave={t => { update(w => ({ ...w, teams: w.teams.some(x => x.id === t.id) ? w.teams.map(x => x.id === t.id ? t : x) : [...w.teams, t] })); toast.success('Team saved to your reusable roster.'); }} />}
    {form?.kind === 'project' && <ProjectForm workspace={workspace} mapId={form.mapId} onClose={() => setForm(null)} onCreate={(mapId, name) => { const project = newProject(mapId, name); update(w => ({ ...w, projects: [project, ...w.projects] })); open(project); }} />}
    {confirmation && <Modal testId="confirmation-dialog" title={confirmation.title} description={confirmation.body} onClose={() => setConfirmation(null)}><div className="dialog-actions"><Action testId="confirm-cancel-button" onClick={() => setConfirmation(null)}>Keep it</Action><Action testId="confirm-delete-button" danger onClick={() => { confirmation.run(); setConfirmation(null); toast.success('Removed from this workspace.'); }}>Delete permanently</Action></div></Modal>}
    {rename && <Modal testId="rename-template-dialog" title="Rename template" description="Give this reusable setup a recognizable name." onClose={() => setRename(null)}><Field label="Name" testId="rename-template-name" value={renameValue} onChange={setRenameValue} maxLength={120} /><Action testId="rename-template-save" primary disabled={!renameValue.trim()} onClick={() => { update(w => ({ ...w, templates: w.templates.map(t => t.id === rename.id ? { ...t, name: renameValue.trim() } : t) })); setRename(null); }}>Save name</Action></Modal>}
    {importing && <div className="import-status" data-testid="import-status">Restoring map, logos and project…</div>}
  </>;
}