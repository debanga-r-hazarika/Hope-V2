import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogIn } from 'lucide-react';
import { supabase } from '../lib/supabase';

export function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResetMessage('');

    const normalizedEmail = email.trim().toLowerCase();
    const { error: signInError } = await signIn(normalizedEmail, password);

    if (signInError) {
      setError(signInError);
    }

    setLoading(false);
  };

  const handleResetPassword = async () => {
    setError('');
    setResetMessage('');
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError('Please enter your email to reset password.');
      return;
    }
    setResetLoading(true);
    const { data: matches, error: lookupError } = await supabase
      .from('users')
      .select('id')
      .ilike('email', normalizedEmail)
      .limit(1);

    if (lookupError) {
      setError('Unable to verify that email. Please try again or contact admin.');
      setResetLoading(false);
      return;
    }

    // Note: RLS may hide rows; we still attempt reset even if no visible match.

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      normalizedEmail,
      {
        redirectTo: window.location.origin,
      }
    );
    if (resetError) {
      setError(resetError.message);
      setResetLoading(false);
      return;
    }
    setResetMessage('If this email is registered, a reset link has been sent. Check your inbox.');
    setResetLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
              <LogIn className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</h1>
            <p className="text-gray-600">Sign in to MATVONI INSIDER</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                placeholder="Enter your email"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                placeholder="Enter your password"
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}
            {resetMessage && (
              <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-xl text-sm">
                {resetMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white font-semibold py-3 px-4 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>

            <button
              type="button"
              onClick={() => void handleResetPassword()}
              disabled={resetLoading}
              className="w-full text-sm text-blue-700 hover:text-blue-800 underline mt-2 disabled:opacity-60"
            >
              {resetLoading ? 'Sending reset link...' : 'Forgot password?'}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700">
              Log in with your registered credentials. If you do not have access,
              please contact your administrator.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
