import { ReactNode } from 'react';
import {
  Plus, LayoutGrid, ShieldAlert, Code2, Plug, Layout,
  MessageSquare, Settings, History
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
  id: number;
  title: string;
  date: string;
  messages: Array<{ role: string; content: string }>;
}

interface SidebarNavProps {
  currentView: string;
  onViewChange: (view: string) => void;
  onNewSession: () => void;
  sessions: Session[];
  activeSessionId: number | null;
  onLoadSession: (session: Session) => void;
  hasPreviewCode: boolean;
  onOpenSettings: () => void;
}

export default function SidebarNav({
  currentView, onViewChange, onNewSession,
  sessions, activeSessionId, onLoadSession,
  hasPreviewCode, onOpenSettings
}: SidebarNavProps) {
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
            <button
              key={session.id}
              onClick={() => onLoadSession(session)}
              className={`w-full flex flex-col items-start px-3 py-2.5 rounded-xl transition-all duration-200 text-left text-sm ${
                activeSessionId === session.id
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold'
                  : 'text-sidebar-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              <span className="flex items-center gap-2 w-full">
                <History size={14} className="shrink-0 opacity-60" />
                <span className="truncate">{session.title}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* User */}
      <div className="p-4 border-t border-sidebar-border">
        <button
          onClick={onOpenSettings}
          className="flex items-center justify-between p-2 rounded-xl hover:bg-accent transition-colors cursor-pointer w-full"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">R</div>
            <div className="text-left">
              <div className="text-sm font-medium text-foreground">root_admin</div>
              <div className="text-[11px] text-success">Online</div>
            </div>
          </div>
          <Settings size={16} className="text-muted-foreground" />
        </button>
      </div>
    </aside>
  );
}
