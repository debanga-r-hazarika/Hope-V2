import { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Package, Calendar, User, AlertCircle, Plus, FileText, Trash2, X, CheckCircle2, ChevronDown, Pencil, Phone, MapPin, Pause, Play, History, ShoppingBag, Loader2, Check, Search, CreditCard, Banknote, Landmark, Smartphone, Wallet, Lock, Info, ExternalLink, QrCode } from 'lucide-react';
import { fetchOrderWithPayments, createPayment, deletePayment, addOrderItem, updateOrderItem, deleteOrderItem, fetchProcessedGoodsForOrder, backfillCompletedAt, deleteOrder, setThirdPartyDeliveryEnabled, recordThirdPartyDelivery, fetchThirdPartyDelivery, uploadDeliveryDocument, fetchDeliveryDocuments, deleteDeliveryDocument, getOrderAuditLog, backfillOrderAuditLog, saveOrder } from '../lib/sales';
import { PaymentForm } from '../components/PaymentForm';
import { InvoiceGenerator } from '../components/InvoiceGenerator';
import { ModernButton } from '../components/ui/ModernButton';
import { CelebrationModal } from '../components/CelebrationModal';
import { OrderLockTimer } from '../components/OrderLockTimer';
import { ThirdPartyDeliverySection } from '../components/ThirdPartyDeliverySection';
import { ProductDropdown } from '../components/ProductDropdown';
import { useAuth } from '../contexts/AuthContext';

import { fetchProducedGoodsTags } from '../lib/tags';
import type { OrderWithPaymentInfo, OrderStatus, PaymentStatus, PaymentFormData, OrderItemFormData, OrderItem, ThirdPartyDelivery, ThirdPartyDeliveryDocument, OrderAuditLog } from '../types/sales';
import type { AccessLevel } from '../types/access';
import type { ProcessedGood } from '../types/operations';
import type { ProducedGoodsTag } from '../types/tags';

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
  const [allProducedGoodsTags, setAllProducedGoodsTags] = useState<ProducedGoodsTag[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
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
      const [goods, tags] = await Promise.all([
        fetchProcessedGoodsForOrder(includeProductId),
        fetchProducedGoodsTags(false),
      ]);
      setProcessedGoods(goods);
      setAllProducedGoodsTags(tags);
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



    // Validate discount is not greater than total
    if (discountAmount > order.total_amount) {
      setError('Discount amount cannot exceed total order amount');
      return;
    }

    setError(null);

    try {
      await saveOrder(order.id, { discount_amount: discountAmount }, { currentUserId: user?.id });
      await loadOrder();
      setShowDiscountInput(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to apply discount';
      setError(message);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-slate-500 font-medium text-sm">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="max-w-2xl mx-auto text-center mt-20">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-slate-900">Unable to load order</h2>
          <p className="text-slate-500 mt-2 mb-6">{error || 'Order not found'}</p>
          <ModernButton onClick={onBack} variant="secondary">Go Back</ModernButton>
        </div>
      </div>
    );
  }

  const orderTotal = order.total_amount;
  const hasDiscount = (order.discount_amount || 0) > 0;
  const netTotal = orderTotal - (order.discount_amount || 0);
  const outstandingAmount = netTotal - (order.total_paid || 0);

  const actualPaymentStatus: PaymentStatus = outstandingAmount <= 0 && netTotal > 0
    ? 'FULL_PAYMENT'
    : outstandingAmount > 0 && outstandingAmount < netTotal
      ? 'PARTIAL_PAYMENT'
      : order.payment_status || 'READY_FOR_PAYMENT';

  return (
    <div className="min-h-screen bg-slate-50/50 pb-24 sm:pb-20 font-sans">
      <div className="max-w-[1240px] mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-4 sm:space-y-8 font-sans">

        {/* Navigation - touch-friendly on mobile */}
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors group mb-1 sm:mb-2 py-2 -ml-1 min-h-[44px]"
        >
          <div className="p-1.5 rounded-full group-hover:bg-slate-200 transition-colors">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform duration-200" />
          </div>
          Back to Orders
        </button>

        {/* 1. HERO HEADER CARD - Redesigned for Mobile */}
        {/* Dynamic color scheme based on status */}
        {(() => {
          // Define color schemes for each status - using white/light colors for maximum contrast
          const getStatusColors = () => {
            if (order.is_on_hold) {
              return {
                gradient: 'bg-gradient-to-br from-amber-600 via-orange-500 to-amber-700',
                textPrimary: 'text-white',
                textSecondary: 'text-orange-100',
                textMuted: 'text-orange-200/80',
                badgeBg: 'bg-white/20 border-white/30',
              };
            }
            if (order.status === 'ORDER_COMPLETED') {
              return {
                gradient: 'bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-700',
                textPrimary: 'text-white',
                textSecondary: 'text-emerald-100',
                textMuted: 'text-emerald-200/80',
                badgeBg: 'bg-white/20 border-white/30',
              };
            }
            if (order.status === 'READY_FOR_PAYMENT') {
              return {
                gradient: 'bg-gradient-to-br from-teal-600 via-cyan-600 to-blue-700',
                textPrimary: 'text-white',
                textSecondary: 'text-cyan-100',
                textMuted: 'text-cyan-200/80',
                badgeBg: 'bg-white/20 border-white/30',
              };
            }
            if (order.status === 'ORDER_CREATED') {
              return {
                gradient: 'bg-gradient-to-br from-violet-600 via-purple-500 to-indigo-700',
                textPrimary: 'text-white',
                textSecondary: 'text-violet-100',
                textMuted: 'text-violet-200/80',
                badgeBg: 'bg-white/20 border-white/30',
              };
            }
            // Default (PENDING, DRAFT, etc.)
            return {
              gradient: 'bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-800',
              textPrimary: 'text-white',
              textSecondary: 'text-blue-100',
              textMuted: 'text-blue-200/80',
              badgeBg: 'bg-white/20 border-white/30',
            };
          };
          const colors = getStatusColors();

          return (
            <div className="bg-white rounded-2xl sm:rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden relative group">

              {/* Main Gradient Background - Dynamic based on status */}
              <div className={`absolute inset-0 pointer-events-none transition-all duration-500 ${colors.gradient}`} />

              {/* Decorative Pattern - hidden on mobile */}
              <div className="absolute top-0 right-0 p-0 opacity-10 pointer-events-none mix-blend-overlay hidden lg:block">
                <Package className="w-96 h-96 -translate-y-12 translate-x-12 rotate-12 text-white" />
              </div>

              {/* MOBILE LAYOUT (< md) */}
              <div className="relative z-10 md:hidden">
                {/* Compact Header Content */}
                <div className="p-4 text-white">
                  {/* Top Row: Order # + Status */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-full ${colors.badgeBg} text-[10px] font-bold uppercase tracking-wider ${colors.textPrimary}`}>
                        #{order.order_number}
                      </span>
                      {order.is_locked && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/30 border border-amber-400/40 text-amber-100 text-[10px] font-bold uppercase">
                          <Lock className="w-2.5 h-2.5" /> Locked
                        </span>
                      )}
                    </div>
                    <div className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide ${order.is_on_hold
                      ? 'bg-white/25 text-white border border-white/30'
                      : order.status === 'ORDER_COMPLETED' || order.status === 'READY_FOR_PAYMENT'
                        ? 'bg-white/25 text-white border border-white/30'
                        : `${colors.badgeBg} ${colors.textPrimary}`
                      }`}>
                      {order.is_on_hold ? 'HOLD' : order.status.replace(/_/g, ' ')}
                    </div>
                  </div>

                  {/* Customer Name */}
                  <h1 className={`text-xl font-bold ${colors.textPrimary} mb-1.5 truncate`}>
                    {order.customer?.name || 'Unknown Customer'}
                  </h1>

                  {/* Sold By (if exists) */}
                  {order.sold_by_name && (
                    <div className={`text-[11px] ${colors.textSecondary} font-medium mb-2 flex items-center gap-1`}>
                      <User className="w-3 h-3" /> Sold by {order.sold_by_name}
                    </div>
                  )}

                  {/* Customer Details - Compact inline row */}
                  <div className={`flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] ${colors.textSecondary} mb-3`}>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 opacity-80" />
                      {new Date(order.order_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    <span className="opacity-50">•</span>
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3 opacity-80" />
                      {order.customer?.customer_type}
                    </span>
                    {order.customer?.phone && (
                      <>
                        <span className="opacity-50">•</span>
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 opacity-80" />
                          {order.customer.phone}
                        </span>
                      </>
                    )}
                    {order.customer?.address && (
                      <>
                        <span className="opacity-50">•</span>
                        <span className="flex items-center gap-1 truncate max-w-[150px]">
                          <MapPin className="w-3 h-3 opacity-80 shrink-0" />
                          <span className="truncate">{order.customer.address}</span>
                        </span>
                      </>
                    )}
                  </div>

                  {/* Net Amount - Clean inline without box */}
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[10px] font-semibold ${colors.textSecondary} uppercase tracking-wider`}>Net Payable</span>
                    <div className="flex items-baseline gap-1.5">
                      <span className={`text-2xl font-black ${colors.textPrimary}`}>₹{netTotal.toLocaleString('en-IN', { minimumFractionDigits: 0 })}</span>
                      {hasDiscount && (
                        <span className={`text-[10px] ${colors.textMuted} line-through`}>₹{order.total_amount.toLocaleString('en-IN')}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Mobile Action Bar - Premium pill buttons */}
                <div className="px-5 pb-6 pt-3">
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button
                      onClick={async () => {
                        setShowOrderLogModal(true);
                        setLoadingOrderLog(true);
                        try {
                          let entries = await getOrderAuditLog(orderId);
                          if (!entries?.length) { await backfillOrderAuditLog(orderId); entries = await getOrderAuditLog(orderId); }
                          setOrderLogEntries(entries || []);
                        } catch { setOrderLogEntries([]); } finally { setLoadingOrderLog(false); }
                      }}
                      className="px-3 py-2 rounded-full bg-white/90 text-slate-700 text-[11px] font-semibold flex items-center gap-1.5 active:scale-95 touch-manipulation shadow-md hover:bg-white transition-all"
                    >
                      <History className="w-3.5 h-3.5 text-slate-500" /> History
                    </button>
                    {hasWriteAccess && (
                      <button
                        onClick={() => setIsInvoiceGeneratorOpen(true)}
                        className="px-3 py-2 rounded-full bg-white/90 text-slate-700 text-[11px] font-semibold flex items-center gap-1.5 active:scale-95 touch-manipulation shadow-md hover:bg-white transition-all"
                      >
                        <FileText className="w-3.5 h-3.5 text-slate-500" /> Invoice
                      </button>
                    )}
                    {hasWriteAccess && !order.is_locked && (
                      <button
                        onClick={() => !order.is_on_hold ? setShowHoldModal(true) : handleRemoveHold()}
                        className={`px-3 py-2 rounded-full text-[11px] font-semibold flex items-center gap-1.5 active:scale-95 touch-manipulation shadow-md transition-all ${order.is_on_hold
                          ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                          : 'bg-white/90 text-slate-700 hover:bg-white'
                          }`}
                      >
                        {order.is_on_hold ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5 text-slate-500" />}
                        {order.is_on_hold ? 'Resume' : 'Hold'}
                      </button>
                    )}
                    {hasWriteAccess && !order.is_locked && (
                      <button
                        onClick={handleDeleteOrder}
                        className="p-2 rounded-full bg-white/90 text-red-500 flex items-center justify-center active:scale-95 touch-manipulation shadow-md hover:bg-red-50 hover:text-red-600 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* DESKTOP LAYOUT (>= md) */}
              <div className="relative z-10 hidden md:block">
                <div className="p-6 lg:p-10 text-white">
                  <div className="flex flex-row justify-between items-start gap-8">
                    {/* Left: Identity & Customer Info */}
                    <div className="flex items-start gap-6 min-w-0 flex-1">
                      <div className="p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-inner shrink-0">
                        <Package className="w-10 h-10 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-3 mb-2">
                          <span className={`px-3 py-1 rounded-full ${colors.badgeBg} ${colors.textPrimary} text-xs font-bold uppercase tracking-widest shadow-sm whitespace-nowrap`}>
                            Order #{order.order_number}
                          </span>
                          {order.is_locked && (
                            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 backdrop-blur-sm border border-amber-400/30 text-amber-100 text-xs font-bold uppercase tracking-widest whitespace-nowrap">
                              <Lock className="w-3 h-3 shrink-0" /> Locked
                            </span>
                          )}
                          {order.sold_by_name && (
                            <span className={`px-3 py-1 rounded-full ${colors.badgeBg} ${colors.textSecondary} text-xs font-bold uppercase tracking-widest flex items-center gap-1.5 max-w-full truncate`}>
                              <User className="w-3 h-3 shrink-0" /> <span className="truncate">Sold by {order.sold_by_name}</span>
                            </span>
                          )}
                        </div>

                        <div className="group flex items-center gap-3 mb-4 min-w-0">
                          <h1 className={`text-3xl lg:text-5xl font-extrabold tracking-tight ${colors.textPrimary} drop-shadow-sm truncate min-w-0`}>
                            {order.customer?.name || 'Unknown Customer'}
                          </h1>
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/sales/customers/${order.customer_id}`); }}
                            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/50 hover:text-white transition-all opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100"
                            title="View Customer Profile"
                          >
                            <ArrowLeft className="w-5 h-5 rotate-180" />
                          </button>
                        </div>

                        <div className={`grid grid-cols-2 gap-x-8 gap-y-2 ${colors.textMuted} text-sm font-medium`}>
                          <div className="flex items-center gap-2 min-w-0">
                            <Calendar className="w-4 h-4 shrink-0" />
                            <span>{new Date(order.order_date).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                          </div>
                          <div className="flex items-center gap-2 min-w-0">
                            <User className="w-4 h-4 shrink-0" />
                            <span className="truncate">Type: {order.customer?.customer_type}</span>
                          </div>
                          {order.customer?.phone && (
                            <div className="flex items-center gap-2 min-w-0">
                              <Phone className="w-4 h-4 shrink-0" />
                              <span className="truncate">{order.customer.phone}</span>
                            </div>
                          )}
                          {order.customer?.address && (
                            <div className="flex items-start gap-2 col-span-2 min-w-0">
                              <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
                              <span className="break-words max-w-full" title={order.customer.address}>{order.customer.address}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Status & Total */}
                    <div className="flex flex-col items-end gap-6 text-right shrink-0 min-w-0">
                      <div className="flex flex-wrap gap-2 justify-end">
                        <button
                          onClick={async () => {
                            setShowOrderLogModal(true);
                            setLoadingOrderLog(true);
                            try {
                              let entries = await getOrderAuditLog(orderId);
                              if (!entries?.length) { await backfillOrderAuditLog(orderId); entries = await getOrderAuditLog(orderId); }
                              setOrderLogEntries(entries || []);
                            } catch { setOrderLogEntries([]); } finally { setLoadingOrderLog(false); }
                          }}
                          className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 text-xs font-bold text-white transition-all flex items-center gap-2 active:scale-95"
                        >
                          <History className="w-3.5 h-3.5 shrink-0" /> History
                        </button>
                        <div className={`px-4 py-2 rounded-xl backdrop-blur-md border text-xs font-bold uppercase tracking-widest shadow-lg flex items-center gap-2 ${order.is_on_hold
                          ? 'bg-white/25 text-white border-white/30'
                          : order.status === 'ORDER_COMPLETED' || order.status === 'READY_FOR_PAYMENT'
                            ? 'bg-white/25 text-white border-white/30'
                            : 'bg-white/15 text-white border-white/20'
                          }`}>
                          {(order.status === 'READY_FOR_PAYMENT' || order.status === 'ORDER_COMPLETED') && <CheckCircle2 className="w-3.5 h-3.5" />}
                          {order.is_on_hold ? 'HOLD' : order.status.replace(/_/g, ' ')}
                        </div>
                      </div>

                      {/* Net Payable - Clean design without box */}
                      <div className="text-right">
                        <div className={`${colors.textSecondary} text-xs font-bold uppercase tracking-widest mb-1`}>Net Payable Amount</div>
                        <div className="flex items-baseline gap-2 justify-end">
                          <span className={`text-xs ${colors.textSecondary} font-medium`}>INR</span>
                          <span className={`text-4xl font-black ${colors.textPrimary} tracking-tight`}>
                            {netTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        {hasDiscount && (
                          <div className={`text-xs ${colors.textMuted} mt-1 line-through`}>
                            MRP: ₹{order.total_amount.toLocaleString('en-IN')}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Desktop Quick Actions Footer */}
                <div className="bg-white px-6 lg:px-10 py-5 border-t border-slate-50 flex flex-wrap gap-3 items-center justify-between">
                  <div className="flex flex-wrap gap-3">
                    {hasWriteAccess && (
                      <button
                        onClick={() => setIsInvoiceGeneratorOpen(true)}
                        className="px-5 py-2.5 bg-slate-50 text-slate-700 text-sm font-bold rounded-xl hover:bg-slate-100 border border-slate-200 hover:border-slate-300 transition-all shadow-sm flex items-center gap-2 active:scale-95 group"
                      >
                        <FileText className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors shrink-0" />
                        <span>Invoice</span>
                      </button>
                    )}
                    {hasWriteAccess && !order.is_locked && (
                      <button
                        onClick={() => !order.is_on_hold ? setShowHoldModal(true) : handleRemoveHold()}
                        className={`px-5 py-2.5 text-sm font-bold rounded-xl transition-all shadow-sm flex items-center gap-2 active:scale-95 border ${order.is_on_hold
                          ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                          }`}
                      >
                        {order.is_on_hold ? <Play className="w-4 h-4 shrink-0" /> : <Pause className="w-4 h-4 shrink-0" />}
                        {order.is_on_hold ? 'Resume Order' : 'Hold Order'}
                      </button>
                    )}
                  </div>
                  {hasWriteAccess && !order.is_locked && (
                    <button
                      onClick={handleDeleteOrder}
                      className="px-5 py-2.5 text-red-600 text-sm font-bold rounded-xl hover:bg-red-50 border border-transparent hover:border-red-100 transition-all flex items-center gap-2 opacity-80 hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4 shrink-0" /> Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Lock Timer (Floating) */}
        {
          order.status === 'ORDER_COMPLETED' && (
            <div className="animate-in slide-in-from-top-4 fade-in duration-500">
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
          )
        }

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-start">

          {/* LEFT CONTENT AREA (8 Cols) */}
          <div className="lg:col-span-8 flex flex-col gap-4 sm:gap-5 min-w-0">

            {/* Items Card */}
            <div className="bg-white border border-slate-100 rounded-2xl sm:rounded-[2rem] shadow-[0_2px_20px_rgb(0,0,0,0.03)] overflow-hidden">
              <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 border-b border-slate-50 flex flex-row items-center justify-between gap-3 bg-white sticky top-0 z-20">
                <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center text-blue-600 shadow-sm border border-blue-100/50 shrink-0">
                    <Package className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base sm:text-lg font-bold text-slate-900">Order Items</h2>
                    <div className="text-xs text-slate-500 font-medium mt-0.5 flex flex-wrap gap-1 sm:gap-2">
                      <span>{order.items.length} products</span>
                      <span className="text-slate-300 hidden sm:inline">•</span>
                      <span className="text-emerald-600">Verified Stock</span>
                    </div>
                  </div>
                </div>
                {hasWriteAccess && !order.is_locked && (
                  <button
                    onClick={handleAddItem}
                    className="w-10 h-10 sm:w-auto sm:h-auto sm:px-4 sm:py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-slate-900/10 hover:shadow-slate-900/20 flex items-center justify-center gap-2 active:scale-95 touch-manipulation shrink-0"
                  >
                    <Plus className="w-5 h-5 sm:w-4 sm:h-4 shrink-0" /><span className="hidden sm:inline">Add Item</span>
                  </button>
                )}
              </div>

              <div className="p-2 sm:p-4 bg-slate-50/30">
                {order.items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 sm:py-16 text-center text-slate-400 bg-white rounded-2xl sm:rounded-3xl border border-dashed border-slate-200 m-2">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 bg-slate-50 rounded-full flex items-center justify-center mb-3 sm:mb-4">
                      <ShoppingBag className="w-7 h-7 sm:w-8 sm:h-8 text-slate-300" />
                    </div>
                    <p className="font-semibold text-slate-700 text-base sm:text-lg">Your cart is empty</p>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xs mx-auto px-2">Start adding products to build this order.</p>
                    <button onClick={handleAddItem} className="mt-4 sm:mt-6 px-5 py-2.5 sm:py-2 bg-blue-50 text-blue-600 text-sm font-bold rounded-xl hover:bg-blue-100 transition-colors min-h-[44px] touch-manipulation">
                      Add First Item
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 sm:space-y-3">
                    {order.items.map((item, index) => (
                      <div key={item.id} className="group bg-white p-4 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-100 transition-all duration-200 flex flex-col sm:flex-row gap-3 sm:gap-5 items-stretch sm:items-center">
                        {/* Item Index/Image Placeholder */}
                        <div className="hidden sm:flex w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 items-center justify-center text-slate-400 font-bold text-sm shrink-0 uppercase">
                          {item.product_type.substring(0, 2)}
                        </div>

                        <div className="flex-1 min-w-0 text-center sm:text-left">
                          <h3 className="font-bold text-slate-900 text-base sm:text-lg mb-1 truncate sm:whitespace-normal">{item.product_type}</h3>
                          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 sm:gap-2">
                            {item.processed_good_batch_reference && (
                              <span className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg bg-blue-50 text-blue-700 text-[10px] font-bold uppercase tracking-wider border border-blue-100 truncate max-w-full">
                                {item.processed_good_batch_reference}
                              </span>
                            )}
                            {(item.form || item.size) && (
                              <div className="flex items-center text-[10px] sm:text-xs text-slate-500 font-medium bg-slate-50 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg border border-slate-100">
                                {item.form && <span className="mr-1.5 sm:mr-2">{item.form}</span>}
                                {item.form && item.size && <span className="w-1 h-1 rounded-full bg-slate-300 mr-1.5 sm:mr-2 shrink-0"></span>}
                                {item.size && <span>{item.size}</span>}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Qty & Price & Actions - row on mobile for clarity */}
                        <div className="flex flex-wrap items-center gap-3 sm:gap-8 justify-between sm:justify-end w-full sm:w-auto border-t sm:border-t-0 border-slate-100 pt-3 sm:pt-0">
                          <div className="text-left sm:text-right">
                            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-0.5">Qty</div>
                            <div className="text-sm font-bold text-slate-700">
                              {item.quantity} <span className="text-xs font-medium text-slate-400">{item.unit}</span>
                            </div>
                          </div>
                          <div className="text-left sm:text-right">
                            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-0.5">Total</div>
                            <div className="text-base sm:text-lg font-bold text-slate-900">
                              ₹{item.line_total.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                            </div>
                          </div>

                          {/* Actions - touch-friendly on mobile */}
                          {hasWriteAccess && !order.is_locked && (
                            <div className="flex gap-1 sm:ml-2">
                              <button
                                onClick={() => handleEditItem(item)}
                                className="w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors touch-manipulation"
                                aria-label="Edit item"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => { if (confirm('Remove item?')) handleDeleteItem(item.id); }}
                                className="w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors touch-manipulation"
                                aria-label="Remove item"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Inventory Note (Integrated) */}
              <div className="px-4 sm:px-6 py-2.5 sm:py-3 bg-blue-50/30 border-t border-blue-50 flex items-center gap-2 sm:gap-3">
                <Info className="w-4 h-4 text-blue-400 shrink-0" />
                <p className="text-[10px] text-blue-700 font-medium">Stock is automatically deducted when items are added.</p>
              </div>
            </div>

            {/* Notes Section (Moved) */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-[2rem] border border-slate-100 shadow-sm">
              <div className="flex items-center gap-2 mb-2 sm:mb-3">
                <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                <h3 className="text-sm font-bold text-slate-900">Notes</h3>
              </div>
              {hasWriteAccess && !order.is_locked ? (
                <div className="relative">
                  <textarea
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    placeholder="Add notes..."
                    className="w-full text-sm p-4 bg-slate-50 border-0 rounded-xl focus:ring-2 focus:ring-blue-500/20 text-slate-700 min-h-[100px] resize-none transition-all placeholder:text-slate-400"
                  />
                  {orderNotes !== (order.notes ?? '') && (
                    <button
                      onClick={async () => {
                        setSavingNotes(true);
                        try { await saveOrder(orderId, { notes: orderNotes }, { currentUserId: user?.id }); await loadOrder(); } finally { setSavingNotes(false); }
                      }}
                      className="absolute bottom-3 right-3 px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-lg shadow hover:bg-slate-800 transition-colors"
                    >
                      {savingNotes ? 'Saving...' : 'Save Notes'}
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-500 italic bg-slate-50 p-4 rounded-xl">
                  {order.notes || "No notes available."}
                </p>
              )}
            </div>

            {/* Third Party Section - White box like Notes */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl sm:rounded-[2rem] border border-slate-100 shadow-sm">
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
            </div>
          </div>


          {/* RIGHT SIDEBAR (4 Cols) */}
          <div className="lg:col-span-4 flex flex-col gap-4 sm:gap-5 sticky top-4 sm:top-6 min-w-0">

            {/* FINANCIAL SUMMARY CARD (Redesigned) */}
            <div className="bg-white rounded-2xl sm:rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-slate-100 overflow-hidden transform transition-all hover:shadow-[0_8px_40px_rgb(0,0,0,0.08)]">
              {/* Header */}
              <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-50 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-xl shadow-sm border border-slate-100">
                    <CreditCard className="w-4 h-4 text-slate-700" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm tracking-tight">Payment Details</h3>
                </div>
                {hasWriteAccess && !order.is_locked && (
                  <button
                    type="button"
                    onClick={() => setShowDiscountInput(!showDiscountInput)}
                    className="text-[10px] font-bold uppercase tracking-wider text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-2 sm:py-1 rounded-full transition-colors min-h-[44px] sm:min-h-0 touch-manipulation"
                  >
                    {hasDiscount ? 'Edit Discount' : 'Add Discount'}
                  </button>
                )}
              </div>

              <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                {/* Main Amount */}
                <div className="text-center py-1 sm:py-2">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Due</p>
                  <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight break-all">
                    ₹{Math.max(0, outstandingAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </p>
                  {actualPaymentStatus === 'PARTIAL_PAYMENT' && (
                    <div className="mt-4 relative">
                      <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                        <span>Progress</span>
                        <span>{Math.round(((order.total_paid || 0) / netTotal) * 100)}% Paid</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.3)] transition-all duration-700 ease-out"
                          style={{ width: `${Math.min(100, ((order.total_paid || 0) / netTotal) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Detailed Stats Cards */}
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-slate-50 border border-slate-100 min-w-0">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5 sm:mb-1">Subtotal</p>
                    <p className="font-bold text-slate-700 text-sm sm:text-base truncate">₹{order.total_amount.toLocaleString('en-IN')}</p>
                  </div>
                  <div className={`p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border min-w-0 ${hasDiscount ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-100'}`}>
                    <p className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 sm:mb-1 ${hasDiscount ? 'text-amber-600' : 'text-slate-400'}`}>Discount</p>

                    {showDiscountInput ? (
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <input
                          type="number"
                          autoFocus
                          className="w-full min-w-0 bg-transparent border-b-2 border-amber-500 text-sm font-bold text-amber-900 focus:outline-none p-0"
                          value={discountAmount}
                          onChange={e => setDiscountAmount(parseFloat(e.target.value) || 0)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleApplyDiscount();
                            if (e.key === 'Escape') {
                              setShowDiscountInput(false);
                              setDiscountAmount(order.discount_amount || 0);
                            }
                          }}
                        />
                        <button
                          onClick={handleApplyDiscount}
                          className="w-6 h-6 flex items-center justify-center bg-green-500 hover:bg-green-600 text-white rounded-full shadow-sm transition-all hover:scale-110 shrink-0"
                          title="Apply"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => { setShowDiscountInput(false); setDiscountAmount(order.discount_amount || 0); }}
                          className="w-6 h-6 flex items-center justify-center bg-slate-200 hover:bg-slate-300 text-slate-600 rounded-full shadow-sm transition-all hover:scale-110 shrink-0"
                          title="Cancel"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <p className={`font-bold text-sm sm:text-base truncate ${hasDiscount ? 'text-amber-700' : 'text-slate-700'}`}>
                        -₹{(order.discount_amount || 0).toLocaleString('en-IN')}
                      </p>
                    )}
                  </div>
                  <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-emerald-50 border border-emerald-100 min-w-0">
                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-0.5 sm:mb-1">Paid</p>
                    <p className="font-bold text-emerald-700 text-sm sm:text-base truncate">₹{(order.total_paid || 0).toLocaleString('en-IN')}</p>
                  </div>
                  <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-slate-900 border border-slate-900 min-w-0">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5 sm:mb-1">Net Total</p>
                    <p className="font-bold text-white text-sm sm:text-base truncate">₹{netTotal.toLocaleString('en-IN')}</p>
                  </div>
                </div>

                {/* Action Button - touch-friendly on mobile */}
                {hasWriteAccess && !order.is_locked && (
                  <button
                    onClick={() => setIsPaymentFormOpen(true)}
                    disabled={netTotal <= 0}
                    className="w-full py-3.5 sm:py-3.5 min-h-[48px] bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-xl font-bold text-sm shadow-xl shadow-slate-900/10 hover:shadow-slate-900/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 group touch-manipulation"
                  >
                    <div className="p-1 rounded-full bg-white/10 group-hover:bg-white/20 transition-colors">
                      <Plus className="w-3.5 h-3.5" />
                    </div>
                    Record New Payment
                  </button>
                )}

                {/* Transaction History */}
                {order.payments && order.payments.length > 0 && (
                  <div className="pt-4 border-t border-slate-50 mt-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Recent Transactions</p>
                    <div className="space-y-2">
                      {order.payments.map((payment) => (
                        <div key={payment.id} className="flex items-center text-sm group p-2 -mx-2 rounded-xl hover:bg-slate-50 transition-colors">
                          {/* Payment Info - Clickable */}
                          <div
                            className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                            onClick={() => navigate(`/finance/income?focus=${payment.id}`)}
                            title="View details in Finance"
                          >
                            <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shadow-sm shrink-0 ${payment.payment_mode === 'Cash' ? 'bg-green-50 border-green-100 text-green-600' :
                              payment.payment_mode === 'UPI' ? 'bg-indigo-50 border-indigo-100 text-indigo-600' :
                                'bg-blue-50 border-blue-100 text-blue-600'
                              }`}>
                              {payment.payment_mode === 'Cash' ? <Banknote className="w-4 h-4" /> : payment.payment_mode === 'UPI' ? <QrCode className="w-4 h-4" /> : <Landmark className="w-4 h-4" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-slate-700 truncate">₹{payment.amount_received.toLocaleString('en-IN')}</p>
                              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide truncate">{new Date(payment.payment_date).toLocaleDateString()}</p>
                            </div>
                          </div>

                          {/* Action Buttons - Always visible on mobile */}
                          <div className="flex items-center gap-1 shrink-0 ml-2">
                            <button
                              onClick={() => navigate(`/finance/income?focus=${payment.id}`)}
                              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all touch-manipulation"
                              title="View in Finance"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </button>
                            {hasWriteAccess && !order.is_locked && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeletePayment(payment.id); }}
                                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all touch-manipulation"
                                title="Delete payment"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>



          </div>

        </div>
      </div>

      {/* Internal Item Form Modal */}
      {isItemFormOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <OrderItemFormModal
            isOpen={isItemFormOpen}
            onClose={() => { setIsItemFormOpen(false); setEditingItem(null); }}
            onSubmit={handleSaveItem}
            editingItem={editingItem}
            processedGoods={processedGoods}

            allProducedGoodsTags={allProducedGoodsTags}
            loadingProducts={loadingProducts}
            savingItem={savingItem}
          />
        </div>
      )}

      {/* Other Modals */}
      <PaymentForm
        isOpen={isPaymentFormOpen}
        onClose={() => setIsPaymentFormOpen(false)}
        onSubmit={handleCreatePayment}
        defaultOrderId={order?.id}
      />

      {
        order && (
          <InvoiceGenerator
            isOpen={isInvoiceGeneratorOpen}
            onClose={() => setIsInvoiceGeneratorOpen(false)}
            orderId={order.id}
          />
        )
      }

      {
        order && (
          <CelebrationModal
            isOpen={showCelebration}
            onClose={() => setShowCelebration(false)}
            orderNumber={order.order_number}
            totalAmount={order.total_amount}
          />
        )
      }

      {/* Hold Modal - mobile friendly */}
      {
        showHoldModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-4 sm:p-6 my-auto max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-3 sm:mb-4 flex items-center gap-2">
                <Pause className="w-5 h-5 text-amber-500 shrink-0" />
                Put Order On Hold
              </h3>
              <p className="text-slate-600 mb-3 sm:mb-4 text-sm">
                Please provide a reason for putting this order on hold. The order will not be processed further until resumed.
              </p>
              <textarea
                className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-slate-900 mb-4"
                rows={3}
                placeholder="Enter reason..."
                value={holdReason}
                onChange={(e) => setHoldReason(e.target.value)}
                autoFocus
              />
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
                <ModernButton
                  variant="ghost"
                  onClick={() => setShowHoldModal(false)}
                  disabled={settingHold}
                  className="min-h-[44px] sm:min-h-0 w-full sm:w-auto"
                >
                  Cancel
                </ModernButton>
                <ModernButton
                  onClick={handleSetHold}
                  disabled={settingHold || !holdReason.trim()}
                  loading={settingHold}
                  variant="primary"
                  className="bg-amber-500 hover:bg-amber-600 text-white border-0 min-h-[44px] sm:min-h-0 w-full sm:w-auto"
                >
                  Set Hold
                </ModernButton>
              </div>
            </div>
          </div>
        )
      }

      {/* Order Log Modal - mobile friendly */}
      {
        showOrderLogModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] sm:max-h-[85vh] flex flex-col animate-in fade-in zoom-in duration-200 my-auto">
              <div className="p-4 sm:p-6 border-b border-slate-100 flex justify-between items-center shrink-0">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2 min-w-0">
                  <History className="w-5 h-5 text-slate-500 shrink-0" />
                  <span className="truncate">Order History</span>
                </h3>
                <button onClick={() => setShowOrderLogModal(false)} className="p-2 -mr-2 text-slate-400 hover:text-slate-600 touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0" aria-label="Close">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-y-auto p-4 sm:p-6 flex-1 min-h-0">
                {loadingOrderLog ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
                  </div>
                ) : orderLogEntries.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <History className="w-12 h-12 mx-auto mb-3 text-slate-200" />
                    <p>No history available</p>
                  </div>
                ) : (
                  <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                    {orderLogEntries.map((entry) => (
                      <div key={entry.id} className="relative flex items-start group">
                        <div className="absolute left-0 mt-1 ml-2.5 -translate-x-1/2 w-4 h-4 rounded-full border-2 border-white bg-slate-300 group-hover:bg-blue-500 transition-colors shadow-sm"></div>
                        <div className="ml-10 min-w-0 flex-1">
                          <div className="text-sm font-medium text-slate-900">
                            {formatOrderLogEventType(entry.event_type, entry)}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {new Date(entry.performed_at).toLocaleString()} by <span className="font-medium text-slate-700">{entry.performed_by_name || 'System'}</span>
                          </div>
                          {entry.event_data && Object.keys(entry.event_data).length > 0 && (
                            <div className="mt-2 text-xs bg-slate-50 p-2 rounded border border-slate-100 font-mono text-slate-600 overflow-x-auto">
                              {JSON.stringify(entry.event_data, null, 2)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-3 sm:p-4 border-t border-slate-100 text-right sm:text-right bg-slate-50 rounded-b-xl shrink-0">
                <ModernButton onClick={() => setShowOrderLogModal(false)} variant="secondary" size="sm" className="min-h-[44px] sm:min-h-0 w-full sm:w-auto touch-manipulation">Close</ModernButton>
              </div>
            </div>
          </div>
        )
      }

    </div >
  );
}

// Internal component for Add/Edit Item Modal
function OrderItemFormModal({
  isOpen,
  onClose,
  onSubmit,
  editingItem,
  processedGoods,
  allProducedGoodsTags,
  loadingProducts,
  savingItem
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: OrderItemFormData) => void;
  editingItem: OrderItem | null;
  processedGoods: Array<ProcessedGood & { actual_available: number }>;
  allProducedGoodsTags: ProducedGoodsTag[];
  loadingProducts: boolean;
  savingItem: boolean;
}) {
  if (!isOpen) return null;

  const [formData, setFormData] = useState<OrderItemFormData>({
    processed_good_id: '',
    product_type: '',
    form: '',
    size: '',
    quantity: 0,
    unit_price: 0,
    unit: 'kg', // Default unit
  });

  const ALL_TAGS_SENTINEL = '__all__';

  // Derived state for inventory check
  const [selectedProduct, setSelectedProduct] = useState<ProcessedGood & { actual_available: number } | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([ALL_TAGS_SENTINEL]);
  const [itemTagDropdownOpen, setItemTagDropdownOpen] = useState(false);
  const [tagSearchTerm, setTagSearchTerm] = useState('');
  const itemTagDropdownRef = useRef<HTMLDivElement>(null);

  // Clear search on close
  useEffect(() => {
    if (!itemTagDropdownOpen) setTagSearchTerm('');
  }, [itemTagDropdownOpen]);

  // Assigned item tag only (tags assigned when item is on production) — no product_type fallback
  const getAssignedTagName = (p: ProcessedGood & { actual_available: number }): string => {
    return p.produced_goods_tag_name ?? '';
  };

  // Item Tag dropdown: show all active assigned tags (from tags table) so every tag from production appears
  const assignedItemTags = useMemo(() => {
    if (allProducedGoodsTags.length > 0) {
      return [...allProducedGoodsTags].map(t => t.display_name).sort();
    }
    const tagMap = new Map<string, string>();
    processedGoods.forEach(p => {
      const tagName = getAssignedTagName(p);
      if (tagName) {
        const normalized = tagName.toLowerCase();
        if (!tagMap.has(normalized)) tagMap.set(normalized, tagName);
      }
    });
    return Array.from(tagMap.values()).sort();
  }, [allProducedGoodsTags, processedGoods]);

  // Filter tags for dropdown based on search
  const filteredDropdownTags = useMemo(() => {
    if (!tagSearchTerm.trim()) return assignedItemTags;
    return assignedItemTags.filter(tag => tag.toLowerCase().includes(tagSearchTerm.toLowerCase()));
  }, [assignedItemTags, tagSearchTerm]);

  const isAllTagsSelected = selectedTags.includes(ALL_TAGS_SENTINEL);
  const filteredGoods = useMemo(() => {
    if (selectedTags.length === 0) return processedGoods;
    if (isAllTagsSelected) return processedGoods;
    return processedGoods.filter(p => selectedTags.includes(getAssignedTagName(p)));
  }, [processedGoods, selectedTags, isAllTagsSelected]);

  const toggleTag = (tag: string) => {
    if (tag === ALL_TAGS_SENTINEL) {
      setSelectedTags(selectedTags.includes(ALL_TAGS_SENTINEL) ? [] : [ALL_TAGS_SENTINEL]);
      setFormData(prev => ({ ...prev, processed_good_id: '' }));
      setSelectedProduct(null);
      return;
    }
    setSelectedTags(prev => {
      const withoutAll = prev.filter(t => t !== ALL_TAGS_SENTINEL);
      const hasTag = withoutAll.includes(tag);
      const next = hasTag ? withoutAll.filter(t => t !== tag) : [...withoutAll, tag];
      if (next.length === 0) {
        setFormData(prev => ({ ...prev, processed_good_id: '' }));
        setSelectedProduct(null);
      }
      return next;
    });
    setFormData(prev => ({ ...prev, processed_good_id: '' }));
    setSelectedProduct(null);
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (itemTagDropdownRef.current && !itemTagDropdownRef.current.contains(event.target as Node)) {
        setItemTagDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (editingItem) {
      setFormData({
        processed_good_id: editingItem.processed_good_id,
        product_type: editingItem.product_type,
        form: editingItem.form || '',
        size: editingItem.size || '',
        quantity: editingItem.quantity,
        unit_price: editingItem.unit_price,
        unit: editingItem.unit,
      });
      const product = processedGoods.find(p => p.id === editingItem.processed_good_id);
      if (product) {
        setSelectedProduct(product);
        const tagName = getAssignedTagName(product);
        if (tagName) {
          const matchingTag = assignedItemTags.find(t => t === tagName);
          setSelectedTags(matchingTag ? [matchingTag] : []);
        } else {
          setSelectedTags([ALL_TAGS_SENTINEL]);
        }
      }
    }
  }, [editingItem, processedGoods, assignedItemTags]);

  const handleProductChange = (productId: string) => {
    const product = processedGoods.find(p => p.id === productId);
    if (product) {
      setSelectedProduct(product);
      setFormData(prev => ({
        ...prev,
        processed_good_id: productId,
        product_type: product.product_type,
        form: (product as any).form || '',
        size: (product as any).size || '',
        unit: product.unit || 'kg',
      }));
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200 my-4 sm:my-0">
      <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
        <h3 className="text-base sm:text-lg font-bold text-slate-900 truncate pr-2">
          {editingItem ? 'Edit Item' : 'Add New Item'}
        </h3>
        <button onClick={onClose} className="p-2 -mr-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation" aria-label="Close">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
        {/* Item Tag: multi-select with "All Tags" option */}
        <div ref={itemTagDropdownRef} className="relative">
          <label className="block text-sm font-semibold text-slate-700 mb-1.5 ml-1">Item Tag</label>
          <button
            type="button"
            onClick={() => setItemTagDropdownOpen(prev => !prev)}
            className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-900 focus:border-slate-900 text-sm font-medium bg-white text-left flex items-center justify-between gap-2"
          >
            <span className="truncate">
              {selectedTags.length === 0
                ? 'Select Item Tag'
                : isAllTagsSelected
                  ? 'All Tags'
                  : selectedTags.length === 1
                    ? selectedTags[0]
                    : `${selectedTags.length} tags selected`}
            </span>
            <ChevronDown className={`w-4 h-4 shrink-0 text-slate-400 transition-transform ${itemTagDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {itemTagDropdownOpen && (
            <div className="absolute z-10 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden flex flex-col">
              {/* Search Bar */}
              <div className="p-2 border-b border-slate-100 bg-slate-50 sticky top-0 z-10">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={tagSearchTerm}
                    onChange={(e) => setTagSearchTerm(e.target.value)}
                    placeholder="Search tags..."
                    autoFocus
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-slate-900 outline-none"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>

              <div className="max-h-60 overflow-y-auto custom-scrollbar">
                <button
                  type="button"
                  onClick={() => toggleTag(ALL_TAGS_SENTINEL)}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 hover:bg-slate-50 text-left text-sm font-medium transition-colors ${tagSearchTerm ? 'hidden' : ''}`}
                >
                  <span className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${isAllTagsSelected ? 'bg-slate-900 border-slate-900' : 'border-slate-300 bg-white'}`}>
                    {isAllTagsSelected && <Check className="w-3 h-3 text-white" />}
                  </span>
                  <span className={isAllTagsSelected ? 'text-slate-900' : 'text-slate-700'}>All Tags</span>
                </button>

                {!tagSearchTerm && <div className="border-t border-slate-100 my-0.5" />}

                {filteredDropdownTags.length > 0 ? (
                  filteredDropdownTags.map(tag => {
                    const checked = selectedTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-slate-50 text-left text-sm font-medium transition-colors"
                      >
                        <span className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${checked ? 'bg-slate-900 border-slate-900' : 'border-slate-300 bg-white'}`}>
                          {checked && <Check className="w-3 h-3 text-white" />}
                        </span>
                        <span className={checked ? 'text-slate-900' : 'text-slate-700'}>{tag}</span>
                      </button>
                    );
                  })
                ) : (
                  <div className="p-4 text-center text-xs text-slate-500">
                    No tags found
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Product Selection */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1.5 ml-1">Select Product</label>
          {loadingProducts ? (
            <div className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 text-sm flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading products...
            </div>
          ) : (
            <ProductDropdown
              processedGoods={filteredGoods}
              value={formData.processed_good_id}
              onChange={handleProductChange}
              disabled={selectedTags.length === 0 && assignedItemTags.length > 0}
            />
          )}
        </div>

        {/* Read-only Details (Auto-filled) */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Type</label>
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 min-h-[42px]">
              {formData.product_type || '-'}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Available</label>
            <div className={`p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold min-h-[42px] ${selectedProduct && selectedProduct.actual_available < 10 ? 'text-amber-600' : 'text-slate-700'
              }`}>
              {selectedProduct ? `${selectedProduct.actual_available} ${selectedProduct.unit}` : '-'}
            </div>
          </div>
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Quantity</label>
            <div className="relative">
              <input
                type="number"
                value={formData.quantity || ''}
                onChange={e => setFormData(prev => ({ ...prev, quantity: parseFloat(e.target.value) }))}
                className={`w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-slate-900 font-medium ${selectedProduct && formData.quantity > (selectedProduct.actual_available + (editingItem?.processed_good_id === selectedProduct.id ? editingItem.quantity : 0))
                  ? 'border-red-300 bg-red-50 text-red-900 focus:border-red-500 focus:ring-red-200'
                  : 'border-slate-300'
                  }`}
                placeholder="0.00"
                step="0.01"
              />
              <div className="absolute right-3 top-2.5 text-slate-400 text-sm font-medium pointer-events-none">
                {formData.unit}
              </div>
            </div>
            {selectedProduct && formData.quantity > (selectedProduct.actual_available + (editingItem?.processed_good_id === selectedProduct.id ? editingItem.quantity : 0)) && (
              <p className="mt-1 text-xs text-red-600 font-medium animate-in slide-in-from-top-1">
                Exceeds available stock ({selectedProduct.actual_available + (editingItem?.processed_good_id === selectedProduct.id ? editingItem.quantity : 0)} {selectedProduct.unit})
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Unit Price</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-400 text-sm font-medium pointer-events-none">₹</span>
              <input
                type="number"
                value={formData.unit_price || ''}
                onChange={e => setFormData(prev => ({ ...prev, unit_price: parseFloat(e.target.value) }))}
                className="w-full pl-7 pr-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-slate-900 font-medium"
                placeholder="0.00"
                step="0.01"
              />
            </div>
          </div>
        </div>

        {/* Total Preview */}
        <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg flex justify-between items-center">
          <span className="text-sm text-blue-800 font-medium">Line Total</span>
          <span className="text-lg font-bold text-blue-900">
            ₹{((formData.quantity || 0) * (formData.unit_price || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>

      </div>

      <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
        <ModernButton variant="ghost" onClick={onClose} disabled={savingItem}>Cancel</ModernButton>
        <ModernButton
          onClick={() => onSubmit(formData)}
          disabled={!formData.processed_good_id || !formData.quantity || !formData.unit_price || savingItem || (!!selectedProduct && formData.quantity > (selectedProduct.actual_available + (editingItem?.processed_good_id === selectedProduct.id ? editingItem.quantity : 0)))}
          loading={savingItem}
          variant="primary"
          className="bg-slate-900 hover:bg-slate-800 text-white border-0"
        >
          {editingItem ? 'Update Item' : 'Add Item'}
        </ModernButton>
      </div>
    </div>
  );
}
