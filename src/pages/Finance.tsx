import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, IndianRupee, ArrowRight, RefreshCcw, ShieldCheck, Search, Download } from 'lucide-react';
import { fetchFinanceSummary, fetchRecentTransactions, searchTransactions, fetchLedgerTransactions, fetchContributions, fetchIncome, fetchExpenses, type TransactionListItem, type LedgerItem } from '../lib/finance';
import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';
import type { AccessLevel } from '../types/access';

interface FinanceProps {
  onNavigateToSection: (section: 'contributions' | 'income' | 'expenses') => void;
  accessLevel: AccessLevel;
  onOpenTransaction: (target: 'contribution' | 'income' | 'expense', txnId: string) => void;
}

export function Finance({ onNavigateToSection, accessLevel, onOpenTransaction }: FinanceProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState({
    totalContributions: 0,
    totalIncome: 0,
    totalExpenses: 0,
    contributionsCount: 0,
    incomeCount: 0,
    expensesCount: 0,
    ledgerIncome: 0,
  });
  const [recent, setRecent] = useState<TransactionListItem[]>([]);
  const [recentError, setRecentError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<
    Array<TransactionListItem & { table: 'income' | 'expenses' | 'contributions' }>
  >([]);
  const [searchPage, setSearchPage] = useState(1);
  const searchPageSize = 10;
  const [ledger, setLedger] = useState<LedgerItem[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerError, setLedgerError] = useState<string | null>(null);
  const [ledgerFilter, setLedgerFilter] = useState<'all' | 'income' | 'expense' | 'contribution'>('all');
  const [showLedger, setShowLedger] = useState(false);
  const [ledgerPage, setLedgerPage] = useState(1);
  const ledgerPageSize = 10;
  const [exporting, setExporting] = useState(false);
  const [exportingXlsx, setExportingXlsx] = useState(false);

  const loadSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchFinanceSummary();
      setSummary({
        totalContributions: data.contributions.totalAmount,
        totalIncome: data.ledgerIncome.totalAmount,
        totalExpenses: data.expenses.totalAmount,
        contributionsCount: data.contributions.count,
        incomeCount: data.ledgerIncome.count,
        expensesCount: data.expenses.count,
        ledgerIncome: data.ledgerIncome.totalAmount,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load finance summary';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportXlsx = async () => {
    try {
      setExportingXlsx(true);
      const { data: userRows } = await supabase.from('users').select('id, full_name').eq('is_active', true);
      const userMap: Record<string, string> =
        (userRows ?? []).reduce((acc, row) => {
          acc[(row as { id: string }).id] = (row as { full_name?: string | null }).full_name || '';
          return acc;
        }, {} as Record<string, string>);

      const [contribs, incomes, expenses] = await Promise.all([
        fetchContributions('all', 'all'),
        fetchIncome('all', 'all'),
        fetchExpenses('all', 'all'),
      ]);

      const rows = mapRows(userMap, contribs, incomes, expenses);

      const header = [
        'Type',
        'Transaction ID',
        'Amount (INR)',
        'Amount (raw)',
        'Payment Date/Time (IST)',
        'Payment Method',
        'Party / Source / Vendor',
        'Reason',
        'Payment Reference',
        'Recorded By (Name)',
        'Recorded By (ID)',
      ];

      const dataMatrix = [
        header,
        ...rows.map((r) => [
          r.type,
          r.txn,
          r.amountPretty,
          r.amount,
          r.date,
          r.method,
          r.party,
          r.reason,
          r.ref,
          r.evidence,
          r.recordedBy,
          r.recordedById,
        ]),
      ];

      const ws = XLSX.utils.aoa_to_sheet(dataMatrix);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Finance');
      const fileName = `finance-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } finally {
      setExportingXlsx(false);
    }
  };

  const loadRecent = async () => {
    setRecentError(null);
    try {
      const data = await fetchRecentTransactions(8);
      setRecent(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load recent transactions';
      setRecentError(message);
    }
  };

  useEffect(() => {
    void loadSummary();
    void loadRecent();
  }, []);

  useEffect(() => {
    if (!showLedger) return;
    const loadLedger = async () => {
      setLedgerLoading(true);
      setLedgerError(null);
      try {
        const data = await fetchLedgerTransactions(300);
        setLedger(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load ledger';
        setLedgerError(message);
      } finally {
        setLedgerLoading(false);
      }
    };
    void loadLedger();
  }, [showLedger]);

  useEffect(() => {
    setLedgerPage(1);
  }, [ledgerFilter, showLedger]);

  const formatDateTimeIST = (iso: string | null | undefined) => {
    if (!iso) return '';
    return new Date(iso).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const escapeCsv = (val: string | number | null | undefined) => {
    const s = val === null || val === undefined ? '' : String(val);
    if (s.includes('"') || s.includes(',') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const amountFmt = (amt: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amt);

  const mapRows = (userMap: Record<string, string>, contribs: any[], incomes: any[], expenses: any[]) => {
    const nameOf = (id?: string | null) => (id && userMap[id]) || id || '';
    const partyFromPayment = (paymentTo: string | undefined, paidToUser?: string | null) =>
      paymentTo === 'other_bank_account' ? nameOf(paidToUser) : (paymentTo ?? '');

    const rows = [
      ...contribs.map((c) => ({
        type: 'contribution',
        txn: c.transactionId,
        amount: c.amount,
        amountPretty: amountFmt(c.amount),
        date: formatDateTimeIST(c.paymentDate),
        method: c.paymentMethod,
        party: partyFromPayment(c.paymentTo, c.paidToUser),
        reason: c.reason,
        ref: c.bankReference ?? '',
        recordedBy: nameOf(c.recordedBy),
        recordedById: c.recordedBy ?? '',
      })),
      ...incomes.map((i) => ({
        type: 'income',
        txn: i.transactionId,
        amount: i.amount,
        amountPretty: amountFmt(i.amount),
        date: formatDateTimeIST(i.paymentDate),
        method: i.paymentMethod,
        party: partyFromPayment(i.paymentTo, i.paidToUser) || i.source || '',
        reason: i.reason,
        ref: i.bankReference ?? '',
        recordedBy: nameOf(i.recordedBy),
        recordedById: i.recordedBy ?? '',
      })),
      ...expenses.map((e) => ({
        type: 'expense',
        txn: e.transactionId,
        amount: e.amount,
        amountPretty: amountFmt(e.amount),
        date: formatDateTimeIST(e.paymentDate),
        method: e.paymentMethod,
        party: partyFromPayment(e.paymentTo, e.paidToUser) || e.vendor || e.paymentTo || '',
        reason: e.reason,
        ref: e.bankReference ?? '',
        recordedBy: nameOf(e.recordedBy),
        recordedById: e.recordedBy ?? '',
      })),
    ];
    return rows;
  };

  const handleExportCsv = async () => {
    try {
      setExporting(true);
      // fetch users to map ids to names
      const { data: userRows } = await supabase.from('users').select('id, full_name').eq('is_active', true);
      const userMap: Record<string, string> =
        (userRows ?? []).reduce((acc, row) => {
          acc[(row as { id: string }).id] = (row as { full_name?: string | null }).full_name || '';
          return acc;
        }, {} as Record<string, string>);

      const [contribs, incomes, expenses] = await Promise.all([
        fetchContributions('all', 'all'),
        fetchIncome('all', 'all'),
        fetchExpenses('all', 'all'),
      ]);

      const rows = mapRows(userMap, contribs, incomes, expenses);

      const header = [
        'Type',
        'Transaction ID',
        'Amount (INR)',
        'Amount (raw)',
        'Payment Date/Time (IST)',
        'Payment Method',
        'Party / Source / Vendor',
        'Reason',
        'Payment Reference',
        'Recorded By (Name)',
        'Recorded By (ID)',
      ];

      const csv = [
        `HATVONI Finance Export generated at ${formatDateTimeIST(new Date().toISOString())}`,
        header.map(escapeCsv).join(','),
        header.map(escapeCsv).join(','),
        ...rows.map((r) =>
          [
            r.type,
            r.txn,
            r.amountPretty,
            r.amount,
            r.date,
            r.method,
            r.party,
            r.reason,
            r.ref,
            r.recordedBy,
            r.recordedById,
          ]
            .map(escapeCsv)
            .join(',')
        ),
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `finance-export-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    const runSearch = async () => {
      if (!searchTerm || searchTerm.trim().length < 2) {
        setSearchResults([]);
        setSearchError(null);
        setSearchPage(1);
        return;
      }
      setSearchLoading(true);
      setSearchError(null);
      try {
        const results = await searchTransactions(searchTerm.trim(), 15);
        setSearchResults(results);
        setSearchPage(1);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Search failed';
        setSearchError(message);
      } finally {
        setSearchLoading(false);
      }
    };

    void runSearch();
  }, [searchTerm]);

  if (accessLevel === 'no-access') {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6 text-center text-gray-700">
        You do not have access to the Finance module. Please contact an administrator.
      </div>
    );
  }

  const netBalance = summary.ledgerIncome - summary.totalExpenses;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const stats: Array<{
    title: string;
    value: string;
    count: string;
    icon: typeof IndianRupee;
    color: 'blue' | 'green' | 'red';
    section: 'contributions' | 'income' | 'expenses';
  }> = [
    {
      title: 'Total Contributions & Investment',
      value: formatCurrency(summary.totalContributions),
      count: `${summary.contributionsCount} entries`,
      icon: IndianRupee,
      color: 'blue',
      section: 'contributions' as const,
    },
    {
      title: 'Total Income',
      value: formatCurrency(summary.totalIncome),
      count: `${summary.incomeCount} entries`,
      icon: IndianRupee,
      color: 'green',
      section: 'income' as const,
    },
    {
      title: 'Total Expenses',
      value: formatCurrency(summary.totalExpenses),
      count: `${summary.expensesCount} entries`,
      icon: IndianRupee,
      color: 'red',
      section: 'expenses' as const,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Finance Dashboard</h1>
        <p className="mt-2 text-gray-600">
          Overview of contributions, income, and expenses
        </p>
        <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-sm">
          <ShieldCheck className="w-4 h-4" />
          {accessLevel === 'read-write' ? 'Read & Write' : 'Read Only'}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={() => void loadSummary()}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            disabled={loading}
          >
            <RefreshCcw className="w-4 h-4" />
            {loading ? 'Refreshing...' : 'Refresh totals'}
          </button>
          <button
            onClick={() => void handleExportCsv()}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
            disabled={exporting}
          >
            <Download className="w-4 h-4" />
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
          <button
            onClick={() => void handleExportXlsx()}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
            disabled={exportingXlsx}
          >
            <Download className="w-4 h-4" />
            {exportingXlsx ? 'Exporting...' : 'Export Excel'}
          </button>
          {error && (
            <span className="text-sm text-red-600">
              {error}
            </span>
          )}
        </div>
        <div className="mt-4">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search all transactions by TXN ID or reason..."
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {searchError && (
            <p className="mt-2 text-sm text-red-600">{searchError}</p>
          )}
          {searchTerm && (
            <div className="mt-3 bg-white border border-gray-200 rounded-lg">
              {searchLoading ? (
                <div className="p-4 text-sm text-gray-500">Searching...</div>
              ) : searchResults.length === 0 ? (
                <div className="p-4 text-sm text-gray-500">No results</div>
              ) : (
                <>
                  <ul className="divide-y divide-gray-200">
                    {searchResults
                      .slice((searchPage - 1) * searchPageSize, searchPage * searchPageSize)
                      .map((item) => (
                        <li
                          key={`${item.table}-${item.id}`}
                          className="p-4 hover:bg-gray-50 cursor-pointer flex items-center justify-between"
                          onClick={() => {
                            const target =
                              item.table === 'contributions'
                                ? 'contribution'
                                : item.table === 'income'
                                ? 'income'
                                : 'expense';
                            onOpenTransaction(target, item.transactionId);
                          }}
                        >
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{item.transactionId}</p>
                            <p className="text-sm text-gray-600">{item.reason}</p>
                            <p className="text-xs text-gray-500">
                              {new Date(item.date).toLocaleString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                          <div className="text-right">
                            <span
                              className={`text-xs px-2 py-1 rounded-full border ${
                                item.table === 'income'
                                  ? 'text-green-700 border-green-200 bg-green-50'
                                  : item.table === 'expenses'
                                  ? 'text-red-700 border-red-200 bg-red-50'
                                  : 'text-blue-700 border-blue-200 bg-blue-50'
                              }`}
                            >
                              {item.table === 'contributions' ? 'Contribution' : item.table === 'income' ? 'Income' : 'Expense'}
                            </span>
                            <p className="mt-2 font-semibold text-gray-900">
                              {formatCurrency(item.amount)}
                            </p>
                          </div>
                        </li>
                      ))}
                  </ul>
                  <div className="flex items-center justify-between px-4 py-3 text-sm text-gray-600">
                    <span>
                      Page {searchPage} of {Math.max(1, Math.ceil(searchResults.length / searchPageSize))}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSearchPage((p) => Math.max(1, p - 1))}
                        disabled={searchPage === 1}
                        className="px-3 py-1 border rounded disabled:opacity-50"
                      >
                        Prev
                      </button>
                      <button
                        onClick={() =>
                          setSearchPage((p) =>
                            Math.min(Math.ceil(searchResults.length / searchPageSize), p + 1)
                          )
                        }
                        disabled={searchPage >= Math.ceil(searchResults.length / searchPageSize)}
                        className="px-3 py-1 border rounded disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-100 text-sm font-medium">Net Balance</p>
            <h2 className="text-4xl font-bold mt-2">{formatCurrency(netBalance)}</h2>
            <p className="text-blue-100 mt-2">
              Current financial position
            </p>
          </div>
          <div className="w-20 h-20 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
            <IndianRupee className="w-10 h-10" />
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={() => setShowLedger(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white text-blue-700 rounded-lg hover:bg-blue-50 transition-colors"
          >
            View Ledger (Income & Expenses)
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showLedger && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Ledger</h2>
              <p className="text-sm text-gray-600">All income, expenses, and contributions</p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={ledgerFilter}
                onChange={(e) => setLedgerFilter(e.target.value as typeof ledgerFilter)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="all">All</option>
                <option value="income">Income</option>
                <option value="expense">Expenses</option>
                <option value="contribution">Contributions</option>
              </select>
              <button
                onClick={() => setShowLedger(false)}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Close
              </button>
            </div>
          </div>

          {ledgerLoading ? (
            <div className="py-6 text-center text-gray-500">Loading ledger...</div>
          ) : ledgerError ? (
            <div className="py-6 text-center text-red-600 text-sm">{ledgerError}</div>
          ) : ledger.length === 0 ? (
            <div className="py-6 text-center text-gray-500">No transactions found.</div>
          ) : (
            <div className="overflow-x-auto">
              {(() => {
                const filtered = ledger.filter((item) => ledgerFilter === 'all' || item.type === ledgerFilter);
                const totalPages = Math.max(1, Math.ceil(filtered.length / ledgerPageSize));
                const currentPage = Math.min(ledgerPage, totalPages);
                const paged = filtered.slice((currentPage - 1) * ledgerPageSize, currentPage * ledgerPageSize);

                return (
                  <>
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">TXN ID</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {paged.map((item) => (
                          <tr
                            key={`${item.table}-${item.id}`}
                            className="hover:bg-gray-50 cursor-pointer"
                            onClick={() => {
                              const target =
                                item.type === 'contribution'
                                  ? 'contribution'
                                  : item.type === 'income'
                                  ? 'income'
                                  : 'expense';
                              onOpenTransaction(target, item.transactionId);
                            }}
                          >
                            <td className="px-4 py-2 text-sm text-gray-700">
                              {new Date(item.date).toLocaleString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </td>
                            <td className="px-4 py-2 text-sm font-semibold text-gray-900">{item.transactionId}</td>
                            <td className="px-4 py-2 text-sm">
                              <span
                                className={`px-2 py-1 rounded-full border text-xs ${
                                  item.type === 'income'
                                    ? 'text-green-700 border-green-200 bg-green-50'
                                    : item.type === 'expense'
                                    ? 'text-red-700 border-red-200 bg-red-50'
                                    : 'text-blue-700 border-blue-200 bg-blue-50'
                                }`}
                              >
                                {item.type === 'income' ? 'Income' : item.type === 'expense' ? 'Expense' : 'Contribution'}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-700">{item.reason}</td>
                            <td className="px-4 py-2 text-sm font-semibold text-right text-gray-900">
                              {formatCurrency(item.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="flex items-center justify-between px-4 py-3 text-sm text-gray-600">
                      <span>
                        Page {currentPage} of {totalPages}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setLedgerPage((p) => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          className="px-3 py-1 border rounded disabled:opacity-50"
                        >
                          Prev
                        </button>
                        <button
                          onClick={() => setLedgerPage((p) => Math.min(totalPages, p + 1))}
                          disabled={currentPage >= totalPages}
                          className="px-3 py-1 border rounded disabled:opacity-50"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          const colorClasses = {
            blue: 'bg-blue-50 text-blue-600 border-blue-200',
            green: 'bg-green-50 text-green-600 border-green-200',
            red: 'bg-red-50 text-red-600 border-red-200',
          };

          return (
            <div
              key={stat.title}
              className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 rounded-lg ${colorClasses[stat.color]} flex items-center justify-center border`}>
                  <Icon className="w-6 h-6" />
                </div>
              </div>

              <h3 className="text-sm font-medium text-gray-600 mb-2">
                {stat.title}
              </h3>

              <p className="text-2xl font-bold text-gray-900 mb-1">
                {stat.value}
              </p>

              <p className="text-sm text-gray-500 mb-4">
                {stat.count}
              </p>

              <button
                onClick={() => onNavigateToSection(stat.section)}
                className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
              >
                View Details
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Quick Stats
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">Average Income per Entry</span>
              <span className="text-sm font-semibold text-gray-900">
                {formatCurrency(summary.incomeCount ? summary.totalIncome / summary.incomeCount : 0)}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">Average Expense per Entry</span>
              <span className="text-sm font-semibold text-gray-900">
                {formatCurrency(summary.expensesCount ? summary.totalExpenses / summary.expensesCount : 0)}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">Income vs Expenses Ratio</span>
              <span className="text-sm font-semibold text-green-600">
                {summary.totalExpenses > 0
                  ? ((summary.totalIncome / summary.totalExpenses) * 100).toFixed(0)
                  : '0'
                }%
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Financial Health
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">Operating Margin</span>
                <span className="text-sm font-semibold text-gray-900">
                  {summary.totalIncome > 0
                    ? (((summary.totalIncome - summary.totalExpenses) / summary.totalIncome) * 100).toFixed(1)
                    : '0.0'
                  }%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full"
                  style={{
                    width: `${
                      summary.totalIncome > 0
                        ? ((summary.totalIncome - summary.totalExpenses) / summary.totalIncome) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100">
              <p className="text-sm text-gray-600 mb-2">Status</p>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full" />
                <span className="text-sm font-medium text-gray-900">Healthy Financial Position</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Recent Transactions</h3>
              <p className="text-sm text-gray-500">Incoming and outgoing</p>
            </div>
            <button
              onClick={() => void loadRecent()}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              disabled={loading}
            >
              <RefreshCcw className="w-4 h-4" />
              Refresh
            </button>
          </div>

          {recentError && (
            <div className="mb-3 text-sm text-red-600">
              {recentError}
            </div>
          )}

          {recent.length === 0 ? (
            <div className="text-sm text-gray-500">No transactions yet.</div>
          ) : (
            <div className="space-y-3">
              {recent.map((tx) => {
                const isIncome = tx.type === 'income';
                const isContribution = (tx.source ?? '').toLowerCase() === 'contribution';
                return (
                  <button
                    key={`${tx.type}-${tx.id}`}
                    onClick={() => {
                      if (isIncome && isContribution) {
                        onOpenTransaction('contribution', tx.transactionId);
                      } else if (isIncome) {
                        onOpenTransaction('income', tx.transactionId);
                      } else {
                        onOpenTransaction('expense', tx.transactionId);
                      }
                    }}
                    className={`w-full text-left border rounded-lg px-4 py-3 hover:shadow-sm transition ${
                      isIncome ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                    } ${isContribution ? 'ring-2 ring-blue-100' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {isContribution ? `CONTRIBUTION-${tx.transactionId}` : tx.transactionId}
                        </p>
                        <p className="text-xs text-gray-600">
                          {tx.reason}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-bold ${isIncome ? 'text-green-700' : 'text-red-700'}`}>
                          {isIncome ? '+' : '-'}{formatCurrency(tx.amount)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(tx.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
