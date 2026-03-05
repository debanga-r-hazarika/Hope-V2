export interface RawMaterialLifecycle {
  id: string;
  raw_material_tag_id: string;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
}

export interface RawMaterialLifecycleStage {
  id: string;
  lifecycle_id: string;
  stage_key: string;
  stage_label: string;
  stage_order: number;
  is_default: boolean;
  makes_usable: boolean;
}

export interface RawMaterialLifecycleTransition {
  id: string;
  lifecycle_id: string;
  from_stage_key: string;
  to_stage_key: string;
}

export interface RawMaterialLifecycleConfig {
  lifecycle: RawMaterialLifecycle;
  stages: RawMaterialLifecycleStage[];
  transitions: RawMaterialLifecycleTransition[];
}

export interface UpsertRawMaterialLifecycleInput {
  raw_material_tag_id: string;
  stages: Array<{
    stage_key: string;
    stage_label: string;
    stage_order: number;
    is_default: boolean;
    makes_usable: boolean;
  }>;
  transitions: Array<{
    from_stage_key: string;
    to_stage_key: string;
  }>;
}

