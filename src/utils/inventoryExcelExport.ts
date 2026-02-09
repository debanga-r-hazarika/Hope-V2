import * as XLSX from 'xlsx';
import type {
  CurrentInventoryByTag,
  OutOfStockItem,
  LowStockItem,
  ConsumptionSummary,
  InventoryType,
} from '../types/inventory-analytics';

export function exportInventoryToExcel(
  currentInventory: { type: InventoryType; data: CurrentInventoryByTag[] }[],
  outOfStockItems: OutOfStockItem[],
  lowStockItems: LowStockItem[],
  consumptionData: ConsumptionSummary[],
  startDate: string,
  endDate: string
) {
  const workbook = XLSX.utils.book_new();

  // Sheet 1: Current Inventory - Raw Materials
  const rawMaterialsData = currentInventory.find((inv) => inv.type === 'raw_material')?.data || [];
  if (rawMaterialsData.length > 0) {
    const rawMaterialsSheet = XLSX.utils.json_to_sheet(
      rawMaterialsData.map((item) => ({
        'Tag Name': item.tag_name,
        'Tag Key': item.tag_key,
        'Current Balance': item.current_balance,
        'Unit': item.default_unit,
        'Item Count': item.item_count,
        'Last Movement': item.last_movement_date || 'N/A',
      }))
    );
    XLSX.utils.book_append_sheet(workbook, rawMaterialsSheet, 'Raw Materials');
  }

  // Sheet 2: Current Inventory - Recurring Products
  const recurringProductsData = currentInventory.find((inv) => inv.type === 'recurring_product')?.data || [];
  if (recurringProductsData.length > 0) {
    const recurringProductsSheet = XLSX.utils.json_to_sheet(
      recurringProductsData.map((item) => ({
        'Tag Name': item.tag_name,
        'Tag Key': item.tag_key,
        'Current Balance': item.current_balance,
        'Unit': item.default_unit,
        'Item Count': item.item_count,
        'Last Movement': item.last_movement_date || 'N/A',
      }))
    );
    XLSX.utils.book_append_sheet(workbook, recurringProductsSheet, 'Recurring Products');
  }

  // Sheet 3: Current Inventory - Produced Goods
  const producedGoodsData = currentInventory.find((inv) => inv.type === 'produced_goods')?.data || [];
  if (producedGoodsData.length > 0) {
    const producedGoodsSheet = XLSX.utils.json_to_sheet(
      producedGoodsData.map((item) => ({
        'Tag Name': item.tag_name,
        'Tag Key': item.tag_key,
        'Current Balance': item.current_balance,
        'Unit': item.default_unit,
        'Item Count': item.item_count,
        'Last Production': item.last_production_date || 'N/A',
      }))
    );
    XLSX.utils.book_append_sheet(workbook, producedGoodsSheet, 'Produced Goods');
  }

  // Sheet 4: Out of Stock
  if (outOfStockItems.length > 0) {
    const outOfStockSheet = XLSX.utils.json_to_sheet(
      outOfStockItems.map((item) => ({
        'Inventory Type': item.inventory_type.replace('_', ' '),
        'Tag Name': item.tag_name,
        'Tag Key': item.tag_key,
        'Current Balance': item.current_balance,
        'Unit': item.default_unit,
        'Last Activity': item.last_activity_date || 'N/A',
      }))
    );
    XLSX.utils.book_append_sheet(workbook, outOfStockSheet, 'Out of Stock');
  }

  // Sheet 5: Low Stock
  if (lowStockItems.length > 0) {
    const lowStockSheet = XLSX.utils.json_to_sheet(
      lowStockItems.map((item) => ({
        'Inventory Type': item.inventory_type.replace('_', ' '),
        'Tag Name': item.tag_name,
        'Tag Key': item.tag_key,
        'Current Balance': item.current_balance,
        'Threshold': item.threshold_quantity,
        'Shortage Amount': item.shortage_amount,
        'Unit': item.default_unit,
        'Last Activity': item.last_activity_date || 'N/A',
      }))
    );
    XLSX.utils.book_append_sheet(workbook, lowStockSheet, 'Low Stock');
  }

  // Sheet 6: Consumption Summary
  if (consumptionData.length > 0) {
    const consumptionSheet = XLSX.utils.json_to_sheet(
      consumptionData.map((item) => ({
        'Date': item.consumption_date,
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

  // Generate filename with date range
  const filename = `Inventory_Report_${startDate}_to_${endDate}.xlsx`;

  // Write file
  XLSX.writeFile(workbook, filename);
}
