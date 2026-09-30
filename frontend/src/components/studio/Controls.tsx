import type { ReactNode } from 'react';
import { MapPin, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';

export function Brand() { return <div className="brand" data-testid="app-brand"><div className="brand-icon"><MapPin size={21} /></div><div><b data-testid="brand-name">DROP<span>//</span>MAP</b><small data-testid="brand-caption">TACTICAL STUDIO</small></div></div>; }
export function Action({ children, testId, onClick, active = false, disabled = false, title, primary = false, danger = false, className = '' }: { children: ReactNode; testId: string; onClick?: () => void; active?: boolean; disabled?: boolean; title?: string; primary?: boolean; danger?: boolean; className?: string }) {
  return <Button type="button" data-testid={testId} aria-label={title} title={title} disabled={disabled} onClick={onClick} variant={primary ? 'default' : 'ghost'} className={`studio-action ${primary ? 'primary' : ''} ${active ? 'active' : ''} ${danger ? 'danger' : ''} ${className}`}>{children}</Button>;
}
export function Modal({ title, description, testId, onClose, children, wide = false }: { title: string; description: string; testId: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent data-testid={testId} showCloseButton={false} className={`studio-dialog ${wide ? 'wide' : ''}`}><div className="dialog-heading"><div><DialogTitle data-testid={`${testId}-title`}>{title}</DialogTitle><DialogDescription data-testid={`${testId}-description`}>{description}</DialogDescription></div><Action testId={`${testId}-close`} title="Close dialog" onClick={onClose}><X size={18} /></Action></div>{children}</DialogContent></Dialog>;
}
export function Field({ label, testId, value, onChange, type = 'text', min, max, step, placeholder, disabled, maxLength }: { label: string; testId: string; value: string | number; onChange: (v: string) => void; type?: string; min?: number; max?: number; step?: number; placeholder?: string; disabled?: boolean; maxLength?: number }) {
  return <label className="studio-field" data-testid={`${testId}-field`}><span data-testid={`${testId}-label`}>{label}</span><Input data-testid={testId} value={value} type={type} min={min} max={max} step={step} placeholder={placeholder} disabled={disabled} maxLength={maxLength} onChange={e => onChange(e.target.value)} /></label>;
}
export function SelectField({ label, testId, value, onChange, options, disabled }: { label: string; testId: string; value: string; onChange: (v: string) => void; options: (string | { value: string; label: string })[]; disabled?: boolean }) {
  return <label className="studio-field" data-testid={`${testId}-field`}><span data-testid={`${testId}-label`}>{label}</span><select data-testid={testId} value={value} disabled={disabled} onChange={e => onChange(e.target.value)}>{options.map(o => <option key={typeof o === 'string' ? o : o.value} value={typeof o === 'string' ? o : o.value}>{typeof o === 'string' ? o : o.label}</option>)}</select></label>;
}
export function Toggle({ label, testId, checked, onChange, disabled = false }: { label: string; testId: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  return <label className={`studio-toggle ${disabled ? 'disabled' : ''}`} data-testid={`${testId}-field`}><span data-testid={`${testId}-label`}>{label}</span><input data-testid={testId} type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} /></label>;
}
export function Range({ label, testId, value, min, max, step = 1, onChange, begin, end, disabled = false }: { label: string; testId: string; value: number; min: number; max: number; step?: number; onChange: (n: number) => void; begin?: () => void; end?: () => void; disabled?: boolean }) {
  return <label className="studio-field" data-testid={`${testId}-field`}><span data-testid={`${testId}-label`}>{label}<em data-testid={`${testId}-value`}>{Number(value.toFixed(2))}</em></span><input data-testid={testId} disabled={disabled} type="range" value={value} min={min} max={max} step={step} onPointerDown={begin} onPointerUp={end} onPointerCancel={end} onBlur={end} onKeyDown={e => { if (e.key.startsWith('Arrow')) begin?.(); }} onKeyUp={end} onChange={e => onChange(Number(e.target.value))} /></label>;
}
export function Section({ title, children, testId }: { title: string; children: ReactNode; testId: string }) { return <section data-testid={testId} className="inspector-section"><h3 data-testid={`${testId}-title`}>{title}</h3>{children}</section>; }