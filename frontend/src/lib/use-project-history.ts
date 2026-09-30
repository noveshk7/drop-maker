import { useRef, useState } from 'react';
import type { Project } from './studio';

export function useProjectHistory(initial: Project) {
  const [project, setProject] = useState(initial);
  const [revision, setRevision] = useState(0);
  const current = useRef(initial);
  const past = useRef<Project[]>([]), future = useRef<Project[]>([]), baseline = useRef<Project | null>(null);
  const set = (p: Project) => { current.current = p; setProject(p); };
  const push = (p: Project) => { past.current = [...past.current.slice(-99), p]; future.current = []; };
  const commit = (patch: Partial<Project> | ((p: Project) => Project)) => {
    const old = current.current;
    const next = typeof patch === 'function' ? patch(old) : { ...old, ...patch };
    if (JSON.stringify(old) === JSON.stringify(next)) return;
    if (!baseline.current) push(old);
    set({ ...next, updatedAt: Date.now() });
    if (!baseline.current) setRevision(n => n + 1);
  };
  const begin = () => { if (!baseline.current) baseline.current = current.current; };
  const end = () => {
    const old = baseline.current; baseline.current = null;
    if (old && JSON.stringify(old) !== JSON.stringify(current.current)) { push(old); setRevision(n => n + 1); }
  };
  const undo = () => {
    end(); const p = past.current.pop(); if (!p) return;
    future.current.push(current.current); set({ ...p, updatedAt: Date.now() }); setRevision(n => n + 1);
  };
  const redo = () => {
    end(); const p = future.current.pop(); if (!p) return;
    past.current.push(current.current); set({ ...p, updatedAt: Date.now() }); setRevision(n => n + 1);
  };
  const navigate = (view: Project['view']) => { set({ ...current.current, view }); setRevision(n => n + 1); };
  return { project, current, revision, commit, begin, end, undo, redo, navigate, canUndo: past.current.length > 0, canRedo: future.current.length > 0 };
}