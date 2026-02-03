import * as XLSX from 'xlsx';
import type { RawMaterial, RecurringProduct, Supplier, ProductionBatch, ProcessedGood, Machine } from '../types/operations';
import type { Customer } from '../types/sales';

/**
 * Export data to Excel file
 */
export function exportToExcel(data: any[], filename: string, sheetName: string = 'Sheet1') {
  // Create a new workbook
  const wb = XLSX.utils.book_new();
  
  // Convert data to worksheet
  const ws = XLSX.utils.json_to_sheet(data);
  
  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  
  // Write file
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

/**
 * Export Raw Materials to Excel
 */
export function exportRawMaterials(materials: RawMaterial[]) {
  const exportData = materials.map((material) => ({
    'Lot ID': material.lot_id,
    'Name': material.name,
    'Supplier': material.supplier_name || '—',
    'Quantity Received': material.quantity_received,
    'Quantity Available': material.quantity_available,
    'Unit': material.unit,
    'Condition': material.condition || '—',
    'Received Date': material.received_date,
    'Storage Notes': material.storage_notes || '—',
    'Handover To': material.handover_to_name || '—',
    'Amount Paid': material.amount_paid || 0,
    'Archived': material.is_archived ? 'Yes' : 'No',
    'Created At': new Date(material.created_at).toLocaleString(),
    'Updated At': new Date(material.updated_at).toLocaleString(),
  }));

  exportToExcel(exportData, `Raw_Materials_Export_${new Date().toISOString().split('T')[0]}`, 'Raw Materials');
}

/**
 * Export Recurring Products to Excel
 */
export function exportRecurringProducts(products: RecurringProduct[]) {
  const exportData = products.map((product) => ({
    'Lot ID': product.lot_id,
    'Name': product.name,
    'Category': product.category,
    'Supplier': product.supplier_name || '—',
    'Quantity Received': product.quantity_received,
    'Quantity Available': product.quantity_available,
    'Unit': product.unit,
    'Received Date': product.received_date,
    'Notes': product.notes || '—',
    'Handover To': product.handover_to_name || '—',
    'Amount Paid': product.amount_paid || 0,
    'Archived': product.is_archived ? 'Yes' : 'No',
    'Created At': new Date(product.created_at).toLocaleString(),
    'Updated At': new Date(product.updated_at).toLocaleString(),
  }));

  exportToExcel(exportData, `Recurring_Products_Export_${new Date().toISOString().split('T')[0]}`, 'Recurring Products');
}

/**
 * Export Suppliers to Excel
 */
export function exportSuppliers(suppliers: Supplier[]) {
  const exportData = suppliers.map((supplier) => ({
    'Name': supplier.name,
    'Supplier Type': supplier.supplier_type,
    'Contact Details': supplier.contact_details || '—',
    'Notes': supplier.notes || '—',
    'Created At': new Date(supplier.created_at).toLocaleString(),
    'Updated At': new Date(supplier.updated_at).toLocaleString(),
  }));

  exportToExcel(exportData, `Suppliers_Export_${new Date().toISOString().split('T')[0]}`, 'Suppliers');
}

/**
 * Export Production Batches to Excel
 */
export function exportProductionBatches(batches: ProductionBatch[], batchOutputsMap?: Map<string, any[]>) {
  const exportData = batches.map((batch) => {
    // Parse custom fields if they exist
    let customFieldsStr = '—';
    if (batch.custom_fields) {
      try {
        const customFields = typeof batch.custom_fields === 'string'
          ? JSON.parse(batch.custom_fields)
          : batch.custom_fields;
        if (Array.isArray(customFields) && customFields.length > 0) {
          customFieldsStr = customFields.map(f => `${f.key}: ${f.value}`).join('; ');
        }
      } catch (e) {
        // Invalid JSON, skip
      }
    }

    // Get outputs for this batch
    const outputs = batchOutputsMap?.get(batch.id) || [];
    const outputsStr = outputs.length > 0
      ? outputs.map(o => `${o.output_name} (${o.produced_quantity} ${o.produced_unit}${o.output_size ? `, ${o.output_size}${o.output_size_unit || ''}` : ''})`).join('; ')
      : (batch.output_product_type || '—');

    return {
      'Batch ID': batch.batch_id,
      'Batch Date': batch.batch_date,
      'Responsible User': batch.responsible_user_name || '—',
      'Outputs': outputsStr,
      'Output Count': outputs.length || (batch.output_product_type ? 1 : 0),
      'QA Status': batch.qa_status || 'pending',
      'QA Reason': batch.qa_reason || '—',
      'Production Start Date': batch.production_start_date || '—',
      'Production End Date': batch.production_end_date || '—',
      'Custom Fields': customFieldsStr,
      'Notes': batch.notes || '—',
      'Status': batch.is_locked ? 'Locked' : 'Draft',
      'Created At': new Date(batch.created_at).toLocaleString(),
      'Updated At': new Date(batch.updated_at).toLocaleString(),
    };
  });

  exportToExcel(exportData, `Production_Batches_Export_${new Date().toISOString().split('T')[0]}`, 'Production Batches');
}

/**
 * Export Processed Goods to Excel
 */
/**
 * Export Batch Outputs to Excel (detailed output information per batch)
 */
export function exportBatchOutputs(batchIds?: string[]) {
  // This would need to be called from a component that has access to batch data
  // For now, we'll export empty data with proper headers
  const exportData = [{
    'Batch ID': '—',
    'Batch Date': '—',
    'Output Name': '—',
    'Produced Quantity': 0,
    'Produced Unit': '—',
    'Output Size': '—',
    'Output Size Unit': '—',
    'Tag': '—',
    'QA Status': '—',
    'Status': '—'
  }];

  exportToExcel(exportData, `Batch_Outputs_Export_${new Date().toISOString().split('T')[0]}`, 'Batch Outputs');
}

export function exportProcessedGoods(goods: ProcessedGood[]) {
  const exportData = goods.map((good) => {
    // Parse custom fields if they exist
    let customFieldsStr = '—';
    if (good.custom_fields) {
      try {
        const customFields = typeof good.custom_fields === 'string'
          ? JSON.parse(good.custom_fields)
          : good.custom_fields;
        if (Array.isArray(customFields) && customFields.length > 0) {
          customFieldsStr = customFields.map(f => `${f.key}: ${f.value}`).join('; ');
        }
      } catch (e) {
        // Invalid JSON, skip
      }
    }

      return {
        'Batch Reference': good.batch_reference || '—',
        'Product Type': good.product_type,
        'Tag': good.produced_goods_tag_name || '—',
        'Quantity Available': good.quantity_available,
        'Unit': good.unit,
        'Output Size': good.output_size ? `${good.output_size} ${good.output_size_unit || ''}`.trim() : '—',
        'Production Date': good.production_date,
        'QA Status': good.qa_status || 'approved',
        'Stock Status': good.quantity_available > 0 ? 'In Stock' : 'Out of Stock',
        'Additional Information': good.additional_information || '—',
        'Custom Fields': customFieldsStr,
        'Created At': new Date(good.created_at).toLocaleString(),
      };
  });

  exportToExcel(exportData, `Processed_Goods_Export_${new Date().toISOString().split('T')[0]}`, 'Processed Goods');
}

/**
 * Export Machines to Excel
 */
export function exportMachines(machines: Machine[]) {
  const exportData = machines.map((machine) => ({
    'Name': machine.name,
    'Category': machine.category,
    'Supplier': machine.supplier_name || '—',
    'Purchase Date': machine.purchase_date || '—',
    'Purchase Cost': machine.purchase_cost || 0,
    'Status': machine.status,
    'Notes': machine.notes || '—',
    'Created At': new Date(machine.created_at).toLocaleString(),
    'Updated At': new Date(machine.updated_at).toLocaleString(),
  }));

  exportToExcel(exportData, `Machines_Export_${new Date().toISOString().split('T')[0]}`, 'Machines');
}

/**
 * Export Customers to Excel
 * Exports all customer data except order history
 */
export function exportCustomers(customers: Customer[]) {
  const exportData = customers.map((customer) => ({
    'Customer ID': customer.id,
    'Name': customer.name,
    'Customer Type': customer.customer_type,
    'Contact Person': customer.contact_person || '—',
    'Phone': customer.phone || '—',
    'Address': customer.address || '—',
    'Status': customer.status,
    'Notes': customer.notes || '—',
    'Created At': new Date(customer.created_at).toLocaleString('en-IN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }),
    'Updated At': new Date(customer.updated_at).toLocaleString('en-IN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }),
  }));

  exportToExcel(exportData, `Customers_Export_${new Date().toISOString().split('T')[0]}`, 'Customers');
}

/**
 * Export Orders to Excel
 * Exports all order data with comprehensive information
 */
export function exportOrders(orders: any[]) {
  const exportData = orders.map((order) => {
    const discountAmount = order.discount_amount || 0;
    const netTotal = order.total_amount - discountAmount;
    
    return {
      'Order Number': order.order_number,
      'Customer Name': order.customer_name || '—',
      'Order Date': new Date(order.order_date).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }),
      'Order Time': new Date(order.order_date).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      'Status': order.status,
      'Payment Status': order.payment_status || '—',
      'Total Amount': order.total_amount,
      'Discount Amount': discountAmount,
      'Net Total': netTotal,
      'Sold By': order.sold_by_name || order.sold_by || '—',
      'Notes': order.notes || '—',
      'Is Locked': order.is_locked ? 'Yes' : 'No',
      'Completed At': order.completed_at
        ? new Date(order.completed_at).toLocaleString('en-IN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })
        : '—',
      'Created At': new Date(order.created_at).toLocaleString('en-IN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
      'Updated At': new Date(order.updated_at).toLocaleString('en-IN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
  });

  exportToExcel(exportData, `Orders_Export_${new Date().toISOString().split('T')[0]}`, 'Orders');
}


