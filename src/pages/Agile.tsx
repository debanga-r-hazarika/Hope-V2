import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, RefreshCw, Users, KanbanSquare, Map, X, CheckCircle, Filter, Calendar, User, ChevronDown, ChevronUp, ShieldCheck, FileText } from 'lucide-react';
import type { AccessLevel } from '../types/access';
import type { AgileIssue, AgileStatus, AgileRoadmapBucket } from '../types/agile';
import {
  createAgileIssue,
  deleteAgileIssue,
  fetchAgileBuckets,
  fetchAgileIssues,
  fetchAgileOwners,
  fetchAgileStatuses,
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
  const [showFilters, setShowFilters] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<{ statusIds: string[]; ownerId: string; dueRange: '' | 'overdue' | 'week' | 'today'; sort: '' | 'deadline-asc' | 'status-asc'; readyOnly: boolean; assignedOnly: boolean }>({
    statusIds: [],
    ownerId: '',
    dueRange: '',
    sort: '',
    readyOnly: false,
    assignedOnly: false,
  });
  const [newIssue, setNewIssue] = useState<{ title: string; statusId: string; priority: 'high' | 'normal' | 'low'; ownerId: string; description: string; deadlineDate: string }>({
    title: '',
    statusId: '',
    priority: 'normal',
    ownerId: '',
    description: '',
    deadlineDate: '',
  });
  const quickAddRef = useRef<HTMLDivElement | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  useEffect(() => {
    if (showQuickAdd && quickAddRef.current) {
      requestAnimationFrame(() => {
        quickAddRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, [showQuickAdd]);

  const filtersActive = Boolean(
    filters.ownerId ||
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
      const message = err instanceof Error ? err.message : 'Failed to load tasks';
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
      const matchesReady = !filters.readyOnly || issue.readyForReview;
      let matchesDue = true;
      if (filters.dueRange) {
        const deadline = issue.deadlineDate ? new Date(issue.deadlineDate) : null;
        if (!deadline) {
          matchesDue = false;
        } else if (filters.dueRange === 'today') {
          matchesDue = deadline >= startOfToday && deadline < new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
        } else if (filters.dueRange === 'week') {
          matchesDue = deadline >= startOfToday && deadline <= endOfWeek;
        } else if (filters.dueRange === 'overdue') {
          matchesDue = deadline < startOfToday;
        }
      }
      return matchesStatus && matchesOwner && matchesDue && matchesReady;
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
  }, [issues, filters, statuses, userId]);

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

  const doneStatusIds = useMemo(
    () => statuses.filter((status) => status.name.toLowerCase().includes('done')).map((s) => s.id),
    [statuses]
  );
  const readyCount = useMemo(
    () => filteredIssues.filter((issue) => issue.readyForReview && !issue.reviewRejected).length,
    [filteredIssues]
  );

  const handleCreateIssue = async () => {
    if (!canWrite) return;
    if (!newIssue.title.trim()) {
      setError('Task title is required');
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
          ownerId: newIssue.ownerId || undefined,
          ownerName: owners.find((o) => o.id === newIssue.ownerId)?.name ?? undefined,
          deadlineDate: newIssue.deadlineDate || null,
          roadmapBucket: buckets[0]?.id ?? null,
        },
        { createdBy: userId ?? undefined }
      );
      setIssues((prev) => [...prev, created]);
      setNewIssue((prev) => ({
        ...prev,
        title: '',
        priority: 'normal',
        description: '',
        deadlineDate: '',
      }));
      setShowQuickAdd(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create task';
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
      const message = err instanceof Error ? err.message : 'Failed to move task';
      setError(message);
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
      const message = err instanceof Error ? err.message : 'Failed to move task';
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
      const message = err instanceof Error ? err.message : 'Failed to update status';
      setError(message);
      void loadData();
    }
  };

  const handleDeleteIssue = async (issueId: string) => {
    if (!canWrite) return;
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
      await deleteAgileIssue(issueId);
      setIssues((prev) => prev.filter((issue) => issue.id !== issueId));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete task';
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
      const message = err instanceof Error ? err.message : 'Failed to update assignee';
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

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
  };

  const isOverdue = (dateString: string | null | undefined) => {
    if (!dateString) return false;
    return new Date(dateString) < new Date(new Date().toDateString());
  };

  const isDueSoon = (dateString: string | null | undefined) => {
    if (!dateString) return false;
    const date = new Date(dateString);
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    return date <= threeDaysFromNow && !isOverdue(dateString);
  };

  if (accessLevel === 'no-access') {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6 md:p-8 text-center">
        <h1 className="text-xl md:text-2xl font-semibold text-gray-900">Task Board Not Available</h1>
        <p className="text-gray-600 mt-2">Your account does not have access to this module.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white flex items-center justify-center shadow-lg">
            <KanbanSquare className="w-5 h-5 md:w-6 md:h-6" />
          </div>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Task Board</h1>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200 text-gray-700 text-xs md:text-sm font-medium shadow-sm">
                <ShieldCheck className="w-3.5 h-3.5 md:w-4 md:h-4" />
                <span>{accessLevel === 'read-write' ? 'Read & Write' : 'Read Only'}</span>
              </div>
            </div>
            <p className="text-sm md:text-base text-gray-600 mt-2">Manage your work and track progress</p>
          </div>
        </div>
        <div className="flex gap-2 items-center justify-end">
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
              className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg transition-colors text-sm md:text-base font-medium ${
                showQuickAdd
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-gradient-to-r from-sky-600 to-blue-600 text-white hover:from-sky-700 hover:to-blue-700 shadow-md'
              }`}
            >
              {showQuickAdd ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              <span>{showQuickAdd ? 'Close' : 'New Task'}</span>
            </button>
          )}
          <button
            onClick={() => void loadData()}
            className="flex items-center gap-2 px-3 md:px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm md:text-base"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* View Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="grid grid-cols-3">
          {(['board', 'backlog', 'roadmap'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setView(mode)}
              className={`px-4 py-3 text-sm md:text-base font-medium transition-colors ${
                view === mode
                  ? 'bg-gradient-to-r from-sky-600 to-blue-600 text-white shadow-md'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              {mode === 'board' ? 'Board' : mode === 'backlog' ? 'List' : 'Roadmap'}
            </button>
          ))}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Stats Cards - Mobile Optimized */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs md:text-sm text-blue-700 font-medium">Total Tasks</p>
          <p className="text-2xl md:text-3xl font-bold text-blue-900 mt-1">{filteredIssues.length}</p>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs md:text-sm text-green-700 font-medium">Completed</p>
          <p className="text-2xl md:text-3xl font-bold text-green-900 mt-1">
            {filteredIssues.filter((i) => i.statusId && doneStatusIds.includes(i.statusId)).length}
          </p>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs md:text-sm text-purple-700 font-medium">In Progress</p>
          <p className="text-2xl md:text-3xl font-bold text-purple-900 mt-1">
            {filteredIssues.filter((i) => i.statusId && !doneStatusIds.includes(i.statusId || '')).length}
          </p>
        </div>
        {canWrite && readyCount > 0 && (
          <div className="bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200 rounded-xl p-4 shadow-sm">
            <p className="text-xs md:text-sm text-amber-700 font-medium">Review Needed</p>
            <p className="text-2xl md:text-3xl font-bold text-amber-900 mt-1">{readyCount}</p>
          </div>
        )}
      </div>

      {/* Filters - Collapsible on Mobile */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors md:hidden"
        >
          <div className="flex items-center gap-2 text-gray-700 font-medium">
            <Filter className="w-4 h-4" />
            <span>Filters</span>
            {filtersActive && (
              <span className="bg-sky-600 text-white text-xs px-2 py-0.5 rounded-full">Active</span>
            )}
          </div>
          {showFilters ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
        <div className={`${showFilters ? 'block' : 'hidden'} md:block border-t border-gray-200 md:border-t-0 p-4 md:p-4`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 md:gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs md:text-sm font-medium text-gray-700">Status</label>
              <select
                value={filters.statusIds[0] ?? ''}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    statusIds: e.target.value ? [e.target.value] : [],
                  }))
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              >
                <option value="">All Statuses</option>
                {statuses.map((status) => (
                  <option key={status.id} value={status.id}>
                    {status.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs md:text-sm font-medium text-gray-700">Assigned To</label>
              <div className="relative">
                <Users className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                <select
                  value={filters.ownerId}
                  onChange={(e) => setFilters((prev) => ({ ...prev, ownerId: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                >
                  <option value="">All People</option>
                  {owners.map((owner) => (
                    <option key={owner.id} value={owner.id}>
                      {owner.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs md:text-sm font-medium text-gray-700">Due Date</label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                <select
                  value={filters.dueRange}
                  onChange={(e) => setFilters((prev) => ({ ...prev, dueRange: e.target.value as typeof prev.dueRange }))}
                  className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                >
                  <option value="">All Dates</option>
                  <option value="today">Due Today</option>
                  <option value="week">Due This Week</option>
                  <option value="overdue">Overdue</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs md:text-sm font-medium text-gray-700">Sort By</label>
              <select
                value={filters.sort}
                onChange={(e) => setFilters((prev) => ({ ...prev, sort: e.target.value as typeof prev.sort }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              >
                <option value="">Default Order</option>
                <option value="deadline-asc">Soonest First</option>
                <option value="status-asc">By Status</option>
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs md:text-sm font-medium text-gray-700">Quick Filters</label>
              <div className="flex flex-col gap-2">
                <label className="inline-flex items-center gap-2 text-xs md:text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.readyOnly}
                    onChange={(e) => setFilters((prev) => ({ ...prev, readyOnly: e.target.checked }))}
                    className="rounded border-gray-300 text-sky-600 focus:ring-sky-500 w-4 h-4"
                  />
                  <span>Ready for Review</span>
                </label>
                <label className="inline-flex items-center gap-2 text-xs md:text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.assignedOnly}
                    onChange={(e) => setFilters((prev) => ({ ...prev, assignedOnly: e.target.checked }))}
                    className="rounded border-gray-300 text-sky-600 focus:ring-sky-500 w-4 h-4"
                  />
                  <span>My Tasks Only</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Add Form */}
      {canWrite && showQuickAdd && (
        <div
          ref={quickAddRef}
          className="bg-gradient-to-br from-sky-50 to-blue-50 border-2 border-sky-200 rounded-xl p-4 md:p-6 space-y-4 shadow-lg"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-lg md:text-xl font-bold text-gray-900">Create New Task</h3>
            {filtersActive && (
              <span className="text-xs md:text-sm text-amber-700 bg-amber-100 px-2 py-1 rounded">
                Note: Drag & drop disabled when filters are active
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Task Title *</label>
              <input
                value={newIssue.title}
                onChange={(e) => setNewIssue((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="What needs to be done?"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm md:text-base focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={newIssue.statusId}
                onChange={(e) => setNewIssue((prev) => ({ ...prev, statusId: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm md:text-base focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              >
                {statuses.map((status) => (
                  <option key={status.id} value={status.id}>
                    {status.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select
                value={newIssue.priority}
                onChange={(e) => setNewIssue((prev) => ({ ...prev, priority: e.target.value as 'high' | 'normal' | 'low' }))}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm md:text-base focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              >
                <option value="high">High Priority</option>
                <option value="normal">Normal Priority</option>
                <option value="low">Low Priority</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assign To</label>
              <select
                value={newIssue.ownerId}
                onChange={(e) => setNewIssue((prev) => ({ ...prev, ownerId: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm md:text-base focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              >
                <option value="">Not Assigned</option>
                {owners.map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {owner.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
              <input
                type="date"
                value={newIssue.deadlineDate}
                onChange={(e) => setNewIssue((prev) => ({ ...prev, deadlineDate: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm md:text-base focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
              <textarea
                value={newIssue.description}
                onChange={(e) => setNewIssue((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Add more details about this task..."
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm md:text-base focus:ring-2 focus:ring-sky-500 focus:border-sky-500 resize-none"
              />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:justify-end pt-2">
            <button
              onClick={() => setShowQuickAdd(false)}
              className="px-4 py-2.5 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm md:text-base"
            >
              Cancel
            </button>
            <button
              onClick={() => void handleCreateIssue()}
              disabled={saving || !newIssue.title.trim()}
              className="px-6 py-2.5 bg-gradient-to-r from-sky-600 to-blue-600 text-white rounded-lg hover:from-sky-700 hover:to-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm md:text-base shadow-md"
            >
              {saving ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </div>
      )}

      {/* Content Area */}
      {loading ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <div className="inline-block w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-600">Loading tasks...</p>
        </div>
      ) : view === 'board' ? (
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <div className="flex gap-4 min-w-max md:grid md:grid-cols-1 md:min-w-0 md:gap-4 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {statuses.map((status) => (
              <div
                key={status.id}
                className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-3 min-w-[280px] md:min-w-0 shadow-sm"
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => void handleDrop(status.id)}
              >
                <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 text-base md:text-lg">{status.name}</h3>
                    {status.description && (
                      <p className="text-xs md:text-sm text-gray-500 mt-0.5">{status.description}</p>
                    )}
                  </div>
                  <div className="ml-3 bg-gray-100 text-gray-700 text-xs md:text-sm font-semibold px-2 py-1 rounded-full">
                    {issuesByStatus[status.id]?.length ?? 0}
                  </div>
                </div>
                <div className="space-y-3 flex-1 overflow-y-auto max-h-[600px]">
                  {issuesByStatus[status.id]?.map((issue) => (
                    <div
                      key={issue.id}
                      draggable={canWrite && !filtersActive}
                      onDragStart={() => setDraggingId(issue.id)}
                      onDragEnd={() => setDraggingId(null)}
                      className={`border rounded-xl p-3 md:p-4 bg-white hover:shadow-md transition-all cursor-move ${
                        draggingId === issue.id ? 'opacity-50' : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h4 className="font-semibold text-gray-900 text-sm md:text-base flex-1 leading-tight">{issue.title}</h4>
                        {canWrite && (
                          <button
                            onClick={() => void handleDeleteIssue(issue.id)}
                            className="text-gray-400 hover:text-red-600 transition-colors p-1"
                            aria-label="Delete task"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      
                      {issue.description && (
                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-l-4 border-blue-400 rounded-r-lg p-2.5 md:p-3 mb-3 shadow-sm">
                          <div className="flex items-start gap-2">
                            <FileText className="w-3.5 h-3.5 md:w-4 md:h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                            <p className="text-xs md:text-sm text-gray-700 leading-relaxed line-clamp-3 flex-1 font-medium">{issue.description}</p>
                          </div>
                        </div>
                      )}

                      {/* Review Status Badges */}
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {issue.readyForReview && !issue.reviewRejected && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-[10px] md:text-xs rounded-full bg-amber-100 text-amber-800 border border-amber-200 font-medium">
                            <CheckCircle className="w-3 h-3" />
                            Ready for Review
                          </span>
                        )}
                        {issue.reviewRejected && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-[10px] md:text-xs rounded-full bg-red-100 text-red-800 border border-red-200 font-medium">
                            <X className="w-3 h-3" />
                            Review Rejected
                          </span>
                        )}
                      </div>

                      {/* Task Metadata */}
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span
                          className={`px-2.5 py-1 rounded-lg text-[10px] md:text-xs font-medium ${
                            issue.priority === 'high'
                              ? 'bg-red-100 text-red-800 border border-red-200'
                              : issue.priority === 'low'
                                ? 'bg-green-100 text-green-800 border border-green-200'
                                : 'bg-gray-100 text-gray-800 border border-gray-200'
                          }`}
                        >
                          {issue.priority === 'high' ? 'High' : issue.priority === 'low' ? 'Low' : 'Normal'}
                        </span>
                        {issue.deadlineDate && (
                          <span
                            className={`px-2.5 py-1 rounded-lg text-[10px] md:text-xs font-medium border ${
                              isOverdue(issue.deadlineDate)
                                ? 'bg-red-100 text-red-800 border-red-200'
                                : isDueSoon(issue.deadlineDate)
                                  ? 'bg-amber-100 text-amber-800 border-amber-200'
                                  : 'bg-blue-100 text-blue-800 border-blue-200'
                            }`}
                          >
                            <Calendar className="w-3 h-3 inline mr-1" />
                            {formatDate(issue.deadlineDate)}
                          </span>
                        )}
                        {issue.ownerName && (
                          <span className="px-2.5 py-1 rounded-lg text-[10px] md:text-xs bg-purple-100 text-purple-800 border border-purple-200 font-medium">
                            <User className="w-3 h-3 inline mr-1" />
                            {issue.ownerName}
                          </span>
                        )}
                      </div>

                      {/* Action Buttons */}
                      {(() => {
                        const isClosed = issue.statusId ? doneStatusIds.includes(issue.statusId) && !issue.readyForReview && !issue.reviewRejected : false;
                        return (
                          <div className="flex flex-wrap gap-2">
                            {issue.ownerId === userId && (!issue.readyForReview || issue.reviewRejected) && !isClosed && (
                              <button
                                onClick={() => void handleRequestReview(issue.id)}
                                className="px-3 py-1.5 text-xs md:text-sm bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors font-medium"
                              >
                                Request Review
                              </button>
                            )}
                            {issue.readyForReview && !issue.reviewRejected && canWrite && (
                              <button
                                onClick={() => void handleRejectReview(issue.id)}
                                className="px-3 py-1.5 text-xs md:text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                              >
                                Reject
                              </button>
                            )}
                          </div>
                        );
                      })()}

                      {/* Edit Controls - Only for Write Access */}
                      {canWrite && (
                        <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                          <select
                            value={issue.statusId ?? ''}
                            onChange={(e) => void handleStatusChange(issue.id, e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs md:text-sm focus:ring-2 focus:ring-sky-500"
                          >
                            <option value="">Change Status</option>
                            {statuses.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                          <div className="grid grid-cols-2 gap-2">
                            <select
                              value={issue.ownerId ?? ''}
                              onChange={(e) => void handleOwnerChange(issue.id, e.target.value || null)}
                              className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs md:text-sm focus:ring-2 focus:ring-sky-500"
                            >
                              <option value="">No Assignee</option>
                              {owners.map((owner) => (
                                <option key={owner.id} value={owner.id}>
                                  {owner.name}
                                </option>
                              ))}
                            </select>
                            <input
                              type="date"
                              value={issue.deadlineDate ?? ''}
                              onChange={(e) => void handleDeadlineChange(issue.id, e.target.value || null)}
                              className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs md:text-sm focus:ring-2 focus:ring-sky-500"
                            />
                          </div>
                          <select
                            value={issue.priority}
                            onChange={(e) =>
                              void updateAgileIssue(issue.id, { priority: e.target.value as 'high' | 'normal' | 'low' }).then((updated) =>
                                setIssues((prev) => prev.map((i) => (i.id === issue.id ? updated : i)))
                              ).catch((err) => setError(err instanceof Error ? err.message : 'Failed to update priority'))
                            }
                            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs md:text-sm focus:ring-2 focus:ring-sky-500"
                          >
                            <option value="high">High Priority</option>
                            <option value="normal">Normal Priority</option>
                            <option value="low">Low Priority</option>
                          </select>
                        </div>
                      )}
                    </div>
                  ))}
                  {issuesByStatus[status.id]?.length === 0 && (
                    <div className="text-sm text-gray-400 border-2 border-dashed border-gray-200 rounded-xl p-6 text-center">
                      No tasks here
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : view === 'backlog' ? (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Task</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Assigned To</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Priority</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Due Date</th>
                  {canWrite && <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filteredIssues.map((issue) => (
                  <tr key={issue.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-4">
                      <div className="font-semibold text-gray-900 text-sm md:text-base">{issue.title}</div>
                      {issue.description && (
                        <div className="mt-2 bg-gradient-to-br from-blue-50 to-indigo-50 border-l-4 border-blue-400 rounded-r-lg p-2.5 shadow-sm">
                          <div className="flex items-start gap-2">
                            <FileText className="w-3.5 h-3.5 md:w-4 md:h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                            <p className="text-xs md:text-sm text-gray-700 leading-relaxed line-clamp-2 flex-1 font-medium">{issue.description}</p>
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-gray-700">
                        {statuses.find((s) => s.id === issue.statusId)?.name ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {canWrite ? (
                        <select
                          value={issue.ownerId ?? ''}
                          onChange={(e) => void handleOwnerChange(issue.id, e.target.value || null)}
                          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-sky-500 min-w-[140px]"
                        >
                          <option value="">Not Assigned</option>
                          {owners.map((owner) => (
                            <option key={owner.id} value={owner.id}>
                              {owner.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-sm text-gray-700">{issue.ownerName || 'Not Assigned'}</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                          issue.priority === 'high'
                            ? 'bg-red-100 text-red-800 border border-red-200'
                            : issue.priority === 'low'
                              ? 'bg-green-100 text-green-800 border border-green-200'
                              : 'bg-gray-100 text-gray-800 border border-gray-200'
                        }`}
                      >
                        {issue.priority === 'high' ? 'High' : issue.priority === 'low' ? 'Low' : 'Normal'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {canWrite ? (
                        <input
                          type="date"
                          value={issue.deadlineDate ?? ''}
                          onChange={(e) => void handleDeadlineChange(issue.id, e.target.value || null)}
                          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-sky-500"
                        />
                      ) : (
                        <span className="text-sm text-gray-700">{issue.deadlineDate ? formatDate(issue.deadlineDate) : '—'}</span>
                      )}
                    </td>
                    {canWrite && (
                      <td className="px-4 py-4 text-right">
                        <button
                          onClick={() => void handleDeleteIssue(issue.id)}
                          className="text-sm text-red-600 hover:text-red-700 font-medium"
                        >
                          Delete
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {filteredIssues.length === 0 && (
                  <tr>
                    <td colSpan={canWrite ? 6 : 5} className="px-4 py-8 text-center text-gray-500">
                      No tasks match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm md:text-base text-gray-600">
            <Map className="w-5 h-5" />
            <span className="font-semibold">Roadmap</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedBuckets.map((bucket) => (
              <div key={bucket.id} className="bg-white border border-gray-200 rounded-xl p-4 md:p-6 space-y-3 shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                  <h3 className="text-base md:text-lg font-bold text-gray-900">{bucket.name}</h3>
                  <span className="bg-gray-100 text-gray-700 text-xs md:text-sm font-semibold px-2.5 py-1 rounded-full">
                    {filteredIssues.filter((issue) => issue.roadmapBucket === bucket.id).length}
                  </span>
                </div>
                <div className="space-y-3">
                  {filteredIssues.filter((issue) => issue.roadmapBucket === bucket.id).length === 0 && (
                    <div className="text-sm text-gray-400 border-2 border-dashed border-gray-200 rounded-lg p-4 text-center">
                      No tasks
                    </div>
                  )}
                  {filteredIssues
                    .filter((issue) => issue.roadmapBucket === bucket.id)
                    .sort((a, b) => a.ordering - b.ordering)
                    .map((issue) => (
                      <div key={issue.id} className="border border-gray-200 rounded-lg p-3 md:p-4 bg-gray-50 hover:bg-white transition-colors">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h4 className="font-semibold text-gray-900 text-sm md:text-base flex-1">{issue.title}</h4>
                          {canWrite && (
                            <select
                              value={issue.roadmapBucket ?? ''}
                              onChange={(e) => void handleUpdateRoadmap(issue.id, e.target.value)}
                              className="border border-gray-300 rounded-lg px-2 py-1 text-xs focus:ring-2 focus:ring-sky-500"
                            >
                              <option value="">Move</option>
                              {sortedBuckets.map((b) => (
                                <option key={b.id} value={b.id}>
                                  {b.name}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                        {issue.description && (
                          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-l-4 border-blue-400 rounded-r-lg p-2.5 md:p-3 mb-2 shadow-sm">
                            <div className="flex items-start gap-2">
                              <FileText className="w-3.5 h-3.5 md:w-4 md:h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                              <p className="text-xs md:text-sm text-gray-700 leading-relaxed line-clamp-2 flex-1 font-medium">{issue.description}</p>
                            </div>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          <span className="px-2 py-1 bg-white border border-gray-200 rounded">
                            {statuses.find((s) => s.id === issue.statusId)?.name ?? 'No status'}
                          </span>
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
