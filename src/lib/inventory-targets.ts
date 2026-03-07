import { supabase } from './supabase';
import type { InventoryTarget, InventoryTargetFormData, InventoryTargetProgress } from '../types/inventory-targets';

// ============================================
// FETCH INVENTORY TARGETS
// ============================================

export async function fetchInventoryTargets(
  status?: 'active' | 'completed' | 'cancelled'
): Promise<InventoryTarget[]> {
  let query = supabase
    .from('analytics_targets')
    .select('*')
    .in('target_type', ['stock_level', 'consumption_limit', 'waste_reduction', 'stock_turnover', 'new_stock_arrival'])
    .order('period_start', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw error;

  // Fetch tag names separately if needed
  const targetsWithTags = await Promise.all(
    (data || []).map(async (target: any) => {
      if (target.tag_id && target.tag_type) {
        const tableName = 
          target.tag_type === 'raw_material' ? 'raw_material_tags' :
          target.tag_type === 'recurring_product' ? 'recurring_product_tags' :
          'produced_goods_tags';
        
        const { data: tagData } = await supabase
          .from(tableName)
          .select('display_name')
          .eq('id', target.tag_id)
          .single();
        
        return {
          ...target,
          tag_name: tagData?.display_name || null,
        };
      }
      return {
        ...target,
        tag_name: null,
      };
    })
  );

  return targetsWithTags;
}

// ============================================
// CREATE INVENTORY TARGET
// ============================================

export async function createInventoryTarget(
  formData: InventoryTargetFormData,
  userProfileId: string
): Promise<InventoryTarget> {
  const { data, error } = await supabase
    .from('analytics_targets')
    .insert({
      target_name: formData.target_name,
      target_type: formData.target_type,
      target_value: formData.target_value,
      tag_type: formData.tag_type,
      tag_id: formData.tag_id,
      period_start: formData.period_start,
      period_end: formData.period_end,
      description: formData.description || null,
      status: 'active',
      created_by: userProfileId,
      updated_by: userProfileId,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============================================
// UPDATE INVENTORY TARGET
// ============================================

export async function updateInventoryTarget(
  targetId: string,
  formData: Partial<InventoryTargetFormData>,
  userProfileId: string
): Promise<InventoryTarget> {
  const updateData: any = {
    ...formData,
    updated_by: userProfileId,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('analytics_targets')
    .update(updateData)
    .eq('id', targetId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============================================
// DELETE INVENTORY TARGET
// ============================================

export async function deleteInventoryTarget(targetId: string): Promise<void> {
  const { error } = await supabase
    .from('analytics_targets')
    .delete()
    .eq('id', targetId);

  if (error) throw error;
}

// ============================================
// UPDATE TARGET STATUS
// ============================================

export async function updateInventoryTargetStatus(
  targetId: string,
  status: 'active' | 'completed' | 'cancelled',
  userProfileId: string
): Promise<void> {
  const { error } = await supabase
    .from('analytics_targets')
    .update({
      status,
      updated_by: userProfileId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', targetId);

  if (error) throw error;
}

// ============================================
// CALCULATE TARGET PROGRESS
// ============================================

export async function calculateInventoryTargetProgress(
  target: InventoryTarget
): Promise<InventoryTargetProgress> {
  let currentValue = 0;
  let statusMessage = '';

  const { period_start, period_end, tag_id, tag_type, target_type } = target;

  if (target_type === 'stock_level') {
    // Stock Level Target: Current stock should be >= target value
    // Get current stock balance for the tag
    if (tag_id && tag_type) {
      const tableName = 
        tag_type === 'raw_material' ? 'raw_materials' :
        tag_type === 'recurring_product' ? 'recurring_products' :
        'processed_goods';
      
      const tagColumn = 
        tag_type === 'raw_material' ? 'raw_material_tag_id' :
        tag_type === 'recurring_product' ? 'recurring_product_tag_id' :
        'produced_goods_tag_id';

      const { data, error } = await supabase
        .from(tableName)
        .select('quantity_available')
        .eq(tagColumn, tag_id);

      if (error) throw error;

      currentValue = (data || []).reduce((sum, item: any) => 
        sum + parseFloat(item.quantity_available || '0'), 0);
      
      statusMessage = currentValue >= target.target_value 
        ? 'Stock level maintained' 
        : `${(target.target_value - currentValue).toFixed(2)} units below target`;
    }

  } else if (target_type === 'consumption_limit') {
    // Consumption Limit: Total consumption should be <= target value
    // Get consumption from stock_movements table
    if (tag_id && tag_type) {
      const { data, error } = await supabase
        .from('stock_movements')
        .select('quantity')
        .eq('item_type', tag_type === 'recurring_product' ? 'recurring_product' : 'raw_material')
        .eq('movement_type', 'CONSUMPTION')
        .gte('effective_date', period_start)
        .lte('effective_date', period_end);

      if (error) throw error;

      // Filter by tag through item_reference
      const tableName = tag_type === 'raw_material' ? 'raw_materials' : 'recurring_products';
      const tagColumn = tag_type === 'raw_material' ? 'raw_material_tag_id' : 'recurring_product_tag_id';

      const { data: items } = await supabase
        .from(tableName)
        .select('id')
        .eq(tagColumn, tag_id);

      const validItemIds = new Set((items || []).map((item: any) => item.id));

      currentValue = (data || [])
        .filter((movement: any) => validItemIds.has(movement.item_reference))
        .reduce((sum, movement: any) => sum + parseFloat(movement.quantity || '0'), 0);

      // Generate contextual status message based on usage percentage
      const usagePercent = (currentValue / target.target_value) * 100;
      if (currentValue > target.target_value) {
        statusMessage = `${(currentValue - target.target_value).toFixed(2)} units over limit - EXCEEDED!`;
      } else if (usagePercent >= 90) {
        statusMessage = `${usagePercent.toFixed(1)}% of limit used - Near limit!`;
      } else if (usagePercent >= 75) {
        statusMessage = `${usagePercent.toFixed(1)}% of limit used - Monitor closely`;
      } else if (usagePercent >= 50) {
        statusMessage = `${usagePercent.toFixed(1)}% of limit used - On track`;
      } else {
        statusMessage = `${usagePercent.toFixed(1)}% of limit used - Well within limit`;
      }
    }

  } else if (target_type === 'waste_reduction') {
    // Waste Reduction: Waste percentage should be <= target value
    // Calculate waste percentage from stock_movements
    if (tag_id && tag_type) {
      const { data: movements, error } = await supabase
        .from('stock_movements')
        .select('quantity, movement_type')
        .eq('item_type', tag_type === 'recurring_product' ? 'recurring_product' : 'raw_material')
        .in('movement_type', ['CONSUMPTION', 'WASTE'])
        .gte('effective_date', period_start)
        .lte('effective_date', period_end);

      if (error) throw error;

      // Filter by tag
      const tableName = tag_type === 'raw_material' ? 'raw_materials' : 'recurring_products';
      const tagColumn = tag_type === 'raw_material' ? 'raw_material_tag_id' : 'recurring_product_tag_id';

      const { data: items } = await supabase
        .from(tableName)
        .select('id')
        .eq(tagColumn, tag_id);

      const validItemIds = new Set((items || []).map((item: any) => item.id));

      const filteredMovements = (movements || []).filter((m: any) => validItemIds.has(m.item_reference));

      const totalConsumption = filteredMovements
        .filter((m: any) => m.movement_type === 'CONSUMPTION')
        .reduce((sum, m: any) => sum + parseFloat(m.quantity || '0'), 0);

      const totalWaste = filteredMovements
        .filter((m: any) => m.movement_type === 'WASTE')
        .reduce((sum, m: any) => sum + parseFloat(m.quantity || '0'), 0);

      const totalUsage = totalConsumption + totalWaste;
      currentValue = totalUsage > 0 ? (totalWaste / totalUsage) * 100 : 0;

      // Generate contextual status message based on waste percentage
      const wastePercent = currentValue;
      if (currentValue > target.target_value) {
        statusMessage = `${wastePercent.toFixed(2)}% waste - ${(currentValue - target.target_value).toFixed(2)}% over limit!`;
      } else if (wastePercent >= target.target_value * 0.9) {
        statusMessage = `${wastePercent.toFixed(2)}% waste - Near limit!`;
      } else if (wastePercent >= target.target_value * 0.75) {
        statusMessage = `${wastePercent.toFixed(2)}% waste - Monitor closely`;
      } else if (wastePercent >= target.target_value * 0.5) {
        statusMessage = `${wastePercent.toFixed(2)}% waste - On track`;
      } else {
        statusMessage = `${wastePercent.toFixed(2)}% waste - Well within limit`;
      }
    }

  } else if (target_type === 'stock_turnover') {
    // Stock Turnover: (Consumption / Average Stock) should be >= target value
    // This is a more complex calculation
    if (tag_id && tag_type) {
      // Get consumption
      const { data: movements } = await supabase
        .from('stock_movements')
        .select('quantity')
        .eq('item_type', tag_type === 'recurring_product' ? 'recurring_product' : 'raw_material')
        .eq('movement_type', 'CONSUMPTION')
        .gte('effective_date', period_start)
        .lte('effective_date', period_end);

      // Filter by tag
      const tableName = tag_type === 'raw_material' ? 'raw_materials' : 'recurring_products';
      const tagColumn = tag_type === 'raw_material' ? 'raw_material_tag_id' : 'recurring_product_tag_id';

      const { data: items } = await supabase
        .from(tableName)
        .select('id, quantity_available')
        .eq(tagColumn, tag_id);

      const validItemIds = new Set((items || []).map((item: any) => item.id));

      const totalConsumption = (movements || [])
        .filter((m: any) => validItemIds.has(m.item_reference))
        .reduce((sum, m: any) => sum + parseFloat(m.quantity || '0'), 0);

      const averageStock = (items || []).reduce((sum, item: any) => 
        sum + parseFloat(item.quantity_available || '0'), 0) / Math.max((items || []).length, 1);

      currentValue = averageStock > 0 ? totalConsumption / averageStock : 0;

      statusMessage = currentValue >= target.target_value
        ? 'Turnover target achieved'
        : `${(target.target_value - currentValue).toFixed(2)} below target rate`;
    }

  } else if (target_type === 'new_stock_arrival') {
    // New Stock Arrival: Track new inventory additions (IN movements) in period
    // Target is the minimum amount of new stock that should be added
    if (tag_id && tag_type) {
      if (tag_type === 'produced_goods') {
        // For produced goods, count new batches created in the period
        const { data: batches, error } = await supabase
          .from('production_batches')
          .select('batch_outputs!inner(produced_quantity, produced_goods_tag_id)')
          .eq('batch_outputs.produced_goods_tag_id', tag_id)
          .gte('batch_date', period_start)
          .lte('batch_date', period_end);

        if (error) throw error;

        currentValue = (batches || []).reduce((sum, batch: any) => {
          const outputs = batch.batch_outputs || [];
          return sum + outputs.reduce((outputSum: number, output: any) => 
            outputSum + parseFloat(output.produced_quantity || '0'), 0);
        }, 0);

      } else {
        // For raw materials and recurring products, count IN movements
        // Join directly with the items table to get tag information
        const tableName = tag_type === 'raw_material' ? 'raw_materials' : 'recurring_products';
        const tagColumn = tag_type === 'raw_material' ? 'raw_material_tag_id' : 'recurring_product_tag_id';

        const { data: movements, error } = await supabase
          .from('stock_movements')
          .select(`
            quantity,
            ${tableName}!inner(${tagColumn})
          `)
          .eq('item_type', tag_type === 'recurring_product' ? 'recurring_product' : 'raw_material')
          .eq('movement_type', 'IN')
          .eq(`${tableName}.${tagColumn}`, tag_id)
          .gte('effective_date', period_start)
          .lte('effective_date', period_end);

        if (error) throw error;

        currentValue = (movements || []).reduce((sum, m: any) => 
          sum + parseFloat(m.quantity || '0'), 0);
      }

      statusMessage = currentValue >= target.target_value
        ? 'New stock target achieved'
        : `${(target.target_value - currentValue).toFixed(2)} units short of target`;
    }
  }

  const progressPercentage = target.target_value > 0 
    ? (currentValue / target.target_value) * 100 
    : 0;

  // For stock_level, stock_turnover, and new_stock_arrival, higher is better
  // For consumption_limit and waste_reduction, lower is better
  const isAchieved = 
    (target_type === 'stock_level' || target_type === 'stock_turnover' || target_type === 'new_stock_arrival')
      ? currentValue >= target.target_value
      : currentValue <= target.target_value;

  const remainingValue = Math.abs(target.target_value - currentValue);

  // Calculate days remaining (allow negative for expired)
  const today = new Date();
  const endDate = new Date(target.period_end);
  const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  return {
    target,
    current_value: currentValue,
    progress_percentage: progressPercentage,
    is_achieved: isAchieved,
    remaining_value: remainingValue,
    days_remaining: daysRemaining,
    status_message: statusMessage,
  };
}

// ============================================
// FETCH TARGETS WITH PROGRESS
// ============================================

export async function fetchInventoryTargetsWithProgress(
  status?: 'active' | 'completed' | 'cancelled'
): Promise<InventoryTargetProgress[]> {
  const targets = await fetchInventoryTargets(status);
  
  const progressPromises = targets.map(target => calculateInventoryTargetProgress(target));
  const progressData = await Promise.all(progressPromises);

  return progressData;
}
