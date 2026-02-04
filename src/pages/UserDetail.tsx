import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Save, X, Mail, Building, Calendar, BadgeCheck, MapPin, CreditCard, Shield } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { MODULE_DEFINITIONS } from '../types/modules';
import { ModernCard } from '../components/ui/ModernCard';
import { ModernButton } from '../components/ui/ModernButton';

interface UserDetailProps {
  userId?: string;
  onBack?: () => void;
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
  avatar_url?: string | null;
}

export function UserDetail({ userId: userIdProp, onBack: onBackProp }: UserDetailProps) {
  const params = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const userId = userIdProp || params.userId || '';
  const onBack = onBackProp || (() => navigate('/users'));
  const [user, setUser] = useState<UserData | null>(null);
  const [editableUser, setEditableUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

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
        ? 'id, full_name, email, role, is_active, department, created_at, partner_code, aadhar_number, pan_number, employee_code, date_of_birth, address, avatar_url'
        : 'id, full_name, email, is_active, department, created_at, employee_code, date_of_birth, avatar_url';

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

  const renderField = (icon: React.ReactNode, label: string, value?: string, isStatus?: boolean) => (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between py-4 border-b border-gray-100 last:border-0 gap-2">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
        <span className="text-gray-400">{icon}</span>
        {label}
      </div>
      <span className="text-sm text-gray-900 font-medium pl-6 sm:pl-0">
        {isStatus ? (
          <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${
            value === 'Active'
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-amber-100 text-amber-700'
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
      <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
        <ModernButton
          onClick={onBack}
          variant="ghost"
          size="sm"
          icon={<ArrowLeft className="w-4 h-4" />}
        >
          Back to Users
        </ModernButton>
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
        <ModernButton
          onClick={onBack}
          variant="ghost"
          size="sm"
          icon={<ArrowLeft className="w-4 h-4" />}
        >
          Back to Users
        </ModernButton>
        <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-12 rounded-2xl text-center">
          <p className="font-medium">{error || 'User not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <ModernButton
          onClick={onBack}
          variant="ghost"
          size="sm"
          icon={<ArrowLeft className="w-4 h-4" />}
        >
          Back to Users
        </ModernButton>

        {isAdmin && (
          <div className="flex gap-2">
            {editableUser && (
              <>
                <ModernButton
                  onClick={() => {
                    setEditableUser(user);
                    setSaveError(null);
                    setSaveSuccess(null);
                  }}
                  variant="secondary"
                  size="sm"
                  icon={<X className="w-4 h-4" />}
                >
                  Reset
                </ModernButton>
                <ModernButton
                  onClick={async () => {
                    if (!editableUser) return;
                    setSaving(true);
                    setSaveError(null);
                    setSaveSuccess(null);
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
                          setSaving(false);
                          return;
                        }
                      } else if (previousRole === 'admin' && nextRole !== 'admin') {
                        const { error: accessError } = await supabase
                          .from('user_module_access')
                          .delete()
                          .eq('user_id', editableUser.id);
                        if (accessError) {
                          setSaveError(accessError.message);
                          setSaving(false);
                          return;
                        }
                      }
                    }

                    setUser(editableUser);
                    setSaving(false);
                    setSaveSuccess('User profile updated successfully!');
                    // Auto-hide success message after 5 seconds
                    setTimeout(() => {
                      setSaveSuccess(null);
                    }, 5000);
                  }}
                  variant="primary"
                  size="sm"
                  loading={saving}
                  icon={<Save className="w-4 h-4" />}
                >
                  Save Changes
                </ModernButton>
              </>
            )}
          </div>
        )}
      </div>

      {saveError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm shadow-sm flex items-center gap-2">
          <BadgeCheck className="w-4 h-4" />
          {saveError}
        </div>
      )}

      {saveSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl text-sm shadow-sm flex items-center gap-2">
          <BadgeCheck className="w-4 h-4" />
          {saveSuccess}
        </div>
      )}

      <ModernCard>
        <div className="flex flex-col items-center text-center mb-8 pb-8 border-b border-gray-100">
          <div className="w-32 h-32 rounded-full border-4 border-white bg-gray-50 flex items-center justify-center mb-4 overflow-hidden shadow-premium-md">
            {user.avatar_url ? (
              <img 
                src={user.avatar_url} 
                alt={user.full_name} 
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="w-16 h-16 text-gray-300" />
            )}
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {editableUser?.full_name || user.full_name}
          </h1>

          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${
              (editableUser?.is_active ?? user.is_active)
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-amber-100 text-amber-700'
            }`}>
              {displayStatus(editableUser?.is_active ?? user.is_active)}
            </span>
            <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-blue-100 text-blue-700 capitalize">
              {user.role}
            </span>
          </div>
        </div>

        <div className="max-w-3xl mx-auto">
          <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            User Information
          </h2>

          <div className="space-y-1">
            {isAdmin ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                <div className="py-3">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Full Name</label>
                  <input
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm"
                    value={editableUser?.full_name || ''}
                    onChange={(e) => setEditableUser((prev) => prev ? { ...prev, full_name: e.target.value } : prev)}
                  />
                </div>
                <div className="py-3">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Email Address</label>
                  <input
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-500 text-sm cursor-not-allowed"
                    value={editableUser?.email || ''}
                    disabled
                  />
                </div>
                <div className="py-3">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Lead / Department</label>
                  <input
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm"
                    value={editableUser?.department || ''}
                    onChange={(e) => setEditableUser((prev) => prev ? { ...prev, department: e.target.value } : prev)}
                  />
                </div>
                <div className="py-3">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Date of Birth</label>
                  <input
                    type="date"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm"
                    value={editableUser?.date_of_birth || ''}
                    onChange={(e) => setEditableUser((prev) => prev ? { ...prev, date_of_birth: e.target.value } : prev)}
                  />
                </div>
                <div className="py-3">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Role</label>
                  <select
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm bg-white"
                    value={editableUser?.role || 'user'}
                    onChange={(e) => setEditableUser((prev) => prev ? { ...prev, role: e.target.value } : prev)}
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="py-3">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Status</label>
                  <select
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm bg-white"
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
                <div className="py-3">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Employee Code</label>
                  <input
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-500 text-sm cursor-not-allowed"
                    value={editableUser?.employee_code || ''}
                    disabled
                  />
                </div>
                <div className="py-3">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Aadhar Number</label>
                  <input
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm"
                    value={editableUser?.aadhar_number || ''}
                    onChange={(e) => setEditableUser((prev) => prev ? { ...prev, aadhar_number: e.target.value } : prev)}
                  />
                </div>
                <div className="py-3">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">PAN Number</label>
                  <input
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm"
                    value={editableUser?.pan_number || ''}
                    onChange={(e) => setEditableUser((prev) => prev ? { ...prev, pan_number: e.target.value } : prev)}
                  />
                </div>
                <div className="py-3 md:col-span-2">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Address</label>
                  <textarea
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm min-h-[80px] resize-none"
                    rows={3}
                    value={editableUser?.address || ''}
                    onChange={(e) => setEditableUser((prev) => prev ? { ...prev, address: e.target.value } : prev)}
                  />
                </div>
                <div className="py-3 md:col-span-2 border-t border-gray-100 mt-2 pt-4">
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <Calendar className="w-3.5 h-3.5" />
                    Joined on {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'}
                  </div>
                </div>
              </div>
            ) : (
              <>
                {renderField(<User className="w-4 h-4" />, 'Full Name', user.full_name)}
                {renderField(<Mail className="w-4 h-4" />, 'Email Address', user.email)}
                {renderField(<BadgeCheck className="w-4 h-4" />, 'Employee Code', user.employee_code || undefined)}
                {renderField(<Building className="w-4 h-4" />, 'Lead / Department', user.department || undefined)}
                {renderField(<Calendar className="w-4 h-4" />, 'Date of Birth', user.date_of_birth || undefined)}
                {renderField(<Shield className="w-4 h-4" />, 'Status', displayStatus(user.is_active), true)}
                {renderField(<Calendar className="w-4 h-4" />, 'Joined', user.created_at ? new Date(user.created_at).toLocaleDateString() : undefined)}
              </>
            )}
          </div>
        </div>
      </ModernCard>
    </div>
  );
}
