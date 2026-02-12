import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  ShoppingBag,
  DollarSign,
  Settings,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  BarChart3,
  Users,
  Target
} from 'lucide-react';
import type { AccessLevel } from '../types/access';
import {
  fetchSalesMetrics,
  fetchAllTargetProgress,
} from '../lib/analytics';
import { fetchAllCustomersWithStats } from '../lib/sales';
import {
  fetchAllCurrentInventory,
  fetchOutOfStockItems,
  fetchLowStockItems,
  calculateInventoryMetrics,
} from '../lib/inventory-analytics';
import type { InventoryMetrics } from '../types/inventory-analytics';

interface AnalyticsProps {
  accessLevel: AccessLevel;
}

type AnalyticsSection = 'inventory' | 'sales' | 'finance' | 'admin';

export function Analytics({ accessLevel: _accessLevel }: AnalyticsProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<AnalyticsSection | null>(null);

  // Summary data
  const [inventoryMetrics, setInventoryMetrics] = useState<InventoryMetrics | null>(null);
  const [salesSummary, setSalesSummary] = useState<any>(null);
  const [customerCount, setCustomerCount] = useState(0);
  const [targetCount, setTargetCount] = useState(0);

  useEffect(() => {
    loadSummaryData();
  }, []);

  const loadSummaryData = async () => {
    setLoading(true);
    try {
      const [invMetrics, salesMetrics, customers, targets] = await Promise.all([
        calculateInventoryMetrics(),
        fetchSalesMetrics({ dateRange: 'month', viewMode: 'summary' }),
        fetchAllCustomersWithStats(),
        fetchAllTargetProgress(),
      ]);

      setInventoryMetrics(invMetrics);
      setSalesSummary(salesMetrics);
      setCustomerCount(customers.length);
      setTargetCount(targets.length);
    } catch (err) {
      console.error('Failed to load analytics summary:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-transparent">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-slate-600 font-medium animate-pulse">Loading analytics...</p>
        </div>
      </div>
    );
  }

  const sections = [
    {
      id: 'inventory' as AnalyticsSection,
      title: 'Inventory Analytics',
      description: 'Stock levels, consumption, and waste tracking',
      icon: Package,
      color: 'indigo',
      metrics: inventoryMetrics ? [
        { label: 'Total Items', value: inventoryMetrics.totalItems },
        { label: 'Out of Stock', value: inventoryMetrics.outOfStockCount, alert: inventoryMetrics.outOfStockCount > 0 },
        { label: 'Low Stock', value: inventoryMetrics.lowStockCount, alert: inventoryMetrics.lowStockCount > 0 },
        { label: 'Waste Rate', value: `${inventoryMetrics.wastePercentage.toFixed(1)}%` },
      ] : [],
    },
    {
      id: 'sales' as AnalyticsSection,
      title: 'Sales Analytics',
      description: 'Revenue, orders, and customer insights',
      icon: ShoppingBag,
      color: 'emerald',
      metrics: salesSummary ? [
        { label: 'Total Revenue', value: `₹${salesSummary.totalSalesValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` },
        { label: 'Total Orders', value: salesSummary.numberOfOrders },
        { label: 'Customers', value: customerCount },
        { label: 'Pending Payments', value: `₹${salesSummary.paymentPending.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, alert: salesSummary.paymentPending > 0 },
      ] : [],
    },
    {
      id: 'finance' as AnalyticsSection,
      title: 'Finance Analytics',
      description: 'Income, expenses, and cash flow analysis',
      icon: DollarSign,
      color: 'amber',
      metrics: [
        { label: 'Coming Soon', value: '-' },
      ],
    },
    {
      id: 'admin' as AnalyticsSection,
      title: 'Admin & Targets',
      description: 'Goals, targets, and performance tracking',
      icon: Settings,
      color: 'rose',
      metrics: [
        { label: 'Active Targets', value: targetCount },
        { label: 'Coming Soon', value: '-' },
      ],
    },
  ];

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-8 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Analytics & Reports</h1>
        <p className="mt-2 text-slate-500 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          Comprehensive business intelligence and decision support
        </p>
      </div>

      {/* Analytics Sections Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sections.map((section) => {
          const colorClasses = {
            indigo: 'from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700',
            emerald: 'from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700',
            amber: 'from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700',
            rose: 'from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700',
          };

          return (
            <button
              key={section.id}
              onClick={() => {
                if (section.id === 'inventory') {
                  navigate('/analytics/inventory');
                } else {
                  // Future: navigate to other sections
                  setActiveSection(section.id);
                }
              }}
              className="group relative bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-xl transition-all duration-300 text-left overflow-hidden"
            >
              {/* Background Gradient */}
              <div className={`absolute inset-0 bg-gradient-to-br ${colorClasses[section.color as keyof typeof colorClasses]} opacity-0 group-hover:opacity-5 transition-opacity duration-300`}></div>

              {/* Content */}
              <div className="relative z-10">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${colorClasses[section.color as keyof typeof colorClasses]} text-white shadow-lg`}>
                    <section.icon className="w-6 h-6" />
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-slate-600 group-hover:translate-x-1 transition-all" />
                </div>

                {/* Title & Description */}
                <h3 className="text-xl font-bold text-slate-900 mb-2">{section.title}</h3>
                <p className="text-sm text-slate-500 mb-6">{section.description}</p>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-3">
                  {section.metrics.map((metric, idx) => (
                    <div key={idx} className="bg-slate-50 rounded-lg p-3 group-hover:bg-white transition-colors">
                      <p className="text-xs text-slate-500 mb-1">{metric.label}</p>
                      <p className={`text-lg font-bold ${metric.alert ? 'text-rose-600' : 'text-slate-900'}`}>
                        {metric.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
