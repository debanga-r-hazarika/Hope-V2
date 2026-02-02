import { useEffect, useState, useRef } from 'react';
import { TrendingUp, TrendingDown, IndianRupee, ArrowRight, RefreshCcw, ShieldCheck, Search, Download, PieChart, Activity, ChevronDown } from 'lucide-react';
import { fetchFinanceSummary, searchTransactions, fetchLedgerTransactions, fetchContributions, fetchIncome, fetchExpenses, type TransactionListItem, type LedgerItem } from '../lib/finance';
import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';
import type { AccessLevel } from '../types/access';
import type { ContributionEntry, IncomeEntry, ExpenseEntry } from '../types/finance';
import { ModernButton } from '../components/ui/ModernButton';
import { ModernCard } from '../components/ui/ModernCard';

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
  const [exportingXlsx, setExportingXlsx] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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

  const handleExport = async (type: 'income' | 'expenses' | 'contributions') => {
    try {
      setExportingXlsx(true);
      setShowExportMenu(false);
      const { data: userRows } = await supabase.from('users').select('id, full_name');
      const userMap: Record<string, string> =
        (userRows ?? []).reduce((acc, row) => {
          acc[(row as { id: string }).id] = (row as { full_name?: string | null }).full_name || '';
          return acc;
        }, {} as Record<string, string>);

      let data: any[] = [];
      let filename = '';
      let sheetName = '';

      if (type === 'income') {
        data = await fetchIncome('all', 'all');
        filename = `Income_Export_${new Date().toISOString().split('T')[0]}`;
        sheetName = 'Income';
      } else if (type === 'expenses') {
        data = await fetchExpenses('all', 'all');
        filename = `Expenses_Export_${new Date().toISOString().split('T')[0]}`;
        sheetName = 'Expenses';
      } else {
        data = await fetchContributions('all', 'all');
        filename = `Contributions_Export_${new Date().toISOString().split('T')[0]}`;
        sheetName = 'Contributions';
      }

      const rows = data.map((item) => {
        const dateObj = new Date(item.paymentDate);
        const date = dateObj.toLocaleDateString('en-IN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        });
        const time = dateObj.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });

        const recordedByName = item.recordedBy ? userMap[item.recordedBy] || item.recordedBy : '';

        // Determine Party/Source/Vendor
        let party = '';
        if (type === 'income') {
          const inc = item as IncomeEntry;
          party = inc.paymentTo === 'other_bank_account' 
            ? (inc.paidToUser ? userMap[inc.paidToUser] || inc.paidToUser : '') 
            : (inc.source || '');
        } else if (type === 'expenses') {
          const exp = item as ExpenseEntry;
          party = exp.paymentTo === 'other_bank_account'
            ? (exp.paidToUser ? userMap[exp.paidToUser] || exp.paidToUser : '')
            : (exp.vendor || exp.paymentTo || '');
        } else {
          const contrib = item as ContributionEntry;
          party = contrib.paymentTo === 'other_bank_account'
            ? (contrib.paidToUser ? userMap[contrib.paidToUser] || contrib.paidToUser : '')
            : (contrib.paymentTo || '');
        }

        const row: any = {
          'Transaction Type': type === 'income' ? 'Income' : type === 'expenses' ? 'Expense' : 'Contribution',
          'Transaction ID': item.transactionId,
          'Amount': item.amount,
          'Payment Date': date,
          'Payment Time': time,
          'Payment Method': item.paymentMethod,
          'Party Source Vendor': party,
          ...(type === 'contributions' ? { 'Who Paid': (item as ContributionEntry).paidBy ? (userMap[(item as ContributionEntry).paidBy!] || (item as ContributionEntry).paidBy) : '' } : {}),
          'Reason': item.reason,
          'Payment Ref No.': item.bankReference || '',
          'Recorded By Name': recordedByName,
        };

        return row;
      });

      const ws = XLSX.utils.json_to_sheet(rows);

      // Formatting: Set column widths
      const wscols = [
        { wch: 15 }, // Transaction Type
        { wch: 20 }, // Transaction ID
        { wch: 12 }, // Amount
        { wch: 15 }, // Payment Date
        { wch: 15 }, // Payment Time
        { wch: 15 }, // Payment Method
        { wch: 25 }, // Party Source Vendor
        ...(type === 'contributions' ? [{ wch: 20 }] : []), // Who Paid
        { wch: 30 }, // Reason
        { wch: 20 }, // Payment Ref No.
        { wch: 20 }, // Recorded By Name
      ];

      ws['!cols'] = wscols;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      XLSX.writeFile(wb, `${filename}.xlsx`);
    } catch (err) {
      console.error(err);
      alert('Failed to export Excel');
    } finally {
      setExportingXlsx(false);
    }
  };



  useEffect(() => {
    void loadSummary();
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
      <ModernCard className="text-center text-gray-700 py-12">
        <ShieldCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <h3 className="text-lg font-semibold">Access Restricted</h3>
        <p>You do not have access to the Finance module. Please contact an administrator.</p>
      </ModernCard>
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
      title: 'Total Contributions',
      value: formatCurrency(summary.totalContributions),
      count: `${summary.contributionsCount} entries`,
      icon: TrendingUp,
      color: 'blue',
      section: 'contributions' as const,
    },
    {
      title: 'Total Income',
      value: formatCurrency(summary.totalIncome),
      count: `${summary.incomeCount} entries`,
      icon: Activity,
      color: 'green',
      section: 'income' as const,
    },
    {
      title: 'Total Expenses',
      value: formatCurrency(summary.totalExpenses),
      count: `${summary.expensesCount} entries`,
      icon: TrendingDown,
      color: 'red',
      section: 'expenses' as const,
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <ModernCard className="!p-6 sm:!p-8 bg-gradient-to-br from-primary to-primary-light text-white relative overflow-hidden border-none shadow-premium-lg">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-2">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Finance Dashboard</h1>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/10 backdrop-blur-sm border border-white/20 whitespace-nowrap`}>
                <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
                {accessLevel === 'read-write' ? 'Read & Write' : 'Read Only'}
              </span>
            </div>
            <p className="text-blue-100/80 max-w-xl">
              Real-time overview of financial health, contributions, and expenses.
            </p>
            
            <div className="mt-8">
              <p className="text-blue-100 text-sm font-medium uppercase tracking-wider mb-1">Net Balance</p>
              <h2 className="text-5xl font-bold tracking-tight">{formatCurrency(netBalance)}</h2>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                onClick={() => void loadSummary()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors backdrop-blur-sm border border-white/20 text-sm font-medium"
                disabled={loading}
              >
                <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Refreshing...' : 'Refresh Data'}
              </button>
              <button
                onClick={() => setShowLedger(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white text-primary hover:bg-gray-50 rounded-lg transition-colors shadow-lg text-sm font-bold"
              >
                View Full Ledger
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <div className="hidden md:block">
            <div className="w-32 h-32 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md border border-white/20 shadow-2xl">
              <IndianRupee className="w-16 h-16 text-white" />
            </div>
          </div>
        </div>
        
        {/* Background decorations */}
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-accent/20 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-64 h-64 bg-primary-dark/40 rounded-full blur-3xl"></div>
      </ModernCard>

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search transactions..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm shadow-sm"
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
        <div className="relative" ref={exportMenuRef}>
          <ModernButton
            onClick={() => setShowExportMenu(!showExportMenu)}
            variant="outline"
            size="sm"
            loading={exportingXlsx}
            icon={<Download className="w-4 h-4" />}
            className="flex-1 sm:flex-none"
          >
            Export Excel
            <ChevronDown className="w-4 h-4 ml-1" />
          </ModernButton>
          
          {showExportMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50 animate-in fade-in zoom-in-95 duration-200">
              <button
                onClick={() => handleExport('income')}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-primary transition-colors flex items-center gap-2"
              >
                <div className="w-2 h-2 rounded-full bg-green-500" />
                Export Income
              </button>
              <button
                onClick={() => handleExport('expenses')}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-primary transition-colors flex items-center gap-2"
              >
                <div className="w-2 h-2 rounded-full bg-red-500" />
                Export Expenses
              </button>
              <button
                onClick={() => handleExport('contributions')}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-primary transition-colors flex items-center gap-2"
              >
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                Export Contributions
              </button>
            </div>
          )}
        </div>
        </div>
      </div>

      {searchError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          {searchError}
        </div>
      )}

      {/* Search Results */}
      {searchTerm && (
        <ModernCard className="overflow-hidden p-0">
          {searchLoading ? (
            <div className="p-8 text-center text-gray-500">Searching...</div>
          ) : searchResults.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No results found for "{searchTerm}"</div>
          ) : (
            <>
              <div className="divide-y divide-gray-100">
                {searchResults
                  .slice((searchPage - 1) * searchPageSize, searchPage * searchPageSize)
                  .map((item) => (
                    <div
                      key={`${item.table}-${item.id}`}
                      className="p-4 hover:bg-gray-50 cursor-pointer flex items-center justify-between transition-colors"
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
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${
                          item.table === 'income'
                            ? 'bg-green-50 border-green-100 text-green-600'
                            : item.table === 'expenses'
                            ? 'bg-red-50 border-red-100 text-red-600'
                            : 'bg-blue-50 border-blue-100 text-blue-600'
                        }`}>
                          {item.table === 'income' ? <Activity className="w-5 h-5" /> : item.table === 'expenses' ? <TrendingDown className="w-5 h-5" /> : <TrendingUp className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            <HighlightText text={item.transactionId} term={searchTerm} />
                          </p>
                          <p className="text-sm text-gray-600 truncate max-w-[200px] sm:max-w-md">
                            <HighlightText text={item.reason} term={searchTerm} />
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-bold ${item.table === 'expenses' ? 'text-red-600' : 'text-green-600'}`}>
                          {item.table === 'expenses' ? '-' : '+'}
                          <HighlightText text={formatCurrency(item.amount)} term={searchTerm} />
                        </p>
                        <p className="text-xs text-gray-500">
                          <HighlightText 
                            text={new Date(item.date).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                            })} 
                            term={searchTerm} 
                          />
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-100">
                <span className="text-xs text-gray-500 font-medium">
                  Page {searchPage} of {Math.max(1, Math.ceil(searchResults.length / searchPageSize))}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSearchPage((p) => Math.max(1, p - 1))}
                    disabled={searchPage === 1}
                    className="px-3 py-1 text-xs border border-gray-200 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() =>
                      setSearchPage((p) =>
                        Math.min(Math.ceil(searchResults.length / searchPageSize), p + 1)
                      )
                    }
                    disabled={searchPage >= Math.ceil(searchResults.length / searchPageSize)}
                    className="px-3 py-1 text-xs border border-gray-200 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </ModernCard>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          const colorClasses = {
            blue: 'bg-blue-50 text-blue-600 group-hover:bg-blue-100 transition-colors',
            green: 'bg-green-50 text-green-600 group-hover:bg-green-100 transition-colors',
            red: 'bg-red-50 text-red-600 group-hover:bg-red-100 transition-colors',
          };

          return (
            <ModernCard
              key={stat.title}
              className="group cursor-pointer hover:-translate-y-1 transition-transform duration-300"
              onClick={() => onNavigateToSection(stat.section)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 rounded-xl ${colorClasses[stat.color]} flex items-center justify-center`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300">
                  <ArrowRight className="w-4 h-4 text-gray-600" />
                </div>
              </div>

              <h3 className="text-sm font-medium text-gray-500 mb-1">
                {stat.title}
              </h3>

              <p className="text-2xl font-bold text-gray-900 mb-1 tracking-tight">
                {stat.value}
              </p>

              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">
                {stat.count}
              </p>
            </ModernCard>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Stats */}
        <ModernCard>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
              <PieChart className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">
              Analysis
            </h3>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center py-3 border-b border-gray-100">
              <span className="text-sm text-gray-600">Average Income</span>
              <span className="text-sm font-semibold text-gray-900 bg-gray-50 px-3 py-1 rounded-lg">
                {formatCurrency(summary.incomeCount ? summary.totalIncome / summary.incomeCount : 0)}
              </span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-gray-100">
              <span className="text-sm text-gray-600">Average Expense</span>
              <span className="text-sm font-semibold text-gray-900 bg-gray-50 px-3 py-1 rounded-lg">
                {formatCurrency(summary.expensesCount ? summary.totalExpenses / summary.expensesCount : 0)}
              </span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-gray-100">
              <span className="text-sm text-gray-600">Income vs Expenses</span>
              <span className="text-sm font-bold text-green-600 bg-green-50 px-3 py-1 rounded-lg">
                {summary.totalExpenses > 0
                  ? ((summary.totalIncome / summary.totalExpenses) * 100).toFixed(0)
                  : '0'
                }%
              </span>
            </div>
          </div>
        </ModernCard>

        {/* Financial Health */}
        <ModernCard>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
              <Activity className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">
              Financial Health
            </h3>
          </div>
          <div className="space-y-6">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">Operating Margin</span>
                <span className="text-sm font-bold text-primary">
                  {summary.totalIncome > 0
                    ? (((summary.totalIncome - summary.totalExpenses) / summary.totalIncome) * 100).toFixed(1)
                    : '0.0'
                  }%
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-primary h-3 rounded-full transition-all duration-1000 ease-out"
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
              <div className="flex items-center gap-3 bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                <span className="text-sm font-semibold text-emerald-800">Healthy Financial Position</span>
              </div>
            </div>
          </div>
        </ModernCard>


      </div>

      {showLedger && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <ModernCard className="w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col !p-0 shadow-2xl">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Transaction Ledger</h2>
                <p className="text-sm text-gray-500">Comprehensive list of all financial records</p>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={ledgerFilter}
                  onChange={(e) => setLedgerFilter(e.target.value as typeof ledgerFilter)}
                  className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm font-medium"
                >
                  <option value="all">All Transactions</option>
                  <option value="income">Income Only</option>
                  <option value="expense">Expenses Only</option>
                  <option value="contribution">Contributions Only</option>
                </select>
                <ModernButton
                  onClick={() => setShowLedger(false)}
                  variant="secondary"
                  size="sm"
                >
                  Close
                </ModernButton>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-0">
              {ledgerLoading ? (
                <div className="py-20 text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
                  <p className="text-gray-500">Loading ledger data...</p>
                </div>
              ) : ledgerError ? (
                <div className="py-20 text-center text-red-600">{ledgerError}</div>
              ) : ledger.length === 0 ? (
                <div className="py-20 text-center text-gray-500">No transactions found matching your criteria.</div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">TXN ID</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Reason</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {(() => {
                      const filtered = ledger.filter((item) => ledgerFilter === 'all' || item.type === ledgerFilter);
                      const totalPages = Math.max(1, Math.ceil(filtered.length / ledgerPageSize));
                      const currentPage = Math.min(ledgerPage, totalPages);
                      const paged = filtered.slice((currentPage - 1) * ledgerPageSize, currentPage * ledgerPageSize);

                      return paged.map((item) => (
                        <tr
                          key={`${item.table}-${item.id}`}
                          className="hover:bg-gray-50 cursor-pointer transition-colors"
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
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {new Date(item.date).toLocaleString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-medium text-gray-900">{item.transactionId}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span
                              className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                                item.type === 'income'
                                  ? 'text-green-700 bg-green-50 border border-green-100'
                                  : item.type === 'expense'
                                  ? 'text-red-700 bg-red-50 border border-red-100'
                                  : 'text-blue-700 bg-blue-50 border border-blue-100'
                              }`}
                            >
                              {item.type === 'income' ? 'Income' : item.type === 'expense' ? 'Expense' : 'Contribution'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-700 max-w-xs truncate">{item.reason}</td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold text-right ${
                            item.type === 'expense' ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {item.type === 'expense' ? '-' : '+'}{formatCurrency(item.amount)}
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              )}
            </div>
            
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
               {(() => {
                const filtered = ledger.filter((item) => ledgerFilter === 'all' || item.type === ledgerFilter);
                const totalPages = Math.max(1, Math.ceil(filtered.length / ledgerPageSize));
                const currentPage = Math.min(ledgerPage, totalPages);
                
                return (
                  <>
                    <span className="text-sm text-gray-500 font-medium">
                      Page {currentPage} of {totalPages}
                    </span>
                    <div className="flex items-center gap-2">
                      <ModernButton
                        onClick={() => setLedgerPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        size="sm"
                        variant="outline"
                      >
                        Previous
                      </ModernButton>
                      <ModernButton
                        onClick={() => setLedgerPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage >= totalPages}
                        size="sm"
                        variant="outline"
                      >
                        Next
                      </ModernButton>
                    </div>
                  </>
                );
               })()}
            </div>
          </ModernCard>
        </div>
      )}
    </div>
  );
}
