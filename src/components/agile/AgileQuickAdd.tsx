import { forwardRef } from 'react';
import { ModernCard } from '../ui/ModernCard';
import { ModernButton } from '../ui/ModernButton';
import { AgileStatus } from '../../types/agile';

interface AgileQuickAddProps {
  showQuickAdd: boolean;
  filtersActive: boolean;
  newIssue: {
    title: string;
    statusId: string;
    priority: 'high' | 'normal' | 'low';
    ownerId: string;
    description: string;
    deadlineDate: string;
  };
  setNewIssue: React.Dispatch<React.SetStateAction<{
    title: string;
    statusId: string;
    priority: 'high' | 'normal' | 'low';
    ownerId: string;
    description: string;
    deadlineDate: string;
  }>>;
  statuses: AgileStatus[];
  owners: Array<{ id: string; name: string }>;
  handleCreateIssue: () => Promise<void>;
  saving: boolean;
  onCancel: () => void;
}

export const AgileQuickAdd = forwardRef<HTMLDivElement, AgileQuickAddProps>(({
  showQuickAdd,
  filtersActive,
  newIssue,
  setNewIssue,
  statuses,
  owners,
  handleCreateIssue,
  saving,
  onCancel,
}, ref) => {
  if (!showQuickAdd) return null;

  const inputClass = "w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm";
  const labelClass = "block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5";

  return (
    <div ref={ref}>
      <ModernCard className="border-2 border-primary/20 shadow-premium-lg">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-gray-900">Create New Task</h3>
          {filtersActive && (
            <span className="text-xs font-medium text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-100">
              Note: Drag & drop disabled when filters are active
            </span>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="md:col-span-2">
            <label className={labelClass}>Task Title <span className="text-red-500">*</span></label>
            <input
              value={newIssue.title}
              onChange={(e) => setNewIssue((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="What needs to be done?"
              className={inputClass}
              autoFocus
            />
          </div>
          
          <div>
            <label className={labelClass}>Status</label>
            <select
              value={newIssue.statusId}
              onChange={(e) => setNewIssue((prev) => ({ ...prev, statusId: e.target.value }))}
              className={inputClass}
            >
              {statuses.map((status) => (
                <option key={status.id} value={status.id}>
                  {status.name}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className={labelClass}>Priority</label>
            <select
              value={newIssue.priority}
              onChange={(e) => setNewIssue((prev) => ({ ...prev, priority: e.target.value as 'high' | 'normal' | 'low' }))}
              className={inputClass}
            >
              <option value="high">High Priority</option>
              <option value="normal">Normal Priority</option>
              <option value="low">Low Priority</option>
            </select>
          </div>
          
          <div>
            <label className={labelClass}>Assign To</label>
            <select
              value={newIssue.ownerId}
              onChange={(e) => setNewIssue((prev) => ({ ...prev, ownerId: e.target.value }))}
              className={inputClass}
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
            <label className={labelClass}>Due Date</label>
            <input
              type="date"
              value={newIssue.deadlineDate}
              onChange={(e) => setNewIssue((prev) => ({ ...prev, deadlineDate: e.target.value }))}
              className={inputClass}
            />
          </div>
          
          <div className="md:col-span-2">
            <label className={labelClass}>Description (optional)</label>
            <textarea
              value={newIssue.description}
              onChange={(e) => setNewIssue((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Add more details about this task..."
              rows={3}
              className={`${inputClass} resize-none min-h-[100px]`}
            />
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 sm:justify-end mt-6 pt-6 border-t border-gray-100">
          <ModernButton
            onClick={onCancel}
            variant="ghost"
          >
            Cancel
          </ModernButton>
          <ModernButton
            onClick={() => void handleCreateIssue()}
            disabled={saving || !newIssue.title.trim()}
            loading={saving}
          >
            Create Task
          </ModernButton>
        </div>
      </ModernCard>
    </div>
  );
});

AgileQuickAdd.displayName = 'AgileQuickAdd';
