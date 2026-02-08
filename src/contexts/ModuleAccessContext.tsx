import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import {
  getAdminAccess,
  getDefaultModuleAccess,
  OPERATIONS_SUB_MODULE_IDS,
  type AccessLevel,
  type ModuleAccessMap,
  type OperationsSubModuleAccess,
} from '../types/access';
import { MODULE_IDS, type ModuleId } from '../types/modules';

interface ModuleAccessContextValue {
  access: ModuleAccessMap;
  operationsSub: OperationsSubModuleAccess;
  loading: boolean;
  role: string | null;
  userId: string | null;
  refresh: () => Promise<void>;
  getAccessLevel: (moduleId: ModuleId) => AccessLevel;
  getOperationsSubModuleAccess: () => OperationsSubModuleAccess;
  hasAnyOperationsAccess: () => boolean;
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

const defaultOperationsSub: OperationsSubModuleAccess = {
  rawMaterial: 'no-access',
  recurringProduct: 'no-access',
  production: 'no-access',
};

export function ModuleAccessProvider({ children }: { children: React.ReactNode }) {
  const { user, profile, loading: authLoading } = useAuth();
  const [access, setAccess] = useState<ModuleAccessMap>(getDefaultModuleAccess());
  const [operationsSub, setOperationsSub] = useState<OperationsSubModuleAccess>(defaultOperationsSub);
  const [role, setRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const applyAdminAccess = () => {
    setAccess(getAdminAccess());
    setOperationsSub({ rawMaterial: 'read-write', recurringProduct: 'read-write', production: 'read-write' });
  };

  const refresh = useCallback(async () => {
    console.log('ModuleAccessContext refresh called with profile:', profile?.id);

    if (!user || !profile) {
      console.log('No user or profile found, setting defaults');
      setAccess(getDefaultModuleAccess());
      setOperationsSub(defaultOperationsSub);
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
        setOperationsSub(defaultOperationsSub);
        setLoading(false);
        return;
      }

      const { data: fallbackData, error: fallbackError } = await supabase
        .from('user_module_access')
        .select('module_name, has_access')
        .eq('user_id', profile.id);

      if (fallbackError) {
        setAccess(getDefaultModuleAccess());
        setOperationsSub(defaultOperationsSub);
        setLoading(false);
        return;
      }

      rows = (fallbackData ?? []).map((entry) => ({
        ...entry,
        access_level: null,
      }));
    }

    const map = getDefaultModuleAccess();
    const sub: OperationsSubModuleAccess = { ...defaultOperationsSub };
    const legacyOperations = mapAccessLevel(
      (rows ?? []).find((e) => e.module_name === 'operations')?.access_level as string | undefined,
      (rows ?? []).find((e) => e.module_name === 'operations')?.has_access
    );

    (rows ?? []).forEach((entry) => {
      const name = entry.module_name as string;
      const level = mapAccessLevel(
        'access_level' in entry ? (entry as { access_level?: string | null }).access_level : undefined,
        entry.has_access
      );
      if (MODULE_IDS.includes(name as ModuleId)) {
        map[name as ModuleId] = level;
      }
      if (name === 'operations-raw-materials') sub.rawMaterial = level;
      else if (name === 'operations-recurring-products') sub.recurringProduct = level;
      else if (name === 'operations-production-batches') sub.production = level;
    });

    // Backward compat: if only legacy 'operations' row exists, apply to all three sub-modules
    const hasSubRows = (rows ?? []).some((e) => OPERATIONS_SUB_MODULE_IDS.includes(e.module_name as typeof OPERATIONS_SUB_MODULE_IDS[number]));
    if (!hasSubRows && (rows ?? []).some((e) => e.module_name === 'operations')) {
      sub.rawMaterial = legacyOperations;
      sub.recurringProduct = legacyOperations;
      sub.production = legacyOperations;
    }

    setAccess(map);
    setOperationsSub(sub);
    setLoading(false);
  }, [user, profile]);

  useEffect(() => {
    if (!authLoading && profile) {
      console.log('Auth loading complete and profile available, refreshing module access. Profile:', profile);
      void refresh();
    } else if (!authLoading && !profile) {
      console.log('Auth loading complete but no profile, setting defaults');
      setAccess(getDefaultModuleAccess());
      setOperationsSub(defaultOperationsSub);
      setRole(null);
      setUserId(null);
      setLoading(false);
    }
  }, [refresh, authLoading, profile]);

  const getAccessLevel = useCallback(
    (moduleId: ModuleId): AccessLevel => access[moduleId] ?? 'no-access',
    [access]
  );

  const getOperationsSubModuleAccess = useCallback(() => operationsSub, [operationsSub]);
  const hasAnyOperationsAccess = useCallback(
    () =>
      operationsSub.rawMaterial !== 'no-access' ||
      operationsSub.recurringProduct !== 'no-access' ||
      operationsSub.production !== 'no-access',
    [operationsSub]
  );

  const value = useMemo(
    () => ({
      access,
      operationsSub,
      loading,
      role,
      userId,
      refresh,
      getAccessLevel,
      getOperationsSubModuleAccess,
      hasAnyOperationsAccess,
    }),
    [access, operationsSub, loading, role, userId, refresh, getAccessLevel, getOperationsSubModuleAccess, hasAnyOperationsAccess]
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

