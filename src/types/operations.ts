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
  recurring_product_tag_id?: string;
  recurring_product_tag_ids?: string[]; // For UI compatibility
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
  output_product_type?: string; // Made optional for backward compatibility
  output_quantity?: number; // Made optional for backward compatibility
  output_unit?: string; // Made optional for backward compatibility
  qa_status: 'pending' | 'approved' | 'rejected' | 'hold';
  notes?: string;
  is_locked: boolean;
  production_start_date?: string;
  production_end_date?: string;
  custom_fields?: string; // JSON string
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

export interface BatchOutput {
  id: string;
  batch_id: string;
  output_name: string;
  output_size?: number;
  output_size_unit?: string;
  produced_quantity: number;
  produced_unit: string;
  produced_goods_tag_id: string;
  produced_goods_tag_name?: string;
  created_at: string;
  updated_at: string;
}

export interface ProcessedGood {
  id: string;
  batch_id?: string;
  batch_reference: string;
  product_type: string;
  quantity_available: number;
  quantity_created?: number; // Original quantity when created from production batch
  quantity_delivered?: number; // Total quantity delivered/sold (calculated)
  actual_available?: number; // Available quantity after reservations (for UI display)
  unit: string;
  production_date: string;
  qa_status: string;
  output_size?: number;
  output_size_unit?: string;
  additional_information?: string;
  custom_fields?: string; // JSON string
  produced_goods_tag_id?: string;
  produced_goods_tag_name?: string; // For display purposes
  created_at: string;
  created_by?: string;
}

export interface Machine {
  id: string;
  name: string;
  category: string;
  supplier_id?: string;
  supplier_name?: string;
  responsible_user_id?: string;
  responsible_user_name?: string;
  purchase_date?: string;
  purchase_cost?: number;
  status: 'active' | 'maintenance' | 'idle';
  notes?: string;
  created_at: string;
  created_by?: string;
  updated_at: string;
}

export interface MachineDocument {
  id: string;
  machine_id: string;
  name: string;
  file_name: string;
  file_type?: string;
  file_size?: number;
  file_url?: string;
  file_path: string;
  uploaded_by?: string;
  uploaded_by_name?: string;
  uploaded_at: string;
  created_at: string;
}

export interface WasteRecord {
  id: string;
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
  type?: 'transfer_out' | 'transfer_in'; // Transfer direction relative to queried lot
}

export interface StockMovement {
  id: string;
  item_type: 'raw_material' | 'recurring_product';
  item_reference: string; // UUID reference to raw_materials.id or recurring_products.id
  lot_reference?: string; // Lot identifier (lot_id)
  movement_type: 'IN' | 'CONSUMPTION' | 'WASTE' | 'TRANSFER_OUT' | 'TRANSFER_IN';
  quantity: number; // Always positive
  unit: string;
  effective_date: string;
  reference_id?: string; // UUID reference to waste_tracking.id, transfer_tracking.id, or production_batches.id
  reference_type?: 'waste_record' | 'transfer_record' | 'production_batch' | 'initial_intake';
  notes?: string;
  created_at: string;
  created_by?: string;
  running_balance?: number; // Calculated running balance for history views
}
