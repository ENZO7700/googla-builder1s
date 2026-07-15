import type { AuthFormConfig } from '@/lib/auth-types';
import { DEFAULT_AUTH_TEXTS } from '@/lib/auth-types';

/** Default wpBOX auth form branding + copy */
export const wpboxAuthConfig: AuthFormConfig = {
  primaryColor: '#1a73e8',
  brandName: 'wpBOX',
  brandTagline: 'LarsenEvans',
  brandMessage: 'WordPress workspace na jednom mieste',
  texts: DEFAULT_AUTH_TEXTS,
  features: {
    register: true,
    forgotPassword: true,
    rememberMe: true,
    localDemo: true,
  },
  localDemoLabel: 'Pokračovať v demo režime',
};
