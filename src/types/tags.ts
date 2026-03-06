export type TagType = 'raw_material' | 'recurring_product' | 'produced_goods';

export type TagStatus = 'active' | 'inactive';

export interface RawMaterialTag {
  id: string;
  tag_key: string;
  display_name: string;
  description?: string | null;
  lot_prefix?: string | null;
  // Optional per-tag configuration
  // - allowed_unit_ids: which raw_material_units are allowed for this tag (enforced in app)
  // - allowed_conditions: condition options for the add/edit lot form (e.g. Raw, Semi-ripe, Ripe)
  // - lifecycle_type: optional key to drive special workflows (e.g. 'banana_multi_stage')
  allowed_unit_ids?: string[] | null;
  allowed_conditions?: string[] | null;
  lifecycle_type?: string | null;
  status: TagStatus;
  created_at: string;
  created_by?: string | null;
  updated_at: string;
  updated_by?: string | null;
}

export interface RecurringProductTag {
  id: string;
  tag_key: string;
  display_name: string;
  description?: string | null;
  status: TagStatus;
  created_at: string;
  created_by?: string | null;
  updated_at: string;
  updated_by?: string | null;
}

export interface ProducedGoodsTag {
  id: string;
  tag_key: string;
  display_name: string;
  description?: string | null;
  status: TagStatus;
  created_at: string;
  created_by?: string | null;
  updated_at: string;
  updated_by?: string | null;
}

export type Tag = RawMaterialTag | RecurringProductTag | ProducedGoodsTag;

export interface TagUsageCount {
  tag_id: string;
  usage_count: number;
}

export interface CreateTagInput {
  tag_key: string;
  display_name: string;
  description?: string;
  lot_prefix?: string;
  allowed_unit_ids?: string[];
  allowed_conditions?: string[];
  lifecycle_type?: string;
  status?: TagStatus;
}

export interface UpdateTagInput {
  display_name?: string;
  description?: string;
  lot_prefix?: string | null;
  allowed_unit_ids?: string[];
  allowed_conditions?: string[] | null;
  lifecycle_type?: string | null;
  status?: TagStatus;
}
