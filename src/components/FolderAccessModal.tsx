import { useEffect, useState } from 'react';
import { X, UserPlus, Trash2, Loader2, Shield } from 'lucide-react';
import type { FolderUserAccess } from '../types/documents';
import { fetchFolderUsers, assignFolderAccess, removeFolderAccess } from '../lib/documents';
import { supabase } from '../lib/supabase';
import { ModernButton } from './ui/ModernButton';

interface User {
  id: string;
  full_name: string;
  email: string;
}

interface FolderAccessModalProps {
  folderId: string;
  folderName: string;
  currentUserId: string;
  onClose: () => void;
}

export function FolderAccessModal({ folderId, folderName, currentUserId, onClose }: FolderAccessModalProps) {
  const [folderUsers, setFolderUsers] = useState<FolderUserAccess[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedAccessLevel, setSelectedAccessLevel] = useState<'read-only' | 'read-write'>('read-only');
  const [assigning, setAssigning] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [updatingAccessId, setUpdatingAccessId] = useState<string | null>(null);

  useEffect(() => {
    void loadData();
  }, [folderId]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersData, accessData] = await Promise.all([
        supabase.from('users').select('id, full_name, email, is_active').eq('is_active', true).order('full_name'),
        fetchFolderUsers(folderId)
      ]);
      
      if (usersData.error) throw usersData.error;
      setAllUsers(usersData.data || []);
      setFolderUsers(accessData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load data';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedUserId) return;
    setAssigning(true);
    setError(null);
    try {
      await assignFolderAccess(folderId, selectedUserId, selectedAccessLevel, currentUserId);
      await loadData();
      setSelectedUserId('');
      setSelectedAccessLevel('read-only');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to assign access';
      setError(message);
    } finally {
      setAssigning(false);
    }
  };

  const handleRemove = async (accessId: string) => {
    if (!confirm('Remove this user\'s access to the folder?')) return;
    setRemovingId(accessId);
    setError(null);
    try {
      await removeFolderAccess(accessId);
      setFolderUsers(prev => prev.filter(u => u.id !== accessId));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove access';
      setError(message);
    } finally {
      setRemovingId(null);
    }
  };

  const handleUpdateAccess = async (accessId: string, userId: string, newAccessLevel: 'read-only' | 'read-write') => {
    setUpdatingAccessId(accessId);
    setError(null);
    try {
      await assignFolderAccess(folderId, userId, newAccessLevel, currentUserId);
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update access';
      setError(message);
    } finally {
      setUpdatingAccessId(null);
    }
  };

  const availableUsers = allUsers.filter(
    user => !folderUsers.some(fu => fu.userId === user.id)
  );

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-scale-in">
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Manage Folder Access</h2>
                <p className="text-sm text-blue-100 mt-0.5">{folderName}</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-white/20 flex items-center justify-center transition-colors">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gradient-to-b from-gray-50 to-white">
          {error && (
            <div className="bg-gradient-to-r from-red-50 to-pink-50 border-l-4 border-red-500 rounded-xl p-4 shadow-lg animate-fade-in">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <X className="w-4 h-4 text-red-600" />
                </div>
                <p className="text-sm font-semibold text-red-800 flex-1">{error}</p>
              </div>
            </div>
          )}

          {/* Assign New User */}
          <div className="bg-white rounded-xl p-5 border-2 border-blue-200 shadow-lg">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                <UserPlus className="w-4 h-4 text-white" />
              </div>
              <h3 className="font-bold text-gray-900 text-lg">Assign User Access</h3>
            </div>
            <div className="flex flex-col gap-3">
              <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm font-medium bg-white">
                <option value="">Select user...</option>
                {availableUsers.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.full_name} ({user.email})
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <select value={selectedAccessLevel} onChange={(e) => setSelectedAccessLevel(e.target.value as 'read-only' | 'read-write')} className="px-4 py-3 rounded-xl border-2 border-gray-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm font-medium bg-white">
                  <option value="read-only">Read Only</option>
                  <option value="read-write">Read & Write</option>
                </select>
                <ModernButton onClick={handleAssign} disabled={!selectedUserId || assigning} loading={assigning} icon={<UserPlus className="w-4 h-4" />} className="shadow-lg">Assign</ModernButton>
              </div>
            </div>
          </div>

          {/* Current Access List */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <h3 className="font-bold text-gray-900 text-lg">Current Access</h3>
              <span className="px-3 py-1 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-xs font-bold shadow-sm">{folderUsers.length}</span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12 bg-white rounded-xl border border-gray-200">
                <div className="text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-3" />
                  <p className="text-sm text-gray-600 font-medium">Loading users...</p>
                </div>
              </div>
            ) : folderUsers.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border-2 border-dashed border-gray-300">
                <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner">
                  <Shield className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-600 font-medium mb-1">No users assigned yet</p>
                <p className="text-sm text-gray-500">Assign users above to grant access</p>
              </div>
            ) : (
              <div className="space-y-3">
                {folderUsers.map(access => (
                  <div key={access.id} className="group bg-white border-2 border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-lg transition-all duration-200">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 truncate">{access.userName || 'Unknown User'}</p>
                        <p className="text-sm text-gray-600 truncate">{access.userEmail}</p>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                        <div className="relative flex-1 sm:flex-initial">
                          <select
                            value={access.accessLevel}
                            onChange={(e) => void handleUpdateAccess(access.id, access.userId, e.target.value as 'read-only' | 'read-write')}
                            disabled={updatingAccessId === access.id}
                            className={`w-full appearance-none px-3 sm:px-4 py-2 pr-8 sm:pr-10 rounded-lg text-xs sm:text-sm font-bold shadow-md border-2 outline-none transition-all ${
                              access.accessLevel === 'read-write'
                                ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white border-green-600 hover:from-green-600 hover:to-emerald-600'
                                : 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-blue-600 hover:from-blue-600 hover:to-cyan-600'
                            } ${updatingAccessId === access.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-lg'}`}
                            style={{
                              backgroundImage: access.accessLevel === 'read-write' 
                                ? 'linear-gradient(to right, rgb(34, 197, 94), rgb(16, 185, 129))'
                                : 'linear-gradient(to right, rgb(59, 130, 246), rgb(6, 182, 212))'
                            }}
                          >
                            <option value="read-only" className="bg-white text-gray-900">Read Only</option>
                            <option value="read-write" className="bg-white text-gray-900">Read & Write</option>
                          </select>
                          <div className="absolute inset-y-0 right-0 flex items-center pr-2 sm:pr-3 pointer-events-none">
                            <svg className="w-3 h-3 sm:w-4 sm:h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                        <ModernButton onClick={() => void handleRemove(access.id)} variant="danger" size="sm" disabled={removingId === access.id} loading={removingId === access.id} icon={removingId !== access.id ? <Trash2 className="w-3.5 h-3.5" /> : undefined} className="flex-shrink-0">Remove</ModernButton>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <ModernButton onClick={onClose} variant="secondary" className="w-full shadow-lg">Close</ModernButton>
        </div>
      </div>
    </div>
  );
}
