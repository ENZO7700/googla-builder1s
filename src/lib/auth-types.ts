export type AuthView = 'login' | 'register' | 'forgot';

export interface AuthFormData {
  email: string;
  password: string;
  name?: string;
  confirmPassword?: string;
  rememberMe?: boolean;
}

export interface AuthSubmitPayload {
  view: AuthView;
  data: AuthFormData;
}

export interface AuthSubmitResult {
  ok: boolean;
  error?: string;
  message?: string;
  /** Present after successful login/register when a session is created */
  sessionUser?: unknown;
}

export type AuthSubmitHandler = (payload: AuthSubmitPayload) => Promise<AuthSubmitResult>;

export interface AuthFormTexts {
  loginTitle: string;
  loginSubtitle: string;
  registerTitle: string;
  registerSubtitle: string;
  forgotTitle: string;
  forgotSubtitle: string;
  emailLabel: string;
  emailPlaceholder: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  nameLabel: string;
  namePlaceholder: string;
  confirmPasswordLabel: string;
  confirmPasswordPlaceholder: string;
  rememberMeLabel: string;
  loginButton: string;
  registerButton: string;
  forgotButton: string;
  forgotLink: string;
  backToLogin: string;
  noAccount: string;
  hasAccount: string;
  createAccount: string;
  signInInstead: string;
  successForgot: string;
  successRegister: string;
}

export interface AuthFormConfig {
  primaryColor: string;
  brandName: string;
  brandTagline?: string;
  brandMessage: string;
  logoUrl?: string;
  texts: AuthFormTexts;
  features?: {
    register?: boolean;
    forgotPassword?: boolean;
    rememberMe?: boolean;
    localDemo?: boolean;
  };
  localDemoLabel?: string;
}

export const DEFAULT_AUTH_TEXTS: AuthFormTexts = {
  loginTitle: 'Prihlásenie',
  loginSubtitle: 'Prihláste sa do svojho workspace',
  registerTitle: 'Vytvoriť účet',
  registerSubtitle: 'Založte si nový wpBOX účet',
  forgotTitle: 'Obnovenie hesla',
  forgotSubtitle: 'Pošleme vám odkaz na obnovenie hesla',
  emailLabel: 'E-mail',
  emailPlaceholder: 'vas@email.sk',
  passwordLabel: 'Heslo',
  passwordPlaceholder: 'Zadajte heslo',
  nameLabel: 'Meno',
  namePlaceholder: 'Vaše meno',
  confirmPasswordLabel: 'Potvrdiť heslo',
  confirmPasswordPlaceholder: 'Zopakujte heslo',
  rememberMeLabel: 'Zapamätať si ma',
  loginButton: 'Prihlásiť sa',
  registerButton: 'Vytvoriť účet',
  forgotButton: 'Odoslať odkaz',
  forgotLink: 'Zabudli ste heslo?',
  backToLogin: 'Späť na prihlásenie',
  noAccount: 'Nemáte účet?',
  hasAccount: 'Už máte účet?',
  createAccount: 'Registrácia',
  signInInstead: 'Prihlásiť sa',
  successForgot: 'Ak účet existuje, poslali sme odkaz na obnovenie hesla.',
  successRegister: 'Účet bol vytvorený. Skontrolujte e-mail pre potvrdenie, ak je zapnuté.',
};
