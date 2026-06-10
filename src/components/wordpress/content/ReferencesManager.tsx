import RepeaterManager from './RepeaterManager';
export default function ReferencesManager({ siteId }: { siteId: string }) {
  return (
    <RepeaterManager
      siteId={siteId}
      kind="references"
      title="🏆 Referencie"
      description="Realizované projekty."
      primaryKey="project_title"
      syncEntity="reference"
      fields={[
        { key: 'project_title', label: 'Projekt', type: 'text' },
        { key: 'client_name', label: 'Klient', type: 'text' },
        { key: 'completed_at', label: 'Dátum dokončenia', type: 'date' },
        { key: 'link_url', label: 'Link', type: 'url' },
        { key: 'description_html', label: 'Popis (HTML)', type: 'textarea', full: true },
        { key: 'image_url', label: 'Obrázok', type: 'image' },
      ]}
    />
  );
}
