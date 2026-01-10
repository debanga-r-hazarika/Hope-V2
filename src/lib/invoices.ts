import { supabase } from './supabase';
import type { Invoice, InvoiceFormData } from '../types/sales';

function mapDbToInvoice(row: any): Invoice {
  return {
    id: row.id,
    invoice_number: row.invoice_number,
    order_id: row.order_id,
    order_number: row.order?.order_number || row.order_number,
    customer_name: row.order?.customer?.name || row.customer_name,
    invoice_date: row.invoice_date,
    generated_at: row.generated_at,
    generated_by: row.generated_by,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// Generate invoice number
export async function generateInvoiceNumber(): Promise<string> {
  const { data, error } = await supabase.rpc('generate_invoice_number');
  if (error) throw error;
  return data as string;
}

// Create invoice record
export async function createInvoice(
  invoiceData: InvoiceFormData,
  options?: { currentUserId?: string }
): Promise<Invoice> {
  // Generate invoice number
  const invoiceNumber = await generateInvoiceNumber();

  const payload: any = {
    invoice_number: invoiceNumber,
    order_id: invoiceData.order_id,
    invoice_date: invoiceData.invoice_date,
    notes: invoiceData.notes || null,
    generated_by: options?.currentUserId || null,
  };

  const { data, error } = await supabase
    .from('invoices')
    .insert([payload])
    .select('*, order:orders(order_number, customer:customers(name))')
    .single();

  if (error) throw error;
  return mapDbToInvoice(data);
}

// Fetch invoice by ID
export async function fetchInvoice(invoiceId: string): Promise<Invoice | null> {
  const { data, error } = await supabase
    .from('invoices')
    .select('*, order:orders(order_number, customer:customers(name))')
    .eq('id', invoiceId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data ? mapDbToInvoice(data) : null;
}

// Fetch invoice by order ID
export async function fetchInvoiceByOrder(orderId: string): Promise<Invoice | null> {
  const { data, error } = await supabase
    .from('invoices')
    .select('*, order:orders(order_number, customer:customers(name))')
    .eq('order_id', orderId)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data ? mapDbToInvoice(data) : null;
}

// Fetch all invoices
export async function fetchInvoices(): Promise<Invoice[]> {
  const { data, error } = await supabase
    .from('invoices')
    .select('*, order:orders(order_number, customer:customers(name))')
    .order('generated_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(mapDbToInvoice);
}

// Update invoice
export async function updateInvoice(
  invoiceId: string,
  updates: Partial<InvoiceFormData>
): Promise<Invoice> {
  const payload: any = {};
  if (updates.invoice_date !== undefined) payload.invoice_date = updates.invoice_date;
  if (updates.notes !== undefined) payload.notes = updates.notes || null;

  const { data, error } = await supabase
    .from('invoices')
    .update(payload)
    .eq('id', invoiceId)
    .select('*, order:orders(order_number, customer:customers(name))')
    .single();

  if (error) throw error;
  return mapDbToInvoice(data);
}

// Delete invoice
export async function deleteInvoice(invoiceId: string): Promise<void> {
  const { error } = await supabase.from('invoices').delete().eq('id', invoiceId);
  if (error) throw error;
}
