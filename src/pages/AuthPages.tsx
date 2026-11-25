import * as React from 'react';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Lock, Mail, User } from 'lucide-react';
import { dataService } from '../lib/dataService';
import type { UserProfile } from '../types/forensics';
import { BrandMark } from '../components/BrandMark';
import { Alert } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

interface LoginPageProps {
  onSuccess: (user: UserProfile) => void;
  onGoSignup: () => void;
  onGoHome: () => void;
}

export function LoginPage({ onSuccess, onGoSignup, onGoHome }: LoginPageProps) {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [forgotOpen, setForgotOpen] = React.useState(false);
  const [resetEmail, setResetEmail] = React.useState('');
  const [resetMessage, setResetMessage] = React.useState<string | null>(null);
  const [resetError, setResetError] = React.useState<string | null>(null);
  const [resetLoading, setResetLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);
    try {
      const user = await dataService.login(email, password);
      onSuccess(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);
    setResetMessage(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resetEmail.trim())) {
      setResetError('Enter a valid email address.');
      return;
    }
    setResetLoading(true);
    try {
      const msg = await dataService.requestPasswordReset(resetEmail);
      setResetMessage(msg);
    } catch (err) {
      setResetError(err instanceof Error ? err.message : 'Unable to process reset request.');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#060A14] text-slate-100 flex flex-col justify-between p-4 sm:p-8 cyber-grid-bg">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
        <BrandMark onClick={onGoHome} />
        <button
          type="button"
          onClick={onGoHome}
          className="inline-flex items-center gap-1.5 text-sm text-slate-300 hover:text-white cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Back to Home</span>
        </button>
      </div>

      <div className="mx-auto my-10 w-full max-w-md">
        <Card className="border-slate-800 bg-[#0B1221]/95 text-slate-100 shadow-2xl">
          <CardHeader>
            <CardTitle className="font-display text-2xl text-white">
              Sign in to TrustScan AI
            </CardTitle>
            <CardDescription className="text-slate-400">
              Access your forensic workspace, document vault, and audit reports.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {error && <Alert variant="destructive">{error}</Alert>}

              <div className="space-y-2">
                <Label htmlFor="login-email" className="text-slate-200">
                  Email address
                </Label>
                <div className="relative">
                  <Mail
                    className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500"
                    aria-hidden="true"
                  />
                  <Input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    placeholder="analyst@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9 border-slate-700 bg-slate-900/80 text-white"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="login-password" className="text-slate-200">
                    Password
                  </Label>
                  <button
                    type="button"
                    onClick={() => {
                      setResetEmail(email);
                      setResetMessage(null);
                      setResetError(null);
                      setForgotOpen(true);
                    }}
                    className="text-xs font-medium text-cyan-400 hover:text-cyan-300 cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock
                    className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500"
                    aria-hidden="true"
                  />
                  <Input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 pr-10 border-slate-700 bg-slate-900/80 text-white"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-2.5 rounded p-1 text-slate-400 hover:text-white cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? 'Signing in...' : 'Login'}
              </Button>
            </form>

            <div className="mt-6 border-t border-slate-800 pt-5 text-center text-sm text-slate-400">
              Need an analyst account?{' '}
              <button
                type="button"
                onClick={onGoSignup}
                className="font-medium text-cyan-400 hover:text-cyan-300 cursor-pointer"
              >
                Create account
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="text-center text-xs text-slate-500">
        TrustScan AI · Mode:{' '}
        {dataService.getBackendMode() === 'supabase' ? 'Supabase Cloud Auth' : 'Built-in Local Vault'}
      </p>

      <Dialog
        open={forgotOpen}
        onClose={() => setForgotOpen(false)}
        title="Reset Password"
        description="Enter your registered email address to receive password recovery instructions."
      >
        <form onSubmit={handleResetRequest} className="space-y-4">
          {resetError && <Alert variant="destructive">{resetError}</Alert>}
          {resetMessage && <Alert variant="success">{resetMessage}</Alert>}

          <div className="space-y-2">
            <Label htmlFor="reset-email">Account Email</Label>
            <Input
              id="reset-email"
              type="email"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              placeholder="analyst@company.com"
              required
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setForgotOpen(false)}>
              Close
            </Button>
            <Button type="submit" disabled={resetLoading}>
              {resetLoading ? 'Processing...' : 'Send Reset Instructions'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

interface SignupPageProps {
  onSuccess: (user: UserProfile) => void;
  onGoLogin: () => void;
  onGoHome: () => void;
}

export function SignupPage({ onSuccess, onGoLogin, onGoHome }: SignupPageProps) {
  const [fullName, setFullName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);

  const hasMinLen = password.length >= 8;
  const hasUpperAndLower = /[A-Z]/.test(password) && /[a-z]/.test(password);
  const hasDigit = /\d/.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (fullName.trim().length < 2) {
      setError('Full name must be at least 2 characters.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!hasMinLen || !hasUpperAndLower || !hasDigit) {
      setError(
        'Password must be at least 8 characters and include uppercase, lowercase, and a number.'
      );
      return;
    }
    if (!passwordsMatch) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const result = await dataService.signup(fullName, email, password);
      if (result.confirmationRequired) {
        setSuccessMsg(
          'Account created! Please check your email inbox to confirm your address before signing in.'
        );
      } else if (result.user) {
        onSuccess(result.user);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#060A14] text-slate-100 flex flex-col justify-between p-4 sm:p-8 cyber-grid-bg">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
        <BrandMark onClick={onGoHome} />
        <button
          type="button"
          onClick={onGoHome}
          className="inline-flex items-center gap-1.5 text-sm text-slate-300 hover:text-white cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Back to Home</span>
        </button>
      </div>

      <div className="mx-auto my-10 w-full max-w-md">
        <Card className="border-slate-800 bg-[#0B1221]/95 text-slate-100 shadow-2xl">
          <CardHeader>
            <CardTitle className="font-display text-2xl text-white">
              Create your TrustScan AI account
            </CardTitle>
            <CardDescription className="text-slate-400">
              Start analyzing digital documents and invoices with isolated user storage.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {error && <Alert variant="destructive">{error}</Alert>}
              {successMsg && <Alert variant="success">{successMsg}</Alert>}

              <div className="space-y-2">
                <Label htmlFor="signup-name" className="text-slate-200">
                  Full name
                </Label>
                <div className="relative">
                  <User
                    className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500"
                    aria-hidden="true"
                  />
                  <Input
                    id="signup-name"
                    type="text"
                    autoComplete="name"
                    placeholder="Alex Morgan"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="pl-9 border-slate-700 bg-slate-900/80 text-white"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-email" className="text-slate-200">
                  Email address
                </Label>
                <div className="relative">
                  <Mail
                    className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500"
                    aria-hidden="true"
                  />
                  <Input
                    id="signup-email"
                    type="email"
                    autoComplete="email"
                    placeholder="analyst@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9 border-slate-700 bg-slate-900/80 text-white"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-password" className="text-slate-200">
                  Password
                </Label>
                <div className="relative">
                  <Lock
                    className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-500"
                    aria-hidden="true"
                  />
                  <Input
                    id="signup-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Create a strong password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 pr-10 border-slate-700 bg-slate-900/80 text-white"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-2.5 rounded p-1 text-slate-400 hover:text-white cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-confirm" className="text-slate-200">
                  Confirm password
                </Label>
                <Input
                  id="signup-confirm"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="border-slate-700 bg-slate-900/80 text-white"
                  required
                />
              </div>

              <div className="space-y-1.5 rounded-lg border border-slate-800 bg-slate-900/50 p-3 text-xs">
                {[
                  { ok: hasMinLen, text: 'At least 8 characters' },
                  { ok: hasUpperAndLower, text: 'Uppercase and lowercase letters' },
                  { ok: hasDigit, text: 'At least one number' },
                  { ok: passwordsMatch, text: 'Passwords match' },
                ].map((rule) => (
                  <div
                    key={rule.text}
                    className={`flex items-center gap-2 ${
                      rule.ok ? 'text-emerald-400' : 'text-slate-400'
                    }`}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>{rule.text}</span>
                  </div>
                ))}
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? 'Creating account...' : 'Create Account'}
              </Button>
            </form>

            <div className="mt-6 border-t border-slate-800 pt-5 text-center text-sm text-slate-400">
              Already have an account?{' '}
              <button
                type="button"
                onClick={onGoLogin}
                className="font-medium text-cyan-400 hover:text-cyan-300 cursor-pointer"
              >
                Sign in
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="text-center text-xs text-slate-500">
        TrustScan AI · Protected Session Authentication
      </p>
    </div>
  );
}
