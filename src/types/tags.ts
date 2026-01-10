export type TagType = 'raw_material' | 'recurring_product' | 'produced_goods';

export type TagStatus = 'active' | 'inactive';

export interface RawMaterialTag {
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
  status?: TagStatus;
}

export interface UpdateTagInput {
  display_name?: string;
  description?: string;
  status?: TagStatus;
}
