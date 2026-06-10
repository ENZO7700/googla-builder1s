import RepeaterManager from './RepeaterManager';
export default function NewsManager({ siteId }: { siteId: string }) {
  return (
    <RepeaterManager
      siteId={siteId}
      kind="news"
      title="📰 News"
      description="Aktuality / blog príspevky."
      syncEntity="news"
      fields={[
        { key: 'title', label: 'Titulok', type: 'text' },
        { key: 'slug', label: 'Slug', type: 'text' },
        { key: 'published_at', label: 'Dátum publikácie', type: 'date' },
        { key: 'excerpt', label: 'Perex', type: 'textarea', full: true },
        { key: 'content_html', label: 'Obsah (HTML)', type: 'textarea', full: true },
        { key: 'cover_url', label: 'Cover obrázok', type: 'image' },
      ]}
    />
  );
}
