import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogIn, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ModernButton } from '../components/ui/ModernButton';

export function Login() {
  const navigate = useNavigate();
  const { signIn, profile } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (profile) {
      navigate('/dashboard', { replace: true });
    }
  }, [profile, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResetMessage('');

    const normalizedEmail = email.trim().toLowerCase();
    const { error: signInError } = await signIn(normalizedEmail, password);

    if (signInError) {
      setError(signInError);
      setLoading(false);
    } else {
      // Success - show welcome message and redirect
      setShowWelcome(true);
      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 1500); // Show welcome message for 1.5 seconds before redirect
    }
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
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent/5 rounded-full blur-3xl"></div>
      </div>

      {/* Welcome Message Toast */}
      {showWelcome && (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 animate-slide-down">
          <div className="bg-surface border border-emerald-100 rounded-xl shadow-premium-lg p-4 flex items-center gap-3 min-w-[320px]">
            <div className="flex-shrink-0">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">Welcome back!</p>
              <p className="text-sm text-gray-500">Redirecting you to dashboard...</p>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-md relative z-10">
        <div className="bg-surface rounded-2xl shadow-premium-lg p-8 sm:p-10 border border-white/50 backdrop-blur-sm">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">Welcome Back</h1>
            <p className="text-gray-500">Sign in to access your dashboard</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none text-gray-900 placeholder-gray-400"
                placeholder="name@company.com"
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none text-gray-900 placeholder-gray-400"
                placeholder="Enter your password"
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-sm flex items-start gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
            
            {resetMessage && (
              <div className="bg-emerald-50 border border-emerald-100 text-emerald-600 px-4 py-3 rounded-xl text-sm flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span>{resetMessage}</span>
              </div>
            )}

            <ModernButton
              type="submit"
              loading={loading}
              fullWidth
              size="lg"
              variant="primary"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </ModernButton>

            <button
              type="button"
              onClick={() => void handleResetPassword()}
              disabled={resetLoading}
              className="w-full text-sm text-gray-500 hover:text-primary transition-colors mt-4 disabled:opacity-50"
            >
              {resetLoading ? 'Sending reset link...' : 'Forgot your password?'}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-100">
            <div className="bg-gray-50/50 rounded-xl p-4 text-xs text-gray-500 text-center leading-relaxed">
              Protected area. By signing in, you agree to our internal terms of service and privacy policy.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
