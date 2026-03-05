import { useEffect, useState, useMemo } from 'react';
import { RefreshCw, Filter, X, Package, PlusCircle, Trash2, Factory, AlertTriangle, ArrowLeftRight, Sparkles } from 'lucide-react';
import type { AccessLevel } from '../types/access';
import type { RawMaterialLogEntry, RawMaterialLogEventType } from '../types/operations';
import { fetchRawMaterialLog, type RawMaterialLogFilters } from '../lib/operations';
import { fetchRawMaterialTags } from '../lib/tags';
import type { RawMaterialTag } from '../types/tags';
import { useModuleAccess } from '../contexts/ModuleAccessContext';
import { ModernCard } from '../components/ui/ModernCard';
import { ModernButton } from '../components/ui/ModernButton';
import { FilterPanel } from '../components/ui/FilterPanel';
import { MultiSelect } from '../components/ui/MultiSelect';

const EVENT_TYPE_OPTIONS: { value: RawMaterialLogEventType; label: string; icon: React.ReactNode }[] = [
  { value: 'created', label: 'Created', icon: <PlusCircle className="w-4 h-4" /> },
  { value: 'archived', label: 'Archived / Deleted', icon: <Trash2 className="w-4 h-4" /> },
  { value: 'production_use', label: 'Production use', icon: <Factory className="w-4 h-4" /> },
  { value: 'waste', label: 'Waste', icon: <AlertTriangle className="w-4 h-4" /> },
  { value: 'transfer_out', label: 'Transfer out', icon: <ArrowLeftRight className="w-4 h-4" /> },
  { value: 'transfer_in', label: 'Transfer in', icon: <ArrowLeftRight className="w-4 h-4" /> },
  { value: 'transform', label: 'Transform', icon: <Sparkles className="w-4 h-4" /> },
];

function eventTypeLabel(type: RawMaterialLogEventType): string {
  return EVENT_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;
}

function eventTypeBadgeClass(type: RawMaterialLogEventType): string {
  const base = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium';
  switch (type) {
    case 'created':
      return `${base} bg-emerald-100 text-emerald-800`;
    case 'archived':
      return `${base} bg-gray-200 text-gray-700`;
    case 'production_use':
      return `${base} bg-blue-100 text-blue-800`;
    case 'waste':
      return `${base} bg-amber-100 text-amber-800`;
    case 'transfer_out':
    case 'transfer_in':
      return `${base} bg-violet-100 text-violet-800`;
    case 'transform':
      return `${base} bg-purple-100 text-purple-800`;
    default:
      return `${base} bg-gray-100 text-gray-700`;
  }
}

interface RawMaterialLogProps {
  accessLevel: AccessLevel;
}

export function RawMaterialLog({ accessLevel }: RawMaterialLogProps) {
  const [entries, setEntries] = useState<RawMaterialLogEntry[]>([]);
  const [rawMaterialTags, setRawMaterialTags] = useState<RawMaterialTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const [filterEventTypes, setFilterEventTypes] = useState<RawMaterialLogEventType[]>([]);
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterLotIdSearch, setFilterLotIdSearch] = useState('');
  const [filterTagId, setFilterTagId] = useState('');

  const loadTags = async () => {
    const data = await fetchRawMaterialTags(false);
    setRawMaterialTags(data);
  };

  const loadLog = async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: RawMaterialLogFilters = {};
      if (filterEventTypes.length) filters.eventTypes = filterEventTypes;
      if (filterDateFrom) filters.dateFrom = filterDateFrom;
      if (filterDateTo) filters.dateTo = filterDateTo;
      if (filterLotIdSearch.trim()) filters.lotIdSearch = filterLotIdSearch.trim();
      if (filterTagId) filters.tagId = filterTagId;
      const data = await fetchRawMaterialLog(filters);
      setEntries(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load log');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTags();
  }, []);

  useEffect(() => {
    loadLog();
  }, [filterEventTypes, filterDateFrom, filterDateTo, filterLotIdSearch, filterTagId]);

  const tagOptions = useMemo(
    () => rawMaterialTags.map((t) => ({ value: t.id, label: t.name })),
    [rawMaterialTags]
  );

  const eventTypeOptions = useMemo(
    () => EVENT_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
    []
  );

  const activeFiltersCount = useMemo(() => {
    let n = 0;
    if (filterEventTypes.length) n++;
    if (filterDateFrom) n++;
    if (filterDateTo) n++;
    if (filterLotIdSearch.trim()) n++;
    if (filterTagId) n++;
    return n;
  }, [filterEventTypes.length, filterDateFrom, filterDateTo, filterLotIdSearch, filterTagId]);

  const handleClearFilters = () => {
    setFilterEventTypes([]);
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterLotIdSearch('');
    setFilterTagId('');
  };

  if (accessLevel === 'no-access') return null;

  return (
    <div className="space-y-6">
      <ModernCard padding="sm" className="bg-white sticky top-0 z-20 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-100 rounded-xl text-emerald-600">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Raw Material Log</h2>
              <p className="text-sm text-gray-500">Created, deleted, production use, waste, transfer, transform</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl border transition-all text-sm font-medium ${
                showFilters ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters
              {activeFiltersCount > 0 && (
                <span className="flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold">
                  {activeFiltersCount}
                </span>
              )}
            </button>
            <ModernButton onClick={loadLog} variant="secondary" size="sm" icon={<RefreshCw className="w-4 h-4" />}>
              Refresh
            </ModernButton>
          </div>
        </div>

        {showFilters && (
          <div className="mt-4 animate-slide-down">
            <FilterPanel activeFiltersCount={activeFiltersCount} onClearAll={handleClearFilters}>
              <MultiSelect
                label="Event type"
                options={eventTypeOptions}
                value={filterEventTypes}
                onChange={(v) => setFilterEventTypes(v as RawMaterialLogEventType[])}
                placeholder="All events"
              />
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Date from</label>
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Date to</label>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Lot ID</label>
                <input
                  type="text"
                  value={filterLotIdSearch}
                  onChange={(e) => setFilterLotIdSearch(e.target.value)}
                  placeholder="Search lot ID..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <MultiSelect
                label="Tag"
                options={tagOptions}
                value={filterTagId ? [filterTagId] : []}
                onChange={(v) => setFilterTagId(v[0] ?? '')}
                placeholder="All tags"
              />
            </FilterPanel>
          </div>
        )}
      </ModernCard>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <ModernCard padding="none">
        {loading ? (
          <div className="p-12 text-center text-gray-500">Loading log…</div>
        ) : entries.length === 0 ? (
          <div className="p-12 text-center text-gray-500">No log entries match the filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/80">
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Event</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Lot ID</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Lot name</th>
                  <th className="text-right py-3 px-4 font-semibold text-gray-700">Quantity</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Unit</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">Notes</th>
                  <th className="text-left py-3 px-4 font-semibold text-gray-700">By</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={`${entry.log_id}-${entry.effective_date}-${entry.created_at}`} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="py-3 px-4 text-gray-700 whitespace-nowrap">{entry.effective_date}</td>
                    <td className="py-3 px-4">
                      <span className={eventTypeBadgeClass(entry.event_type)}>{eventTypeLabel(entry.event_type)}</span>
                    </td>
                    <td className="py-3 px-4 font-mono text-gray-800">{entry.lot_id ?? '—'}</td>
                    <td className="py-3 px-4 text-gray-700">{entry.lot_name ?? '—'}</td>
                    <td className="py-3 px-4 text-right font-medium text-gray-800">{Number(entry.quantity)}</td>
                    <td className="py-3 px-4 text-gray-600">{entry.unit}</td>
                    <td className="py-3 px-4 text-gray-600 max-w-[200px] truncate" title={entry.notes ?? undefined}>
                      {entry.notes ?? '—'}
                    </td>
                    <td className="py-3 px-4 text-gray-600">{entry.created_by_name ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ModernCard>
    </div>
  );
}
