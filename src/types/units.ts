export type UnitType = 'raw_material' | 'recurring_product' | 'produced_goods';

export type UnitStatus = 'active' | 'inactive';

export interface RawMaterialUnit {
  id: string;
  unit_key: string;
  display_name: string;
  description?: string | null;
  allows_decimal: boolean;
  status: UnitStatus;
  created_at: string;
  created_by?: string | null;
  updated_at: string;
  updated_by?: string | null;
}

export interface RecurringProductUnit {
  id: string;
  unit_key: string;
  display_name: string;
  description?: string | null;
  allows_decimal: boolean;
  status: UnitStatus;
  created_at: string;
  created_by?: string | null;
  updated_at: string;
  updated_by?: string | null;
}

export interface ProducedGoodsUnit {
  id: string;
  unit_key: string;
  display_name: string;
  description?: string | null;
  allows_decimal: boolean;
  status: UnitStatus;
  created_at: string;
  created_by?: string | null;
  updated_at: string;
  updated_by?: string | null;
}

export type Unit = RawMaterialUnit | RecurringProductUnit | ProducedGoodsUnit;

export interface UnitUsageCount {
  unit_id: string;
  usage_count: number;
}

export interface CreateUnitInput {
  unit_key: string;
  display_name: string;
  description?: string;
  allows_decimal: boolean;
  status?: UnitStatus;
}

export interface UpdateUnitInput {
  display_name?: string;
  description?: string;
  allows_decimal?: boolean;
  status?: UnitStatus;
}
