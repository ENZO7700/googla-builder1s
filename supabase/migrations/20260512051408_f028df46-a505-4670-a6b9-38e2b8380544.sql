-- Add SSH connection fields to wp_sites for WP-CLI
ALTER TABLE public.wp_sites
  ADD COLUMN IF NOT EXISTS ssh_host text,
  ADD COLUMN IF NOT EXISTS ssh_port integer DEFAULT 22,
  ADD COLUMN IF NOT EXISTS ssh_username text,
  ADD COLUMN IF NOT EXISTS ssh_password_encrypted text,
  ADD COLUMN IF NOT EXISTS ssh_private_key_encrypted text,
  ADD COLUMN IF NOT EXISTS wp_path text;