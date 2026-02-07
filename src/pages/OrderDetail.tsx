import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit2, Package, Calendar, User, AlertCircle, Plus, CreditCard, FileText, Trash2, X, CheckCircle2, Clock, ChevronDown, Tag, Pencil, Phone, MapPin, ExternalLink, Pause, Play, History } from 'lucide-react';
import { fetchOrderWithPayments, createPayment, deletePayment, addOrderItem, updateOrderItem, deleteOrderItem, fetchProcessedGoodsForOrder, backfillCompletedAt, deleteOrder, setThirdPartyDeliveryEnabled, recordThirdPartyDelivery, fetchThirdPartyDelivery, uploadDeliveryDocument, fetchDeliveryDocuments, deleteDeliveryDocument, getOrderAuditLog, backfillOrderAuditLog, saveOrder } from '../lib/sales';
import { PaymentForm } from '../components/PaymentForm';
import { InvoiceGenerator } from '../components/InvoiceGenerator';
import { ModernCard } from '../components/ui/ModernCard';
import { ModernButton } from '../components/ui/ModernButton';
import { CelebrationModal } from '../components/CelebrationModal';
import { ProductDropdown } from '../components/ProductDropdown';
import { OrderLockTimer } from '../components/OrderLockTimer';
import { ThirdPartyDeliverySection } from '../components/ThirdPartyDeliverySection';
import { useAuth } from '../contexts/AuthContext';
import { fetchProducedGoodsUnits } from '../lib/units';
import type { OrderWithPaymentInfo, OrderStatus, PaymentStatus, PaymentFormData, OrderItemFormData, OrderItem, ThirdPartyDelivery, ThirdPartyDeliveryDocument, OrderAuditLog } from '../types/sales';
import type { AccessLevel } from '../types/access';
import type { ProcessedGood } from '../types/operations';
import type { ProducedGoodsUnit } from '../types/units';

function formatOrderLogEventType(
  eventType: string,
  entry?: { event_data?: { new_status?: string } }
): string {
  if (eventType === 'STATUS_CHANGED' && entry?.event_data?.new_status === 'ORDER_COMPLETED') {
    return 'Order completed';
  }
  const labels: Record<string, string> = {
    ORDER_CREATED: 'Order created',
    ITEM_ADDED: 'Item added',
    ITEM_UPDATED: 'Item updated',
    ITEM_DELETED: 'Item deleted',
    PAYMENT_RECEIVED: 'Payment received',
    PAYMENT_DELETED: 'Payment deleted',
    STATUS_CHANGED: 'Status changed',
    HOLD_PLACED: 'Hold placed',
    HOLD_REMOVED: 'Hold removed',
    ORDER_LOCKED: 'Order locked',
    ORDER_UNLOCKED: 'Order unlocked',
    DISCOUNT_APPLIED: 'Discount applied',
    ORDER_COMPLETED: 'Order completed',
  };
  return labels[eventType] || eventType.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

interface OrderDetailProps {
  orderId: string;
  onBack: () => void;
  onOrderDeleted?: () => void;
  accessLevel: AccessLevel;
}

export function OrderDetail({ orderId, onBack, onOrderDeleted, accessLevel }: OrderDetailProps) {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [order, setOrder] = useState<OrderWithPaymentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPaymentFormOpen, setIsPaymentFormOpen] = useState(false);
  const [isInvoiceGeneratorOpen, setIsInvoiceGeneratorOpen] = useState(false);
  const [isItemFormOpen, setIsItemFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<OrderItem | null>(null);
  const [processedGoods, setProcessedGoods] = useState<Array<ProcessedGood & { actual_available: number }>>([]);
  const [producedGoodsUnits, setProducedGoodsUnits] = useState<ProducedGoodsUnit[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  const [expandedPayments, setExpandedPayments] = useState<Set<string>>(new Set());
  const [showCelebration, setShowCelebration] = useState(false);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [applyingDiscount, setApplyingDiscount] = useState(false);
  const [showDiscountInput, setShowDiscountInput] = useState(false);
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [holdReason, setHoldReason] = useState('');
  const [settingHold, setSettingHold] = useState(false);
  const [thirdPartyDelivery, setThirdPartyDelivery] = useState<ThirdPartyDelivery | null>(null);
  const [thirdPartyDocuments, setThirdPartyDocuments] = useState<ThirdPartyDeliveryDocument[]>([]);
  const [showOrderLogModal, setShowOrderLogModal] = useState(false);
  const [orderLogEntries, setOrderLogEntries] = useState<OrderAuditLog[]>([]);
  const [loadingOrderLog, setLoadingOrderLog] = useState(false);
  const [orderNotes, setOrderNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const previousStatusRef = useRef<OrderStatus | null>(null);
  const hasWriteAccess = accessLevel === 'read-write';

  useEffect(() => {
    previousStatusRef.current = null;
    void loadOrder();
    void loadProducts();
    void loadThirdPartyDelivery();
  }, [orderId]);

  useEffect(() => {
    if (order) setOrderNotes(order.notes ?? '');
  }, [order?.id, order?.notes]);

  const loadOrder = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchOrderWithPayments(orderId);
      if (!data) {
        setError('Order not found');
        return;
      }

      // Fetch lock data separately using RPC to bypass cache issues
      const { fetchOrderLockData } = await import('../lib/sales');
      const lockData = await fetchOrderLockData(orderId);
      if (lockData) {
        data.locked_at = lockData.locked_at;
        data.locked_by = lockData.locked_by;
        data.locked_by_name = lockData.locked_by_name;
        data.can_unlock_until = lockData.can_unlock_until;
        data.is_locked = lockData.is_locked;
      }

      const totalPaid = data.total_paid || 0;
      const netTotal = data.total_amount - (data.discount_amount || 0);
      const outstanding = netTotal - totalPaid;
      const hasItems = data.items && data.items.length > 0;
      const isFullPayment = outstanding <= 0 && netTotal > 0;

      // Calculate payment status
      if (isFullPayment) {
        data.payment_status = 'FULL_PAYMENT';
      } else if (outstanding > 0 && outstanding < netTotal) {
        data.payment_status = 'PARTIAL_PAYMENT';
      } else {
        data.payment_status = 'READY_FOR_PAYMENT';
      }

      // Calculate order status (client-side until migration is applied)
      // Priority: Hold > Complete > Ready for Payment > Order Created
      if (data.is_on_hold) {
        data.status = 'HOLD';
      } else if (isFullPayment && !data.is_on_hold) {
        data.status = 'ORDER_COMPLETED';
      } else if (hasItems) {
        data.status = 'READY_FOR_PAYMENT';
      } else {
        data.status = 'ORDER_CREATED';
      }

      if (data.status === 'ORDER_COMPLETED' && !data.completed_at) {
        await backfillCompletedAt(orderId);
        const updatedData = await fetchOrderWithPayments(orderId);
        if (updatedData) {
          data.completed_at = updatedData.completed_at;
        }
      }

      setOrder(data);
      setDiscountAmount(data.discount_amount || 0);

      const previousStatus = previousStatusRef.current;
      if (previousStatus !== null && previousStatus !== 'ORDER_COMPLETED' && data.status === 'ORDER_COMPLETED') {
        setShowCelebration(true);
      }

      previousStatusRef.current = data.status;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load order';
      setError(message);
    } finally {
      setLoading(false);
    }
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

  const loadThirdPartyDelivery = async () => {
    try {
      const [delivery, documents] = await Promise.all([
        fetchThirdPartyDelivery(orderId),
        fetchDeliveryDocuments(orderId),
      ]);
      setThirdPartyDelivery(delivery);
      setThirdPartyDocuments(documents);
    } catch (err) {
      console.error('Failed to load third-party delivery:', err);
    }
  };

  const handleToggleThirdPartyDelivery = async (enabled: boolean) => {
    try {
      await setThirdPartyDeliveryEnabled(orderId, enabled, { currentUserId: user?.id });
      
      // Update order state locally instead of reloading entire order
      if (order) {
        setOrder({
          ...order,
          third_party_delivery_enabled: enabled,
        });
      }
      
      if (enabled) {
        await loadThirdPartyDelivery();
      } else {
        setThirdPartyDelivery(null);
        setThirdPartyDocuments([]);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to toggle third-party delivery';
      setError(message);
    }
  };

  const handleSaveThirdPartyDelivery = async (data: {
    quantity_delivered?: number;
    delivery_partner_name?: string;
    delivery_notes?: string;
  }) => {
    try {
      await recordThirdPartyDelivery(
        {
          order_id: orderId,
          ...data,
        },
        { currentUserId: user?.id }
      );
      await loadThirdPartyDelivery();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save delivery info';
      setError(message);
      throw err;
    }
  };

  const handleUploadDeliveryDocument = async (file: File) => {
    if (!thirdPartyDelivery) {
      throw new Error('Please save delivery information first');
    }
    try {
      await uploadDeliveryDocument(thirdPartyDelivery.id, file, { currentUserId: user?.id });
      await loadThirdPartyDelivery();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload document';
      setError(message);
      throw err;
    }
  };

  const handleDeleteDeliveryDocument = async (documentId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) {
      return;
    }
    try {
      await deleteDeliveryDocument(documentId);
      await loadThirdPartyDelivery();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete document';
      setError(message);
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

  const handleApplyDiscount = async () => {
    if (!order) return;

    if (discountAmount < 0) {
      setError('Discount amount cannot be negative');
      return;
    }

    const netTotal = order.total_amount - (order.discount_amount || 0);
    const outstandingAmount = netTotal - (order.total_paid || 0);
    if (discountAmount > outstandingAmount) {
      setError('Discount amount cannot exceed outstanding amount');
      return;
    }

    setApplyingDiscount(true);
    setError(null);

    try {
      const { updateOrder } = await import('../lib/sales');
      await updateOrder(order.id, { discount_amount: discountAmount }, { currentUserId: user?.id });
      await loadOrder();
      setShowDiscountInput(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to apply discount';
      setError(message);
    } finally {
      setApplyingDiscount(false);
    }
  };

  const handleDeleteOrder = async () => {
    if (!order) return;

    // Add confirmation dialog
    const confirmMessage = `Are you sure you want to delete order ${order.order_number}?\n\nThis will:\n- Remove the order and all items\n- Restore inventory for all items\n- Delete all payments and income entries\n\nThis action cannot be undone.`;
    
    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      setError(null);
      // Pass skipConfirmation since we already confirmed above
      await deleteOrder(order.id, { currentUserId: user?.id, skipConfirmation: true });
      alert(`Order ${order.order_number} has been successfully deleted.`);
      if (onOrderDeleted) {
        onOrderDeleted();
      }
      onBack();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete order';
      setError(message);
      alert(`Error deleting order: ${message}`);
      console.error('Delete order error:', err);
    }
  };

  const handleSetHold = async () => {
    if (!order) return;
    if (!holdReason.trim()) {
      setError('Please provide a reason for holding the order');
      return;
    }

    setSettingHold(true);
    setError(null);

    try {
      const { setOrderOnHold } = await import('../lib/sales');
      await setOrderOnHold(order.id, holdReason, { currentUserId: profile?.id });
      await loadOrder();
      setShowHoldModal(false);
      setHoldReason('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to set order on hold';
      setError(message);
    } finally {
      setSettingHold(false);
    }
  };

  const handleRemoveHold = async () => {
    if (!order) return;

    if (!confirm('Are you sure you want to remove the hold from this order?')) {
      return;
    }

    setError(null);

    try {
      const { removeOrderHold } = await import('../lib/sales');
      await removeOrderHold(order.id, { currentUserId: user?.id });
      await loadOrder();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove hold';
      setError(message);
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

  const getDeliveryStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'ORDER_CREATED':
        return { label: 'Order Created', className: 'bg-gray-100 text-gray-700 border border-gray-200', icon: <Clock className="w-4 h-4" /> };
      case 'READY_FOR_PAYMENT':
        return { label: 'Ready for Payment', className: 'bg-blue-100 text-blue-700 border border-blue-200', icon: <Clock className="w-4 h-4" /> };
      case 'HOLD':
        return { label: 'On Hold', className: 'bg-amber-100 text-amber-700 border border-amber-200', icon: <AlertCircle className="w-4 h-4" /> };
      case 'ORDER_COMPLETED':
        return { label: 'Completed', className: 'bg-purple-100 text-purple-700 border border-purple-200', icon: <CheckCircle2 className="w-4 h-4" /> };
      default:
        return { label: status, className: 'bg-gray-100 text-gray-700 border border-gray-200', icon: <Clock className="w-4 h-4" /> };
    }
  };

  const getPaymentStatusBadge = (paymentStatus?: PaymentStatus) => {
    if (!paymentStatus) {
      return { label: 'No Payment', className: 'bg-gray-100 text-gray-700 border border-gray-200' };
    }
    switch (paymentStatus) {
      case 'READY_FOR_PAYMENT':
        return { label: 'No Payment', className: 'bg-gray-100 text-gray-700 border border-gray-200' };
      case 'PARTIAL_PAYMENT':
        return { label: 'Partially Paid', className: 'bg-yellow-100 text-yellow-700 border border-yellow-200' };
      case 'FULL_PAYMENT':
        return { label: 'Full Paid', className: 'bg-green-100 text-green-700 border border-green-200' };
      default:
        return { label: paymentStatus, className: 'bg-gray-100 text-gray-700 border border-gray-200' };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <ModernButton
            onClick={onBack}
            variant="ghost"
            className="group pl-0 hover:bg-transparent hover:text-gray-900 text-gray-600 mb-6"
            icon={<ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />}
          >
            Back to Orders
          </ModernButton>
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
          <ModernButton
            onClick={onBack}
            variant="ghost"
            className="group pl-0 hover:bg-transparent hover:text-gray-900 text-gray-600 mb-6"
            icon={<ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />}
          >
            Back to Orders
          </ModernButton>
          <div className="bg-white rounded-2xl shadow-lg border border-red-200 p-8 sm:p-12 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <p className="text-lg font-semibold text-gray-900 mb-2">Error</p>
            <p className="text-gray-600">{error || 'Order not found'}</p>
          </div>
        </div>
      </div>
    );
  }

  const orderTotal = order.total_amount;
  const hasDiscount = (order.discount_amount || 0) > 0;
  const netTotal = orderTotal - (order.discount_amount || 0);
  const outstandingAmount = netTotal - (order.total_paid || 0);
  const paymentProgress = netTotal > 0 ? ((order.total_paid || 0) / netTotal) * 100 : 0;

  const actualPaymentStatus: PaymentStatus = outstandingAmount <= 0 && netTotal > 0
    ? 'FULL_PAYMENT'
    : outstandingAmount > 0 && outstandingAmount < netTotal
      ? 'PARTIAL_PAYMENT'
      : order.payment_status || 'READY_FOR_PAYMENT';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header Navigation */}
        <div className="mb-6">
          <ModernButton
            onClick={onBack}
            variant="ghost"
            className="group pl-0 hover:bg-transparent hover:text-gray-900 text-gray-600"
            icon={<ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />}
          >
            Back to Orders
          </ModernButton>
        </div>

        {/* Order Header Card */}
        <ModernCard padding="none" className="overflow-hidden mb-6">
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
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-col sm:items-end gap-3">
                <ModernButton
                  onClick={async () => {
                    setShowOrderLogModal(true);
                    setLoadingOrderLog(true);
                    try {
                      let entries = await getOrderAuditLog(orderId);
                      if (!entries?.length) {
                        await backfillOrderAuditLog(orderId);
                        entries = await getOrderAuditLog(orderId);
                      }
                      setOrderLogEntries(entries || []);
                    } catch {
                      setOrderLogEntries([]);
                    } finally {
                      setLoadingOrderLog(false);
                    }
                  }}
                  variant="secondary"
                  className="bg-white/20 hover:bg-white/30 text-white border-white/40"
                  icon={<History className="w-4 h-4" />}
                >
                  Order log
                </ModernButton>
                <div className="flex flex-wrap items-center gap-2">
                  {(() => {
                    const deliveryBadge = getDeliveryStatusBadge(order.status);
                    const paymentBadge = getPaymentStatusBadge(actualPaymentStatus);
                    
                    // Simplified badge logic:
                    // - If HOLD: Show "On Hold" + payment status badge
                    // - If ORDER_COMPLETED: Show only "Completed" (implies full payment)
                    // - If PARTIAL_PAYMENT or FULL_PAYMENT: Show only payment badge (more important info)
                    // - If ORDER_CREATED or (READY_FOR_PAYMENT + no payment): Show only order status badge
                    
                    const showOrderBadge = order.status === 'HOLD' 
                      || order.status === 'ORDER_COMPLETED'
                      || actualPaymentStatus === 'READY_FOR_PAYMENT';
                    
                    const showPaymentBadge = order.status !== 'ORDER_COMPLETED' 
                      && order.status !== 'ORDER_CREATED'
                      && actualPaymentStatus !== 'READY_FOR_PAYMENT';
                    
                    return (
                      <>
                        {showOrderBadge && (
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg border ${deliveryBadge.className}`}>
                            {deliveryBadge.icon}
                            {deliveryBadge.label}
                          </span>
                        )}
                        {showPaymentBadge && (
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
                  <div className="text-xs font-medium text-blue-200 uppercase tracking-wide mb-1">
                    {hasDiscount ? 'Net Total' : 'Total Amount'}
                  </div>
                  <div className="text-3xl sm:text-4xl font-bold text-white">
                    ₹{netTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  {hasDiscount && (
                    <div className="text-base text-blue-200 line-through mt-1">
                      ₹{orderTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Customer & Order Details Section */}
          <div className="bg-white border-t border-gray-100">
            <div className="flex flex-col md:flex-row md:divide-x divide-gray-100">
              <div className="p-6 sm:p-8 md:w-1/2 lg:w-7/12">
                <div className="flex items-start gap-4">
                  <div className="h-14 w-14 rounded-full bg-blue-50 flex items-center justify-center border-2 border-white shadow-md flex-shrink-0">
                    {order.customer?.photo_url ? (
                      <img src={order.customer.photo_url} alt={order.customer.name} className="h-full w-full rounded-full object-cover" />
                    ) : (
                      <User className="w-7 h-7 text-blue-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      {order.customer_id ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/sales/customers/${order.customer_id}`);
                          }}
                          className="text-xl font-bold text-gray-900 hover:text-blue-600 transition-colors truncate flex items-center gap-2 group"
                        >
                          {order.customer?.name || order.customer_name || 'Unknown Customer'}
                          <ExternalLink className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-blue-500" />
                        </button>
                      ) : (
                        <span className="text-xl font-bold text-gray-900 truncate">
                          {order.customer?.name || order.customer_name || 'Unknown Customer'}
                        </span>
                      )}
                      {order.customer?.customer_type && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                          {order.customer.customer_type}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 mt-3">
                      {order.customer?.phone && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Phone className="w-4 h-4 text-gray-400" />
                          <span>{order.customer.phone}</span>
                        </div>
                      )}
                      {order.customer?.address && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <MapPin className="w-4 h-4 text-gray-400" />
                          <span className="truncate" title={order.customer.address}>{order.customer.address}</span>
                        </div>
                      )}
                      {order.customer?.contact_person && (
                        <div className="flex items-center gap-2 text-sm text-gray-600 sm:col-span-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <span>Contact: {order.customer.contact_person}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-6 sm:p-8 md:w-1/2 lg:w-5/12 bg-gray-50/50">
                <div className="h-full">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gray-500" />
                    Order notes
                  </h3>
                  {hasWriteAccess && !order.is_locked ? (
                    <div className="space-y-2">
                      <textarea
                        value={orderNotes}
                        onChange={(e) => setOrderNotes(e.target.value)}
                        placeholder="Add order-related notes (e.g. delivery instructions, special requests)..."
                        rows={4}
                        className="w-full rounded-lg border border-gray-300 p-3 text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-y min-h-[100px]"
                      />
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={async () => {
                            if (savingNotes) return;
                            setSavingNotes(true);
                            try {
                              await saveOrder(orderId, { notes: orderNotes }, { currentUserId: user?.id });
                              await loadOrder();
                            } catch (e) {
                              setError(e instanceof Error ? e.message : 'Failed to save notes');
                            } finally {
                              setSavingNotes(false);
                            }
                          }}
                          disabled={savingNotes || orderNotes === (order.notes ?? '')}
                          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {savingNotes ? 'Saving…' : 'Save notes'}
                        </button>
                      </div>
                    </div>
                  ) : order.notes ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900 leading-relaxed whitespace-pre-wrap">
                      {order.notes}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic">No notes added</p>
                  )}
                  {order.sold_by_name && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <p className="text-xs text-gray-500 mb-1">Sold By</p>
                      <p className="text-sm font-medium text-gray-900">{order.sold_by_name}</p>
                    </div>
                  )}
                  {order.is_on_hold && order.hold_reason && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4">
                        <div className="flex items-start gap-2 mb-2">
                          <Pause className="w-4 h-4 text-amber-700 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-xs font-bold text-amber-900 uppercase tracking-wide mb-1">Order On Hold</p>
                            <p className="text-sm text-amber-900 leading-relaxed">{order.hold_reason}</p>
                          </div>
                        </div>
                        {order.held_by_name && order.held_at && (
                          <div className="mt-3 pt-3 border-t border-amber-200">
                            <p className="text-xs text-amber-700">
                              Held by <span className="font-medium">{order.held_by_name}</span> on{' '}
                              {new Date(order.held_at).toLocaleDateString('en-IN', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {order.status === 'ORDER_COMPLETED' && (
            <div className="px-6 sm:px-8 py-4 border-t border-gray-200 bg-white">
              <OrderLockTimer
                orderId={order.id}
                orderStatus={order.status}
                isLocked={order.is_locked}
                lockedAt={order.locked_at}
                lockedByName={order.locked_by_name}
                canUnlockUntil={order.can_unlock_until}
                currentUserId={user?.id}
                onLockChange={loadOrder}
                hasWriteAccess={hasWriteAccess}
              />
            </div>
          )}

          <div className="px-6 sm:px-8 py-4 sm:py-6 border-t border-gray-200 bg-gray-50">
            <div className="flex flex-wrap items-center gap-3">
              {hasWriteAccess && (
                <ModernButton
                  onClick={() => setIsInvoiceGeneratorOpen(true)}
                  variant="primary"
                  icon={<FileText className="w-4 h-4" />}
                >
                  Generate Invoice
                </ModernButton>
              )}
              {hasWriteAccess && !order.is_locked && !order.is_on_hold && (
                <ModernButton
                  onClick={() => setShowHoldModal(true)}
                  variant="secondary"
                  icon={<Pause className="w-4 h-4" />}
                  className="border-amber-300 text-amber-700 hover:bg-amber-50"
                >
                  Hold Order
                </ModernButton>
              )}
              {hasWriteAccess && !order.is_locked && order.is_on_hold && (
                <ModernButton
                  onClick={handleRemoveHold}
                  variant="secondary"
                  icon={<Play className="w-4 h-4" />}
                  className="border-green-300 text-green-700 hover:bg-green-50"
                >
                  Remove Hold
                </ModernButton>
              )}
              {hasWriteAccess && !order.is_locked && (
                <ModernButton
                  onClick={handleDeleteOrder}
                  variant="danger"
                  icon={<Trash2 className="w-4 h-4" />}
                >
                  Delete Order
                </ModernButton>
              )}
            </div>
          </div>
        </ModernCard>

        {/* Payment Summary Card */}
        <ModernCard className="p-6 sm:p-8 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
              <CreditCard className="w-6 h-6 text-blue-600" />
              Payment Summary
            </h2>
            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 justify-end sm:justify-center">
              {hasWriteAccess && !order.is_locked && (
                <>
                  {!showDiscountInput ? (
                    <ModernButton
                      onClick={() => setShowDiscountInput(true)}
                      variant="secondary"
                      size="sm"
                      className="text-xs sm:text-sm"
                    >
                      <div className="flex items-center gap-1 md:hidden">
                        <Tag className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span>{hasDiscount ? `₹${order.discount_amount?.toFixed(0)} Off` : 'Add Discount'}</span>
                      </div>
                      <div className="hidden md:flex items-center gap-2">
                        <Tag className="w-4 h-4" />
                        <span>{hasDiscount ? `Discount: ₹${order.discount_amount?.toFixed(2)}` : 'Add Discount'}</span>
                        {hasDiscount && <Pencil className="w-3 h-3" />}
                      </div>
                    </ModernButton>
                  ) : null}
                </>
              )}
              {hasWriteAccess && !order.is_locked && (
                <button
                  onClick={() => setIsPaymentFormOpen(true)}
                  disabled={netTotal <= 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600"
                  title={netTotal <= 0 ? 'Add items to the order before recording payment' : 'Record a payment for this order'}
                >
                  <Plus className="w-4 h-4" />
                  Record Payment
                </button>
              )}
            </div>
          </div>

          {showDiscountInput && (
            <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-orange-900">Apply Discount</h3>
                <button
                  onClick={() => {
                    setShowDiscountInput(false);
                    setDiscountAmount(order.discount_amount || 0);
                  }}
                  className="text-orange-600 hover:text-orange-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-orange-900 mb-1">
                    Discount Amount (₹)
                  </label>
                  <input
                    type="number"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="Enter discount amount"
                    step="0.01"
                    min="0"
                    max={outstandingAmount}
                  />
                  <p className="text-xs text-orange-700 mt-1">
                    Maximum: ₹{outstandingAmount.toFixed(2)} (Outstanding amount)
                  </p>
                </div>
                <div className="flex items-end">
                  <ModernButton
                    onClick={handleApplyDiscount}
                    disabled={applyingDiscount}
                    variant="primary"
                  >
                    {applyingDiscount ? 'Applying...' : 'Apply Discount'}
                  </ModernButton>
                </div>
              </div>
            </div>
          )}

          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Payment Progress</span>
              <span className="text-sm font-semibold text-gray-900">{paymentProgress.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500"
                style={{ width: `${Math.min(100, paymentProgress)}%` }}
              />
            </div>
          </div>

          <div className={`grid gap-4 sm:gap-6 mb-6 ${hasDiscount ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-5' : 'grid-cols-1 sm:grid-cols-3'}`}>
            {hasDiscount && (
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 sm:p-5 border border-blue-200">
                <div className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">Order Total</div>
                <div className="text-2xl font-bold text-blue-900">
                  ₹{orderTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            )}
            {hasDiscount && (
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4 sm:p-5 border border-orange-200">
                <div className="text-xs font-semibold text-orange-600 uppercase tracking-wide mb-1">Discount</div>
                <div className="text-2xl font-bold text-orange-900">
                  -₹{(order.discount_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            )}
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 sm:p-5 border border-purple-200">
              <div className="text-xs font-semibold text-purple-600 uppercase tracking-wide mb-1">
                {hasDiscount ? 'Net Total' : 'Total Amount'}
              </div>
              <div className="text-2xl font-bold text-purple-900">
                ₹{netTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-4 sm:p-5 border border-emerald-200">
              <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-1">Total Paid</div>
              <div className="text-2xl font-bold text-emerald-900">
                ₹{(order.total_paid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-4 sm:p-5 border border-amber-200">
              <div className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-1">Outstanding</div>
              <div className="text-2xl font-bold text-amber-900">
                ₹{Math.max(0, outstandingAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center">
            <span className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg border ${getPaymentStatusColor(actualPaymentStatus)}`}>
              <CreditCard className="w-4 h-4" />
              {getPaymentStatusBadge(actualPaymentStatus).label}
            </span>
          </div>

          {order.payments && order.payments.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment History</h3>
              <div className="space-y-3">
                {order.payments.map((payment) => {
                  const isExpanded = expandedPayments.has(payment.id);
                  return (
                    <div key={payment.id} className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                      <div className="p-4 sm:p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="text-lg font-bold text-gray-900">
                                ₹{payment.amount_received.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                              <span className="px-2.5 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full border border-blue-200">
                                {payment.payment_mode}
                              </span>
                            </div>
                            <div className="text-sm text-gray-600">
                              {new Date(payment.payment_date || payment.created_at).toLocaleDateString('en-IN', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                const newExpanded = new Set(expandedPayments);
                                if (isExpanded) {
                                  newExpanded.delete(payment.id);
                                } else {
                                  newExpanded.add(payment.id);
                                }
                                setExpandedPayments(newExpanded);
                              }}
                              className="p-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                            >
                              <ChevronDown className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </button>
                            {hasWriteAccess && !order.is_locked && (
                              <button
                                onClick={() => handleDeletePayment(payment.id)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-0 border-t border-gray-200 bg-white">
                          <div className="grid grid-cols-2 gap-4 mt-4">
                            {payment.notes && (
                              <div className="col-span-2">
                                <p className="text-xs text-gray-500 mb-1">Notes</p>
                                <p className="text-sm text-gray-700">{payment.notes}</p>
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
        </ModernCard>

        {/* Order Items Card */}
        <ModernCard className="p-6 sm:p-8 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Package className="w-6 h-6 text-blue-600" />
              Order Items
              <span className="text-base font-normal text-gray-500">({order.items.length})</span>
            </h2>
            {hasWriteAccess && !order.is_locked && (
              <ModernButton
                onClick={handleAddItem}
                variant="primary"
                icon={<Plus className="w-4 h-4" />}
              >
                Add Item
              </ModernButton>
            )}
          </div>

          {order.items.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
              <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 font-medium mb-2">No items in this order</p>
              <p className="text-sm text-gray-500">Click "Add Item" to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {order.items.map((item) => (
                <div
                  key={item.id}
                  className="bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-200 hover:border-gray-300 transition-all hover:shadow-md overflow-hidden"
                >
                  <div className="p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-1">{item.product_type}</h3>
                          {hasWriteAccess && !order.is_locked && (
                            <div className="flex items-center gap-2 ml-4">
                              <ModernButton
                                onClick={() => handleEditItem(item)}
                                variant="ghost"
                                className="p-2 text-blue-600 hover:bg-blue-50"
                              >
                                <Edit2 className="w-4 h-4" />
                              </ModernButton>
                              <ModernButton
                                onClick={() => {
                                  if (confirm('Are you sure you want to remove this item from the order?')) {
                                    handleDeleteItem(item.id);
                                  }
                                }}
                                variant="ghost"
                                className="p-2 text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </ModernButton>
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
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <Package className="w-4 h-4 text-gray-400" />
                            <span className="font-semibold text-gray-900">
                              {item.quantity} {item.unit}
                            </span>
                          </div>
                          <div className="text-gray-400">×</div>
                          <div>
                            <span className="font-semibold text-gray-900">
                              ₹{item.unit_price.toFixed(2)}
                            </span>
                            <span className="text-gray-500"> per {item.unit}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right sm:text-left sm:ml-auto">
                        <div className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">
                          ₹{item.line_total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-sm text-gray-500">Line Total</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ModernCard>

        {/* Third-Party Delivery Tracking */}
        <ThirdPartyDeliverySection
          orderId={order.id}
          enabled={order.third_party_delivery_enabled || false}
          onToggle={handleToggleThirdPartyDelivery}
          onSave={handleSaveThirdPartyDelivery}
          onUploadDocument={handleUploadDeliveryDocument}
          onDeleteDocument={handleDeleteDeliveryDocument}
          delivery={thirdPartyDelivery}
          documents={thirdPartyDocuments}
          hasWriteAccess={hasWriteAccess && !order.is_locked}
        />

        {/* Inventory Information Card */}
        <ModernCard className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="bg-blue-600 rounded-lg p-2 flex-shrink-0">
              <AlertCircle className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-blue-900 mb-2 text-lg">Inventory Management</h3>
              <p className="text-sm text-blue-800 mb-3 leading-relaxed">
                Inventory is automatically deducted when order items are added. When you add or update items, 
                the available quantity in Processed Goods is reduced immediately.
              </p>
              <div className="bg-white/60 rounded-lg p-3 border border-blue-200">
                <p className="text-xs font-semibold text-blue-900">
                  <strong>Rule:</strong> Inventory is deducted immediately when order items are added or updated.
                </p>
              </div>
            </div>
          </div>
        </ModernCard>

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
        defaultOrderId={order.id || ''}
      />

      <InvoiceGenerator
        isOpen={isInvoiceGeneratorOpen}
        onClose={() => setIsInvoiceGeneratorOpen(false)}
        orderId={order.id}
      />

      <CelebrationModal
        isOpen={showCelebration}
        onClose={() => setShowCelebration(false)}
        orderNumber={order.order_number}
        totalAmount={netTotal}
      />

      {/* Hold Order Modal */}
      {showHoldModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-amber-600 to-orange-600">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <Pause className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Hold Order</h2>
                  <p className="text-sm text-amber-100 mt-1">Provide a reason for holding this order</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowHoldModal(false);
                  setHoldReason('');
                  setError(null);
                }}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <div className="p-6">
              {error && (
                <div className="mb-4 p-4 bg-red-50 border-2 border-red-200 rounded-xl text-red-700 text-sm flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">{error}</div>
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Hold Reason *
                </label>
                <textarea
                  value={holdReason}
                  onChange={(e) => setHoldReason(e.target.value)}
                  placeholder="Enter the reason for holding this order..."
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm transition-all resize-none"
                  rows={4}
                  required
                />
                <p className="text-xs text-gray-500">
                  This reason will be visible to all users with access to this order.
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 bg-gray-50 flex gap-3">
              <ModernButton
                type="button"
                onClick={() => {
                  setShowHoldModal(false);
                  setHoldReason('');
                  setError(null);
                }}
                variant="ghost"
                className="flex-1"
                disabled={settingHold}
              >
                Cancel
              </ModernButton>
              <ModernButton
                type="button"
                onClick={handleSetHold}
                variant="primary"
                className="flex-1 bg-amber-600 hover:bg-amber-700"
                disabled={settingHold || !holdReason.trim()}
              >
                {settingHold ? 'Setting Hold...' : 'Hold Order'}
              </ModernButton>
            </div>
          </div>
        </div>
      )}

      {isItemFormOpen && (
        <OrderItemFormModal
          isOpen={isItemFormOpen}
          onClose={() => {
            setIsItemFormOpen(false);
            setEditingItem(null);
          }}
          onSubmit={handleSaveItem}
          editingItem={editingItem}
          processedGoods={processedGoods}
          producedGoodsUnits={producedGoodsUnits}
          loadingProducts={loadingProducts}
          savingItem={savingItem}
        />
      )}

      {/* Order log modal – full audit (created, payments, status, hold, lock, etc.) */}
      {showOrderLogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center flex-shrink-0">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <History className="w-5 h-5 text-blue-600" />
                Order log
              </h3>
              <button
                type="button"
                onClick={() => setShowOrderLogModal(false)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 min-h-0">
              {loadingOrderLog ? (
                <p className="text-sm text-gray-500">Loading…</p>
              ) : (() => {
                const entriesToShow = orderLogEntries.length > 0
                  ? orderLogEntries
                  : order
                    ? [{
                        id: 'fallback-created',
                        event_type: 'ORDER_CREATED' as const,
                        performed_by_name: order.sold_by_name || '',
                        performed_at: order.created_at || order.updated_at,
                        description: `Order ${order.order_number} created`,
                      }]
                    : [];
                return entriesToShow.length === 0 ? (
                  <p className="text-sm text-gray-500">No events recorded yet.</p>
                ) : (
                <ul className="space-y-3">
                  {entriesToShow.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex flex-col gap-1 py-3 border-b border-gray-100 last:border-0 last:pb-0"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800">
                          {formatOrderLogEventType(entry.event_type, entry)}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(entry.performed_at).toLocaleString(undefined, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </span>
                        {entry.performed_by_name && (
                          <span className="text-xs text-gray-600">
                            by {entry.performed_by_name}
                          </span>
                        )}
                      </div>
                      {entry.description && (
                        <p className="text-sm text-gray-700">{entry.description}</p>
                      )}
                    </li>
                  ))}
                </ul>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Order Item Form Modal Component
interface OrderItemFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: OrderItemFormData) => Promise<void>;
  editingItem: OrderItem | null;
  processedGoods: Array<ProcessedGood & { actual_available: number }>;
  producedGoodsUnits: ProducedGoodsUnit[];
  loadingProducts: boolean;
  savingItem: boolean;
}

function OrderItemFormModal({
  isOpen,
  onClose,
  onSubmit,
  editingItem,
  processedGoods,
  loadingProducts,
  savingItem,
}: OrderItemFormModalProps) {
  const [selectedProduct, setSelectedProduct] = useState<string>(editingItem?.processed_good_id || '');
  const [quantity, setQuantity] = useState<string>(editingItem?.quantity.toString() || '');
  const [unitPrice, setUnitPrice] = useState<string>(editingItem?.unit_price.toString() || '');
  const [quantityError, setQuantityError] = useState<string>('');

  if (!isOpen) return null;

  const selectedGood = processedGoods.find(pg => pg.id === selectedProduct);

  const handleQuantityChange = (value: string) => {
    setQuantity(value);
    
    if (selectedGood && value) {
      const numValue = parseFloat(value);
      if (numValue > selectedGood.actual_available) {
        setQuantityError(`Only ${selectedGood.actual_available} ${selectedGood.unit} available`);
      } else if (numValue <= 0) {
        setQuantityError('Quantity must be greater than 0');
      } else {
        setQuantityError('');
      }
    } else {
      setQuantityError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGood) return;

    // Final validation before submit
    const numQuantity = parseFloat(quantity);
    if (numQuantity > selectedGood.actual_available) {
      setQuantityError(`Only ${selectedGood.actual_available} ${selectedGood.unit} available`);
      return;
    }
    if (numQuantity <= 0) {
      setQuantityError('Quantity must be greater than 0');
      return;
    }

    const itemData: OrderItemFormData = {
      processed_good_id: selectedProduct,
      product_type: selectedGood.product_type,
      form: (selectedGood as any).form || undefined,
      size: (selectedGood as any).size || undefined,
      quantity: parseFloat(quantity),
      unit_price: parseFloat(unitPrice),
      unit: selectedGood.unit,
    };

    await onSubmit(itemData);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full min-h-[500px] max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center">
                <Package className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">
                {editingItem ? 'Edit Order Item' : 'Add Order Item'}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Select Product *
            </label>
            <ProductDropdown
              processedGoods={processedGoods}
              value={selectedProduct}
              onChange={setSelectedProduct}
              disabled={loadingProducts}
            />
            {!selectedProduct && (
              <p className="text-xs text-gray-500 mt-2">
                Search and select a product from your inventory
              </p>
            )}
          </div>

          {selectedGood && (
            <>
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Product Type:</span>
                  <span className="text-sm font-semibold text-gray-900">{selectedGood.product_type}</span>
                </div>
                {selectedGood.output_size && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Size:</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {selectedGood.output_size} {selectedGood.output_size_unit}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Available:</span>
                  <span className="text-sm font-bold text-emerald-600">
                    {selectedGood.actual_available} {selectedGood.unit}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Quantity ({selectedGood.unit}) *
                  </label>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => handleQuantityChange(e.target.value)}
                    className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-2 transition-all ${
                      quantityError 
                        ? 'border-red-300 focus:ring-red-500 focus:border-red-500' 
                        : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                    }`}
                    placeholder="0.00"
                    step="0.01"
                    min="0.01"
                    max={selectedGood.actual_available}
                    required
                  />
                  {quantityError && (
                    <p className="text-xs text-red-600 mt-1 font-medium flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {quantityError}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Unit Price (₹) *
                  </label>
                  <input
                    type="number"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    required
                  />
                </div>
              </div>

              {quantity && unitPrice && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-blue-900">Line Total:</span>
                    <span className="text-2xl font-bold text-blue-900">
                      ₹{(parseFloat(quantity) * parseFloat(unitPrice)).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex gap-3">
            <ModernButton
              type="button"
              onClick={onClose}
              variant="ghost"
              className="flex-1"
            >
              Cancel
            </ModernButton>
            <ModernButton
              type="submit"
              variant="primary"
              disabled={!selectedProduct || !quantity || !unitPrice || savingItem || !!quantityError}
              className="flex-1"
            >
              {savingItem ? 'Saving...' : editingItem ? 'Update Item' : 'Add Item'}
            </ModernButton>
          </div>
        </div>
      </form>
    </div>
  );
}
