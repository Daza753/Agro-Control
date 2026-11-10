import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import {
  ApiUser,
  apiRequest,
  getActiveFarmId,
  getStoredTokens,
  refreshOfflineSnapshot,
  startOfflineSync,
  setActiveFarmId,
  storeTokens,
  TokenPair,
} from './api';
import {
  getOfflineIdentity,
  getTokenOwnerId,
  saveOfflineIdentity,
  saveOfflinePasswordVerifier,
  setOfflineUser,
  verifyOfflinePassword,
} from './offline';
import type { Farm, Profile } from './types';

export type { Profile, Role } from './types';

interface AuthUser {
  id: string;
  email: string;
}

interface AuthSession extends TokenPair {
  user: AuthUser;
}

interface AuthContextValue {
  session: AuthSession | null;
  user: AuthUser | null;
  profile: Profile | null;
  farms: Farm[];
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function loadCurrentUser(
  tokens: TokenPair,
): Promise<{ user: ApiUser; tokens: TokenPair; farms: Farm[] }> {
  let result: { user: ApiUser; tokens: TokenPair };
  try {
    result = {
      user: await apiRequest<ApiUser>('/api/auth/me/', {}, tokens.access),
      tokens,
    };
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('(401)')) throw error;
    const renewed = await apiRequest<{ access: string }>('/api/auth/refresh/', {
      method: 'POST',
      body: JSON.stringify({ refresh: tokens.refresh }),
    });
    const updatedTokens = { ...tokens, access: renewed.access };
    result = {
      user: await apiRequest<ApiUser>('/api/auth/me/', {}, updatedTokens.access),
      tokens: updatedTokens,
    };
  }
  setOfflineUser(result.user.id);
  storeTokens(result.tokens);
  const farms = await apiRequest<Farm[]>('/api/auth/farms/', {}, result.tokens.access);
  const activeFarmId = getActiveFarmId();
  if (!farms.some((farm) => farm.id === activeFarmId)) {
    setActiveFarmId(farms[0]?.id ?? null);
  }
  await saveOfflineIdentity({ user: result.user, farms });
  if (navigator.onLine) {
    for (const farm of farms) {
      try {
        await refreshOfflineSnapshot(farm.id);
      } catch (error) {
        console.warn(`No se pudo descargar la copia offline de ${farm.name}.`, error);
      }
    }
  }
  return { ...result, farms };
}

function toProfile(user: ApiUser): Profile {
  return {
    id: user.profile.id,
    email: user.email,
    full_name: user.profile.full_name,
    role: user.profile.role,
    active: user.profile.active,
    farm_id: user.profile.farm_id,
    photo_url: user.profile.photo_url,
    created_by: null,
    created_at: '',
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [loading, setLoading] = useState(true);

  const applySession = useCallback((tokens: TokenPair, user: ApiUser, userFarms: Farm[]) => {
    const nextSession = { ...tokens, user: { id: user.id, email: user.email } };
    storeTokens(tokens);
    setSession(nextSession);
    setProfile(toProfile(user));
    setFarms(userFarms);
  }, []);

  const clearSession = useCallback(() => {
    storeTokens(null);
    setSession(null);
    setProfile(null);
    setFarms([]);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!session) return;
    if (!navigator.onLine) return;
    try {
      const result = await loadCurrentUser(session);
      applySession(result.tokens, result.user, result.farms);
    } catch (error) {
      console.error('No se pudo actualizar el perfil autenticado.', error);
      if (!(error instanceof TypeError) && navigator.onLine) clearSession();
    }
  }, [applySession, clearSession, session]);

  useEffect(() => {
    let active = true;
    setOfflineUser(getTokenOwnerId() ?? getOfflineIdentity()?.user.id ?? null);
    const tokens = getStoredTokens();
    if (!tokens) {
      setLoading(false);
      return () => { active = false; };
    }
    if (!navigator.onLine) {
      const identity = getOfflineIdentity(getTokenOwnerId());
      if (identity && active) applySession(tokens, identity.user, identity.farms);
      setLoading(false);
      return () => { active = false; };
    }

    loadCurrentUser(tokens)
      .then(({ user, tokens: validTokens, farms: userFarms }) => {
        if (active) applySession(validTokens, user, userFarms);
      })
      .catch((error: unknown) => {
        console.error('No se pudo restaurar la sesión Django.', error);
        if (active) {
          if (error instanceof TypeError || !navigator.onLine) {
            const identity = getOfflineIdentity(getTokenOwnerId());
            if (identity) applySession(tokens, identity.user, identity.farms);
            else {
              setSession(null);
              setProfile(null);
              setFarms([]);
            }
          } else {
            clearSession();
          }
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [applySession, clearSession]);

  useEffect(() => {
    if (!session) return undefined;
    return startOfflineSync();
  }, [session]);

  const signIn = async (email: string, password: string) => {
    try {
      const tokens = await apiRequest<TokenPair>('/api/auth/login/', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      const result = await loadCurrentUser(tokens);
      applySession(result.tokens, result.user, result.farms);
      try {
        await saveOfflinePasswordVerifier(email, password);
      } catch (error) {
        console.warn('No se pudo habilitar el inicio de sesión offline en este dispositivo.', error);
      }
      return { error: null };
    } catch (error) {
      if (
        !navigator.onLine
        || error instanceof TypeError
        || (error instanceof Error && error.message.includes('requiere conexión y no se guardará offline'))
      ) {
        try {
          const identity = await verifyOfflinePassword(email, password);
          if (identity) {
            const cachedFarmId = getActiveFarmId();
            const farms = identity.farms;
            setOfflineUser(identity.user.id);
            if (!farms.some((farm) => farm.id === cachedFarmId)) setActiveFarmId(farms[0]?.id ?? null);
            const cachedTokens = getStoredTokens() ?? { access: '', refresh: '' };
            const cachedUser = identity.user;
            applySession(cachedTokens, cachedUser, farms);
            return { error: null };
          }
        } catch (offlineError) {
          console.warn('No se pudo verificar el acceso offline.', offlineError);
        }
      }
      if (navigator.onLine && error instanceof TypeError) {
        return {
          error: 'No se pudo conectar al servicio de FincaControl. Un equipo nuevo puede iniciar sesión sin haberlo hecho antes, pero debe tener conexión a Internet y alcanzar la dirección del servidor.',
        };
      }
      return {
        error: !navigator.onLine
          ? 'No hay conexión a Internet. Para iniciar sesión por primera vez en este equipo, conéctalo a Internet y al servicio de FincaControl; no necesitas haber iniciado sesión antes en este equipo.'
          : error instanceof Error ? error.message : 'No se pudo iniciar sesión.',
      };
    }
  };

  const signOut = async () => {
    clearSession();
    setOfflineUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        farms,
        loading,
        signIn,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function isAdmin(profile: Profile | null): boolean {
  return profile?.role === 'admin';
}
