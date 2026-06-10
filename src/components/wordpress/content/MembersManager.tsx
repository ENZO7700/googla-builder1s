import RepeaterManager from './RepeaterManager';
export default function MembersManager({ siteId }: { siteId: string }) {
  return (
    <RepeaterManager
      siteId={siteId}
      kind="members"
      title="👥 Členovia / klienti"
      description="Repeater bez CPT – iba u nás."
      primaryKey="name"
      fields={[
        { key: 'name', label: 'Meno', type: 'text' },
        { key: 'role', label: 'Pozícia', type: 'text' },
        { key: 'email', label: 'E-mail', type: 'text' },
        { key: 'link_url', label: 'Link', type: 'url' },
        { key: 'bio', label: 'Bio', type: 'textarea', full: true },
        { key: 'photo_url', label: 'Foto', type: 'image' },
      ]}
    />
  );
}
