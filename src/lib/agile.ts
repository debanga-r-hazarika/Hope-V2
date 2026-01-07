import { supabase } from './supabase';
import type { AgileStatus, AgileIssue, AgileIssueInput, AgileFilters, AgileRoadmapBucket } from '../types/agile';

function mapDbToIssue(row: any): AgileIssue {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    statusId: row.status_id,
    estimate: row.estimate,
    ownerId: row.owner_id,
    ownerName: row.owner_name,
    tags: row.tags || [],
    roadmapBucket: row.roadmap_bucket,
    ordering: row.ordering,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    priority: row.priority,
    deadlineDate: row.deadline_date,
    readyForReview: row.ready_for_review,
    reviewRejected: row.review_rejected,
  };
}

export async function fetchStatuses(): Promise<AgileStatus[]> {
  const { data, error } = await supabase
    .from('agile_statuses')
    .select('*')
    .order('position');

  if (error) throw error;
  return data || [];
}

export async function fetchAgileStatuses(): Promise<AgileStatus[]> {
  return fetchStatuses();
}

export async function fetchAgileIssues(filters?: AgileFilters): Promise<AgileIssue[]> {
  return fetchIssues(filters);
}

export async function updateAgileIssue(id: string, updates: Partial<AgileIssueInput>): Promise<AgileIssue> {
  return updateIssue(id, updates);
}

export async function deleteAgileIssue(id: string): Promise<void> {
  return deleteIssue(id);
}

export async function createAgileIssue(issue: AgileIssueInput, options?: { createdBy?: string }): Promise<AgileIssue> {
  return createIssue({ ...issue, createdBy: options?.createdBy });
}

export async function fetchAgileOwners() {
  const { data, error } = await supabase
    .from('users')
    .select('id, full_name')
    .order('full_name');

  if (error) throw error;
  return (data || []).map(user => ({ id: user.id, name: user.full_name }));
}

export function summarizePointsByStatus(issues: AgileIssue[], statuses: AgileStatus[]) {
  const summary: Record<string, number> = {};

  statuses.forEach((status) => {
    summary[status.id] = 0;
  });

  issues.forEach((issue) => {
    if (issue.statusId && summary[issue.statusId] !== undefined) {
      summary[issue.statusId] += issue.estimate || 0;
    }
  });

  return summary;
}

export async function fetchAgileBuckets(): Promise<AgileRoadmapBucket[]> {
  return fetchRoadmapBuckets();
}

export async function updateIssueOrdering(updates: Array<{ id: string; statusId: string | null; ordering: number }>): Promise<void> {
  for (const update of updates) {
    const payload: any = { ordering: update.ordering };
    if (update.statusId !== undefined) {
      payload.status_id = update.statusId;
    }

    const { error } = await supabase
      .from('agile_issues')
      .update(payload)
      .eq('id', update.id);

    if (error) throw error;
  }
}

export async function createStatus(status: Partial<AgileStatus>): Promise<AgileStatus> {
  const { data, error } = await supabase
    .from('agile_statuses')
    .insert([status])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateStatus(id: string, updates: Partial<AgileStatus>): Promise<AgileStatus> {
  const { data, error } = await supabase
    .from('agile_statuses')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteStatus(id: string): Promise<void> {
  const { error } = await supabase
    .from('agile_statuses')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function fetchIssues(filters?: AgileFilters): Promise<AgileIssue[]> {
  let query = supabase.from('agile_issues').select('*').order('ordering');

  if (filters?.statusIds && filters.statusIds.length > 0) {
    query = query.in('status_id', filters.statusIds);
  }

  if (filters?.ownerIds && filters.ownerIds.length > 0) {
    query = query.in('owner_id', filters.ownerIds);
  }

  if (filters?.tag) {
    query = query.contains('tags', [filters.tag]);
  }

  if (filters?.readyOnly) {
    query = query.eq('ready_for_review', true);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data || []).map(mapDbToIssue);
}

export async function createIssue(issue: AgileIssueInput): Promise<AgileIssue> {
  const payload: any = {
    title: issue.title,
    description: issue.description,
    status_id: issue.statusId,
    estimate: issue.estimate,
    owner_id: issue.ownerId,
    owner_name: issue.ownerName,
    tags: issue.tags,
    roadmap_bucket: issue.roadmapBucket,
    created_by: issue.createdBy,
    priority: issue.priority,
    deadline_date: issue.deadlineDate,
    ready_for_review: issue.readyForReview || false,
    review_rejected: issue.reviewRejected || false,
  };

  if (issue.ordering !== undefined && issue.ordering !== null) {
    payload.ordering = issue.ordering;
  }

  const { data, error } = await supabase
    .from('agile_issues')
    .insert([payload])
    .select()
    .single();

  if (error) throw error;
  return mapDbToIssue(data);
}

export async function updateIssue(id: string, updates: Partial<AgileIssueInput>): Promise<AgileIssue> {
  const payload: any = {};
  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.statusId !== undefined) payload.status_id = updates.statusId;
  if (updates.estimate !== undefined) payload.estimate = updates.estimate;
  if (updates.ownerId !== undefined) payload.owner_id = updates.ownerId;
  if (updates.ownerName !== undefined) payload.owner_name = updates.ownerName;
  if (updates.tags !== undefined) payload.tags = updates.tags;
  if (updates.roadmapBucket !== undefined) payload.roadmap_bucket = updates.roadmapBucket;
  if (updates.ordering !== undefined) payload.ordering = updates.ordering;
  if (updates.priority !== undefined) payload.priority = updates.priority;
  if (updates.deadlineDate !== undefined) payload.deadline_date = updates.deadlineDate;
  if (updates.readyForReview !== undefined) payload.ready_for_review = updates.readyForReview;
  if (updates.reviewRejected !== undefined) payload.review_rejected = updates.reviewRejected;

  const { data, error } = await supabase
    .from('agile_issues')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return mapDbToIssue(data);
}

export async function deleteIssue(id: string): Promise<void> {
  const { error } = await supabase
    .from('agile_issues')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function fetchRoadmapBuckets(): Promise<AgileRoadmapBucket[]> {
  const { data, error } = await supabase
    .from('agile_roadmap_buckets')
    .select('*')
    .order('sort_order');

  if (error) throw error;
  return data || [];
}

export async function createRoadmapBucket(bucket: Partial<AgileRoadmapBucket>): Promise<AgileRoadmapBucket> {
  const { data, error } = await supabase
    .from('agile_roadmap_buckets')
    .insert([bucket])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateRoadmapBucket(id: string, updates: Partial<AgileRoadmapBucket>): Promise<AgileRoadmapBucket> {
  const { data, error } = await supabase
    .from('agile_roadmap_buckets')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteRoadmapBucket(id: string): Promise<void> {
  const { error} = await supabase
    .from('agile_roadmap_buckets')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
