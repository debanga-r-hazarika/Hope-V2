import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Plus, Edit2, Trash2, TrendingUp } from 'lucide-react';
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

interface IncomeProps {
  onBack: () => void;
  hasWriteAccess: boolean;
  focusTransactionId?: string | null;
  onViewContribution?: (txnId: string) => void;
}

export function Income({ onBack, hasWriteAccess, focusTransactionId, onViewContribution: _onViewContribution }: IncomeProps) {
  const { userId: currentUserId } = useModuleAccess();
  const [view, setView] = useState<'list' | 'detail' | 'form'>('list');
  const [selectedEntry, setSelectedEntry] = useState<IncomeEntry | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [incomeEntries, setIncomeEntries] = useState<IncomeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usersLookup, setUsersLookup] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | IncomeEntry['incomeType']>('all');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'>('date_desc');
  const [month, setMonth] = useState<number | 'all'>('all');
  const [year, setYear] = useState<number | 'all'>('all');

  const loadIncome = useCallback(async (m = month, y = year) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchIncome(m, y);
      setIncomeEntries(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load income entries';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    void loadIncome(month, year);
    void supabase
      .from('users')
      .select('id, full_name')
      .then(({ data }) => {
        const map: Record<string, string> = {};
        (data ?? []).forEach((u) => {
          map[u.id] = (u as { id: string; full_name: string }).full_name;
        });
        setUsersLookup(map);
      });
  }, [loadIncome, month, year]);

  useEffect(() => {
    const channel = supabase
      .channel('income-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'income' },
        () => {
          void loadIncome(month, year);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadIncome, month, year]);

  useEffect(() => {
    void loadIncome(month, year);
  }, [month, year, loadIncome]);

  useEffect(() => {
    if (!focusTransactionId || incomeEntries.length === 0) return;
    const match = incomeEntries.find((i) => i.transactionId === focusTransactionId);
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
    try {
      let evidenceUrl = data.evidenceUrl ?? selectedEntry?.evidenceUrl ?? null;
      if (evidenceFile) {
        evidenceUrl = await uploadEvidence(evidenceFile, 'income');
      }

      const payload = { ...data, evidenceUrl };

      if (isEditing && selectedEntry) {
        const updated = await updateIncome(selectedEntry.id, payload, { currentUserId });
        setIncomeEntries((prev) =>
          prev.map((e) => (e.id === updated.id ? updated : e))
        );
        setSelectedEntry(updated);
      } else {
        const created = await createIncome(payload, { currentUserId });
        setIncomeEntries((prev) => [created, ...prev]);
      }
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
      items = items.filter((i) =>
        i.reason.toLowerCase().includes(term) ||
        i.transactionId.toLowerCase().includes(term) ||
        (i.source ?? '').toLowerCase().includes(term)
      );
    }
    if (filterType !== 'all') {
      items = items.filter((i) => i.incomeType === filterType);
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
  }, [incomeEntries, search, filterType, sortBy]);

  const totalAmount = incomeEntries.reduce((sum, e) => sum + e.amount, 0);

  if (view === 'form') {
    return (
      <IncomeForm
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
            {selectedEntry.fromSalesPayment ? (
              <div className="flex items-center gap-2 px-4 py-2 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg">
                <span className="text-sm">
                  This entry is from a Sales order payment and cannot be edited here.
                  {selectedEntry.orderNumber && (
                    <span className="ml-1 font-medium">Order: {selectedEntry.orderNumber}</span>
                  )}
                </span>
              </div>
            ) : (
              <>
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
              </>
            )}
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
              {selectedEntry.fromSalesPayment && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm font-medium text-blue-900 mb-1">
                    📦 Sales Order Payment Entry
                  </p>
                  <p className="text-xs text-blue-700">
                    This income entry is automatically created from a sales order payment.
                    {selectedEntry.orderNumber && (
                      <span className="block mt-1">
                        <strong>Order Number:</strong> {selectedEntry.orderNumber}
                      </span>
                    )}
                    {selectedEntry.orderId && (
                      <span className="block mt-1">
                        <strong>Order ID:</strong> {selectedEntry.orderId}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-blue-800 mt-2 font-medium">
                    ⚠️ To edit or delete this entry, go to Sales module → Orders → Find the order above → Edit/Delete payment
                  </p>
                </div>
              )}
              {selectedEntry.bankReference && (
                <p className="text-sm text-gray-500 mt-1">
                  Payment Reference: {selectedEntry.bankReference}
                </p>
              )}
              {selectedEntry.evidenceUrl && (
                <p className="text-sm text-blue-600 mt-1">
                  Evidence: <a href={selectedEntry.evidenceUrl} target="_blank" rel="noreferrer" className="underline">View</a>
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-green-600">
                {formatCurrency(selectedEntry.amount)}
              </p>
              <p className="text-sm text-gray-500 mt-1 capitalize">
                {selectedEntry.incomeType}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Source</p>
                <p className="text-gray-900">{selectedEntry.source}</p>
              </div>

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
                <p className="text-sm font-medium text-gray-500 mb-1">Payment To</p>
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
            Add Income
          </button>
        )}
      </div>

      <div>
        <h1 className="text-3xl font-bold text-gray-900">Income</h1>
        <p className="mt-2 text-gray-600">
          Total: {formatCurrency(totalAmount)} • {incomeEntries.length} entries
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
          placeholder="Search reason, source, or TXN"
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as typeof filterType)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All types</option>
          <option value="sales">Sales</option>
          <option value="service">Service</option>
          <option value="interest">Interest</option>
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
          <div className="text-center text-gray-500 py-8">Loading income entries...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-gray-500 py-8">No income entries recorded yet.</div>
        ) : (
          filtered.map((income) => {
            const isContrib = income.source?.toLowerCase() === 'contribution';
            return (
            <div
              key={income.id}
              onClick={() => handleViewDetail(income)}
              className={`rounded-lg border p-6 hover:shadow-md transition-shadow cursor-pointer ${
                isContrib ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex gap-4 flex-1">
                  <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="w-6 h-6 text-green-600" />
                  </div>

                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
              {income.reason}
                    </h3>
                    <p className="text-sm text-gray-600 mb-2">
                      {income.transactionId} • {income.source} • {formatDate(income.paymentDate)}
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded capitalize">
                        {income.incomeType}
                      </span>
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded capitalize">
                        {income.paymentMethod.replace('_', ' ')}
                      </span>
                      {income.fromSalesPayment && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded flex items-center gap-1">
                          📦 Sales Order
                          {income.orderNumber && (
                            <span className="font-semibold">• {income.orderNumber}</span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-xl font-bold text-green-600">
                    {formatCurrency(income.amount)}
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
