import { useEffect, useMemo, useRef, useState } from 'react';
import { ShieldCheck, KanbanSquare, List, Map } from 'lucide-react';
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
import { ModernCard } from '../components/ui/ModernCard';
import { AgileHeader } from '../components/agile/AgileHeader';
import { AgileStats } from '../components/agile/AgileStats';
import { AgileFilters } from '../components/agile/AgileFilters';
import { AgileQuickAdd } from '../components/agile/AgileQuickAdd';
import { AgileBoard } from '../components/agile/AgileBoard';
import { AgileBacklog } from '../components/agile/AgileBacklog';
import { AgileRoadmap } from '../components/agile/AgileRoadmap';

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
  const [filters, setFilters] = useState<{ statusIds: string[]; ownerIds: string[]; dueRange: '' | 'overdue' | 'week' | 'today'; sort: '' | 'deadline-asc' | 'status-asc'; readyOnly: boolean; assignedOnly: boolean }>({
    statusIds: [],
    ownerIds: [],
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
    filters.ownerIds.length ||
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
        (filters.ownerIds.length === 0 || (issue.ownerId && filters.ownerIds.includes(issue.ownerId))) &&
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

  const updatePriority = async (issueId: string, priority: 'high' | 'normal' | 'low') => {
    try {
      const updated = await updateAgileIssue(issueId, { priority });
      setIssues((prev) => prev.map((i) => (i.id === issueId ? updated : i)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update priority');
    }
  }

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
      <div className="bg-surface border border-border rounded-2xl p-8 text-center text-gray-500 shadow-premium">
        <ShieldCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        You do not have access to the Agile module. Please contact an administrator.
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-[1600px] mx-auto">
      <AgileHeader
        accessLevel={accessLevel}
        showQuickAdd={showQuickAdd}
        onToggleQuickAdd={() => setShowQuickAdd((prev) => !prev)}
        onRefresh={() => void loadData()}
        canWrite={canWrite}
      />

      <ModernCard padding="none" className="overflow-hidden">
        <div className="grid grid-cols-3">
          {(['board', 'backlog', 'roadmap'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setView(mode)}
              className={`px-4 py-3.5 text-sm md:text-base font-medium transition-all relative ${view === mode
                  ? 'text-primary bg-primary/5'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                }`}
            >
              <div className="flex items-center justify-center gap-2">
                {mode === 'board' ? <KanbanSquare className="w-4 h-4" /> :
                  mode === 'backlog' ? <List className="w-4 h-4" /> :
                    <Map className="w-4 h-4" />}
                <span className="capitalize">{mode}</span>
              </div>
              {view === mode && (
                <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary" />
              )}
            </button>
          ))}
        </div>
      </ModernCard>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm shadow-sm flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" />
          {error}
        </div>
      )}

      <AgileStats
        issues={filteredIssues}
        doneStatusIds={doneStatusIds}
        readyCount={readyCount}
        canWrite={canWrite}
      />

      <AgileFilters
        showFilters={showFilters}
        setShowFilters={setShowFilters}
        filtersActive={filtersActive}
        filters={filters}
        setFilters={setFilters}
        statuses={statuses}
        owners={owners}
      />

      <AgileQuickAdd
        ref={quickAddRef}
        showQuickAdd={showQuickAdd}
        filtersActive={filtersActive}
        newIssue={newIssue}
        setNewIssue={setNewIssue}
        statuses={statuses}
        owners={owners}
        handleCreateIssue={handleCreateIssue}
        saving={saving}
        onCancel={() => setShowQuickAdd(false)}
      />

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
        </div>
      ) : view === 'board' ? (
        <AgileBoard
          statuses={statuses}
          issuesByStatus={issuesByStatus}
          canWrite={canWrite}
          filtersActive={filtersActive}
          draggingId={draggingId}
          setDraggingId={setDraggingId}
          handleDrop={handleDrop}
          handleDeleteIssue={handleDeleteIssue}
          handleRequestReview={handleRequestReview}
          handleRejectReview={handleRejectReview}
          handleStatusChange={handleStatusChange}
          handleOwnerChange={handleOwnerChange}
          handleDeadlineChange={handleDeadlineChange}
          updatePriority={updatePriority}
          userId={userId}
          owners={owners}
          doneStatusIds={doneStatusIds}
          formatDate={formatDate}
          isOverdue={isOverdue}
          isDueSoon={isDueSoon}
        />
      ) : view === 'backlog' ? (
        <AgileBacklog
          filteredIssues={filteredIssues}
          statuses={statuses}
          owners={owners}
          canWrite={canWrite}
          handleOwnerChange={handleOwnerChange}
          handleDeadlineChange={handleDeadlineChange}
          handleDeleteIssue={handleDeleteIssue}
          formatDate={formatDate}
        />
      ) : (
        <AgileRoadmap
          sortedBuckets={sortedBuckets}
          filteredIssues={filteredIssues}
          statuses={statuses}
          canWrite={canWrite}
          handleUpdateRoadmap={handleUpdateRoadmap}
        />
      )}
    </div>
  );
}
