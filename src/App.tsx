import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './lib/auth';
import { SettingsProvider, useSettings } from './lib/settings';
import { ModuleThemeProvider } from './lib/moduleThemes';
import { ModuleAccessProvider, useModuleAccess } from './lib/moduleAccess';
import { Login } from './pages/Login';
import { Layout, PageKey } from './components/Layout';
import { DynamicTheme } from './components/DynamicTheme';
import { ThemeScope } from './components/ThemeScope';
import { Dashboard } from './pages/Dashboard';
import { Animals } from './pages/Animals';
import { MilkProductionPage } from './pages/MilkProduction';
import { Vaccines } from './pages/Vaccines';
import { Medications } from './pages/Medications';
import { Inputs } from './pages/Inputs';
import { EquipmentPage } from './pages/Equipment';
import { Crops } from './pages/Crops';
import { FishFarming } from './pages/FishFarming';
import { Activities } from './pages/Activities';
import { WorkerDataEntry } from './pages/WorkerDataEntry';
import { Diseases } from './pages/Diseases';
import { Reports } from './pages/Reports';
import { UsersPage } from './pages/Users';
import { FarmsPage, Settings } from './pages/Settings';
import { HelpInfo } from './pages/HelpInfo';

function AppContent() {
  const { session, profile, farms, loading } = useAuth();
  const { updateSettings } = useSettings();
  const { isModuleEnabled } = useModuleAccess();
  const [page, setPage] = useState<PageKey>('dashboard');

  useEffect(() => {
    if (!session) setPage('dashboard');
  }, [session]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session || !profile) {
    return <Login />;
  }

  // Guard: non-admin can't access admin-only pages or disabled modules
  const adminOnly: PageKey[] = ['reports', 'users', 'farms', 'settings'];
  let currentPage = page;
  if (profile.role === 'admin' && farms.length === 0) {
    currentPage = 'settings';
  }
  if (adminOnly.includes(page) && profile.role !== 'admin') {
    currentPage = isModuleEnabled('dashboard') ? 'dashboard' : 'help';
  }
  if (profile.role === 'trabajador' && currentPage !== 'dashboard' && !isModuleEnabled(currentPage)) {
    const workerPages: PageKey[] = [
      'dashboard', 'animals', 'milk', 'vaccines', 'medications',
      'inputs', 'equipment', 'crops', 'fish', 'activities', 'diseases',
    ];
    const firstAvailablePage = workerPages.find((candidate) => isModuleEnabled(candidate)) ?? 'help';
    currentPage = firstAvailablePage;
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <ThemeScope moduleKey="dashboard"><Dashboard profile={profile!} onNavigate={setPage} /></ThemeScope>;
      case 'animals': return <ThemeScope moduleKey="animals"><Animals /></ThemeScope>;
      case 'milk': return <ThemeScope moduleKey="milk"><MilkProductionPage /></ThemeScope>;
      case 'vaccines': return <ThemeScope moduleKey="vaccines"><Vaccines /></ThemeScope>;
      case 'medications': return <ThemeScope moduleKey="medications"><Medications /></ThemeScope>;
      case 'inputs': return <ThemeScope moduleKey="inputs"><Inputs /></ThemeScope>;
      case 'equipment': return <ThemeScope moduleKey="equipment"><EquipmentPage /></ThemeScope>;
      case 'crops': return <ThemeScope moduleKey="crops"><Crops /></ThemeScope>;
      case 'fish': return <ThemeScope moduleKey="fish"><FishFarming /></ThemeScope>;
      case 'activities': return (
        <ThemeScope moduleKey="activities">
          {profile.role === 'trabajador' ? <WorkerDataEntry /> : <Activities />}
        </ThemeScope>
      );
      case 'diseases': return <ThemeScope moduleKey="diseases"><Diseases /></ThemeScope>;
      case 'reports': return <ThemeScope moduleKey="reports"><Reports /></ThemeScope>;
      case 'users': return <ThemeScope moduleKey="users"><UsersPage /></ThemeScope>;
      case 'farms': return <ThemeScope moduleKey="settings"><FarmsPage /></ThemeScope>;
      case 'settings': return <ThemeScope moduleKey="settings"><Settings onSettingsChange={updateSettings} /></ThemeScope>;
      case 'help': return <HelpInfo />;
      default: return <ThemeScope moduleKey="dashboard"><Dashboard profile={profile!} onNavigate={setPage} /></ThemeScope>;
    }
  };

  return (
    <>
      <DynamicTheme />
      <Layout current={currentPage} onNavigate={setPage} profile={profile!}>
        {renderPage()}
      </Layout>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <ModuleThemeProvider>
          <ModuleAccessProvider>
            <AppContent />
          </ModuleAccessProvider>
        </ModuleThemeProvider>
      </SettingsProvider>
    </AuthProvider>
  );
}
