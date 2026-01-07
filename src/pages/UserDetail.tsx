import { useEffect, useState } from 'react';
import { ArrowLeft, User, Save, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { MODULE_DEFINITIONS } from '../types/modules';

interface UserDetailProps {
  userId: string;
  onBack: () => void;
}

interface UserData {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  department?: string | null;
  created_at?: string;
  partner_code?: string | null;
  aadhar_number?: string | null;
  pan_number?: string | null;
  employee_code?: string | null;
  date_of_birth?: string | null;
  address?: string | null;
}

export function UserDetail({ userId, onBack }: UserDetailProps) {
  const [user, setUser] = useState<UserData | null>(null);
  const [editableUser, setEditableUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRoleAndUser = async () => {
      setLoading(true);
      setError(null);
      // determine current user role
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        setError(authError?.message || 'Not authenticated');
        setLoading(false);
        return;
      }
      const authId = authData.user.id;
      const { data: me, error: meError } = await supabase
        .from('users')
        .select('role')
        .eq('auth_user_id', authId)
        .single();
      if (meError) {
        setError(meError.message);
        setLoading(false);
        return;
      }
      const admin = me?.role === 'admin';
      setIsAdmin(admin);

      const baseSelect = admin
        ? 'id, full_name, email, role, is_active, department, created_at, partner_code, aadhar_number, pan_number, employee_code, date_of_birth, address'
        : 'id, full_name, email, is_active, department, created_at, employee_code, date_of_birth';

      const { data, error } = await supabase
        .from('users')
        .select(baseSelect)
        .eq('id', userId)
        .single();
      if (error) {
        setError(error.message);
        setUser(null);
      } else {
        setUser(data as unknown as UserData);
        setEditableUser(data as unknown as UserData);
      }
      setLoading(false);
    };
    void fetchRoleAndUser();
  }, [userId]);

  const displayStatus = (isActive?: boolean) => (isActive ? 'Active' : 'Inactive');

  const renderField = (label: string, value?: string, isStatus?: boolean) => (
    <div className="flex justify-between items-center py-4 border-b border-gray-200">
      <span className="text-sm font-medium text-gray-500">{label}</span>
      <span className="text-sm text-gray-900">
        {isStatus ? (
          <span className={`px-3 py-1 text-xs font-medium rounded-full ${
            value === 'Active'
              ? 'bg-green-100 text-green-800'
              : 'bg-yellow-100 text-yellow-800'
          }`}>
            {value}
          </span>
        ) : (
          value || '—'
        )}
      </span>
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Users</span>
        </button>
        <div className="text-center py-12 text-gray-600">Loading...</div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="space-y-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Users</span>
        </button>
        <div className="text-center py-12">
          <p className="text-gray-600">{error || 'User not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Users</span>
        </button>

        {isAdmin && (
          <div className="flex gap-2">
            {editableUser && (
              <>
                <button
                  onClick={() => setEditableUser(user)}
                  className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <X className="w-4 h-4" />
                  Reset
                </button>
                <button
                  onClick={async () => {
                    if (!editableUser) return;
                    setSaving(true);
                    setSaveError(null);
                    const previousRole = user?.role;
                    const nextRole = editableUser.role;

                    const { error: updateError } = await supabase
                      .from('users')
                      .update({
                        full_name: editableUser.full_name,
                        department: editableUser.department ?? null,
                        role: editableUser.role,
                        is_active: editableUser.is_active,
                        partner_code: editableUser.partner_code ?? null,
                        aadhar_number: editableUser.aadhar_number ?? null,
                        pan_number: editableUser.pan_number ?? null,
                        date_of_birth: editableUser.date_of_birth ?? null,
                        address: editableUser.address ?? null,
                      })
                      .eq('id', editableUser.id);
                    if (updateError) {
                      setError(updateError.message);
                      setSaving(false);
                      return;
                    }

                    if (previousRole && previousRole !== nextRole) {
                      if (nextRole === 'admin') {
                        const upserts = MODULE_DEFINITIONS.map((module) => ({
                          user_id: editableUser.id,
                          module_name: module.id,
                          access_level: 'read-write',
                          has_access: true,
                        }));
                        const { error: accessError } = await supabase
                          .from('user_module_access')
                          .upsert(upserts, { onConflict: 'user_id,module_name' });
                        if (accessError) {
                          setSaveError(accessError.message);
                        }
                      } else if (previousRole === 'admin' && nextRole !== 'admin') {
                        const { error: accessError } = await supabase
                          .from('user_module_access')
                          .delete()
                          .eq('user_id', editableUser.id);
                        if (accessError) {
                          setSaveError(accessError.message);
                        }
                      }
                    }

                    setUser(editableUser);
                    setSaving(false);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-60"
                  disabled={saving}
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {saveError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {saveError}
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 p-8">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-32 h-32 rounded-full border-2 border-gray-300 bg-gray-50 flex items-center justify-center mb-4">
            <User className="w-16 h-16 text-gray-400" />
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {editableUser?.full_name || user.full_name}
          </h1>

          <span className={`px-3 py-1 text-sm font-medium rounded-full ${
            (editableUser?.is_active ?? user.is_active)
              ? 'bg-green-100 text-green-800'
              : 'bg-yellow-100 text-yellow-800'
          }`}>
            {displayStatus(editableUser?.is_active ?? user.is_active)}
          </span>
        </div>

        <div className="max-w-2xl mx-auto">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            User Information
          </h2>

          <div className="space-y-1">
            {isAdmin ? (
              <>
                <div className="py-4 border-b border-gray-200">
                  <label className="block text-sm font-medium text-gray-500 mb-2">Full Name</label>
                  <input
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={editableUser?.full_name || ''}
                    onChange={(e) => setEditableUser((prev) => prev ? { ...prev, full_name: e.target.value } : prev)}
                  />
                </div>
                <div className="py-4 border-b border-gray-200">
                  <label className="block text-sm font-medium text-gray-500 mb-2">Email Address</label>
                  <input
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700"
                    value={editableUser?.email || ''}
                    disabled
                  />
                </div>
                <div className="py-4 border-b border-gray-200">
                  <label className="block text-sm font-medium text-gray-500 mb-2">Lead</label>
                  <input
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={editableUser?.department || ''}
                    onChange={(e) => setEditableUser((prev) => prev ? { ...prev, department: e.target.value } : prev)}
                  />
                </div>
                <div className="py-4 border-b border-gray-200">
                  <label className="block text-sm font-medium text-gray-500 mb-2">Date of Birth</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={editableUser?.date_of_birth || ''}
                    onChange={(e) => setEditableUser((prev) => prev ? { ...prev, date_of_birth: e.target.value } : prev)}
                  />
                </div>
                <div className="py-4 border-b border-gray-200">
                  <label className="block text-sm font-medium text-gray-500 mb-2">Role</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={editableUser?.role || 'user'}
                    onChange={(e) => setEditableUser((prev) => prev ? { ...prev, role: e.target.value } : prev)}
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="py-4 border-b border-gray-200 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-500">Status</span>
                  <select
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={(editableUser?.is_active ?? user.is_active) ? 'Active' : 'Inactive'}
                    onChange={(e) => {
                      const val = e.target.value === 'Active';
                      setEditableUser((prev) => prev ? { ...prev, is_active: val } : prev);
                    }}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
                <div className="py-4 border-b border-gray-200">
                  <label className="block text-sm font-medium text-gray-500 mb-2">Employee Code</label>
                  <input
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700"
                    value={editableUser?.employee_code || ''}
                    disabled
                  />
                </div>
                <div className="py-4 border-b border-gray-200">
                  <label className="block text-sm font-medium text-gray-500 mb-2">Address (admin only)</label>
                  <textarea
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                    value={editableUser?.address || ''}
                    onChange={(e) => setEditableUser((prev) => prev ? { ...prev, address: e.target.value } : prev)}
                  />
                </div>
                <div className="py-4 border-b border-gray-200">
                  <label className="block text-sm font-medium text-gray-500 mb-2">Aadhar Number</label>
                  <input
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={editableUser?.aadhar_number || ''}
                    onChange={(e) => setEditableUser((prev) => prev ? { ...prev, aadhar_number: e.target.value } : prev)}
                  />
                </div>
                <div className="py-4 border-b border-gray-200">
                  <label className="block text-sm font-medium text-gray-500 mb-2">PAN Number</label>
                  <input
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={editableUser?.pan_number || ''}
                    onChange={(e) => setEditableUser((prev) => prev ? { ...prev, pan_number: e.target.value } : prev)}
                  />
                </div>
                {renderField('Joined', user.created_at ? new Date(user.created_at).toLocaleDateString() : undefined)}
              </>
            ) : (
              <>
                {renderField('Full Name', user.full_name)}
                {renderField('Email Address', user.email)}
                {renderField('Employee Code', user.employee_code || undefined)}
                {renderField('Lead', user.department || undefined)}
                {renderField('Date of Birth', user.date_of_birth || undefined)}
                {renderField('Status', displayStatus(user.is_active), true)}
                {renderField('Joined', user.created_at ? new Date(user.created_at).toLocaleDateString() : undefined)}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
