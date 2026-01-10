import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import type { InvoiceData, SellerDetails } from '../types/sales';

// Define styles for the PDF
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 30,
    borderBottom: '2 solid #000',
    paddingBottom: 15,
  },
  companyName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  companyDetails: {
    fontSize: 9,
    color: '#666',
    lineHeight: 1.5,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 10,
    borderBottom: '1 solid #ccc',
    paddingBottom: 5,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  label: {
    width: '30%',
    fontWeight: 'bold',
  },
  value: {
    width: '70%',
  },
  table: {
    marginTop: 10,
    border: '1 solid #000',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderBottom: '1 solid #000',
    padding: 8,
    fontWeight: 'bold',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1 solid #ccc',
    padding: 8,
  },
  col1: { width: '5%' },
  col2: { width: '25%' },
  col3: { width: '15%' },
  col4: { width: '10%' },
  col5: { width: '15%' },
  col6: { width: '15%' },
  col7: { width: '15%' },
  footer: {
    marginTop: 30,
    paddingTop: 15,
    borderTop: '2 solid #000',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
    paddingHorizontal: 10,
  },
  summaryLabel: {
    fontWeight: 'bold',
  },
  summaryValue: {
    textAlign: 'right',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    padding: 10,
    backgroundColor: '#f0f0f0',
    fontWeight: 'bold',
    fontSize: 12,
  },
  statusBox: {
    padding: 8,
    marginTop: 10,
    backgroundColor: '#f9f9f9',
    border: '1 solid #ccc',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  notes: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#f9f9f9',
    border: '1 solid #ccc',
    fontSize: 9,
  },
});

interface InvoicePDFProps {
  invoiceData: InvoiceData;
  sellerDetails: SellerDetails;
}

export function InvoicePDF({ invoiceData, sellerDetails }: InvoicePDFProps) {
  const { invoice, order, customer, payments, paymentStatus, totalPaid, outstandingAmount } = invoiceData;
  
  // Calculate delivered totals
  const totalDelivered = order.items.reduce((sum, item) => sum + item.quantity_delivered, 0);
  const totalOrdered = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const deliveryPercentage = totalOrdered > 0 ? (totalDelivered / totalOrdered) * 100 : 0;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header with Company Details */}
        <View style={styles.header}>
          <Text style={styles.companyName}>{sellerDetails.name}</Text>
          {sellerDetails.address && <Text style={styles.companyDetails}>{sellerDetails.address}</Text>}
          {sellerDetails.phone && <Text style={styles.companyDetails}>Phone: {sellerDetails.phone}</Text>}
          {sellerDetails.email && <Text style={styles.companyDetails}>Email: {sellerDetails.email}</Text>}
        </View>

        {/* Invoice Title */}
        <Text style={styles.title}>INVOICE</Text>

        {/* Invoice Details Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Invoice Details</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Invoice Number:</Text>
            <Text style={styles.value}>{invoice.invoice_number}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Invoice Date:</Text>
            <Text style={styles.value}>
              {new Date(invoice.invoice_date).toLocaleDateString('en-IN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Order Number:</Text>
            <Text style={styles.value}>{order.order_number}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Order Date:</Text>
            <Text style={styles.value}>
              {new Date(order.order_date).toLocaleDateString('en-IN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </Text>
          </View>
        </View>

        {/* Customer Details Section */}
        {customer && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Bill To</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Customer Name:</Text>
              <Text style={styles.value}>{customer.name}</Text>
            </View>
            {customer.customer_type && (
              <View style={styles.row}>
                <Text style={styles.label}>Type:</Text>
                <Text style={styles.value}>{customer.customer_type}</Text>
              </View>
            )}
            {customer.contact_person && (
              <View style={styles.row}>
                <Text style={styles.label}>Contact Person:</Text>
                <Text style={styles.value}>{customer.contact_person}</Text>
              </View>
            )}
            {customer.phone && (
              <View style={styles.row}>
                <Text style={styles.label}>Phone:</Text>
                <Text style={styles.value}>{customer.phone}</Text>
              </View>
            )}
            {customer.address && (
              <View style={styles.row}>
                <Text style={styles.label}>Address:</Text>
                <Text style={styles.value}>{customer.address}</Text>
              </View>
            )}
          </View>
        )}

        {/* Items Table */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Items</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.col1}>#</Text>
              <Text style={styles.col2}>Product</Text>
              <Text style={styles.col3}>Form/Size</Text>
              <Text style={styles.col4}>Unit</Text>
              <Text style={styles.col5}>Ordered</Text>
              <Text style={styles.col6}>Delivered</Text>
              <Text style={styles.col7}>Amount</Text>
            </View>
            {order.items.map((item, index) => (
              <View key={item.id} style={styles.tableRow}>
                <Text style={styles.col1}>{index + 1}</Text>
                <Text style={styles.col2}>{item.product_type}</Text>
                <Text style={styles.col3}>
                  {[item.form, item.size].filter(Boolean).join(' / ') || '-'}
                </Text>
                <Text style={styles.col4}>{item.unit}</Text>
                <Text style={styles.col5}>{item.quantity}</Text>
                <Text style={styles.col6}>{item.quantity_delivered}</Text>
                <Text style={styles.col7}>
                  ₹{item.quantity_delivered * item.unit_price}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Summary Section */}
        <View style={styles.footer}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal (Delivered Items):</Text>
            <Text style={styles.summaryValue}>
              ₹{order.items
                .reduce((sum, item) => sum + item.quantity_delivered * item.unit_price, 0)
                .toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
          </View>
          <View style={styles.totalRow}>
            <Text>Total Amount:</Text>
            <Text>₹{order.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
          </View>
        </View>

        {/* Payment Status */}
        <View style={styles.statusBox}>
          <Text style={styles.sectionTitle}>Payment Status</Text>
          <View style={styles.statusRow}>
            <Text>Status:</Text>
            <Text style={{ fontWeight: 'bold' }}>{paymentStatus}</Text>
          </View>
          <View style={styles.statusRow}>
            <Text>Total Paid:</Text>
            <Text>₹{totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
          </View>
          {outstandingAmount > 0 && (
            <View style={styles.statusRow}>
              <Text>Outstanding:</Text>
              <Text style={{ fontWeight: 'bold', color: '#d32f2f' }}>
                ₹{outstandingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            </View>
          )}
          {payments.length > 0 && (
            <View style={{ marginTop: 10 }}>
              <Text style={{ fontSize: 9, marginBottom: 5, fontWeight: 'bold' }}>Payment History:</Text>
              {payments.map((payment, idx) => (
                <View key={payment.id} style={{ marginBottom: 3, fontSize: 8 }}>
                  <Text style={{ fontSize: 8 }}>
                    {idx + 1}. ₹{payment.amount_received.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 
                    {' '}via {payment.payment_mode} 
                    {' '}on {new Date(payment.payment_date).toLocaleDateString('en-IN')}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Delivery Status */}
        <View style={styles.statusBox}>
          <Text style={styles.sectionTitle}>Delivery Status</Text>
          <View style={styles.statusRow}>
            <Text>Order Status:</Text>
            <Text style={{ fontWeight: 'bold' }}>{order.status}</Text>
          </View>
          <View style={styles.statusRow}>
            <Text>Total Ordered:</Text>
            <Text>{totalOrdered} units</Text>
          </View>
          <View style={styles.statusRow}>
            <Text>Total Delivered:</Text>
            <Text style={{ fontWeight: 'bold' }}>{totalDelivered} units</Text>
          </View>
          <View style={styles.statusRow}>
            <Text>Delivery Progress:</Text>
            <Text>{deliveryPercentage.toFixed(1)}%</Text>
          </View>
        </View>

        {/* Notes */}
        {(invoice.notes || order.notes) && (
          <View style={styles.notes}>
            <Text style={{ fontWeight: 'bold', marginBottom: 5 }}>Notes:</Text>
            {invoice.notes && <Text>{invoice.notes}</Text>}
            {order.notes && <Text>{order.notes}</Text>}
          </View>
        )}

        {/* Footer */}
        <View style={{ marginTop: 30, textAlign: 'center', fontSize: 8, color: '#666' }}>
          <Text>This is a computer-generated invoice. No signature required.</Text>
          <Text>Generated on: {new Date(invoice.generated_at).toLocaleString('en-IN')}</Text>
        </View>
      </Page>
    </Document>
  );
}
