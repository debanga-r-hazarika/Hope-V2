import { supabase } from './supabase';
import type {
  CurrentInventoryByTag,
  OutOfStockItem,
  LowStockItem,
  ConsumptionSummary,
  InventoryAnalyticsFilters,
  InventoryMetrics,
  InventoryType,
} from '../types/inventory-analytics';

// ============================================
// CURRENT INVENTORY REPORTS
// ============================================

export async function fetchCurrentInventoryRawMaterials(
  filters?: InventoryAnalyticsFilters
): Promise<CurrentInventoryByTag[]> {
  let query = supabase
    .from('inventory_raw_materials_by_tag')
    .select('*')
    .order('tag_name', { ascending: true });

  if (filters?.specificTagId) {
    query = query.eq('tag_id', filters.specificTagId);
  }

  if (!filters?.includeZeroBalance) {
    query = query.gt('current_balance', 0);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data || []) as CurrentInventoryByTag[];
}

export async function fetchCurrentInventoryRecurringProducts(
  filters?: InventoryAnalyticsFilters
): Promise<CurrentInventoryByTag[]> {
  let query = supabase
    .from('inventory_recurring_products_by_tag')
    .select('*')
    .order('tag_name', { ascending: true });

  if (filters?.specificTagId) {
    query = query.eq('tag_id', filters.specificTagId);
  }

  if (!filters?.includeZeroBalance) {
    query = query.gt('current_balance', 0);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data || []) as CurrentInventoryByTag[];
}

export async function fetchCurrentInventoryProducedGoods(
  filters?: InventoryAnalyticsFilters
): Promise<CurrentInventoryByTag[]> {
  let query = supabase
    .from('inventory_produced_goods_by_tag')
    .select('*')
    .order('tag_name', { ascending: true });

  if (filters?.specificTagId) {
    query = query.eq('tag_id', filters.specificTagId);
  }

  if (!filters?.includeZeroBalance) {
    query = query.gt('current_balance', 0);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data || []) as CurrentInventoryByTag[];
}

export async function fetchCurrentInventoryByType(
  inventoryType: InventoryType,
  filters?: InventoryAnalyticsFilters
): Promise<CurrentInventoryByTag[]> {
  switch (inventoryType) {
    case 'raw_material':
      return fetchCurrentInventoryRawMaterials(filters);
    case 'recurring_product':
      return fetchCurrentInventoryRecurringProducts(filters);
    case 'produced_goods':
      return fetchCurrentInventoryProducedGoods(filters);
    default:
      return [];
  }
}

export async function fetchAllCurrentInventory(
  filters?: InventoryAnalyticsFilters
): Promise<{ type: InventoryType; data: CurrentInventoryByTag[] }[]> {
  const [rawMaterials, recurringProducts, producedGoods] = await Promise.all([
    fetchCurrentInventoryRawMaterials(filters),
    fetchCurrentInventoryRecurringProducts(filters),
    fetchCurrentInventoryProducedGoods(filters),
  ]);

  return [
    { type: 'raw_material', data: rawMaterials },
    { type: 'recurring_product', data: recurringProducts },
    { type: 'produced_goods', data: producedGoods },
  ];
}

// ============================================
// OUT-OF-STOCK REPORT
// ============================================

export async function fetchOutOfStockItems(
  filters?: InventoryAnalyticsFilters
): Promise<OutOfStockItem[]> {
  let query = supabase
    .from('inventory_out_of_stock')
    .select('*')
    .order('tag_name', { ascending: true });

  if (filters?.inventoryType) {
    query = query.eq('inventory_type', filters.inventoryType);
  }

  if (filters?.specificTagId) {
    query = query.eq('tag_id', filters.specificTagId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data || []) as OutOfStockItem[];
}

// ============================================
// LOW-STOCK REPORT
// ============================================

export async function fetchLowStockItems(
  filters?: InventoryAnalyticsFilters
): Promise<LowStockItem[]> {
  let query = supabase
    .from('inventory_low_stock')
    .select('*')
    .order('shortage_amount', { ascending: false });

  if (filters?.inventoryType) {
    query = query.eq('inventory_type', filters.inventoryType);
  }

  if (filters?.specificTagId) {
    query = query.eq('tag_id', filters.specificTagId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data || []) as LowStockItem[];
}

// ============================================
// CONSUMPTION SUMMARY
// ============================================

export async function fetchConsumptionRawMaterials(
  filters?: InventoryAnalyticsFilters
): Promise<ConsumptionSummary[]> {
  let query = supabase
    .from('inventory_consumption_raw_materials')
    .select('*')
    .order('consumption_date', { ascending: true });

  if (filters?.specificTagId) {
    query = query.eq('tag_id', filters.specificTagId);
  }

  if (filters?.startDate) {
    query = query.gte('consumption_date', filters.startDate);
  }

  if (filters?.endDate) {
    query = query.lte('consumption_date', filters.endDate);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data || []) as ConsumptionSummary[];
}

export async function fetchConsumptionRecurringProducts(
  filters?: InventoryAnalyticsFilters
): Promise<ConsumptionSummary[]> {
  let query = supabase
    .from('inventory_consumption_recurring_products')
    .select('*')
    .order('consumption_date', { ascending: true });

  if (filters?.specificTagId) {
    query = query.eq('tag_id', filters.specificTagId);
  }

  if (filters?.startDate) {
    query = query.gte('consumption_date', filters.startDate);
  }

  if (filters?.endDate) {
    query = query.lte('consumption_date', filters.endDate);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data || []) as ConsumptionSummary[];
}

export async function fetchConsumptionProducedGoods(
  filters?: InventoryAnalyticsFilters
): Promise<ConsumptionSummary[]> {
  let query = supabase
    .from('inventory_consumption_produced_goods')
    .select('*')
    .order('consumption_date', { ascending: true });

  if (filters?.specificTagId) {
    query = query.eq('tag_id', filters.specificTagId);
  }

  if (filters?.startDate) {
    query = query.gte('consumption_date', filters.startDate);
  }

  if (filters?.endDate) {
    query = query.lte('consumption_date', filters.endDate);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data || []) as ConsumptionSummary[];
}

export async function fetchConsumptionByType(
  inventoryType: InventoryType,
  filters?: InventoryAnalyticsFilters
): Promise<ConsumptionSummary[]> {
  switch (inventoryType) {
    case 'raw_material':
      return fetchConsumptionRawMaterials(filters);
    case 'recurring_product':
      return fetchConsumptionRecurringProducts(filters);
    case 'produced_goods':
      return fetchConsumptionProducedGoods(filters);
    default:
      return [];
  }
}

// ============================================
// INVENTORY METRICS AGGREGATION
// ============================================

export async function calculateInventoryMetrics(
  filters?: InventoryAnalyticsFilters
): Promise<InventoryMetrics> {
  const [allInventory, outOfStock, lowStock, consumptionData] = await Promise.all([
    fetchAllCurrentInventory(filters),
    fetchOutOfStockItems(filters),
    fetchLowStockItems(filters),
    filters?.inventoryType
      ? fetchConsumptionByType(filters.inventoryType, filters)
      : Promise.all([
          fetchConsumptionRawMaterials(filters),
          fetchConsumptionRecurringProducts(filters),
          fetchConsumptionProducedGoods(filters),
        ]).then((results) => results.flat()),
  ]);

  const totalItems = allInventory.reduce((sum, inv) => sum + inv.data.length, 0);
  const totalValue = allInventory.reduce(
    (sum, inv) => sum + inv.data.reduce((s, item) => s + item.current_balance, 0),
    0
  );

  const totalConsumed = Array.isArray(consumptionData)
    ? consumptionData.reduce((sum, item) => sum + (item.total_consumed || 0), 0)
    : 0;
  const totalWasted = Array.isArray(consumptionData)
    ? consumptionData.reduce((sum, item) => sum + (item.total_wasted || 0), 0)
    : 0;

  const wastePercentage =
    totalConsumed + totalWasted > 0 ? (totalWasted / (totalConsumed + totalWasted)) * 100 : 0;

  const daysInPeriod = filters?.startDate && filters?.endDate
    ? Math.ceil(
        (new Date(filters.endDate).getTime() - new Date(filters.startDate).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : 30;

  const averageConsumptionRate = daysInPeriod > 0 ? totalConsumed / daysInPeriod : 0;

  return {
    totalItems,
    totalValue,
    outOfStockCount: outOfStock.length,
    lowStockCount: lowStock.length,
    averageConsumptionRate,
    wastePercentage,
  };
}


// ============================================
// LOT/BATCH DETAILS FOR DRILL-DOWN
// ============================================

export interface RawMaterialLotDetail {
  id: string;
  name: string;
  lot_id: string;
  quantity_available: number;
  unit: string;
  received_date: string;
  usable: boolean;
  supplier_name?: string;
  storage_notes?: string;
}

export interface RecurringProductLotDetail {
  id: string;
  name: string;
  lot_id: string;
  quantity_available: number;
  unit: string;
  received_date: string;
}

export interface ProcessedGoodsBatchDetail {
  id: string;
  batch_name: string; // This is the human-readable batch ID like "BATCH-0016"
  quantity_created: number;
  quantity_available: number;
  unit: string;
  production_date: string;
}

export async function fetchRawMaterialLotDetails(
  tagId: string,
  usable?: boolean
): Promise<RawMaterialLotDetail[]> {
  let query = supabase
    .from('raw_materials')
    .select(`
      id,
      name,
      lot_id,
      quantity_available,
      unit,
      received_date,
      usable,
      storage_notes,
      suppliers(name)
    `)
    .eq('raw_material_tag_id', tagId)
    .gt('quantity_available', 0)
    .order('received_date', { ascending: false });

  if (usable !== undefined) {
    query = query.eq('usable', usable);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data || []).map((item: any) => ({
    id: item.id,
    name: item.name,
    lot_id: item.lot_id,
    quantity_available: item.quantity_available,
    unit: item.unit,
    received_date: item.received_date,
    usable: item.usable,
    supplier_name: item.suppliers?.name,
    storage_notes: item.storage_notes,
  }));
}

export async function fetchRecurringProductLotDetails(
  tagId: string
): Promise<RecurringProductLotDetail[]> {
  const { data, error } = await supabase
    .from('recurring_products')
    .select('id, name, lot_id, quantity_available, unit, received_date')
    .eq('recurring_product_tag_id', tagId)
    .gt('quantity_available', 0)
    .order('received_date', { ascending: false });

  if (error) throw error;
  return (data || []) as RecurringProductLotDetail[];
}

export async function fetchProcessedGoodsBatchDetails(
  tagId: string
): Promise<ProcessedGoodsBatchDetail[]> {
  const { data, error } = await supabase
    .from('processed_goods')
    .select(`
      id,
      batch_id,
      quantity_created,
      quantity_available,
      unit,
      production_date,
      production_batches(batch_id)
    `)
    .eq('produced_goods_tag_id', tagId)
    .gt('quantity_available', 0)
    .order('production_date', { ascending: false });

  if (error) throw error;

  return (data || []).map((item: any) => ({
    id: item.id,
    batch_name: item.production_batches?.batch_id || 'Unknown',
    quantity_created: item.quantity_created,
    quantity_available: item.quantity_available,
    unit: item.unit,
    production_date: item.production_date,
  }));
}
