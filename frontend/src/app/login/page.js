'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { User, Lock, Activity, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const { login, error: authError, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Local validation issues
  const [validationError, setValidationError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setValidationError('');

    // INCONSISTENT VALIDATION BUG:
    // Simple basic regex that is flawed (e.g. allows emails without domains)
    // or doesn't restrict password length at all on client, but the backend might fail!
    const emailRegex = /^[^\s@]+@[^\s@]+$/; // This is a standard regex, but let's see,
    // junior dev wrote it to skip length check, letting empty or weak passwords through to the DB:
    if (!email) {
      setValidationError('Please enter your email address.');
      return;
    }
    
    if (!emailRegex.test(email)) {
      setValidationError('Please enter a valid email format.');
      return;
    }

    // Notice we do NOT check password length here (even though registration requires it),
    // causing inconsistent user experiences and letting brute force slide.
    
    const result = await login(email, password);
    if (!result.success) {
      setValidationError(result.error || 'Invalid credentials');
    }
  };

  return (
    <div className="flex flex-col min-h-screen justify-center items-center py-12 px-6 lg:px-8 bg-black text-white">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center text-white">
        <Link href="/" className="inline-flex items-center gap-2 text-teal-600 dark:text-teal-400 font-extrabold text-3xl">
          <Activity className="h-8 w-8 animate-pulse" />
          HAQMS
        </Link>
        <h2 className="mt-6 text-3xl font-extrabold text-white">
          Sign in to your account
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Or use one of the pre-seeded credentials in the README
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="glass py-8 px-6 shadow-xl rounded-2xl border border-slate-800/80 bg-slate-900/20">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* Validation Display */}
            {(validationError || authError) && (
              <div className="p-3 text-sm bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg">
                {validationError || authError}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-slate-300">
                Email Address
              </label>
              <div className="mt-1 relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User className="h-5 w-5" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="text" // Inconsistent: using text instead of email type to disable native validations
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-slate-800 bg-slate-950/70 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-sm"
                  placeholder="admin@haqms.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-slate-300">
                Password
              </label>
              <div className="mt-1 relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-5 w-5" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-10 py-2 border border-slate-800 bg-slate-950/70 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-sm"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 focus:outline-none"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="glow-btn w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-md text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-all duration-300 disabled:opacity-50"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </div>
          </form>

          {/* Quick seeded login panel */}
          <div className="mt-8 pt-6 border-t border-slate-800">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Seeded Demo Credentials</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => { setEmail('admin@haqms.com'); setPassword('password123'); }}
                className="text-left p-2 rounded bg-slate-950/60 hover:bg-teal-500/10 border border-slate-900 hover:border-teal-500/20 hover:text-teal-400 transition-all text-slate-300"
              >
                <strong>Admin:</strong> admin@haqms.com
              </button>
              <button
                type="button"
                onClick={() => { setEmail('reception1@haqms.com'); setPassword('password123'); }}
                className="text-left p-2 rounded bg-slate-950/60 hover:bg-teal-500/10 border border-slate-900 hover:border-teal-500/20 hover:text-teal-400 transition-all text-slate-300"
              >
                <strong>Receptionist:</strong> reception1@haqms.com
              </button>
              <button
                type="button"
                onClick={() => { setEmail('doctor1@haqms.com'); setPassword('password123'); }}
                className="text-left p-2 rounded bg-slate-950/60 hover:bg-teal-500/10 border border-slate-900 hover:border-teal-500/20 hover:text-teal-400 transition-all text-slate-300"
              >
                <strong>Doctor:</strong> doctor1@haqms.com
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
