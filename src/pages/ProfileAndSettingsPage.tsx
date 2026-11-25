import * as React from 'react';
import { KeyRound, LogOut, Moon, Save, Sun, User } from 'lucide-react';
import { Alert } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { dataService } from '../lib/dataService';
import { formatDateTime } from '../lib/utils';
import type { UserProfile } from '../types/forensics';

interface ProfileAndSettingsPageProps {
  section: 'profile' | 'settings';
  user: UserProfile;
  documentsCount: number;
  theme: 'dark' | 'light';
  onToggleTheme: (next: 'dark' | 'light') => void;
  onUserUpdated: (user: UserProfile) => void;
  onLogout: () => void;
}

export function ProfileAndSettingsPage({
  section,
  user,
  documentsCount,
  theme,
  onToggleTheme,
  onUserUpdated,
  onLogout,
}: ProfileAndSettingsPageProps) {
  const [fullName, setFullName] = React.useState(user.full_name);
  const [profileSaving, setProfileSaving] = React.useState(false);
  const [profileFeedback, setProfileFeedback] = React.useState<{
    type: 'success' | 'error';
    msg: string;
  } | null>(null);

  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmNewPassword, setConfirmNewPassword] = React.useState('');
  const [pwdSaving, setPwdSaving] = React.useState(false);
  const [pwdFeedback, setPwdFeedback] = React.useState<{
    type: 'success' | 'error';
    msg: string;
  } | null>(null);

  React.useEffect(() => {
    setFullName(user.full_name);
  }, [user.full_name]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileFeedback(null);
    if (fullName.trim().length < 2) {
      setProfileFeedback({ type: 'error', msg: 'Full name must be at least 2 characters.' });
      return;
    }
    setProfileSaving(true);
    try {
      const updated = await dataService.updateProfile(fullName);
      onUserUpdated(updated);
      setProfileFeedback({ type: 'success', msg: 'Profile updated successfully.' });
    } catch (err) {
      setProfileFeedback({
        type: 'error',
        msg: err instanceof Error ? err.message : 'Unable to update profile.',
      });
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdFeedback(null);

    if (dataService.getBackendMode() !== 'supabase' && !currentPassword) {
      setPwdFeedback({ type: 'error', msg: 'Enter your current password.' });
      return;
    }
    if (newPassword.length < 8) {
      setPwdFeedback({ type: 'error', msg: 'New password must be at least 8 characters.' });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPwdFeedback({ type: 'error', msg: 'New passwords do not match.' });
      return;
    }

    setPwdSaving(true);
    try {
      const msg = await dataService.changePassword(currentPassword, newPassword);
      setPwdFeedback({ type: 'success', msg });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err) {
      setPwdFeedback({
        type: 'error',
        msg: err instanceof Error ? err.message : 'Unable to update password.',
      });
    } finally {
      setPwdSaving(false);
    }
  };

  const backendMode = dataService.getBackendMode();

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-5 dark:border-slate-800">
        <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          {section === 'profile' ? 'User Profile' : 'Account & Theme Settings'}
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Manage your analyst identity, security credentials, appearance, and backend connection.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Profile Card */}
        <Card className="lg:col-span-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-4.5 w-4.5 text-cyan-500" aria-hidden="true" />
              <span>Analyst Profile</span>
            </CardTitle>
            <CardDescription>
              Account created {formatDateTime(user.created_at)} · {documentsCount} document(s) in
              vault
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {profileFeedback && (
              <Alert variant={profileFeedback.type === 'success' ? 'success' : 'destructive'}>
                <span>{profileFeedback.msg}</span>
              </Alert>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="profile-name">Full Name</Label>
                <Input
                  id="profile-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="profile-email">Registered Email</Label>
                <Input id="profile-email" value={user.email} disabled className="opacity-75" />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <Button type="submit" disabled={profileSaving}>
                  <Save className="h-4 w-4" aria-hidden="true" />
                  <span>{profileSaving ? 'Saving...' : 'Save Profile'}</span>
                </Button>

                <Button type="button" variant="outline" onClick={onLogout}>
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  <span>Sign Out</span>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Password Reset / Security */}
        <Card className="lg:col-span-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-4.5 w-4.5 text-blue-500" aria-hidden="true" />
              <span>Password &amp; Security</span>
            </CardTitle>
            <CardDescription>
              Update your account password (minimum 8 characters)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {pwdFeedback && (
              <Alert variant={pwdFeedback.type === 'success' ? 'success' : 'destructive'}>
                <span>{pwdFeedback.msg}</span>
              </Alert>
            )}

            <form onSubmit={handlePasswordChange} className="space-y-3.5">
              {backendMode !== 'supabase' && (
                <div className="space-y-1.5">
                  <Label htmlFor="curr-pwd">Current Password</Label>
                  <Input
                    id="curr-pwd"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="new-pwd">New Password</Label>
                <Input
                  id="new-pwd"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm-new-pwd">Confirm New Password</Label>
                <Input
                  id="confirm-new-pwd"
                  type="password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Re-enter new password"
                />
              </div>

              <Button type="submit" disabled={pwdSaving}>
                {pwdSaving ? 'Updating...' : 'Update Password'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Theme & Backend Environment Card */}
        <Card className="lg:col-span-12">
          <CardHeader>
            <CardTitle>Interface Theme &amp; Storage Backend</CardTitle>
            <CardDescription>
              Customize workspace appearance and verify Supabase configuration status
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800 space-y-3">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                Theme Preference
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Switch between Dark Navy Cybersecurity mode and Crisp Light Slate mode.
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={theme === 'dark' ? 'default' : 'outline'}
                  onClick={() => onToggleTheme('dark')}
                >
                  <Moon className="h-4 w-4" aria-hidden="true" />
                  <span>Dark Navy</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={theme === 'light' ? 'default' : 'outline'}
                  onClick={() => onToggleTheme('light')}
                >
                  <Sun className="h-4 w-4" aria-hidden="true" />
                  <span>Light Slate</span>
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800 space-y-2">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                Active Database &amp; Storage Mode
              </p>
              <p className="font-mono text-xs text-cyan-600 dark:text-cyan-400">
                {backendMode === 'supabase'
                  ? 'Supabase Cloud (PostgreSQL + Auth + Storage)'
                  : 'Built-in Express Local Vault (data/trustscan-db.json)'}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {backendMode === 'supabase'
                  ? 'Connected to your configured Supabase project with Row Level Security.'
                  : 'To switch to Supabase Cloud, execute supabase/schema.sql in your Supabase SQL Editor and set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
