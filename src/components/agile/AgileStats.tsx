import { AgileIssue } from '../../types/agile';
import { ModernCard } from '../ui/ModernCard';

interface AgileStatsProps {
  issues: AgileIssue[];
  doneStatusIds: string[];
  readyCount: number;
  canWrite: boolean;
}

export function AgileStats({ issues, doneStatusIds, readyCount, canWrite }: AgileStatsProps) {
  const total = issues.length;
  const completed = issues.filter((i) => i.statusId && doneStatusIds.includes(i.statusId)).length;
  const inProgress = issues.filter((i) => i.statusId && !doneStatusIds.includes(i.statusId)).length;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <ModernCard padding="sm" className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200">
        <p className="text-xs md:text-sm text-blue-700 font-medium">Total Tasks</p>
        <p className="text-2xl md:text-3xl font-bold text-blue-900 mt-1">{total}</p>
      </ModernCard>
      
      <ModernCard padding="sm" className="bg-gradient-to-br from-green-50 to-green-100/50 border-green-200">
        <p className="text-xs md:text-sm text-green-700 font-medium">Completed</p>
        <p className="text-2xl md:text-3xl font-bold text-green-900 mt-1">{completed}</p>
      </ModernCard>
      
      <ModernCard padding="sm" className="bg-gradient-to-br from-purple-50 to-purple-100/50 border-purple-200">
        <p className="text-xs md:text-sm text-purple-700 font-medium">In Progress</p>
        <p className="text-2xl md:text-3xl font-bold text-purple-900 mt-1">{inProgress}</p>
      </ModernCard>
      
      {canWrite && readyCount > 0 && (
        <ModernCard padding="sm" className="bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-200">
          <p className="text-xs md:text-sm text-amber-700 font-medium">Review Needed</p>
          <p className="text-2xl md:text-3xl font-bold text-amber-900 mt-1">{readyCount}</p>
        </ModernCard>
      )}
    </div>
  );
}
