import { useEffect, useState } from 'react';
import { ArrowLeft, Save, AlertCircle, ShoppingCart, FileText, ArrowRight, CheckCircle2, Loader2, Calendar, CreditCard, User, AlignLeft, Paperclip } from 'lucide-react';
import { IncomeEntry, PaymentMethod, PaymentTo } from '../types/finance';
import { supabase } from '../lib/supabase';
import { ModernButton } from './ui/ModernButton';
import { ModernCard } from './ui/ModernCard';

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
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
          {entry ? 'Edit Income' : 'Add New Income'}
        </h1>
        <p className="mt-2 text-gray-500">
          Fill in the details below to {entry ? 'update' : 'create'} an income entry
        </p>
        {saveSuccess && (
          <div className="mt-4 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2 shadow-sm">
            <CheckCircle2 className="w-5 h-5" />
            {saveSuccess}
          </div>
        )}
        {entry?.fromSalesPayment && (
          <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl shadow-sm">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-amber-900 mb-1">
                  Sales Order Linked Entry
                </p>
                <p className="text-sm text-amber-800 leading-relaxed">
                  This entry is automatically managed by the Sales module. Please find Order{' '}
                  <span className="font-mono font-medium bg-amber-100 px-1 rounded">{entry.orderNumber || entry.orderId || 'the order'}</span> and edit the payment there.
                </p>
              </div>
            </div>
          </div>
        )}
        {userFetchError && (
          <p className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded-lg border border-red-100">
            Could not load users: {userFetchError}
          </p>
        )}
      </div>

      {/* Income Type Selector */}
      <ModernCard padding="lg" className="border-l-4 border-l-primary">
        <label className="block text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">
          Income Type *
        </label>
        <select
          name="incomeType"
          value={formData.incomeType}
          onChange={handleChange}
          required
          disabled={isReadOnly}
          className={`w-full px-4 py-3 bg-gray-50 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:bg-gray-100 disabled:cursor-not-allowed text-base font-medium transition-all ${
            salesTypeError ? 'border-red-300 bg-red-50 focus:border-red-500 focus:ring-red-200' : 'border-gray-200'
          }`}
        >
          <option value="sales">Sales</option>
          <option value="service">Service</option>
          <option value="interest">Interest</option>
          <option value="other">Other</option>
        </select>
        {salesTypeError && !isSalesTypeBlocked && (
          <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3 flex items-start gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {salesTypeError}
          </div>
        )}
      </ModernCard>

      {isSalesTypeBlocked ? (
        <ModernCard className="border-l-4 border-l-red-500 bg-gradient-to-br from-red-50 via-white to-red-50">
          <div className="flex items-start gap-5 mb-8">
            <div className="flex-shrink-0 w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center shadow-inner">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Sales Income Restricted
              </h2>
              <p className="text-gray-600 text-lg leading-relaxed">
                To maintain data integrity, sales income must be recorded through the Sales module workflow.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-red-100 p-6 mb-8 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2 border-b border-gray-100 pb-4">
              <FileText className="w-5 h-5 text-primary" />
              Correct Workflow
            </h3>
            <div className="space-y-6 relative">
              {/* Connecting Line */}
              <div className="absolute left-[19px] top-8 bottom-8 w-0.5 bg-gray-200 z-0"></div>

              <div className="flex items-start gap-4 relative z-10">
                <div className="flex-shrink-0 w-10 h-10 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold shadow-sm border-2 border-white">
                  1
                </div>
                <div className="flex-1 bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <div className="flex items-center gap-2 mb-1">
                    <ShoppingCart className="w-4 h-4 text-blue-600" />
                    <p className="font-bold text-gray-900">Go to Sales Module</p>
                  </div>
                  <p className="text-sm text-gray-600">Navigate to the Sales section from the main menu.</p>
                </div>
              </div>

              <div className="flex items-start gap-4 relative z-10">
                <div className="flex-shrink-0 w-10 h-10 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center font-bold shadow-sm border-2 border-white">
                  2
                </div>
                <div className="flex-1 bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="w-4 h-4 text-purple-600" />
                    <p className="font-bold text-gray-900">Manage Order</p>
                  </div>
                  <p className="text-sm text-gray-600">Select an existing order or create a new one.</p>
                </div>
              </div>

              <div className="flex items-start gap-4 relative z-10">
                <div className="flex-shrink-0 w-10 h-10 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center font-bold shadow-sm border-2 border-white">
                  3
                </div>
                <div className="flex-1 bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <div className="flex items-center gap-2 mb-1">
                    <CreditCard className="w-4 h-4 text-emerald-600" />
                    <p className="font-bold text-gray-900">Record Payment</p>
                  </div>
                  <p className="text-sm text-gray-600">Use the "Add Payment" feature within the order. This automatically creates the income entry.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <ModernButton
              onClick={onCancel}
              variant="outline"
              size="lg"
              className="flex-1"
            >
              Go Back
            </ModernButton>
            <ModernButton
              onClick={() => {
                setFormData(prev => ({ ...prev, incomeType: 'service' }));
                setSalesTypeError(null);
              }}
              variant="primary"
              size="lg"
              className="flex-1"
            >
              Change to Service Income
            </ModernButton>
          </div>
        </ModernCard>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <ModernCard padding="lg">
            {entry?.fromSalesPayment && (
              <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-800">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm font-medium">
                  Read Only Mode: Sales order payments must be managed in the Sales module.
                </p>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Amount */}
              <div className="col-span-1">
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Amount (INR) *
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-3.5 text-gray-400 font-bold">₹</span>
                  <input
                    type="number"
                    name="amount"
                    value={formData.amount}
                    onChange={handleChange}
                    required
                    min="0"
                    step="0.01"
                    disabled={isReadOnly || isSalesTypeBlocked}
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-mono text-lg font-medium disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Reason */}
              <div className="col-span-1 md:col-span-2">
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Reason / Description *
                </label>
                <div className="relative">
                  <AlignLeft className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    name="reason"
                    value={formData.reason}
                    onChange={handleChange}
                    required
                    disabled={isReadOnly || isSalesTypeBlocked}
                    className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="E.g. Monthly Service Retainer"
                  />
                </div>
              </div>

              {/* Source */}
              <div className="col-span-1">
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Source / Payer *
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    name="source"
                    value={formData.source}
                    onChange={handleChange}
                    required
                    disabled={isReadOnly || isSalesTypeBlocked}
                    className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="Client Name or Company"
                  />
                </div>
              </div>

              {/* Reference */}
              <div className="col-span-1">
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Payment Reference No.
                </label>
                <input
                  type="text"
                  name="bankReference"
                  value={formData.bankReference}
                  onChange={handleChange}
                  disabled={isReadOnly || isSalesTypeBlocked}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-mono text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="UTR / Cheque No."
                />
              </div>

              {/* Date & Time */}
              <div className="col-span-1">
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Payment Date *
                </label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                  <input
                    type="date"
                    name="paymentDate"
                    value={formData.paymentDate}
                    onChange={handleChange}
                    required
                    disabled={isReadOnly || isSalesTypeBlocked}
                    className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                </div>
              </div>
              <div className="col-span-1">
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Payment Time *
                </label>
                <input
                  type="time"
                  name="paymentTime"
                  value={formData.paymentTime}
                  onChange={handleChange}
                  required
                  disabled={isReadOnly || isSalesTypeBlocked}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              </div>

              {/* Payment Method */}
              <div className="col-span-1">
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Payment Method *
                </label>
                <div className="relative">
                  <CreditCard className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                  <select
                    name="paymentMethod"
                    value={formData.paymentMethod}
                    onChange={handleChange}
                    required
                    disabled={isReadOnly || isSalesTypeBlocked}
                    className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="upi">UPI</option>
                    <option value="cash">Cash</option>
                    <option value="cheque">Cheque</option>
                    <option value="card">Card</option>
                  </select>
                </div>
              </div>

              {/* Payment To */}
              <div className="col-span-1">
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Payment Destination *
                </label>
                <select
                  name="paymentTo"
                  value={formData.paymentTo}
                  onChange={handleChange}
                  required
                  disabled={isReadOnly || isSalesTypeBlocked}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="organization_bank">Organization Bank Account</option>
                  <option value="other_bank_account">Other / Individual Account</option>
                </select>
              </div>

              {/* Conditional User Select */}
              {formData.paymentTo === 'other_bank_account' && (
                <div className="col-span-1 md:col-span-2 bg-blue-50 p-6 rounded-xl border border-blue-100">
                  <label className="block text-sm font-bold text-blue-900 mb-2">
                    Select User Receiving Payment *
                  </label>
                  <select
                    name="paidToUser"
                    value={formData.paidToUser}
                    onChange={handleChange}
                    required
                    disabled={isReadOnly || isSalesTypeBlocked}
                    className="w-full px-4 py-3 bg-white border border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <option value="">Select a user...</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>{user.full_name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Evidence Upload */}
              <div className="col-span-1 md:col-span-2">
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Evidence Document
                </label>
                <div className={`border-2 border-dashed rounded-xl p-6 transition-all ${
                  isReadOnly || isSalesTypeBlocked
                    ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
                    : 'border-gray-300 hover:border-primary hover:bg-primary/5 cursor-pointer group'
                }`}>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    id="evidence-upload"
                    className="hidden"
                    disabled={isReadOnly || isSalesTypeBlocked}
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setEvidenceFile(file);
                    }}
                  />
                  <label htmlFor="evidence-upload" className={`flex flex-col items-center justify-center w-full h-full ${isReadOnly || isSalesTypeBlocked ? 'pointer-events-none' : 'cursor-pointer'}`}>
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3 group-hover:bg-white transition-colors shadow-sm">
                      <Paperclip className="w-6 h-6 text-gray-500 group-hover:text-primary" />
                    </div>
                    <p className="text-sm font-medium text-gray-900">
                      {evidenceFile ? evidenceFile.name : 'Click to upload or drag and drop'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      PDF, PNG, JPG (max 10MB)
                    </p>
                  </label>
                </div>
                {formData.evidenceUrl && !evidenceFile && (
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Current:</span>
                    <a 
                      href={formData.evidenceUrl} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="text-sm text-primary hover:text-primary-dark underline flex items-center gap-1 font-medium"
                    >
                      View Document <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="col-span-1 md:col-span-2">
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Additional Notes
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={3}
                  disabled={isReadOnly || isSalesTypeBlocked}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="Add any extra details here..."
                />
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col sm:flex-row gap-4">
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
                disabled={isReadOnly || isSalesTypeBlocked || saving}
                loading={saving}
                icon={saving ? undefined : <Save className="w-5 h-5" />}
              >
                {isReadOnly ? 'Read Only' : entry ? 'Update Entry' : 'Create Entry'}
              </ModernButton>
            </div>
          </ModernCard>
        </form>
      )}
    </div>
  );
}
