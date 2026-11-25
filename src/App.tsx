import * as React from 'react';
import { AppShell, type WorkspaceRoute } from './components/AppShell';
import { dataService } from './lib/dataService';
import { AnalysisAndRiskPage } from './pages/AnalysisAndRiskPage';
import { LoginPage, SignupPage } from './pages/AuthPages';
import { DashboardPage } from './pages/DashboardPage';
import { DuplicateCheckerPage } from './pages/DuplicateCheckerPage';
import { HistoryPage } from './pages/HistoryPage';
import { InvoiceVerificationPage } from './pages/InvoiceVerificationPage';
import { LandingPage } from './pages/LandingPage';
import { ProfileAndSettingsPage } from './pages/ProfileAndSettingsPage';
import { ReportPage } from './pages/ReportPage';
import { UploadPage } from './pages/UploadPage';
import type { FullDocumentBundle, PublicStats, UserProfile } from './types/forensics';

type AppRoute = 'landing' | 'login' | 'signup' | WorkspaceRoute;

const WORKSPACE_ROUTES = new Set<WorkspaceRoute>([
  'dashboard',
  'upload',
  'analysis',
  'risk',
  'invoice-verification',
  'duplicates',
  'history',
  'reports',
  'profile',
  'settings',
]);

function parsePathToRoute(pathname: string): AppRoute {
  const clean = pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
  if (!clean) return 'landing';
  if (clean === 'login') return 'login';
  if (clean === 'signup') return 'signup';
  if (WORKSPACE_ROUTES.has(clean as WorkspaceRoute)) {
    return clean as WorkspaceRoute;
  }
  return 'landing';
}

const ROUTE_TITLES: Record<WorkspaceRoute, { title: string; parent: string }> = {
  dashboard: { title: 'Dashboard', parent: 'Workspace' },
  upload: { title: 'Document Upload', parent: 'Workspace' },
  analysis: { title: 'Document Analysis', parent: 'Forensics' },
  risk: { title: 'Risk Assessment', parent: 'Forensics' },
  'invoice-verification': { title: 'Invoice Verification', parent: 'Forensics' },
  duplicates: { title: 'Duplicate Checker', parent: 'Forensics' },
  history: { title: 'Analysis History', parent: 'Records' },
  reports: { title: 'Detailed Report', parent: 'Records' },
  profile: { title: 'Profile', parent: 'Account' },
  settings: { title: 'Settings', parent: 'Account' },
};

export default function App() {
  const [route, setRoute] = React.useState<AppRoute>(() =>
    parsePathToRoute(window.location.pathname)
  );
  const [user, setUser] = React.useState<UserProfile | null>(null);
  const [authChecking, setAuthChecking] = React.useState(true);
  const [publicStats, setPublicStats] = React.useState<PublicStats | null>(null);
  const [documents, setDocuments] = React.useState<FullDocumentBundle[]>([]);
  const [docsLoading, setDocsLoading] = React.useState(false);
  const [selectedDocId, setSelectedDocId] = React.useState<string | null>(null);
  const [theme, setTheme] = React.useState<'dark' | 'light'>('dark');

  // Sync Tailwind .dark class on <html>
  React.useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const navigate = React.useCallback((next: AppRoute) => {
    setRoute(next);
    const targetPath = next === 'landing' ? '/' : `/${next}`;
    if (window.location.pathname !== targetPath) {
      window.history.pushState({ route: next }, '', targetPath);
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  React.useEffect(() => {
    const onPopState = () => {
      setRoute(parsePathToRoute(window.location.pathname));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const refreshPublicStats = React.useCallback(async () => {
    try {
      const stats = await dataService.fetchPublicStats();
      setPublicStats(stats);
    } catch {
      // ignore non-fatal public telemetry fetch error
    }
  }, []);

  const loadUserDocuments = React.useCallback(async () => {
    setDocsLoading(true);
    try {
      const list = await dataService.listDocuments();
      setDocuments(list);
      setSelectedDocId((prev) =>
        prev && list.some((b) => b.document.id === prev) ? prev : list[0]?.document.id ?? null
      );
    } catch {
      setDocuments([]);
    } finally {
      setDocsLoading(false);
    }
  }, []);

  // Initial session + public stats bootstrap
  React.useEffect(() => {
    let active = true;
    void (async () => {
      await refreshPublicStats();
      try {
        const currentUser = await dataService.getCurrentUser();
        if (!active) return;
        setUser(currentUser);
        if (currentUser) {
          await loadUserDocuments();
        }
      } finally {
        if (active) setAuthChecking(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [loadUserDocuments, refreshPublicStats]);

  // Protected route enforcement
  React.useEffect(() => {
    if (authChecking) return;
    if (!user && WORKSPACE_ROUTES.has(route as WorkspaceRoute)) {
      navigate('login');
    }
  }, [authChecking, user, route, navigate]);

  const handleAuthSuccess = async (loggedInUser: UserProfile) => {
    setUser(loggedInUser);
    await loadUserDocuments();
    navigate('dashboard');
  };

  const handleLogout = async () => {
    await dataService.logout();
    setUser(null);
    setDocuments([]);
    setSelectedDocId(null);
    await refreshPublicStats();
    navigate('landing');
  };

  const handleUploadComplete = (bundle: FullDocumentBundle) => {
    setDocuments((prev) => [bundle, ...prev]);
    setSelectedDocId(bundle.document.id);
    void refreshPublicStats();
  };

  const handleBundleUpdated = (updated: FullDocumentBundle) => {
    setDocuments((prev) =>
      prev.map((item) => (item.document.id === updated.document.id ? updated : item))
    );
    void refreshPublicStats();
  };

  const handleDocumentDeleted = (docId: string) => {
    setDocuments((prev) => {
      const next = prev.filter((item) => item.document.id !== docId);
      if (selectedDocId === docId) {
        setSelectedDocId(next[0]?.document.id ?? null);
      }
      return next;
    });
    void refreshPublicStats();
  };

  const handleSelectDocument = (docId: string, targetRoute: WorkspaceRoute) => {
    setSelectedDocId(docId);
    navigate(targetRoute);
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#060A14] text-slate-100 flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
          <p className="text-sm text-slate-400">Initializing TrustScan AI...</p>
        </div>
      </div>
    );
  }

  if (route === 'landing') {
    return (
      <LandingPage
        user={user}
        stats={publicStats}
        onGoLogin={() => navigate('login')}
        onGoSignup={() => navigate('signup')}
        onGoDashboard={() => navigate('dashboard')}
      />
    );
  }

  if (route === 'login') {
    return (
      <LoginPage
        onSuccess={(u) => void handleAuthSuccess(u)}
        onGoSignup={() => navigate('signup')}
        onGoHome={() => navigate('landing')}
      />
    );
  }

  if (route === 'signup') {
    return (
      <SignupPage
        onSuccess={(u) => void handleAuthSuccess(u)}
        onGoLogin={() => navigate('login')}
        onGoHome={() => navigate('landing')}
      />
    );
  }

  if (!user) {
    return (
      <LoginPage
        onSuccess={(u) => void handleAuthSuccess(u)}
        onGoSignup={() => navigate('signup')}
        onGoHome={() => navigate('landing')}
      />
    );
  }

  const activeWorkspaceRoute = WORKSPACE_ROUTES.has(route as WorkspaceRoute)
    ? (route as WorkspaceRoute)
    : 'dashboard';
  const headerMeta = ROUTE_TITLES[activeWorkspaceRoute];

  return (
    <AppShell
      user={user}
      activeRoute={activeWorkspaceRoute}
      onNavigate={(r) => navigate(r)}
      onLogout={() => void handleLogout()}
      pageTitle={headerMeta.title}
      breadcrumbParent={headerMeta.parent}
    >
      {activeWorkspaceRoute === 'dashboard' && (
        <DashboardPage
          user={user}
          documents={documents}
          loading={docsLoading}
          onNavigate={(r) => navigate(r)}
          onSelectDocument={handleSelectDocument}
        />
      )}

      {activeWorkspaceRoute === 'upload' && (
        <UploadPage
          onUploadComplete={handleUploadComplete}
          onNavigateToAnalysis={handleSelectDocument}
        />
      )}

      {(activeWorkspaceRoute === 'analysis' || activeWorkspaceRoute === 'risk') && (
        <AnalysisAndRiskPage
          mode={activeWorkspaceRoute}
          documents={documents}
          selectedDocId={selectedDocId}
          onSelectDocId={setSelectedDocId}
          onNavigate={(r) => navigate(r)}
        />
      )}

      {activeWorkspaceRoute === 'invoice-verification' && (
        <InvoiceVerificationPage
          documents={documents}
          selectedDocId={selectedDocId}
          onSelectDocId={setSelectedDocId}
          onBundleUpdated={handleBundleUpdated}
          onNavigate={(r) => navigate(r)}
        />
      )}

      {activeWorkspaceRoute === 'duplicates' && (
        <DuplicateCheckerPage
          documents={documents}
          onSelectDocument={handleSelectDocument}
        />
      )}

      {activeWorkspaceRoute === 'history' && (
        <HistoryPage
          documents={documents}
          onSelectDocument={handleSelectDocument}
          onDocumentDeleted={handleDocumentDeleted}
          onNavigate={(r) => navigate(r)}
        />
      )}

      {activeWorkspaceRoute === 'reports' && (
        <ReportPage
          user={user}
          documents={documents}
          selectedDocId={selectedDocId}
          onSelectDocId={setSelectedDocId}
          onNavigate={(r) => navigate(r)}
        />
      )}

      {(activeWorkspaceRoute === 'profile' || activeWorkspaceRoute === 'settings') && (
        <ProfileAndSettingsPage
          section={activeWorkspaceRoute}
          user={user}
          documentsCount={documents.length}
          theme={theme}
          onToggleTheme={setTheme}
          onUserUpdated={setUser}
          onLogout={() => void handleLogout()}
        />
      )}
    </AppShell>
  );
}
