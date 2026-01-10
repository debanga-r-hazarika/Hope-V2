import { useEffect, useState } from 'react';
import { User } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

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
      <div className="text-center text-gray-600">Not signed in.</div>
    );
  }

  if (loading) {
    return (
      <div className="text-center text-gray-600">Loading profile...</div>
    );
  }

  if (error && !profile) {
    return (
      <div className="text-center text-red-600">{error}</div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
        <p className="mt-2 text-gray-600">
          View your information. You can change your photo and password.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Profile Photo
        </h2>

        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="relative">
            <div className="w-32 h-32 rounded-2xl border-2 border-blue-100 bg-gradient-to-br from-blue-50 to-white flex items-center justify-center overflow-hidden shadow-inner">
              {currentAvatar ? (
                <img src={currentAvatar} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <User className="w-16 h-16 text-blue-400" />
              )}
            </div>
            <p className="mt-2 text-xs text-gray-500 text-center">
              {avatarFile ? avatarFile.name : 'Recommended: square PNG/JPG'}
            </p>
          </div>

          <div className="flex-1 w-full">
            <p className="text-sm text-gray-600 mb-3">
              Upload a photo (PNG/JPG). You’ll see a preview before saving.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 items-start">
              <label className="w-full">
                <div className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50/50 transition-colors cursor-pointer text-sm text-gray-700">
                  <span className="font-medium text-blue-700">Choose image</span>
                  <span className="text-gray-500"> or drag & drop</span>
                </div>
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
              <button
                onClick={handleSaveAvatar}
                disabled={savingAvatar}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60"
              >
                {savingAvatar ? 'Saving...' : 'Save Photo'}
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Max ~2MB. Publicly visible wherever your avatar appears.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">
            Personal Information
          </h2>
          <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded">
            Read-only (contact admin for changes)
          </span>
        </div>

        {profile && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700"
                  value={profile.full_name || ''}
                  disabled
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700"
                  value={profile.email || ''}
                  disabled
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Employee Code
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700"
                  value={profile.employee_code || ''}
                  disabled
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Lead
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700"
                  value={profile.department || ''}
                  disabled
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date of Joining
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700"
                  value={profile.created_at ? new Date(profile.created_at).toLocaleDateString() : ''}
                  disabled
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date of Birth
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700"
                  value={profile.date_of_birth || ''}
                  disabled
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Aadhar Number
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700"
                  value={profile.aadhar_number || ''}
                  disabled
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  PAN Number
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700"
                  value={profile.pan_number || ''}
                  disabled
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Address
              </label>
              <textarea
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 resize-none"
                value={profile.address || ''}
                disabled
                rows={3}
              />
            </div>

            <div className="pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-500">
                All profile details are read-only. Contact admin for any changes. You can only update your password and profile photo.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">
          Change Password
        </h2>

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                New Password
              </label>
              <input
                type="password"
                value={pwNew}
                onChange={(e) => setPwNew(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                placeholder="Enter new password"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                value={pwConfirm}
                onChange={(e) => setPwConfirm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                placeholder="Confirm new password"
              />
            </div>
          </div>

          <div className="pt-6 border-t border-gray-200">
            <button
              onClick={handleChangePassword}
              disabled={savingPw}
              className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-60"
            >
              {savingPw ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
