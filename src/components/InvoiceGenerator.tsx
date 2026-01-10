import { useState, useEffect } from 'react';
import { X, FileText, Download, AlertCircle } from 'lucide-react';
import { pdf } from '@react-pdf/renderer';
import { InvoicePDF } from './InvoicePDF';
import { createInvoice, fetchInvoiceByOrder } from '../lib/invoices';
import { fetchOrderWithItems } from '../lib/sales';
import { fetchOrderPayments, getOrderPaymentStatus } from '../lib/sales';
import { fetchCustomer } from '../lib/sales';
import { useAuth } from '../contexts/AuthContext';
import type { InvoiceFormData, InvoiceData, SellerDetails, OrderWithItems } from '../types/sales';

interface InvoiceGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  sellerDetails?: SellerDetails;
  hasWriteAccess?: boolean;
}

const DEFAULT_SELLER_DETAILS: SellerDetails = {
  name: 'Your Company Name',
  address: 'Your Company Address',
  phone: 'Your Phone Number',
  email: 'Your Email',
};

export function InvoiceGenerator({ isOpen, onClose, orderId, sellerDetails, hasWriteAccess = true }: InvoiceGeneratorProps) {
  const { user } = useAuth();
  const [formData, setFormData] = useState<InvoiceFormData>({
    order_id: orderId,
    invoice_date: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [existingInvoice, setExistingInvoice] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && orderId) {
      void loadInvoiceData();
      void checkExistingInvoice();
    }
  }, [isOpen, orderId]);

  const checkExistingInvoice = async () => {
    try {
      const invoice = await fetchInvoiceByOrder(orderId);
      if (invoice) {
        setExistingInvoice(invoice.invoice_number);
      }
    } catch (err) {
      // Ignore errors
    }
  };

  const loadInvoiceData = async () => {
    setLoading(true);
    setError(null);
    try {
      const order = await fetchOrderWithItems(orderId);
      if (!order) {
        setError('Order not found');
        return;
      }

      const payments = await fetchOrderPayments(orderId);
      const paymentStatus = await getOrderPaymentStatus(orderId);
      const totalPaid = payments.reduce((sum, p) => sum + p.amount_received, 0);
      const outstandingAmount = Math.max(0, order.total_amount - totalPaid);

      let customer = null;
      if (order.customer_id) {
        customer = await fetchCustomer(order.customer_id);
      }

      // Store order data without creating invoice yet
      setInvoiceData({
        invoice: {
          id: '',
          invoice_number: '',
          order_id: orderId,
          invoice_date: formData.invoice_date,
          generated_at: new Date().toISOString(),
          notes: formData.notes,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        order,
        customer: customer || undefined,
        payments,
        paymentStatus,
        totalPaid,
        outstandingAmount,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load invoice data';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePDF = async () => {
    if (!invoiceData) {
      await loadInvoiceData();
      if (!invoiceData) return;
    }

    setGenerating(true);
    setError(null);

    try {
      // Create invoice record first
      const invoice = await createInvoice(
        {
          order_id: orderId,
          invoice_date: formData.invoice_date,
          notes: formData.notes,
        },
        { currentUserId: user?.id }
      );

      // Update invoice data with created invoice
      const updatedInvoiceData = {
        ...invoiceData,
        invoice,
      };

      const seller = sellerDetails || DEFAULT_SELLER_DETAILS;
      const blob = await pdf(<InvoicePDF invoiceData={updatedInvoiceData} sellerDetails={seller} />).toBlob();
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${invoice.invoice_number}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate PDF';
      setError(message);
    } finally {
      setGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Generate Invoice</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-start gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="flex-1">{error}</div>
            </div>
          )}

          {existingInvoice && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm">
              <p>
                <strong>Note:</strong> An invoice already exists for this order: <strong>{existingInvoice}</strong>
              </p>
              <p className="mt-1 text-xs">A new invoice will be created with a new invoice number.</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Invoice Date *
              </label>
              <input
                type="date"
                value={formData.invoice_date}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, invoice_date: e.target.value }))
                }
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes (Optional)
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, notes: e.target.value }))
                }
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Additional notes for the invoice"
              />
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-2">Seller Details</h3>
              <div className="text-sm text-gray-600 space-y-1">
                <p><strong>Name:</strong> {sellerDetails?.name || DEFAULT_SELLER_DETAILS.name}</p>
                {sellerDetails?.address && (
                  <p><strong>Address:</strong> {sellerDetails.address}</p>
                )}
                {sellerDetails?.phone && (
                  <p><strong>Phone:</strong> {sellerDetails.phone}</p>
                )}
                {sellerDetails?.email && (
                  <p><strong>Email:</strong> {sellerDetails.email}</p>
                )}
              </div>
              <p className="mt-2 text-xs text-gray-500">
                To update seller details, please configure them in the system settings.
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-700">
                <strong>Note:</strong> The invoice will include:
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>Order and customer details</li>
                  <li>Product variants with quantities delivered</li>
                  <li>Payment status and history</li>
                  <li>Delivery status and progress</li>
                </ul>
                The invoice does NOT affect inventory, payments, or order status.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-gray-200 p-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            disabled={loading || generating}
          >
            Cancel
          </button>
          <button
            onClick={handleGeneratePDF}
            disabled={loading || generating || !hasWriteAccess}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {!hasWriteAccess ? (
              'Read-Only Access'
            ) : loading ? (
              'Loading...'
            ) : generating ? (
              'Generating PDF...'
            ) : (
              <>
                <Download className="w-4 h-4" />
                Generate & Download PDF
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
