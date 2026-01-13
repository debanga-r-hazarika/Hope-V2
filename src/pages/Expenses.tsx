import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Plus, Edit2, Trash2, TrendingDown } from 'lucide-react';
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

interface ExpensesProps {
  onBack: () => void;
  hasWriteAccess: boolean;
  focusTransactionId?: string | null;
}

export function Expenses({ onBack, hasWriteAccess, focusTransactionId }: ExpensesProps) {
  const { userId: currentUserId } = useModuleAccess();
  const [view, setView] = useState<'list' | 'detail' | 'form'>('list');
  const [selectedEntry, setSelectedEntry] = useState<ExpenseEntry | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [expenseEntries, setExpenseEntries] = useState<ExpenseEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usersLookup, setUsersLookup] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | ExpenseEntry['expenseType']>('all');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'>('date_desc');
  const [month, setMonth] = useState<number | 'all'>('all');
  const [year, setYear] = useState<number | 'all'>('all');

  const loadExpenses = async (m = month, y = year) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchExpenses(m, y);
      setExpenseEntries(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load expenses';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadExpenses(month, year);
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
  }, [month, year]);

  useEffect(() => {
    void loadExpenses(month, year);
  }, [month, year]);

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
      } else {
        const created = await createExpense(payload, { currentUserId });
        setExpenseEntries((prev) => [created, ...prev]);
      }
      setView('list');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save expense entry';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(() => {
    let items = [...expenseEntries];
    if (search.trim()) {
      const term = search.toLowerCase();
      items = items.filter((e) =>
        e.reason.toLowerCase().includes(term) ||
        e.transactionId.toLowerCase().includes(term) ||
        (e.vendor ?? '').toLowerCase().includes(term)
      );
    }
    if (filterType !== 'all') {
      items = items.filter((e) => e.expenseType === filterType);
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
  }, [expenseEntries, search, filterType, sortBy]);

  const totalAmount = expenseEntries.reduce((sum, e) => sum + e.amount, 0);
  const lookupName = useMemo(() => (userId?: string | null) => {
    if (!userId) return '—';
    return usersLookup[userId] || userId;
  }, [usersLookup]);

  if (view === 'form') {
    return (
      <ExpenseForm
        entry={isEditing ? selectedEntry : null}
        onSave={handleSave}
        onCancel={() => setView(selectedEntry ? 'detail' : 'list')}
      />
    );
  }

  if (view === 'detail' && selectedEntry) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setView('list')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to List
          </button>

          {hasWriteAccess && (
            <div className="flex gap-2">
              <button
                onClick={() => handleEdit(selectedEntry)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Edit2 className="w-4 h-4" />
                Edit
              </button>
              <button
                    onClick={() => void handleDelete(selectedEntry.id)}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    disabled={saving}
              >
                <Trash2 className="w-4 h-4" />
                    {saving ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {selectedEntry.reason}
              </h1>
              <p className="text-gray-600">
                Transaction ID: {selectedEntry.transactionId}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Last modified by: {lookupName(selectedEntry.recordedBy)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-red-600">
                {formatCurrency(selectedEntry.amount)}
              </p>
              <p className="text-sm text-gray-500 mt-1 capitalize">
                {selectedEntry.expenseType === 'other' && selectedEntry.otherExpenseTypeSpecification
                  ? selectedEntry.otherExpenseTypeSpecification
                  : selectedEntry.expenseType.replace('_', ' ')}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Expense Type</p>
                <p className="text-gray-900 capitalize">
                  {selectedEntry.expenseType === 'other' && selectedEntry.otherExpenseTypeSpecification
                    ? selectedEntry.otherExpenseTypeSpecification
                    : selectedEntry.expenseType.replace('_', ' ')}
                </p>
              </div>

              {selectedEntry.vendor && (
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Vendor</p>
                  <p className="text-gray-900">{selectedEntry.vendor}</p>
                </div>
              )}

              {selectedEntry.bankReference && (
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Payment Reference</p>
                  <p className="text-gray-900">{selectedEntry.bankReference}</p>
                </div>
              )}
              {selectedEntry.evidenceUrl && (
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Evidence</p>
                  <a
                    href={selectedEntry.evidenceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 underline text-sm"
                  >
                    View attachment
                  </a>
                </div>
              )}

              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Payment Date</p>
                <p className="text-gray-900">{formatDate(selectedEntry.paymentDate)}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Payment Method</p>
                <p className="text-gray-900 capitalize">{selectedEntry.paymentMethod.replace('_', ' ')}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Payment From</p>
                <p className="text-gray-900 capitalize">
                  {selectedEntry.paymentTo === 'organization_bank'
                    ? 'Organization Bank'
                    : `Other Bank Account - ${lookupName(selectedEntry.paidToUser)}`
                  }
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Created At</p>
                <p className="text-gray-900">{formatDate(selectedEntry.createdAt)}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Last Updated</p>
                <p className="text-gray-900">{formatDate(selectedEntry.updatedAt)}</p>
              </div>
            </div>
          </div>

          {selectedEntry.description && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-sm font-medium text-gray-500 mb-2">Description</p>
              <p className="text-gray-900">{selectedEntry.description}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Finance Dashboard
        </button>

        {hasWriteAccess && (
          <button
            onClick={handleAddNew}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            disabled={saving}
          >
            <Plus className="w-5 h-5" />
            Add Expense
          </button>
        )}
      </div>

      <div>
        <h1 className="text-3xl font-bold text-gray-900">Expenses</h1>
        <p className="mt-2 text-gray-600">
          Total: {formatCurrency(totalAmount)} • {expenseEntries.length} entries
        </p>
        {error && (
          <div className="mt-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <select
          value={month}
          onChange={(e) => {
            const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
            setMonth(val);
          }}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Months</option>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>
              {new Date(0, m - 1).toLocaleString('en', { month: 'long' })}
            </option>
          ))}
        </select>
        <select
          value={year}
          onChange={(e) => {
            const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
            setYear(val);
          }}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Years</option>
          {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search reason, vendor, or TXN"
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as typeof filterType)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All types</option>
          <option value="operational">Operational</option>
          <option value="salary">Salary</option>
          <option value="utilities">Utilities</option>
          <option value="maintenance">Maintenance</option>
          <option value="raw_material">Raw Material</option>
          <option value="other">Other</option>
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="date_desc">Newest first</option>
          <option value="date_asc">Oldest first</option>
          <option value="amount_desc">Amount high → low</option>
          <option value="amount_asc">Amount low → high</option>
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="text-center text-gray-500 py-8">Loading expenses...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-gray-500 py-8">No expenses recorded yet.</div>
        ) : (
          filtered.map((expense) => (
            <div
              key={expense.id}
              onClick={() => handleViewDetail(expense)}
              className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div className="flex gap-4 flex-1">
                  <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <TrendingDown className="w-6 h-6 text-red-600" />
                  </div>

                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {expense.reason}
                    </h3>
                    <p className="text-sm text-gray-600 mb-2">
                      {expense.transactionId} • {expense.vendor || 'N/A'} • {formatDate(expense.paymentDate)}
                    </p>
                    <div className="flex gap-2">
                      <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded capitalize">
                        {expense.expenseType === 'other' && expense.otherExpenseTypeSpecification
                          ? expense.otherExpenseTypeSpecification
                          : expense.expenseType.replace('_', ' ')}
                      </span>
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded capitalize">
                        {expense.paymentMethod.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-xl font-bold text-red-600">
                    {formatCurrency(expense.amount)}
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
