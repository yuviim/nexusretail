import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signIn } from '../lib/auth';

export default function Login() {
  const [email, setEmail] = useState('owner@northwind.test');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signIn(email, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-ink-950 flex items-center justify-center px-4">
      <div className="w-full max-w-[380px]">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-8 h-8 rounded-md bg-emerald-500 flex items-center justify-center">
            <span className="text-ink-950 font-bold text-sm">N</span>
          </div>
          <span className="text-white font-semibold text-lg tracking-tight">NexusRetail</span>
        </div>

        <div className="bg-white rounded-xl shadow-card p-7">
          <h1 className="text-[17px] font-semibold text-ink-900 mb-1">Sign in</h1>
          <p className="text-[13px] text-ink-500 mb-6">Welcome back to your workspace</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[13px] font-medium text-ink-700 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-ink-200 text-[14px] text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                required
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-ink-700 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-ink-200 text-[14px] text-ink-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                required
              />
            </div>

            {error && (
              <div className="px-3 py-2.5 rounded-lg bg-rose-100 text-rose-600 text-[13px]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-ink-950 text-white text-[14px] font-medium hover:bg-ink-800 transition-colors disabled:opacity-50"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-ink-500 text-[12.5px] mt-5">
          A multi-tenant inventory &amp; order platform
        </p>
      </div>
    </div>
  );
}
