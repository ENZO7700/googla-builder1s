import { ReactNode, useState, useEffect } from 'react';
import {
  Plus, LayoutGrid, ShieldAlert, Code2, Plug, Layout,
  Settings, History, LogOut, Sun, Moon, Trash2
} from 'lucide-react';

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
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${
        active
          ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold'
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
  hasPreviewCode: boolean;
  onOpenSettings: () => void;
  userEmail?: string;
  onLogout?: () => void;
}

export default function SidebarNav({
  currentView, onViewChange, onNewSession,
  sessions, activeSessionId, onLoadSession, onDeleteSession,
  hasPreviewCode, onOpenSettings, userEmail, onLogout
}: SidebarNavProps) {
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  return (
    <aside className="w-[280px] bg-sidebar border-r border-sidebar-border flex flex-col shrink-0 z-20 hidden lg:flex">
      {/* Logo */}
      <div className="p-5 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-sm">
            <div className="grid grid-cols-2 gap-0.5">
              <div className="w-2 h-2 rounded-sm bg-primary-foreground opacity-90" />
              <div className="w-2 h-2 rounded-sm bg-primary-foreground opacity-60" />
              <div className="w-2 h-2 rounded-sm bg-primary-foreground opacity-60" />
              <div className="w-2 h-2 rounded-sm bg-primary-foreground opacity-90" />
            </div>
          </div>
          <span className="text-foreground font-semibold tracking-tight text-lg">H4CK3D</span>
        </div>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-hide">
        <button
          onClick={onNewSession}
          className="w-full flex items-center gap-2 px-4 py-2.5 mb-4 bg-primary text-primary-foreground rounded-full hover:bg-google-blue-hover transition-colors text-sm font-medium shadow-sm"
        >
          <Plus size={18} /> Nová Relácia
        </button>

        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest px-3 pt-2 pb-1">Nástroje</p>

        <SidebarItem icon={<LayoutGrid size={18} />} label="Workspace" active={currentView === 'tasks'} onClick={() => onViewChange('tasks')} />
        <SidebarItem icon={<ShieldAlert size={18} />} label="Analyzátor" active={currentView === 'files'} onClick={() => onViewChange('files')} />
        <SidebarItem icon={<Plug size={18} />} label="Integrácie" active={currentView === 'connectors'} status="online" onClick={() => onViewChange('connectors')} />
        <SidebarItem icon={<Code2 size={18} />} label="Generátor" active={currentView === 'skills'} onClick={() => onViewChange('skills')} />
        <SidebarItem icon={<Layout size={18} />} label="Náhľad" active={currentView === 'preview'} indicator={hasPreviewCode} onClick={() => onViewChange('preview')} />

        {/* Sessions */}
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest px-3 pt-6 pb-1">Nedávne</p>
        <div className="space-y-0.5">
          {sessions.map(session => (
            <div key={session.id} className="group relative">
              <button
                onClick={() => onLoadSession(session)}
                className={`w-full flex flex-col items-start px-3 py-2.5 rounded-xl transition-all duration-200 text-left text-sm ${
                  activeSessionId === session.id
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold'
                    : 'text-sidebar-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                <span className="flex items-center gap-2 w-full">
                  <History size={14} className="shrink-0 opacity-60" />
                  <span className="truncate pr-6">{session.title}</span>
                </span>
              </button>
              {onDeleteSession && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDeleteSession(session.id); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-all"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* User */}
      <div className="p-4 border-t border-sidebar-border space-y-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDark(!dark)}
            className="p-2 rounded-xl hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
            title={dark ? 'Svetlý režim' : 'Tmavý režim'}
          >
            {dark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          {onLogout && (
            <button
              onClick={onLogout}
              className="p-2 rounded-xl hover:bg-accent transition-colors text-muted-foreground hover:text-destructive"
              title="Odhlásiť sa"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
        <button
          onClick={onOpenSettings}
          className="flex items-center justify-between p-2 rounded-xl hover:bg-accent transition-colors cursor-pointer w-full"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
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
    </aside>
  );
}
