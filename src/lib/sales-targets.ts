import { supabase } from './supabase';
import type { SalesTarget, SalesTargetFormData, SalesTargetProgress } from '../types/sales-targets';

// ============================================
// FETCH SALES TARGETS
// ============================================

export async function fetchSalesTargets(
  status?: 'active' | 'completed' | 'cancelled'
): Promise<SalesTarget[]> {
  let query = supabase
    .from('analytics_targets')
    .select('*')
    .in('target_type', ['sales_quantity', 'sales_revenue'])
    .order('period_start', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw error;

  // Fetch tag names separately if needed
  const targetsWithTags = await Promise.all(
    (data || []).map(async (target: any) => {
      if (target.tag_id) {
        const { data: tagData } = await supabase
          .from('produced_goods_tags')
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
// CREATE SALES TARGET
// ============================================

export async function createSalesTarget(
  formData: SalesTargetFormData,
  userProfileId: string
): Promise<SalesTarget> {
  const { data, error } = await supabase
    .from('analytics_targets')
    .insert({
      target_name: formData.target_name,
      target_type: formData.target_type,
      target_value: formData.target_value,
      tag_type: formData.tag_id ? 'produced_goods' : null,
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
// UPDATE SALES TARGET
// ============================================

export async function updateSalesTarget(
  targetId: string,
  formData: Partial<SalesTargetFormData>,
  userProfileId: string
): Promise<SalesTarget> {
  const updateData: any = {
    ...formData,
    updated_by: userProfileId,
    updated_at: new Date().toISOString(),
  };

  if (formData.tag_id !== undefined) {
    updateData.tag_type = formData.tag_id ? 'produced_goods' : null;
  }

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
// DELETE SALES TARGET
// ============================================

export async function deleteSalesTarget(targetId: string): Promise<void> {
  const { error } = await supabase
    .from('analytics_targets')
    .delete()
    .eq('id', targetId);

  if (error) throw error;
}

// ============================================
// UPDATE TARGET STATUS
// ============================================

export async function updateTargetStatus(
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

export async function calculateTargetProgress(
  target: SalesTarget
): Promise<SalesTargetProgress> {
  let currentValue = 0;

  if (target.target_type === 'sales_quantity') {
    // Calculate total quantity sold for the product tag within the period
    // Include both ORDER_COMPLETED and READY_FOR_PAYMENT statuses
    // Fetch all order items with their orders
    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select('quantity, processed_good_id, orders!inner(order_date, status)')
      .in('orders.status', ['ORDER_COMPLETED', 'READY_FOR_PAYMENT'])
      .gte('orders.order_date', target.period_start)
      .lte('orders.order_date', target.period_end);

    if (itemsError) throw itemsError;

    if (target.tag_id) {
      // Filter by tag - fetch processed goods with matching tag
      const { data: processedGoods } = await supabase
        .from('processed_goods')
        .select('id')
        .eq('produced_goods_tag_id', target.tag_id);

      const validGoodIds = new Set((processedGoods || []).map((pg: any) => pg.id));
      
      currentValue = (items || [])
        .filter((item: any) => item.processed_good_id && validGoodIds.has(item.processed_good_id))
        .reduce((sum, item: any) => sum + parseFloat(item.quantity || '0'), 0);
    } else {
      // All products
      currentValue = (items || []).reduce((sum, item: any) => 
        sum + parseFloat(item.quantity || '0'), 0);
    }

  } else if (target.target_type === 'sales_revenue') {
    // Calculate total sales revenue for the product tag within the period
    // Include both ORDER_COMPLETED and READY_FOR_PAYMENT statuses
    let query = supabase
      .from('orders')
      .select('total_amount, discount_amount, order_date')
      .in('status', ['ORDER_COMPLETED', 'READY_FOR_PAYMENT'])
      .gte('order_date', target.period_start)
      .lte('order_date', target.period_end);

    if (target.tag_id) {
      // Need to filter by product tag through order_items
      const { data: orderItems, error: itemsError } = await supabase
        .from('order_items')
        .select(`
          order_id,
          quantity,
          unit_price,
          processed_goods!inner(produced_goods_tag_id),
          orders!inner(order_date, status, total_amount, discount_amount)
        `)
        .eq('processed_goods.produced_goods_tag_id', target.tag_id)
        .in('orders.status', ['ORDER_COMPLETED', 'READY_FOR_PAYMENT'])
        .gte('orders.order_date', target.period_start)
        .lte('orders.order_date', target.period_end);

      if (itemsError) throw itemsError;

      // Calculate revenue from matching items
      currentValue = (orderItems || []).reduce((sum, item: any) => {
        const itemValue = parseFloat(item.quantity || '0') * parseFloat(item.unit_price || '0');
        return sum + itemValue;
      }, 0);
    } else {
      // Total revenue across all products
      const { data, error } = await query;
      if (error) throw error;

      currentValue = (data || []).reduce((sum, order: any) => {
        const netTotal = parseFloat(order.total_amount || '0') - parseFloat(order.discount_amount || '0');
        return sum + netTotal;
      }, 0);
    }
  }

  const progressPercentage = target.target_value > 0 
    ? (currentValue / target.target_value) * 100 
    : 0;

  const isAchieved = currentValue >= target.target_value;
  const remainingValue = Math.max(0, target.target_value - currentValue);

  // Calculate days remaining (allow negative values for expired targets)
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
  };
}

// ============================================
// FETCH TARGETS WITH PROGRESS
// ============================================

export async function fetchTargetsWithProgress(
  status?: 'active' | 'completed' | 'cancelled'
): Promise<SalesTargetProgress[]> {
  const targets = await fetchSalesTargets(status);
  
  const progressPromises = targets.map(target => calculateTargetProgress(target));
  const progressData = await Promise.all(progressPromises);

  return progressData;
}
