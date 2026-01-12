export interface Customer {
  id: string;
  name: string;
  customer_type: 'Hotel' | 'Restaurant' | 'Retail' | 'Direct' | 'Other';
  contact_person?: string;
  phone?: string;
  address?: string;
  status: 'Active' | 'Inactive';
  notes?: string;
  created_at: string;
  created_by?: string;
  updated_at: string;
}

export interface CustomerWithStats extends Customer {
  total_sales_value?: number;
  outstanding_amount?: number;
  last_order_date?: string;
  order_count?: number;
}

export interface CustomerFormData {
  name: string;
  customer_type: 'Hotel' | 'Restaurant' | 'Retail' | 'Direct' | 'Other';
  contact_person?: string;
  phone?: string;
  address?: string;
  status: 'Active' | 'Inactive';
  notes?: string;
}

export type OrderStatus = 'Draft' | 'Confirmed' | 'Partially Delivered' | 'Fully Delivered' | 'Completed' | 'Cancelled';

export interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  customer_name?: string;
  order_date: string;
  status: OrderStatus;
  notes?: string;
  sold_by?: string; // User ID who sold the order
  total_amount: number;
  is_locked: boolean;
  created_at: string;
  created_by?: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  processed_good_id: string;
  product_type: string;
  form?: string;
  size?: string;
  quantity: number;
  quantity_delivered: number;
  unit_price: number;
  unit: string;
  line_total: number;
  created_at: string;
  // Additional fields for display
  processed_good_batch_reference?: string;
  processed_good_quantity_available?: number;
}

export interface OrderReservation {
  id: string;
  order_id: string;
  order_item_id: string;
  processed_good_id: string;
  quantity_reserved: number;
  created_at: string;
}

export interface OrderWithItems extends Order {
  items: OrderItem[];
  customer?: Customer;
}

export interface OrderFormData {
  customer_id: string;
  order_date: string; // ISO datetime string (will extract date part for database)
  status: OrderStatus;
  sold_by?: string; // User ID who sold the order
  items: OrderItemFormData[];
}

export interface OrderItemFormData {
  processed_good_id: string;
  product_type: string;
  form?: string;
  size?: string;
  quantity: number;
  unit_price: number;
  unit: string;
}

export interface DeliveryDispatch {
  id: string;
  order_id: string;
  order_item_id: string;
  processed_good_id: string;
  quantity_delivered: number;
  delivery_date: string;
  notes?: string;
  created_at: string;
  created_by?: string;
}

export interface ProcessedGoodSalesHistory {
  id: string;
  order_id: string;
  order_number: string;
  order_date: string;
  customer_name?: string;
  customer_id: string;
  order_item_id: string;
  product_type: string;
  quantity_delivered: number;
  unit: string;
  unit_price: number;
  line_total: number;
  delivery_date: string;
  delivery_notes?: string;
  created_at: string;
}

export type PaymentMode = 'Cash' | 'UPI' | 'Bank'; // Database format
export type PaymentStatus = 'Pending' | 'Partial' | 'Paid';
import type { PaymentMethod, PaymentTo } from './finance';

export interface OrderPayment {
  id: string;
  order_id: string;
  order_number?: string;
  customer_name?: string;
  payment_date: string;
  payment_mode: PaymentMode;
  transaction_reference?: string;
  evidence_url?: string;
  amount_received: number;
  notes?: string;
  created_at: string;
  created_by?: string;
  updated_at: string;
}

export interface PaymentFormData {
  order_id: string;
  payment_date: string;
  payment_time?: string;
  payment_method: PaymentMethod; // UI format (cash, upi, bank_transfer, etc.)
  payment_to: PaymentTo;
  paid_to_user?: string;
  payment_reference?: string; // Renamed from transaction_reference
  evidence_url?: string;
  amount_received: number;
  notes?: string;
}

export interface OrderWithPaymentInfo extends Order {
  total_paid?: number;
  payment_status?: PaymentStatus;
  payments?: OrderPayment[];
}

export interface Invoice {
  id: string;
  invoice_number: string;
  order_id: string;
  order_number?: string;
  customer_name?: string;
  invoice_date: string;
  generated_at: string;
  generated_by?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface InvoiceFormData {
  order_id: string;
  invoice_date: string;
  notes?: string;
}

export interface InvoiceData {
  invoice: Invoice;
  order: OrderWithItems;
  customer?: Customer;
  payments: OrderPayment[];
  paymentStatus: PaymentStatus;
  totalPaid: number;
  outstandingAmount: number;
}

export interface SellerDetails {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  gstin?: string;
}
