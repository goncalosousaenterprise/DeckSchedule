/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { supabase, hasSupabaseCredentials } from './lib/supabase';
import { Toaster } from 'react-hot-toast';
import { Auth } from './components/Auth';
import { Dashboard } from './components/Dashboard';
import { Booking } from './components/Booking';
import { Calendar, LayoutDashboard, LogOut, AlertCircle } from 'lucide-react';
import { cn } from './lib/utils';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'booking'>('dashboard');

  useEffect(() => {
    if (!hasSupabaseCredentials) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!hasSupabaseCredentials) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-red-200">
          <div className="flex items-center gap-3 text-red-600 mb-4">
            <AlertCircle className="w-6 h-6" />
            <h1 className="text-xl font-semibold">Missing Database Connection</h1>
          </div>
          <p className="text-zinc-600 mb-6 text-sm leading-relaxed">
            The application cannot connect to Supabase. You need to add your Supabase credentials to the AI Studio environment.
          </p>
          <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200">
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Required Environment Variables</p>
            <ul className="space-y-2 text-sm text-zinc-700 font-mono">
              <li>VITE_SUPABASE_URL</li>
              <li>VITE_SUPABASE_ANON_KEY</li>
            </ul>
          </div>
          <p className="text-xs text-zinc-500 mt-4">
            Open the Settings / Secrets menu in AI Studio to add these variables, then the app will automatically reload.
          </p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
        <Auth />
        <Toaster position="top-center" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans">
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center">
              <span className="text-white font-semibold text-sm">DB</span>
            </div>
            <span className="font-semibold text-lg tracking-tight">Desk Booking</span>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-500 hidden sm:inline-block">
              {session.user.email}
            </span>
            <button
              onClick={() => supabase.auth.signOut()}
              className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-colors"
              title="Sign out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-2 mb-8 border-b border-zinc-200 pb-px">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors",
              activeTab === 'dashboard' 
                ? "border-zinc-900 text-zinc-900" 
                : "border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300"
            )}
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('booking')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors",
              activeTab === 'booking' 
                ? "border-zinc-900 text-zinc-900" 
                : "border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300"
            )}
          >
            <Calendar className="w-4 h-4" />
            Book a Desk
          </button>
        </div>

        {activeTab === 'dashboard' ? <Dashboard user={session.user} /> : <Booking user={session.user} />}
      </main>
      <Toaster position="top-center" />
    </div>
  );
}
