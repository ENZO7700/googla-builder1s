import { useState, type FormEvent } from 'react';
import type {
  AuthFormData,
  AuthSubmitHandler,
  AuthSubmitResult,
  AuthView,
} from '@/lib/auth-types';

const emptyForm: AuthFormData = {
  email: '',
  password: '',
  name: '',
  confirmPassword: '',
  rememberMe: false,
};

export interface UseAuthFormOptions {
  initialView?: AuthView;
  onSubmit: AuthSubmitHandler;
  onAuthSuccess?: (user: unknown) => void;
}

export interface UseAuthFormReturn {
  view: AuthView;
  setView: (view: AuthView) => void;
  form: AuthFormData;
  setField: <K extends keyof AuthFormData>(key: K, value: AuthFormData[K]) => void;
  loading: boolean;
  error: string | null;
  success: string | null;
  clearFeedback: () => void;
  handleSubmit: (event: FormEvent) => Promise<void>;
}

function validate(view: AuthView, form: AuthFormData): string | null {
  const email = form.email.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'Zadajte platný e-mail.';
  }

  if (view === 'forgot') {
    return null;
  }

  if (!form.password) {
    return 'Zadajte heslo.';
  }

  if (form.password.length < 6) {
    return 'Heslo musí mať minimálne 6 znakov.';
  }

  if (view === 'register') {
    if (!form.name?.trim()) {
      return 'Zadajte meno.';
    }
    if (form.password !== form.confirmPassword) {
      return 'Heslá sa nezhodujú.';
    }
  }

  return null;
}

export function useAuthForm({
  initialView = 'login',
  onSubmit,
  onAuthSuccess,
}: UseAuthFormOptions): UseAuthFormReturn {
  const [view, setViewState] = useState<AuthView>(initialView);
  const [form, setForm] = useState<AuthFormData>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const clearFeedback = () => {
    setError(null);
    setSuccess(null);
  };

  const setView = (next: AuthView) => {
    setViewState(next);
    clearFeedback();
    setForm((prev) => ({
      ...emptyForm,
      email: prev.email,
      rememberMe: prev.rememberMe,
    }));
  };

  const setField = <K extends keyof AuthFormData>(key: K, value: AuthFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    clearFeedback();
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    clearFeedback();

    const validationError = validate(view, form);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      const result: AuthSubmitResult = await onSubmit({
        view,
        data: {
          ...form,
          email: form.email.trim(),
          name: form.name?.trim(),
        },
      });

      if (!result.ok) {
        setError(result.error ?? 'Operácia zlyhala.');
        if (view === 'login' || view === 'register') {
          setForm((prev) => ({ ...prev, password: '', confirmPassword: '' }));
        }
        return;
      }

      if (result.message) {
        setSuccess(result.message);
      }

      if (result.sessionUser) {
        onAuthSuccess?.(result.sessionUser);
      }

      if (view === 'register' && !result.sessionUser) {
        setViewState('login');
      }

      if (view === 'forgot') {
        setForm((prev) => ({ ...emptyForm, email: prev.email }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Neočakávaná chyba.');
    } finally {
      setLoading(false);
    }
  };

  return {
    view,
    setView,
    form,
    setField,
    loading,
    error,
    success,
    clearFeedback,
    handleSubmit,
  };
}
