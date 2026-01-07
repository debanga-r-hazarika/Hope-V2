import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, RefreshCw, Tag, Users, KanbanSquare, Map, X, CheckCircle } from 'lucide-react';
import type { AccessLevel } from '../types/access';
import type { AgileIssue, AgileStatus, AgileRoadmapBucket } from '../types/agile';
import {
  createAgileIssue,
  deleteAgileIssue,
  fetchAgileBuckets,
  fetchAgileIssues,
  fetchAgileOwners,
  fetchAgileStatuses,
  summarizePointsByStatus,
  updateAgileIssue,
  updateIssueOrdering,
} from '../lib/agile';
import { useModuleAccess } from '../contexts/ModuleAccessContext';

type ViewMode = 'board' | 'backlog' | 'roadmap';

interface AgileProps {
  accessLevel: AccessLevel;
}

export function Agile({ accessLevel }: AgileProps) {
  const { userId } = useModuleAccess();
  const canWrite = accessLevel === 'read-write';
  const [view, setView] = useState<ViewMode>('board');
  const [statuses, setStatuses] = useState<AgileStatus[]>([]);
  const [buckets, setBuckets] = useState<AgileRoadmapBucket[]>([]);
  const [issues, setIssues] = useState<AgileIssue[]>([]);
  const [owners, setOwners] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<{ statusIds: string[]; ownerId: string; tag: string; dueRange: '' | 'overdue' | 'week' | 'today'; sort: '' | 'deadline-asc' | 'status-asc'; readyOnly: boolean; assignedOnly: boolean }>({
    statusIds: [],
    ownerId: '',
    tag: '',
    dueRange: '',
    sort: '',
    readyOnly: false,
    assignedOnly: false,
  });
  const [newIssue, setNewIssue] = useState<{ title: string; statusId: string; priority: 'high' | 'normal' | 'low'; estimate: string; ownerId: string; tags: string; description: string; deadlineDate: string }>({
    title: '',
    statusId: '',
    priority: 'normal',
    estimate: '',
    ownerId: '',
    tags: '',
    description: '',
    deadlineDate: '',
  });
  const quickAddRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (showQuickAdd && quickAddRef.current) {
      requestAnimationFrame(() => {
        quickAddRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, [showQuickAdd]);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const filtersActive = Boolean(
    filters.ownerId ||
    filters.tag ||
    filters.statusIds.length ||
    filters.dueRange ||
    filters.readyOnly ||
    filters.assignedOnly
  );

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statusData, bucketData, issueData, ownerData] = await Promise.all([
        fetchAgileStatuses(),
        fetchAgileBuckets(),
        fetchAgileIssues(),
        fetchAgileOwners(),
      ]);
      setStatuses(statusData);
      setBuckets(bucketData);
      setIssues(issueData);
      setOwners(ownerData);
      setNewIssue((prev) => ({
        ...prev,
        statusId: statusData[0]?.id ?? '',
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load Agile data';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (accessLevel === 'no-access') return;
    void loadData();
  }, [accessLevel]);

  const filteredIssues = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfWeek = new Date(startOfToday);
    endOfWeek.setDate(startOfToday.getDate() + 7);

    const passesFilters = (issue: AgileIssue) => {
      const matchesStatus = filters.statusIds.length === 0 || (issue.statusId && filters.statusIds.includes(issue.statusId));
      const matchesOwner =
        (!filters.ownerId || issue.ownerId === filters.ownerId) &&
        (!filters.assignedOnly || (userId && issue.ownerId === userId));
      const matchesTag = !filters.tag || issue.tags?.some((tag) => tag.toLowerCase().includes(filters.tag.toLowerCase()));
      const matchesReady = !filters.readyOnly || issue.readyForReview;
      let matchesDue = true;
      if (filters.dueRange) {
        const deadline = issue.deadlineDate ? new Date(issue.deadlineDate) : null;
        if (!deadline) {
          matchesDue = false;
        } else if (filters.dueRange === 'today') {
          matchesDue = deadline >= startOfToday && deadline < endOfWeek && deadline <= endOfWeek && deadline.getTime() === deadline.getTime();
          matchesDue = deadline >= startOfToday && deadline < new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
        } else if (filters.dueRange === 'week') {
          matchesDue = deadline >= startOfToday && deadline <= endOfWeek;
        } else if (filters.dueRange === 'overdue') {
          matchesDue = deadline < startOfToday;
        }
      }
      return matchesStatus && matchesOwner && matchesTag && matchesDue && matchesReady;
    };

    let list = issues.filter(passesFilters);

    if (filters.sort === 'deadline-asc') {
      list = [...list].sort((a, b) => {
        const da = a.deadlineDate ? new Date(a.deadlineDate).getTime() : Number.MAX_SAFE_INTEGER;
        const db = b.deadlineDate ? new Date(b.deadlineDate).getTime() : Number.MAX_SAFE_INTEGER;
        if (da === db) return 0;
        return da < db ? -1 : 1;
      });
    } else if (filters.sort === 'status-asc') {
      list = [...list].sort((a, b) => {
        const getStatusOrder = (statusId: string | null) => {
          if (!statusId) return 999;
          const status = statuses.find((s) => s.id === statusId);
          if (!status) return 999;
          const name = status.name.toLowerCase();
          if (name.includes('to do') || name.includes('todo')) return 0;
          if (name.includes('progress')) return 1;
          if (name.includes('done')) return 2;
          return 999;
        };
        const orderA = getStatusOrder(a.statusId);
        const orderB = getStatusOrder(b.statusId);
        return orderA - orderB;
      });
    }

    return list;
  }, [issues, filters]);

  const issuesByStatus = useMemo(() => {
    const map: Record<string, AgileIssue[]> = {};
    statuses.forEach((status) => {
      map[status.id] = [];
    });
    filteredIssues.forEach((issue) => {
      if (issue.statusId && map[issue.statusId]) {
        map[issue.statusId].push(issue);
      }
    });
    Object.values(map).forEach((list) => list.sort((a, b) => a.ordering - b.ordering));
    return map;
  }, [filteredIssues, statuses]);

  const pointsByStatus = useMemo(() => summarizePointsByStatus(filteredIssues, statuses), [filteredIssues, statuses]);
  const totalPoints = useMemo(
    () => filteredIssues.reduce((sum, issue) => sum + (issue.estimate ?? 0), 0),
    [filteredIssues]
  );
  const doneStatusIds = useMemo(
    () => statuses.filter((status) => status.name.toLowerCase().includes('done')).map((s) => s.id),
    [statuses]
  );
  const donePoints = useMemo(
    () => doneStatusIds.reduce((sum, id) => sum + (pointsByStatus[id] ?? 0), 0),
    [doneStatusIds, pointsByStatus]
  );
  const completionPct = totalPoints > 0 ? Math.round((donePoints / totalPoints) * 100) : 0;
  const readyCount = useMemo(
    () => filteredIssues.filter((issue) => issue.readyForReview && !issue.reviewRejected).length,
    [filteredIssues]
  );

  const handleCreateIssue = async () => {
    if (!canWrite) return;
    if (!newIssue.title.trim()) {
      setError('Title is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await createAgileIssue(
        {
          title: newIssue.title.trim(),
          description: newIssue.description.trim() || undefined,
          statusId: newIssue.statusId || statuses[0]?.id,
          priority: newIssue.priority,
          estimate: newIssue.estimate ? Number(newIssue.estimate) : null,
          ownerId: newIssue.ownerId || undefined,
          ownerName: owners.find((o) => o.id === newIssue.ownerId)?.name ?? undefined,
          deadlineDate: newIssue.deadlineDate || null,
          tags: newIssue.tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
          roadmapBucket: buckets[0]?.id ?? null,
        },
        { createdBy: userId }
      );
      setIssues((prev) => [...prev, created]);
      setNewIssue((prev) => ({
        ...prev,
        title: '',
        priority: 'normal',
        estimate: '',
        tags: '',
        description: '',
        deadlineDate: '',
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create issue';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDrop = async (statusId: string) => {
    if (!canWrite || filtersActive) return;
    const current = issues.find((i) => i.id === draggingId);
    if (!current || current.statusId === statusId) return;

    const isDoneTarget = doneStatusIds.includes(statusId);

    const updated = issues.map((issue) =>
      issue.id === draggingId
        ? {
            ...issue,
            statusId,
            readyForReview: isDoneTarget ? false : issue.readyForReview,
            reviewRejected: isDoneTarget ? false : issue.reviewRejected,
          }
        : issue
    );

    const affectedStatuses = Array.from(
      new Set([statusId, current.statusId].filter(Boolean) as string[])
    );

    const updates: Array<{ id: string; statusId: string | null; ordering: number }> = [];

    affectedStatuses.forEach((id) => {
      const ordered = updated
        .filter((issue) => issue.statusId === id)
        .sort((a, b) => a.ordering - b.ordering)
        .map((issue, index) => {
          updates.push({ id: issue.id, statusId: id, ordering: index });
          return { ...issue, ordering: index };
        });
      ordered.forEach((issue) => {
        const target = updated.find((i) => i.id === issue.id);
        if (target) target.ordering = issue.ordering;
      });
    });

    setIssues(updated);

    try {
      await updateIssueOrdering(updates);
      // Clear review flags only when moved to Done
      if (isDoneTarget && (current.readyForReview || current.reviewRejected)) {
        try {
          const cleared = await updateAgileIssue(current.id, { readyForReview: false, reviewRejected: false });
          setIssues((prev) => prev.map((i) => (i.id === current.id ? cleared : i)));
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to clear review flag';
          setError(message);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to move issue';
      setError(message);
      // best-effort reload to avoid inconsistent order
      void loadData();
    } finally {
      setDraggingId(null);
    }
  };

  const handleUpdateRoadmap = async (issueId: string, bucketId: string) => {
    if (!canWrite) return;
    try {
      const updated = await updateAgileIssue(issueId, { roadmapBucket: bucketId });
      setIssues((prev) => prev.map((issue) => (issue.id === issueId ? updated : issue)));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to move issue to roadmap bucket';
      setError(message);
    }
  };

  const handleStatusChange = async (issueId: string, statusId: string) => {
    if (!canWrite) return;
    const nextOrdering =
      Math.max(
        ...issues
          .filter((i) => i.statusId === statusId)
          .map((i) => (typeof i.ordering === 'number' ? i.ordering : 0)),
        -1
      ) + 1;
    const optimistic = issues.map((i) =>
      i.id === issueId ? { ...i, statusId, ordering: nextOrdering } : i
    );
    setIssues(optimistic);
    try {
      const updated = await updateAgileIssue(issueId, { statusId, roadmapBucket: null, readyForReview: false, reviewRejected: false });
      setIssues((prev) => prev.map((i) => (i.id === issueId ? { ...updated, ordering: nextOrdering } : i)));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to move status';
      setError(message);
      void loadData();
    }
  };

  const handleEstimateChange = async (issueId: string, estimate: number | null) => {
    if (!canWrite) return;
    try {
      const updated = await updateAgileIssue(issueId, { estimate });
      setIssues((prev) => prev.map((issue) => (issue.id === issueId ? updated : issue)));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update estimate';
      setError(message);
    }
  };

  const handleDeleteIssue = async (issueId: string) => {
    if (!canWrite) return;
    try {
      await deleteAgileIssue(issueId);
      setIssues((prev) => prev.filter((issue) => issue.id !== issueId));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete issue';
      setError(message);
    }
  };

  const handleDeadlineChange = async (issueId: string, deadline: string | null) => {
    if (!canWrite) return;
    try {
      const updated = await updateAgileIssue(issueId, { deadlineDate: deadline });
      setIssues((prev) => prev.map((issue) => (issue.id === issueId ? updated : issue)));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update deadline';
      setError(message);
    }
  };

  const handleOwnerChange = async (issueId: string, ownerId: string | null) => {
    if (!canWrite) return;
    try {
      const ownerName = ownerId ? owners.find((o) => o.id === ownerId)?.name ?? null : null;
      const updated = await updateAgileIssue(issueId, { ownerId, ownerName });
      setIssues((prev) => prev.map((issue) => (issue.id === issueId ? updated : issue)));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update owner';
      setError(message);
    }
  };

  const handleRequestReview = async (issueId: string) => {
    const issue = issues.find((i) => i.id === issueId);
    if (!issue || !userId || issue.ownerId !== userId) return;
    try {
      const updated = await updateAgileIssue(issueId, { readyForReview: true, reviewRejected: false });
      setIssues((prev) => prev.map((i) => (i.id === issueId ? updated : i)));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to request review';
      setError(message);
    }
  };

  const handleRejectReview = async (issueId: string) => {
    if (!canWrite) return;
    try {
      const updated = await updateAgileIssue(issueId, { readyForReview: true, reviewRejected: true });
      setIssues((prev) => prev.map((i) => (i.id === issueId ? updated : i)));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reject review';
      setError(message);
    }
  };

  const sortedBuckets = useMemo(
    () => [...buckets].sort((a, b) => a.sortOrder - b.sortOrder),
    [buckets]
  );

  if (accessLevel === 'no-access') {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
          <h1 className="text-2xl font-semibold text-gray-900">Agile module is not available</h1>
          <p className="text-gray-600 mt-2">Your account does not have access to this module.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
              <KanbanSquare className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Agile Board</h1>
              <p className="text-gray-600">Boards, backlog, roadmap, and metrics</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <button
            onClick={() => void loadData()}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          {canWrite && (
            <button
              onClick={() => {
                setShowQuickAdd((v) => {
                  const next = !v;
                  if (!v && quickAddRef.current) {
                    requestAnimationFrame(() => {
                      quickAddRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    });
                  }
                  return next;
                });
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                showQuickAdd
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-sky-600 text-white hover:bg-sky-700'
              }`}
            >
              {showQuickAdd ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {showQuickAdd ? 'Close form' : 'Add Task'}
            </button>
          )}
        </div>
      </div>

      <div>
        <div className="grid grid-cols-3 rounded-lg border border-gray-200 overflow-hidden">
          {(['board', 'backlog', 'roadmap'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setView(mode)}
              className={`px-4 py-2 text-sm font-medium ${
                view === mode ? 'bg-sky-600 text-white' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {mode === 'board' ? 'Board' : mode === 'backlog' ? 'Backlog' : 'Roadmap'}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500">Total issues</p>
          <p className="text-2xl font-semibold text-gray-900">{filteredIssues.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500">Story points</p>
          <p className="text-2xl font-semibold text-gray-900">{totalPoints}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500">Statuses</p>
          <p className="text-2xl font-semibold text-gray-900">{statuses.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500">Roadmap buckets</p>
          <p className="text-2xl font-semibold text-gray-900">{buckets.length}</p>
        </div>
        {canWrite && (
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-500">Ready for review</p>
            <p className="text-2xl font-semibold text-gray-900">{readyCount}</p>
          </div>
        )}
      </div>
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Progress (burndown-lite)</p>
            <p className="text-lg font-semibold text-gray-900">{completionPct}% done</p>
            <p className="text-xs text-gray-500">{donePoints} / {totalPoints} pts complete</p>
          </div>
        </div>
        <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-2 bg-emerald-500"
            style={{ width: `${completionPct}%` }}
          />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col gap-4 lg:flex-row lg:items-end">
        <div className="flex flex-col gap-2 flex-1">
          <label className="text-sm font-medium text-gray-700">Status</label>
          <select
            value={filters.statusIds[0] ?? ''}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                statusIds: e.target.value ? [e.target.value] : [],
              }))
            }
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-sky-500"
          >
            <option value="">All</option>
            {statuses.map((status) => (
              <option key={status.id} value={status.id}>
                {status.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2 flex-1">
          <label className="text-sm font-medium text-gray-700">Owner</label>
          <div className="relative">
            <Users className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            <select
              value={filters.ownerId}
              onChange={(e) => setFilters((prev) => ({ ...prev, ownerId: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-9 py-2 focus:ring-2 focus:ring-sky-500"
            >
              <option value="">All</option>
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-2 flex-1">
          <label className="text-sm font-medium text-gray-700">Tag</label>
          <div className="relative">
            <Tag className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            <input
              value={filters.tag}
              onChange={(e) => setFilters((prev) => ({ ...prev, tag: e.target.value }))}
              placeholder="Search tags"
              className="w-full border border-gray-300 rounded-lg px-9 py-2 focus:ring-2 focus:ring-sky-500"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 flex-1">
          <label className="text-sm font-medium text-gray-700">Deadline</label>
          <select
            value={filters.dueRange}
            onChange={(e) => setFilters((prev) => ({ ...prev, dueRange: e.target.value as typeof prev.dueRange }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-sky-500"
          >
            <option value="">All</option>
            <option value="today">Due today</option>
            <option value="week">Due this week</option>
            <option value="overdue">Overdue</option>
          </select>
        </div>

        <div className="flex flex-col gap-2 flex-1">
          <label className="text-sm font-medium text-gray-700">Sort</label>
          <select
            value={filters.sort}
            onChange={(e) => setFilters((prev) => ({ ...prev, sort: e.target.value as typeof prev.sort }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-sky-500"
          >
            <option value="">Default</option>
            <option value="deadline-asc">Soonest deadline first</option>
            <option value="status-asc">By status (To-Do → In Progress → Done)</option>
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">Quick filters</label>
          <div className="flex flex-col gap-2">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={filters.readyOnly}
                onChange={(e) => setFilters((prev) => ({ ...prev, readyOnly: e.target.checked }))}
                className="rounded border-gray-300 text-sky-600 focus:ring-sky-500"
              />
              Show Ready for Review
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={filters.assignedOnly}
                onChange={(e) => setFilters((prev) => ({ ...prev, assignedOnly: e.target.checked }))}
                className="rounded border-gray-300 text-sky-600 focus:ring-sky-500"
              />
              Assigned to me
            </label>
          </div>
        </div>
      </div>

      {canWrite && showQuickAdd && (
        <div
          ref={quickAddRef}
          className="bg-white border border-gray-200 rounded-lg p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Quick add</h3>
            <span className="text-xs text-gray-500">
              Drag & drop is disabled while filters are active.
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <input
              value={newIssue.title}
              onChange={(e) => setNewIssue((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Issue title"
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-sky-500"
            />
            <select
              value={newIssue.statusId}
              onChange={(e) => setNewIssue((prev) => ({ ...prev, statusId: e.target.value }))}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-sky-500"
            >
              {statuses.map((status) => (
                <option key={status.id} value={status.id}>
                  {status.name}
                </option>
              ))}
            </select>
            <select
              value={newIssue.priority}
              onChange={(e) => setNewIssue((prev) => ({ ...prev, priority: e.target.value as 'high' | 'normal' | 'low' }))}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-sky-500"
            >
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </select>
            <input
              value={newIssue.estimate}
              onChange={(e) => setNewIssue((prev) => ({ ...prev, estimate: e.target.value }))}
              placeholder="Estimate (points)"
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-sky-500"
            />
            <input
              type="date"
              value={newIssue.deadlineDate}
              onChange={(e) => setNewIssue((prev) => ({ ...prev, deadlineDate: e.target.value }))}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-sky-500"
            />
            <select
              value={newIssue.ownerId}
              onChange={(e) => setNewIssue((prev) => ({ ...prev, ownerId: e.target.value }))}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-sky-500"
            >
              <option value="">Unassigned</option>
              {owners.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              value={newIssue.tags}
              onChange={(e) => setNewIssue((prev) => ({ ...prev, tags: e.target.value }))}
              placeholder="Tags (comma-separated)"
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-sky-500"
            />
            <textarea
              value={newIssue.description}
              onChange={(e) => setNewIssue((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Description"
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-sky-500 h-12"
            />
            <div className="flex items-center justify-end">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowQuickAdd(false)}
                  className="inline-flex items-center gap-2 px-3 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
                <button
                  onClick={() => void handleCreateIssue()}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors disabled:opacity-60"
                >
                  <Plus className="w-4 h-4" />
                  Add Task
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-500">
          Loading Agile data...
        </div>
      ) : view === 'board' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
          {statuses.map((status) => (
            <div
              key={status.id}
              className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col gap-4"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => void handleDrop(status.id)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{status.name}</p>
                  <p className="text-xs text-gray-400">{status.description}</p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold text-gray-900">
                    {pointsByStatus[status.id] ?? 0} pts
                  </span>
                  <div className="text-xs text-gray-500">{issuesByStatus[status.id]?.length ?? 0} items</div>
                </div>
              </div>
              <div className="space-y-3">
                {issuesByStatus[status.id]?.map((issue) => (
                  <div
                    key={issue.id}
                    draggable={canWrite && !filtersActive}
                    onDragStart={() => setDraggingId(issue.id)}
                    onDragEnd={() => setDraggingId(null)}
                    className="border border-gray-200 rounded-lg p-3 bg-gray-50 hover:bg-white transition-colors shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-gray-900">{issue.title}</p>
                          {issue.readyForReview && !issue.reviewRejected && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium">
                              <CheckCircle className="w-3 h-3" />
                              Ready for review
                            </span>
                          )}
                          {issue.reviewRejected && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-full bg-red-50 text-red-700 border border-red-200 font-medium">
                              <X className="w-3 h-3" />
                              Review rejected
                            </span>
                          )}
                          {!issue.readyForReview &&
                            !issue.reviewRejected &&
                            issue.statusId &&
                            doneStatusIds.includes(issue.statusId) && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-full bg-emerald-50 text-emerald-700 border-emerald-200 font-medium">
                                <CheckCircle className="w-3 h-3" />
                                Review closed
                              </span>
                          )}
                        </div>
                        {issue.description && (
                          <p className="text-sm text-gray-600 line-clamp-2 mt-1">{issue.description}</p>
                        )}
                      </div>
                      {canWrite && (
                        <button
                          onClick={() => void handleDeleteIssue(issue.id)}
                          className="text-xs text-gray-400 hover:text-red-500"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                      <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-gray-600">
                      <span
                        className={`px-2 py-1 rounded border ${
                          issue.priority === 'high'
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : issue.priority === 'low'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-gray-100 text-gray-700 border-gray-200'
                        }`}
                      >
                        {issue.priority === 'high' ? 'High' : issue.priority === 'low' ? 'Low' : 'Normal'}
                      </span>
                      {issue.deadlineDate && (
                        <span
                          className={`px-2 py-1 rounded border ${
                            new Date(issue.deadlineDate) < new Date(new Date().toDateString())
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : new Date(issue.deadlineDate) <= new Date(new Date().getTime() + 3 * 24 * 60 * 60 * 1000)
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-white text-gray-700 border-gray-200'
                          }`}
                        >
                          Due {issue.deadlineDate}
                        </span>
                      )}
                      {issue.ownerName && <span className="px-2 py-1 bg-white border rounded">{issue.ownerName}</span>}
                      {issue.estimate !== null && issue.estimate !== undefined && (
                        <span className="px-2 py-1 bg-white border rounded">{issue.estimate} pts</span>
                      )}
                      {issue.tags?.map((tag) => (
                        <span key={tag} className="px-2 py-1 bg-white border rounded">
                          {tag}
                        </span>
                      ))}
                      {(() => {
                        const isClosed =
                          issue.statusId ? doneStatusIds.includes(issue.statusId) && !issue.readyForReview && !issue.reviewRejected : false;
                        return (
                          issue.ownerId === userId &&
                          (!issue.readyForReview || issue.reviewRejected) &&
                          !isClosed && (
                            <button
                              onClick={() => void handleRequestReview(issue.id)}
                              className="px-3 py-2 text-xs bg-sky-600 text-white rounded hover:bg-sky-700 w-full sm:w-auto"
                            >
                              Request Review
                            </button>
                          )
                        );
                      })()}
                      {issue.readyForReview && !issue.reviewRejected && canWrite && (
                        <button
                          onClick={() => void handleRejectReview(issue.id)}
                          className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                        >
                          Reject
                        </button>
                      )}
                    </div>
                    {canWrite && (
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <select
                          value={issue.statusId ?? ''}
                          onChange={(e) => void handleStatusChange(issue.id, e.target.value)}
                          className="border border-gray-300 rounded px-2 py-1 text-xs focus:ring-2 focus:ring-sky-500 min-w-[120px]"
                        >
                          <option value="">Status</option>
                          {statuses.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          value={issue.estimate ?? ''}
                          onChange={(e) => void handleEstimateChange(issue.id, e.target.value ? Number(e.target.value) : null)}
                          className="w-20 border border-gray-300 rounded px-2 py-1 text-xs focus:ring-2 focus:ring-sky-500"
                          placeholder="pts"
                        />
                        <select
                          value={issue.ownerId ?? ''}
                          onChange={(e) => void handleOwnerChange(issue.id, e.target.value || null)}
                          className="border border-gray-300 rounded px-2 py-1 text-xs focus:ring-2 focus:ring-sky-500 min-w-[140px]"
                        >
                          <option value="">No owner</option>
                          {owners.map((owner) => (
                            <option key={owner.id} value={owner.id}>
                              {owner.name}
                            </option>
                          ))}
                        </select>
                        <select
                          value={issue.roadmapBucket ?? ''}
                          onChange={(e) => void handleUpdateRoadmap(issue.id, e.target.value)}
                          className="border border-gray-300 rounded px-2 py-1 text-xs focus:ring-2 focus:ring-sky-500"
                        >
                          <option value="">No bucket</option>
                          {sortedBuckets.map((bucket) => (
                            <option key={bucket.id} value={bucket.id}>
                              {bucket.name}
                            </option>
                          ))}
                        </select>
                        <select
                          value={issue.priority}
                          onChange={(e) =>
                            void updateAgileIssue(issue.id, { priority: e.target.value as 'high' | 'normal' | 'low' }).then((updated) =>
                              setIssues((prev) => prev.map((i) => (i.id === issue.id ? updated : i)))
                            ).catch((err) => setError(err instanceof Error ? err.message : 'Failed to update priority'))
                          }
                          className="border border-gray-300 rounded px-2 py-1 text-xs focus:ring-2 focus:ring-sky-500"
                        >
                          <option value="high">High</option>
                          <option value="normal">Normal</option>
                          <option value="low">Low</option>
                        </select>
                        <input
                          type="date"
                          value={issue.deadlineDate ?? ''}
                          onChange={(e) => void handleDeadlineChange(issue.id, e.target.value || null)}
                          className="border border-gray-300 rounded px-2 py-1 text-xs focus:ring-2 focus:ring-sky-500 min-w-[140px]"
                        />
                      </div>
                    )}
                  </div>
                ))}
                {issuesByStatus[status.id]?.length === 0 && (
                  <div className="text-sm text-gray-500 border border-dashed border-gray-200 rounded-lg p-3 text-center">
                    No items here yet
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : view === 'backlog' ? (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Title
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Owner
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Priority
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Deadline
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estimate
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tags
                </th>
                {canWrite && <th className="px-4 py-3"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredIssues.map((issue) => (
                <tr key={issue.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{issue.title}</div>
                    {issue.description && <div className="text-sm text-gray-600">{issue.description}</div>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {statuses.find((s) => s.id === issue.statusId)?.name ?? '—'}
                  </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {canWrite ? (
                    <select
                      value={issue.ownerId ?? ''}
                      onChange={(e) => void handleOwnerChange(issue.id, e.target.value || null)}
                      className="border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-sky-500 min-w-[160px]"
                    >
                      <option value="">Unassigned</option>
                      {owners.map((owner) => (
                        <option key={owner.id} value={owner.id}>
                          {owner.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span>{issue.ownerName || 'Unassigned'}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  <span
                    className={`px-2 py-1 rounded border text-xs ${
                      issue.priority === 'high'
                        ? 'bg-red-50 text-red-700 border-red-200'
                        : issue.priority === 'low'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-gray-100 text-gray-700 border-gray-200'
                    }`}
                  >
                    {issue.priority === 'high' ? 'High' : issue.priority === 'low' ? 'Low' : 'Normal'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">
                  {canWrite ? (
                    <input
                      type="date"
                      value={issue.deadlineDate ?? ''}
                      onChange={(e) => void handleDeadlineChange(issue.id, e.target.value || null)}
                      className="border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-sky-500"
                    />
                  ) : (
                    <span>{issue.deadlineDate ?? '—'}</span>
                  )}
                </td>
                  <td className="px-4 py-3">
                    {canWrite ? (
                      <input
                        type="number"
                        value={issue.estimate ?? ''}
                        onChange={(e) => void handleEstimateChange(issue.id, e.target.value ? Number(e.target.value) : null)}
                        className="w-20 border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-sky-500"
                      />
                    ) : (
                      <span className="text-sm text-gray-700">{issue.estimate ?? '—'}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    <div className="flex flex-wrap gap-1">
                      {issue.tags?.map((tag) => (
                        <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                          {tag}
                        </span>
                      ))}
                      {!issue.tags?.length && <span className="text-gray-400 text-xs">—</span>}
                    </div>
                  </td>
                  {canWrite && (
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => void handleDeleteIssue(issue.id)}
                        className="text-sm text-red-600 hover:text-red-700"
                      >
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {filteredIssues.length === 0 && (
                <tr>
                  <td colSpan={canWrite ? 6 : 5} className="px-4 py-6 text-center text-gray-500">
                    No backlog items match the filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Map className="w-4 h-4" />
            Roadmap buckets
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {sortedBuckets.map((bucket) => (
              <div key={bucket.id} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{bucket.name}</p>
                    <p className="text-xs text-gray-500">Sort order {bucket.sortOrder}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {filteredIssues.filter((issue) => issue.roadmapBucket === bucket.id).length === 0 && (
                    <div className="text-sm text-gray-500 border border-dashed border-gray-200 rounded-lg p-3 text-center">
                      No items
                    </div>
                  )}
                  {filteredIssues
                    .filter((issue) => issue.roadmapBucket === bucket.id)
                    .sort((a, b) => a.ordering - b.ordering)
                    .map((issue) => (
                      <div key={issue.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-gray-900">{issue.title}</p>
                            {issue.description && (
                              <p className="text-sm text-gray-600 line-clamp-2 mt-1">{issue.description}</p>
                            )}
                          </div>
                          {canWrite && (
                            <select
                              value={issue.roadmapBucket ?? ''}
                              onChange={(e) => void handleUpdateRoadmap(issue.id, e.target.value)}
                              className="border border-gray-300 rounded px-2 py-1 text-xs focus:ring-2 focus:ring-sky-500"
                            >
                              <option value="">No bucket</option>
                              {sortedBuckets.map((b) => (
                                <option key={b.id} value={b.id}>
                                  {b.name}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-2 text-xs text-gray-600">
                          <span>{statuses.find((s) => s.id === issue.statusId)?.name ?? 'No status'}</span>
                          {issue.estimate !== null && issue.estimate !== undefined && (
                            <span className="px-2 py-1 bg-white border rounded">{issue.estimate} pts</span>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


