import { supabase } from './supabase';
import type {
  CurrentInventoryByTag,
  OutOfStockItem,
  LowStockItem,
  ConsumptionSummary,
  InventoryAnalyticsFilters,
  InventoryMetrics,
  InventoryType,
  NewStockArrival,
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
// NEW STOCK ARRIVALS REPORT
// ============================================

export async function fetchNewStockArrivals(
  startDate: string,
  endDate: string,
  inventoryType?: InventoryType
): Promise<NewStockArrival[]> {
  const promises = [];

  // Fetch Raw Materials (include archived items for proper analysis)
  if (!inventoryType || inventoryType === 'raw_material') {
    promises.push(
      supabase
        .from('raw_materials')
        .select(`
          name,
          lot_id,
          quantity_received,
          unit,
          received_date,
          usable,
          is_archived,
          suppliers(name),
          created_by_user:users!raw_materials_created_by_fkey(full_name)
        `)
        .gte('received_date', startDate)
        .lte('received_date', endDate)
        .order('received_date', { ascending: false })
        .then(({ data, error }) => {
          if (error) throw error;
          return (data || []).map((item: any) => ({
            inventory_type: 'raw_material',
            item_name: item.name,
            lot_batch_id: item.lot_id,
            quantity: item.quantity_received,
            unit: item.unit,
            date: item.received_date,
            supplier: item.suppliers?.name,
            usable: item.usable,
            collected_by: item.created_by_user?.full_name,
            is_archived: item.is_archived
          }));
        })
    );
  }

  // Fetch Recurring Products (include archived items for proper analysis)
  if (!inventoryType || inventoryType === 'recurring_product') {
    promises.push(
      supabase
        .from('recurring_products')
        .select(`
          name,
          lot_id,
          quantity_received,
          unit,
          received_date,
          is_archived,
          suppliers(name)
        `)
        .gte('received_date', startDate)
        .lte('received_date', endDate)
        .order('received_date', { ascending: false })
        .then(({ data, error }) => {
          if (error) throw error;
          return (data || []).map((item: any) => ({
            inventory_type: 'recurring_product',
            item_name: item.name,
            lot_batch_id: item.lot_id,
            quantity: item.quantity_received,
            unit: item.unit,
            date: item.received_date,
            supplier: item.suppliers?.name,
            is_archived: item.is_archived
          }));
        })
    );
  }

  // Fetch Processed Goods (include archived items for proper analysis)
  if (!inventoryType || inventoryType === 'produced_goods') {
    promises.push(
      supabase
        .from('processed_goods')
        .select(`
          product_type,
          production_batches(batch_id),
          quantity_created,
          unit,
          production_date,
          is_archived,
          output_size,
          output_size_unit,
          produced_goods_tag_id,
          produced_goods_tags!produced_goods_tag_id(display_name)
        `)
        .gte('production_date', startDate)
        .lte('production_date', endDate)
        .order('production_date', { ascending: false })
        .then(({ data, error }) => {
          if (error) throw error;
          return (data || []).map((item: any) => {
            // Format item name with output size
            const itemName = item.output_size && item.output_size_unit 
              ? `${item.product_type} (${item.output_size} ${item.output_size_unit})`
              : item.product_type;
            
            return {
              inventory_type: 'produced_goods',
              item_name: itemName,
              lot_batch_id: item.production_batches?.batch_id || 'Unknown',
              quantity: item.quantity_created,
              unit: item.unit,
              date: item.production_date,
              is_archived: item.is_archived,
              tag_name: item.produced_goods_tags?.display_name
            };
          });
        })
    );
  }

  const results = await Promise.all(promises);
  return results.flat() as NewStockArrival[];
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
      is_archived,
      storage_notes,
      suppliers(name),
      created_by_user:users!raw_materials_created_by_fkey(full_name)
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
    is_archived: item.is_archived,
    supplier_name: item.suppliers?.name,
    storage_notes: item.storage_notes,
    collected_by_name: item.created_by_user?.full_name,
  }));
}

export async function fetchRecurringProductLotDetails(
  tagId: string
): Promise<RecurringProductLotDetail[]> {
  const { data, error } = await supabase
    .from('recurring_products')
    .select('id, name, lot_id, quantity_available, unit, received_date, is_archived')
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
      is_archived,
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
    is_archived: item.is_archived,
  }));
}

// ============================================
// CONSUMPTION DETAILS BY LOT/BATCH
// ============================================

export interface ConsumptionDetail {
  lot_batch_id: string;
  movement_type: 'CONSUMPTION' | 'WASTE';
  quantity: number;
  unit: string;
  effective_date: string;
}

export async function fetchConsumptionDetails(
  tagId: string,
  date: string,
  inventoryType: InventoryType
): Promise<ConsumptionDetail[]> {
  // First, get all item_references (IDs) for items with this tag
  let itemIds: string[] = [];
  
  if (inventoryType === 'raw_material') {
    const { data, error } = await supabase
      .from('raw_materials')
      .select('id')
      .eq('raw_material_tag_id', tagId);
    
    if (error) throw error;
    itemIds = (data || []).map(item => item.id);
    
  } else if (inventoryType === 'recurring_product') {
    const { data, error } = await supabase
      .from('recurring_products')
      .select('id')
      .eq('recurring_product_tag_id', tagId);
    
    if (error) throw error;
    itemIds = (data || []).map(item => item.id);
    
  } else if (inventoryType === 'produced_goods') {
    const { data, error } = await supabase
      .from('processed_goods')
      .select('id')
      .eq('produced_goods_tag_id', tagId);
    
    if (error) throw error;
    itemIds = (data || []).map(item => item.id);
  }

  // If no items found for this tag, return empty array
  if (itemIds.length === 0) {
    return [];
  }

  // Now fetch stock movements for these items
  const itemTypeMap = {
    'raw_material': 'raw_material',
    'recurring_product': 'recurring_product',
    'produced_goods': 'processed_good'
  };

  const { data, error } = await supabase
    .from('stock_movements')
    .select('lot_reference, movement_type, quantity, unit, effective_date')
    .eq('item_type', itemTypeMap[inventoryType])
    .eq('effective_date', date)
    .in('item_reference', itemIds)
    .in('movement_type', ['CONSUMPTION', 'WASTE'])
    .order('lot_reference', { ascending: true });

  if (error) throw error;

  return (data || []).map((item: any) => ({
    lot_batch_id: item.lot_reference || 'Unknown',
    movement_type: item.movement_type,
    quantity: Math.abs(item.quantity),
    unit: item.unit,
    effective_date: item.effective_date,
  }));
}
