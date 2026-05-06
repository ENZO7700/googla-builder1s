// Client-side persistence for Launch Readiness.
// TODO: migrate to Supabase tables (launch_projects, launch_scans) with RLS.
import { demoProject, demoScans } from './demoData';
import type { LaunchProject, Scan } from './types';

const PROJECTS_KEY = 'lg.projects.v1';
const SCANS_KEY = 'lg.scans.v1';

const isBrowser = () => typeof window !== 'undefined' && typeof localStorage !== 'undefined';

function read<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback; }
  catch { return fallback; }
}
function write<T>(key: string, value: T) {
  if (!isBrowser()) return;
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota */ }
}

function ensureDemoSeeded() {
  if (!isBrowser()) return;
  const projects = read<LaunchProject[]>(PROJECTS_KEY, []);
  if (!projects.find(p => p.id === demoProject.id)) {
    write(PROJECTS_KEY, [...projects, demoProject]);
  }
  const scans = read<Scan[]>(SCANS_KEY, []);
  if (!scans.find(s => s.projectId === demoProject.id)) {
    write(SCANS_KEY, [...scans, ...demoScans]);
  }
}

export function listProjects(): LaunchProject[] {
  ensureDemoSeeded();
  return read<LaunchProject[]>(PROJECTS_KEY, []);
}
export function getProject(id: string): LaunchProject | undefined {
  return listProjects().find(p => p.id === id);
}
export function saveProject(p: LaunchProject) {
  const all = listProjects().filter(x => x.id !== p.id);
  write(PROJECTS_KEY, [...all, p]);
}
export function deleteProject(id: string) {
  write(PROJECTS_KEY, listProjects().filter(p => p.id !== id));
  write(SCANS_KEY, read<Scan[]>(SCANS_KEY, []).filter(s => s.projectId !== id));
}

export function listScans(projectId?: string): Scan[] {
  ensureDemoSeeded();
  const all = read<Scan[]>(SCANS_KEY, []);
  const filtered = projectId ? all.filter(s => s.projectId === projectId) : all;
  return filtered.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}
export function getScan(id: string): Scan | undefined {
  return listScans().find(s => s.id === id);
}
export function saveScan(s: Scan) {
  const all = read<Scan[]>(SCANS_KEY, []).filter(x => x.id !== s.id);
  write(SCANS_KEY, [...all, s]);
}
