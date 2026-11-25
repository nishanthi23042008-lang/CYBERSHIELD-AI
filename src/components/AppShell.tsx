import * as React from 'react';
import {
  CopyCheck,
  FileCheck2,
  FileSearch,
  FileSpreadsheet,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  UploadCloud,
  User,
  X,
} from 'lucide-react';
import type { UserProfile } from '../types/forensics';
import { cn } from '../lib/utils';
import { BrandMark } from './BrandMark';
import { Button } from './ui/button';

export type WorkspaceRoute =
  | 'dashboard'
  | 'upload'
  | 'analysis'
  | 'risk'
  | 'invoice-verification'
  | 'duplicates'
  | 'history'
  | 'reports'
  | 'profile'
  | 'settings';

interface AppShellProps {
  user: UserProfile;
  activeRoute: WorkspaceRoute;
  onNavigate: (route: WorkspaceRoute) => void;
  onLogout: () => void;
  pageTitle: string;
  breadcrumbParent?: string;
  children: React.ReactNode;
}

const NAV_ITEMS: Array<{
  route: WorkspaceRoute;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { route: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { route: 'upload', label: 'Upload Document', icon: UploadCloud },
  { route: 'analysis', label: 'Document Analysis', icon: FileSearch },
  { route: 'invoice-verification', label: 'Invoice Verification', icon: FileSpreadsheet },
  { route: 'duplicates', label: 'Duplicate Checker', icon: CopyCheck },
  { route: 'history', label: 'Analysis History', icon: History },
  { route: 'reports', label: 'Reports', icon: FileCheck2 },
  { route: 'profile', label: 'Profile', icon: User },
  { route: 'settings', label: 'Settings', icon: Settings },
];

export function AppShell({
  user,
  activeRoute,
  onNavigate,
  onLogout,
  pageTitle,
  breadcrumbParent = 'Workspace',
  children,
}: AppShellProps) {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const handleSelect = (route: WorkspaceRoute) => {
    onNavigate(route);
    setMobileOpen(false);
  };

  const renderSidebarBody = () => (
    <div className="flex h-full flex-col justify-between px-3 py-5">
      <div>
        <div className="px-3 pb-6">
          <BrandMark onClick={() => handleSelect('dashboard')} />
        </div>
        <nav aria-label="Primary Sidebar" className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              activeRoute === item.route ||
              (activeRoute === 'risk' && item.route === 'analysis');
            return (
              <button
                key={item.route}
                type="button"
                onClick={() => handleSelect(item.route)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150 whitespace-nowrap cursor-pointer',
                  isActive
                    ? 'bg-blue-600/15 text-blue-700 dark:bg-blue-600/20 dark:text-cyan-300'
                    : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-slate-100'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
        <div className="mb-3 px-3">
          <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
            {user.full_name}
          </p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40 transition-colors whitespace-nowrap cursor-pointer"
        >
          <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-[#060A14] dark:text-slate-100 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-slate-200 bg-white/95 dark:border-slate-800/90 dark:bg-[#080E1C]/95 backdrop-blur-md z-30">
        {renderSidebarBody()}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-72 max-w-[85vw] bg-white dark:bg-[#080E1C] border-r border-slate-200 dark:border-slate-800 z-10 flex flex-col">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation menu"
              className="absolute right-3 top-4 rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
            {renderSidebarBody()}
          </aside>
        </div>
      )}

      {/* Main Content Viewport */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white/85 px-4 sm:px-6 lg:px-8 backdrop-blur-md dark:border-slate-800/90 dark:bg-[#060A14]/85">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="hidden sm:inline text-slate-500 dark:text-slate-400 whitespace-nowrap">
                {breadcrumbParent}
              </span>
              <span className="hidden sm:inline text-slate-400 dark:text-slate-600" aria-hidden="true">
                /
              </span>
              <h1 className="font-display font-semibold text-slate-900 dark:text-white truncate">
                {pageTitle}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Button
              size="sm"
              onClick={() => onNavigate('upload')}
              className="whitespace-nowrap shrink-0"
            >
              <UploadCloud className="h-4 w-4" aria-hidden="true" />
              <span>Upload Document</span>
            </Button>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 max-w-[1360px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
