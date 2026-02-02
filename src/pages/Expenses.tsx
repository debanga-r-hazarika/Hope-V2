import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Plus, Edit2, Trash2, TrendingDown, Search } from 'lucide-react';
import { ExpenseEntry } from '../types/finance';
import { ExpenseForm } from '../components/ExpenseForm';
import {
  fetchExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  uploadEvidence,
} from '../lib/finance';
import { supabase } from '../lib/supabase';
import { useModuleAccess } from '../contexts/ModuleAccessContext';
import { ModernButton } from '../components/ui/ModernButton';
import { ModernCard } from '../components/ui/ModernCard';
import { DateRangePicker, DateRange } from '../components/ui/DateRangePicker';
import { MultiSelect } from '../components/ui/MultiSelect';
import { FilterPanel } from '../components/ui/FilterPanel';

interface ExpensesProps {
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

export function Expenses({ onBack, hasWriteAccess, focusTransactionId }: ExpensesProps) {
  const { userId: currentUserId } = useModuleAccess();
  const [view, setView] = useState<'list' | 'detail' | 'form'>('list');
  const [selectedEntry, setSelectedEntry] = useState<ExpenseEntry | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [expenseEntries, setExpenseEntries] = useState<ExpenseEntry[]>([]);
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

  const loadExpenses = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchExpenses('all', 'all', dateRange.startDate && dateRange.endDate ? { startDate: dateRange.startDate, endDate: dateRange.endDate } : undefined);
      setExpenseEntries(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load expenses';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadExpenses();
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
    void loadExpenses();
  }, [dateRange]);

  useEffect(() => {
    if (!focusTransactionId || expenseEntries.length === 0) return;
    const match = expenseEntries.find((e) => e.transactionId === focusTransactionId);
    if (match) {
      setSelectedEntry(match);
      setView('detail');
    }
  }, [focusTransactionId, expenseEntries]);

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

  const handleViewDetail = (entry: ExpenseEntry) => {
    setSelectedEntry(entry);
    setView('detail');
  };

  const handleAddNew = () => {
    setSelectedEntry(null);
    setIsEditing(false);
    setView('form');
  };

  const handleEdit = (entry: ExpenseEntry) => {
    setSelectedEntry(entry);
    setIsEditing(true);
    setView('form');
  };

  const handleDelete = async (id: string) => {
    if (!hasWriteAccess) {
      setError('You only have read-only access to Finance.');
      return;
    }
    if (!confirm('Are you sure you want to delete this expense entry?')) return;
    setSaving(true);
    setError(null);
    try {
      await deleteExpense(id);
      setExpenseEntries((prev) => prev.filter((e) => e.id !== id));
      setSelectedEntry(null);
      setView('list');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete expense entry';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (data: Partial<ExpenseEntry>, evidenceFile?: File | null) => {
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
        evidenceUrl = await uploadEvidence(evidenceFile, 'expenses');
      }

      const payload = { ...data, evidenceUrl };

      if (isEditing && selectedEntry) {
        const updated = await updateExpense(selectedEntry.id, payload, { currentUserId });
        setExpenseEntries((prev) =>
          prev.map((e) => (e.id === updated.id ? updated : e))
        );
        setSelectedEntry(updated);
        setSaveSuccess('Expense entry updated successfully!');
      } else {
        const created = await createExpense(payload, { currentUserId });
        setExpenseEntries((prev) => [created, ...prev]);
        setSaveSuccess('Expense entry created successfully!');
      }
      // Auto-hide success message after 5 seconds
      setTimeout(() => {
        setSaveSuccess(null);
      }, 5000);
      setView('list');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save expense entry';
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
    let items = [...expenseEntries];
    if (search.trim()) {
      const term = search.toLowerCase();
      const termClean = term.replace(/,/g, '');
      items = items.filter((e) =>
        e.reason.toLowerCase().includes(term) ||
        e.transactionId.toLowerCase().includes(term) ||
        (e.vendor ?? '').toLowerCase().includes(term) ||
        // Expanded search fields
        e.amount.toString().includes(termClean) ||
        formatCurrency(e.amount).toLowerCase().includes(term) ||
        e.paymentMethod.toLowerCase().includes(term) ||
        formatDate(e.paymentDate).toLowerCase().includes(term) ||
        // Payer name lookup (Expenses has paidToUser too)
        (e.paidToUser ? lookupName(e.paidToUser).toLowerCase().includes(term) : false)
      );
    }
    if (selectedTypes.length > 0) {
      items = items.filter((e) => selectedTypes.includes(e.expenseType));
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
  }, [expenseEntries, search, selectedTypes, sortBy, lookupName]);

  const totalAmount = expenseEntries.reduce((sum, e) => sum + e.amount, 0);

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
      <ExpenseForm
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
            </div>
            <div className="text-left md:text-right">
              <p className="text-3xl font-bold text-red-600">
                {formatCurrency(selectedEntry.amount)}
              </p>
              <p className="text-sm text-slate-500 mt-1 capitalize">
                {selectedEntry.expenseType === 'other' && selectedEntry.otherExpenseTypeSpecification
                  ? selectedEntry.otherExpenseTypeSpecification
                  : selectedEntry.expenseType.replace('_', ' ')}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Expense Type</p>
                <p className="text-slate-800 capitalize">
                  {selectedEntry.expenseType === 'other' && selectedEntry.otherExpenseTypeSpecification
                    ? selectedEntry.otherExpenseTypeSpecification
                    : selectedEntry.expenseType.replace('_', ' ')}
                </p>
              </div>

              {selectedEntry.vendor && (
                <div>
                  <p className="text-sm font-medium text-slate-500 mb-1">Vendor</p>
                  <p className="text-slate-800">{selectedEntry.vendor}</p>
                </div>
              )}

              {selectedEntry.bankReference && (
                <div>
                  <p className="text-sm font-medium text-slate-500 mb-1">Payment Reference</p>
                  <p className="text-slate-800">{selectedEntry.bankReference}</p>
                </div>
              )}
              {selectedEntry.evidenceUrl && (
                <div>
                  <p className="text-sm font-medium text-slate-500 mb-1">Evidence</p>
                  <a
                    href={selectedEntry.evidenceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary-600 underline text-sm hover:text-primary-700"
                  >
                    View attachment
                  </a>
                </div>
              )}

              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Payment Date</p>
                <p className="text-slate-800">{formatDate(selectedEntry.paymentDate)}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Payment Method</p>
                <p className="text-slate-800 capitalize">{selectedEntry.paymentMethod.replace('_', ' ')}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">Payment From</p>
                <p className="text-slate-800 capitalize">
                  {selectedEntry.paymentTo === 'organization_bank'
                    ? 'Organization Bank'
                    : `Other Bank Account - ${lookupName(selectedEntry.paidToUser)}`
                  }
                </p>
              </div>

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
            Add Expense
          </ModernButton>
        )}
      </div>

      <ModernCard className="bg-gradient-to-r from-red-50 to-white border-red-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <div className="p-2 bg-red-100 rounded-lg">
                <TrendingDown className="w-6 h-6 text-red-600" />
              </div>
              Expense Overview
            </h1>
            <p className="mt-1 text-gray-600 ml-12">
              Manage and track all operational and other expenses.
            </p>
          </div>
          <div className="text-left md:text-right bg-white/50 p-4 rounded-xl border border-red-100">
            <p className="text-sm text-gray-500 font-medium uppercase tracking-wide">Total Expenses</p>
            <p className="text-3xl font-bold text-red-600 tracking-tight">
              {formatCurrency(totalAmount)}
            </p>
            <p className="text-xs text-gray-400 mt-1">{expenseEntries.length} entries recorded</p>
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
            placeholder="Search by reason, transaction ID, vendor, amount, or payment method..."
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
            label="Expense Type"
            options={[
              { value: 'operational', label: 'Operational' },
              { value: 'salary', label: 'Salary' },
              { value: 'utilities', label: 'Utilities' },
              { value: 'maintenance', label: 'Maintenance' },
              { value: 'raw_material', label: 'Raw Material' },
              { value: 'other', label: 'Other' },
            ]}
            selectedValues={selectedTypes}
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
          <div className="text-center text-slate-500 py-12 bg-white rounded-xl border border-slate-200 border-dashed">
            <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            Loading expenses...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-slate-500 py-16 bg-white rounded-xl border border-slate-200 border-dashed">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <TrendingDown className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No expenses found</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-xs mx-auto">
              Try adjusting your filters or search terms, or add a new expense.
            </p>
          </div>
        ) : (
          filtered.map((expense) => (
            <div
              key={expense.id}
              onClick={() => handleViewDetail(expense)}
              className="group cursor-pointer bg-white rounded-xl border border-slate-200 p-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-red-200 hover:bg-red-50/10"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex gap-4 flex-1 min-w-0">
                  <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center flex-shrink-0">
                    <TrendingDown className="w-6 h-6 text-red-600" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-base font-bold text-slate-900 truncate group-hover:text-primary-600 transition-colors">
                        <HighlightText text={expense.reason} term={search} />
                      </h3>
                      <span className="px-2 py-0.5 bg-red-50 text-red-700 text-[10px] font-bold uppercase tracking-wider rounded-full flex-shrink-0 border border-red-100">
                        <HighlightText text={expense.transactionId} term={search} />
                      </span>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      <span className="font-medium text-slate-600">
                        <HighlightText text={formatDate(expense.paymentDate)} term={search} />
                      </span>
                      <span>•</span>
                      <span className="truncate max-w-[150px] sm:max-w-none">
                        <HighlightText text={expense.vendor || 'No Vendor'} term={search} />
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <p className="text-lg sm:text-xl font-bold text-red-600">
                    <HighlightText text={formatCurrency(expense.amount)} term={search} />
                  </p>
                  <p className="text-xs text-slate-400 mt-1 font-medium capitalize">
                    <HighlightText text={expense.paymentMethod.replace('_', ' ')} term={search} />
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
