export interface Supplier {
  id: string;
  name: string;
  supplier_type: 'raw_material' | 'recurring_product' | 'machine' | 'multiple';
  contact_details?: string;
  notes?: string;
  created_at: string;
  created_by?: string;
  updated_at: string;
}

export interface RawMaterial {
  id: string;
  name: string;
  supplier_id?: string;
  supplier_name?: string;
  lot_id: string;
  quantity_received: number;
  quantity_available: number;
  unit: string;
  condition?: string;
  received_date: string;
  storage_notes?: string;
  handover_to?: string;
  handover_to_name?: string;
  amount_paid?: number;
  is_archived?: boolean;
  description_log?: string;
  created_at: string;
  created_by?: string;
  updated_at: string;
}

export interface RecurringProduct {
  id: string;
  name: string;
  category: string;
  supplier_id?: string;
  supplier_name?: string;
  lot_id: string;
  quantity_received: number;
  quantity_available: number;
  unit: string;
  received_date: string;
  notes?: string;
  handover_to?: string;
  handover_to_name?: string;
  amount_paid?: number;
  is_archived?: boolean;
  description_log?: string;
  created_at: string;
  created_by?: string;
  updated_at: string;
}

export interface ProductionBatch {
  id: string;
  batch_id: string;
  batch_date: string;
  responsible_user_id?: string;
  responsible_user_name?: string;
  output_product_type: string;
  output_quantity: number;
  output_unit: string;
  qa_status: 'pending' | 'approved' | 'rejected' | 'hold';
  qa_reason?: string;
  production_start_date?: string;
  production_end_date?: string;
  additional_information?: string;
  custom_fields?: string | Array<{ key: string; value: string }>;
  notes?: string;
  is_locked: boolean;
  created_at: string;
  created_by?: string;
  updated_at: string;
}

export interface BatchRawMaterial {
  id: string;
  batch_id: string;
  raw_material_id: string;
  raw_material_name: string;
  lot_id: string;
  quantity_consumed: number;
  unit: string;
  created_at: string;
}

export interface BatchRecurringProduct {
  id: string;
  batch_id: string;
  recurring_product_id: string;
  recurring_product_name: string;
  quantity_consumed: number;
  unit: string;
  created_at: string;
}

export interface ProcessedGood {
  id: string;
  batch_id?: string;
  batch_reference: string;
  product_type: string;
  quantity_available: number;
  unit: string;
  production_date: string;
  qa_status: string;
  created_at: string;
  created_by?: string;
}

export interface Machine {
  id: string;
  name: string;
  category: string;
  supplier_id?: string;
  supplier_name?: string;
  purchase_date?: string;
  purchase_cost?: number;
  status: 'active' | 'maintenance' | 'idle';
  notes?: string;
  created_at: string;
  created_by?: string;
  updated_at: string;
}

export interface WasteRecord {
  id: string;
  waste_id?: string;
  lot_type: 'raw_material' | 'recurring_product';
  lot_id: string;
  lot_identifier: string;
  lot_name?: string; // For display
  quantity_wasted: number;
  unit: string;
  reason: string;
  notes?: string;
  waste_date: string;
  created_at: string;
  created_by?: string;
  created_by_name?: string;
}

export interface TransferRecord {
  id: string;
  transfer_id?: string;
  lot_type: 'raw_material' | 'recurring_product';
  from_lot_id: string;
  from_lot_identifier: string;
  from_lot_name?: string; // For display
  to_lot_id: string;
  to_lot_identifier: string;
  to_lot_name?: string; // For display
  quantity_transferred: number;
  unit: string;
  reason: string;
  notes?: string;
  transfer_date: string;
  created_at: string;
  created_by?: string;
  created_by_name?: string;
}
