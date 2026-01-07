import { useEffect, useState } from 'react';
import { X, Shield } from 'lucide-react';
import type { ModuleAccess, AccessLevel } from '../types/access';
import { MODULE_DEFINITIONS } from '../types/modules';

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
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Shield className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Module Access Control</h2>
              <p className="text-sm text-gray-600">
                {userName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                Configure module access for this user. Modules with \"No Access\" will not be visible.
              </p>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Module
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Access Level
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {moduleAccess.map((item) => (
                    <tr key={item.moduleId} className="hover:bg-gray-50">
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
                          className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
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

        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-60"
          >
            {isSaving ? 'Saving...' : 'Save Access Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
