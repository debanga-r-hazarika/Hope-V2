import { useEffect, useMemo, useState } from 'react';
import { User, UserPlus, Shield, RefreshCw, Search } from 'lucide-react';
import { CreateUserModal, type UserFormData } from '../components/CreateUserModal';
import { ModuleAccessModal } from '../components/ModuleAccessModal';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { AccessLevel, ModuleAccess } from '../types/access';
import { MODULE_DEFINITIONS, type ModuleId } from '../types/modules';

interface UsersProps {
  onViewUser: (userId: string) => void;
}

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

export function Users({ onViewUser }: UsersProps) {
  const { user: authUser, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
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
    rows: Array<{ user_id: string; module_name: ModuleId; access_level?: AccessLevel; has_access: boolean; }>
  ) => {
    const { error } = await supabase
      .from('user_module_access')
      .upsert(rows, { onConflict: 'user_id,module_name' });

    if (!error) return;

    const isMissingAccessLevel = error.code === 'PGRST204' || error.message?.toLowerCase().includes('access_level');
    if (!isMissingAccessLevel) {
      throw error;
    }

    // Fallback for schemas without access_level column: we inform the caller if RO was requested.
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

  const isAdmin = useMemo(() => {
    const current = users.find((u) => u.email === authUser?.email);
    return current?.role === 'admin';
  }, [authUser?.email, users]);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, email, role, is_active, department, employee_code, avatar_url');
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

    const mapped: ModuleAccess[] = (rows ?? []).map((row) => ({
      moduleId: row.module_name as ModuleId,
      moduleName: MODULE_DEFINITIONS.find((m) => m.id === row.module_name)?.name
        ?? row.module_name.charAt(0).toUpperCase() + row.module_name.slice(1),
      accessLevel: mapAccessLevel(
        'access_level' in row ? (row as { access_level?: string | null }).access_level : undefined,
        row.has_access
      ),
    }));
    setSelectedAccess(mapped);
    setAccessLoading(false);
  };

  useEffect(() => {
    if (!authLoading) {
      void fetchUsers();
    }
  }, [authLoading]);

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users;
    const term = search.toLowerCase();
    return users.filter((u) => {
      const dob = (u as { date_of_birth?: string }).date_of_birth ?? '';
      return (
        u.full_name?.toLowerCase().includes(term) ||
        u.email?.toLowerCase().includes(term) ||
        (u.employee_code ?? '').toLowerCase().includes(term) ||
        (u.department ?? '').toLowerCase().includes(term) ||
        dob.toLowerCase().includes(term)
      );
    });
  }, [users, search]);

  const handleCreateUser = async (userData: UserFormData) => {
    if (!authUser) throw new Error('Not authenticated');
    // Capture current admin session
    const currentSession = await supabase.auth.getSession();
    const adminSession = currentSession.data.session;
    if (!adminSession) {
      throw new Error('No admin session available');
    }

    // Create auth user (signup)
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: userData.email,
      password: userData.password,
      options: { emailRedirectTo: window.location.origin },
    });
    if (signUpError) {
      throw new Error(signUpError.message);
    }
    const newAuthId = signUpData.user?.id;
    if (!newAuthId) {
      throw new Error('Failed to create auth user');
    }

    // Restore admin session
    await supabase.auth.setSession({
      access_token: adminSession.access_token,
      refresh_token: adminSession.refresh_token,
    });

    // Insert app profile, default role=user, active
    const { error: profileError } = await supabase.from('users').insert({
      auth_user_id: newAuthId,
      full_name: userData.fullName,
      email: userData.email,
      role: 'user',
      department: userData.department || null,
      is_active: true,
      partner_code: null,
      aadhar_number: null,
      pan_number: null,
      date_of_birth: userData.dateOfBirth || null,
      address: userData.address || null,
      requires_password_change: true,
    });
    if (profileError) {
      throw new Error(profileError.message);
    }

    // Module access: admin gets RW on all modules; user none by default
    // No module access granted by default; admin can assign later

    await fetchUsers();
  };

  const handleManageAccess = async (user: UserRow) => {
    setSelectedUser(user);
    setIsAccessModalOpen(true);
    await fetchAccess(user);
  };

  const handleSaveAccess = async (access: ModuleAccess[]) => {
    if (!selectedUser) return;
    setAccessLoading(true);
    try {
      const normalizedAccess = selectedUser.role === 'admin'
        ? MODULE_DEFINITIONS.map((module) => ({
            moduleId: module.id,
            moduleName: module.name,
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

      const modulesToDelete = normalizedAccess
        .filter((entry) => entry.accessLevel === 'no-access')
        .map((entry) => entry.moduleId);

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
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save module access';
      setError(message);
    } finally {
      setAccessLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Users</h1>
          <p className="mt-1 text-gray-600 text-sm md:text-base">
            Manage team members and their module access
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:flex-wrap">
          <div className="relative w-full sm:w-64">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, code, lead"
              className="w-full pl-10 pr-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => void fetchUsers()}
              className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            {isAdmin && (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                <UserPlus className="w-5 h-5" />
                Create New User
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full text-center text-gray-500">Loading users...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="col-span-full text-center text-gray-500">No users found.</div>
        ) : (
          filteredUsers.map((user) => (
            <div
              key={user.id}
              className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-24 h-24 rounded-full border-2 border-blue-100 bg-gradient-to-br from-blue-50 to-white flex items-center justify-center mb-4 overflow-hidden shadow-inner">
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt={user.full_name} className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-12 h-12 text-blue-400" />
                  )}
                </div>

                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  {user.full_name}
                </h3>

                <p className="text-sm text-gray-600 mb-4">
                  {user.email}
                </p>

                <div className="w-full space-y-3 mb-4">
                  <div className="flex justify-between items-center py-2 border-t border-gray-100">
                    <span className="text-sm text-gray-500">Employee Code</span>
                    <span className="text-sm font-medium text-gray-900">
                      {user.employee_code || '—'}
                    </span>
                  </div>
                  {user.department && (
                    <div className="flex justify-between items-center py-2 border-t border-gray-100">
                      <span className="text-sm text-gray-500">Lead</span>
                      <span className="text-sm font-medium text-gray-900">
                        {user.department}
                      </span>
                    </div>
                  )}
                  {isAdmin && (
                    <div className="flex justify-between items-center py-2 border-t border-gray-100">
                      <span className="text-sm text-gray-500">Role</span>
                      <span className="text-sm font-medium text-gray-900 capitalize">{user.role}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center py-2 border-t border-gray-100">
                    <span className="text-sm text-gray-500">Status</span>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      user.is_active ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>

                <div className="w-full space-y-2">
                  {isAdmin && (
                    <button
                      onClick={() => void handleManageAccess(user)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Shield className="w-4 h-4" />
                      Module Access
                    </button>
                  )}
                  <button
                    onClick={() => onViewUser(user.id)}
                    className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    {isAdmin ? 'View & Edit Details' : 'View Details'}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <CreateUserModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreateUser}
      />

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
