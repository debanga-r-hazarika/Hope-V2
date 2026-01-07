import * as XLSX from 'xlsx';
import type { RawMaterial, RecurringProduct, Supplier, ProductionBatch, ProcessedGood, Machine, WasteRecord, TransferRecord } from '../types/operations';

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
export function exportProductionBatches(batches: ProductionBatch[]) {
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

    return {
      'Batch ID': batch.batch_id,
      'Batch Date': batch.batch_date,
      'Responsible User': batch.responsible_user_name || '—',
      'Product Type': batch.output_product_type || '—',
      'Output Quantity': batch.output_quantity || 0,
      'Output Unit': batch.output_unit || '—',
      'QA Status': batch.qa_status || 'pending',
      'QA Reason': batch.qa_reason || '—',
      'Production Start Date': batch.production_start_date || '—',
      'Production End Date': batch.production_end_date || '—',
      'Additional Information': batch.additional_information || '—',
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
export function exportProcessedGoods(goods: ProcessedGood[]) {
  const exportData = goods.map((good) => ({
    'Batch Reference': good.batch_reference || '—',
    'Product Type': good.product_type,
    'Quantity Available': good.quantity_available,
    'Unit': good.unit,
    'Production Date': good.production_date,
    'QA Status': good.qa_status || 'pending',
    'Created At': new Date(good.created_at).toLocaleString(),
  }));

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
 * Export Waste Records to Excel
 */
export function exportWasteRecords(wasteRecords: WasteRecord[]) {
  const exportData = wasteRecords.map((record) => ({
    'Lot Type': record.lot_type,
    'Lot ID': record.lot_id,
    'Lot Identifier': record.lot_identifier,
    'Lot Name': record.lot_name || '—',
    'Quantity Wasted': record.quantity_wasted,
    'Unit': record.unit,
    'Reason': record.reason,
    'Notes': record.notes || '—',
    'Waste Date': record.waste_date,
    'Created By': record.created_by_name || '—',
    'Created At': new Date(record.created_at).toLocaleString(),
  }));

  exportToExcel(exportData, `Waste_Records_Export_${new Date().toISOString().split('T')[0]}`, 'Waste Records');
}

/**
 * Export Transfer Records to Excel
 */
export function exportTransferRecords(transferRecords: TransferRecord[]) {
  const exportData = transferRecords.map((record) => ({
    'Lot Type': record.lot_type,
    'From Lot ID': record.from_lot_id,
    'From Lot Identifier': record.from_lot_identifier,
    'From Lot Name': record.from_lot_name || '—',
    'To Lot ID': record.to_lot_id,
    'To Lot Identifier': record.to_lot_identifier,
    'To Lot Name': record.to_lot_name || '—',
    'Quantity Transferred': record.quantity_transferred,
    'Unit': record.unit,
    'Reason': record.reason,
    'Notes': record.notes || '—',
    'Transfer Date': record.transfer_date,
    'Created By': record.created_by_name || '—',
    'Created At': new Date(record.created_at).toLocaleString(),
  }));

  exportToExcel(exportData, `Transfer_Records_Export_${new Date().toISOString().split('T')[0]}`, 'Transfer Records');
}

