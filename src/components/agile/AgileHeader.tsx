import { Plus, RefreshCw, X, ShieldCheck, KanbanSquare } from 'lucide-react';
import { ModernButton } from '../ui/ModernButton';
import type { AccessLevel } from '../../types/access';

interface AgileHeaderProps {
  accessLevel: AccessLevel;
  showQuickAdd: boolean;
  onToggleQuickAdd: () => void;
  onRefresh: () => void;
  canWrite: boolean;
}

export function AgileHeader({
  accessLevel,
  showQuickAdd,
  onToggleQuickAdd,
  onRefresh,
  canWrite,
}: AgileHeaderProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-surface p-6 rounded-2xl shadow-premium border border-border">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          <KanbanSquare className="w-6 h-6" />
        </div>
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">Task Board</h1>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium border border-blue-100">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{accessLevel === 'read-write' ? 'Read & Write' : 'Read Only'}</span>
            </div>
          </div>
          <p className="mt-1 text-gray-500 text-sm">Manage your work and track progress</p>
        </div>
      </div>
      <div className="flex gap-2 items-center justify-end">
        {canWrite && (
          <ModernButton
            onClick={onToggleQuickAdd}
            variant={showQuickAdd ? 'danger' : 'primary'}
            icon={showQuickAdd ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          >
            {showQuickAdd ? 'Close' : 'New Task'}
          </ModernButton>
        )}
        <ModernButton
          onClick={onRefresh}
          variant="outline"
          icon={<RefreshCw className="w-4 h-4" />}
        >
          Refresh
        </ModernButton>
      </div>
    </div>
  );
}
