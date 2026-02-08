import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Plus, Edit2, Trash2, TrendingUp, ExternalLink, Calendar, Search } from 'lucide-react';
import { IncomeEntry } from '../types/finance';
import { IncomeForm } from '../components/IncomeForm';
import {
  fetchIncome,
  createIncome,
  updateIncome,
  deleteIncome,
  uploadEvidence,
} from '../lib/finance';
import { supabase } from '../lib/supabase';
import { useModuleAccess } from '../contexts/ModuleAccessContext';
import { ModernButton } from '../components/ui/ModernButton';
import { ModernCard } from '../components/ui/ModernCard';
import { DateRangePicker, DateRange } from '../components/ui/DateRangePicker';
import { MultiSelect } from '../components/ui/MultiSelect';
import { FilterPanel } from '../components/ui/FilterPanel';

interface IncomeProps {
  onBack: () => void;
  hasWriteAccess: boolean;
  focusTransactionId?: string | null;
  onViewContribution?: (txnId: string) => void;
  onViewOrder?: (orderId: string) => void;
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

export function Income({ onBack, hasWriteAccess, focusTransactionId, onViewContribution: _onViewContribution, onViewOrder }: IncomeProps) {
  const { userId: currentUserId } = useModuleAccess();
  const [view, setView] = useState<'list' | 'detail' | 'form'>('list');
  const [selectedEntry, setSelectedEntry] = useState<IncomeEntry | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [incomeEntries, setIncomeEntries] = useState<IncomeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [usersLookup, setUsersLookup] = useState<Record<string, string>>({});

  // Filters
  const [search, setSearch] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<string>('date_desc');
  const [dateRange, setDateRange] = useState<DateRange>({ startDate: null, endDate: null });

  const loadIncome = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Pass dateRange to fetchIncome. If dateRange is set, it overrides month/year logic inside fetchIncome.
      // We pass 'all' for month/year as defaults.
      const data = await fetchIncome('all', 'all', dateRange.startDate && dateRange.endDate ? { startDate: dateRange.startDate, endDate: dateRange.endDate } : undefined);
      setIncomeEntries(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load income entries';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    void loadIncome();
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
  }, [loadIncome]);

  useEffect(() => {
    const channel = supabase
      .channel('income-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'income' },
        () => {
          void loadIncome();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadIncome]);

  useEffect(() => {
    if (!focusTransactionId || incomeEntries.length === 0) return;
    const match = incomeEntries.find((i) =>
      i.transactionId === focusTransactionId ||
      i.id === focusTransactionId ||
      i.orderPaymentId === focusTransactionId
    );
    if (match) {
      setSelectedEntry(match);
      setView('detail');
    }
  }, [focusTransactionId, incomeEntries]);

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

  const handleViewDetail = (entry: IncomeEntry) => {
    setSelectedEntry(entry);
    setView('detail');
  };

  const handleAddNew = () => {
    setSelectedEntry(null);
    setIsEditing(false);
    setView('form');
  };

  const handleEdit = (entry: IncomeEntry) => {
    // Check if entry is from sales payment
    if (entry.fromSalesPayment) {
      const orderLink = entry.orderNumber || entry.orderId || 'the order';
      setError(
        `This income entry is linked to a sales order payment and cannot be edited from the Finance module. ` +
        `Please go to the Sales module, find Order ${orderLink} and edit the payment from there. ` +
        `This ensures data integrity between Sales and Finance modules.`
      );
      return;
    }

    setSelectedEntry(entry);
    setIsEditing(true);
    setView('form');
  };

  const handleDelete = async (id: string) => {
    if (!hasWriteAccess) {
      setError('You only have read-only access to Finance.');
      return;
    }

    // Check if entry is from sales payment
    const entry = incomeEntries.find(e => e.id === id);
    if (entry?.fromSalesPayment) {
      const orderLink = entry.orderNumber || entry.orderId || 'the order';
      setError(
        `This income entry is linked to a sales order payment and cannot be deleted from the Finance module. ` +
        `Please go to the Sales module, find Order ${orderLink} and delete the payment from there. ` +
        `This ensures data integrity between Sales and Finance modules.`
      );
      return;
    }

    if (!confirm('Are you sure you want to delete this income entry?')) return;
    setSaving(true);
    setError(null);
    try {
      await deleteIncome(id);
      setIncomeEntries((prev) => prev.filter((e) => e.id !== id));
      setSelectedEntry(null);
      setView('list');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete income entry';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (data: Partial<IncomeEntry>, evidenceFile?: File | null) => {
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
        evidenceUrl = await uploadEvidence(evidenceFile, 'income');
      }

      const payload = { ...data, evidenceUrl };

      if (isEditing && selectedEntry) {
        const updated = await updateIncome(selectedEntry.id, payload, { currentUserId: currentUserId || undefined });
        setIncomeEntries((prev) =>
          prev.map((e) => (e.id === updated.id ? updated : e))
        );
        setSelectedEntry(updated);
        setSaveSuccess('Income entry updated successfully!');
      } else {
        const created = await createIncome(payload, { currentUserId: currentUserId || undefined });
        setIncomeEntries((prev) => [created, ...prev]);
        setSaveSuccess('Income entry created successfully!');
      }
      // Auto-hide success message after 5 seconds
      setTimeout(() => {
        setSaveSuccess(null);
      }, 5000);
      setView('list');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save income entry';
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
    let items = [...incomeEntries];
    if (search.trim()) {
      const term = search.toLowerCase();
      const termClean = term.replace(/,/g, '');
      items = items.filter((i) =>
        i.reason.toLowerCase().includes(term) ||
        i.transactionId.toLowerCase().includes(term) ||
        (i.source ?? '').toLowerCase().includes(term) ||
        // Expanded search fields
        i.amount.toString().includes(termClean) ||
        formatCurrency(i.amount).toLowerCase().includes(term) ||
        i.paymentMethod.toLowerCase().includes(term) ||
        formatDate(i.paymentDate).toLowerCase().includes(term) ||
        // Payer name lookup
        (i.paidToUser ? lookupName(i.paidToUser).toLowerCase().includes(term) : false)
      );
    }
    if (selectedTypes.length > 0) {
      items = items.filter((i) => selectedTypes.includes(i.incomeType));
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
  }, [incomeEntries, search, selectedTypes, sortBy, lookupName]);

  const totalAmount = incomeEntries.reduce((sum, e) => sum + e.amount, 0);

  const clearAllFilters = () => {
    setSearch('');
    setSelectedTypes([]);
    setSortBy('date_desc');
    setDateRange({ startDate: null, endDate: null });
  };

  const activeFiltersCount = [
    search,
    selectedTypes.length > 0,
    dateRange.startDate || dateRange.endDate,
    sortBy !== 'date_desc'
  ].filter(Boolean).length;

  if (view === 'form') {
    return (
      <IncomeForm
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
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <ModernButton
            onClick={() => setView('list')}
            variant="ghost"
            icon={<ArrowLeft className="w-5 h-5" />}
          >
            Back to List
          </ModernButton>

          {hasWriteAccess && (
            <div className="flex gap-2">
              {selectedEntry.fromSalesPayment ? (
                <div className="flex items-center gap-2 px-4 py-2 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg text-sm">
                  <span>
                    This entry is from a Sales order payment and cannot be edited here.
                    {selectedEntry.orderNumber && (
                      <span className="ml-1 font-medium">Order: {selectedEntry.orderNumber}</span>
                    )}
                  </span>
                </div>
              ) : (
                <>
                  <ModernButton
                    onClick={() => handleEdit(selectedEntry)}
                    variant="primary"
                    icon={<Edit2 className="w-4 h-4" />}
                  >
                    Edit
                  </ModernButton>
                  <ModernButton
                    onClick={() => void handleDelete(selectedEntry.id)}
                    variant="danger"
                    disabled={saving}
                    icon={<Trash2 className="w-4 h-4" />}
                  >
                    {saving ? 'Deleting...' : 'Delete'}
                  </ModernButton>
                </>
              )}
            </div>
          )}
        </div>

        <ModernCard>
          <div className="flex flex-col md:flex-row items-start justify-between mb-8 gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-gray-900">
                  {selectedEntry.reason}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 capitalize">
                  {selectedEntry.incomeType}
                </span>
              </div>
              <p className="text-gray-500 font-mono text-sm">
                Transaction ID: {selectedEntry.transactionId}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Last modified by: {lookupName(selectedEntry.recordedBy)}
              </p>
              {selectedEntry.fromSalesPayment && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-xl max-w-2xl">
                  <p className="text-sm font-bold text-blue-900 mb-1 flex items-center gap-2">
                    <ExternalLink className="w-4 h-4" />
                    Sales Order Payment Entry
                  </p>
                  <p className="text-sm text-blue-700 leading-relaxed">
                    This income entry is automatically created from a sales order payment.
                    {selectedEntry.orderNumber && (
                      <span className="block mt-2">
                        <strong>Order Number:</strong>{' '}
                        {onViewOrder && selectedEntry.orderId ? (
                          <button
                            onClick={() => onViewOrder(selectedEntry.orderId!)}
                            className="text-blue-600 hover:text-blue-800 underline inline-flex items-center gap-1 font-medium"
                            title="Click to view order details"
                          >
                            {selectedEntry.orderNumber}
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        ) : (
                          selectedEntry.orderNumber
                        )}
                      </span>
                    )}
                    {selectedEntry.orderId && (
                      <span className="block mt-1">
                        <strong>Order ID:</strong> {selectedEntry.orderId}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-blue-800 mt-3 font-medium border-t border-blue-200 pt-2">
                    ⚠️ To edit or delete this entry, go to Sales module → Orders → Find the order above → Edit/Delete payment
                  </p>
                </div>
              )}
              {selectedEntry.bankReference && (
                <p className="text-sm text-gray-600 mt-3 font-medium">
                  Payment Reference: <span className="font-mono bg-gray-50 px-2 py-0.5 rounded">{selectedEntry.bankReference}</span>
                </p>
              )}
              {selectedEntry.evidenceUrl && (
                <p className="text-sm text-primary mt-2">
                  <a href={selectedEntry.evidenceUrl} target="_blank" rel="noreferrer" className="underline hover:text-primary-light flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" /> View Evidence Document
                  </a>
                </p>
              )}
            </div>
            <div className="text-left md:text-right">
              <p className="text-sm text-gray-500 mb-1 font-medium uppercase tracking-wide">Amount</p>
              <p className="text-4xl font-bold text-green-600 tracking-tight">
                {formatCurrency(selectedEntry.amount)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-gray-100 pt-8">
            <div className="space-y-6">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Source</p>
                <p className="text-gray-900 font-medium text-lg">{selectedEntry.source}</p>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Payment Date</p>
                <p className="text-gray-900 font-medium text-lg flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  {formatDate(selectedEntry.paymentDate)}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Payment Method</p>
                <p className="text-gray-900 font-medium text-lg capitalize">{selectedEntry.paymentMethod.replace('_', ' ')}</p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Payment To</p>
                <p className="text-gray-900 font-medium text-lg capitalize">
                  {selectedEntry.paymentTo === 'organization_bank'
                    ? 'Organization Bank'
                    : `Other Bank Account - ${lookupName(selectedEntry.paidToUser)}`
                  }
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Created At</p>
                <p className="text-gray-900 font-medium">{formatDate(selectedEntry.createdAt)}</p>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Last Updated</p>
                <p className="text-gray-900 font-medium">{formatDate(selectedEntry.updatedAt)}</p>
              </div>
            </div>
          </div>

          {selectedEntry.description && (
            <div className="mt-8 pt-8 border-t border-gray-100">
              <p className="text-sm font-semibold text-gray-900 mb-3">Description / Notes</p>
              <div className="bg-gray-50 rounded-xl p-4 text-gray-700 leading-relaxed whitespace-pre-wrap">
                {selectedEntry.description}
              </div>
            </div>
          )}
        </ModernCard>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <ModernButton
          onClick={onBack}
          variant="ghost"
          icon={<ArrowLeft className="w-5 h-5" />}
        >
          Back to Dashboard
        </ModernButton>

        {hasWriteAccess && (
          <ModernButton
            onClick={handleAddNew}
            variant="primary"
            disabled={saving}
            icon={<Plus className="w-5 h-5" />}
          >
            Add Income
          </ModernButton>
        )}
      </div>

      <ModernCard className="bg-gradient-to-r from-green-50 to-white border-green-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              Income Overview
            </h1>
            <p className="mt-1 text-gray-600 ml-12">
              Manage and track all incoming payments and revenue sources.
            </p>
          </div>
          <div className="text-left md:text-right bg-white/50 p-4 rounded-xl border border-green-100">
            <p className="text-sm text-gray-500 font-medium uppercase tracking-wide">Total Revenue</p>
            <p className="text-3xl font-bold text-green-600 tracking-tight">
              {formatCurrency(totalAmount)}
            </p>
            <p className="text-xs text-gray-400 mt-1">{incomeEntries.length} entries recorded</p>
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
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by reason, transaction ID, source, amount, or payment method..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm shadow-sm"
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
            label="Income Type"
            options={[
              { value: 'sales', label: 'Sales' },
              { value: 'service', label: 'Service' },
              { value: 'interest', label: 'Interest' },
              { value: 'other', label: 'Other' },
            ]}
            value={selectedTypes}
            onChange={setSelectedTypes}
            placeholder="All Types"
          />

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
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
          <div className="text-center text-gray-500 py-12 bg-white rounded-xl border border-dashed border-gray-200">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
            <p>Loading income entries...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-gray-500 py-16 bg-white rounded-xl border border-dashed border-gray-200">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="w-8 h-8 text-gray-300" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">No income entries found</h3>
            <p className="text-sm text-gray-500 mt-1 max-w-xs mx-auto">
              Try adjusting your filters or search terms, or add a new income entry.
            </p>
          </div>
        ) : (
          filtered.map((income) => {
            const isContrib = income.source?.toLowerCase() === 'contribution';
            return (
              <div
                key={income.id}
                onClick={() => handleViewDetail(income)}
                className={`group cursor-pointer bg-white rounded-xl border p-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${isContrib ? 'border-blue-200 bg-blue-50/10 hover:bg-blue-50/30' : 'border-gray-200 hover:border-green-200 hover:bg-green-50/10'
                  }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-4 min-w-0">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${isContrib ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'
                      }`}>
                      <TrendingUp className="w-6 h-6" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-base font-bold text-gray-900 truncate group-hover:text-primary transition-colors">
                          <HighlightText text={income.reason} term={search} />
                        </h3>
                        <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full flex-shrink-0 ${isContrib
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-green-100 text-green-700'
                          }`}>
                          <HighlightText text={income.transactionId} term={search} />
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                        <span className="font-medium text-gray-600 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <HighlightText text={formatDate(income.paymentDate)} term={search} />
                        </span>
                        <span>•</span>
                        <span className="truncate max-w-[150px] sm:max-w-none">
                          <HighlightText text={income.source || 'No Source'} term={search} />
                        </span>
                      </div>

                      {income.fromSalesPayment && (
                        <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 bg-purple-50 text-purple-700 text-xs font-medium rounded-lg border border-purple-100">
                          <ExternalLink className="w-3 h-3" />
                          Linked to Sales Order {income.orderNumber}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p className="text-lg sm:text-xl font-bold text-green-600">
                      <HighlightText text={formatCurrency(income.amount)} term={search} />
                    </p>
                    <p className="text-xs text-gray-400 mt-1 font-medium">
                      <HighlightText text={income.paymentMethod.replace('_', ' ')} term={search} />
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
