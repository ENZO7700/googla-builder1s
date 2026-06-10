import RepeaterManager from './RepeaterManager';
export default function ServicesManager({ siteId }: { siteId: string }) {
  return (
    <RepeaterManager
      siteId={siteId}
      kind="services"
      title="🛠 Services"
      description="Dynamický zoznam služieb."
      syncEntity="service"
      fields={[
        { key: 'title', label: 'Názov', type: 'text' },
        { key: 'slug', label: 'Slug', type: 'text' },
        { key: 'price', label: 'Cena', type: 'text' },
        { key: 'icon', label: 'Ikona (emoji/url)', type: 'text' },
        { key: 'excerpt', label: 'Krátky popis', type: 'textarea', full: true },
        { key: 'description_html', label: 'Plný popis (HTML)', type: 'textarea', full: true },
        { key: 'image_url', label: 'Obrázok', type: 'image' },
        { key: 'link_url', label: 'Link', type: 'url' },
      ]}
    />
  );
}
