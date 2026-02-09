import { Folder, FolderPlus, Users, Trash2, FileText, Clock, Loader2, Edit } from 'lucide-react';
import type { FolderWithAccess } from '../types/documents';
import { ModernButton } from './ui/ModernButton';

interface Props {
  folders: FolderWithAccess[];
  loading: boolean;
  search: string;
  hasModuleWriteAccess: boolean;
  deletingFolderId: string | null;
  onOpenFolder: (folder: FolderWithAccess) => void;
  onManageAccess: (folderId: string) => void;
  onEditFolder: (folder: FolderWithAccess) => void;
  onDeleteFolder: (id: string) => void;
  onNewFolder: () => void;
  getAccessBadge: (level: string) => JSX.Element;
  formatRelativeTime: (timestamp: string) => string;
}

export function DocumentsFoldersView({ folders, loading, search, hasModuleWriteAccess, deletingFolderId, onOpenFolder, onManageAccess, onEditFolder, onDeleteFolder, onNewFolder, getAccessBadge, formatRelativeTime }: Props) {
  return (
    <>
      {hasModuleWriteAccess && (
        <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-lg border border-gray-200 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-lg">
                <FolderPlus className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Folder Management</h3>
                <p className="text-sm text-gray-600">Create and organize folders</p>
              </div>
            </div>
            <ModernButton onClick={onNewFolder} icon={<FolderPlus className="w-4 h-4" />} className="shadow-lg">New Folder</ModernButton>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md">
              <Folder className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-gray-900 text-lg">All Folders</span>
            <span className="px-3 py-1 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-xs font-bold shadow-sm">{folders.length}</span>
          </div>
          {loading && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="font-medium">Loading...</span>
            </div>
          )}
        </div>

        {folders.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner">
              <Folder className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">No folders found</h3>
            <p className="text-gray-600 text-sm">{search ? 'Try adjusting your search' : hasModuleWriteAccess ? 'Create your first folder to get started' : 'No folders shared with you yet'}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {folders.map(folder => (
              <div key={folder.id} className="group hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-indigo-50/50 transition-all duration-200">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-6 py-5">
                  <button onClick={() => onOpenFolder(folder)} className="flex items-start gap-4 flex-1 text-left">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg group-hover:shadow-xl group-hover:scale-105 transition-all duration-200 flex-shrink-0">
                      <Folder className="w-7 h-7 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-bold text-gray-900 text-base truncate">{folder.name}</p>
                        {getAccessBadge(folder.userAccessLevel)}
                      </div>
                      {folder.description && <p className="text-sm text-gray-600 mb-2 line-clamp-1">{folder.description}</p>}
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1.5 font-medium">
                          <FileText className="w-3.5 h-3.5" />
                          {folder.documentCount || 0} files
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          {formatRelativeTime(folder.createdAt)}
                        </span>
                      </div>
                    </div>
                  </button>
                  {hasModuleWriteAccess && (
                    <div className="flex items-center gap-2 pl-16 md:pl-0">
                      <ModernButton onClick={() => onEditFolder(folder)} variant="secondary" size="sm" icon={<Edit className="w-3.5 h-3.5" />}>Edit</ModernButton>
                      <ModernButton onClick={() => onManageAccess(folder.id)} variant="secondary" size="sm" icon={<Users className="w-3.5 h-3.5" />}>Access</ModernButton>
                      <ModernButton onClick={() => onDeleteFolder(folder.id)} variant="danger" size="sm" disabled={deletingFolderId === folder.id} loading={deletingFolderId === folder.id} icon={deletingFolderId !== folder.id ? <Trash2 className="w-3.5 h-3.5" /> : undefined}>{deletingFolderId === folder.id ? 'Deleting' : 'Delete'}</ModernButton>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
