import { useEffect, useState } from 'react';
import { ArrowLeft, Save, AlertCircle, ShoppingCart, FileText, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';
import { IncomeEntry, PaymentMethod, PaymentTo } from '../types/finance';
import { supabase } from '../lib/supabase';

interface IncomeFormProps {
  entry: IncomeEntry | null;
  onSave: (data: Partial<IncomeEntry>, evidenceFile?: File | null) => void;
  onCancel: () => void;
  saving?: boolean;
  saveSuccess?: string | null;
}

export function IncomeForm({ entry, onSave, onCancel, saving = false, saveSuccess }: IncomeFormProps) {
  const [users, setUsers] = useState<Array<{ id: string; full_name: string }>>([]);
  const [userFetchError, setUserFetchError] = useState<string | null>(null);
  const isReadOnly = entry?.fromSalesPayment || false;
  const [salesTypeError, setSalesTypeError] = useState<string | null>(null);

  const getInitialDateTime = (value?: string) => {
    const d = value ? new Date(value) : new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    return { date, time };
  };

  const { date: initialDateOnly, time: initialTime } = getInitialDateTime(entry?.paymentDate);
  const isNewEntry = !entry;
  const [formData, setFormData] = useState({
    amount: entry?.amount || 0,
    reason: entry?.reason || '',
    paymentTo: entry?.paymentTo || 'organization_bank' as PaymentTo,
    paidToUser: entry?.paidToUser || '',
    paymentDate: initialDateOnly,
    paymentTime: initialTime,
    paymentMethod: entry?.paymentMethod || 'bank_transfer' as PaymentMethod,
    bankReference: entry?.bankReference || '',
    source: entry?.source || '',
    incomeType: entry?.incomeType || 'service' as 'sales' | 'service' | 'interest' | 'other',
    description: entry?.description || '',
    evidenceUrl: entry?.evidenceUrl || '',
  });
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const isSalesTypeBlocked = isNewEntry && formData.incomeType === 'sales';

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
    
    // Check if user is trying to select "sales" for a new entry
    if (name === 'incomeType' && value === 'sales' && isNewEntry) {
      setSalesTypeError('Sales can\'t be entered through here. It can only be added through Sales module. Please add the income in a proper flow.');
    } else if (name === 'incomeType' && value !== 'sales') {
      setSalesTypeError(null);
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: name === 'amount' ? parseFloat(value) || 0 : value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent submission if sales type is selected for new entries
    if (isNewEntry && formData.incomeType === 'sales') {
      setSalesTypeError('Sales can\'t be entered through here. It can only be added through Sales module. Please add the income in a proper flow.');
      return;
    }
    
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
          {entry ? 'Edit Income' : 'Add New Income'}
        </h1>
        <p className="mt-2 text-gray-600">
          Fill in the details below to {entry ? 'update' : 'create'} an income entry
        </p>
        {saveSuccess && (
          <div className="mt-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
            {saveSuccess}
          </div>
        )}
        {entry?.fromSalesPayment && (
          <div className="mt-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm font-medium text-yellow-900 mb-2">
              ⚠️ This income entry is linked to a sales order payment
            </p>
            <p className="text-xs text-yellow-800">
              This entry cannot be edited from the Finance module. Please go to the Sales module, find Order{' '}
              {entry.orderNumber || entry.orderId || 'the order'} and edit the payment from there.
            </p>
          </div>
        )}
        {userFetchError && (
          <p className="mt-2 text-sm text-red-600">
            Could not load users: {userFetchError}
          </p>
        )}
      </div>

      {/* Income Type Selector - Always visible */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Income Type *
        </label>
        <select
          name="incomeType"
          value={formData.incomeType}
          onChange={handleChange}
          required
          disabled={isReadOnly}
          className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed text-base ${
            salesTypeError ? 'border-red-500 bg-red-50' : 'border-gray-300'
          }`}
        >
          <option value="sales">Sales</option>
          <option value="service">Service</option>
          <option value="interest">Interest</option>
          <option value="other">Other</option>
        </select>
        {salesTypeError && !isSalesTypeBlocked && (
          <p className="mt-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            {salesTypeError}
          </p>
        )}
      </div>

      {isSalesTypeBlocked ? (
        <div className="bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 rounded-xl border-2 border-red-200 shadow-lg p-8">
          <div className="flex items-start gap-4 mb-6">
            <div className="flex-shrink-0 w-14 h-14 bg-red-100 rounded-full flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-red-900 mb-2">
                Sales Income Cannot Be Added Here
              </h2>
              <p className="text-lg text-red-800">
                Sales income entries must be created through the Sales module to maintain proper order tracking and workflow.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-red-100 p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Follow These Steps to Add Sales Income:
            </h3>
            <div className="space-y-4">
              <div className="flex items-start gap-4 p-4 bg-blue-50 rounded-lg border border-blue-100 hover:bg-blue-100 transition-colors">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                  1
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900 mb-1">Navigate to Sales Module</p>
                  <p className="text-sm text-gray-600">Go to the <strong>Sales</strong> section from the main navigation menu</p>
                </div>
                <ShoppingCart className="w-5 h-5 text-blue-600 flex-shrink-0 mt-1" />
              </div>

              <div className="flex items-center justify-center text-gray-400">
                <ArrowRight className="w-6 h-6" />
              </div>

              <div className="flex items-start gap-4 p-4 bg-purple-50 rounded-lg border border-purple-100 hover:bg-purple-100 transition-colors">
                <div className="flex-shrink-0 w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                  2
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900 mb-1">Select or Create an Order</p>
                  <p className="text-sm text-gray-600">Click on <strong>Orders</strong> and either select an existing order or create a new one</p>
                </div>
                <FileText className="w-5 h-5 text-purple-600 flex-shrink-0 mt-1" />
              </div>

              <div className="flex items-center justify-center text-gray-400">
                <ArrowRight className="w-6 h-6" />
              </div>

              <div className="flex items-start gap-4 p-4 bg-green-50 rounded-lg border border-green-100 hover:bg-green-100 transition-colors">
                <div className="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                  3
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900 mb-1">Add Payment to the Order</p>
                  <p className="text-sm text-gray-600">In the order details page, click <strong>Add Payment</strong> and fill in the payment details</p>
                </div>
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-1" />
              </div>

              <div className="flex items-center justify-center text-gray-400">
                <ArrowRight className="w-6 h-6" />
              </div>

              <div className="flex items-start gap-4 p-4 bg-emerald-50 rounded-lg border border-emerald-100 hover:bg-emerald-100 transition-colors">
                <div className="flex-shrink-0 w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                  4
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900 mb-1">Income Entry Created Automatically</p>
                  <p className="text-sm text-gray-600">The sales income entry will be automatically created in the Finance module and linked to the order</p>
                </div>
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-1" />
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-900 mb-1">Why This Workflow?</p>
                <p className="text-sm text-yellow-800">
                  Sales income must be linked to specific orders and customers for proper tracking, invoicing, and financial reporting. 
                  This ensures accurate order-to-payment reconciliation and maintains data integrity across Sales and Finance modules.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              <ArrowLeft className="w-5 h-5 inline mr-2" />
              Go Back
            </button>
            <button
              type="button"
              onClick={() => {
                // Change income type back to service so user can continue
                setFormData(prev => ({ ...prev, incomeType: 'service' }));
                setSalesTypeError(null);
              }}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Continue with Service Income
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6" style={{ pointerEvents: saving ? 'none' : 'auto', opacity: saving ? 0.7 : 1 }}>
          {entry?.fromSalesPayment && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm font-medium text-red-900">
                This form is read-only. Sales order payment entries cannot be edited from the Finance module.
              </p>
            </div>
          )}
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
              disabled={isReadOnly || isSalesTypeBlocked}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder="Enter amount"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason / Description *
            </label>
            <input
              type="text"
              name="reason"
              value={formData.reason}
              onChange={handleChange}
              required
              disabled={isReadOnly || isSalesTypeBlocked}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder="Enter reason for income"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Source *
            </label>
            <input
              type="text"
              name="source"
              value={formData.source}
              onChange={handleChange}
              required
              disabled={isReadOnly || isSalesTypeBlocked}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder="Customer, Client, etc."
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
              disabled={isReadOnly || isSalesTypeBlocked}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder="Bank transaction reference"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Evidence (Image/PDF)
            </label>
            <label
              className={`flex items-center justify-between px-4 py-3 border-2 border-dashed rounded-lg transition-colors ${
                isReadOnly || isSalesTypeBlocked
                  ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
                  : 'border-gray-300 cursor-pointer hover:border-blue-400 hover:bg-blue-50/50'
              }`}
            >
              <span className="text-sm text-gray-700">
                {evidenceFile ? evidenceFile.name : 'Upload payment proof'}
              </span>
              <span className="text-xs text-gray-500">PNG/JPG/PDF</span>
              <input
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                disabled={isReadOnly || isSalesTypeBlocked}
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
              disabled={isReadOnly || isSalesTypeBlocked}
              className="w-full min-w-0 px-3 py-2.5 text-sm sm:text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
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
              disabled={isReadOnly || isSalesTypeBlocked}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
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
              disabled={isReadOnly || isSalesTypeBlocked}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
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
              Payment To *
            </label>
            <select
              name="paymentTo"
              value={formData.paymentTo}
              onChange={handleChange}
              required
              disabled={isReadOnly || isSalesTypeBlocked}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                disabled={isReadOnly || isSalesTypeBlocked}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
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
              disabled={isReadOnly || isSalesTypeBlocked}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              placeholder="Any additional details about this income"
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
            disabled={isReadOnly || isSalesTypeBlocked || saving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {saving ? 'Saving...' : isReadOnly ? 'Read Only (Sales Entry)' : isSalesTypeBlocked ? 'Cannot Create Sales Entry Here' : entry ? 'Update' : 'Create'} Income Entry
          </button>
        </div>
      </form>
      )}
    </div>
  );
}
