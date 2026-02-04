import { X, CheckCircle, Calendar, User, FileText } from 'lucide-react';
import { AgileIssue, AgileStatus } from '../../types/agile';
import { ModernCard } from '../ui/ModernCard';

interface AgileBoardProps {
  statuses: AgileStatus[];
  issuesByStatus: Record<string, AgileIssue[]>;
  canWrite: boolean;
  filtersActive: boolean;
  draggingId: string | null;
  setDraggingId: (id: string | null) => void;
  handleDrop: (statusId: string) => Promise<void>;
  handleDeleteIssue: (issueId: string) => Promise<void>;
  handleRequestReview: (issueId: string) => Promise<void>;
  handleRejectReview: (issueId: string) => Promise<void>;
  handleStatusChange: (issueId: string, statusId: string) => Promise<void>;
  handleOwnerChange: (issueId: string, ownerId: string | null) => Promise<void>;
  handleDeadlineChange: (issueId: string, deadline: string | null) => Promise<void>;
  updatePriority: (issueId: string, priority: 'high' | 'normal' | 'low') => Promise<void>;
  userId: string | null;
  owners: Array<{ id: string; name: string }>;
  doneStatusIds: string[];
  formatDate: (dateString: string | null | undefined) => string;
  isOverdue: (dateString: string | null | undefined) => boolean;
  isDueSoon: (dateString: string | null | undefined) => boolean;
}

export function AgileBoard({
  statuses,
  issuesByStatus,
  canWrite,
  filtersActive,
  draggingId,
  setDraggingId,
  handleDrop,
  handleDeleteIssue,
  handleRequestReview,
  handleRejectReview,
  handleStatusChange,
  handleOwnerChange,
  handleDeadlineChange,
  updatePriority,
  userId,
  owners,
  doneStatusIds,
  formatDate,
  isOverdue,
  isDueSoon,
}: AgileBoardProps) {
  return (
    <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 pb-4">
      <div className="flex gap-6 min-w-max md:grid md:grid-cols-1 md:min-w-0 md:gap-6 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {statuses.map((status) => (
          <div
            key={status.id}
            className="flex flex-col gap-4 min-w-[300px] md:min-w-0 h-full"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => void handleDrop(status.id)}
          >
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-3">
                <span className="bg-white border border-gray-200 text-gray-700 text-xs font-bold px-2.5 py-1 rounded-lg shadow-sm">
                  {issuesByStatus[status.id]?.length ?? 0}
                </span>
                <h3 className="font-bold text-gray-900 text-lg tracking-tight">{status.name}</h3>
              </div>
            </div>

            <div className="bg-gray-50/50 rounded-2xl p-2 border border-dashed border-gray-200 flex-1 min-h-[200px]">
              <div className="space-y-3">
                {issuesByStatus[status.id]?.map((issue) => (
                  <ModernCard
                    key={issue.id}
                    padding="sm"
                    draggable={canWrite && !filtersActive}
                    className={`
                      group cursor-move transition-all duration-200 hover:shadow-premium-md
                      ${draggingId === issue.id ? 'opacity-50 scale-95' : ''}
                    `}
                    // @ts-ignore
                    onDragStart={() => setDraggingId(issue.id)}
                    // @ts-ignore
                    onDragEnd={() => setDraggingId(null)}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h4 className="font-semibold text-gray-900 text-sm leading-snug flex-1">{issue.title}</h4>
                      {canWrite && (
                        <button
                          onClick={() => void handleDeleteIssue(issue.id)}
                          className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                          aria-label="Delete task"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    
                    {issue.description && (
                      <div className="bg-gray-50 rounded-lg p-2.5 mb-3 border border-gray-100">
                        <div className="flex items-start gap-2">
                          <FileText className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-gray-600 line-clamp-2">{issue.description}</p>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {issue.readyForReview && !issue.reviewRejected && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-md bg-amber-50 text-amber-700 border border-amber-100 font-medium">
                          <CheckCircle className="w-3 h-3" />
                          Ready for Review
                        </span>
                      )}
                      {issue.reviewRejected && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-md bg-red-50 text-red-700 border border-red-100 font-medium">
                          <X className="w-3 h-3" />
                          Review Rejected
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                          issue.priority === 'high'
                            ? 'bg-red-50 text-red-700 border border-red-100'
                            : issue.priority === 'low'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                              : 'bg-blue-50 text-blue-700 border border-blue-100'
                        }`}
                      >
                        {issue.priority}
                      </span>
                      {issue.deadlineDate && (
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-medium border flex items-center gap-1 ${
                            isOverdue(issue.deadlineDate)
                              ? 'bg-red-50 text-red-700 border-red-100'
                              : isDueSoon(issue.deadlineDate)
                                ? 'bg-amber-50 text-amber-700 border-amber-100'
                                : 'bg-gray-50 text-gray-600 border-gray-100'
                          }`}
                        >
                          <Calendar className="w-3 h-3" />
                          {formatDate(issue.deadlineDate)}
                        </span>
                      )}
                      {issue.ownerName && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] bg-purple-50 text-purple-700 border border-purple-100 font-medium flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {issue.ownerName}
                        </span>
                      )}
                    </div>

                    {(() => {
                      const isClosed = issue.statusId ? doneStatusIds.includes(issue.statusId) && !issue.readyForReview && !issue.reviewRejected : false;
                      return (
                        <div className="flex flex-wrap gap-2">
                          {issue.ownerId === userId && (!issue.readyForReview || issue.reviewRejected) && !isClosed && (
                            <button
                              onClick={() => void handleRequestReview(issue.id)}
                              className="px-2.5 py-1 text-[10px] bg-primary text-white rounded-md hover:bg-primary-dark transition-colors font-medium w-full"
                            >
                              Request Review
                            </button>
                          )}
                          {issue.readyForReview && !issue.reviewRejected && canWrite && (
                            <button
                              onClick={() => void handleRejectReview(issue.id)}
                              className="px-2.5 py-1 text-[10px] bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors font-medium w-full"
                            >
                              Reject Review
                            </button>
                          )}
                        </div>
                      );
                    })()}

                    {canWrite && (
                      <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 gap-2 opacity-0 group-hover:opacity-100 transition-opacity focus-within:opacity-100">
                        <select
                          value={issue.statusId ?? ''}
                          onChange={(e) => void handleStatusChange(issue.id, e.target.value)}
                          className="col-span-2 w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                        >
                          {statuses.map((s) => (
                            <option key={s.id} value={s.id}>
                              Move to {s.name}
                            </option>
                          ))}
                        </select>
                        <select
                          value={issue.ownerId ?? ''}
                          onChange={(e) => void handleOwnerChange(issue.id, e.target.value || null)}
                          className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
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
                          className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none min-w-0"
                        />
                      </div>
                    )}
                  </ModernCard>
                ))}
                {issuesByStatus[status.id]?.length === 0 && (
                  <div className="h-24 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center text-gray-400 text-sm bg-gray-50/50">
                    No tasks
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
