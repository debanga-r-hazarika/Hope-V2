import { FileText } from 'lucide-react';
import { AgileIssue, AgileStatus } from '../../types/agile';
import { ModernCard } from '../ui/ModernCard';

interface AgileBacklogProps {
  filteredIssues: AgileIssue[];
  statuses: AgileStatus[];
  owners: Array<{ id: string; name: string }>;
  canWrite: boolean;
  handleOwnerChange: (issueId: string, ownerId: string | null) => Promise<void>;
  handleDeadlineChange: (issueId: string, deadline: string | null) => Promise<void>;
  handleDeleteIssue: (issueId: string) => Promise<void>;
  formatDate: (dateString: string | null | undefined) => string;
}

export function AgileBacklog({
  filteredIssues,
  statuses,
  owners,
  canWrite,
  handleOwnerChange,
  handleDeadlineChange,
  handleDeleteIssue,
  formatDate,
}: AgileBacklogProps) {
  return (
    <ModernCard padding="none" className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Task</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-40">Status</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-48">Assigned To</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-32">Priority</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-40">Due Date</th>
              {canWrite && <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider w-24">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {filteredIssues.map((issue) => (
              <tr key={issue.id} className="hover:bg-gray-50/50 transition-colors group">
                <td className="px-6 py-4">
                  <div className="font-semibold text-gray-900 text-sm">{issue.title}</div>
                  {issue.description && (
                    <div className="mt-1.5 flex items-start gap-1.5 text-xs text-gray-500">
                      <FileText className="w-3 h-3 mt-0.5 flex-shrink-0" />
                      <p className="line-clamp-1">{issue.description}</p>
                    </div>
                  )}
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                    {statuses.find((s) => s.id === issue.statusId)?.name ?? '—'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {canWrite ? (
                    <select
                      value={issue.ownerId ?? ''}
                      onChange={(e) => void handleOwnerChange(issue.id, e.target.value || null)}
                      className="w-full bg-transparent border-none text-sm text-gray-700 focus:ring-0 cursor-pointer hover:bg-gray-100 rounded px-2 py-1 -ml-2"
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
                <td className="px-6 py-4">
                  <span
                    className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      issue.priority === 'high'
                        ? 'bg-red-50 text-red-700 border border-red-100'
                        : issue.priority === 'low'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          : 'bg-blue-50 text-blue-700 border border-blue-100'
                    }`}
                  >
                    {issue.priority}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {canWrite ? (
                    <input
                      type="date"
                      value={issue.deadlineDate ?? ''}
                      onChange={(e) => void handleDeadlineChange(issue.id, e.target.value || null)}
                      className="bg-transparent border-none text-sm text-gray-700 focus:ring-0 cursor-pointer hover:bg-gray-100 rounded px-2 py-1 -ml-2"
                    />
                  ) : (
                    <span className="text-sm text-gray-700">{issue.deadlineDate ? formatDate(issue.deadlineDate) : '—'}</span>
                  )}
                </td>
                {canWrite && (
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => void handleDeleteIssue(issue.id)}
                      className="text-sm text-gray-400 hover:text-red-600 font-medium transition-colors opacity-0 group-hover:opacity-100"
                    >
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {filteredIssues.length === 0 && (
              <tr>
                <td colSpan={canWrite ? 6 : 5} className="px-6 py-12 text-center text-gray-500">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                      <FileText className="w-6 h-6 text-gray-400" />
                    </div>
                    <p>No tasks match your filters</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </ModernCard>
  );
}
