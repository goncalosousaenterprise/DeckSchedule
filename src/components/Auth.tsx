import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { Mail, Lock, Loader2, Monitor } from 'lucide-react';
import { detectLang, getTranslations } from '../lib/i18n';

const ALLOWED_DOMAIN = 'cobus-industries.com';

const lang = detectLang();
const t = getTranslations(lang).auth;

export function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  const handleAuth = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        if (!email.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`)) {
          toast.error(t.domainError(ALLOWED_DOMAIN));
          setLoading(false);
          return;
        }

        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        toast.success(t.checkEmail);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success(t.loggedIn);
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      toast.error(error?.message || error?.error_description || t.authError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-sm border border-zinc-200">
      <div className="text-center mb-8">
        <div className="w-12 h-12 bg-zinc-900 rounded-xl mx-auto flex items-center justify-center mb-4">
          <Monitor className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          {isSignUp ? t.createAccount : t.welcomeBack}
        </h1>
        <p className="text-sm text-zinc-500 mt-2">
          {isSignUp ? t.signUpSubtitle(ALLOWED_DOMAIN) : t.signInSubtitle}
        </p>
      </div>

      <form onSubmit={handleAuth} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-zinc-700 mb-1">{t.emailLabel}</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 outline-none transition-all"
              placeholder={t.emailPlaceholder(ALLOWED_DOMAIN)}
              required
            />
          </div>
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-zinc-700 mb-1">{t.passwordLabel}</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 outline-none transition-all"
              placeholder="••••••••"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-zinc-900 text-white py-2.5 rounded-lg font-medium hover:bg-zinc-800 focus:ring-4 focus:ring-zinc-900/20 transition-all disabled:opacity-70 flex items-center justify-center gap-2"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {isSignUp ? t.signUpBtn : t.signInBtn}
        </button>
      </form>

      <div className="mt-6">
        {isSignUp ? (
          <div className="text-center">
            <span className="text-sm text-zinc-500">{t.alreadyHave} </span>
            <button
              onClick={() => setIsSignUp(false)}
              className="text-sm font-medium text-zinc-900 hover:underline transition-colors"
            >
              {t.signInLink}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative flex items-center">
              <div className="flex-grow border-t border-zinc-200"></div>
              <span className="mx-3 text-xs text-zinc-400 shrink-0">{t.or}</span>
              <div className="flex-grow border-t border-zinc-200"></div>
            </div>
            <button
              onClick={() => setIsSignUp(true)}
              className="w-full py-2.5 rounded-lg border-2 border-zinc-200 text-zinc-700 text-sm font-medium hover:border-zinc-900 hover:text-zinc-900 transition-all"
            >
              {t.createNew}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
