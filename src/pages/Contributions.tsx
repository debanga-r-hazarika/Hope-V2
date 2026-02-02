import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Plus, Edit2, Trash2, DollarSign, Search } from 'lucide-react';
import { ContributionEntry } from '../types/finance';
import { ContributionForm } from '../components/ContributionForm';
import {
  fetchContributions,
  createContribution,
  updateContribution,
  deleteContribution,
  uploadEvidence,
} from '../lib/finance';
import { supabase } from '../lib/supabase';
import { useModuleAccess } from '../contexts/ModuleAccessContext';
import { ModernButton } from '../components/ui/ModernButton';
import { ModernCard } from '../components/ui/ModernCard';
import { DateRangePicker, DateRange } from '../components/ui/DateRangePicker';
import { MultiSelect } from '../components/ui/MultiSelect';
import { FilterPanel } from '../components/ui/FilterPanel';

interface ContributionsProps {
  onBack: () => void;
  hasWriteAccess: boolean;
  focusTransactionId?: string | null;
}

// Helper for highlighting text
const HighlightText = ({ text, term }: { text: string; term: string }) => {
  if (!term.trim()) return <>{text}</>;
  try {
    const parts = text.split(new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) =>
          part.toLowerCase() === term.toLowerCase() ? (
            <span key={i} className="bg-yellow-200 text-gray-900 rounded-[2px] px-0.5 font-medium">{part}</span>
          ) : (
            part
          )
        )}
      </span>
    );
  } catch (e) {
    return <>{text}</>;
  }
};

export function Contributions({ onBack, hasWriteAccess, focusTransactionId }: ContributionsProps) {
  const { userId: currentUserId } = useModuleAccess();
  const [view, setView] = useState<'list' | 'detail' | 'form'>('list');
  const [selectedEntry, setSelectedEntry] = useState<ContributionEntry | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [contributions, setContributions] = useState<ContributionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [usersLookup, setUsersLookup] = useState<Record<string, string>>({});
  
  // Filters
  const [search, setSearch] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedPayers, setSelectedPayers] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'>('date_desc');
  const [dateRange, setDateRange] = useState<DateRange>({ startDate: null, endDate: null });

  const loadContributions = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchContributions('all', 'all', dateRange.startDate && dateRange.endDate ? { startDate: dateRange.startDate, endDate: dateRange.endDate } : undefined);
      setContributions(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load contributions';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadContributions();
    void supabase
      .from('users')
      .select('id, full_name')
      .eq('is_active', true)
      .then(({ data }) => {
        const map: Record<string, string> = {};
        (data ?? []).forEach((u) => {
          map[u.id] = (u as { id: string; full_name: string }).full_name;
        });
        setUsersLookup(map);
      });
  }, [dateRange]);

  useEffect(() => {
    void loadContributions();
  }, [dateRange]);

  useEffect(() => {
    if (!focusTransactionId || contributions.length === 0) return;
    const match = contributions.find((c) => c.transactionId === focusTransactionId);
    if (match) {
      setSelectedEntry(match);
      setView('detail');
    }
  }, [focusTransactionId, contributions]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const handleViewDetail = (entry: ContributionEntry) => {
    setSelectedEntry(entry);
    setView('detail');
  };

  const handleAddNew = () => {
    setSelectedEntry(null);
    setIsEditing(false);
    setView('form');
  };

  const handleEdit = (entry: ContributionEntry) => {
    setSelectedEntry(entry);
    setIsEditing(true);
    setView('form');
  };

  const handleDelete = async (id: string) => {
    if (!hasWriteAccess) {
      setError('You only have read-only access to Finance.');
      return;
    }
    if (!confirm('Are you sure you want to delete this contribution?')) return;
    setSaving(true);
    setError(null);
    try {
      await deleteContribution(id);
      setContributions((prev) => prev.filter((c) => c.id !== id));
      setSelectedEntry(null);
      setView('list');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete contribution';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (data: Partial<ContributionEntry>, evidenceFile?: File | null) => {
    if (!hasWriteAccess) {
      setError('You only have read-only access to Finance.');
      return;
    }
    setSaving(true);
    setError(null);
    setSaveSuccess(null);
    try {
      let evidenceUrl = data.evidenceUrl ?? selectedEntry?.evidenceUrl ?? null;
      if (evidenceFile) {
        evidenceUrl = await uploadEvidence(evidenceFile, 'contributions');
      }

      const payload = { ...data, evidenceUrl };

      if (isEditing && selectedEntry) {
        const updated = await updateContribution(selectedEntry.id, payload, { currentUserId });
        setContributions((prev) =>
          prev.map((c) => (c.id === updated.id ? updated : c))
        );
        setSelectedEntry(updated);
        setSaveSuccess('Contribution updated successfully!');
      } else {
        const created = await createContribution(payload, { currentUserId });
        setContributions((prev) => [created, ...prev]);
        setSaveSuccess('Contribution created successfully!');
      }
      // Auto-hide success message after 5 seconds
      setTimeout(() => {
        setSaveSuccess(null);
      }, 5000);
      setView('list');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save contribution';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const lookupName = useMemo(() => (userId?: string | null) => {
    if (!userId) return '—';
    return usersLookup[userId] || userId;
  }, [usersLookup]);

  const filtered = useMemo(() => {
    let items = [...contributions];
    if (search.trim()) {
      const term = search.toLowerCase();
      const termClean = term.replace(/,/g, '');
      items = items.filter((c) =>
        c.reason.toLowerCase().includes(term) ||
        c.transactionId.toLowerCase().includes(term) ||
        // Expanded search fields
        c.amount.toString().includes(termClean) ||
        formatCurrency(c.amount).toLowerCase().includes(term) ||
        c.paymentMethod.toLowerCase().includes(term) ||
        formatDate(c.paymentDate).toLowerCase().includes(term) ||
        // Payer name lookup
        (c.paidBy ? lookupName(c.paidBy).toLowerCase().includes(term) : false)
      );
    }
    if (selectedTypes.length > 0) {
      items = items.filter((c) => selectedTypes.includes(c.contributionType));
    }
    if (selectedPayers.length > 0) {
      items = items.filter((c) => c.paidBy && selectedPayers.includes(c.paidBy));
    }
    items.sort((a, b) => {
      switch (sortBy) {
        case 'amount_desc': return b.amount - a.amount;
        case 'amount_asc': return a.amount - b.amount;
        case 'date_asc': return new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime();
        case 'date_desc':
        default: return new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime();
      }
    });
    return items;
  }, [contributions, search, selectedTypes, selectedPayers, sortBy]);

  const totalAmount = contributions.reduce((sum, c) => sum + c.amount, 0);

  const clearAllFilters = () => {
    setSearch('');
    setSelectedTypes([]);
    setSelectedPayers([]);
    setSortBy('date_desc');
    setDateRange({ startDate: null, endDate: null });
  };

  const activeFiltersCount = [
    search,
    selectedTypes.length > 0,
    selectedPayers.length > 0,
    dateRange.startDate || dateRange.endDate,
    sortBy !== 'date_desc'
  ].filter(Boolean).length;

  const payerOptions = useMemo(() => {
    return Object.entries(usersLookup).map(([value, label]) => ({ value, label }));
  }, [usersLookup]);

  if (view === 'form') {
    return (
      <ContributionForm
        entry={isEditing ? selectedEntry : null}
        onSave={handleSave}
        onCancel={() => setView(selectedEntry ? 'detail' : 'list')}
        saving={saving}
        saveSuccess={saveSuccess}
      />
    );
  }

  if (view === 'detail' && selectedEntry) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <ModernButton
            variant="ghost"
            onClick={() => setView('list')}
            icon={<ArrowLeft className="w-5 h-5" />}
          >
            Back to List
          </ModernButton>

          {hasWriteAccess && (
            <div className="flex gap-2">
              <ModernButton
                variant="primary"
                onClick={() => handleEdit(selectedEntry)}
                icon={<Edit2 className="w-4 h-4" />}
              >
                Edit
              </ModernButton>
              <ModernButton
                variant="danger"
                onClick={() => void handleDelete(selectedEntry.id)}
                icon={<Trash2 className="w-4 h-4" />}
                disabled={saving}
              >
                {saving ? 'Deleting...' : 'Delete'}
              </ModernButton>
            </div>
          )}
        </div>

        <ModernCard className="p-8">
          <div className="flex flex-col md:flex-row items-start justify-between mb-6 gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-800 mb-2">
                {selectedEntry.reason}
              </h1>
              <p className="text-slate-500">
                Transaction ID: {selectedEntry.transactionId}
              </p>
              <p className="text-sm text-slate-400 mt-1">
                Last modified by: {lookupName(selectedEntry.recordedBy)}
              </p>
              {selectedEntry.bankReference && (
                <p className="text-sm text-slate-500 mt-1">
                  Payment Reference: {selectedEntry.bankReference}
                </p>
              )}
          {selectedEntry.evidenceUrl && (
            <p className="text-sm text-primary-600 mt-1">
              Evidence: <a href={selectedEntry.evidenceUrl} target="_blank" rel="noreferrer" className="underline hover:text-primary-700">View</a>
            </p>
          )}
            </div>
            <div className="text-left md:text-right">
              <p className="text-3xl font-bold text-green-600">
                {formatCurrency(selectedEntry.amount)}
              </p>
              <p className="text-sm text-slate-500 mt-1 capitalize">
                {selectedEntry.contributionType}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Payment Date</p>
                <p className="text-slate-800">{formatDate(selectedEntry.paymentDate)}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Payment Method</p>
                <p className="text-slate-800 capitalize">{selectedEntry.paymentMethod.replace('_', ' ')}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Payment To</p>
                <p className="text-slate-800 capitalize">
                  {selectedEntry.paymentTo === 'organization_bank'
                    ? 'Organization Bank'
                    : `Other Bank Account - ${lookupName(selectedEntry.paidToUser)}`
                  }
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Who Paid?</p>
                <p className="text-slate-800">{lookupName(selectedEntry.paidBy)}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Created At</p>
                <p className="text-slate-800">{formatDate(selectedEntry.createdAt)}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Last Updated</p>
                <p className="text-slate-800">{formatDate(selectedEntry.updatedAt)}</p>
              </div>
            </div>
          </div>

          {selectedEntry.description && (
            <div className="mt-6 pt-6 border-t border-slate-200">
              <p className="text-sm font-medium text-slate-500 mb-2">Description</p>
              <p className="text-slate-800 whitespace-pre-wrap">{selectedEntry.description}</p>
            </div>
          )}
        </ModernCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <ModernButton
          variant="ghost"
          onClick={onBack}
          icon={<ArrowLeft className="w-5 h-5" />}
        >
          Back to Finance
        </ModernButton>

        {hasWriteAccess && (
          <ModernButton
            variant="primary"
            onClick={handleAddNew}
            icon={<Plus className="w-5 h-5" />}
            disabled={saving}
          >
            Add Contribution
          </ModernButton>
        )}
      </div>

      <ModernCard className="bg-gradient-to-r from-blue-50 to-white border-blue-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-blue-600" />
              </div>
              Contribution Overview
            </h1>
            <p className="mt-1 text-gray-600 ml-12">
              Manage and track all contributions and investments.
            </p>
          </div>
          <div className="text-left md:text-right bg-white/50 p-4 rounded-xl border border-blue-100">
            <p className="text-sm text-gray-500 font-medium uppercase tracking-wide">Total Contributions</p>
            <p className="text-3xl font-bold text-blue-600 tracking-tight">
              {formatCurrency(totalAmount)}
            </p>
            <p className="text-xs text-gray-400 mt-1">{contributions.length} entries recorded</p>
          </div>
        </div>
        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}
      </ModernCard>

      <div className="flex flex-col gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by reason, transaction ID..."
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all text-sm shadow-sm"
          />
        </div>

        <FilterPanel
          activeFiltersCount={activeFiltersCount}
          onClearAll={clearAllFilters}
        >
          <DateRangePicker
            label="Date Range"
            value={dateRange}
            onChange={setDateRange}
          />
          
          <MultiSelect
            label="Contribution Type"
            options={[
              { value: 'capital', label: 'Capital' },
              { value: 'investment', label: 'Investment' },
              { value: 'loan', label: 'Loan' },
              { value: 'other', label: 'Other' },
            ]}
            selectedValues={selectedTypes}
            onChange={setSelectedTypes}
            placeholder="All Types"
          />

          <MultiSelect
            label="Paid By"
            options={payerOptions}
            selectedValues={selectedPayers}
            onChange={setSelectedPayers}
            placeholder="All Payers"
          />

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer hover:border-gray-300 min-h-[42px]"
            >
              <option value="date_desc">Newest first</option>
              <option value="date_asc">Oldest first</option>
              <option value="amount_desc">Highest Amount</option>
              <option value="amount_asc">Lowest Amount</option>
            </select>
          </div>
        </FilterPanel>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="text-center text-slate-500 py-12 bg-white rounded-xl border border-slate-200 border-dashed">
            <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            Loading contributions...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-slate-500 py-16 bg-white rounded-xl border border-slate-200 border-dashed">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <DollarSign className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No contributions found</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-xs mx-auto">
              Try adjusting your filters or search terms, or add a new contribution.
            </p>
          </div>
        ) : (
          filtered.map((contribution) => (
            <div
              key={contribution.id}
              onClick={() => handleViewDetail(contribution)}
              className="group cursor-pointer bg-white rounded-xl border border-slate-200 p-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50/10"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex gap-4 flex-1 min-w-0">
                  <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center flex-shrink-0">
                    <DollarSign className="w-6 h-6 text-blue-600" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-base font-bold text-slate-900 truncate group-hover:text-primary-600 transition-colors">
                        <HighlightText text={contribution.reason} term={search} />
                      </h3>
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold uppercase tracking-wider rounded-full flex-shrink-0 border border-blue-100">
                        <HighlightText text={contribution.transactionId} term={search} />
                      </span>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      <span className="font-medium text-slate-600">
                        <HighlightText text={formatDate(contribution.paymentDate)} term={search} />
                      </span>
                      <span>•</span>
                      <span className="truncate max-w-[150px] sm:max-w-none">
                        {contribution.paidBy ? (
                          <>By: <HighlightText text={lookupName(contribution.paidBy)} term={search} /></>
                        ) : 'Unknown Payer'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <p className="text-lg sm:text-xl font-bold text-green-600">
                    <HighlightText text={formatCurrency(contribution.amount)} term={search} />
                  </p>
                  <p className="text-xs text-slate-400 mt-1 font-medium capitalize">
                    <HighlightText text={contribution.paymentMethod.replace('_', ' ')} term={search} />
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
