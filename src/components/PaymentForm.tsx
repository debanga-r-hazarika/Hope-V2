import { useState, useEffect } from 'react';
import { X, IndianRupee, Upload, AlertCircle } from 'lucide-react';
import type { OrderPayment, PaymentFormData, Order } from '../types/sales';
import type { PaymentMethod, PaymentTo } from '../types/finance';
import { fetchOrders, fetchOrderPayments } from '../lib/sales';
import { uploadEvidence } from '../lib/finance';
import { supabase } from '../lib/supabase';

interface PaymentFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (paymentData: PaymentFormData, evidenceFile?: File | null) => Promise<void>;
  payment?: OrderPayment | null;
  defaultOrderId?: string;
}

// Helper function to map PaymentMode (DB) to PaymentMethod (UI)
function mapPaymentModeToMethod(mode: string): PaymentMethod {
  switch (mode) {
    case 'Cash':
      return 'cash';
    case 'UPI':
      return 'upi';
    case 'Bank':
      return 'bank_transfer';
    default:
      return 'cash';
  }
}

// Helper function to map PaymentMethod (UI) to PaymentMode (DB)
function mapPaymentMethodToMode(method: PaymentMethod): 'Cash' | 'UPI' | 'Bank' {
  switch (method) {
    case 'cash':
      return 'Cash';
    case 'upi':
      return 'UPI';
    case 'bank_transfer':
      return 'Bank';
    case 'cheque':
      return 'Bank'; // Map cheque to Bank
    case 'card':
      return 'Bank'; // Map card to Bank
    default:
      return 'Cash';
  }
}

// Helper to get initial date/time
const getInitialDateTime = (value?: string) => {
  const d = value ? new Date(value) : new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return { date, time };
};

export function PaymentForm({ isOpen, onClose, onSubmit, payment, defaultOrderId }: PaymentFormProps) {
  const [users, setUsers] = useState<Array<{ id: string; full_name: string }>>([]);
  const [userFetchError, setUserFetchError] = useState<string | null>(null);
  
  const { date: initialDateOnly, time: initialTime } = getInitialDateTime(payment?.payment_date);
  
  const [formData, setFormData] = useState<PaymentFormData>({
    order_id: defaultOrderId || '',
    payment_date: initialDateOnly,
    payment_time: initialTime,
    payment_method: payment ? mapPaymentModeToMethod(payment.payment_mode) : 'cash',
    payment_to: 'organization_bank',
    paid_to_user: '',
    payment_reference: payment?.transaction_reference || '',
    evidence_url: payment?.evidence_url || '',
    amount_received: payment?.amount_received || 0,
    notes: payment?.notes || '',
  });
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const [existingPayments, setExistingPayments] = useState<OrderPayment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);

  useEffect(() => {
    if (isOpen) {
      void loadOrders();
      void loadUsers();
      
      if (payment) {
        const { date, time } = getInitialDateTime(payment.payment_date);
        setFormData({
          order_id: payment.order_id,
          payment_date: date,
          payment_time: time,
          payment_method: mapPaymentModeToMethod(payment.payment_mode),
          payment_to: 'organization_bank', // Default, can be updated if we store this
          paid_to_user: '',
          payment_reference: payment.transaction_reference || '',
          evidence_url: payment.evidence_url || '',
          amount_received: payment.amount_received,
          notes: payment.notes || '',
        });
      } else {
        const { date, time } = getInitialDateTime();
        setFormData({
          order_id: defaultOrderId || '',
          payment_date: date,
          payment_time: time,
          payment_method: 'cash',
          payment_to: 'organization_bank',
          paid_to_user: '',
          payment_reference: '',
          evidence_url: '',
          amount_received: 0,
          notes: '',
        });
      }
      setEvidenceFile(null);
      setError(null);
    }
  }, [isOpen, payment, defaultOrderId]);

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

  const loadOrders = async () => {
    setLoadingOrders(true);
    try {
      const data = await fetchOrders();
      // Filter out cancelled orders
      setOrders(data.filter((o) => o.status !== 'CANCELLED'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load orders');
    } finally {
      setLoadingOrders(false);
    }
  };

  const loadPaymentsForOrder = async (orderId: string) => {
    if (!orderId) {
      setExistingPayments([]);
      return;
    }
    
    setLoadingPayments(true);
    try {
      const payments = await fetchOrderPayments(orderId);
      // Exclude current payment if editing
      const filteredPayments = payment 
        ? payments.filter((p) => p.id !== payment.id)
        : payments;
      setExistingPayments(filteredPayments);
    } catch (err) {
      console.error('Failed to load payments:', err);
      setExistingPayments([]);
    } finally {
      setLoadingPayments(false);
    }
  };

  useEffect(() => {
    if (formData.order_id) {
      void loadPaymentsForOrder(formData.order_id);
    } else {
      setExistingPayments([]);
    }
  }, [formData.order_id, payment?.id]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    
    setFormData((prev) => {
      const updated = {
        ...prev,
        [name]: name === 'amount_received' ? parseFloat(value) || 0 : value,
      };
      
      // If order changed, reload payments
      if (name === 'order_id' && value !== prev.order_id) {
        void loadPaymentsForOrder(value);
      }
      
      // Clear paid_to_user when payment_to changes to organization_bank
      if (name === 'payment_to' && value === 'organization_bank') {
        updated.paid_to_user = '';
      }
      
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    // Validate form
    if (!formData.order_id) {
      setError('Please select an order');
      setSubmitting(false);
      return;
    }

    if (!formData.amount_received || formData.amount_received <= 0) {
      setError('Please enter a valid payment amount');
      setSubmitting(false);
      return;
    }

    // Validate amount doesn't exceed remaining amount
    if (formData.amount_received > maxAmount) {
      setError(`Payment amount cannot exceed remaining amount of ₹${maxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      setSubmitting(false);
      return;
    }

    // Validate paid_to_user if payment_to is other_bank_account
    if (formData.payment_to === 'other_bank_account' && !formData.paid_to_user) {
      setError('Please select a user when payment is to other bank account');
      setSubmitting(false);
      return;
    }

    try {
      let evidenceUrl = formData.evidence_url;
      
      // Upload evidence file if provided
      if (evidenceFile) {
        setUploadingEvidence(true);
        try {
          evidenceUrl = await uploadEvidence(evidenceFile, 'income');
        } catch (uploadError) {
          throw new Error(`Failed to upload evidence: ${uploadError instanceof Error ? uploadError.message : 'Unknown error'}`);
        } finally {
          setUploadingEvidence(false);
        }
      }

      // Combine date and time into ISO string for payment_date
      const combinedDate = new Date(`${formData.payment_date}T${formData.payment_time || '00:00'}`).toISOString();
      
      // Convert PaymentMethod to PaymentMode for database
      const paymentMode = mapPaymentMethodToMode(formData.payment_method);
      
      // Prepare data for submission (map to DB format)
      const submitData: PaymentFormData = {
        ...formData,
        payment_date: combinedDate,
        payment_reference: formData.payment_reference || undefined,
        evidence_url: evidenceUrl || undefined,
      };

      await onSubmit(submitData, evidenceFile);
      
      if (!payment) {
        const { date, time } = getInitialDateTime();
        setFormData({
          order_id: defaultOrderId || '',
          payment_date: date,
          payment_time: time,
          payment_method: 'cash',
          payment_to: 'organization_bank',
          paid_to_user: '',
          payment_reference: '',
          evidence_url: '',
          amount_received: 0,
          notes: '',
        });
      }
      setEvidenceFile(null);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save payment';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedOrder = orders.find((o) => o.id === formData.order_id);
  const totalPaid = existingPayments.reduce((sum, p) => sum + p.amount_received, 0);
  const orderTotal = selectedOrder?.total_amount || 0;
  const discountAmount = selectedOrder?.discount_amount || 0;
  const netTotal = orderTotal - discountAmount; // Net total after discount
  const remainingAmount = Math.max(0, netTotal - totalPaid);
  const maxAmount = payment
    ? remainingAmount + payment.amount_received
    : remainingAmount;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <IndianRupee className="w-5 h-5 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">
              {payment ? 'Edit Payment' : 'Record Payment'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-start gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="flex-1">{error}</div>
            </div>
          )}

          {userFetchError && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700 text-sm">
              Could not load users: {userFetchError}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Order *
              </label>
              <select
                name="order_id"
                value={formData.order_id}
                onChange={handleChange}
                required
                disabled={loadingOrders || !!defaultOrderId}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100"
              >
                <option value="">Select order</option>
                {orders.map((order) => {
                  const netTotal = order.total_amount - (order.discount_amount || 0);
                  return (
                    <option key={order.id} value={order.id}>
                      {order.order_number} - {order.customer_name || 'N/A'} (₹{netTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                    </option>
                  );
                })}
              </select>
              {selectedOrder && (
                <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-gray-500">Amount Due:</span>
                      <p className="font-semibold text-gray-900">
                        ₹{netTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">Already Paid:</span>
                      <p className="font-semibold text-gray-900">
                        ₹{totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">Remaining:</span>
                      <p className={`font-semibold ${remainingAmount > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                        ₹{remainingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount Received (₹) *
              </label>
              <input
                type="number"
                name="amount_received"
                value={formData.amount_received}
                onChange={handleChange}
                required
                min="0.01"
                max={maxAmount}
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="0.00"
              />
              {selectedOrder && (
                <p className="mt-1 text-xs text-gray-600">
                  Maximum: ₹{maxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  {remainingAmount === 0 && (
                    <span className="ml-2 text-green-600 font-medium">(Order fully paid)</span>
                  )}
                </p>
              )}
              {selectedOrder && formData.amount_received > maxAmount && (
                <p className="mt-1 text-xs text-red-600">
                  Amount exceeds remaining payable amount
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Date *
                </label>
                <input
                  type="date"
                  name="payment_date"
                  value={formData.payment_date}
                  onChange={handleChange}
                  required
                  className="w-full min-w-0 px-3 py-2.5 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Time *
                </label>
                <input
                  type="time"
                  name="payment_time"
                  value={formData.payment_time}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Method *
                </label>
                <select
                  name="payment_method"
                  value={formData.payment_method}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cheque">Cheque</option>
                  <option value="card">Card</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment To *
                </label>
                <select
                  name="payment_to"
                  value={formData.payment_to}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  <option value="organization_bank">Organization Bank</option>
                  <option value="other_bank_account">Other Bank Account</option>
                </select>
              </div>
            </div>

            {formData.payment_to === 'other_bank_account' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Paid To User *
                </label>
                <select
                  name="paid_to_user"
                  value={formData.paid_to_user}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  <option value="">Select user</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Reference No.
              </label>
              <input
                type="text"
                name="payment_reference"
                value={formData.payment_reference}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="Enter payment reference (if applicable)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Evidence (Receipt/Proof)
              </label>
              <label className="flex items-center justify-between px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-green-400 hover:bg-green-50/50 transition-colors">
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
              {formData.evidence_url && !evidenceFile && (
                <p className="mt-2 text-xs text-blue-600 truncate">
                  Existing: <a href={formData.evidence_url} target="_blank" rel="noreferrer" className="underline">View</a>
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="Additional notes about the payment"
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-700">
                <strong>Note:</strong> This payment will automatically create an Income entry in the Finance module
                with all relevant details including order reference and customer information.
              </p>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              disabled={submitting || uploadingEvidence}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={submitting || uploadingEvidence}
            >
              {uploadingEvidence
                ? 'Uploading...'
                : submitting
                  ? 'Saving...'
                  : payment
                    ? 'Update Payment'
                    : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
