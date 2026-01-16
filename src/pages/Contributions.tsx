import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Plus, Edit2, Trash2, DollarSign } from 'lucide-react';
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

interface ContributionsProps {
  onBack: () => void;
  hasWriteAccess: boolean;
  focusTransactionId?: string | null;
}

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
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | ContributionEntry['contributionType']>('all');
  const [filterPaidBy, setFilterPaidBy] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'>('date_desc');
  const [month, setMonth] = useState<number | 'all'>('all');
  const [year, setYear] = useState<number | 'all'>('all');

  const loadContributions = async (m = month, y = year) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchContributions(m, y);
      setContributions(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load contributions';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadContributions(month, year);
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
  }, []);

  useEffect(() => {
    void loadContributions(month, year);
  }, [month, year]);

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
      items = items.filter((c) =>
        c.reason.toLowerCase().includes(term) ||
        c.transactionId.toLowerCase().includes(term)
      );
    }
    if (filterType !== 'all') {
      items = items.filter((c) => c.contributionType === filterType);
    }
    if (filterPaidBy !== 'all') {
      items = items.filter((c) => c.paidBy === filterPaidBy);
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
  }, [contributions, search, filterType, filterPaidBy, sortBy]);

  const totalAmount = contributions.reduce((sum, c) => sum + c.amount, 0);

  const clearFilters = () => {
    setMonth('all');
    setYear('all');
    setSearch('');
    setFilterType('all');
    setFilterPaidBy('all');
    setSortBy('date_desc');
  };

  const hasActiveFilters = month !== 'all' || year !== 'all' || search.trim() || filterType !== 'all' || filterPaidBy !== 'all' || sortBy !== 'date_desc';

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
                {selectedEntry.contributionType}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Payment Date</p>
                <p className="text-gray-900">{formatDate(selectedEntry.paymentDate)}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Payment Method</p>
                <p className="text-gray-900 capitalize">{selectedEntry.paymentMethod.replace('_', ' ')}</p>
              </div>

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
                <p className="text-sm font-medium text-gray-500 mb-1">Who Paid?</p>
                <p className="text-gray-900">{lookupName(selectedEntry.paidBy)}</p>
              </div>
            </div>

            <div className="space-y-4">
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
            Add Contribution
          </button>
        )}
      </div>

      <div>
        <h1 className="text-3xl font-bold text-gray-900">Contribution & Investment</h1>
        <p className="mt-2 text-gray-600">
          Total: {formatCurrency(totalAmount)} • {contributions.length} entries
        </p>
        {error && (
          <div className="mt-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
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
          placeholder="Search reason or TXN"
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as typeof filterType)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All types</option>
          <option value="capital">Capital</option>
          <option value="investment">Investment</option>
          <option value="loan">Loan</option>
          <option value="other">Other</option>
        </select>
        <select
          value={filterPaidBy}
          onChange={(e) => setFilterPaidBy(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All payers</option>
          {Object.entries(usersLookup).map(([userId, userName]) => (
            <option key={userId} value={userId}>
              {userName}
            </option>
          ))}
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

      {hasActiveFilters && (
        <div className="flex justify-end">
          <button
            onClick={clearFilters}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Clear Filters
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="text-center text-gray-500 py-8">Loading contributions...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-gray-500 py-8">No contributions recorded yet.</div>
        ) : (
          filtered.map((contribution) => (
            <div
              key={contribution.id}
              onClick={() => handleViewDetail(contribution)}
              className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div className="flex gap-4 flex-1">
                  <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <DollarSign className="w-6 h-6 text-blue-600" />
                  </div>

                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {contribution.reason}
                    </h3>
                    <p className="text-sm text-gray-600 mb-2">
                      {contribution.transactionId} • {formatDate(contribution.paymentDate)}
                    </p>
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                      <span className="px-1.5 py-0.5 sm:px-2 sm:py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded capitalize">
                        {contribution.contributionType}
                      </span>
                      <span className="px-1.5 py-0.5 sm:px-2 sm:py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded capitalize">
                        {contribution.paymentMethod.replace('_', ' ')}
                      </span>
                      {contribution.paidBy && (
                        <span className="px-1.5 py-0.5 sm:px-2 sm:py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded truncate max-w-[120px] sm:max-w-none">
                          Paid by: {lookupName(contribution.paidBy)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-xl font-bold text-green-600">
                    {formatCurrency(contribution.amount)}
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
