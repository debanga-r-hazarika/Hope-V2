import { useState } from 'react';
import { X, UserPlus, Save } from 'lucide-react';
import { ModernButton } from './ui/ModernButton';

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (userData: UserFormData) => Promise<void>;
}

export interface UserFormData {
  fullName: string;
  email: string;
  password: string;
  department?: string;
  dateOfBirth?: string;
  address?: string;
}

export function CreateUserModal({ isOpen, onClose, onCreate }: CreateUserModalProps) {
  const [formData, setFormData] = useState<UserFormData>({
    fullName: '',
    email: '',
    password: '',
    department: '',
    dateOfBirth: '',
    address: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onCreate(formData);
      setFormData({
        fullName: '',
        email: '',
        password: '',
        department: '',
        dateOfBirth: '',
        address: '',
      });
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create user';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  if (!isOpen) return null;

  const inputClass = "w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm";
  const labelClass = "block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5";

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-surface rounded-2xl shadow-premium-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-white/20">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <UserPlus className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Create New User</h2>
              <p className="text-sm text-gray-500">Add a new member to the organization</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className={labelClass}>
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  required
                  className={inputClass}
                  placeholder="Enter full name"
                />
              </div>

              <div>
                <label className={labelClass}>
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className={inputClass}
                  placeholder="email@example.com"
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>
                Temporary Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                minLength={6}
                className={inputClass}
                placeholder="Set an initial password (min 6 chars)"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className={labelClass}>
                  Lead (optional)
                </label>
                <input
                  type="text"
                  name="department"
                  value={formData.department}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder="Department or Team Lead"
                />
              </div>
              <div>
                <label className={labelClass}>
                  Date of Birth (optional)
                </label>
                <input
                  type="date"
                  name="dateOfBirth"
                  value={formData.dateOfBirth}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>
                Address (optional, admin view only)
              </label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleChange}
                className={`${inputClass} min-h-[80px] resize-none`}
                rows={2}
                placeholder="Confidential address (visible to admins)"
              />
            </div>
          </div>

          {error && (
            <div className="mt-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm shadow-sm">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 mt-8 pt-6 border-t border-gray-100">
            <ModernButton
              type="button"
              onClick={onClose}
              variant="ghost"
            >
              Cancel
            </ModernButton>
            <ModernButton
              type="submit"
              loading={submitting}
              icon={<Save className="w-4 h-4" />}
            >
              Create User
            </ModernButton>
          </div>
        </form>
      </div>
    </div>
  );
}
