import { useEffect, useState } from 'react';
import { ArrowLeft, Edit2, Package, Calendar, User, DollarSign, Truck, AlertCircle, History, Plus, CreditCard, FileText } from 'lucide-react';
import { fetchOrderWithPayments, recordDelivery, fetchItemDeliveryHistory, createPayment, deletePayment } from '../lib/sales';
import { PaymentForm } from '../components/PaymentForm';
import { InvoiceGenerator } from '../components/InvoiceGenerator';
import { useAuth } from '../contexts/AuthContext';
import type { OrderWithPaymentInfo, OrderStatus, DeliveryDispatch, PaymentFormData } from '../types/sales';
import type { AccessLevel } from '../types/access';

interface OrderDetailProps {
  orderId: string;
  onBack: () => void;
  accessLevel: AccessLevel;
}

export function OrderDetail({ orderId, onBack, accessLevel }: OrderDetailProps) {
  const { user } = useAuth();
  const [order, setOrder] = useState<OrderWithPaymentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingDelivery, setUpdatingDelivery] = useState<string | null>(null);
  const [deliveryHistory, setDeliveryHistory] = useState<Record<string, DeliveryDispatch[]>>({});
  const [loadingHistory, setLoadingHistory] = useState<Record<string, boolean>>({});
  const [isPaymentFormOpen, setIsPaymentFormOpen] = useState(false);
  const [isInvoiceGeneratorOpen, setIsInvoiceGeneratorOpen] = useState(false);
  const hasWriteAccess = accessLevel === 'read-write';

  useEffect(() => {
    void loadOrder();
  }, [orderId]);

  const loadOrder = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchOrderWithPayments(orderId);
      if (!data) {
        setError('Order not found');
        return;
      }
      setOrder(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load order';
      setError(message);
    } finally {
      setLoading(false);
    }
  };


  const handleDeliveryUpdate = async (itemId: string, quantityDelivered: number) => {
    if (!order) return;
    setUpdatingDelivery(itemId);
    try {
      // Use the recordDelivery function which validates inventory and triggers reduction
      await recordDelivery(itemId, quantityDelivered, {
        currentUserId: user?.id,
      });

      // Reload order to get updated status and inventory
      await loadOrder();
      
      // Reload delivery history for this item
      await loadItemDeliveryHistory(itemId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update delivery';
      setError(message);
    } finally {
      setUpdatingDelivery(null);
    }
  };

  const loadItemDeliveryHistory = async (itemId: string) => {
    setLoadingHistory((prev) => ({ ...prev, [itemId]: true }));
    try {
      const history = await fetchItemDeliveryHistory(itemId);
      setDeliveryHistory((prev) => ({ ...prev, [itemId]: history }));
    } catch (err) {
      console.error('Failed to load delivery history:', err);
    } finally {
      setLoadingHistory((prev) => ({ ...prev, [itemId]: false }));
    }
  };

  const toggleDeliveryHistory = (itemId: string) => {
    if (deliveryHistory[itemId]) {
      // History already loaded, just toggle visibility
      return;
    }
    // Load history
    void loadItemDeliveryHistory(itemId);
  };

  const handleCreatePayment = async (paymentData: PaymentFormData) => {
    await createPayment(paymentData, { currentUserId: user?.id });
    await loadOrder();
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!confirm('Are you sure you want to delete this payment? This will also remove the associated Income entry.')) {
      return;
    }
    try {
      await deletePayment(paymentId);
      await loadOrder();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete payment';
      setError(message);
    }
  };

  const getPaymentStatusColor = (status?: string) => {
    switch (status) {
      case 'Paid':
        return 'bg-green-100 text-green-700';
      case 'Partial':
        return 'bg-yellow-100 text-yellow-700';
      case 'Pending':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case 'Draft':
        return 'bg-gray-100 text-gray-700';
      case 'Confirmed':
        return 'bg-blue-100 text-blue-700';
      case 'Partially Delivered':
        return 'bg-yellow-100 text-yellow-700';
      case 'Fully Delivered':
        return 'bg-green-100 text-green-700';
      case 'Cancelled':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Orders</span>
        </button>
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-600">Loading order...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="space-y-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Orders</span>
        </button>
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <p className="text-gray-600">{error || 'Order not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Orders</span>
        </button>
      </div>

      {/* Order Header Card */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{order.order_number}</h2>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {new Date(order.order_date).toLocaleDateString('en-IN', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </div>
              <div className="flex items-center gap-2">
                <User className="w-4 h-4" />
                {order.customer?.name || order.customer_name || 'N/A'}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center justify-end gap-2 mb-2">
              <span
                className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(order.status)}`}
              >
                {order.status}
              </span>
              <span
                className={`px-3 py-1 text-sm font-medium rounded-full ${
                  order.is_locked ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                }`}
              >
                {order.is_locked ? 'Locked' : 'Draft'}
              </span>
            </div>
            <div className="mt-2 text-2xl font-bold text-gray-900">
              ₹{order.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
          {hasWriteAccess && !order.is_locked && order.status !== 'Cancelled' && (
            <button
              onClick={() => setIsPaymentFormOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Record Payment
            </button>
          )}
          {hasWriteAccess && (
            <button
              onClick={() => setIsInvoiceGeneratorOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <FileText className="w-4 h-4" />
              Generate Invoice
            </button>
          )}
        </div>

        {order.notes && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              <span className="font-medium">Notes:</span> {order.notes}
            </p>
          </div>
        )}
      </div>

      {/* Order Items */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Package className="w-5 h-5" />
          Order Items ({order.items.length})
        </h3>

        {order.items.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No items in this order.</div>
        ) : (
          <div className="space-y-4">
            {order.items.map((item) => {
              const deliveryProgress = (item.quantity_delivered / item.quantity) * 100;
              const isFullyDelivered = item.quantity_delivered >= item.quantity;
              const remaining = item.quantity - item.quantity_delivered;

              return (
                <div
                  key={item.id}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 mb-1">{item.product_type}</h4>
                      <div className="flex flex-wrap gap-2 text-sm text-gray-600">
                        {item.form && <span>Form: {item.form}</span>}
                        {item.size && <span>Size: {item.size}</span>}
                        {item.processed_good_batch_reference && (
                          <span>Batch: {item.processed_good_batch_reference}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-gray-900">
                        ₹{item.line_total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="text-sm text-gray-600">
                        ₹{item.unit_price.toFixed(2)} × {item.quantity} {item.unit}
                      </div>
                    </div>
                  </div>

                  {/* Delivery Tracking */}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Delivery Progress</span>
                      <span className="text-sm text-gray-600">
                        {item.quantity_delivered} / {item.quantity} {item.unit}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          isFullyDelivered ? 'bg-green-600' : 'bg-blue-600'
                        }`}
                        style={{ width: `${Math.min(100, deliveryProgress)}%` }}
                      />
                    </div>

                    {hasWriteAccess &&
                      !order.is_locked &&
                      order.status !== 'Cancelled' &&
                      order.status !== 'Fully Delivered' &&
                      !isFullyDelivered && (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            max={item.quantity}
                            step="0.01"
                            defaultValue={item.quantity_delivered}
                            onBlur={(e) => {
                              const newValue = parseFloat(e.target.value) || 0;
                              if (newValue !== item.quantity_delivered && newValue >= 0 && newValue <= item.quantity) {
                                void handleDeliveryUpdate(item.id, newValue);
                              }
                            }}
                            disabled={updatingDelivery === item.id}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm disabled:bg-gray-100"
                            placeholder="Enter delivered quantity"
                          />
                          <span className="text-sm text-gray-600">{item.unit}</span>
                          {remaining > 0 && (
                            <span className="text-xs text-gray-500">({remaining} remaining)</span>
                          )}
                        </div>
                      )}

                    {isFullyDelivered && (
                      <div className="flex items-center gap-2 text-sm text-green-600">
                        <Truck className="w-4 h-4" />
                        Fully delivered
                      </div>
                    )}

                    {/* Delivery History */}
                    {item.quantity_delivered > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <button
                          onClick={() => toggleDeliveryHistory(item.id)}
                          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                        >
                          <History className="w-4 h-4" />
                          <span>Delivery History</span>
                          {loadingHistory[item.id] && (
                            <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                          )}
                        </button>
                        {deliveryHistory[item.id] && deliveryHistory[item.id].length > 0 && (
                          <div className="mt-3 space-y-2">
                            {deliveryHistory[item.id].map((dispatch) => (
                              <div
                                key={dispatch.id}
                                className="bg-gray-50 rounded-lg p-3 text-sm border border-gray-200"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Truck className="w-4 h-4 text-gray-400" />
                                    <span className="font-medium text-gray-900">
                                      {dispatch.quantity_delivered} {item.unit}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 text-gray-600">
                                    <Calendar className="w-3 h-3" />
                                    {new Date(dispatch.delivery_date).toLocaleDateString('en-IN', {
                                      year: 'numeric',
                                      month: 'short',
                                      day: 'numeric',
                                    })}
                                  </div>
                                </div>
                                {dispatch.notes && (
                                  <p className="mt-2 text-gray-600 text-xs">{dispatch.notes}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        {deliveryHistory[item.id] && deliveryHistory[item.id].length === 0 && (
                          <p className="mt-2 text-sm text-gray-500">No delivery history available</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Payment Tracking */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Payments
          </h3>
          {hasWriteAccess && !order.is_locked && order.status !== 'Cancelled' && (
            <button
              onClick={() => setIsPaymentFormOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Record Payment
            </button>
          )}
        </div>

        {/* Payment Status Summary */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-500">Order Total</label>
              <p className="text-lg font-bold text-gray-900">
                ₹{order.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Total Paid</label>
              <p className="text-lg font-bold text-gray-900">
                ₹{(order.total_paid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500">Payment Status</label>
              <p className="mt-1">
                <span
                  className={`px-3 py-1 text-sm font-medium rounded-full ${getPaymentStatusColor(order.payment_status)}`}
                >
                  {order.payment_status || 'Pending'}
                </span>
              </p>
            </div>
          </div>
          {order.total_paid && order.total_paid < order.total_amount && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                Outstanding: ₹
                {(order.total_amount - order.total_paid).toLocaleString('en-IN', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
          )}
        </div>

        {/* Payments List */}
        {!order.payments || order.payments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p>No payments recorded yet.</p>
            {hasWriteAccess && order.status !== 'Cancelled' && (
              <p className="text-sm mt-2">Click "Record Payment" to add a payment.</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {order.payments.map((payment) => (
              <div
                key={payment.id}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-medium text-gray-900">
                        ₹{payment.amount_received.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                        {payment.payment_mode}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(payment.payment_date).toLocaleDateString('en-IN', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </div>
                      {payment.transaction_reference && (
                        <div>
                          <span className="font-medium">Ref:</span> {payment.transaction_reference}
                        </div>
                      )}
                      {payment.evidence_url && (
                        <a
                          href={payment.evidence_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-700"
                        >
                          View Evidence
                        </a>
                      )}
                    </div>
                    {payment.notes && (
                      <p className="mt-2 text-sm text-gray-600">{payment.notes}</p>
                    )}
                  </div>
                  {hasWriteAccess && (
                    <button
                      onClick={() => handleDeletePayment(payment.id)}
                      className="p-2 hover:bg-red-100 rounded-lg transition-colors text-red-600"
                      title="Delete payment"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Inventory Information */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-medium text-blue-900 mb-1">Inventory Management</h4>
            <p className="text-sm text-blue-700 mb-2">
              {order.status === 'Cancelled' ? (
                <>
                  This order is cancelled. Reserved inventory has been released. Delivered items' inventory was already
                  reduced and will not be restored.
                </>
              ) : order.status === 'Fully Delivered' ? (
                <>
                  All items have been delivered. Inventory has been reduced for all delivered quantities. Reserved
                  quantities have been released.
                </>
              ) : (
                <>
                  <strong>Reservation:</strong> This order has reserved inventory from processed goods. Reserved
                  quantities are not physically deducted and remain available for other orders.
                  <br />
                  <strong>Delivery:</strong> Inventory is reduced ONLY when delivery is recorded. Each delivery reduces
                  the processed goods inventory by the delivered quantity. Undelivered quantities remain available.
                </>
              )}
            </p>
            <div className="mt-2 text-xs text-blue-600">
              <strong>Rule:</strong> Inventory reduction happens only on delivery, never on order creation or invoice
              generation.
            </div>
          </div>
        </div>
      </div>

      <PaymentForm
        isOpen={isPaymentFormOpen}
        onClose={() => setIsPaymentFormOpen(false)}
        onSubmit={handleCreatePayment}
        defaultOrderId={order.id}
      />

      <InvoiceGenerator
        isOpen={isInvoiceGeneratorOpen}
        onClose={() => setIsInvoiceGeneratorOpen(false)}
        orderId={order.id}
        hasWriteAccess={hasWriteAccess}
      />
    </div>
  );
}
