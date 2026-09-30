import { useState } from 'react';
import { Edit3, Globe2, Plus, Settings2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { id, matchesRegion, normalizeRegionName, type Region, type Team } from '@/lib/studio';
import { Action, Field, Modal, SelectField } from './Controls';

export function RegionSelect({ regions, teams, value, onChange, testId }: { regions: Region[]; teams: Team[]; value: string; onChange: (id: string) => void; testId: string }) {
  const options = [{ value: 'all', label: `All regions (${teams.length})` }, ...regions.map(r => ({ value: r.id, label: `${r.name} (${teams.filter(t => t.regionId === r.id).length})` })), { value: 'unassigned', label: `Unassigned (${teams.filter(t => matchesRegion(t, 'unassigned', regions)).length})` }];
  return <SelectField label="Filter by region" testId={testId} value={value} onChange={onChange} options={options} />;
}

export function TeamRegions({ regions, teams, value, onFilter, onChange }: { regions: Region[]; teams: Team[]; value: string; onFilter: (id: string) => void; onChange: (regions: Region[]) => void }) {
  const [manage, setManage] = useState(false);
  const filters = [{ id: 'all', name: 'All regions' }, ...regions, { id: 'unassigned', name: 'Unassigned' }];
  return <section className="team-regions" data-testid="team-regions">
    <div className="team-regions-heading"><div><Globe2 size={17} /><div><h2 data-testid="team-regions-title">Find your region</h2><p data-testid="team-regions-help">Keep your roster organized. Each team belongs to one region.</p></div></div><Action testId="manage-regions-button" onClick={() => setManage(true)}><Settings2 size={14} />Manage groups</Action></div>
    <div className="region-filters" data-testid="region-filters" role="group" aria-label="Filter teams by region">{filters.map(r => <button type="button" key={r.id} data-testid={`region-filter-${r.id}`} aria-pressed={value === r.id} className={value === r.id ? 'active' : ''} onClick={() => onFilter(r.id)}><span data-testid={`region-filter-name-${r.id}`}>{r.name}</span><em data-testid={`region-filter-count-${r.id}`}>{teams.filter(t => matchesRegion(t, r.id, regions)).length}</em></button>)}</div>
    {manage && <RegionManager regions={regions} teams={teams} onChange={onChange} onClose={() => setManage(false)} />}
  </section>;
}

function RegionManager({ regions, teams, onChange, onClose }: { regions: Region[]; teams: Team[]; onChange: (regions: Region[]) => void; onClose: () => void }) {
  const [editing, setEditing] = useState<string | null>(null), [name, setName] = useState(''), [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState('');
  const pending = regions.find(r => r.id === deleting);
  const reset = () => { setEditing(null); setName(''); setError(''); };
  const save = () => {
    const normalized = normalizeRegionName(name);
    if (!normalized) return setError('Enter a region name.');
    if (normalized.length > 40) return setError('Use 40 characters or fewer.');
    if (['ALL REGIONS', 'UNASSIGNED'].includes(normalized)) return setError('That name is reserved for the built-in filters.');
    if (regions.some(r => r.id !== editing && normalizeRegionName(r.name) === normalized)) return setError('A region with this name already exists.');
    onChange(editing ? regions.map(r => r.id === editing ? { ...r, name: normalized } : r) : [...regions, { id: id('region'), name: normalized }]);
    toast.success(editing ? 'Region renamed. Its teams stay assigned.' : 'Region group added.'); reset();
  };
  return <Modal testId="region-manager" title="Manage region groups" description="Add or rename groups for your roster. Deleting a group never deletes its teams." onClose={onClose}>
    <form className="region-form" data-testid="region-form" onSubmit={e => { e.preventDefault(); save(); }}>
      <Field label={editing ? 'Rename region' : 'New region name'} testId="region-name-input" value={name} maxLength={40} placeholder="e.g. EUROPE" onChange={v => { setName(v); setError(''); }} />
      {error && <p className="region-form-error" role="alert" data-testid="region-form-error">{error}</p>}
      <div className="region-form-actions">{editing && <Action testId="region-edit-cancel" onClick={reset}>Cancel edit</Action>}<button data-testid="region-save-button" className="studio-submit" type="submit"><Plus size={14} />{editing ? 'Save name' : 'Add group'}</button></div>
    </form>
    <div className="region-manager-list" data-testid="region-manager-list">{regions.map(r => <div className="region-manager-row" data-testid={`region-manager-row-${r.id}`} key={r.id}><div><b data-testid={`region-manager-name-${r.id}`}>{r.name}</b><span data-testid={`region-manager-teams-${r.id}`}>{teams.filter(t => t.regionId === r.id).length} teams</span></div><Action testId={`region-edit-${r.id}`} title={`Rename ${r.name}`} onClick={() => { setEditing(r.id); setName(r.name); setError(''); setDeleting(null); }}><Edit3 size={14} /></Action><Action testId={`region-delete-${r.id}`} title={`Delete ${r.name}`} danger onClick={() => setDeleting(r.id)}><Trash2 size={14} /></Action></div>)}{!regions.length && <p data-testid="regions-empty" className="note">No region groups yet. Your teams remain available under Unassigned.</p>}</div>
    {pending && <div className="region-delete-confirm" data-testid="region-delete-confirm" role="alert"><p data-testid="region-delete-message">Delete <strong>{pending.name}</strong>? Its {teams.filter(t => t.regionId === pending.id).length} teams will move to Unassigned. Existing drop maps will not change.</p><div className="dialog-actions"><Action testId="region-delete-cancel" onClick={() => setDeleting(null)}>Keep group</Action><Action testId="region-delete-confirm-button" danger onClick={() => { onChange(regions.filter(r => r.id !== pending.id)); if (editing === pending.id) reset(); setDeleting(null); toast.success('Group deleted. Its teams are now Unassigned.'); }}>Delete group</Action></div></div>}
    <p data-testid="regions-unassigned-note" className="note">Unassigned is a built-in category and cannot be renamed or deleted.</p>
  </Modal>;
}