import { useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Download, FileJson, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import soraUrl from '@fontsource-variable/sora/files/sora-latin-wght-normal.woff2?url';
import instrumentUrl from '@fontsource-variable/instrument-sans/files/instrument-sans-latin-wght-normal.woff2?url';
import monoUrl from '@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2?url';
import { download, exportProject, filename, loadImage, type MapAsset, type Project, type Workspace } from '@/lib/studio';
import { MapScene } from './MapScene';
import { Action, Field, Modal, SelectField, Toggle } from './Controls';

let embeddedFonts: Promise<string> | undefined;
function fontCss() {
  if (!embeddedFonts) embeddedFonts = Promise.all([['Sora Variable', soraUrl], ['Instrument Sans Variable', instrumentUrl], ['JetBrains Mono Variable', monoUrl]].map(async ([family, url]) => {
    // These are bundled same-origin font assets, not backend API requests.
    const response = await fetch(url); if (!response.ok) throw new Error('Could not load export fonts. Please retry.');
    const blob = await response.blob();
    const data = await new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = reject; r.readAsDataURL(blob); });
    return `@font-face{font-family:'${family}';src:url('${data}') format('woff2');font-weight:100 900;}`;
  })).then(items => items.join('')).catch(error => { embeddedFonts = undefined; throw error; });
  return embeddedFonts;
}
const presets: Record<string, [number, number] | null> = { original: null, portrait: [1080, 1350], story: [1080, 1920], square: [1080, 1080], youtube: [1920, 1080], custom: null };
export function ExportDialog({ workspace, project, map, onClose }: { workspace: Workspace; project: Project; map: MapAsset; onClose: () => void }) {
  const [format, setFormat] = useState(workspace.preferences.exportFormat);
  const [preset, setPreset] = useState('original');
  const [quality, setQuality] = useState('high');
  const [customWidth, setCustomWidth] = useState(1920), [customHeight, setCustomHeight] = useState(1080);
  const [transparent, setTransparent] = useState(false), [busy, setBusy] = useState(false);
  let width = customWidth, height = customHeight;
  if (preset === 'original') {
    const max = quality === 'standard' ? Math.min(1080, Math.max(map.width, map.height)) : quality === '2k' ? 2048 : quality === '4k' ? 4096 : Math.max(map.width, map.height);
    const ratio = Math.min(max, 8192) / Math.max(map.width, map.height); width = Math.round(map.width * ratio); height = Math.round(map.height * ratio);
  } else if (presets[preset]) [width, height] = presets[preset]!;
  const valid = Number.isInteger(width) && Number.isInteger(height) && width >= 64 && height >= 64 && width <= 8192 && height <= 8192 && width * height <= 40000000;
  const runExport = async () => {
    if (!valid) return toast.error('Use dimensions from 64 to 8192 px, up to 40 megapixels.');
    setBusy(true);
    try {
      const css = await fontCss();
      const svg = renderToStaticMarkup(<svg xmlns="http://www.w3.org/2000/svg" width={map.width} height={map.height} viewBox={`0 0 1000 ${1000 * map.height / map.width}`}><style>{css}</style><MapScene project={project} map={map} teams={workspace.teams} /></svg>);
      // A data URL permits nested embedded logo/map images in SVG rasterization.
      const image = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Image export is unavailable in this browser.');
      if (!transparent || format === 'jpeg') { ctx.fillStyle = '#0b0f19'; ctx.fillRect(0, 0, width, height); }
      const fit = Math.min(width / map.width, height / map.height); const w = map.width * fit, h = map.height * fit;
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(image, (width - w) / 2, (height - h) / 2, w, h);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Unable to encode this image. Try a smaller export.')), `image/${format}`, quality === 'standard' ? .86 : .98));
      if (blob.type !== `image/${format}`) throw new Error('This browser does not support this export format. Choose PNG.');
      download(blob, `${filename(project.name)}-${width}x${height}.${format === 'jpeg' ? 'jpg' : format}`);
      toast.success(`${width} × ${height} ${format.toUpperCase()} exported`);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Export failed. Please try again.'); }
    finally { setBusy(false); }
  };
  return <Modal testId="export-dialog" title="Ready for the broadcast." description="A clean, high-resolution render. No editor controls. No cropping." onClose={busy ? () => undefined : onClose} wide><div className="export-layout"><div className="export-preview" data-testid="export-preview" style={{ aspectRatio: `${width || 1}/${height || 1}` }}><svg viewBox={`0 0 1000 ${1000 * map.height / map.width}`}><MapScene project={project} map={map} teams={workspace.teams} /></svg></div><div className="form-stack"><SelectField label="File format" testId="export-format" value={format} onChange={v => setFormat(v as typeof format)} options={[{ value: 'png', label: 'PNG · lossless' }, { value: 'jpeg', label: 'JPG · compact' }, { value: 'webp', label: 'WEBP · modern' }]} /><SelectField label="Canvas preset" testId="export-preset" value={preset} onChange={setPreset} options={[{ value: 'original', label: 'Original map ratio' }, { value: 'portrait', label: 'Instagram portrait · 1080 × 1350' }, { value: 'story', label: 'Instagram story · 1080 × 1920' }, { value: 'square', label: 'Square · 1080 × 1080' }, { value: 'youtube', label: 'YouTube · 1920 × 1080' }, { value: 'custom', label: 'Custom dimensions' }]} /><SelectField label={preset === 'original' ? 'Resolution / quality' : 'Encoding quality'} testId="export-quality" value={quality} onChange={setQuality} options={preset === 'original' ? [{ value: 'standard', label: 'Standard · up to 1080px' }, { value: 'high', label: 'High · original resolution (up to 8K)' }, { value: '2k', label: '2K · 2048px longest edge' }, { value: '4k', label: '4K · 4096px longest edge' }] : [{ value: 'standard', label: 'Standard' }, { value: 'high', label: 'High' }]} />{preset === 'custom' && <div className="field-pair"><Field label="Width" testId="export-width" type="number" value={customWidth} onChange={v => setCustomWidth(Number(v))} min={64} max={8192} /><Field label="Height" testId="export-height" type="number" value={customHeight} onChange={v => setCustomHeight(Number(v))} min={64} max={8192} /></div>}<Toggle label="Transparent empty areas" testId="export-transparent" checked={transparent} onChange={setTransparent} disabled={format === 'jpeg'} /><p className="note" data-testid="export-dimensions">{width} × {height} px · All visible layers included. The map always fits without cropping.</p><Action testId="export-download-button" primary disabled={busy || !valid} onClick={() => void runExport()}><Download size={16} />{busy ? 'Rendering image…' : `Download ${format === 'jpeg' ? 'JPG' : format.toUpperCase()}`}</Action><Action testId="export-project-button" onClick={() => exportProject(workspace, project)} disabled={busy}><FileJson size={16} />Export editable project</Action></div></div><p className="note" data-testid="export-backup-note"><ImageIcon size={13} /> Project files embed your map, logos and settings, ready to import in another browser.</p></Modal>;
}