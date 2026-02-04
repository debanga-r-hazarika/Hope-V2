import { Map, FileText } from 'lucide-react';
import { AgileIssue, AgileRoadmapBucket, AgileStatus } from '../../types/agile';
import { ModernCard } from '../ui/ModernCard';

interface AgileRoadmapProps {
  sortedBuckets: AgileRoadmapBucket[];
  filteredIssues: AgileIssue[];
  statuses: AgileStatus[];
  canWrite: boolean;
  handleUpdateRoadmap: (issueId: string, bucketId: string) => Promise<void>;
}

export function AgileRoadmap({
  sortedBuckets,
  filteredIssues,
  statuses,
  canWrite,
  handleUpdateRoadmap,
}: AgileRoadmapProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-gray-900">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
          <Map className="w-4 h-4" />
        </div>
        <span className="font-bold text-lg">Roadmap Overview</span>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedBuckets.map((bucket) => (
          <ModernCard key={bucket.id} className="flex flex-col h-full bg-gray-50/50 border-dashed">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">{bucket.name}</h3>
              <span className="bg-white border border-gray-200 text-gray-700 text-xs font-bold px-2.5 py-1 rounded-full shadow-sm">
                {filteredIssues.filter((issue) => issue.roadmapBucket === bucket.id).length}
              </span>
            </div>
            
            <div className="space-y-3 flex-1">
              {filteredIssues.filter((issue) => issue.roadmapBucket === bucket.id).length === 0 && (
                <div className="h-32 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-gray-400 text-sm bg-white/50">
                  <p>No tasks scheduled</p>
                </div>
              )}
              {filteredIssues
                .filter((issue) => issue.roadmapBucket === bucket.id)
                .sort((a, b) => a.ordering - b.ordering)
                .map((issue) => (
                  <div key={issue.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-200 group">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h4 className="font-semibold text-gray-900 text-sm flex-1 leading-snug">{issue.title}</h4>
                      {canWrite && (
                        <select
                          value={issue.roadmapBucket ?? ''}
                          onChange={(e) => void handleUpdateRoadmap(issue.id, e.target.value)}
                          className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-[10px] font-medium text-gray-600 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none opacity-0 group-hover:opacity-100 transition-opacity"
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
                      <div className="flex items-start gap-2 mb-3 text-xs text-gray-500 bg-gray-50 p-2 rounded-lg">
                        <FileText className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        <p className="line-clamp-2">{issue.description}</p>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-2 py-1 rounded-md bg-gray-100 text-gray-600 text-[10px] font-medium border border-gray-200">
                        {statuses.find((s) => s.id === issue.statusId)?.name ?? 'No status'}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </ModernCard>
        ))}
      </div>
    </div>
  );
}
