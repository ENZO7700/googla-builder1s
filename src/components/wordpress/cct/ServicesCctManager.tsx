import { useState, useCallback } from 'react';
import {
  Plus, Save, Trash2, X, RefreshCw, Eye, Wand2, Sparkles,
  ChevronDown, ChevronRight, AlertTriangle, Database,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import DashboardCard from '@/components/dashboard/DashboardCard';
import { LoadingState, EmptyState } from '@/components/dashboard/States';
import { toast } from 'sonner';

import type { ServiceCctDraft, ServiceCctItem } from '@/lib/wordpress/cct/services.types';
import { SEO_ROBOTS_VALUES, SEO_ROBOTS_DEFAULT } from '@/lib/wordpress/cct/services.types';
import { buildServiceCctPayload, slugify, validateServiceDraft } from '@/lib/wordpress/cct/services.validation';
import {
  useCctServicesList,
  useCctServiceCreate,
  useCctServiceUpdate,
  useCctServiceDelete,
  useCctServiceGenerateDraft,
} from '@/lib/wordpress/cct/useCctServices';

// ==================== TYPES ====================

interface Props {
  siteId: string;
}

type EditorMode = 'idle' | 'create' | 'edit';

const EMPTY_DRAFT: ServiceCctDraft = {
  title: '',
  slug: '',
  tagline: '',
  description: '',
  start_datetime: '',
  end_datetime: '',
  capacity: undefined,
  duration: undefined,
  price: undefined,
  service_type: '',
  service_category: '',
  image_id: '',
  seo_title: '',
  seo_description: '',
  seo_keywords: '',
  seo_canonical: '',
  seo_og_image: '',
  seo_robots: SEO_ROBOTS_DEFAULT,
};

// ==================== COMPONENT ====================

export default function ServicesCctManager({ siteId }: Props) {
  // --- Data hooks ---
  const { data: items = [], isLoading, error: listError, refetch } = useCctServicesList(siteId);
  const createMutation = useCctServiceCreate(siteId);
  const updateMutation = useCctServiceUpdate(siteId);
  const deleteMutation = useCctServiceDelete(siteId);

  // --- Local state ---
  const [mode, setMode] = useState<EditorMode>('idle');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<ServiceCctDraft>({ ...EMPTY_DRAFT });
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [preparedPayload, setPreparedPayload] = useState<Record<string, unknown> | null>(null);
  const [lastResponse, setLastResponse] = useState<unknown>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ServiceCctItem | null>(null);

  // --- AI Draft generator state ---
  const [aiBrief, setAiBrief] = useState('');
  const [aiMode, setAiMode] = useState<'create' | 'rewrite' | 'seo'>('create');
  const [aiLocale, setAiLocale] = useState('sk-SK');
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  const [isAiDraft, setIsAiDraft] = useState(false);

  const generateDraftMutation = useCctServiceGenerateDraft(siteId);
  const isGeneratingDraft = generateDraftMutation.isPending;

  const handleGenerateAiDraft = async () => {
    if (!aiBrief.trim()) return;
    setAiNotice(null);
    try {
      const result = await generateDraftMutation.mutateAsync({
        brief: aiBrief,
        mode: aiMode,
        locale: aiLocale,
        existing: mode === 'edit' ? (draft as unknown as Record<string, unknown>) : undefined,
      });

      if (result.ok && result.draft) {
        const generated = result.draft as unknown as ServiceCctDraft;
        // Validate draft on frontend
        const validation = validateServiceDraft(generated);
        if (validation.ok) {
          setDraft({
            title: generated.title || '',
            slug: generated.slug || '',
            tagline: generated.tagline || '',
            description: generated.description || '',
            start_datetime: generated.start_datetime || '',
            end_datetime: generated.end_datetime || '',
            capacity: generated.capacity ?? undefined,
            duration: generated.duration ?? undefined,
            price: generated.price ?? undefined,
            service_type: generated.service_type || '',
            service_category: generated.service_category || '',
            image_id: generated.image_id || '',
            seo_title: generated.seo_title || '',
            seo_description: generated.seo_description || '',
            seo_keywords: generated.seo_keywords || '',
            seo_canonical: generated.seo_canonical || '',
            seo_og_image: generated.seo_og_image || '',
            seo_robots: generated.seo_robots || SEO_ROBOTS_DEFAULT,
          });
          setIsAiDraft(true);
          toast.success('Návrh služby vygenerovaný AI');
        } else {
          setAiNotice(`AI vygenerovalo neplatné dáta: ${validation.errors.join(', ')}`);
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      toast.error('Chyba pri generovaní draftu', { description: msg });
      setAiNotice(`Chyba: ${msg}`);
    }
  };

  // --- Helpers ---
  const patchDraft = useCallback((patch: Partial<ServiceCctDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    setValidationErrors([]);
    setPreparedPayload(null);
  }, []);

  const openCreate = () => {
    setDraft({ ...EMPTY_DRAFT });
    setEditingId(null);
    setMode('create');
    setValidationErrors([]);
    setPreparedPayload(null);
    setLastResponse(null);
    setAiBrief('');
    setAiMode('create');
    setAiNotice(null);
    setIsAiDraft(false);
  };

  const openEdit = (item: ServiceCctItem) => {
    setDraft({
      title: item.title,
      slug: item.slug,
      tagline: item.tagline || '',
      description: item.description || '',
      start_datetime: item.start_datetime || '',
      end_datetime: item.end_datetime || '',
      capacity: item.capacity ?? undefined,
      duration: item.duration ?? undefined,
      price: item.price ?? undefined,
      service_type: item.service_type || '',
      service_category: item.service_category || '',
      image_id: item.image_id || '',
      seo_title: item.seo_title || '',
      seo_description: item.seo_description || '',
      seo_keywords: item.seo_keywords || '',
      seo_canonical: item.seo_canonical || '',
      seo_og_image: item.seo_og_image || '',
      seo_robots: item.seo_robots || SEO_ROBOTS_DEFAULT,
    });
    setEditingId(item._ID);
    setMode('edit');
    setValidationErrors([]);
    setPreparedPayload(null);
    setLastResponse(null);
    setAiBrief('');
    setAiMode('rewrite');
    setAiNotice(null);
    setIsAiDraft(false);
  };

  const closeEditor = () => {
    setMode('idle');
    setEditingId(null);
    setValidationErrors([]);
    setPreparedPayload(null);
    setAiBrief('');
    setAiNotice(null);
    setIsAiDraft(false);
  };

  const handleValidate = () => {
    const result = validateServiceDraft(draft);
    setValidationErrors(result.errors);
    if (result.ok) {
      const built = buildServiceCctPayload(draft);
      if (built.ok) {
        setPreparedPayload(built.payload);
      } else {
        const { errors } = built as { ok: false; errors: string[] };
        setValidationErrors(errors);
        setPreparedPayload(null);
      }
    } else {
      setPreparedPayload(null);
    }
    return result.ok;
  };

  const handleSave = async () => {
    const built = buildServiceCctPayload(draft);
    if (!built.ok) {
      const { errors } = built as { ok: false; errors: string[] };
      setValidationErrors(errors);
      setPreparedPayload(null);
      return;
    }

    setValidationErrors([]);
    setPreparedPayload(built.payload);

    try {
      let response: unknown;
      if (mode === 'edit' && editingId) {
        response = await updateMutation.mutateAsync({ itemId: editingId, payload: built.payload });
        toast.success('Služba aktualizovaná');
      } else {
        response = await createMutation.mutateAsync(built.payload);
        toast.success('Služba vytvorená');
      }
      setLastResponse(response);
      closeEditor();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      toast.error('Chyba pri ukladaní', { description: msg });
      setLastResponse({ error: msg });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget._ID);
      toast.success(`Služba "${deleteTarget.title}" zmazaná`);
      setLastResponse({ deleted: deleteTarget._ID });
      if (editingId === deleteTarget._ID) closeEditor();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      toast.error('Chyba pri mazaní', { description: msg });
      setLastResponse({ error: msg });
    } finally {
      setDeleteTarget(null);
    }
  };

  const generateSlug = () => {
    if (draft.title) {
      patchDraft({ slug: slugify(draft.title) });
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isDeleting = deleteMutation.isPending;

  // ==================== RENDER ====================

  return (
    <>
      <DashboardCard
        title="⚡ CCT Services"
        description="JetEngine Custom Content Type — services. Remote management cez wordpress-cct-proxy."
        icon={<Database size={16} />}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">via Edge Function</Badge>
            <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isLoading} className="gap-1">
              <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} /> Refresh
            </Button>
            <Button size="sm" onClick={openCreate} className="gap-1">
              <Plus size={14} /> Nová služba
            </Button>
          </div>
        }
      >
        {/* ---- LIST ---- */}
        <div className="px-6 py-4">
          {isLoading ? (
            <LoadingState />
          ) : listError ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm">
              <p className="font-medium text-destructive">Chyba pri načítaní CCT services</p>
              <p className="mt-1 text-muted-foreground">{(listError as Error).message}</p>
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              title="Žiadne CCT services"
              description="WordPress JetEngine CCT services je prázdny. Pridaj prvú službu."
            />
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item._ID}
                  className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                    editingId === item._ID
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-card hover:bg-accent/50'
                  }`}
                  onClick={() => openEdit(item)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{item.title}</div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant="secondary" className="text-[10px]">/{item.slug}</Badge>
                      {item.duration != null && (
                        <Badge variant="outline" className="text-[10px]">{item.duration} min</Badge>
                      )}
                      {item.price != null && (
                        <Badge variant="outline" className="text-[10px]">€{item.price}</Badge>
                      )}
                      {item.service_type && (
                        <Badge variant="outline" className="text-[10px]">{item.service_type}</Badge>
                      )}
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        #{item._ID} · {item.cct_status}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(item); }}
                    disabled={isDeleting}
                    title="Zmazať"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ---- EDITOR ---- */}
        {mode !== 'idle' && (
          <div className="border-t border-border bg-muted/30 px-6 py-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">
                {mode === 'create' ? 'Nová služba' : `Upraviť #${editingId}`}
              </h3>
              <Button variant="ghost" size="icon" onClick={closeEditor}><X size={14} /></Button>
            </div>

            {/* AI Draft Section */}
            <div className="mb-6 p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-3">
              <div className="flex items-center gap-2 text-primary">
                <Sparkles size={16} />
                <span className="text-xs font-semibold uppercase tracking-wider">AI Draft Generator (Mistral)</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Zadajte inštrukcie pre AI na predvyplnenie alebo úpravu tohto formulára.
              </p>
              <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px] text-muted-foreground uppercase">Režim</Label>
                    <Select
                      value={aiMode}
                      onValueChange={(v: 'create' | 'rewrite' | 'seo') => setAiMode(v)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="create">Vytvoriť novú službu</SelectItem>
                        <SelectItem value="rewrite">Prepísať popis / tagline</SelectItem>
                        <SelectItem value="seo">Optimalizovať pre SEO</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground uppercase">Jazyk</Label>
                    <Select
                      value={aiLocale}
                      onValueChange={(v) => setAiLocale(v)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sk-SK">Slovenčina (sk-SK)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground uppercase">Zadanie / Brief</Label>
                  <Textarea
                    placeholder="Napr.: Vytvor službu pre 3D laserovú geometriu za 60€, trvanie 45 min..."
                    value={aiBrief}
                    onChange={(e) => setAiBrief(e.target.value)}
                    rows={2}
                    className="text-xs"
                  />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[11px] text-destructive font-medium truncate">
                    {aiNotice && `${aiNotice}`}
                  </span>
                  <Button
                    size="sm"
                    onClick={handleGenerateAiDraft}
                    disabled={isGeneratingDraft || !aiBrief.trim()}
                    className="gap-1 text-xs h-8 bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
                  >
                    {isGeneratingDraft ? (
                      <>
                        <RefreshCw size={12} className="animate-spin" /> Generujem...
                      </>
                    ) : (
                      <>
                        <Sparkles size={12} /> Generovať s AI
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {isAiDraft && (
              <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <Sparkles size={14} className="shrink-0 animate-pulse" />
                <span className="font-semibold">AI draft only. Review before saving to WordPress.</span>
              </div>
            )}

            {/* Validation errors */}
            {validationErrors.length > 0 && (
              <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm space-y-1">
                <p className="font-medium text-destructive flex items-center gap-1">
                  <AlertTriangle size={14} /> Validačné chyby
                </p>
                {validationErrors.map((err, i) => (
                  <p key={i} className="text-muted-foreground text-xs">• {err}</p>
                ))}
              </div>
            )}

            {/* Section: DATA */}
            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Dáta</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <Label className="text-xs text-muted-foreground">Title *</Label>
                <Input
                  value={draft.title}
                  onChange={(e) => patchDraft({ title: e.target.value })}
                  placeholder="Názov služby"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Slug *</Label>
                <div className="flex gap-1">
                  <Input
                    value={draft.slug}
                    onChange={(e) => patchDraft({ slug: e.target.value })}
                    placeholder="nazov-sluzby"
                    className="flex-1"
                  />
                  <Button variant="outline" size="icon" onClick={generateSlug} title="Generovať slug z title">
                    <Wand2 size={14} />
                  </Button>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Tagline</Label>
                <Input
                  value={draft.tagline ?? ''}
                  onChange={(e) => patchDraft({ tagline: e.target.value })}
                  placeholder="Krátky tagline"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Service type</Label>
                <Input
                  value={draft.service_type ?? ''}
                  onChange={(e) => patchDraft({ service_type: e.target.value })}
                  placeholder="consultation, audit, ..."
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Service category</Label>
                <Input
                  value={draft.service_category ?? ''}
                  onChange={(e) => patchDraft({ service_category: e.target.value })}
                  placeholder="premium, basic, ..."
                />
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs text-muted-foreground">Description</Label>
                <Textarea
                  rows={3}
                  value={draft.description ?? ''}
                  onChange={(e) => patchDraft({ description: e.target.value })}
                  placeholder="Popis služby..."
                />
              </div>
            </div>

            {/* Section: DETAILS */}
            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Detaily</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <Label className="text-xs text-muted-foreground">Price (€)</Label>
                <Input
                  type="number"
                  value={draft.price ?? ''}
                  onChange={(e) => patchDraft({ price: e.target.value || undefined })}
                  placeholder="0"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Duration (min)</Label>
                <Input
                  type="number"
                  value={draft.duration ?? ''}
                  onChange={(e) => patchDraft({ duration: e.target.value || undefined })}
                  placeholder="Optional"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Capacity</Label>
                <Input
                  type="number"
                  value={draft.capacity ?? ''}
                  onChange={(e) => patchDraft({ capacity: e.target.value || undefined })}
                  placeholder="Optional"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Start datetime</Label>
                <Input
                  type="datetime-local"
                  value={draft.start_datetime ?? ''}
                  onChange={(e) => patchDraft({ start_datetime: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">End datetime</Label>
                <Input
                  type="datetime-local"
                  value={draft.end_datetime ?? ''}
                  onChange={(e) => patchDraft({ end_datetime: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Image ID</Label>
                <Input
                  value={draft.image_id ?? ''}
                  onChange={(e) => patchDraft({ image_id: e.target.value })}
                  placeholder="WP attachment ID"
                />
              </div>
            </div>

            {/* Section: SEO */}
            <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">SEO</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <Label className="text-xs text-muted-foreground">SEO title</Label>
                <Input
                  value={draft.seo_title ?? ''}
                  onChange={(e) => patchDraft({ seo_title: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">SEO robots</Label>
                <Select
                  value={draft.seo_robots as string ?? SEO_ROBOTS_DEFAULT}
                  onValueChange={(v) => patchDraft({ seo_robots: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SEO_ROBOTS_VALUES.map((val) => (
                      <SelectItem key={val} value={val}>{val}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs text-muted-foreground">SEO description</Label>
                <Textarea
                  rows={2}
                  value={draft.seo_description ?? ''}
                  onChange={(e) => patchDraft({ seo_description: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">SEO keywords</Label>
                <Input
                  value={draft.seo_keywords ?? ''}
                  onChange={(e) => patchDraft({ seo_keywords: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">SEO canonical</Label>
                <Input
                  value={draft.seo_canonical ?? ''}
                  onChange={(e) => patchDraft({ seo_canonical: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">SEO OG image</Label>
                <Input
                  value={draft.seo_og_image ?? ''}
                  onChange={(e) => patchDraft({ seo_og_image: e.target.value })}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <Button variant="outline" size="sm" onClick={handleValidate} className="gap-1">
                <Eye size={14} /> Validate & Preview
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={closeEditor}>Zrušiť</Button>
                <Button onClick={handleSave} disabled={isSaving} className="gap-2">
                  <Save size={14} /> {isSaving ? 'Ukladám...' : mode === 'create' ? 'Vytvoriť' : 'Uložiť'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ---- DEBUG / PAYLOAD PREVIEW ---- */}
        <div className="border-t border-border px-6 py-3">
          <button
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setShowDebug(!showDebug)}
          >
            {showDebug ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            Debug: payload & response
          </button>
          {showDebug && (
            <div className="mt-3 space-y-3">
              {preparedPayload && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Prepared CCT payload:</p>
                  <pre className="bg-muted rounded-lg p-3 text-xs overflow-auto max-h-60 select-all">
                    {JSON.stringify(preparedPayload, null, 2)}
                  </pre>
                </div>
              )}
              {lastResponse && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Last API response:</p>
                  <pre className="bg-muted rounded-lg p-3 text-xs overflow-auto max-h-60 select-all">
                    {JSON.stringify(lastResponse, null, 2)}
                  </pre>
                </div>
              )}
              {!preparedPayload && !lastResponse && (
                <p className="text-xs text-muted-foreground">Žiadny payload ani response. Použi Validate & Preview.</p>
              )}
            </div>
          )}
        </div>
      </DashboardCard>

      {/* ---- DELETE CONFIRMATION DIALOG ---- */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Zmazať službu?</AlertDialogTitle>
            <AlertDialogDescription>
              Naozaj chcete zmazať službu <strong>"{deleteTarget?.title}"</strong> (#{deleteTarget?._ID})?
              Táto akcia je nezvratná a zmaže záznam priamo v WordPress JetEngine CCT.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušiť</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Mazanie...' : 'Zmazať'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
