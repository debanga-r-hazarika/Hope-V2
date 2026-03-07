import { useEffect, useMemo, useState } from 'react';
import { Shield, Search, RefreshCw, Users, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { ModuleAccessModal } from '../components/ModuleAccessModal';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { AccessLevel, ModuleAccess, OperationsSubModuleId } from '../types/access';
import { OPERATIONS_SUB_MODULE_DEFINITIONS, OPERATIONS_SUB_MODULE_IDS } from '../types/access';
import { MODULE_DEFINITIONS, type ModuleId } from '../types/modules';
import { ModernButton } from '../components/ui/ModernButton';
import { ModernCard } from '../components/ui/ModernCard';

interface UserRow {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  department?: string | null;
  employee_code?: string | null;
  avatar_url?: string | null;
}

export function ModuleAccessManagement() {
  const { profile, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isAccessModalOpen, setIsAccessModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [accessLoading, setAccessLoading] = useState(false);
  const [selectedAccess, setSelectedAccess] = useState<ModuleAccess[]>([]);
  const [search, setSearch] = useState('');

  const mapAccessLevel = (level?: string | null, hasAccess?: boolean | null): AccessLevel => {
    if (level === 'read-write' || level === 'read-only') return level;
    return hasAccess ? 'read-write' : 'no-access';
  };

  const upsertModuleAccess = async (
    rows: Array<{ user_id: string; module_name: ModuleId | OperationsSubModuleId; access_level?: AccessLevel; has_access: boolean; }>
  ) => {
    const { error } = await supabase
      .from('user_module_access')
      .upsert(rows, { onConflict: 'user_id,module_name' });

    if (!error) return;

    const isMissingAccessLevel = error.code === 'PGRST204' || error.message?.toLowerCase().includes('access_level');
    if (!isMissingAccessLevel) {
      throw error;
    }

    const hasReadOnlyRequest = rows.some((r) => r.access_level === 'read-only');
    const stripped = rows.map(({ access_level: _level, ...rest }) => rest);
    const { error: fallbackError } = await supabase
      .from('user_module_access')
      .upsert(stripped, { onConflict: 'user_id,module_name' });
    if (fallbackError) throw fallbackError;
    if (hasReadOnlyRequest) {
      throw new Error(
        'Your database is missing the access_level column on user_module_access. Add it to support Read Only access.'
      );
    }
  };

  const isAdmin = profile?.role === 'admin';

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, email, role, is_active, department, employee_code, avatar_url')
      .order('full_name');
    if (error) {
      setError(error.message);
    } else {
      setUsers(data ?? []);
    }
    setLoading(false);
  };

  const fetchAccess = async (userData: UserRow) => {
    setAccessLoading(true);
    if (userData.role === 'admin') {
      setSelectedAccess(
        MODULE_DEFINITIONS.map((module) => ({
          moduleId: module.id,
          moduleName: module.name,
          accessLevel: 'read-write',
        }))
      );
      setAccessLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('user_module_access')
      .select('module_name, access_level, has_access')
      .eq('user_id', userData.id);

    let rows = data;
    if (error) {
      const needsFallback =
        error.code === 'PGRST204' ||
        error.message?.toLowerCase().includes('access_level');

      if (!needsFallback) {
        setAccessLoading(false);
        throw error;
      }

      const { data: fallbackData, error: fallbackError } = await supabase
        .from('user_module_access')
        .select('module_name, has_access')
        .eq('user_id', userData.id);

      if (fallbackError) {
        setAccessLoading(false);
        throw fallbackError;
      }

      rows = (fallbackData ?? []).map((row) => ({
        ...row,
        access_level: null,
      }));
    }

    const getDisplayName = (moduleName: string): string =>
      MODULE_DEFINITIONS.find((m) => m.id === moduleName)?.name
      ?? OPERATIONS_SUB_MODULE_DEFINITIONS.find((s) => s.id === moduleName)?.name
      ?? moduleName.charAt(0).toUpperCase() + moduleName.slice(1);

    const mapped: ModuleAccess[] = (rows ?? []).map((row) => ({
      moduleId: row.module_name as ModuleId | OperationsSubModuleId,
      moduleName: getDisplayName(row.module_name),
      accessLevel: mapAccessLevel(
        'access_level' in row ? (row as { access_level?: string | null }).access_level : undefined,
        row.has_access
      ),
    }));

    const displayModules: Array<{ id: string; name: string }> = MODULE_DEFINITIONS.flatMap((m) =>
      m.id === 'operations' ? (OPERATIONS_SUB_MODULE_DEFINITIONS as Array<{ id: string; name: string }>) : [{ id: m.id, name: m.name }]
    );
    const legacyOps = mapped.find((a) => a.moduleId === 'operations')?.accessLevel;
    const selected: ModuleAccess[] = displayModules.map((item) => ({
      moduleId: item.id as ModuleId | OperationsSubModuleId,
      moduleName: item.name,
      accessLevel:
        mapped.find((a) => a.moduleId === item.id)?.accessLevel
        ?? (legacyOps && OPERATIONS_SUB_MODULE_IDS.includes(item.id as OperationsSubModuleId) ? legacyOps : 'no-access'),
    }));
    setSelectedAccess(selected);
    setAccessLoading(false);
  };

  useEffect(() => {
    if (!authLoading && isAdmin) {
      void fetchUsers();
    }
  }, [authLoading, isAdmin]);

  const filteredUsers = useMemo(() => {
    // Filter out admin users - they automatically have R/W access to all modules
    const nonAdminUsers = users.filter(u => u.role !== 'admin');
    if (!search.trim()) return nonAdminUsers;
    const term = search.toLowerCase();
    return nonAdminUsers.filter((u) =>
      u.full_name?.toLowerCase().includes(term) ||
      u.email?.toLowerCase().includes(term) ||
      (u.employee_code ?? '').toLowerCase().includes(term) ||
      (u.department ?? '').toLowerCase().includes(term) ||
      u.role?.toLowerCase().includes(term)
    );
  }, [users, search]);

  const handleManageAccess = async (user: UserRow) => {
    setSelectedUser(user);
    setIsAccessModalOpen(true);
    await fetchAccess(user);
  };

  const handleSaveAccess = async (access: ModuleAccess[]) => {
    if (!selectedUser) return;
    setAccessLoading(true);
    try {
      const displayModulesForSave: Array<{ id: string; name: string }> = MODULE_DEFINITIONS.flatMap((m) =>
        m.id === 'operations' ? (OPERATIONS_SUB_MODULE_DEFINITIONS as Array<{ id: string; name: string }>) : [{ id: m.id, name: m.name }]
      );

      const normalizedAccess = selectedUser.role === 'admin'
        ? displayModulesForSave.map((item) => ({
            moduleId: item.id as ModuleId | OperationsSubModuleId,
            moduleName: item.name,
            accessLevel: 'read-write' as AccessLevel,
          }))
        : access;

      const upserts = normalizedAccess
        .filter((entry) => entry.accessLevel !== 'no-access')
        .map((entry) => ({
          user_id: selectedUser.id,
          module_name: entry.moduleId,
          access_level: entry.accessLevel,
          has_access: entry.accessLevel !== 'no-access',
        }));

      let modulesToDelete = normalizedAccess
        .filter((entry) => entry.accessLevel === 'no-access')
        .map((entry) => entry.moduleId);
      if (normalizedAccess.some((e) => OPERATIONS_SUB_MODULE_IDS.includes(e.moduleId as OperationsSubModuleId))) {
        modulesToDelete = [...modulesToDelete, 'operations'];
      }

      if (upserts.length) {
        await upsertModuleAccess(upserts);
      }

      if (modulesToDelete.length) {
        const { error } = await supabase
          .from('user_module_access')
          .delete()
          .eq('user_id', selectedUser.id)
          .in('module_name', modulesToDelete);
        if (error) {
          throw error;
        }
      }

      await fetchUsers();
      setSuccess(`Module access updated successfully for ${selectedUser.full_name}`);
      setError(null);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save module access';
      setError(message);
    } finally {
      setAccessLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <ModernCard className="max-w-md text-center" padding="xl">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">
            You need administrator privileges to access this page.
          </p>
        </ModernCard>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-8 rounded-2xl shadow-premium border border-blue-100">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-lg">
              <Shield className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Module Access Management</h1>
              <p className="text-gray-600 text-base">
                Control user permissions and module visibility across the platform
              </p>
            </div>
          </div>
          <ModernButton
            onClick={() => void fetchUsers()}
            variant="outline"
            size="md"
            icon={<RefreshCw className="w-4 h-4" />}
          >
            Refresh
          </ModernButton>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-blue-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Manageable Users</p>
                <p className="text-2xl font-bold text-gray-900">{users.filter(u => u.role !== 'admin').length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-green-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 text-green-600 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Active Users</p>
                <p className="text-2xl font-bold text-gray-900">{users.filter(u => u.is_active && u.role !== 'admin').length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-purple-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Available Modules</p>
                <p className="text-2xl font-bold text-gray-900">{MODULE_DEFINITIONS.length}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {(error || success) && (
        <div className={`${
          error ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'
        } border px-4 py-3 rounded-xl text-sm shadow-sm flex items-center gap-2`}>
          {error ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          {error || success}
        </div>
      )}

      <ModernCard padding="none">
        <div className="p-6 border-b border-gray-100">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">User Access Control</h2>
              <p className="text-sm text-gray-500 mt-1">
                Manage module permissions for non-admin users (admins have automatic R/W access to all modules)
              </p>
            </div>
            <div className="relative w-full md:w-80">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, email, role..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
              />
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-16 text-center">
              <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-primary mb-3"></div>
              <p className="text-gray-500">Loading users...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-16 text-center">
              <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg font-medium">No users found</p>
              <p className="text-gray-400 text-sm mt-1">Try adjusting your search criteria</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50/50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Department
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full border-2 border-gray-100 bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                          {user.avatar_url ? (
                            <img src={user.avatar_url} alt={user.full_name} className="w-full h-full object-cover" />
                          ) : (
                            <Users className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{user.full_name}</p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                        user.role === 'admin'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {user.role === 'admin' && <Shield className="w-3 h-3 mr-1" />}
                        {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600">
                        {user.department || '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                        user.is_active
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {user.is_active ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Active
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3 mr-1" />
                            Inactive
                          </>
                        )}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <ModernButton
                          onClick={() => void handleManageAccess(user)}
                          variant="primary"
                          size="sm"
                          icon={<Shield className="w-3.5 h-3.5" />}
                        >
                          Manage Access
                        </ModernButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </ModernCard>

      <ModernCard className="bg-blue-50/50 border-blue-100">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-blue-900 mb-1">Access Control Guidelines</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• <strong>Read & Write:</strong> Full access to create, edit, and delete within the module</li>
              <li>• <strong>Read Only:</strong> Can view data but cannot make changes</li>
              <li>• <strong>No Access:</strong> Module is completely hidden from the user's navigation</li>
              <li>• <strong>Admin Role:</strong> Automatically has Read & Write access to ALL modules (cannot be changed)</li>
              <li>• <strong>Note:</strong> Admin users are not shown in this list as their permissions are automatic</li>
              <li>• <strong>Documents Module:</strong> Uses two-level access (module + folder). See documentation for details.</li>
            </ul>
          </div>
        </div>
      </ModernCard>

      {selectedUser && (
        <ModuleAccessModal
          isOpen={isAccessModalOpen}
          onClose={() => {
            setIsAccessModalOpen(false);
            setSelectedUser(null);
          }}
          userName={selectedUser.full_name}
          initialAccess={selectedAccess}
          onSave={handleSaveAccess}
          isSaving={accessLoading}
        />
      )}
    </div>
  );
}
