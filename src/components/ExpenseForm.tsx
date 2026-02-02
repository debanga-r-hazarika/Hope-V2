import { useEffect, useState } from 'react';
import { ArrowLeft, Save, AlertCircle, CheckCircle2, Calendar, CreditCard, User, AlignLeft, Paperclip, ExternalLink, DollarSign } from 'lucide-react';
import { ExpenseEntry, PaymentMethod, PaymentTo } from '../types/finance';
import { supabase } from '../lib/supabase';
import { ModernButton } from './ui/ModernButton';
import { ModernCard } from './ui/ModernCard';

interface ExpenseFormProps {
  entry: ExpenseEntry | null;
  onSave: (data: Partial<ExpenseEntry>, evidenceFile?: File | null) => void;
  onCancel: () => void;
  saving?: boolean;
  saveSuccess?: string | null;
}

export function ExpenseForm({ entry, onSave, onCancel, saving = false, saveSuccess }: ExpenseFormProps) {
  const [users, setUsers] = useState<Array<{ id: string; full_name: string }>>([]);
  const [userFetchError, setUserFetchError] = useState<string | null>(null);

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
          setUserFetchError(error.message);
          setUsers([]);
          return;
        }
        setUsers((data ?? []) as Array<{ id: string; full_name: string }>);
        setUserFetchError(null);
      } catch (err) {
        setUserFetchError(err instanceof Error ? err.message : 'Failed to load users');
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
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <ModernButton
          onClick={onCancel}
          variant="ghost"
          icon={<ArrowLeft className="w-5 h-5" />}
        >
          Cancel
        </ModernButton>
      </div>

      <div>
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">
          {entry ? 'Edit Expense' : 'Add New Expense'}
        </h1>
        <p className="mt-2 text-slate-500">
          Fill in the details below to {entry ? 'update' : 'create'} an expense entry
        </p>
        {saveSuccess && (
          <div className="mt-4 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2 shadow-sm">
            <CheckCircle2 className="w-5 h-5" />
            {saveSuccess}
          </div>
        )}
        {userFetchError && (
          <p className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded-lg border border-red-100">
            Could not load users: {userFetchError}
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <ModernCard padding="lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Amount */}
            <div className="col-span-1">
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Amount (INR) *
              </label>
              <div className="relative">
                <span className="absolute left-4 top-3.5 text-slate-400 font-bold">₹</span>
                <input
                  type="number"
                  name="amount"
                  value={formData.amount}
                  onChange={handleChange}
                  required
                  min="0"
                  step="0.01"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all font-mono text-lg font-medium"
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Expense Type */}
            <div className="col-span-1">
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Expense Type *
              </label>
              <select
                name="expenseType"
                value={formData.expenseType}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
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
                  <input
                    type="text"
                    name="otherExpenseTypeSpecification"
                    value={formData.otherExpenseTypeSpecification}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                    placeholder="Please specify the expense type"
                  />
                </div>
              )}
            </div>

            {/* Reason */}
            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Reason for Payment *
              </label>
              <div className="relative">
                <AlignLeft className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  name="reason"
                  value={formData.reason}
                  onChange={handleChange}
                  required
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                  placeholder="Enter reason for expense"
                />
              </div>
            </div>

            {/* Vendor */}
            <div className="col-span-1">
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Vendor / Payee
              </label>
              <div className="relative">
                <User className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  name="vendor"
                  value={formData.vendor}
                  onChange={handleChange}
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                  placeholder="Vendor name"
                />
              </div>
            </div>

            {/* Reference */}
            <div className="col-span-1">
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Payment Reference No.
              </label>
              <input
                type="text"
                name="bankReference"
                value={formData.bankReference}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all font-mono text-sm"
                placeholder="Bank transaction reference"
              />
            </div>

            {/* Date & Time */}
            <div className="col-span-1">
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Payment Date *
              </label>
              <div className="relative">
                <Calendar className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
                <input
                  type="date"
                  name="paymentDate"
                  value={formData.paymentDate}
                  onChange={handleChange}
                  required
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                />
              </div>
            </div>
            <div className="col-span-1">
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Payment Time *
              </label>
              <input
                type="time"
                name="paymentTime"
                value={formData.paymentTime}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
              />
            </div>

            {/* Payment Method */}
            <div className="col-span-1">
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Payment Method *
              </label>
              <div className="relative">
                <CreditCard className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
                <select
                  name="paymentMethod"
                  value={formData.paymentMethod}
                  onChange={handleChange}
                  required
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all appearance-none"
                >
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="upi">UPI</option>
                  <option value="cash">Cash</option>
                  <option value="cheque">Cheque</option>
                  <option value="card">Card</option>
                </select>
              </div>
            </div>

            {/* Payment From */}
            <div className="col-span-1">
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Payment From *
              </label>
              <select
                name="paymentTo"
                value={formData.paymentTo}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
              >
                <option value="organization_bank">Organization Bank</option>
                <option value="other_bank_account">Other Bank Account</option>
              </select>
            </div>

            {/* Conditional User Select */}
            {formData.paymentTo === 'other_bank_account' && (
              <div className="col-span-1 md:col-span-2 bg-blue-50 p-6 rounded-xl border border-blue-100">
                <label className="block text-sm font-bold text-blue-900 mb-2">
                  Paid To User *
                </label>
                <select
                  name="paidToUser"
                  value={formData.paidToUser}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 bg-white border border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                >
                  <option value="">Select user</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>{user.full_name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Evidence Upload */}
            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Evidence Document
              </label>
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 transition-all hover:border-primary-500 hover:bg-primary-50/50 cursor-pointer group">
                <input
                  type="file"
                  accept="image/*,.pdf"
                  id="evidence-upload"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setEvidenceFile(file);
                  }}
                />
                <label htmlFor="evidence-upload" className="flex flex-col items-center justify-center w-full h-full cursor-pointer">
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3 group-hover:bg-white transition-colors shadow-sm">
                    <Paperclip className="w-6 h-6 text-slate-500 group-hover:text-primary-600" />
                  </div>
                  <p className="text-sm font-medium text-slate-900">
                    {evidenceFile ? evidenceFile.name : 'Click to upload or drag and drop'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    PDF, PNG, JPG (max 10MB)
                  </p>
                </label>
              </div>
              {formData.evidenceUrl && !evidenceFile && (
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Current:</span>
                  <a 
                    href={formData.evidenceUrl} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="text-sm text-primary-600 hover:text-primary-700 underline flex items-center gap-1 font-medium"
                  >
                    View Document <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Additional Notes
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all resize-none"
                placeholder="Any additional details about this expense"
              />
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col sm:flex-row gap-4">
            <ModernButton
              type="button"
              onClick={onCancel}
              variant="outline"
              size="lg"
              className="flex-1"
            >
              Cancel
            </ModernButton>
            <ModernButton
              type="submit"
              variant="primary"
              size="lg"
              className="flex-1"
              disabled={saving}
              loading={saving}
              icon={saving ? undefined : <Save className="w-5 h-5" />}
            >
              {entry ? 'Update Expense' : 'Create Expense'}
            </ModernButton>
          </div>
        </ModernCard>
      </form>
    </div>
  );
}
