import { useEffect, useState } from 'react';
import { X, Shield, Save, AlertCircle } from 'lucide-react';
import type { ModuleAccess, AccessLevel } from '../types/access';
import { MODULE_DEFINITIONS } from '../types/modules';
import { ModernButton } from './ui/ModernButton';

interface ModuleAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  initialAccess?: ModuleAccess[];
  onSave: (access: ModuleAccess[]) => Promise<void>;
  isSaving?: boolean;
}

export function ModuleAccessModal({
  isOpen,
  onClose,
  userName,
  initialAccess = [],
  onSave,
  isSaving,
}: ModuleAccessModalProps) {
  const [moduleAccess, setModuleAccess] = useState<ModuleAccess[]>([]);

  useEffect(() => {
    if (isOpen) {
      setModuleAccess(
        MODULE_DEFINITIONS.map((module) => {
          const existing = initialAccess.find((a) => a.moduleId === module.id);
          return {
            moduleId: module.id,
            moduleName: module.name,
            accessLevel: existing?.accessLevel || 'no-access',
          };
        })
      );
    }
  }, [isOpen, initialAccess]);

  const handleAccessChange = (moduleId: string, level: AccessLevel) => {
    setModuleAccess((prev) =>
      prev.map((item) =>
        item.moduleId === moduleId ? { ...item, accessLevel: level } : item
      )
    );
  };

  const handleSave = async () => {
    await onSave(moduleAccess);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-surface rounded-2xl shadow-premium-lg max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-white/20">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Module Access Control</h2>
              <p className="text-sm text-gray-500">
                Managing permissions for <span className="font-semibold text-gray-900">{userName}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 flex gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 shrink-0" />
              <p className="text-sm text-blue-800">
                Configure module access for this user. Modules set to "No Access" will be completely hidden from their navigation menu.
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full">
                <thead className="bg-gray-50/50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Module Name
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-64">
                      Access Level
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {moduleAccess.map((item) => (
                    <tr key={item.moduleId} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-gray-900">
                          {item.moduleName}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={item.accessLevel}
                          onChange={(e) =>
                            handleAccessChange(
                              item.moduleId,
                              e.target.value as AccessLevel
                            )
                          }
                          className="block w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm outline-none transition-all cursor-pointer hover:border-gray-300"
                        >
                          <option value="no-access">No Access</option>
                          <option value="read-only">Read Only</option>
                          <option value="read-write">Read & Write</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-100 bg-gray-50/50">
          <ModernButton
            onClick={onClose}
            variant="ghost"
          >
            Cancel
          </ModernButton>
          <ModernButton
            onClick={handleSave}
            loading={isSaving}
            icon={<Save className="w-4 h-4" />}
          >
            Save Access Settings
          </ModernButton>
        </div>
      </div>
    </div>
  );
}
