import React, { useEffect, useState } from 'react';
import {
  Package,
  AlertTriangle,
  TrendingDown,
  BarChart3,
  Download,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  Calendar,
  Layers
} from 'lucide-react';
import type { AccessLevel } from '../types/access';
import type {
  CurrentInventoryByTag,
  OutOfStockItem,
  LowStockItem,
  ConsumptionSummary,
  InventoryAnalyticsFilters,
  InventoryMetrics,
  InventoryType,
  RawMaterialLotDetail,
  RecurringProductLotDetail,
  ProcessedGoodsBatchDetail,
} from '../types/inventory-analytics';
import {
  fetchAllCurrentInventory,
  fetchOutOfStockItems,
  fetchLowStockItems,
  fetchConsumptionByType,
  fetchConsumptionRawMaterials,
  fetchConsumptionRecurringProducts,
  fetchConsumptionProducedGoods,
  calculateInventoryMetrics,
  fetchRawMaterialLotDetails,
  fetchRecurringProductLotDetails,
  fetchProcessedGoodsBatchDetails,
  fetchNewStockArrivals,
  fetchConsumptionDetails,
  type ConsumptionDetail
} from '../lib/inventory-analytics';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { pdf } from '@react-pdf/renderer';
import { InventoryReportPDF, type PDFInventoryItem } from '../components/InventoryReportPDF';
import { ModernCard } from '../components/ui/ModernCard';
import { ModernButton } from '../components/ui/ModernButton';

interface InventoryAnalyticsProps {
  accessLevel: AccessLevel;
}

export function InventoryAnalytics({ accessLevel: _accessLevel }: InventoryAnalyticsProps) {
  // Helper function to format dates consistently
  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  // Month-Year state (defaults to current month)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // Tag filter for consumption (defaults to null = all tags)
  const [selectedConsumptionTag, setSelectedConsumptionTag] = useState<string | null>(null);

  const [filters, setFilters] = useState<InventoryAnalyticsFilters>({
    inventoryType: 'raw_material', // Default to raw materials
  });
  const [loading, setLoading] = useState(true);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [activeTab, setActiveTab] = useState<'current' | 'outofstock' | 'lowstock' | 'consumption'>('current');

  // Data states
  const [currentInventory, setCurrentInventory] = useState<{ type: InventoryType; data: CurrentInventoryByTag[] }[]>([]);
  const [outOfStockItems, setOutOfStockItems] = useState<OutOfStockItem[]>([]);
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [consumptionData, setConsumptionData] = useState<ConsumptionSummary[]>([]);
  const [metrics, setMetrics] = useState<InventoryMetrics | null>(null);
  const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set());

  // Lot/Batch details states
  const [tagDetails, setTagDetails] = useState<Record<string, any[]>>({});
  const [loadingDetails, setLoadingDetails] = useState<Set<string>>(new Set());

  // Consumption details states
  const [consumptionDetails, setConsumptionDetails] = useState<Record<string, ConsumptionDetail[]>>({});
  const [loadingConsumptionDetails, setLoadingConsumptionDetails] = useState<Set<string>>(new Set());
  const [expandedConsumptionDates, setExpandedConsumptionDates] = useState<Set<string>>(new Set());
  
  // Report dropdown state
  const [showReportDropdown, setShowReportDropdown] = useState(false);

  // Month navigation functions
  const goToPreviousMonth = () => {
    setSelectedMonth(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() - 1);
      return newDate;
    });
  };

  const goToNextMonth = () => {
    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    setSelectedMonth(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + 1);

      if (newDate > currentMonth) {
        return prev;
      }
      return newDate;
    });
  };

  const isCurrentMonth = () => {
    const now = new Date();
    return selectedMonth.getFullYear() === now.getFullYear() &&
      selectedMonth.getMonth() === now.getMonth();
  };

  useEffect(() => {
    loadInventoryAnalytics();
  }, [filters, selectedMonth]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showReportDropdown && !target.closest('.report-dropdown-container')) {
        setShowReportDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showReportDropdown]);

  const loadInventoryAnalytics = async () => {
    setLoading(true);
    try {
      const dateFilters = getDateFilters();
      const fullFilters = { ...filters, ...dateFilters };

      // Load consumption data for all types or specific type
      const consumptionPromise = filters.inventoryType
        ? fetchConsumptionByType(filters.inventoryType, fullFilters)
        : Promise.all([
          fetchConsumptionRawMaterials(fullFilters),
          fetchConsumptionRecurringProducts(fullFilters),
          fetchConsumptionProducedGoods(fullFilters),
        ]).then((results) => results.flat());

      const [inventory, outOfStock, lowStock, consumption, metricsData] = await Promise.all([
        fetchAllCurrentInventory(fullFilters),
        fetchOutOfStockItems(fullFilters),
        fetchLowStockItems(fullFilters),
        consumptionPromise,
        calculateInventoryMetrics(fullFilters),
      ]);

      setCurrentInventory(inventory);
      setOutOfStockItems(outOfStock);
      setLowStockItems(lowStock);
      setConsumptionData(consumption);
      setMetrics(metricsData);
    } catch (err) {
      console.error('Failed to load inventory analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const getDateFilters = () => {
    // Get first and last day of selected month
    const startDate = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1);
    const endDate = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0);

    return {
      startDate: filters.startDate || startDate.toISOString().split('T')[0],
      endDate: filters.endDate || endDate.toISOString().split('T')[0],
    };
  };

  const updateFilter = <K extends keyof InventoryAnalyticsFilters>(
    key: K,
    value: InventoryAnalyticsFilters[K]
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleExportReport = async (reportType?: InventoryType) => {
    setIsGeneratingReport(true);
    setShowReportDropdown(false);
    try {
      const dateFilters = getDateFilters();
      const periodLabel = `${new Date(dateFilters.startDate || '').toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })} - ${new Date(dateFilters.endDate || '').toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}`;

      // Create filters for the specific report type
      const reportFilters = reportType 
        ? { ...filters, inventoryType: reportType, ...dateFilters }
        : { ...filters, ...dateFilters };

      // Fetch data specifically for this report type
      const [reportInventoryData, reportOutOfStock, reportLowStock] = await Promise.all([
        fetchAllCurrentInventory(reportFilters),
        fetchOutOfStockItems(reportFilters),
        fetchLowStockItems(reportFilters),
      ]);

      // Fetch consumption data for the report type
      const reportConsumption = reportType
        ? await fetchConsumptionByType(reportType, reportFilters)
        : await Promise.all([
            fetchConsumptionRawMaterials(reportFilters),
            fetchConsumptionRecurringProducts(reportFilters),
            fetchConsumptionProducedGoods(reportFilters),
          ]).then((results) => results.flat());

      // Fetch new stock arrivals for the period
      const newStockArrivals = await fetchNewStockArrivals(
        dateFilters.startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
        dateFilters.endDate || new Date().toISOString(),
        reportType // Pass the specific type or undefined for all
      );

      // Fetch detailed lot/batch information for all tags
      const rawMaterialsData = reportInventoryData.find((inv) => inv.type === 'raw_material')?.data || [];
      const recurringProductsData = reportInventoryData.find((inv) => inv.type === 'recurring_product')?.data || [];
      const producedGoodsData = reportInventoryData.find((inv) => inv.type === 'produced_goods')?.data || [];

      // Fetch all raw material lots (fetch all lots for each unique tag, regardless of usable/unusable)
      const allRawMaterialLots: any[] = [];
      const processedTagIds = new Set<string>();

      for (const tag of rawMaterialsData) {
        // Skip if we already processed this tag_id (to avoid duplicates from usable/unusable split)
        if (processedTagIds.has(tag.tag_id)) continue;
        processedTagIds.add(tag.tag_id);

        try {
          // Fetch ALL lots for this tag (don't filter by usable)
          const lots = await fetchRawMaterialLotDetails(tag.tag_id);
          lots.forEach(lot => {
            allRawMaterialLots.push({
              tag_name: tag.tag_name,
              tag_id: tag.tag_id,
              ...lot
            });
          });
        } catch (error) {
          console.error(`Failed to fetch lots for tag ${tag.tag_name}:`, error);
        }
      }

      // Fetch all recurring product lots
      const allRecurringLots: any[] = [];
      for (const tag of recurringProductsData) {
        try {
          const lots = await fetchRecurringProductLotDetails(tag.tag_id);
          lots.forEach(lot => {
            allRecurringLots.push({
              tag_name: tag.tag_name,
              tag_id: tag.tag_id,
              ...lot
            });
          });
        } catch (error) {
          console.error(`Failed to fetch lots for tag ${tag.tag_name}:`, error);
        }
      }

      // Fetch all produced goods batches
      const allBatches: any[] = [];
      for (const tag of producedGoodsData) {
        try {
          const batches = await fetchProcessedGoodsBatchDetails(tag.tag_id);
          batches.forEach(batch => {
            allBatches.push({
              tag_name: tag.tag_name,
              tag_id: tag.tag_id,
              ...batch
            });
          });
        } catch (error) {
          console.error(`Failed to fetch batches for tag ${tag.tag_name}:`, error);
        }
      }

      // Prepare flattened inventory data for report
      const reportInventory: PDFInventoryItem[] = reportInventoryData.flatMap(group =>
        group.data.map(item => ({
          ...item,
          inventory_type: group.type,
          last_activity_date: item.last_movement_date || item.last_production_date
        }))
      );

      console.log('PDF Export Data:', {
        rawMaterialLots: allRawMaterialLots.length,
        recurringLots: allRecurringLots.length,
        batches: allBatches.length,
        reportType: reportType,
        outOfStock: reportOutOfStock.length,
        lowStock: reportLowStock.length,
        consumption: reportConsumption.length
      });

      // Create filters with the specific report type
      const pdfFilters = reportType ? { ...filters, inventoryType: reportType } : filters;

      const blob = await pdf(
        <InventoryReportPDF
          currentInventory={reportInventory}
          outOfStockItems={reportOutOfStock}
          lowStockItems={reportLowStock}
          consumptionData={reportConsumption}
          newStockArrivals={newStockArrivals}
          rawMaterialLots={allRawMaterialLots}
          recurringProductLots={allRecurringLots}
          producedGoodsBatches={allBatches}
          filters={pdfFilters}
          periodLabel={periodLabel}
        />
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Generate filename based on report type
      const typeLabel = reportType 
        ? reportType === 'raw_material' ? 'Raw_Materials'
          : reportType === 'recurring_product' ? 'Recurring_Products'
          : 'Produced_Goods'
        : 'All_Inventory';
      link.download = `${typeLabel}_Report_${new Date().toISOString().split('T')[0]}.pdf`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to generate report:', error);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // Toggle tag expansion and fetch lot/batch details
  const toggleTagExpansion = async (tagId: string, inventoryType: InventoryType, usable?: boolean) => {
    const key = usable !== undefined ? `${tagId}-${usable}` : tagId;

    if (expandedTags.has(key)) {
      // Collapse
      setExpandedTags(prev => {
        const newSet = new Set(prev);
        newSet.delete(key);
        return newSet;
      });
    } else {
      // Expand and fetch details if not already loaded
      setExpandedTags(prev => new Set(prev).add(key));

      if (!tagDetails[key]) {
        setLoadingDetails(prev => new Set(prev).add(key));
        try {
          let details: any[] = [];

          if (inventoryType === 'raw_material') {
            details = await fetchRawMaterialLotDetails(tagId, usable);
          } else if (inventoryType === 'recurring_product') {
            details = await fetchRecurringProductLotDetails(tagId);
          } else if (inventoryType === 'produced_goods') {
            details = await fetchProcessedGoodsBatchDetails(tagId);
          }

          setTagDetails(prev => ({ ...prev, [key]: details }));
        } catch (error) {
          console.error('Failed to load tag details:', error);
        } finally {
          setLoadingDetails(prev => {
            const newSet = new Set(prev);
            newSet.delete(key);
            return newSet;
          });
        }
      }
    }
  };

  // Toggle consumption date expansion and fetch consumption details
  const toggleConsumptionDateExpansion = async (tagId: string, date: string, inventoryType: InventoryType) => {
    const key = `${tagId}-${date}`;

    if (expandedConsumptionDates.has(key)) {
      // Collapse
      setExpandedConsumptionDates(prev => {
        const newSet = new Set(prev);
        newSet.delete(key);
        return newSet;
      });
    } else {
      // Expand and fetch details if not already loaded
      setExpandedConsumptionDates(prev => new Set(prev).add(key));

      if (!consumptionDetails[key]) {
        setLoadingConsumptionDetails(prev => new Set(prev).add(key));
        try {
          const details = await fetchConsumptionDetails(tagId, date, inventoryType);
          setConsumptionDetails(prev => ({ ...prev, [key]: details }));
        } catch (error) {
          console.error('Failed to load consumption details:', error);
        } finally {
          setLoadingConsumptionDetails(prev => {
            const newSet = new Set(prev);
            newSet.delete(key);
            return newSet;
          });
        }
      }
    }
  };

  // Prepare chart data
  const currentInventoryChartData = currentInventory
    .filter((inv) => !filters.inventoryType || inv.type === filters.inventoryType)
    .flatMap((inv) =>
      inv.data.map((item) => ({
        tag_name: item.tag_name,
        value: item.current_balance,
        type: inv.type as InventoryType,
        usable: item.usable,
      }))
    );

  // Prepare consumption trend data
  const consumptionTrendData = consumptionData
    .filter((item) => !selectedConsumptionTag || item.tag_id === selectedConsumptionTag)
    .reduce((acc: any[], item) => {
      const existing = acc.find((d: any) => d.date === item.consumption_date);
      if (existing) {
        existing.consumed += item.total_consumed || 0;
        existing.wasted += item.total_wasted || 0;
      } else {
        acc.push({
          date: item.consumption_date,
          consumed: item.total_consumed || 0,
          wasted: item.total_wasted || 0,
        });
      }
      return acc;
    }, []);

  // Get unique tags from consumption data for the dropdown
  const availableTags = Array.from(
    new Map(
      consumptionData.map((item) => [item.tag_id, { id: item.tag_id, name: item.tag_name }])
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name));

  // Helper function to render lot/batch details (Desktop Table Row)
  const renderTagDetails = (key: string, inventoryType: InventoryType) => {
    const details = tagDetails[key];
    const isLoading = loadingDetails.has(key);

    if (isLoading) {
      return (
        <tr>
          <td colSpan={6} className="px-0 py-0 text-center border-b border-slate-100 bg-slate-50/30">
            <div className="py-8 flex flex-col items-center justify-center gap-3 text-slate-500">
              <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm font-medium">Fetching details...</span>
            </div>
          </td>
        </tr>
      );
    }

    if (!details || details.length === 0) {
      return (
        <tr>
          <td colSpan={6} className="px-0 py-0 border-b border-slate-100 bg-slate-50/30">
            <div className="py-8 text-center">
              <p className="text-sm text-slate-400 italic">No specific lot or batch details available.</p>
            </div>
          </td>
        </tr>
      );
    }

    const TableHeader = ({ children }: { children: React.ReactNode }) => (
      <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-left border-b border-slate-200 bg-slate-50First">
        {children}
      </th>
    );

    const TableCell = ({ children, className = '', align = 'left', ...props }: { children: React.ReactNode, className?: string, align?: 'left' | 'right' | 'center', [key: string]: any }) => (
      <td
        className={`px-4 py-3 text-sm text-slate-600 border-b border-slate-100 last:border-0 ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'} ${className}`}
        {...props}
      >
        {children}
      </td>
    );

    return (
      <tr>
        <td colSpan={6} className="px-0 py-0 bg-slate-50/30 border-b border-slate-100">
          <div className="py-4 px-12"> {/* Indented to align with content, skipping the arrow column */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
              {/* Optional Header for the Card */}
              <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  {inventoryType === 'produced_goods' ? 'Batch Breakdown' : 'Lot Breakdown'}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      {inventoryType === 'raw_material' && (
                        <>
                          <TableHeader>Lot ID</TableHeader>
                          <TableHeader>Name</TableHeader>
                          <TableHeader>Available</TableHeader>
                          <TableHeader>Received</TableHeader>
                          <TableHeader>Supplier</TableHeader>
                          <TableHeader>Notes</TableHeader>
                        </>
                      )}
                      {inventoryType === 'recurring_product' && (
                        <>
                          <TableHeader>Lot ID</TableHeader>
                          <TableHeader>Name</TableHeader>
                          <TableHeader>Available</TableHeader>
                          <TableHeader>Received</TableHeader>
                          <TableHeader>Supplier</TableHeader>
                          <TableHeader>Collected By</TableHeader>
                        </>
                      )}
                      {inventoryType === 'produced_goods' && (
                        <>
                          <TableHeader>Batch ID</TableHeader>
                          <TableHeader>Production Date</TableHeader>
                          <TableHeader>Created Qty</TableHeader>
                          <TableHeader>Available Qty</TableHeader>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {details.map((detail) => {
                      if (inventoryType === 'raw_material') {
                        const d = detail as RawMaterialLotDetail;
                        return (
                          <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                            <TableCell className="font-mono text-slate-500 text-xs">
                              <div className="flex items-center gap-2">
                                {d.lot_id}
                                {d.is_archived && (
                                  <span className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-500 rounded">
                                    ARCHIVED
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="font-medium text-slate-900">{d.name}</TableCell>
                            <TableCell className="font-bold text-emerald-600">{d.quantity_available.toFixed(2)} <span className="text-xs font-normal text-slate-500 ml-1">{d.unit}</span></TableCell>
                            <TableCell>{formatDate(d.received_date)}</TableCell>
                            <TableCell>{d.supplier_name || <span className="text-slate-400">-</span>}</TableCell>
                            <TableCell className="italic text-slate-400 max-w-[200px] truncate" title={d.storage_notes || ''}>{d.storage_notes || '-'}</TableCell>
                          </tr>
                        );
                      }
                      if (inventoryType === 'recurring_product') {
                        const d = detail as RecurringProductLotDetail;
                        return (
                          <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                            <TableCell className="font-mono text-slate-500 text-xs">
                              <div className="flex items-center gap-2">
                                {d.lot_id}
                                {d.is_archived && (
                                  <span className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-500 rounded">
                                    ARCHIVED
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="font-medium text-slate-900">{d.name}</TableCell>
                            <TableCell className="font-bold text-indigo-600">{d.quantity_available.toFixed(2)} <span className="text-xs font-normal text-slate-500 ml-1">{d.unit}</span></TableCell>
                            <TableCell>{formatDate(d.received_date)}</TableCell>
                            <TableCell>{d.supplier_name || <span className="text-slate-400">-</span>}</TableCell>
                            <TableCell>{d.collected_by_name || <span className="text-slate-400">-</span>}</TableCell>
                          </tr>
                        );
                      }
                      if (inventoryType === 'produced_goods') {
                        const d = detail as ProcessedGoodsBatchDetail;
                        return (
                          <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                            <TableCell className="title-font font-medium text-slate-900">
                              <div className="flex items-center gap-2">
                                {d.batch_name}
                                {d.is_archived && (
                                  <span className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-500 rounded">
                                    ARCHIVED
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{formatDate(d.production_date)}</TableCell>
                            <TableCell>{d.quantity_created.toFixed(2)} <span className="text-xs text-slate-500">{d.unit}</span></TableCell>
                            <TableCell className="font-bold text-emerald-600">{d.quantity_available.toFixed(2)} <span className="text-xs font-normal text-slate-500 ml-1">{d.unit}</span></TableCell>
                          </tr>
                        );
                      }
                      return null;
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </td>
      </tr>
    );
  };

  // Helper for Mobile Card Views to render details
  const renderMobileDetails = (key: string, inventoryType: InventoryType) => {
    const details = tagDetails[key];
    const isLoading = loadingDetails.has(key);

    if (isLoading) {
      return <div className="p-4 text-center text-xs text-slate-500">Loading details...</div>;
    }
    if (!details || details.length === 0) {
      return <div className="p-4 text-center text-xs text-slate-400 italic">No details available</div>;
    }

    if (inventoryType === 'raw_material') {
      const rawDetails = details as RawMaterialLotDetail[];
      return (
        <div className="space-y-2 mt-2">
          {rawDetails.map(d => (
            <div key={d.id} className="bg-slate-50 rounded-lg p-3 text-xs border border-slate-100">
              <div className="flex justify-between items-start mb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-medium text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">{d.lot_id}</span>
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${d.usable ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {d.usable ? 'Usable' : 'Unusable'}
                  </span>
                  {d.is_archived && (
                    <span className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-200 text-slate-600 rounded">
                      ARCHIVED
                    </span>
                  )}
                </div>
                <span className="font-bold text-slate-700">{d.quantity_available.toFixed(2)} {d.unit}</span>
              </div>
              <div className="flex justify-between text-slate-500 mb-1">
                <span>{formatDate(d.received_date)}</span>
                <span className="truncate max-w-[120px]">{d.supplier_name || 'N/A'}</span>
              </div>
              {d.collected_by_name && (
                <div className="text-slate-500 text-xs">
                  <span className="text-slate-400">Collected by:</span> {d.collected_by_name}
                </div>
              )}
              {d.storage_notes && <div className="text-slate-400 italic border-t border-slate-100 pt-1 mt-1">{d.storage_notes}</div>}
            </div>
          ))}
        </div>
      );
    }
    if (inventoryType === 'recurring_product') {
      const recurringDetails = details as RecurringProductLotDetail[];
      return (
        <div className="space-y-2 mt-2">
          {recurringDetails.map(d => (
            <div key={d.id} className="bg-slate-50 rounded-lg p-3 text-xs border border-slate-100">
              <div className="flex justify-between items-start mb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-medium text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">{d.lot_id}</span>
                  {d.is_archived && (
                    <span className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-200 text-slate-600 rounded">
                      ARCHIVED
                    </span>
                  )}
                </div>
                <span className="font-bold text-slate-700">{d.quantity_available.toFixed(2)} {d.unit}</span>
              </div>
              <div className="flex justify-between text-slate-500 mb-1">
                <span>{formatDate(d.received_date)}</span>
                <span className="font-medium">{d.name}</span>
              </div>
              <div className="flex justify-between text-slate-500 text-xs">
                <span className="truncate max-w-[120px]">{d.supplier_name || 'N/A'}</span>
                {d.collected_by_name && (
                  <span className="text-slate-400">By: {d.collected_by_name}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (inventoryType === 'produced_goods') {
      const batchDetails = details as ProcessedGoodsBatchDetail[];
      return (
        <div className="space-y-2 mt-2">
          {batchDetails.map(d => (
            <div key={d.id} className="bg-slate-50 rounded-lg p-3 text-xs border border-slate-100">
              <div className="flex justify-between items-start mb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-slate-700">{d.batch_name}</span>
                  {d.is_archived && (
                    <span className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-200 text-slate-600 rounded">
                      ARCHIVED
                    </span>
                  )}
                </div>
                <span className="font-bold text-emerald-600">{d.quantity_available.toFixed(2)} {d.unit}</span>
              </div>
              <div className="flex justify-between text-slate-500 mb-1">
                <span>Prod: {formatDate(d.production_date)}</span>
                <span>Created: {d.quantity_created.toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>
      );
    }

    return null;
  };

  const InventoryTypeButton = ({ type, label, icon: Icon, color }: { type: InventoryType, label: string, icon: any, color: 'blue' | 'purple' | 'emerald' }) => {
    const isActive = filters.inventoryType === type;
    const colorStyles = {
      blue: isActive ? 'bg-blue-600 text-white shadow-blue-200' : 'bg-white text-slate-600 hover:bg-blue-50 border-slate-200',
      purple: isActive ? 'bg-purple-600 text-white shadow-purple-200' : 'bg-white text-slate-600 hover:bg-purple-50 border-slate-200',
      emerald: isActive ? 'bg-emerald-600 text-white shadow-emerald-200' : 'bg-white text-slate-600 hover:bg-emerald-50 border-slate-200',
    };

    return (
      <button
        onClick={() => updateFilter('inventoryType', type)}
        className={`flex flex-col sm:flex-row items-center justify-center gap-2 px-4 py-3 rounded-xl border transition-all duration-200 shadow-sm ${isActive ? 'shadow-lg border-transparent' : ''} ${colorStyles[color]}`}
      >
        <Icon className={`w-5 h-5 ${!isActive && 'opacity-60'}`} />
        <span className="font-medium text-sm sm:text-base">{label}</span>
      </button>
    );
  };

  const MetricCard = ({ title, value, icon: Icon, color, subtext }: { title: string, value: string | number, icon: any, color: 'indigo' | 'rose' | 'amber' | 'emerald', subtext: string }) => {
    const colorStyles = {
      indigo: 'bg-indigo-50 text-indigo-600',
      rose: 'bg-rose-50 text-rose-600',
      amber: 'bg-amber-50 text-amber-600',
      emerald: 'bg-emerald-50 text-emerald-600',
    };
    return (
      <ModernCard padding="sm" className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className={`p-2.5 rounded-xl ${colorStyles[color]}`}>
            <Icon className="w-5 h-5" />
          </div>
          <span className="text-2xl font-bold text-slate-900 tracking-tight">{value}</span>
        </div>
        <div>
          <p className="text-sm font-medium text-slate-600">{title}</p>
          <p className="text-xs text-slate-400 mt-0.5">{subtext}</p>
        </div>
      </ModernCard>
    );
  };

  if (loading && !metrics) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-slate-600 font-medium animate-pulse">Analyzing Inventory...</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 pb-20 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Inventory Analytics</h1>
          <p className="text-slate-500 text-sm mt-1">Real-time tracking of stock levels and consumption.</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Month Selector */}
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2">
            <button
              onClick={goToPreviousMonth}
              className="p-1 hover:bg-slate-100 rounded transition-colors"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            </button>
            <span className="text-sm font-medium text-slate-700 min-w-[100px] text-center">
              {selectedMonth.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </span>
            <button
              onClick={goToNextMonth}
              disabled={isCurrentMonth()}
              className="p-1 hover:bg-slate-100 rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </button>
          </div>
          <div className="relative report-dropdown-container">
            <ModernButton
              onClick={() => setShowReportDropdown(!showReportDropdown)}
              icon={isGeneratingReport ? undefined : <Download className="w-4 h-4" />}
              variant="ghost"
              className="bg-white border border-slate-200"
              disabled={loading || isGeneratingReport}
            >
              {isGeneratingReport ? 'Generating...' : 'Generate Report'}
            </ModernButton>
            
            {showReportDropdown && !isGeneratingReport && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-slate-200 py-2 z-50">
                <button
                  onClick={() => handleExportReport()}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 transition-colors flex items-center gap-2"
                >
                  <Download className="w-4 h-4 text-slate-600" />
                  <span>All Inventory Types</span>
                </button>
                <div className="border-t border-slate-100 my-1"></div>
                <button
                  onClick={() => handleExportReport('raw_material')}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 transition-colors flex items-center gap-2"
                >
                  <Layers className="w-4 h-4 text-blue-600" />
                  <span>Raw Materials Only</span>
                </button>
                <button
                  onClick={() => handleExportReport('recurring_product')}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 transition-colors flex items-center gap-2"
                >
                  <Package className="w-4 h-4 text-purple-600" />
                  <span>Recurring Products Only</span>
                </button>
                <button
                  onClick={() => handleExportReport('produced_goods')}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 transition-colors flex items-center gap-2"
                >
                  <Package className="w-4 h-4 text-emerald-600" />
                  <span>Produced Goods Only</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Inventory Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <InventoryTypeButton type="raw_material" label="Raw Materials" icon={Layers} color="blue" />
        <InventoryTypeButton type="recurring_product" label="Recurring Products" icon={Package} color="purple" />
        <InventoryTypeButton type="produced_goods" label="Produced Goods" icon={Package} color="emerald" />
      </div>

      {/* Metrics Grid */}
      {metrics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <MetricCard
            title="Total Items"
            value={metrics.totalItems}
            icon={Package}
            color="indigo"
            subtext="Unique Tags"
          />
          <MetricCard
            title="Out of Stock"
            value={metrics.outOfStockCount}
            icon={AlertTriangle}
            color="rose"
            subtext="Needs Reordering"
          />
          <MetricCard
            title="Low Stock"
            value={metrics.lowStockCount}
            icon={TrendingDown}
            color="amber"
            subtext="Below Threshold"
          />
          <MetricCard
            title="Waste Rate"
            value={`${metrics.wastePercentage.toFixed(1)}%`}
            icon={BarChart3}
            color="emerald"
            subtext="This Month"
          />
        </div>
      )}

      {/* Main Tabs Navigation */}
      <div className="flex p-1 bg-slate-100/80 rounded-xl overflow-x-auto whitespace-nowrap gap-1">
        {[
          { id: 'current', label: 'Current Stock' },
          { id: 'outofstock', label: 'Out of Stock' },
          { id: 'lowstock', label: 'Low Stock' },
          { id: 'consumption', label: 'Consumption Analysis' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${activeTab === tab.id
              ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content Area */}
      <div className="animate-fade-in">

        {/* Current Inventory Tab */}
        {activeTab === 'current' && (
          <div className="space-y-6">
            {/* Visual Chart */}
            {currentInventoryChartData.length > 0 && (
              <ModernCard>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <h3 className="font-bold text-slate-800">Stock Distribution</h3>
                  <div className="flex items-center gap-4 text-xs sm:text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-indigo-600"></div>
                      <span className="text-slate-600 font-medium">Usable Stock</span>
                    </div>
                    {filters.inventoryType === 'raw_material' && (
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-amber-600"></div>
                        <span className="text-slate-600 font-medium">Unusable Stock</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="h-[300px] sm:h-[400px] w-full overflow-x-auto pb-2 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300/80 [&::-webkit-scrollbar-track]:bg-slate-50">
                  <div className="min-w-[800px] lg:min-w-full h-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={currentInventoryChartData.slice(0, 20)} margin={{ bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis
                          dataKey="tag_name"
                          tick={({ x, y, payload }) => (
                            <g transform={`translate(${x},${y})`}>
                              <foreignObject x={-50} y={0} width={100} height={60}>
                                <div className="text-[10px] text-slate-500 text-center leading-tight break-words pt-2">
                                  {payload.value}
                                </div>
                              </foreignObject>
                            </g>
                          )}
                          interval={0}
                          height={70}
                        />
                        <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <Tooltip
                          cursor={{ fill: '#f8fafc' }}
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.1)' }}
                        />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                          {currentInventoryChartData.slice(0, 20).map((entry: any, index: number) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={entry.usable === false ? '#d97706' : '#4f46e5'}
                            />
                          ))}
                        </Bar>
                        <Legend />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </ModernCard>
            )}

            {/* Stock List */}
            {currentInventory
              .filter((inv) => !filters.inventoryType || inv.type === filters.inventoryType)
              .map((inv) => {
                // Separate usable/unusable for raw materials
                const sections = inv.type === 'raw_material'
                  ? [
                    { title: 'Usable Materials', items: inv.data.filter(i => i.usable !== false), color: 'emerald' },
                    { title: 'Unusable Materials', items: inv.data.filter(i => i.usable === false), color: 'amber' }
                  ]
                  : [{ title: `${inv.type.replace('_', ' ')} Stock`, items: inv.data, color: 'indigo' }];

                return sections.map((section, idx) => {
                  if (section.items.length === 0) return null;
                  const SectionIcon = inv.type === 'raw_material' ? Layers : Package;

                  return (
                    <div key={`${inv.type}-${idx}`} className="space-y-4">
                      <div className="flex items-center gap-2 px-2">
                        <div className={`p-1.5 rounded-lg bg-${section.color}-100 text-${section.color}-700`}>
                          <SectionIcon className="w-4 h-4" />
                        </div>
                        <h3 className="font-bold text-slate-800">{section.title}</h3>
                        <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{section.items.length}</span>
                      </div>

                      <ModernCard padding="none" className="overflow-hidden bg-white">
                        {/* Desktop Table */}
                        <div className="hidden lg:block overflow-x-auto">
                          <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-medium">
                              <tr>
                                <th className="px-6 py-4 w-10"></th>
                                <th className="px-6 py-4">Tag Name</th>
                                <th className="px-6 py-4 text-right">Current Balance</th>
                                <th className="px-6 py-4 text-right">Unit</th>
                                <th className="px-6 py-4 text-right">Lots/Batches</th>
                                <th className="px-6 py-4 text-right">Last Activity</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {section.items.map((item) => {
                                const key = inv.type === 'raw_material' ? `${item.tag_id}-${item.usable}` : item.tag_id;
                                const isExpanded = expandedTags.has(key);
                                return (
                                  <>
                                    <tr
                                      key={key}
                                      onClick={() => toggleTagExpansion(item.tag_id, inv.type as InventoryType, item.usable)}
                                      className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                                    >
                                      <td className="px-6 py-4">
                                        <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-90 text-indigo-500' : ''}`} />
                                      </td>
                                      <td className="px-6 py-4 font-medium text-slate-900 group-hover:text-indigo-600 transition-colors">{item.tag_name}</td>
                                      <td className="px-6 py-4 text-right font-semibold text-slate-700">{item.current_balance.toFixed(2)}</td>
                                      <td className="px-6 py-4 text-right text-slate-500">{item.default_unit}</td>
                                      <td className="px-6 py-4 text-right text-slate-600 bg-slate-50/50 m-1 rounded-lg">{item.item_count}</td>
                                      <td className="px-6 py-4 text-right text-slate-500 whitespace-nowrap">{formatDate(item.last_movement_date || item.last_production_date)}</td>
                                    </tr>
                                    {isExpanded && renderTagDetails(key, inv.type as InventoryType)}
                                  </>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* Mobile Cards */}
                        <div className="lg:hidden divide-y divide-slate-100">
                          {section.items.map((item) => {
                            const key = inv.type === 'raw_material' ? `${item.tag_id}-${item.usable}` : item.tag_id;
                            const isExpanded = expandedTags.has(key);
                            return (
                              <div key={key} className="p-4 bg-white hover:bg-slate-50/50 transition-colors" onClick={() => toggleTagExpansion(item.tag_id, inv.type as InventoryType, item.usable)}>
                                <div className="flex justify-between items-start mb-2">
                                  <div>
                                    <h4 className="font-bold text-slate-900">{item.tag_name}</h4>
                                    <p className="text-xs text-slate-500 mt-0.5">{inv.type.replace('_', ' ')}</p>
                                  </div>
                                  <div className="text-right">
                                    <span className="block text-lg font-bold text-indigo-600">{item.current_balance.toFixed(2)} <span className="text-sm font-normal text-slate-500">{item.default_unit}</span></span>
                                  </div>
                                </div>
                                <div className="flex justify-between items-center text-sm text-slate-600 mt-3 bg-slate-50 p-2 rounded-lg">
                                  <span>{item.item_count} Lots</span>
                                  <span className="text-xs text-slate-400">Last: {formatDate(item.last_movement_date || item.last_production_date)}</span>
                                </div>
                                <div className="mt-2 text-center">
                                  {isExpanded ? (
                                    <>
                                      <div className="border-t border-slate-100 mt-2 mb-2"></div>
                                      {renderMobileDetails(key, inv.type as InventoryType)}
                                      <ChevronDown className="w-4 h-4 text-slate-300 mx-auto mt-2" />
                                    </>
                                  ) : (
                                    <ChevronDown className="w-4 h-4 text-slate-300 mx-auto" />
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </ModernCard>
                    </div>
                  );
                });
              })
            }
          </div>
        )}

        {/* Out of Stock Tab */}
        {activeTab === 'outofstock' && (
          <ModernCard padding="none" className="overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center gap-2 text-rose-600 bg-rose-50/30">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-bold">Critically Low / Out of Stock</h3>
            </div>
            {outOfStockItems.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Package className="w-8 h-8" />
                </div>
                <p className="text-lg font-medium text-slate-600">All Stocked Up!</p>
                <p className="text-sm">No items are currently out of stock.</p>
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-medium">
                      <tr>
                        <th className="px-6 py-4">Tag Name</th>
                        <th className="px-6 py-4">Inventory Type</th>
                        <th className="px-6 py-4 text-right">Balance</th>
                        <th className="px-6 py-4 text-right">Last Activity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {outOfStockItems
                        .filter(i => !filters.inventoryType || i.inventory_type === filters.inventoryType)
                        .map((item) => (
                          <tr key={item.tag_id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-6 py-4 font-medium text-slate-900">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                                  <AlertTriangle className="w-4 h-4" />
                                </div>
                                {item.tag_name}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-slate-600 capitalize">{item.inventory_type.replace('_', ' ')}</td>
                            <td className="px-6 py-4 text-right font-bold text-rose-600">0.00</td>
                            <td className="px-6 py-4 text-right text-slate-500 whitespace-nowrap">{formatDate(item.last_activity_date)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="lg:hidden divide-y divide-slate-100">
                  {outOfStockItems
                    .filter(i => !filters.inventoryType || i.inventory_type === filters.inventoryType)
                    .map((item) => (
                      <div key={item.tag_id} className="p-4 bg-white hover:bg-slate-50/50 transition-colors">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                              <AlertTriangle className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-900">{item.tag_name}</h4>
                              <p className="text-xs text-slate-500 capitalize">{item.inventory_type.replace('_', ' ')}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="block text-sm font-bold text-rose-600">0.00</span>
                          </div>
                        </div>
                        <div className="flex justify-end text-xs text-slate-400 mt-2">
                          Last Active: {formatDate(item.last_activity_date)}
                        </div>
                      </div>
                    ))}
                </div>
              </>
            )}
          </ModernCard>
        )}

        {/* Low Stock Tab */}
        {activeTab === 'lowstock' && (
          <ModernCard padding="none" className="overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center gap-2 text-amber-600 bg-amber-50/30">
              <TrendingDown className="w-5 h-5" />
              <h3 className="font-bold">Low Stock Alerts</h3>
            </div>
            {lowStockItems.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <p>No low stock alerts at the moment.</p>
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-medium">
                      <tr>
                        <th className="px-6 py-4 w-10"></th>
                        <th className="px-6 py-4">Tag Name</th>
                        <th className="px-6 py-4">Type</th>
                        <th className="px-6 py-4 text-right">Current Balance</th>
                        <th className="px-6 py-4 text-right">Threshold</th>
                        <th className="px-6 py-4 text-right">Shortage</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {lowStockItems
                        .filter(i => !filters.inventoryType || i.inventory_type === filters.inventoryType)
                        .map((item) => {
                          const usable = item.inventory_type === 'raw_material' ? true : undefined;
                          const key = usable !== undefined ? `${item.tag_id}-${usable}` : item.tag_id;
                          const isExpanded = expandedTags.has(key);
                          return (
                            <>
                              <tr
                                key={key}
                                onClick={() => toggleTagExpansion(item.tag_id, item.inventory_type as InventoryType, usable)}
                                className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                              >
                                <td className="px-6 py-4">
                                  <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-90 text-indigo-500' : ''}`} />
                                </td>
                                <td className="px-6 py-4 font-medium text-slate-900 group-hover:text-amber-600 transition-colors">
                                  <div className="flex items-center gap-2">
                                    <TrendingDown className="w-4 h-4 text-amber-500" />
                                    {item.tag_name}
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-slate-600 capitalize">{item.inventory_type.replace('_', ' ')}</td>
                                <td className="px-6 py-4 text-right font-medium text-slate-700">{item.current_balance.toFixed(2)}</td>
                                <td className="px-6 py-4 text-right text-slate-500">{item.threshold_quantity.toFixed(2)}</td>
                                <td className="px-6 py-4 text-right font-bold text-rose-500">{item.shortage_amount.toFixed(2)}</td>
                              </tr>
                              {isExpanded && renderTagDetails(key, item.inventory_type as InventoryType)}
                            </>
                          );
                        })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="lg:hidden divide-y divide-slate-100">
                  {lowStockItems
                    .filter(i => !filters.inventoryType || i.inventory_type === filters.inventoryType)
                    .map((item) => {
                      const usable = item.inventory_type === 'raw_material' ? true : undefined;
                      const key = usable !== undefined ? `${item.tag_id}-${usable}` : item.tag_id;
                      const isExpanded = expandedTags.has(key);
                      return (
                        <div key={key} className="p-4 bg-white hover:bg-slate-50/50 transition-colors" onClick={() => toggleTagExpansion(item.tag_id, item.inventory_type as InventoryType, usable)}>
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 bg-amber-50 rounded text-amber-500">
                                <TrendingDown className="w-4 h-4" />
                              </div>
                              <div>
                                <h4 className="font-bold text-slate-900">{item.tag_name}</h4>
                                <p className="text-xs text-slate-500 capitalize">{item.inventory_type.replace('_', ' ')}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="block text-sm font-bold text-slate-900">{item.current_balance.toFixed(2)}</span>
                              <span className="text-xs text-slate-400">Target: {item.threshold_quantity.toFixed(2)}</span>
                            </div>
                          </div>
                          <div className="mt-2 text-center text-xs text-rose-500 font-medium">
                            Shortage by {item.shortage_amount.toFixed(2)}
                          </div>
                          <div className="mt-2 text-center">
                            {isExpanded ? (
                              <>
                                <div className="border-t border-slate-100 mt-2 mb-2"></div>
                                {renderMobileDetails(key, item.inventory_type as InventoryType)}
                                <ChevronDown className="w-4 h-4 text-slate-300 mx-auto mt-2" />
                              </>
                            ) : (
                              <ChevronDown className="w-4 h-4 text-slate-300 mx-auto" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </>
            )}
          </ModernCard>
        )}

        {/* Consumption Tab */}
        {activeTab === 'consumption' && (
          <div className="space-y-6">
            {/* Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ModernCard padding="sm" className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><Calendar className="w-5 h-5" /></div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">Period</p>
                    <p className="text-xs text-slate-500">{selectedMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</p>
                  </div>
                </div>
                <div className="flex items-center bg-slate-100 rounded-lg p-1">
                  <button onClick={goToPreviousMonth} className="p-1.5 hover:bg-white rounded-md transition-all shadow-sm"><ChevronLeft className="w-4 h-4 text-slate-600" /></button>
                  <button onClick={goToNextMonth} disabled={isCurrentMonth()} className="p-1.5 hover:bg-white rounded-md transition-all shadow-sm disabled:opacity-30 disabled:hover:bg-transparent"><ChevronRight className="w-4 h-4 text-slate-600" /></button>
                </div>
              </ModernCard>

              <ModernCard padding="sm" className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><Filter className="w-5 h-5" /></div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">Tag Filter</p>
                    <p className="text-xs text-slate-500">{selectedConsumptionTag ? 'Filtered' : 'All Tags'}</p>
                  </div>
                </div>
                <select
                  value={selectedConsumptionTag || ''}
                  onChange={(e) => setSelectedConsumptionTag(e.target.value || null)}
                  className="w-full sm:w-[200px] bg-slate-100 border-none rounded-lg text-sm pl-3 pr-8 py-2 focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">All Tags</option>
                  {availableTags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </ModernCard>
            </div>

            {/* Charts */}
            {consumptionTrendData.length > 0 ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <ModernCard className="lg:col-span-2">
                    <div className="mb-6">
                      <h3 className="font-bold text-slate-800 text-lg">Daily Consumption Trend</h3>
                    </div>
                    <div className="h-[300px] w-full overflow-x-auto pb-2 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300/80 [&::-webkit-scrollbar-track]:bg-slate-50">
                      <div className="min-w-[600px] lg:min-w-full h-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={consumptionTrendData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => new Date(v).getDate().toString()} />
                            <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.1)' }} />
                            <Legend />
                            <Line type="monotone" dataKey="consumed" name="Consumed" stroke="#4f46e5" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                            <Line type="monotone" dataKey="wasted" name="Wasted" stroke="#f43f5e" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </ModernCard>

                  <ModernCard>
                    <div className="mb-6">
                      <h3 className="font-bold text-slate-800 text-lg">Efficiency</h3>
                    </div>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Consumed', value: consumptionTrendData.reduce((a: any, b: any) => a + b.consumed, 0) },
                              { name: 'Wasted', value: consumptionTrendData.reduce((a: any, b: any) => a + b.wasted, 0) }
                            ]}
                            cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5}
                            dataKey="value"
                          >
                            <Cell fill="#4f46e5" />
                            <Cell fill="#f43f5e" />
                          </Pie>
                          <Tooltip />
                          <Legend verticalAlign="bottom" height={36} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="text-center mt-4">
                      <p className="text-sm text-slate-500">Total Waste</p>
                      <p className="text-2xl font-bold text-rose-500">{consumptionTrendData.reduce((a: any, b: any) => a + b.wasted, 0).toFixed(2)}</p>
                    </div>
                  </ModernCard>
                </div>

                {/* Consumption by Tag Table (Only when 'All Tags' is selected) */}
                {!selectedConsumptionTag && (
                  <ModernCard padding="none" className="overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                      <h3 className="font-bold text-slate-800">Consumption by Tag</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-white border-b border-slate-100 text-slate-500 font-medium">
                          <tr>
                            <th className="px-6 py-4 w-10"></th>
                            <th className="px-6 py-4">Tag Name</th>
                            <th className="px-6 py-4 text-right">Total Consumed</th>
                            <th className="px-6 py-4 text-right">Total Wasted</th>
                            <th className="px-6 py-4 text-right">Efficiency</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {Object.values(consumptionData.reduce((acc, item) => {
                            const key = item.tag_id;
                            if (!acc[key]) {
                              acc[key] = {
                                id: item.tag_id,
                                name: item.tag_name,
                                consumed: 0,
                                wasted: 0,
                                transactions: 0,
                                details: [],
                                inventoryType: null // Will be determined from current inventory data
                              };
                            }
                            acc[key].consumed += item.total_consumed || 0;
                            acc[key].wasted += item.total_wasted || 0;
                            acc[key].transactions += item.consumption_transactions || 0;
                            acc[key].details.push(item);
                            return acc;
                          }, {} as Record<string, any>)).map((tag: any) => {
                            // Determine inventory type from currentInventory data
                            let inventoryType: InventoryType = 'raw_material';
                            for (const inv of currentInventory) {
                              if (inv.data.some(item => item.tag_id === tag.id)) {
                                inventoryType = inv.type;
                                break;
                              }
                            }
                            tag.inventoryType = inventoryType;

                            const isExpanded = expandedTags.has(`consumption-${tag.id}`);
                            const total = tag.consumed + tag.wasted;
                            const efficiency = total > 0 ? (tag.consumed / total) * 100 : 0;

                            return tag;
                          }).sort((a: any, b: any) => b.consumed - a.consumed).map((tag: any) => {
                            const isExpanded = expandedTags.has(`consumption-${tag.id}`);
                            const total = tag.consumed + tag.wasted;
                            const efficiency = total > 0 ? (tag.consumed / total) * 100 : 0;

                            return (
                              <React.Fragment key={tag.id}>
                                <tr
                                  onClick={() => {
                                    const newExpanded = new Set(expandedTags);
                                    if (newExpanded.has(`consumption-${tag.id}`)) {
                                      newExpanded.delete(`consumption-${tag.id}`);
                                    } else {
                                      newExpanded.add(`consumption-${tag.id}`);
                                    }
                                    setExpandedTags(newExpanded);
                                  }}
                                  className="hover:bg-slate-50 transition-colors cursor-pointer"
                                >
                                  <td className="px-6 py-4">
                                    <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-90 text-indigo-500' : ''}`} />
                                  </td>
                                  <td className="px-6 py-4 font-medium text-slate-900">{tag.name}</td>
                                  <td className="px-6 py-4 text-right text-indigo-600 font-semibold">{tag.consumed.toFixed(2)}</td>
                                  <td className="px-6 py-4 text-right text-rose-600 font-semibold">{tag.wasted.toFixed(2)}</td>
                                  <td className="px-6 py-4 text-right">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${efficiency > 90 ? 'bg-emerald-100 text-emerald-700' : efficiency > 70 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                                      {efficiency.toFixed(1)}%
                                    </span>
                                  </td>
                                </tr>
                                {isExpanded && (
                                  <tr>
                                    <td colSpan={5} className="px-0 py-0 bg-slate-50/30 border-b border-slate-100">
                                      <div className="py-4 px-12">
                                        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                                          <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                                            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Daily Breakdown</span>
                                          </div>
                                          <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                              <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-medium">
                                                <tr>
                                                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Date</th>
                                                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider">Consumed</th>
                                                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider">Wasted</th>
                                                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider">Efficiency</th>
                                                </tr>
                                              </thead>
                                              <tbody className="divide-y divide-slate-50">
                                                {tag.details.sort((a: any, b: any) => new Date(a.consumption_date).getTime() - new Date(b.consumption_date).getTime()).map((d: any, idx: number) => {
                                                  const dTotal = (d.total_consumed || 0) + (d.total_wasted || 0);
                                                  const dEfficiency = dTotal > 0 ? ((d.total_consumed || 0) / dTotal) * 100 : 0;
                                                  const detailKey = `${tag.id}-${d.consumption_date}`;
                                                  const isDateExpanded = expandedConsumptionDates.has(detailKey);
                                                  const details = consumptionDetails[detailKey];
                                                  const isLoadingDetails = loadingConsumptionDetails.has(detailKey);

                                                  return (
                                                    <React.Fragment key={idx}>
                                                      <tr
                                                        onClick={() => toggleConsumptionDateExpansion(tag.id, d.consumption_date, tag.inventoryType)}
                                                        className="hover:bg-slate-50 transition-colors cursor-pointer"
                                                      >
                                                        <td className="px-4 py-3 text-slate-700 flex items-center gap-2">
                                                          <ChevronRight className={`w-3 h-3 text-slate-400 transition-transform ${isDateExpanded ? 'rotate-90 text-indigo-500' : ''}`} />
                                                          {formatDate(d.consumption_date)}
                                                        </td>
                                                        <td className="px-4 py-3 text-right text-indigo-600 font-medium">{d.total_consumed?.toFixed(2) || '0.00'}</td>
                                                        <td className="px-4 py-3 text-right text-rose-500 font-medium">{d.total_wasted?.toFixed(2) || '0.00'}</td>
                                                        <td className="px-4 py-3 text-right">
                                                          <span className={`text-xs font-bold ${dEfficiency > 90 ? 'text-emerald-600' : dEfficiency > 70 ? 'text-amber-600' : 'text-rose-600'}`}>
                                                            {dEfficiency.toFixed(1)}%
                                                          </span>
                                                        </td>
                                                      </tr>
                                                      {isDateExpanded && (
                                                        <tr>
                                                          <td colSpan={4} className="px-0 py-0">
                                                            <div className="bg-slate-50/50 border-y border-slate-100 px-4 py-3 shadow-inner">
                                                              {isLoadingDetails ? (
                                                                <div className="flex items-center justify-center gap-2 py-2 text-slate-500 text-xs">
                                                                  <div className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                                                  <span>Loading details...</span>
                                                                </div>
                                                              ) : details && details.length > 0 ? (
                                                                <div className="grid gap-2">
                                                                  {details.map((detail, detailIdx) => (
                                                                    <div key={detailIdx} className="flex items-center justify-between text-xs bg-white p-2 rounded border border-slate-200/60 shadow-sm">
                                                                      <div className="flex items-center gap-2">
                                                                        <div className={`w-1.5 h-1.5 rounded-full ${detail.movement_type === 'CONSUMPTION' ? 'bg-indigo-500' : 'bg-rose-500'}`}></div>
                                                                        <span className="font-mono text-slate-600 font-medium">{detail.lot_batch_id}</span>
                                                                      </div>
                                                                      <div className="flex items-center gap-3">
                                                                        <span className={`font-medium ${detail.movement_type === 'CONSUMPTION' ? 'text-indigo-600' : 'text-rose-600'}`}>
                                                                          {detail.movement_type === 'CONSUMPTION' ? 'Consumed' : 'Wasted'}
                                                                        </span>
                                                                        <span className="font-bold text-slate-700">
                                                                          {detail.quantity.toFixed(2)} <span className="text-[10px] font-normal text-slate-400">{detail.unit}</span>
                                                                        </span>
                                                                      </div>
                                                                    </div>
                                                                  ))}
                                                                </div>
                                                              ) : (
                                                                <div className="text-center py-2 text-xs text-slate-400 italic">
                                                                  No detailed breakdown available
                                                                </div>
                                                              )}
                                                            </div>
                                                          </td>
                                                        </tr>
                                                      )}
                                                    </React.Fragment>
                                                  );
                                                })}
                                              </tbody>
                                            </table>
                                          </div>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </ModernCard>
                )}
              </div>
            ) : (
              <ModernCard className="py-12 text-center text-slate-400">
                <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No consumption data found for this selection.</p>
              </ModernCard>
            )}
          </div>
        )}
      </div>
    </div >
  );
}
