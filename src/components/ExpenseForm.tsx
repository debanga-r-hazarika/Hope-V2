import { useEffect, useState } from 'react';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { ExpenseEntry, PaymentMethod, PaymentTo } from '../types/finance';
import { supabase } from '../lib/supabase';

interface ExpenseFormProps {
  entry: ExpenseEntry | null;
  onSave: (data: Partial<ExpenseEntry>, evidenceFile?: File | null) => void;
  onCancel: () => void;
  saving?: boolean;
  saveSuccess?: string | null;
}

export function ExpenseForm({ entry, onSave, onCancel, saving = false, saveSuccess }: ExpenseFormProps) {
  const [users, setUsers] = useState<Array<{ id: string; full_name: string }>>([]);

  const getInitialDateTime = (value?: string) => {
    const d = value ? new Date(value) : new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    return { date, time };
  };

  const { date: initialDateOnly, time: initialTime } = getInitialDateTime(entry?.paymentDate);
  const [formData, setFormData] = useState({
    amount: entry?.amount || 0,
    reason: entry?.reason || '',
    paymentTo: entry?.paymentTo || 'organization_bank' as PaymentTo,
    paidToUser: entry?.paidToUser || '',
    paymentDate: initialDateOnly,
    paymentTime: initialTime,
    paymentMethod: entry?.paymentMethod || 'bank_transfer' as PaymentMethod,
    bankReference: entry?.bankReference || '',
    vendor: entry?.vendor || '',
    expenseType: entry?.expenseType || 'operational' as 'operational' | 'salary' | 'utilities' | 'maintenance' | 'raw_material' | 'other',
    otherExpenseTypeSpecification: entry?.otherExpenseTypeSpecification || '',
    description: entry?.description || '',
    evidenceUrl: entry?.evidenceUrl || '',
  });
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id, full_name')
          .eq('is_active', true);
        if (error) {
          setUsers([]);
          return;
        }
        setUsers((data ?? []) as Array<{ id: string; full_name: string }>);
      } catch {
        setUsers([]);
      }
    };
    void loadUsers();
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const updates: any = {
        ...prev,
        [name]: name === 'amount' ? parseFloat(value) || 0 : value,
      };
      // Clear otherExpenseTypeSpecification when switching away from 'other'
      if (name === 'expenseType' && value !== 'other') {
        updates.otherExpenseTypeSpecification = '';
      }
      return updates;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const combinedDate = new Date(`${formData.paymentDate}T${formData.paymentTime || '00:00'}`).toISOString();
    const { paymentTime, ...rest } = formData as typeof formData & { paymentTime?: string };
    onSave({ ...rest, paymentDate: combinedDate, paymentDateLocal: formData.paymentDate }, evidenceFile);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={onCancel}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Cancel
        </button>
      </div>

      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          {entry ? 'Edit Expense' : 'Add New Expense'}
        </h1>
        <p className="mt-2 text-gray-600">
          Fill in the details below to {entry ? 'update' : 'create'} an expense entry
        </p>
        {saveSuccess && (
          <div className="mt-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
            {saveSuccess}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6" style={{ pointerEvents: saving ? 'none' : 'auto', opacity: saving ? 0.7 : 1 }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Amount (INR) *
            </label>
            <input
              type="number"
              name="amount"
              value={formData.amount}
              onChange={handleChange}
              required
              min="0"
              step="0.01"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter amount"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Expense Type *
            </label>
            <select
              name="expenseType"
              value={formData.expenseType}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="operational">Operational</option>
              <option value="salary">Salary</option>
              <option value="utilities">Utilities</option>
              <option value="maintenance">Maintenance</option>
              <option value="raw_material">Raw Material</option>
              <option value="other">Other</option>
            </select>
            {formData.expenseType === 'other' && (
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Specify Expense Type *
                </label>
                <input
                  type="text"
                  name="otherExpenseTypeSpecification"
                  value={formData.otherExpenseTypeSpecification}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Please specify the expense type"
                />
              </div>
            )}
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason for Payment *
            </label>
            <input
              type="text"
              name="reason"
              value={formData.reason}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter reason for expense"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Vendor / Payee
            </label>
            <input
              type="text"
              name="vendor"
              value={formData.vendor}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Vendor name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payment Reference No.
            </label>
            <input
              type="text"
              name="bankReference"
              value={formData.bankReference}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Bank transaction reference"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Evidence (Image/PDF)
            </label>
            <label
              className="flex items-center justify-between px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
            >
              <span className="text-sm text-gray-700">
                {evidenceFile ? evidenceFile.name : 'Upload payment proof'}
              </span>
              <span className="text-xs text-gray-500">PNG/JPG/PDF</span>
              <input
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setEvidenceFile(file);
                }}
              />
            </label>
            {formData.evidenceUrl && !evidenceFile && (
              <p className="mt-2 text-xs text-blue-600 truncate">
                Existing: <a href={formData.evidenceUrl} target="_blank" rel="noreferrer" className="underline">View</a>
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payment Date *
            </label>
            <input
              type="date"
              name="paymentDate"
              value={formData.paymentDate}
              onChange={handleChange}
              required
              className="w-full min-w-0 px-3 py-2.5 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payment Time *
            </label>
            <input
              type="time"
              name="paymentTime"
              value={formData.paymentTime}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payment Method *
            </label>
            <select
              name="paymentMethod"
              value={formData.paymentMethod}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="bank_transfer">Bank Transfer</option>
              <option value="upi">UPI</option>
              <option value="cash">Cash</option>
              <option value="cheque">Cheque</option>
              <option value="card">Card</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payment From *
            </label>
            <select
              name="paymentTo"
              value={formData.paymentTo}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="organization_bank">Organization Bank</option>
              <option value="other_bank_account">Other Bank Account</option>
            </select>
          </div>

          {formData.paymentTo === 'other_bank_account' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Paid To User *
              </label>
              <select
                name="paidToUser"
                value={formData.paidToUser}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select user</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>{user.full_name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Additional Notes
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Any additional details about this expense"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6 pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-60"
            disabled={saving}
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {saving ? 'Saving...' : (entry ? 'Update' : 'Create')} Expense Entry
          </button>
        </div>
      </form>
    </div>
  );
}
