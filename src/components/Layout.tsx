import { useState, ReactNode } from 'react';
import {
  LayoutDashboard, PawPrint, Droplets, Syringe, Pill, Package,
  Wrench, Sprout, Fish, Activity, Stethoscope, FileText, Users,
  Settings as SettingsIcon, LogOut, Menu, X, ChevronRight, HelpCircle,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useSettings } from '../lib/settings';
import { useModuleAccess } from '../lib/moduleAccess';
import type { Profile } from '../lib/auth';
import { OfflineStatus } from './OfflineStatus';

export type PageKey =
  | 'dashboard' | 'animals' | 'milk' | 'vaccines' | 'medications'
  | 'inputs' | 'equipment' | 'crops' | 'fish' | 'activities'
  | 'diseases' | 'reports' | 'users' | 'farms' | 'settings' | 'help';

interface NavItem {
  key: PageKey;
  label: string;
  icon: ReactNode;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Inicio', icon: <LayoutDashboard size={20} /> },
  { key: 'animals', label: 'Animales', icon: <PawPrint size={20} /> },
  { key: 'milk', label: 'Produccion de Leche', icon: <Droplets size={20} /> },
  { key: 'vaccines', label: 'Vacunas', icon: <Syringe size={20} /> },
  { key: 'medications', label: 'Medicamentos', icon: <Pill size={20} /> },
  { key: 'inputs', label: 'Insumos', icon: <Package size={20} /> },
  { key: 'equipment', label: 'Equipos', icon: <Wrench size={20} /> },
  { key: 'crops', label: 'Cultivos', icon: <Sprout size={20} /> },
  { key: 'fish', label: 'Piscicultura', icon: <Fish size={20} /> },
  { key: 'activities', label: 'Actividades', icon: <Activity size={20} /> },
  { key: 'diseases', label: 'Enfermedades', icon: <Stethoscope size={20} /> },
  { key: 'reports', label: 'Reportes', icon: <FileText size={20} />, adminOnly: true },
  { key: 'users', label: 'Usuarios', icon: <Users size={20} />, adminOnly: true },
  { key: 'farms', label: 'Fincas', icon: <Sprout size={20} />, adminOnly: true },
  { key: 'settings', label: 'Configuracion', icon: <SettingsIcon size={20} />, adminOnly: true },
  { key: 'help', label: 'Ayuda e Informacion', icon: <HelpCircle size={20} /> },
];

interface LayoutProps {
  current: PageKey;
  onNavigate: (page: PageKey) => void;
  profile: Profile;
  children: ReactNode;
}

export function Layout({ current, onNavigate, profile, children }: LayoutProps) {
  const { signOut } = useAuth();
  const { settings } = useSettings();
  const { isModuleEnabled } = useModuleAccess();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAdmin = profile.role === 'admin';
  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.adminOnly && !isAdmin) return false;
    if (item.key === 'help') return true;
    if (!isAdmin && !isModuleEnabled(item.key)) return false;
    return true;
  });

  const sidebarBg = settings?.sidebar_style === 'light' ? 'bg-white' : 'bg-slate-900';
  const sidebarText = settings?.sidebar_style === 'light' ? 'text-slate-700' : 'text-slate-300';
  const sidebarActive = settings?.sidebar_style === 'light' ? 'bg-slate-100' : 'bg-slate-800';
  const sidebarHover = settings?.sidebar_style === 'light' ? 'hover:bg-slate-50' : 'hover:bg-slate-800/60';

  const headerBg =
    settings?.header_style === 'transparent' ? 'bg-transparent' :
    settings?.header_style === 'dark' ? 'bg-slate-900' : 'bg-white';
  const headerText =
    settings?.header_style === 'transparent' ? 'text-slate-800' :
    settings?.header_style === 'dark' ? 'text-white' : 'text-slate-800';
  const headerBorder =
    settings?.header_style === 'transparent' ? 'border-b border-slate-200' :
    settings?.header_style === 'dark' ? 'border-b border-slate-800' : 'border-b border-slate-100';

  const farmName = settings?.farm_name || 'Mi Finca';
  const logoUrl = settings?.logo_url;
  const primaryColor = settings?.primary_color || '#059669';

  const currentLabel = current === 'activities' && profile.role === 'trabajador'
    ? 'Carga de datos'
    : NAV_ITEMS.find((item) => item.key === current)?.label || 'Inicio';

  const handleNavigate = (page: PageKey) => {
    onNavigate(page);
    setMobileOpen(false);
  };

  if (!isAdmin) {
    return (
      <div className={`app-shell h-screen flex flex-col overflow-hidden bg-slate-50 ${settings?.background_mode === 'dark' ? 'app-theme-dark' : ''}`}>
        <header className={`flex-shrink-0 ${headerBg} ${headerBorder}`}>
          <div className="flex items-center justify-between gap-4 px-4 py-3 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              {current !== 'dashboard' && (
                <button
                  type="button"
                  onClick={() => handleNavigate('dashboard')}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    settings?.header_style === 'dark'
                      ? 'border-slate-600 bg-slate-800 text-white hover:border-slate-500 hover:bg-slate-700'
                      : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-100'
                  }`}
                >
                  Volver a inicio
                </button>
              )}
              {logoUrl ? (
                <img src={logoUrl} alt="" className="h-9 w-9 flex-shrink-0 rounded-lg object-contain" />
              ) : (
                <div
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg font-bold text-white"
                  style={{ backgroundColor: primaryColor }}
                >
                  {farmName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className={`truncate text-sm font-semibold ${headerText}`}>{currentLabel}</p>
                <p className="truncate text-xs text-slate-500">{farmName}</p>
              </div>
              <OfflineStatus presentation="modal" />
            </div>
            <div className="flex flex-shrink-0 items-center gap-3">
              <div
                className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full text-sm font-semibold text-white"
                style={{ backgroundColor: primaryColor }}
              >
                {profile.photo_url ? (
                  <img src={profile.photo_url} alt={profile.full_name} className="h-full w-full object-cover" />
                ) : profile.full_name.charAt(0).toUpperCase()}
              </div>
              <span className={`hidden text-sm sm:block ${headerText}`}>{profile.full_name}</span>
              <button
                type="button"
                onClick={signOut}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          {children}
        </main>
        {settings?.show_footer && (
          <footer className="app-footer flex-shrink-0 border-t border-slate-200 bg-white px-4 py-3 lg:px-8">
            <p className="text-center text-xs text-slate-500">
              {settings.footer_text || 'Derechos reservados © Oscar David Vega Daza'}
            </p>
          </footer>
        )}
      </div>
    );
  }

  const SidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo / Farm Name */}
      <div className={`px-5 py-5 flex items-center gap-3 border-b ${settings?.sidebar_style === 'light' ? 'border-slate-200' : 'border-slate-800'}`}>
        {logoUrl ? (
          <img src={logoUrl} alt="Logo" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
        ) : (
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
            style={{ backgroundColor: primaryColor }}
          >
            {farmName.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className={`font-bold text-sm truncate ${settings?.sidebar_style === 'light' ? 'text-slate-800' : 'text-white'}`}>
            {farmName}
          </p>
          <p className={`text-xs ${sidebarText}`}>Sistema de Gestion</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {visibleItems.map((item) => {
          const isActive = current === item.key;
          return (
            <button
              key={item.key}
              onClick={() => handleNavigate(item.key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? `${sidebarActive} ${settings?.sidebar_style === 'light' ? 'text-slate-900' : 'text-white'}`
                  : `${sidebarText} ${sidebarHover}`
              }`}
              style={isActive ? { color: primaryColor } : undefined}
            >
              <span style={isActive ? { color: primaryColor } : undefined}>{item.icon}</span>
              <span className="truncate">{item.label}</span>
              {isActive && <ChevronRight size={16} className="ml-auto" style={{ color: primaryColor }} />}
            </button>
          );
        })}
      </nav>

      {/* User + Logout */}
      <div className={`px-3 py-4 border-t ${settings?.sidebar_style === 'light' ? 'border-slate-200' : 'border-slate-800'}`}>
        <div className="flex items-center gap-3 px-2 mb-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
            style={{ backgroundColor: primaryColor }}
          >
            {profile.photo_url ? (
              <img src={profile.photo_url} alt={profile.full_name} className="h-full w-full rounded-full object-cover" />
            ) : profile.full_name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className={`text-sm font-medium truncate ${settings?.sidebar_style === 'light' ? 'text-slate-800' : 'text-white'}`}>
              {profile.full_name}
            </p>
            <p className={`text-xs ${sidebarText} capitalize`}>{profile.role}</p>
          </div>
        </div>
        <button
          onClick={signOut}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${sidebarText} ${sidebarHover}`}
        >
          <LogOut size={20} />
          Cerrar sesion
        </button>
      </div>
    </div>
  );

  return (
    <div className={`app-shell h-screen flex overflow-hidden bg-slate-50 ${settings?.background_mode === 'dark' ? 'app-theme-dark' : ''}`}>
      {/* Desktop Sidebar - fixed */}
      <aside className={`hidden lg:flex w-64 flex-shrink-0 ${sidebarBg} ${settings?.sidebar_style === 'light' ? 'border-r border-slate-200' : ''} h-full`}>
        {SidebarContent}
      </aside>

      {/* Mobile Sidebar */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className={`relative w-64 h-full ${sidebarBg} animate-slide-in-left`}>
            <button
              onClick={() => setMobileOpen(false)}
              className={`absolute top-4 right-4 p-1.5 rounded-lg ${sidebarText} hover:bg-slate-800`}
            >
              <X size={20} />
            </button>
            {SidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content - scrollable area only */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* Header - fixed */}
        <header className={`flex-shrink-0 z-30 ${headerBg} ${headerBorder}`}>
          <div className="px-4 lg:px-8 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileOpen(true)}
                className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
              >
                <Menu size={22} />
              </button>
              {logoUrl ? (
                <img src={logoUrl} alt="" className="h-9 w-9 flex-shrink-0 rounded-lg object-contain" />
              ) : (
                <div
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg font-bold text-white"
                  style={{ backgroundColor: primaryColor }}
                >
                  {farmName.charAt(0).toUpperCase()}
                </div>
              )}
              <span className={`hidden max-w-36 truncate text-sm font-semibold sm:block ${headerText}`}>
                {farmName}
              </span>
              <OfflineStatus presentation="modal" />
              <span className={`hidden h-8 border-l sm:block ${settings?.header_style === 'dark' ? 'border-slate-700' : 'border-slate-200'}`} />
              <h1 className={`text-lg lg:text-xl font-bold ${headerText}`}>{currentLabel}</h1>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-sm ${headerText} hidden sm:block`}>{profile.full_name}</span>
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold"
                style={{ backgroundColor: primaryColor }}
              >
                {profile.photo_url ? (
                  <img src={profile.photo_url} alt={profile.full_name} className="h-full w-full rounded-full object-cover" />
                ) : profile.full_name.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content - scrollable */}
        <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
          {children}
        </main>

        {/* Footer - fixed */}
        {settings?.show_footer && (
          <footer className="app-footer flex-shrink-0 px-4 lg:px-8 py-4 border-t border-slate-200 bg-white">
            <p className="text-center text-xs text-slate-500">
              {settings.footer_text || 'Derechos reservados © Oscar David Vega Daza'}
            </p>
          </footer>
        )}
      </div>
    </div>
  );
}
