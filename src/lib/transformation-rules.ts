import { supabase } from './supabase';
import type {
  RawMaterialTransformationRule,
  TransformationRuleStep,
  TransformationRuleWithTarget,
  UpsertTransformationRulesInput,
} from '../types/transformation-rules';

function parseDefaultSteps(value: unknown): TransformationRuleStep[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (item && typeof item === 'object' && 'key' in item && 'label' in item) {
      return { key: String(item.key), label: String(item.label) };
    }
    return { key: '', label: '' };
  }).filter((s) => s.key || s.label);
}

/** Fetch all transformation rules for a source tag (with target tag display names). */
export async function fetchTransformationRulesBySourceTagId(
  sourceTagId: string
): Promise<TransformationRuleWithTarget[]> {
  const { data: rules, error } = await supabase
    .from('raw_material_transformation_rules')
    .select('id, source_tag_id, target_tag_id, default_steps')
    .eq('source_tag_id', sourceTagId);

  if (error) throw error;
  if (!rules?.length) return [];

  const targetIds = [...new Set(rules.map((r) => r.target_tag_id))];
  const { data: tags } = await supabase
    .from('raw_material_tags')
    .select('id, display_name, tag_key')
    .in('id', targetIds);

  const tagMap = new Map((tags || []).map((t) => [t.id, t]));

  return rules.map((r) => {
    const tag = tagMap.get(r.target_tag_id);
    return {
      id: r.id,
      source_tag_id: r.source_tag_id,
      target_tag_id: r.target_tag_id,
      default_steps: parseDefaultSteps(r.default_steps),
      target_display_name: tag?.display_name,
      target_tag_key: tag?.tag_key,
    };
  });
}

/** Fetch all transformation rules (for all source tags). Used to get allowed targets per source in one call. */
export async function fetchAllTransformationRules(): Promise<TransformationRuleWithTarget[]> {
  const { data: rules, error } = await supabase
    .from('raw_material_transformation_rules')
    .select('id, source_tag_id, target_tag_id, default_steps');

  if (error) throw error;
  if (!rules?.length) return [];

  const targetIds = [...new Set(rules.map((r) => r.target_tag_id))];
  const { data: tags } = await supabase
    .from('raw_material_tags')
    .select('id, display_name, tag_key')
    .in('id', targetIds);

  const tagMap = new Map((tags || []).map((t) => [t.id, t]));

  return rules.map((r) => {
    const tag = tagMap.get(r.target_tag_id);
    return {
      id: r.id,
      source_tag_id: r.source_tag_id,
      target_tag_id: r.target_tag_id,
      default_steps: parseDefaultSteps(r.default_steps),
      target_display_name: tag?.display_name,
      target_tag_key: tag?.tag_key,
    };
  });
}

/** Get allowed target tag IDs for a source tag. */
export async function getAllowedTargetTagIdsForSource(sourceTagId: string): Promise<string[]> {
  const rules = await fetchTransformationRulesBySourceTagId(sourceTagId);
  return rules.map((r) => r.target_tag_id);
}

/** Get default steps for a (source, target) pair. */
export async function getDefaultStepsForTransformation(
  sourceTagId: string,
  targetTagId: string
): Promise<TransformationRuleStep[]> {
  const { data, error } = await supabase
    .from('raw_material_transformation_rules')
    .select('default_steps')
    .eq('source_tag_id', sourceTagId)
    .eq('target_tag_id', targetTagId)
    .maybeSingle();

  if (error || !data) return [];
  return parseDefaultSteps(data.default_steps);
}

/** Replace all transformation rules for a source tag. */
export async function upsertTransformationRulesForSource(
  input: UpsertTransformationRulesInput
): Promise<TransformationRuleWithTarget[]> {
  const { error: deleteError } = await supabase
    .from('raw_material_transformation_rules')
    .delete()
    .eq('source_tag_id', input.source_tag_id);

  if (deleteError) throw deleteError;

  if (input.rules.length === 0) return [];

  const rows = input.rules.map((r) => ({
    source_tag_id: input.source_tag_id,
    target_tag_id: r.target_tag_id,
    default_steps: r.default_steps,
  }));

  const { data: inserted, error: insertError } = await supabase
    .from('raw_material_transformation_rules')
    .insert(rows)
    .select('id, source_tag_id, target_tag_id, default_steps');

  if (insertError) throw insertError;

  const targetIds = [...new Set(inserted?.map((r) => r.target_tag_id) || [])];
  const { data: tags } = await supabase
    .from('raw_material_tags')
    .select('id, display_name, tag_key')
    .in('id', targetIds);
  const tagMap = new Map((tags || []).map((t) => [t.id, t]));

  return (inserted || []).map((r) => {
    const tag = tagMap.get(r.target_tag_id);
    return {
      id: r.id,
      source_tag_id: r.source_tag_id,
      target_tag_id: r.target_tag_id,
      default_steps: parseDefaultSteps(r.default_steps),
      target_display_name: tag?.display_name,
      target_tag_key: tag?.tag_key,
    };
  });
}
