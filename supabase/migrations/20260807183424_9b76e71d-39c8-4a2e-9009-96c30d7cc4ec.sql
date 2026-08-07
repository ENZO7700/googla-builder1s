WITH cleaned AS (
  SELECT id, user_id,
    regexp_replace(
      regexp_replace(
        regexp_replace(base_url, '^([A-Za-z]+)://', 'https://'),
        '/(wp-admin(/.*)?|wp-login\.php|wp-json(/.*)?|index\.php)$', '', 'i'
      ),
      '/+$', ''
    ) AS new_url
  FROM public.wp_sites
  WHERE base_url ~* '(^[A-Z]|/wp-admin|/wp-login\.php|/wp-json|/index\.php|/$)'
)
UPDATE public.wp_sites s
SET base_url = c.new_url
FROM cleaned c
WHERE s.id = c.id
  AND s.base_url <> c.new_url
  AND NOT EXISTS (
    SELECT 1 FROM public.wp_sites o
    WHERE o.user_id = c.user_id AND o.base_url = c.new_url AND o.id <> c.id
  );