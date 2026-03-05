import { supabase } from './supabase';
import type {
  RawMaterialLifecycleConfig,
  UpsertRawMaterialLifecycleInput,
  RawMaterialLifecycleStage,
  RawMaterialLifecycleTransition,
} from '../types/raw-material-lifecycle';

export async function fetchRawMaterialLifecycleConfigByTagId(
  rawMaterialTagId: string
): Promise<RawMaterialLifecycleConfig | null> {
  const { data: lifecycle, error: lifecycleError } = await supabase
    .from('raw_material_lifecycles')
    .select('*')
    .eq('raw_material_tag_id', rawMaterialTagId)
    .maybeSingle();

  if (lifecycleError) throw lifecycleError;
  if (!lifecycle) return null;

  const [stagesResult, transitionsResult] = await Promise.all([
    supabase
      .from('raw_material_lifecycle_stages')
      .select('*')
      .eq('lifecycle_id', lifecycle.id)
      .order('stage_order', { ascending: true }),
    supabase
      .from('raw_material_lifecycle_transitions')
      .select('*')
      .eq('lifecycle_id', lifecycle.id)
      .order('from_stage_key', { ascending: true })
      .order('to_stage_key', { ascending: true }),
  ]);

  if (stagesResult.error) throw stagesResult.error;
  if (transitionsResult.error) throw transitionsResult.error;

  return {
    lifecycle,
    stages: (stagesResult.data || []) as RawMaterialLifecycleStage[],
    transitions: (transitionsResult.data || []) as RawMaterialLifecycleTransition[],
  };
}

export function getDefaultStageKey(stages: RawMaterialLifecycleStage[]): string | null {
  const explicit = stages.find((s) => s.is_default);
  if (explicit) return explicit.stage_key;
  return stages.length > 0 ? stages[0].stage_key : null;
}

export function getAllowedNextStages(
  transitions: RawMaterialLifecycleTransition[],
  fromStageKey: string | null | undefined
): string[] {
  if (!fromStageKey) return [];
  return transitions.filter((t) => t.from_stage_key === fromStageKey).map((t) => t.to_stage_key);
}

export function isStageUsable(stages: RawMaterialLifecycleStage[], stageKey: string | null | undefined): boolean {
  if (!stageKey) return false;
  const stage = stages.find((s) => s.stage_key === stageKey);
  return !!stage?.makes_usable;
}

export async function upsertRawMaterialLifecycleConfig(
  input: UpsertRawMaterialLifecycleInput
): Promise<RawMaterialLifecycleConfig> {
  // 1) Ensure lifecycle row exists
  const { data: upsertedLifecycle, error: upsertLifecycleError } = await supabase
    .from('raw_material_lifecycles')
    .upsert(
      {
        raw_material_tag_id: input.raw_material_tag_id,
      },
      { onConflict: 'raw_material_tag_id' }
    )
    .select()
    .single();

  if (upsertLifecycleError) throw upsertLifecycleError;

  const lifecycleId = upsertedLifecycle.id;

  // 2) Replace stages + transitions (simple + deterministic)
  const [deleteStages, deleteTransitions] = await Promise.all([
    supabase.from('raw_material_lifecycle_stages').delete().eq('lifecycle_id', lifecycleId),
    supabase.from('raw_material_lifecycle_transitions').delete().eq('lifecycle_id', lifecycleId),
  ]);
  if (deleteStages.error) throw deleteStages.error;
  if (deleteTransitions.error) throw deleteTransitions.error;

  const stagesPayload = input.stages.map((s) => ({
    lifecycle_id: lifecycleId,
    stage_key: s.stage_key,
    stage_label: s.stage_label,
    stage_order: s.stage_order,
    is_default: s.is_default,
    makes_usable: s.makes_usable,
  }));

  const transitionsPayload = input.transitions.map((t) => ({
    lifecycle_id: lifecycleId,
    from_stage_key: t.from_stage_key,
    to_stage_key: t.to_stage_key,
  }));

  const [insertStages, insertTransitions] = await Promise.all([
    stagesPayload.length > 0
      ? supabase.from('raw_material_lifecycle_stages').insert(stagesPayload).select('*')
      : Promise.resolve({ data: [], error: null } as any),
    transitionsPayload.length > 0
      ? supabase.from('raw_material_lifecycle_transitions').insert(transitionsPayload).select('*')
      : Promise.resolve({ data: [], error: null } as any),
  ]);

  if (insertStages.error) throw insertStages.error;
  if (insertTransitions.error) throw insertTransitions.error;

  return {
    lifecycle: upsertedLifecycle,
    stages: (insertStages.data || []) as RawMaterialLifecycleStage[],
    transitions: (insertTransitions.data || []) as RawMaterialLifecycleTransition[],
  };
}

