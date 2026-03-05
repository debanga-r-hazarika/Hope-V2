export type UnitType = 'raw_material' | 'recurring_product' | 'produced_goods';

export type UnitStatus = 'active' | 'inactive';

export interface RawMaterialUnit {
  id: string;
  unit_key: string;
  display_name: string;
  description?: string | null;
  allows_decimal: boolean;
  /** Lots in this unit can be archived when quantity_available <= archive_threshold (e.g. 0.2 kg, 5 pieces). Default 5 if missing. */
  archive_threshold?: number;
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
  /** Lots in this unit can be archived when quantity_available <= archive_threshold (e.g. 5 pieces). Default 5 if missing. */
  archive_threshold?: number;
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
  /** Archive when quantity_available <= this (e.g. 0.2 for kg, 5 for pieces). Default 5. */
  archive_threshold?: number;
  status?: UnitStatus;
}

export interface UpdateUnitInput {
  display_name?: string;
  description?: string;
  allows_decimal?: boolean;
  archive_threshold?: number;
  status?: UnitStatus;
}
