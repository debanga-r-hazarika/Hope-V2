import * as XLSX from 'xlsx';
import type {
  CurrentInventoryByTag,
  OutOfStockItem,
  LowStockItem,
  ConsumptionSummary,
  InventoryType,
  RawMaterialLotDetail,
  RecurringProductLotDetail,
  ProcessedGoodsBatchDetail,
} from '../types/inventory-analytics';
import {
  fetchRawMaterialLotDetails,
  fetchRecurringProductLotDetails,
  fetchProcessedGoodsBatchDetails,
} from '../lib/inventory-analytics';

export async function exportInventoryToExcel(
  currentInventory: { type: InventoryType; data: CurrentInventoryByTag[] }[],
  outOfStockItems: OutOfStockItem[],
  lowStockItems: LowStockItem[],
  consumptionData: ConsumptionSummary[],
  startDate: string,
  endDate: string
) {
  const workbook = XLSX.utils.book_new();

  // Format dates for display
  const formatDateForDisplay = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Sheet 1: Current Inventory Summary - Raw Materials
  const rawMaterialsData = currentInventory.find((inv) => inv.type === 'raw_material')?.data || [];
  if (rawMaterialsData.length > 0) {
    const rawMaterialsSheet = XLSX.utils.json_to_sheet(
      rawMaterialsData.map((item) => ({
        'Tag Name': item.tag_name,
        'Tag Key': item.tag_key,
        'Status': item.usable !== undefined ? (item.usable ? 'Usable' : 'Unusable') : 'N/A',
        'Current Balance': item.current_balance,
        'Unit': item.default_unit,
        'Item Count': item.item_count,
        'Last Movement': item.last_movement_date ? formatDateForDisplay(item.last_movement_date) : 'N/A',
      }))
    );
    XLSX.utils.book_append_sheet(workbook, rawMaterialsSheet, 'Raw Materials Summary');
  }

  // Sheet 2: Raw Materials - Detailed Lots (Usable)
  const usableRawMaterialTags = rawMaterialsData.filter(item => item.usable === true);
  if (usableRawMaterialTags.length > 0) {
    const allUsableLots: any[] = [];
    
    for (const tag of usableRawMaterialTags) {
      try {
        const lots = await fetchRawMaterialLotDetails(tag.tag_id, true);
        lots.forEach(lot => {
          allUsableLots.push({
            'Tag Name': tag.tag_name,
            'Lot ID': lot.lot_id,
            'Item Name': lot.name,
            'Status': 'Usable',
            'Available Quantity': lot.quantity_available,
            'Unit': lot.unit,
            'Received Date': formatDateForDisplay(lot.received_date),
            'Supplier': lot.supplier_name || 'N/A',
            'Collected By': lot.collected_by_name || 'N/A',
            'Storage Notes': lot.storage_notes || '',
          });
        });
      } catch (error) {
        console.error(`Failed to fetch usable lots for tag ${tag.tag_name}:`, error);
      }
    }

    if (allUsableLots.length > 0) {
      const usableLotsSheet = XLSX.utils.json_to_sheet(allUsableLots);
      XLSX.utils.book_append_sheet(workbook, usableLotsSheet, 'Raw Materials - Usable');
    }
  }

  // Sheet 3: Raw Materials - Detailed Lots (Unusable)
  const unusableRawMaterialTags = rawMaterialsData.filter(item => item.usable === false);
  if (unusableRawMaterialTags.length > 0) {
    const allUnusableLots: any[] = [];
    
    for (const tag of unusableRawMaterialTags) {
      try {
        const lots = await fetchRawMaterialLotDetails(tag.tag_id, false);
        lots.forEach(lot => {
          allUnusableLots.push({
            'Tag Name': tag.tag_name,
            'Lot ID': lot.lot_id,
            'Item Name': lot.name,
            'Status': 'Unusable',
            'Available Quantity': lot.quantity_available,
            'Unit': lot.unit,
            'Received Date': formatDateForDisplay(lot.received_date),
            'Supplier': lot.supplier_name || 'N/A',
            'Collected By': lot.collected_by_name || 'N/A',
            'Storage Notes': lot.storage_notes || '',
          });
        });
      } catch (error) {
        console.error(`Failed to fetch unusable lots for tag ${tag.tag_name}:`, error);
      }
    }

    if (allUnusableLots.length > 0) {
      const unusableLotsSheet = XLSX.utils.json_to_sheet(allUnusableLots);
      XLSX.utils.book_append_sheet(workbook, unusableLotsSheet, 'Raw Materials - Unusable');
    }
  }

  // Sheet 4: Current Inventory Summary - Recurring Products
  const recurringProductsData = currentInventory.find((inv) => inv.type === 'recurring_product')?.data || [];
  if (recurringProductsData.length > 0) {
    const recurringProductsSheet = XLSX.utils.json_to_sheet(
      recurringProductsData.map((item) => ({
        'Tag Name': item.tag_name,
        'Tag Key': item.tag_key,
        'Current Balance': item.current_balance,
        'Unit': item.default_unit,
        'Item Count': item.item_count,
        'Last Movement': item.last_movement_date ? formatDateForDisplay(item.last_movement_date) : 'N/A',
      }))
    );
    XLSX.utils.book_append_sheet(workbook, recurringProductsSheet, 'Recurring Products Summary');
  }

  // Sheet 5: Recurring Products - Detailed Lots
  if (recurringProductsData.length > 0) {
    const allRecurringLots: any[] = [];
    
    for (const tag of recurringProductsData) {
      try {
        const lots = await fetchRecurringProductLotDetails(tag.tag_id);
        lots.forEach(lot => {
          allRecurringLots.push({
            'Tag Name': tag.tag_name,
            'Lot ID': lot.lot_id,
            'Item Name': lot.name,
            'Available Quantity': lot.quantity_available,
            'Unit': lot.unit,
            'Received Date': formatDateForDisplay(lot.received_date),
          });
        });
      } catch (error) {
        console.error(`Failed to fetch recurring product lots for tag ${tag.tag_name}:`, error);
      }
    }

    if (allRecurringLots.length > 0) {
      const recurringLotsSheet = XLSX.utils.json_to_sheet(allRecurringLots);
      XLSX.utils.book_append_sheet(workbook, recurringLotsSheet, 'Recurring Products Details');
    }
  }

  // Sheet 6: Current Inventory Summary - Produced Goods
  const producedGoodsData = currentInventory.find((inv) => inv.type === 'produced_goods')?.data || [];
  if (producedGoodsData.length > 0) {
    const producedGoodsSheet = XLSX.utils.json_to_sheet(
      producedGoodsData.map((item) => ({
        'Tag Name': item.tag_name,
        'Tag Key': item.tag_key,
        'Current Balance': item.current_balance,
        'Unit': item.default_unit,
        'Item Count': item.item_count,
        'Last Production': item.last_production_date ? formatDateForDisplay(item.last_production_date) : 'N/A',
      }))
    );
    XLSX.utils.book_append_sheet(workbook, producedGoodsSheet, 'Produced Goods Summary');
  }

  // Sheet 7: Produced Goods - Detailed Batches
  if (producedGoodsData.length > 0) {
    const allBatches: any[] = [];
    
    for (const tag of producedGoodsData) {
      try {
        const batches = await fetchProcessedGoodsBatchDetails(tag.tag_id);
        batches.forEach(batch => {
          allBatches.push({
            'Tag Name': tag.tag_name,
            'Batch ID': batch.batch_name,
            'Total Created': batch.quantity_created,
            'Available Quantity': batch.quantity_available,
            'Unit': batch.unit,
            'Production Date': formatDateForDisplay(batch.production_date),
          });
        });
      } catch (error) {
        console.error(`Failed to fetch batches for tag ${tag.tag_name}:`, error);
      }
    }

    if (allBatches.length > 0) {
      const batchesSheet = XLSX.utils.json_to_sheet(allBatches);
      XLSX.utils.book_append_sheet(workbook, batchesSheet, 'Produced Goods Details');
    }
  }

  // Sheet 8: Out of Stock
  if (outOfStockItems.length > 0) {
    const outOfStockSheet = XLSX.utils.json_to_sheet(
      outOfStockItems.map((item) => ({
        'Inventory Type': item.inventory_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
        'Tag Name': item.tag_name,
        'Tag Key': item.tag_key,
        'Current Balance': item.current_balance,
        'Unit': item.default_unit,
        'Last Activity': item.last_activity_date ? formatDateForDisplay(item.last_activity_date) : 'N/A',
      }))
    );
    XLSX.utils.book_append_sheet(workbook, outOfStockSheet, 'Out of Stock');
  }

  // Sheet 9: Low Stock
  if (lowStockItems.length > 0) {
    const lowStockSheet = XLSX.utils.json_to_sheet(
      lowStockItems.map((item) => ({
        'Inventory Type': item.inventory_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
        'Tag Name': item.tag_name,
        'Tag Key': item.tag_key,
        'Current Balance': item.current_balance,
        'Threshold': item.threshold_quantity,
        'Shortage Amount': item.shortage_amount,
        'Unit': item.default_unit,
        'Last Activity': item.last_activity_date ? formatDateForDisplay(item.last_activity_date) : 'N/A',
      }))
    );
    XLSX.utils.book_append_sheet(workbook, lowStockSheet, 'Low Stock');
  }

  // Sheet 10: Consumption Summary
  if (consumptionData.length > 0) {
    const consumptionSheet = XLSX.utils.json_to_sheet(
      consumptionData.map((item) => ({
        'Date': formatDateForDisplay(item.consumption_date),
        'Tag Name': item.tag_name,
        'Tag Key': item.tag_key,
        'Total Consumed': item.total_consumed,
        'Total Wasted': item.total_wasted,
        'Unit': item.default_unit,
        'Consumption Transactions': item.consumption_transactions,
        'Waste Transactions': item.waste_transactions,
      }))
    );
    XLSX.utils.book_append_sheet(workbook, consumptionSheet, 'Consumption Summary');
  }

  // Generate filename with formatted date range
  const startDateObj = new Date(startDate);
  const monthYear = startDateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
  const filename = `Inventory_Report_${monthYear.replace(' ', '_')}.xlsx`;

  // Write file
  XLSX.writeFile(workbook, filename);
}
