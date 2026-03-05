export type RawMaterialTypeStatus = 'active' | 'inactive';

export interface RawMaterialType {
  id: string;
  type_key: string;
  type_name: string;
  raw_material_tag_id: string;
  allowed_unit_ids: string[];
  status: RawMaterialTypeStatus;
  created_at: string;
  created_by?: string | null;
  updated_at: string;
  updated_by?: string | null;
}

export interface CreateRawMaterialTypeInput {
  type_key: string;
  type_name: string;
  raw_material_tag_id: string;
  allowed_unit_ids: string[];
  status?: RawMaterialTypeStatus;
}

export interface UpdateRawMaterialTypeInput {
  type_name?: string;
  raw_material_tag_id?: string;
  allowed_unit_ids?: string[];
  status?: RawMaterialTypeStatus;
}

