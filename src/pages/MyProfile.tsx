import { useEffect, useState } from 'react';
import { User, Camera, Lock, Mail, CreditCard, Building, Calendar, MapPin, BadgeCheck, FileText, Shield } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ModernCard } from '../components/ui/ModernCard';
import { ModernButton } from '../components/ui/ModernButton';

interface ProfileData {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  department?: string | null;
  employee_code?: string | null;
  avatar_url?: string | null;
  date_of_birth?: string | null;
  address?: string | null;
  aadhar_number?: string | null;
  pan_number?: string | null;
  created_at?: string | null;
}

export function MyProfile() {
  const { user: authUser } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!authUser) return;
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email, role, is_active, department, employee_code, avatar_url, date_of_birth, address, aadhar_number, pan_number, created_at')
        .eq('auth_user_id', authUser.id)
        .single();
      if (error) {
        setError(error.message);
        setProfile(null);
      } else {
        setProfile(data as ProfileData);
      }
      setLoading(false);
    };
    void fetchProfile();
  }, [authUser]);

  const currentAvatar = avatarPreview || profile?.avatar_url || null;

  const handleSaveAvatar = async () => {
    if (!profile) return;
    if (!avatarFile) {
      setError('Please choose an image to upload.');
      return;
    }
    const file = avatarFile;
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `avatars/${profile.id}-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type });
    if (uploadError) {
      setError(uploadError.message);
      return;
    }
    const { data: publicData } = supabase.storage.from('avatars').getPublicUrl(path);
    const publicUrl = publicData.publicUrl;
    setSavingAvatar(true);
    const { error } = await supabase
      .from('users')
      .update({ avatar_url: publicUrl })
      .eq('id', profile.id);
    if (error) {
      setError(error.message);
    } else {
      setProfile({ ...profile, avatar_url: publicUrl });
      setError(null);
      setAvatarFile(null);
      setAvatarPreview(null);
    }
    setSavingAvatar(false);
  };

  const handleChangePassword = async () => {
    if (pwNew.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (pwNew !== pwConfirm) {
      setError('Passwords do not match.');
      return;
    }
    setSavingPw(true);
    const { error } = await supabase.auth.updateUser({ password: pwNew });
    if (error) {
      setError(error.message);
    } else {
      setError(null);
      setPwNew('');
      setPwConfirm('');
    }
    setSavingPw(false);
  };

  if (!authUser) {
    return (
      <div className="text-center text-gray-600 py-12">Not signed in.</div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="text-center text-red-600 py-12 bg-red-50 rounded-xl border border-red-100 mx-6">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
      <div className="bg-surface p-6 rounded-2xl shadow-premium border border-border">
        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
        <p className="mt-1 text-gray-500 text-sm">
          Manage your personal information and security settings
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm shadow-sm flex items-center gap-2">
          <BadgeCheck className="w-4 h-4" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Avatar & Password */}
        <div className="space-y-6">
          <ModernCard title="Profile Photo" className="flex flex-col items-center text-center">
            <div className="relative group">
              <div className="w-32 h-32 rounded-full border-4 border-white bg-gray-50 flex items-center justify-center overflow-hidden shadow-premium-md mb-4">
                {currentAvatar ? (
                  <img src={currentAvatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-16 h-16 text-gray-300" />
                )}
              </div>
              <label className="absolute bottom-4 right-0 p-2 bg-primary text-white rounded-full shadow-lg cursor-pointer hover:bg-primary-dark transition-colors">
                <Camera className="w-4 h-4" />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setAvatarFile(file);
                    if (file) {
                      setAvatarPreview(URL.createObjectURL(file));
                    } else {
                      setAvatarPreview(null);
                    }
                  }}
                />
              </label>
            </div>
            
            <div className="w-full mt-2">
              <h3 className="text-lg font-bold text-gray-900">{profile?.full_name}</h3>
              <p className="text-sm text-gray-500">{profile?.email}</p>
              <p className="text-xs text-gray-400 mt-1">{profile?.role?.toUpperCase()}</p>
            </div>

            {avatarFile && (
              <div className="w-full mt-4 animate-fade-in">
                <ModernButton
                  onClick={handleSaveAvatar}
                  loading={savingAvatar}
                  fullWidth
                  variant="primary"
                  size="sm"
                >
                  Save New Photo
                </ModernButton>
              </div>
            )}
          </ModernCard>

          <ModernCard>
            <div className="flex items-center gap-2 mb-4">
              <Lock className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-bold text-gray-900">Security</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  New Password
                </label>
                <input
                  type="password"
                  value={pwNew}
                  onChange={(e) => setPwNew(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm"
                  placeholder="Min. 6 characters"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={pwConfirm}
                  onChange={(e) => setPwConfirm(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm"
                  placeholder="Re-enter password"
                />
              </div>
              <ModernButton
                onClick={handleChangePassword}
                loading={savingPw}
                fullWidth
                variant="outline"
                disabled={!pwNew || !pwConfirm}
              >
                Update Password
              </ModernButton>
            </div>
          </ModernCard>
        </div>

        {/* Right Column: Personal Info */}
        <div className="lg:col-span-2">
          <ModernCard>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-bold text-gray-900">Personal Information</h2>
              </div>
              <span className="text-xs font-medium text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-100">
                Read-only
              </span>
            </div>

            {profile && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                      <User className="w-3.5 h-3.5 text-gray-400" /> Full Name
                    </label>
                    <div className="w-full px-4 py-2.5 rounded-xl border border-gray-100 bg-gray-50 text-gray-700 text-sm">
                      {profile.full_name || '—'}
                    </div>
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                      <Mail className="w-3.5 h-3.5 text-gray-400" /> Email Address
                    </label>
                    <div className="w-full px-4 py-2.5 rounded-xl border border-gray-100 bg-gray-50 text-gray-700 text-sm">
                      {profile.email || '—'}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                      <BadgeCheck className="w-3.5 h-3.5 text-gray-400" /> Employee Code
                    </label>
                    <div className="w-full px-4 py-2.5 rounded-xl border border-gray-100 bg-gray-50 text-gray-700 text-sm">
                      {profile.employee_code || '—'}
                    </div>
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                      <Building className="w-3.5 h-3.5 text-gray-400" /> Department / Lead
                    </label>
                    <div className="w-full px-4 py-2.5 rounded-xl border border-gray-100 bg-gray-50 text-gray-700 text-sm">
                      {profile.department || '—'}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" /> Date of Joining
                    </label>
                    <div className="w-full px-4 py-2.5 rounded-xl border border-gray-100 bg-gray-50 text-gray-700 text-sm">
                      {profile.created_at ? new Date(profile.created_at).toLocaleDateString() : '—'}
                    </div>
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" /> Date of Birth
                    </label>
                    <div className="w-full px-4 py-2.5 rounded-xl border border-gray-100 bg-gray-50 text-gray-700 text-sm">
                      {profile.date_of_birth || '—'}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                      <CreditCard className="w-3.5 h-3.5 text-gray-400" /> Aadhar Number
                    </label>
                    <div className="w-full px-4 py-2.5 rounded-xl border border-gray-100 bg-gray-50 text-gray-700 text-sm">
                      {profile.aadhar_number || '—'}
                    </div>
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                      <CreditCard className="w-3.5 h-3.5 text-gray-400" /> PAN Number
                    </label>
                    <div className="w-full px-4 py-2.5 rounded-xl border border-gray-100 bg-gray-50 text-gray-700 text-sm">
                      {profile.pan_number || '—'}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <MapPin className="w-3.5 h-3.5 text-gray-400" /> Address
                  </label>
                  <div className="w-full px-4 py-2.5 rounded-xl border border-gray-100 bg-gray-50 text-gray-700 text-sm min-h-[80px]">
                    {profile.address || '—'}
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-400 flex items-center gap-2">
                    <Shield className="w-3 h-3" />
                    For any changes to personal information, please contact the system administrator.
                  </p>
                </div>
              </div>
            )}
          </ModernCard>
        </div>
      </div>
    </div>
  );
}
