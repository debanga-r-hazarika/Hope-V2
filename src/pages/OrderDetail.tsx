import { useEffect, useState, useRef } from 'react';
import { ArrowLeft, Edit2, Package, Calendar, User, DollarSign, Truck, AlertCircle, History, Plus, CreditCard, FileText, Trash2, X, CheckCircle2, Clock, XCircle, TrendingUp, ChevronDown } from 'lucide-react';
import { fetchOrderWithPayments, recordDelivery, fetchItemDeliveryHistory, createPayment, deletePayment, addOrderItem, updateOrderItem, deleteOrderItem, fetchProcessedGoodsForOrder, updateOrderStatus } from '../lib/sales';
import { PaymentForm } from '../components/PaymentForm';
import { InvoiceGenerator } from '../components/InvoiceGenerator';
import { CelebrationModal } from '../components/CelebrationModal';
import { useAuth } from '../contexts/AuthContext';
import { fetchProducedGoodsUnits } from '../lib/units';
import type { OrderWithPaymentInfo, OrderStatus, PaymentStatus, DeliveryDispatch, PaymentFormData, OrderItemFormData, OrderItem } from '../types/sales';
import type { AccessLevel } from '../types/access';
import type { ProcessedGood } from '../types/operations';
import type { ProducedGoodsUnit } from '../types/units';

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
  const [isItemFormOpen, setIsItemFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<OrderItem | null>(null);
  const [processedGoods, setProcessedGoods] = useState<Array<ProcessedGood & { actual_available: number }>>([]);
  const [producedGoodsUnits, setProducedGoodsUnits] = useState<ProducedGoodsUnit[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  const [expandedPayments, setExpandedPayments] = useState<Set<string>>(new Set());
  const [deliveryInputs, setDeliveryInputs] = useState<Record<string, string>>({});
  const [showCelebration, setShowCelebration] = useState(false);
  const previousStatusRef = useRef<OrderStatus | null>(null);
  const hasWriteAccess = accessLevel === 'read-write';

  useEffect(() => {
    // Reset previous status when orderId changes
    previousStatusRef.current = null;
    void loadOrder();
    // Load processed goods to get actual available quantities
    void loadProducts();
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
      
      // Calculate actual payment status based on outstanding amount
      const totalPaid = data.total_paid || 0;
      const outstanding = data.total_amount - totalPaid;
      
      // If outstanding is 0 or negative, ensure payment_status is FULL_PAYMENT
      // This ensures the UI always shows correct status even if DB is slightly out of sync
      if (outstanding <= 0 && data.total_amount > 0) {
        data.payment_status = 'FULL_PAYMENT';
      } else if (outstanding > 0 && outstanding < data.total_amount) {
        data.payment_status = 'PARTIAL_PAYMENT';
      } else if (outstanding >= data.total_amount) {
        data.payment_status = 'READY_FOR_PAYMENT';
      }
      
      setOrder(data);
      
      // Check if status changed to ORDER_COMPLETED
      const previousStatus = previousStatusRef.current;
      if (previousStatus !== null && 
          previousStatus !== 'ORDER_COMPLETED' && 
          data.status === 'ORDER_COMPLETED') {
        // Status just changed to ORDER_COMPLETED - show celebration!
        setShowCelebration(true);
      }
      
      // Update previous status
      previousStatusRef.current = data.status;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load order';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeliveryUpdate = async (itemId: string, quantityDelivered: number) => {
    if (!order) return;
    
    // Find the item to validate
    const item = order.items.find(i => i.id === itemId);
    if (!item) return;
    
    // Validate delivery doesn't exceed order quantity
    if (quantityDelivered > item.quantity) {
      setError(`Delivery quantity (${quantityDelivered}) cannot exceed order quantity (${item.quantity} ${item.unit})`);
      return;
    }
    
    setUpdatingDelivery(itemId);
    try {
      await recordDelivery(itemId, quantityDelivered, {
        currentUserId: user?.id,
      });
      await loadOrder();
      await loadItemDeliveryHistory(itemId);
      
      // Check if order should be marked as completed
      // ORDER_COMPLETED status is automatically set by database trigger
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update delivery';
      setError(message);
    } finally {
      setUpdatingDelivery(null);
    }
  };

  const handleAddDelivery = async (itemId: string) => {
    if (!order) return;
    
    const item = order.items.find(i => i.id === itemId);
    if (!item) return;
    
    const inputValue = deliveryInputs[itemId] || '';
    const newDelivery = parseFloat(inputValue) || 0;
    const totalDelivery = item.quantity_delivered + newDelivery;
    
    if (newDelivery <= 0) {
      setError('Please enter a valid delivery quantity');
      return;
    }
    
    if (totalDelivery > item.quantity) {
      setError(`Total delivery (${totalDelivery}) cannot exceed order quantity (${item.quantity} ${item.unit})`);
      return;
    }
    
    setUpdatingDelivery(itemId);
    try {
      await recordDelivery(itemId, totalDelivery, {
        currentUserId: user?.id,
      });
      setDeliveryInputs(prev => {
        const newInputs = { ...prev };
        delete newInputs[itemId];
        return newInputs;
      });
      await loadOrder();
      await loadItemDeliveryHistory(itemId);
      // Reload processed goods to update actual available quantities after delivery
      await loadProducts();
      
      // Check if order should be marked as completed
      // ORDER_COMPLETED status is automatically set by database trigger
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add delivery';
      setError(message);
    } finally {
      setUpdatingDelivery(null);
    }
  };

  // Note: ORDER_COMPLETED status is now automatically set by database trigger
  // when DELIVERY_COMPLETED + FULL_PAYMENT conditions are met
  // No manual completion check needed

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
      return;
    }
    void loadItemDeliveryHistory(itemId);
  };

  const handleCreatePayment = async (paymentData: PaymentFormData) => {
    await createPayment(paymentData, { currentUserId: user?.id });
    await loadOrder();
    // Check if order should be marked as completed
    // ORDER_COMPLETED status is automatically set by database trigger
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

  const loadProducts = async (includeProductId?: string) => {
    setLoadingProducts(true);
    try {
      const [goods, units] = await Promise.all([
        fetchProcessedGoodsForOrder(includeProductId),
        fetchProducedGoodsUnits(false),
      ]);
      setProcessedGoods(goods);
      setProducedGoodsUnits(units);
    } catch (err) {
      console.error('Failed to load products:', err);
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleAddItem = async () => {
    setEditingItem(null);
    setIsItemFormOpen(true);
    await loadProducts();
  };

  const handleEditItem = async (item: OrderItem) => {
    setEditingItem(item);
    setIsItemFormOpen(true);
    await loadProducts(item.processed_good_id);
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!order) return;
    try {
      setError(null);
      await deleteOrderItem(order.id, itemId, { currentUserId: user?.id });
      await loadOrder();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete item';
      setError(message);
    }
  };

  const handleSaveItem = async (itemData: OrderItemFormData) => {
    if (!order) return;
    setSavingItem(true);
    setError(null);
    try {
      if (editingItem) {
        await updateOrderItem(order.id, editingItem.id, itemData, { currentUserId: user?.id });
      } else {
        await addOrderItem(order.id, itemData, { currentUserId: user?.id });
      }
      setIsItemFormOpen(false);
      setEditingItem(null);
      await loadOrder();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save item';
      setError(message);
    } finally {
      setSavingItem(false);
    }
  };

  const getPaymentStatusColor = (status?: PaymentStatus) => {
    switch (status) {
      case 'FULL_PAYMENT':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'PARTIAL_PAYMENT':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'READY_FOR_PAYMENT':
        return 'bg-gray-100 text-gray-700 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  // Helper function to get delivery status badge info
  const getDeliveryStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'DRAFT':
        return { label: 'Draft', className: 'bg-slate-100 text-slate-700 border border-slate-200', icon: <Clock className="w-4 h-4" /> };
      case 'READY_FOR_DELIVERY':
        return { label: 'Ready for Delivery', className: 'bg-blue-100 text-blue-700 border border-blue-200', icon: <CheckCircle2 className="w-4 h-4" /> };
      case 'PARTIALLY_DELIVERED':
        return { label: 'Partially Delivered', className: 'bg-amber-100 text-amber-700 border border-amber-200', icon: <TrendingUp className="w-4 h-4" /> };
      case 'DELIVERY_COMPLETED':
        return { label: 'Delivery Completed', className: 'bg-emerald-100 text-emerald-700 border border-emerald-200', icon: <CheckCircle2 className="w-4 h-4" /> };
      case 'ORDER_COMPLETED':
        return { label: 'Order Completed', className: 'bg-purple-100 text-purple-700 border border-purple-200', icon: <CheckCircle2 className="w-4 h-4" /> };
      case 'CANCELLED':
        return { label: 'Cancelled', className: 'bg-red-100 text-red-700 border border-red-200', icon: <XCircle className="w-4 h-4" /> };
      default:
        return { label: status, className: 'bg-slate-100 text-slate-700 border border-slate-200', icon: <Clock className="w-4 h-4" /> };
    }
  };

  // Helper function to get payment status badge info
  const getPaymentStatusBadge = (paymentStatus?: PaymentStatus) => {
    if (!paymentStatus) {
      return { label: 'Ready for Payment', className: 'bg-gray-100 text-gray-700 border border-gray-200' };
    }
    switch (paymentStatus) {
      case 'READY_FOR_PAYMENT':
        return { label: 'Ready for Payment', className: 'bg-gray-100 text-gray-700 border border-gray-200' };
      case 'PARTIAL_PAYMENT':
        return { label: 'Partial Payment', className: 'bg-yellow-100 text-yellow-700 border border-yellow-200' };
      case 'FULL_PAYMENT':
        return { label: 'Full Payment', className: 'bg-green-100 text-green-700 border border-green-200' };
      default:
        return { label: paymentStatus, className: 'bg-gray-100 text-gray-700 border border-gray-200' };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors mb-6 group"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="font-medium">Back to Orders</span>
          </button>
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="inline-block w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-gray-600 font-medium">Loading order details...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors mb-6 group"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="font-medium">Back to Orders</span>
          </button>
          <div className="bg-white rounded-2xl shadow-lg border border-red-200 p-8 sm:p-12 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <p className="text-lg font-semibold text-gray-900 mb-2">Error</p>
            <p className="text-gray-600">{error || 'Order not found'}</p>
          </div>
        </div>
      </div>
    );
  }

  const outstandingAmount = order.total_amount - (order.total_paid || 0);
  const paymentProgress = order.total_amount > 0 ? ((order.total_paid || 0) / order.total_amount) * 100 : 0;
  
  // Ensure payment_status is correct based on outstanding amount
  // If outstanding is 0, payment_status should be FULL_PAYMENT
  const actualPaymentStatus: PaymentStatus = outstandingAmount <= 0 && order.total_amount > 0
    ? 'FULL_PAYMENT'
    : outstandingAmount > 0 && outstandingAmount < order.total_amount
    ? 'PARTIAL_PAYMENT'
    : order.payment_status || 'READY_FOR_PAYMENT';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header Navigation */}
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors mb-6 group"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="font-medium">Back to Orders</span>
        </button>

        {/* Order Header Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden mb-6">
          {/* Header Section */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 sm:px-8 py-6 sm:py-8">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className="bg-white/20 backdrop-blur-sm rounded-lg p-2">
                    <Package className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">{order.order_number}</h1>
                    <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-sm text-blue-100">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4" />
                        <span>{new Date(order.order_date).toLocaleDateString('en-IN', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <User className="w-4 h-4" />
                        <span className="font-medium">{order.customer?.name || order.customer_name || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-col sm:items-end gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  {(() => {
                    const deliveryBadge = getDeliveryStatusBadge(order.status);
                    // Use actualPaymentStatus for badge display
                    const paymentBadge = getPaymentStatusBadge(actualPaymentStatus);
                    const showOnlyOneBadge = order.status === 'ORDER_COMPLETED';
                    
                    return (
                      <>
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg border ${deliveryBadge.className}`}>
                          {deliveryBadge.icon}
                          {deliveryBadge.label}
                        </span>
                        {!showOnlyOneBadge && order.status !== 'CANCELLED' && (
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg border ${paymentBadge.className}`}>
                            {paymentBadge.label}
                          </span>
                        )}
                        {order.is_locked && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg border bg-emerald-100 text-emerald-700 border-emerald-200">
                            <CheckCircle2 className="w-4 h-4" />
                            Locked
                          </span>
                        )}
                      </>
                    );
                  })()}
                </div>
                <div className="text-right">
                  <div className="text-xs font-medium text-blue-200 uppercase tracking-wide mb-1">Total Amount</div>
                  <div className="text-3xl sm:text-4xl font-bold text-white">
                    ₹{order.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="px-6 sm:px-8 py-4 sm:py-6 border-t border-gray-200 bg-gray-50">
            <div className="flex flex-wrap items-center gap-3">
              {hasWriteAccess && !order.is_locked && order.status !== 'Cancelled' && (
                <button
                  onClick={() => setIsPaymentFormOpen(true)}
                  className="inline-flex items-center gap-2 px-4 sm:px-6 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all shadow-sm hover:shadow-md font-medium text-sm sm:text-base"
                >
                  <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                  Record Payment
                </button>
              )}
              {hasWriteAccess && (
                <button
                  onClick={() => setIsInvoiceGeneratorOpen(true)}
                  className="inline-flex items-center gap-2 px-4 sm:px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-sm hover:shadow-md font-medium text-sm sm:text-base"
                >
                  <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
                  Generate Invoice
                </button>
              )}
            </div>
          </div>

          {/* Notes */}
          {order.notes && (
            <div className="px-6 sm:px-8 py-4 border-t border-gray-200 bg-amber-50/50">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-900 mb-1">Notes</p>
                  <p className="text-sm text-amber-800">{order.notes}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Payment Summary Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 sm:p-8 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
              <CreditCard className="w-6 h-6 text-blue-600" />
              Payment Summary
            </h2>
            {hasWriteAccess && !order.is_locked && order.status !== 'Cancelled' && (
              <button
                onClick={() => setIsPaymentFormOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all shadow-sm hover:shadow-md text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Record Payment</span>
              </button>
            )}
          </div>

          {/* Payment Progress */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Payment Progress</span>
              <span className="text-sm font-semibold text-gray-900">
                {paymentProgress.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  paymentProgress === 100 ? 'bg-emerald-600' : paymentProgress > 0 ? 'bg-amber-500' : 'bg-gray-400'
                }`}
                style={{ width: `${Math.min(100, paymentProgress)}%` }}
              />
            </div>
          </div>

          {/* Payment Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-6">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 sm:p-5 border border-blue-200">
              <div className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">Order Total</div>
              <div className="text-2xl sm:text-3xl font-bold text-blue-900">
                ₹{order.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-4 sm:p-5 border border-emerald-200">
              <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-1">Total Paid</div>
              <div className="text-2xl sm:text-3xl font-bold text-emerald-900">
                ₹{(order.total_paid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-4 sm:p-5 border border-amber-200">
              <div className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-1">Outstanding</div>
              <div className="text-2xl sm:text-3xl font-bold text-amber-900">
                ₹{outstandingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Payment Status */}
          <div className="flex items-center justify-center">
            <span className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border ${getPaymentStatusColor(actualPaymentStatus)}`}>
              {actualPaymentStatus === 'FULL_PAYMENT' && <CheckCircle2 className="w-4 h-4" />}
              {actualPaymentStatus === 'PARTIAL_PAYMENT' && <TrendingUp className="w-4 h-4" />}
              {actualPaymentStatus === 'READY_FOR_PAYMENT' && <Clock className="w-4 h-4" />}
              Payment Status: {getPaymentStatusBadge(actualPaymentStatus).label}
            </span>
          </div>

          {/* Payments List */}
          {order.payments && order.payments.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment History</h3>
              <div className="space-y-3">
                {order.payments.map((payment) => {
                  const isExpanded = expandedPayments.has(payment.id);
                  return (
                    <div
                      key={payment.id}
                      className="bg-gray-50 rounded-xl border border-gray-200 hover:border-gray-300 transition-all hover:shadow-sm overflow-hidden"
                    >
                      <div
                        className="p-4 sm:p-5 cursor-pointer"
                        onClick={() => {
                          setExpandedPayments(prev => {
                            const newSet = new Set(prev);
                            if (newSet.has(payment.id)) {
                              newSet.delete(payment.id);
                            } else {
                              newSet.add(payment.id);
                            }
                            return newSet;
                          });
                        }}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <div className="text-xl sm:text-2xl font-bold text-gray-900">
                                ₹{payment.amount_received.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
                              <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-100 text-blue-700 border border-blue-200">
                                {payment.payment_mode}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-sm text-gray-600">
                              <div className="flex items-center gap-1.5">
                                <Calendar className="w-4 h-4" />
                                {new Date(payment.payment_date).toLocaleDateString('en-IN', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </div>
                              {payment.transaction_reference && (
                                <div className="flex items-center gap-1.5">
                                  <span className="font-medium">Ref:</span>
                                  <span className="font-mono text-xs">{payment.transaction_reference}</span>
                                </div>
                              )}
                              {payment.evidence_url && (
                                <a
                                  href={payment.evidence_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                                >
                                  <FileText className="w-3 h-3" />
                                  View Evidence
                                </a>
                              )}
                            </div>
                            {!isExpanded && payment.notes && (
                              <p className="mt-2 text-sm text-gray-600 line-clamp-1">{payment.notes}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {hasWriteAccess && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeletePayment(payment.id);
                                }}
                                className="p-2 hover:bg-red-100 rounded-lg transition-colors text-red-600 flex-shrink-0"
                                title="Delete payment"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            )}
                            <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </div>
                        </div>
                      </div>
                      
                      {/* Expanded Payment Details */}
                      {isExpanded && (
                        <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-0 border-t border-gray-200 bg-white">
                          <div className="space-y-3 mt-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Payment Date</label>
                                <p className="text-sm font-medium text-gray-900 mt-1">
                                  {new Date(payment.payment_date).toLocaleDateString('en-IN', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                  })}
                                </p>
                              </div>
                              <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Payment Mode</label>
                                <p className="text-sm font-medium text-gray-900 mt-1">{payment.payment_mode}</p>
                              </div>
                              {payment.transaction_reference && (
                                <div>
                                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Transaction Reference</label>
                                  <p className="text-sm font-medium text-gray-900 mt-1 font-mono">{payment.transaction_reference}</p>
                                </div>
                              )}
                              <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</label>
                                <p className="text-lg font-bold text-gray-900 mt-1">
                                  ₹{payment.amount_received.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </p>
                              </div>
                            </div>
                            {payment.notes && (
                              <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Notes</label>
                                <p className="text-sm text-gray-700 mt-1 bg-gray-50 rounded-lg p-3 border border-gray-200">{payment.notes}</p>
                              </div>
                            )}
                            {payment.evidence_url && (
                              <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Evidence</label>
                                <a
                                  href={payment.evidence_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="mt-1 inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
                                >
                                  <FileText className="w-4 h-4" />
                                  Open Evidence Document
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {(!order.payments || order.payments.length === 0) && (
            <div className="text-center py-8 sm:py-12">
              <CreditCard className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 font-medium mb-2">No payments recorded yet</p>
              {hasWriteAccess && order.status !== 'Cancelled' && (
                <p className="text-sm text-gray-400">Click "Record Payment" to add a payment</p>
              )}
            </div>
          )}
        </div>

        {/* Order Items Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 sm:p-8 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Package className="w-6 h-6 text-blue-600" />
              Order Items
              <span className="text-base font-normal text-gray-500">({order.items.length})</span>
            </h2>
            {hasWriteAccess && !order.is_locked && order.status !== 'Cancelled' && (
              <button
                onClick={handleAddItem}
                className="inline-flex items-center gap-2 px-4 sm:px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-sm hover:shadow-md font-medium text-sm sm:text-base"
              >
                <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                Add Item
              </button>
            )}
          </div>

          {order.items.length === 0 ? (
            <div className="text-center py-12 sm:py-16">
              <Package className="w-20 h-20 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 font-medium mb-2">No items in this order</p>
              {hasWriteAccess && !order.is_locked && order.status !== 'Cancelled' && (
                <button
                  onClick={handleAddItem}
                  className="mt-4 inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-sm hover:shadow-md font-medium"
                >
                  <Plus className="w-5 h-5" />
                  Add First Item
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {order.items.map((item) => {
                const deliveryProgress = (item.quantity_delivered / item.quantity) * 100;
                const isFullyDelivered = item.quantity_delivered >= item.quantity;
                const remainingOrderQty = item.quantity - item.quantity_delivered;
                
                // Get actual available quantity from processed goods
                // This uses quantity_created - delivered - active_reservations
                // Note: actual_available excludes ALL reservations, including this order's reservation
                const processedGood = item.processed_good_id 
                  ? processedGoods.find(pg => pg.id === item.processed_good_id)
                  : null;
                const actualAvailable = processedGood?.actual_available ?? 0;
                
                // For delivery calculation, we need to add back THIS order's reservation
                // because the reservation is reserved FOR this order and can be used for delivery
                // The reservation quantity equals the original order quantity (item.quantity)
                const availableForThisOrder = actualAvailable + item.quantity;
                
                // Max delivery is the minimum of remaining order quantity and available inventory for this order
                const remaining = Math.min(remainingOrderQty, Math.max(0, availableForThisOrder));

                return (
                  <div
                    key={item.id}
                    className="bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-200 hover:border-gray-300 transition-all hover:shadow-md overflow-hidden"
                  >
                    {/* Item Header */}
                    <div className="p-4 sm:p-6">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-2">
                            <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-1">{item.product_type}</h3>
                            {hasWriteAccess && !order.is_locked && order.status !== 'Cancelled' && (
                              <div className="flex items-center gap-2 ml-4">
                                {item.quantity_delivered === 0 ? (
                                  <button
                                    onClick={() => handleEditItem(item)}
                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Edit item"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                ) : (
                                  <button
                                    disabled
                                    className="p-2 text-gray-300 rounded-lg cursor-not-allowed"
                                    title="Cannot edit item with deliveries"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    if (confirm('Are you sure you want to remove this item from the order?')) {
                                      handleDeleteItem(item.id);
                                    }
                                  }}
                                  disabled={item.quantity_delivered > 0}
                                  className={`p-2 rounded-lg transition-colors ${
                                    item.quantity_delivered > 0
                                      ? 'text-gray-300 cursor-not-allowed'
                                      : 'text-red-600 hover:bg-red-50'
                                  }`}
                                  title={item.quantity_delivered > 0 ? 'Cannot delete item with deliveries' : 'Remove item'}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2 text-sm text-gray-600 mb-3">
                            {item.form && (
                              <span className="px-2.5 py-1 bg-gray-100 rounded-lg border border-gray-200 font-medium">
                                Form: {item.form}
                              </span>
                            )}
                            {item.size && (
                              <span className="px-2.5 py-1 bg-gray-100 rounded-lg border border-gray-200 font-medium">
                                Size: {item.size}
                              </span>
                            )}
                            {item.processed_good_batch_reference && (
                              <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-lg border border-blue-200 font-medium">
                                Batch: {item.processed_good_batch_reference}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right sm:text-left sm:ml-auto">
                          <div className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">
                            ₹{item.line_total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className="text-sm text-gray-600">
                            ₹{item.unit_price.toFixed(2)} × {item.quantity} {item.unit}
                          </div>
                        </div>
                      </div>

                      {/* Delivery Tracking */}
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                            <Truck className="w-4 h-4 text-blue-600" />
                            Delivery Progress
                          </span>
                          <span className="text-sm font-semibold text-gray-900">
                            {item.quantity_delivered} / {item.quantity} {item.unit}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              isFullyDelivered ? 'bg-emerald-600' : 'bg-blue-600'
                            }`}
                            style={{ width: `${Math.min(100, deliveryProgress)}%` }}
                          />
                        </div>

                        {hasWriteAccess &&
                          !order.is_locked &&
                          order.status !== 'CANCELLED' &&
                          order.status !== 'ORDER_COMPLETED' &&
                          order.status !== 'DELIVERY_COMPLETED' &&
                          !isFullyDelivered && (
                            <div className="space-y-3">
                              {/* Add Delivery Section */}
                              {remaining > 0 && (
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                  <div className="flex items-center gap-2 flex-1">
                                    <input
                                      type="number"
                                      min="0.01"
                                      max={remaining}
                                      step="0.01"
                                      value={deliveryInputs[item.id] || ''}
                                      onChange={(e) => {
                                        setDeliveryInputs(prev => ({
                                          ...prev,
                                          [item.id]: e.target.value
                                        }));
                                      }}
                                      disabled={updatingDelivery === item.id}
                                      className="w-32 px-3 py-2.5 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                                      placeholder={`Add delivery (max ${remaining} ${item.unit})`}
                                    />
                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                      <span className="font-medium">{item.unit}</span>
                                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">({remaining} remaining)</span>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleAddDelivery(item.id)}
                                    disabled={updatingDelivery === item.id || !deliveryInputs[item.id] || parseFloat(deliveryInputs[item.id] || '0') <= 0}
                                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-sm hover:shadow-md font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    <Plus className="w-4 h-4" />
                                    Add Delivery
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                        {isFullyDelivered && (
                          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-600 bg-emerald-50 rounded-lg p-2 border border-emerald-200">
                            <CheckCircle2 className="w-4 h-4" />
                            Fully delivered
                          </div>
                        )}

                        {/* Delivery History */}
                        {item.quantity_delivered > 0 && (
                          <div className="mt-4 pt-4 border-t border-gray-200">
                            <button
                              onClick={() => toggleDeliveryHistory(item.id)}
                              className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors mb-3"
                            >
                              <History className="w-4 h-4" />
                              <span>Delivery History</span>
                              {loadingHistory[item.id] && (
                                <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin"></div>
                              )}
                            </button>
                            {deliveryHistory[item.id] && deliveryHistory[item.id].length > 0 && (
                              <div className="space-y-2">
                                {deliveryHistory[item.id].map((dispatch) => (
                                  <div
                                    key={dispatch.id}
                                    className="bg-white rounded-lg p-3 border border-gray-200 hover:border-gray-300 transition-colors"
                                  >
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                      <div className="flex items-center gap-2">
                                        <Truck className="w-4 h-4 text-blue-500" />
                                        <span className="font-semibold text-gray-900">
                                          {dispatch.quantity_delivered} {item.unit}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2 text-sm text-gray-600">
                                        <Calendar className="w-3 h-3" />
                                        {new Date(dispatch.delivery_date).toLocaleDateString('en-IN', {
                                          year: 'numeric',
                                          month: 'short',
                                          day: 'numeric',
                                        })}
                                      </div>
                                    </div>
                                    {dispatch.notes && (
                                      <p className="mt-2 text-xs text-gray-600 bg-gray-50 rounded p-2">{dispatch.notes}</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                            {deliveryHistory[item.id] && deliveryHistory[item.id].length === 0 && (
                              <p className="text-sm text-gray-500">No delivery history available</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Inventory Information Card */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl shadow-lg p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="bg-blue-600 rounded-lg p-2 flex-shrink-0">
              <AlertCircle className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-blue-900 mb-2 text-lg">Inventory Management</h3>
              <p className="text-sm text-blue-800 mb-3 leading-relaxed">
                {order.status === 'CANCELLED' ? (
                  <>
                    This order is cancelled. Reserved inventory has been released. Delivered items' inventory was already
                    reduced and will not be restored.
                  </>
                ) : order.status === 'DELIVERY_COMPLETED' ? (
                  <>
                    All items have been delivered. Inventory has been reduced for all delivered quantities. Reserved
                    quantities have been released.
                  </>
                ) : (
                  <>
                    <strong>Reservation:</strong> This order has reserved inventory from processed goods. Reserved
                    quantities are not physically deducted and remain available for other orders.
                    <br />
                    <br />
                    <strong>Delivery:</strong> Inventory is reduced ONLY when delivery is recorded. Each delivery reduces
                    the processed goods inventory by the delivered quantity. Undelivered quantities remain available.
                  </>
                )}
              </p>
              <div className="bg-white/60 rounded-lg p-3 border border-blue-200">
                <p className="text-xs font-semibold text-blue-900">
                  <strong>Rule:</strong> Inventory reduction happens only on delivery, never on order creation or invoice
                  generation.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="fixed bottom-4 right-4 bg-red-600 text-white px-6 py-4 rounded-lg shadow-lg border border-red-700 z-50 max-w-sm">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
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

      <CelebrationModal
        isOpen={showCelebration}
        onClose={() => setShowCelebration(false)}
        orderNumber={order.order_number}
        totalAmount={order.total_amount}
      />

      {/* Order Item Form Modal */}
      {isItemFormOpen && (
        <OrderItemFormModal
          isOpen={isItemFormOpen}
          onClose={() => {
            setIsItemFormOpen(false);
            setEditingItem(null);
          }}
          onSubmit={handleSaveItem}
          item={editingItem}
          processedGoods={processedGoods}
          producedGoodsUnits={producedGoodsUnits}
          loadingProducts={loadingProducts}
          saving={savingItem}
        />
      )}
    </div>
  );
}

// Order Item Form Modal Component
interface OrderItemFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (itemData: OrderItemFormData) => Promise<void>;
  item?: OrderItem | null;
  processedGoods: Array<ProcessedGood & { actual_available: number }>;
  producedGoodsUnits: ProducedGoodsUnit[];
  loadingProducts: boolean;
  saving: boolean;
}

function OrderItemFormModal({
  isOpen,
  onClose,
  onSubmit,
  item,
  processedGoods,
  producedGoodsUnits,
  loadingProducts,
  saving,
}: OrderItemFormModalProps) {
  const [formData, setFormData] = useState<OrderItemFormData>({
    processed_good_id: '',
    product_type: '',
    form: '',
    size: '',
    quantity: 1,
    unit_price: 0,
    unit: '',
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (item) {
        setFormData({
          processed_good_id: item.processed_good_id,
          product_type: item.product_type,
          form: item.form || '',
          size: item.size || '',
          quantity: item.quantity,
          unit_price: item.unit_price,
          unit: item.unit,
        });
      } else {
        setFormData({
          processed_good_id: '',
          product_type: '',
          form: '',
          size: '',
          quantity: 1,
          unit_price: 0,
          unit: '',
        });
      }
      setError(null);
    }
  }, [item, isOpen]);

  const handleProductChange = (productId: string) => {
    const product = processedGoods.find((pg) => pg.id === productId);
    if (product) {
      setFormData((prev) => ({
        ...prev,
        processed_good_id: productId,
        product_type: product.product_type,
        unit: product.unit,
        size: product.output_size && product.output_size_unit
          ? `${product.output_size} ${product.output_size_unit}`
          : product.output_size
          ? String(product.output_size)
          : '',
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.processed_good_id || !formData.quantity || !formData.unit_price) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      await onSubmit(formData);
    } catch (err) {
      // Error is handled by parent
    }
  };

  if (!isOpen) return null;

  const selectedProduct = formData.processed_good_id
    ? processedGoods.find((pg) => pg.id === formData.processed_good_id)
    : null;
  const selectedUnit = selectedProduct
    ? producedGoodsUnits.find((u) => u.display_name === selectedProduct.unit)
    : null;
  const allowsDecimal = selectedUnit?.allows_decimal ?? true;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
              {item ? 'Edit Order Item' : 'Add New Order Item'}
            </h2>
            {item && (
              <p className="text-sm text-gray-600 mt-1">
                Editing: {item.product_type} - {item.quantity} {item.unit}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Product *
              </label>
              {loadingProducts ? (
                <div className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-500">
                  Loading products...
                </div>
              ) : processedGoods.length === 0 ? (
                <div className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-500">
                  No products available
                </div>
              ) : (
                <select
                  value={formData.processed_good_id || ''}
                  onChange={(e) => handleProductChange(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
                >
                  {!formData.processed_good_id ? (
                    <option value="" disabled>
                      Select a product
                    </option>
                  ) : null}
                  {processedGoods.map((pg) => (
                    <option key={pg.id} value={pg.id}>
                      {pg.product_type} - {pg.unit} - {pg.batch_reference} - {pg.actual_available} available
                    </option>
                  ))}
                </select>
              )}
              {item && formData.processed_good_id && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs text-blue-800 font-semibold mb-1">Currently Editing Item:</p>
                  <p className="text-xs text-blue-700">
                    Product: <span className="font-medium">{formData.product_type}</span> | 
                    Quantity: <span className="font-medium">{formData.quantity} {formData.unit}</span> | 
                    Unit Price: <span className="font-medium">₹{formData.unit_price.toFixed(2)}</span>
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Quantity *
                </label>
                <input
                  type="number"
                  min={allowsDecimal ? '0.01' : '1'}
                  step={allowsDecimal ? '0.01' : '1'}
                  value={formData.quantity}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value) || 0;
                    if (!allowsDecimal && value % 1 !== 0) {
                      setFormData((prev) => ({ ...prev, quantity: Math.floor(value) }));
                    } else {
                      setFormData((prev) => ({ ...prev, quantity: value }));
                    }
                  }}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
                {selectedUnit && (
                  <p className="text-xs text-gray-500 mt-1">
                    {allowsDecimal ? 'Decimal values allowed' : 'Whole numbers only'}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Unit Price (₹) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.unit_price}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, unit_price: parseFloat(e.target.value) || 0 }))
                  }
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>
            </div>

            {formData.size && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Size</label>
                <input
                  type="text"
                  value={formData.size}
                  disabled
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 text-sm"
                />
              </div>
            )}

            {selectedProduct && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                <p className="text-sm text-emerald-700 font-semibold">
                  <strong>Available:</strong> {selectedProduct.actual_available} {formData.unit}
                </p>
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-medium text-sm sm:text-base"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm sm:text-base shadow-sm hover:shadow-md"
              disabled={saving}
            >
              {saving ? 'Saving...' : item ? 'Update Item' : 'Add Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
