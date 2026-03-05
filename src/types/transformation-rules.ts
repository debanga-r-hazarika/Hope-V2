export interface TransformationRuleStep {
  key: string;
  label: string;
}

export interface RawMaterialTransformationRule {
  id: string;
  source_tag_id: string;
  target_tag_id: string;
  default_steps: TransformationRuleStep[];
  created_at: string;
  updated_at: string;
}

export interface TransformationRuleWithTarget {
  id: string;
  source_tag_id: string;
  target_tag_id: string;
  default_steps: TransformationRuleStep[];
  target_display_name?: string;
  target_tag_key?: string;
}

export interface UpsertTransformationRulesInput {
  source_tag_id: string;
  rules: Array<{ target_tag_id: string; default_steps: TransformationRuleStep[] }>;
}
