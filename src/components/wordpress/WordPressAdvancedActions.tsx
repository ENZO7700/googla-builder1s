import { useEffect, useState } from 'react';
import { Loader2, Settings2, Trash2, Plug, AlertTriangle } from 'lucide-react';
import DashboardCard from '@/components/dashboard/DashboardCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingState } from '@/components/dashboard/States';
import StatusBadge from '@/components/dashboard/StatusBadge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useWordPressService } from '@/lib/wordpress/useWordPressService';

type PendingAction =
  | { kind: 'delete-post'; postId: number; title: string }
  | { kind: 'update-settings'; title: string; description: string; postsPerPage: string }
  | { kind: 'activate-plugin'; plugin: string; name: string }
  | { kind: 'deactivate-plugin'; plugin: string; name: string };

export default function WordPressAdvancedActions({ siteId }: { siteId: string }) {
  const wp = useWordPressService(siteId);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [postsPerPage, setPostsPerPage] = useState('10');

  useEffect(() => {
    if (wp.settings) {
      setTitle(wp.settings.title);
      setDescription(wp.settings.description);
      setPostsPerPage(String(wp.settings.posts_per_page ?? 10));
    }
  }, [wp.settings]);

  const runPending = () => {
    if (!pending) return;
    switch (pending.kind) {
      case 'delete-post':
        wp.deletePost(pending.postId);
        break;
      case 'update-settings':
        wp.updateSettings({
          title: pending.title,
          description: pending.description,
          posts_per_page: Number(pending.postsPerPage) || 10,
        });
        break;
      case 'activate-plugin':
        wp.activatePlugin(pending.plugin);
        break;
      case 'deactivate-plugin':
        wp.deactivatePlugin(pending.plugin);
        break;
    }
    setPending(null);
  };

  const confirmTitle = pending
    ? pending.kind === 'delete-post'
      ? 'Natrvalo zmazať príspevok?'
      : pending.kind === 'update-settings'
        ? 'Uložiť zmeny nastavení webu?'
        : pending.kind === 'activate-plugin'
          ? 'Aktivovať plugin?'
          : 'Deaktivovať plugin?'
    : '';

  const confirmBody = pending
    ? pending.kind === 'delete-post'
      ? `Príspevok #${pending.postId} „${pending.title}“ bude odstránený cez wordpress-proxy (force delete).`
      : pending.kind === 'update-settings'
        ? 'Zmení sa title, popis a počet príspevkov na stránke. Toto ovplyvní živý WordPress.'
        : pending.kind === 'activate-plugin'
          ? `Plugin „${pending.name}“ bude aktivovaný na produkcii.`
          : `Plugin „${pending.name}“ bude deaktivovaný na produkcii.`
    : '';

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-2">
        <DashboardCard
          title="Príspevky — zmazanie"
          description="DELETE cez proxy. Vyžaduje potvrdenie pred spustením."
          icon={<Trash2 size={16} />}
        >
          <div className="space-y-2 p-5">
            {wp.postsLoading ? (
              <LoadingState label="Načítavam príspevky..." />
            ) : wp.posts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Žiadne príspevky na zobrazenie.</p>
            ) : (
              wp.posts.map(post => (
                <div
                  key={post.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/60 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium" dangerouslySetInnerHTML={{ __html: post.title.rendered }} />
                    <div className="text-xs text-muted-foreground">#{post.id} · {post.status}</div>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="shrink-0 rounded-full"
                    disabled={wp.deletePostLoading}
                    onClick={() =>
                      setPending({
                        kind: 'delete-post',
                        postId: post.id,
                        title: post.title.rendered.replace(/<[^>]+>/g, ''),
                      })
                    }
                  >
                    Zmazať
                  </Button>
                </div>
              ))
            )}
          </div>
        </DashboardCard>

        <DashboardCard
          title="Nastavenia webu"
          description="PATCH /wp/v2/settings cez proxy."
          icon={<Settings2 size={16} />}
        >
          <div className="space-y-3 p-5">
            {wp.settingsLoading ? (
              <LoadingState label="Načítavam nastavenia..." />
            ) : wp.settingsError ? (
              <p className="text-sm text-destructive">{wp.settingsError.message}</p>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">Názov webu (title)</Label>
                  <Input value={title} onChange={e => setTitle(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Popis (tagline)</Label>
                  <Input value={description} onChange={e => setDescription(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Príspevkov na stránku</Label>
                  <Input type="number" min={1} value={postsPerPage} onChange={e => setPostsPerPage(e.target.value)} />
                </div>
                <Button
                  className="rounded-full"
                  disabled={wp.updateSettingsLoading}
                  onClick={() =>
                    setPending({
                      kind: 'update-settings',
                      title,
                      description,
                      postsPerPage,
                    })
                  }
                >
                  {wp.updateSettingsLoading ? <Loader2 size={14} className="animate-spin" /> : null}
                  Uložiť nastavenia
                </Button>
              </>
            )}
          </div>
        </DashboardCard>

        <DashboardCard
          title="Pluginy"
          description="Aktivácia / deaktivácia cez PATCH /wp/v2/plugins."
          icon={<Plug size={16} />}
          className="lg:col-span-2"
        >
          <div className="space-y-2 p-5">
            {wp.pluginsLoading ? (
              <LoadingState label="Načítavam pluginy..." />
            ) : wp.pluginsError ? (
              <p className="text-sm text-destructive">{wp.pluginsError.message}</p>
            ) : wp.plugins.length === 0 ? (
              <p className="text-sm text-muted-foreground">Žiadne pluginy.</p>
            ) : (
              wp.plugins.map(plugin => (
                <div
                  key={plugin.plugin}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background/60 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{plugin.name}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">{plugin.plugin} · v{plugin.version}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge
                      tone={plugin.status === 'active' || plugin.status === 'network-active' ? 'success' : 'muted'}
                      label={plugin.status}
                    />
                    {plugin.status === 'active' || plugin.status === 'network-active' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        disabled={wp.deactivatePluginLoading}
                        onClick={() =>
                          setPending({
                            kind: 'deactivate-plugin',
                            plugin: plugin.plugin,
                            name: plugin.name,
                          })
                        }
                      >
                        Deaktivovať
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        className="rounded-full"
                        disabled={wp.activatePluginLoading}
                        onClick={() =>
                          setPending({
                            kind: 'activate-plugin',
                            plugin: plugin.plugin,
                            name: plugin.name,
                          })
                        }
                      >
                        Aktivovať
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </DashboardCard>
      </div>

      <AlertDialog open={!!pending} onOpenChange={open => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-warning" />
              {confirmTitle}
            </AlertDialogTitle>
            <AlertDialogDescription>{confirmBody}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušiť</AlertDialogCancel>
            <AlertDialogAction onClick={runPending}>Potvrdiť a spustiť</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
