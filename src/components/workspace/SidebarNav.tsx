import { ReactNode, useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, LayoutGrid, ShieldAlert, Code2, Plug, Layout,
  Settings, History, LogOut, Sun, Moon, Trash2, Search, Pencil, Check, X, Github, Rocket, FileText,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { isAdminEmail } from '@/lib/admin';
import { cn } from '@/lib/utils';

const SIDEBAR_WIDTH_PX = 280;
const SIDEBAR_COLLAPSED_KEY = 'wpbox.sidebarCollapsed';

interface SidebarItemProps {
  icon: ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  status?: 'online' | null;
  indicator?: boolean;
}

function SidebarItem({ icon, label, active, onClick, status, indicator }: SidebarItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 rounded-full px-3.5 py-2.5 text-sm transition-all duration-200 ${
        active
          ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-[inset_0_0_0_1px_rgba(26,115,232,0.08)]'
          : 'text-sidebar-foreground hover:bg-accent hover:text-foreground'
      }`}
    >
      {icon}
      <span className="flex-1 text-left">{label}</span>
      {status === 'online' && <span className="w-2 h-2 rounded-full bg-success animate-pulse" />}
      {indicator && <span className="w-2 h-2 rounded-full bg-google-blue" />}
    </button>
  );
}

export interface Session {
  id: string;
  title: string;
  date: string;
  messages: Array<{ role: string; content: string }>;
}

interface SidebarNavProps {
  currentView: string;
  onViewChange: (view: string) => void;
  onNewSession: () => void;
  sessions: Session[];
  activeSessionId: string | null;
  onLoadSession: (session: Session) => void;
  onDeleteSession?: (sessionId: string) => void;
  onRenameSession?: (sessionId: string, newTitle: string) => void;
  hasPreviewCode: boolean;
  onOpenSettings: () => void;
  userEmail?: string;
  onLogout?: () => void;
  sessionsLoading?: boolean;
  /** Desktop shell: slide in/out with edge toggle; preference persisted in localStorage */
  collapsible?: boolean;
}

function groupByDate(sessions: Session[]): Record<string, Session[]> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86400000;
  const weekAgo = today - 7 * 86400000;

  const groups: Record<string, Session[]> = {};
  for (const s of sessions) {
    const parts = s.date.split(/[.\-/]/);
    let d: number;
    if (parts.length === 3) {
      // Try sk format dd.mm.yyyy or yyyy-mm-dd
      const parsed = new Date(s.date).getTime();
      d = isNaN(parsed) ? 0 : parsed;
    } else {
      d = 0;
    }
    if (s.date === 'Práve teraz' || d >= today) {
      (groups['Dnes'] ??= []).push(s);
    } else if (d >= yesterday) {
      (groups['Včera'] ??= []).push(s);
    } else if (d >= weekAgo) {
      (groups['Tento týždeň'] ??= []).push(s);
    } else {
      (groups['Staršie'] ??= []).push(s);
    }
  }
  return groups;
}

export default function SidebarNav({
  currentView, onViewChange, onNewSession,
  sessions, activeSessionId, onLoadSession, onDeleteSession, onRenameSession,
  hasPreviewCode, onOpenSettings, userEmail, onLogout, sessionsLoading, collapsible = false,
}: SidebarNavProps) {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(
    () => collapsible && localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true',
  );
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  useEffect(() => {
    if (collapsible) {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
    }
  }, [collapsed, collapsible]);

  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const q = searchQuery.toLowerCase();
    return sessions.filter(s => s.title.toLowerCase().includes(q));
  }, [sessions, searchQuery]);

  const grouped = useMemo(() => groupByDate(filteredSessions), [filteredSessions]);
  const groupOrder = ['Dnes', 'Včera', 'Tento týždeň', 'Staršie'];

  const handleRenameSubmit = (sessionId: string) => {
    if (editTitle.trim() && onRenameSession) {
      onRenameSession(sessionId, editTitle.trim());
    }
    setEditingId(null);
  };

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="border-b border-sidebar-border px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card shadow-[0_1px_2px_rgba(60,64,67,0.08)]">
            <div className="grid grid-cols-2 gap-0.5">
              <div className="h-2 w-2 rounded-full bg-google-blue" />
              <div className="h-2 w-2 rounded-full bg-google-red" />
              <div className="h-2 w-2 rounded-full bg-google-yellow" />
              <div className="h-2 w-2 rounded-full bg-google-green" />
            </div>
          </div>
          <div>
            <span className="block text-[15px] font-medium tracking-normal text-foreground">wpBOX</span>
            <span className="block text-[11px] text-muted-foreground">LarsenEvans</span>
          </div>
        </div>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-hide">
        <button
          onClick={onNewSession}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-[0_1px_2px_rgba(60,64,67,0.08)] transition-all hover:bg-accent hover:shadow-[0_4px_14px_rgba(60,64,67,0.12)]"
        >
          <Plus size={18} /> Nová Relácia
        </button>

        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest px-3 pt-2 pb-1">Navigácia</p>

        <SidebarItem 
          icon={<Rocket size={18} className="text-purple-500" />} 
          label="Štart (Návod)" 
          active={currentView === 'welcome'} 
          onClick={() => onViewChange('welcome')} 
        />
        
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest px-3 pt-4 pb-1">Nástroje</p>

        <SidebarItem 
          icon={<Plug size={18} />} 
          label="Integrácie" 
          active={currentView === 'connectors'} 
          status="online" 
          onClick={() => onViewChange('connectors')} 
        />
        <SidebarItem 
          icon={<FileText size={18} />} 
          label="WordPress Manager" 
          active={false} 
          onClick={() => navigate('/dashboard/wordpress')} 
        />
        <SidebarItem 
          icon={<LayoutGrid size={18} />} 
          label="Workspace (Chat)" 
          active={currentView === 'tasks'} 
          onClick={() => onViewChange('tasks')} 
        />
        <SidebarItem 
          icon={<Code2 size={18} />} 
          label="Generátor" 
          active={currentView === 'skills'} 
          onClick={() => onViewChange('skills')} 
        />
        <SidebarItem 
          icon={<ShieldAlert size={18} />} 
          label="Analyzátor" 
          active={currentView === 'files'} 
          onClick={() => onViewChange('files')} 
        />
        <SidebarItem 
          icon={<Layout size={18} />} 
          label="Náhľad" 
          active={currentView === 'preview'} 
          indicator={hasPreviewCode} 
          onClick={() => onViewChange('preview')} 
        />
        {isAdminEmail(userEmail) && (
          <>
            <SidebarItem
              icon={<Github size={18} />}
              label="GitHub"
              active={false}
              onClick={() => navigate('/dashboard/github')}
            />
            <SidebarItem
              icon={<Rocket size={18} />}
              label="Launch Audit"
              active={false}
              onClick={() => navigate('/dashboard/launch')}
            />
          </>
        )}

        {/* Session search */}
        <div className="pt-6 pb-2 px-1">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Hľadať relácie..."
              className="w-full bg-accent border border-border rounded-lg py-2 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Sessions grouped */}
        {sessionsLoading ? (
          <div className="space-y-2 px-3 pt-2">
            {[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full rounded-xl" />)}
          </div>
        ) : (
          groupOrder.map(group => {
            const items = grouped[group];
            if (!items?.length) return null;
            return (
              <div key={group}>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest px-3 pt-4 pb-1">{group}</p>
                <div className="space-y-0.5">
                  {items.map(session => (
                    <div key={session.id} className="group relative">
                      {editingId === session.id ? (
                        <div className="flex items-center gap-1 px-2 py-1.5">
                          <input
                            autoFocus
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleRenameSubmit(session.id);
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                            className="flex-1 bg-accent border border-primary rounded-lg px-2 py-1.5 text-xs text-foreground outline-none"
                          />
                          <button onClick={() => handleRenameSubmit(session.id)} className="p-1 text-success"><Check size={14} /></button>
                          <button onClick={() => setEditingId(null)} className="p-1 text-muted-foreground"><X size={14} /></button>
                        </div>
                      ) : (
                        <button
                          onClick={() => onLoadSession(session)}
                          onDoubleClick={() => { setEditingId(session.id); setEditTitle(session.title); }}
                          className={`w-full flex flex-col items-start rounded-2xl px-3 py-2.5 text-left text-sm transition-all duration-200 ${
                            activeSessionId === session.id
                              ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                              : 'text-sidebar-foreground hover:bg-accent hover:text-foreground'
                          }`}
                        >
                          <span className="flex items-center gap-2 w-full">
                            <History size={14} className="shrink-0 opacity-60" />
                            <span className="truncate pr-12">{session.title}</span>
                          </span>
                        </button>
                      )}
                      {editingId !== session.id && (
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 flex gap-0.5 transition-all">
                          {onRenameSession && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setEditingId(session.id); setEditTitle(session.title); }}
                              className="p-1 text-muted-foreground hover:text-foreground"
                            >
                              <Pencil size={12} />
                            </button>
                          )}
                          {onDeleteSession && (
                            <button
                              onClick={(e) => { e.stopPropagation(); onDeleteSession(session.id); }}
                              className="p-1 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* User */}
      <div className="space-y-2 border-t border-sidebar-border p-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDark(!dark)}
            className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title={dark ? 'Svetlý režim' : 'Tmavý režim'}
          >
            {dark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          {onLogout && (
            <button
              onClick={onLogout}
              className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-destructive"
              title="Odhlásiť sa"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
        <button
          onClick={onOpenSettings}
          aria-label="Otvoriť nastavenia"
          className="flex w-full cursor-pointer items-center justify-between rounded-2xl p-2 transition-colors hover:bg-accent"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-xs font-medium text-background">
              {userEmail ? userEmail[0].toUpperCase() : 'U'}
            </div>
            <div className="text-left">
              <div className="text-sm font-medium text-foreground truncate max-w-[160px]">
                {userEmail || 'Používateľ'}
              </div>
              <div className="text-[11px] text-success">Online</div>
            </div>
          </div>
          <Settings size={16} className="text-muted-foreground" />
        </button>
      </div>
    </>
  );

  if (!collapsible) {
    return (
      <aside className="flex h-full w-[280px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar z-20">
        {sidebarContent}
      </aside>
    );
  }

  return (
    <div
      className={cn(
        'relative shrink-0 transition-[width] duration-300 ease-in-out',
        collapsed ? 'w-0' : 'w-[280px]',
      )}
      data-sidebar-collapsed={collapsed}
    >
      <aside
        id="wpbox-sidebar"
        className={cn(
          'fixed inset-y-0 left-0 z-20 flex flex-col border-r border-sidebar-border bg-sidebar',
          'transition-transform duration-300 ease-in-out',
          collapsed ? '-translate-x-full' : 'translate-x-0',
        )}
        style={{ width: SIDEBAR_WIDTH_PX }}
        aria-hidden={collapsed}
      >
        {sidebarContent}
      </aside>

      <button
        type="button"
        onClick={() => setCollapsed((prev) => !prev)}
        aria-expanded={!collapsed}
        aria-controls="wpbox-sidebar"
        aria-label={collapsed ? 'Rozbaliť bočnú navigáciu' : 'Zbaliť bočnú navigáciu'}
        title={collapsed ? 'Rozbaliť navigáciu' : 'Zbaliť navigáciu'}
        className={cn(
          'fixed z-30 flex h-8 w-8 items-center justify-center rounded-full',
          'border border-border bg-card text-muted-foreground shadow-md',
          'transition-all duration-300 ease-in-out',
          'hover:bg-accent hover:text-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          collapsed ? 'left-2 top-6' : 'top-6 -translate-x-1/2',
        )}
        style={collapsed ? undefined : { left: SIDEBAR_WIDTH_PX }}
      >
        {collapsed ? <ChevronRight size={16} aria-hidden /> : <ChevronLeft size={16} aria-hidden />}
      </button>
    </div>
  );
}
