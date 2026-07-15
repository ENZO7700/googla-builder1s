import { useEffect, useId, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { useAuthForm } from '@/hooks/use-auth';
import type { AuthFormConfig, AuthSubmitHandler } from '@/lib/auth-types';
import { wpboxAuthConfig } from '@/lib/auth-config';

export interface AuthFormProps {
  config?: AuthFormConfig;
  onSubmit: AuthSubmitHandler;
  onAuthSuccess?: (user: unknown) => void;
  onLocalDemo?: () => void;
  className?: string;
  initialEmail?: string;
}

function GoogleDots({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-center gap-1.5', className)} aria-hidden="true">
      <span className="h-2.5 w-2.5 rounded-full bg-google-blue" />
      <span className="h-2.5 w-2.5 rounded-full bg-google-red" />
      <span className="h-2.5 w-2.5 rounded-full bg-google-yellow" />
      <span className="h-2.5 w-2.5 rounded-full bg-google-green" />
    </div>
  );
}

export default function AuthForm({
  config = wpboxAuthConfig,
  onSubmit,
  onAuthSuccess,
  onLocalDemo,
  className,
  initialEmail = '',
}: AuthFormProps) {
  const {
    view,
    setView,
    form,
    setField,
    loading,
    error,
    success,
    handleSubmit,
  } = useAuthForm({ onSubmit, onAuthSuccess });

  const [showPassword, setShowPassword] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const formId = useId();
  const texts = config.texts;
  const features = {
    register: true,
    forgotPassword: true,
    rememberMe: true,
    localDemo: false,
    ...config.features,
  };

  useEffect(() => {
    if (initialEmail) {
      setField('email', initialEmail);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once on mount
  }, []);

  useEffect(() => {
    emailRef.current?.focus();
  }, [view]);

  const title =
    view === 'login'
      ? texts.loginTitle
      : view === 'register'
        ? texts.registerTitle
        : texts.forgotTitle;

  const subtitle =
    view === 'login'
      ? texts.loginSubtitle
      : view === 'register'
        ? texts.registerSubtitle
        : texts.forgotSubtitle;

  const submitLabel =
    view === 'login'
      ? texts.loginButton
      : view === 'register'
        ? texts.registerButton
        : texts.forgotButton;

  return (
    <div
      className={cn('wpbox-auth-form', className)}
      style={{ ['--auth-primary' as string]: config.primaryColor }}
    >
      <div className="wpbox-auth-form__brand">
        {config.logoUrl ? (
          <img src={config.logoUrl} alt={config.brandName} className="wpbox-auth-form__logo" />
        ) : (
          <GoogleDots className="mb-5" />
        )}
        <p className="wpbox-auth-form__brand-name">{config.brandName}</p>
        {config.brandTagline ? (
          <p className="wpbox-auth-form__brand-tagline">{config.brandTagline}</p>
        ) : null}
        <h1 className="wpbox-auth-form__brand-message">{config.brandMessage}</h1>
      </div>

      <AnimatePresence mode="wait">
        <motion.form
          key={view}
          id={formId}
          onSubmit={handleSubmit}
          className="wpbox-auth-form__panel"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          noValidate
          aria-labelledby={`${formId}-title`}
        >
          <div className="mb-6 text-center sm:text-left">
            <h2 id={`${formId}-title`} className="text-xl font-medium tracking-tight text-foreground">
              {title}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          </div>

          <div className="space-y-4">
            {view === 'register' ? (
              <div className="space-y-1.5">
                <Label htmlFor={`${formId}-name`}>{texts.nameLabel}</Label>
                <Input
                  id={`${formId}-name`}
                  name="name"
                  autoComplete="name"
                  value={form.name ?? ''}
                  onChange={(e) => setField('name', e.target.value)}
                  placeholder={texts.namePlaceholder}
                  disabled={loading}
                  aria-required="true"
                />
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor={`${formId}-email`}>{texts.emailLabel}</Label>
              <Input
                ref={emailRef}
                id={`${formId}-email`}
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => setField('email', e.target.value)}
                placeholder={texts.emailPlaceholder}
                disabled={loading}
                aria-required="true"
                aria-invalid={Boolean(error)}
              />
            </div>

            {view !== 'forgot' ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor={`${formId}-password`}>{texts.passwordLabel}</Label>
                  {view === 'login' && features.forgotPassword ? (
                    <button
                      type="button"
                      className="text-xs font-medium text-[color:var(--auth-primary)] hover:underline"
                      onClick={() => setView('forgot')}
                      disabled={loading}
                    >
                      {texts.forgotLink}
                    </button>
                  ) : null}
                </div>
                <div className="relative">
                  <Input
                    id={`${formId}-password`}
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={view === 'register' ? 'new-password' : 'current-password'}
                    value={form.password}
                    onChange={(e) => setField('password', e.target.value)}
                    placeholder={texts.passwordPlaceholder}
                    disabled={loading}
                    aria-required="true"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Skryť heslo' : 'Zobraziť heslo'}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            ) : null}

            {view === 'register' ? (
              <div className="space-y-1.5">
                <Label htmlFor={`${formId}-confirm`}>{texts.confirmPasswordLabel}</Label>
                <Input
                  id={`${formId}-confirm`}
                  name="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={form.confirmPassword ?? ''}
                  onChange={(e) => setField('confirmPassword', e.target.value)}
                  placeholder={texts.confirmPasswordPlaceholder}
                  disabled={loading}
                  aria-required="true"
                />
              </div>
            ) : null}

            {view === 'login' && features.rememberMe ? (
              <div className="flex items-center gap-2 pt-1">
                <Checkbox
                  id={`${formId}-remember`}
                  checked={Boolean(form.rememberMe)}
                  onCheckedChange={(checked) => setField('rememberMe', checked === true)}
                  disabled={loading}
                />
                <Label htmlFor={`${formId}-remember`} className="font-normal text-muted-foreground">
                  {texts.rememberMeLabel}
                </Label>
              </div>
            ) : null}
          </div>

          {error ? (
            <div
              className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          {success ? (
            <div
              className="mt-4 flex items-start gap-2 rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-sm text-foreground"
              role="status"
            >
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success" />
              <span>{success}</span>
            </div>
          ) : null}

          <Button
            type="submit"
            disabled={loading}
            className="mt-6 h-11 w-full rounded-full text-[15px] font-medium"
            style={{ backgroundColor: 'var(--auth-primary)' }}
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : submitLabel}
          </Button>

          <div className="mt-5 space-y-2 text-center text-sm text-muted-foreground">
            {view === 'login' && features.register ? (
              <p>
                {texts.noAccount}{' '}
                <button
                  type="button"
                  className="font-medium text-[color:var(--auth-primary)] hover:underline"
                  onClick={() => setView('register')}
                  disabled={loading}
                >
                  {texts.createAccount}
                </button>
              </p>
            ) : null}

            {view === 'register' ? (
              <p>
                {texts.hasAccount}{' '}
                <button
                  type="button"
                  className="font-medium text-[color:var(--auth-primary)] hover:underline"
                  onClick={() => setView('login')}
                  disabled={loading}
                >
                  {texts.signInInstead}
                </button>
              </p>
            ) : null}

            {view === 'forgot' ? (
              <button
                type="button"
                className="font-medium text-[color:var(--auth-primary)] hover:underline"
                onClick={() => setView('login')}
                disabled={loading}
              >
                {texts.backToLogin}
              </button>
            ) : null}
          </div>

          {features.localDemo && onLocalDemo && view === 'login' ? (
            <button
              type="button"
              onClick={onLocalDemo}
              disabled={loading}
              className="mt-4 w-full text-center text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              {config.localDemoLabel ?? 'Pokračovať bez prihlásenia'}
            </button>
          ) : null}
        </motion.form>
      </AnimatePresence>
    </div>
  );
}
