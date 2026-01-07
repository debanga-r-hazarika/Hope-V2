import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import {
  getAdminAccess,
  getDefaultModuleAccess,
  type AccessLevel,
  type ModuleAccessMap,
} from '../types/access';
import { MODULE_IDS, type ModuleId } from '../types/modules';

interface ModuleAccessContextValue {
  access: ModuleAccessMap;
  loading: boolean;
  role: string | null;
  userId: string | null;
  refresh: () => Promise<void>;
  getAccessLevel: (moduleId: ModuleId) => AccessLevel;
}

const ModuleAccessContext = createContext<ModuleAccessContextValue | undefined>(undefined);

const mapAccessLevel = (
  accessLevel?: string | null,
  hasAccess?: boolean | null
): AccessLevel => {
  if (accessLevel === 'read-write' || accessLevel === 'read-only') {
    return accessLevel;
  }

  return hasAccess ? 'read-write' : 'no-access';
};

export function ModuleAccessProvider({ children }: { children: React.ReactNode }) {
  const { user, profile, loading: authLoading } = useAuth();
  const [access, setAccess] = useState<ModuleAccessMap>(getDefaultModuleAccess());
  const [role, setRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const applyAdminAccess = () => {
    setAccess(getAdminAccess());
  };

  const refresh = useCallback(async () => {
    console.log('ModuleAccessContext refresh called with profile:', profile?.id);

    if (!user || !profile) {
      console.log('No user or profile found, setting defaults');
      setAccess(getDefaultModuleAccess());
      setRole(null);
      setUserId(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    console.log('Using profile from AuthContext:', { id: profile.id, role: profile.role });
    setRole(profile.role);
    setUserId(profile.id);

    if (profile.role === 'admin') {
      console.log('User is admin, applying admin access');
      applyAdminAccess();
      setLoading(false);
      return;
    }

    console.log('Fetching module access for user:', profile.id);
    const { data, error: accessError } = await supabase
      .from('user_module_access')
      .select('module_name, access_level, has_access')
      .eq('user_id', profile.id);

    console.log('Module access query result:', { data, error: accessError });
    let rows = data;
    if (accessError) {
      const needsFallback =
        accessError.code === 'PGRST204' ||
        accessError.message?.toLowerCase().includes('access_level');

      if (!needsFallback) {
        setAccess(getDefaultModuleAccess());
        setLoading(false);
        return;
      }

      const { data: fallbackData, error: fallbackError } = await supabase
        .from('user_module_access')
        .select('module_name, has_access')
        .eq('user_id', profile.id);

      if (fallbackError) {
        setAccess(getDefaultModuleAccess());
        setLoading(false);
        return;
      }

      rows = (fallbackData ?? []).map((entry) => ({
        ...entry,
        access_level: null,
      }));
    }

    const map = getDefaultModuleAccess();
    (rows ?? []).forEach((entry) => {
      const moduleId = entry.module_name as ModuleId;
      if (!MODULE_IDS.includes(moduleId)) return;
      map[moduleId] = mapAccessLevel(
        'access_level' in entry ? (entry as { access_level?: string | null }).access_level : undefined,
        entry.has_access
      );
    });

    setAccess(map);
    setLoading(false);
  }, [user, profile]);

  useEffect(() => {
    if (!authLoading && profile) {
      console.log('Auth loading complete and profile available, refreshing module access. Profile:', profile);
      void refresh();
    } else if (!authLoading && !profile) {
      console.log('Auth loading complete but no profile, setting defaults');
      setAccess(getDefaultModuleAccess());
      setRole(null);
      setUserId(null);
      setLoading(false);
    }
  }, [refresh, authLoading, profile]);

  const getAccessLevel = useCallback(
    (moduleId: ModuleId): AccessLevel => access[moduleId] ?? 'no-access',
    [access]
  );

  const value = useMemo(
    () => ({
      access,
      loading,
      role,
      userId,
      refresh,
      getAccessLevel,
    }),
    [access, loading, role, userId, refresh, getAccessLevel]
  );

  return (
    <ModuleAccessContext.Provider value={value}>
      {children}
    </ModuleAccessContext.Provider>
  );
}

export function useModuleAccess() {
  const context = useContext(ModuleAccessContext);
  if (!context) {
    throw new Error('useModuleAccess must be used within ModuleAccessProvider');
  }
  return context;
}

