import { useEffect, useState, useMemo } from 'react';
import { RefreshCw, AlertTriangle, ArrowRightLeft, Trash2, Package, Loader2, Search, Filter, X, Download } from 'lucide-react';
import type { AccessLevel } from '../types/access';
import type { RawMaterial, RecurringProduct, WasteRecord, TransferRecord } from '../types/operations';
import {
  fetchRawMaterials,
  fetchRecurringProducts,
  recordWaste,
  transferBetweenLots,
  fetchWasteRecords,
  fetchTransferRecords,
  fetchRawMaterialBatchUsage,
  fetchRecurringProductBatchUsage,
  fetchUsers,
} from '../lib/operations';
import { useModuleAccess } from '../contexts/ModuleAccessContext';
import { useAuth } from '../contexts/AuthContext';
import { exportWasteRecords, exportTransferRecords } from '../utils/excelExport';

interface WasteTransferManagementProps {
  accessLevel: AccessLevel;
}

type TabType = 'waste' | 'transfer';

export function WasteTransferManagement({ accessLevel }: WasteTransferManagementProps) {
  const { userId } = useModuleAccess();
  const { user } = useAuth();
  const canWrite = accessLevel === 'read-write';
  const [activeTab, setActiveTab] = useState<TabType>('waste');

  // Data state
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [recurringProducts, setRecurringProducts] = useState<RecurringProduct[]>([]);
  const [wasteRecords, setWasteRecords] = useState<WasteRecord[]>([]);
  const [transferRecords, setTransferRecords] = useState<TransferRecord[]>([]);
  const [users, setUsers] = useState<Array<{id: string, auth_user_id: string, full_name: string, email: string}>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Waste form state
  const [wasteForm, setWasteForm] = useState({
    lotType: 'raw_material' as 'raw_material' | 'recurring_product',
    lotId: '',
    quantity: '',
    reason: '',
    notes: '',
    wasteDate: new Date().toISOString().split('T')[0],
  });

  // Transfer form state
  const [transferForm, setTransferForm] = useState({
    lotType: 'raw_material' as 'raw_material' | 'recurring_product',
    fromLotId: '',
    toLotId: '',
    quantity: '',
    reason: '',
    notes: '',
    transferDate: new Date().toISOString().split('T')[0],
  });

  const [submitting, setSubmitting] = useState(false);

  // Search and filter states for waste records
  const [wasteSearchTerm, setWasteSearchTerm] = useState('');
  const [wasteFilterLotType, setWasteFilterLotType] = useState<string>('all');
  const [wasteFilterDateFrom, setWasteFilterDateFrom] = useState<string>('');
  const [wasteFilterDateTo, setWasteFilterDateTo] = useState<string>('');
  const [wasteFilterWasteId, setWasteFilterWasteId] = useState<string>('');
  const [wasteFilterLotId, setWasteFilterLotId] = useState<string>('all');
  const [wasteFilterReason, setWasteFilterReason] = useState<string>('');
  const [wasteFilterQuantityMin, setWasteFilterQuantityMin] = useState<string>('');
  const [wasteFilterQuantityMax, setWasteFilterQuantityMax] = useState<string>('');
  const [wasteFilterCreatedBy, setWasteFilterCreatedBy] = useState<string>('all');
  const [showWasteFilters, setShowWasteFilters] = useState(false);

  // Search and filter states for transfer records
  const [transferSearchTerm, setTransferSearchTerm] = useState('');
  const [transferFilterLotType, setTransferFilterLotType] = useState<string>('all');
  const [transferFilterDateFrom, setTransferFilterDateFrom] = useState<string>('');
  const [transferFilterDateTo, setTransferFilterDateTo] = useState<string>('');
  const [transferFilterTransferId, setTransferFilterTransferId] = useState<string>('');
  const [transferFilterFromLotId, setTransferFilterFromLotId] = useState<string>('all');
  const [transferFilterToLotId, setTransferFilterToLotId] = useState<string>('all');
  const [transferFilterReason, setTransferFilterReason] = useState<string>('');
  const [transferFilterQuantityMin, setTransferFilterQuantityMin] = useState<string>('');
  const [transferFilterQuantityMax, setTransferFilterQuantityMax] = useState<string>('');
  const [transferFilterCreatedBy, setTransferFilterCreatedBy] = useState<string>('all');
  const [showTransferFilters, setShowTransferFilters] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [rawMaterialsData, recurringProductsData, wasteData, transferData, usersData] = await Promise.all([
        fetchRawMaterials(false), // Exclude archived items
        fetchRecurringProducts(false), // Exclude archived items
        fetchWasteRecords(),
        fetchTransferRecords(),
        fetchUsers(),
      ]);
      setRawMaterials(rawMaterialsData);
      setRecurringProducts(recurringProductsData);
      setWasteRecords(wasteData);
      setTransferRecords(transferData);
      setUsers(usersData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (accessLevel === 'no-access') return;
    void loadData();
  }, [accessLevel]);

  const handleRecordWaste = async () => {
    if (!canWrite || !wasteForm.lotId || !wasteForm.quantity || !wasteForm.reason) {
      setError('Please fill in all required fields');
      return;
    }

    const quantity = parseFloat(wasteForm.quantity);
    if (isNaN(quantity) || quantity <= 0) {
      setError('Please enter a valid quantity');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await recordWaste(
        wasteForm.lotType,
        wasteForm.lotId,
        quantity,
        wasteForm.reason,
        wasteForm.notes || undefined,
        wasteForm.wasteDate,
        user?.id || undefined
      );

      // Reset form
      setWasteForm({
        lotType: 'raw_material',
        lotId: '',
        quantity: '',
        reason: '',
        notes: '',
        wasteDate: new Date().toISOString().split('T')[0],
      });

      // Reload data
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record waste');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTransfer = async () => {
    if (!canWrite || !transferForm.fromLotId || !transferForm.toLotId || !transferForm.quantity || !transferForm.reason) {
      setError('Please fill in all required fields');
      return;
    }

    if (transferForm.fromLotId === transferForm.toLotId) {
      setError('Source and destination lots cannot be the same');
      return;
    }

    const quantity = parseFloat(transferForm.quantity);
    if (isNaN(quantity) || quantity <= 0) {
      setError('Please enter a valid quantity');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await transferBetweenLots(
        transferForm.lotType,
        transferForm.fromLotId,
        transferForm.toLotId,
        quantity,
        transferForm.reason,
        transferForm.notes || undefined,
        transferForm.transferDate,
        user?.id || undefined
      );

      // Reset form
      setTransferForm({
        lotType: 'raw_material',
        fromLotId: '',
        toLotId: '',
        quantity: '',
        reason: '',
        notes: '',
        transferDate: new Date().toISOString().split('T')[0],
      });

      // Reload data
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to transfer between lots');
    } finally {
      setSubmitting(false);
    }
  };

  const getAvailableLots = () => {
    return activeTab === 'waste'
      ? (wasteForm.lotType === 'raw_material' ? rawMaterials : recurringProducts)
      : (transferForm.lotType === 'raw_material' ? rawMaterials : recurringProducts);
  };

  const selectedLot = getAvailableLots().find(lot => 
    activeTab === 'waste' ? lot.id === wasteForm.lotId : lot.id === transferForm.fromLotId
  );

  // Filter and search logic for waste records
  const filteredWasteRecords = useMemo(() => {
    let filtered = [...wasteRecords];

    // Search filter (general search)
    if (wasteSearchTerm.trim()) {
      const term = wasteSearchTerm.toLowerCase();
      filtered = filtered.filter((r) =>
        r.lot_identifier.toLowerCase().includes(term) ||
        (r.lot_name || '').toLowerCase().includes(term) ||
        r.reason.toLowerCase().includes(term) ||
        (r.notes || '').toLowerCase().includes(term) ||
        (r.created_by_name || '').toLowerCase().includes(term) ||
        (r.waste_id || '').toLowerCase().includes(term)
      );
    }

    // Lot type filter
    if (wasteFilterLotType !== 'all') {
      filtered = filtered.filter((r) => r.lot_type === wasteFilterLotType);
    }

    // Date range filter
    if (wasteFilterDateFrom) {
      filtered = filtered.filter((r) => r.waste_date >= wasteFilterDateFrom);
    }
    if (wasteFilterDateTo) {
      filtered = filtered.filter((r) => r.waste_date <= wasteFilterDateTo);
    }

    // Waste ID filter
    if (wasteFilterWasteId.trim()) {
      filtered = filtered.filter((r) => 
        (r.waste_id || '').toLowerCase().includes(wasteFilterWasteId.toLowerCase())
      );
    }

    // Lot ID filter
    if (wasteFilterLotId !== 'all') {
      filtered = filtered.filter((r) => r.lot_id === wasteFilterLotId);
    }

    // Reason filter
    if (wasteFilterReason.trim()) {
      filtered = filtered.filter((r) => 
        r.reason.toLowerCase().includes(wasteFilterReason.toLowerCase())
      );
    }

    // Quantity range filter
    if (wasteFilterQuantityMin) {
      const min = parseFloat(wasteFilterQuantityMin);
      if (!isNaN(min)) {
        filtered = filtered.filter((r) => r.quantity_wasted >= min);
      }
    }
    if (wasteFilterQuantityMax) {
      const max = parseFloat(wasteFilterQuantityMax);
      if (!isNaN(max)) {
        filtered = filtered.filter((r) => r.quantity_wasted <= max);
      }
    }

    // Created by filter
    if (wasteFilterCreatedBy !== 'all') {
      filtered = filtered.filter((r) => r.created_by === wasteFilterCreatedBy);
    }

    return filtered;
  }, [wasteRecords, wasteSearchTerm, wasteFilterLotType, wasteFilterDateFrom, wasteFilterDateTo, wasteFilterWasteId, wasteFilterLotId, wasteFilterReason, wasteFilterQuantityMin, wasteFilterQuantityMax, wasteFilterCreatedBy]);

  // Filter and search logic for transfer records
  const filteredTransferRecords = useMemo(() => {
    let filtered = [...transferRecords];

    // Search filter (general search)
    if (transferSearchTerm.trim()) {
      const term = transferSearchTerm.toLowerCase();
      filtered = filtered.filter((r) =>
        r.from_lot_identifier.toLowerCase().includes(term) ||
        r.to_lot_identifier.toLowerCase().includes(term) ||
        (r.from_lot_name || '').toLowerCase().includes(term) ||
        (r.to_lot_name || '').toLowerCase().includes(term) ||
        r.reason.toLowerCase().includes(term) ||
        (r.notes || '').toLowerCase().includes(term) ||
        (r.created_by_name || '').toLowerCase().includes(term) ||
        (r.transfer_id || '').toLowerCase().includes(term)
      );
    }

    // Lot type filter
    if (transferFilterLotType !== 'all') {
      filtered = filtered.filter((r) => r.lot_type === transferFilterLotType);
    }

    // Date range filter
    if (transferFilterDateFrom) {
      filtered = filtered.filter((r) => r.transfer_date >= transferFilterDateFrom);
    }
    if (transferFilterDateTo) {
      filtered = filtered.filter((r) => r.transfer_date <= transferFilterDateTo);
    }

    // Transfer ID filter
    if (transferFilterTransferId.trim()) {
      filtered = filtered.filter((r) => 
        (r.transfer_id || '').toLowerCase().includes(transferFilterTransferId.toLowerCase())
      );
    }

    // From Lot ID filter
    if (transferFilterFromLotId !== 'all') {
      filtered = filtered.filter((r) => r.from_lot_id === transferFilterFromLotId);
    }

    // To Lot ID filter
    if (transferFilterToLotId !== 'all') {
      filtered = filtered.filter((r) => r.to_lot_id === transferFilterToLotId);
    }

    // Reason filter
    if (transferFilterReason.trim()) {
      filtered = filtered.filter((r) => 
        r.reason.toLowerCase().includes(transferFilterReason.toLowerCase())
      );
    }

    // Quantity range filter
    if (transferFilterQuantityMin) {
      const min = parseFloat(transferFilterQuantityMin);
      if (!isNaN(min)) {
        filtered = filtered.filter((r) => r.quantity_transferred >= min);
      }
    }
    if (transferFilterQuantityMax) {
      const max = parseFloat(transferFilterQuantityMax);
      if (!isNaN(max)) {
        filtered = filtered.filter((r) => r.quantity_transferred <= max);
      }
    }

    // Created by filter
    if (transferFilterCreatedBy !== 'all') {
      filtered = filtered.filter((r) => r.created_by === transferFilterCreatedBy);
    }

    return filtered;
  }, [transferRecords, transferSearchTerm, transferFilterLotType, transferFilterDateFrom, transferFilterDateTo, transferFilterTransferId, transferFilterFromLotId, transferFilterToLotId, transferFilterReason, transferFilterQuantityMin, transferFilterQuantityMax, transferFilterCreatedBy]);

  if (accessLevel === 'no-access') {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
          <h1 className="text-2xl font-semibold text-gray-900">Operations module is not available</h1>
          <p className="text-gray-600 mt-2">Your account does not have access to this module.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex">
            <button
              onClick={() => setActiveTab('waste')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'waste'
                  ? 'bg-orange-50 text-orange-700 border-b-2 border-orange-500'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Trash2 className="w-4 h-4" />
                Waste Management
              </div>
            </button>
            <button
              onClick={() => setActiveTab('transfer')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'transfer'
                  ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-500'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <ArrowRightLeft className="w-4 h-4" />
                Transfer Management
              </div>
            </button>
          </nav>
        </div>

        <div className="p-4 md:p-6">
          {/* Waste Management Tab */}
          {activeTab === 'waste' && (
            <div className="space-y-6">
              {canWrite && (
                <div className="bg-white border border-gray-200 rounded-lg p-4 md:p-6 space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Record Waste</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Lot Type *
                      </label>
                      <select
                        value={wasteForm.lotType}
                        onChange={(e) => setWasteForm(prev => ({ ...prev, lotType: e.target.value as 'raw_material' | 'recurring_product', lotId: '' }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500"
                      >
                        <option value="raw_material">Raw Material</option>
                        <option value="recurring_product">Recurring Product</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Select Lot *
                      </label>
                      <select
                        value={wasteForm.lotId}
                        onChange={(e) => setWasteForm(prev => ({ ...prev, lotId: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500"
                      >
                        <option value="">Select a lot</option>
                        {(wasteForm.lotType === 'raw_material' ? rawMaterials : recurringProducts)
                          .filter(lot => lot.quantity_available > 0)
                          .map((lot) => (
                            <option key={lot.id} value={lot.id}>
                              {lot.lot_id} - {lot.name} (Available: {lot.quantity_available} {lot.unit})
                            </option>
                          ))}
                      </select>
                    </div>

                    {selectedLot && (
                      <div className="md:col-span-2 p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Available Quantity:</span> {selectedLot.quantity_available} {selectedLot.unit}
                        </p>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Quantity Wasted *
                      </label>
                      <input
                        type="number"
                        value={wasteForm.quantity}
                        onChange={(e) => setWasteForm(prev => ({ ...prev, quantity: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500"
                        placeholder="0"
                        step="any"
                        min="0"
                        max={selectedLot?.quantity_available || undefined}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Waste Date *
                      </label>
                      <input
                        type="date"
                        value={wasteForm.wasteDate}
                        onChange={(e) => setWasteForm(prev => ({ ...prev, wasteDate: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Reason *
                      </label>
                      <input
                        type="text"
                        value={wasteForm.reason}
                        onChange={(e) => setWasteForm(prev => ({ ...prev, reason: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500"
                        placeholder="e.g., Damaged, Expired, Contaminated"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Notes
                      </label>
                      <textarea
                        value={wasteForm.notes}
                        onChange={(e) => setWasteForm(prev => ({ ...prev, notes: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500"
                        rows={3}
                        placeholder="Additional details about the waste"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={handleRecordWaste}
                      disabled={submitting || !wasteForm.lotId || !wasteForm.quantity || !wasteForm.reason}
                      className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 inline animate-spin mr-2" />
                          Recording...
                        </>
                      ) : (
                        'Record Waste'
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Search and Filters for Waste */}
              <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4 mb-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  {/* Search */}
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={wasteSearchTerm}
                      onChange={(e) => setWasteSearchTerm(e.target.value)}
                      placeholder="Search by lot ID, reason, notes..."
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    />
                    {wasteSearchTerm && (
                      <button
                        onClick={() => setWasteSearchTerm('')}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  
                  {/* Export Button - Only for R/W users */}
                  {canWrite && (
                    <button
                      onClick={() => exportWasteRecords(filteredWasteRecords)}
                      className="flex items-center justify-center gap-2 px-4 py-2 border-2 border-blue-300 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-all font-medium"
                      title="Export to Excel"
                    >
                      <Download className="w-4 h-4" />
                      <span className="text-sm">Export</span>
                    </button>
                  )}
                  
                  {/* Filter Toggle */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowWasteFilters(!showWasteFilters);
                    }}
                    className={`flex items-center justify-center gap-2 px-4 py-2 border-2 rounded-lg transition-all font-medium ${
                      showWasteFilters || wasteFilterLotType !== 'all' || wasteFilterDateFrom || wasteFilterDateTo || wasteFilterWasteId || wasteFilterLotId !== 'all' || wasteFilterReason || wasteFilterQuantityMin || wasteFilterQuantityMax || wasteFilterCreatedBy !== 'all'
                        ? 'bg-orange-50 border-orange-400 text-orange-700 shadow-sm'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400'
                    }`}
                  >
                    <Filter className="w-4 h-4" />
                    <span className="text-sm">Filters</span>
                    {(() => {
                      const activeFiltersCount = [
                        wasteFilterLotType !== 'all',
                        wasteFilterDateFrom,
                        wasteFilterDateTo,
                        wasteFilterWasteId,
                        wasteFilterLotId !== 'all',
                        wasteFilterReason,
                        wasteFilterQuantityMin,
                        wasteFilterQuantityMax,
                        wasteFilterCreatedBy !== 'all',
                      ].filter(Boolean).length;
                      return activeFiltersCount > 0 && (
                        <span className="bg-orange-600 text-white text-xs font-semibold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                          {activeFiltersCount}
                        </span>
                      );
                    })()}
                  </button>
                </div>

                {/* Filter Panel */}
                {showWasteFilters && (
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3 pt-3 border-t border-gray-200">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Lot Type
                      </label>
                      <select
                        value={wasteFilterLotType}
                        onChange={(e) => setWasteFilterLotType(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500"
                      >
                        <option value="all">All Types</option>
                        <option value="raw_material">Raw Material</option>
                        <option value="recurring_product">Recurring Product</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Waste ID
                      </label>
                      <input
                        type="text"
                        value={wasteFilterWasteId}
                        onChange={(e) => setWasteFilterWasteId(e.target.value)}
                        placeholder="e.g., WASTE-001"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Lot
                      </label>
                      <select
                        value={wasteFilterLotId}
                        onChange={(e) => setWasteFilterLotId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500"
                      >
                        <option value="all">All Lots</option>
                        {wasteFilterLotType === 'raw_material' || wasteFilterLotType === 'all'
                          ? rawMaterials.map((lot) => (
                              <option key={lot.id} value={lot.id}>
                                {lot.lot_id} - {lot.name}
                              </option>
                            ))
                          : null}
                        {wasteFilterLotType === 'recurring_product' || wasteFilterLotType === 'all'
                          ? recurringProducts.map((lot) => (
                              <option key={lot.id} value={lot.id}>
                                {lot.lot_id} - {lot.name}
                              </option>
                            ))
                          : null}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Reason
                      </label>
                      <input
                        type="text"
                        value={wasteFilterReason}
                        onChange={(e) => setWasteFilterReason(e.target.value)}
                        placeholder="Filter by reason"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Date From
                      </label>
                      <input
                        type="date"
                        value={wasteFilterDateFrom}
                        onChange={(e) => setWasteFilterDateFrom(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Date To
                      </label>
                      <input
                        type="date"
                        value={wasteFilterDateTo}
                        onChange={(e) => setWasteFilterDateTo(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Quantity Min
                      </label>
                      <input
                        type="number"
                        value={wasteFilterQuantityMin}
                        onChange={(e) => setWasteFilterQuantityMin(e.target.value)}
                        placeholder="Min quantity"
                        step="any"
                        min="0"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Quantity Max
                      </label>
                      <input
                        type="number"
                        value={wasteFilterQuantityMax}
                        onChange={(e) => setWasteFilterQuantityMax(e.target.value)}
                        placeholder="Max quantity"
                        step="any"
                        min="0"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Created By
                      </label>
                      <select
                        value={wasteFilterCreatedBy}
                        onChange={(e) => setWasteFilterCreatedBy(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500"
                      >
                        <option value="all">All Users</option>
                        {users.map((user) => (
                          <option key={user.id} value={user.auth_user_id}>
                            {user.full_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-3 lg:col-span-4 flex items-end">
                      <button
                        onClick={() => {
                          setWasteFilterLotType('all');
                          setWasteFilterDateFrom('');
                          setWasteFilterDateTo('');
                          setWasteFilterWasteId('');
                          setWasteFilterLotId('all');
                          setWasteFilterReason('');
                          setWasteFilterQuantityMin('');
                          setWasteFilterQuantityMax('');
                          setWasteFilterCreatedBy('all');
                          setWasteSearchTerm('');
                        }}
                        className="w-full px-3 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        Clear All Filters
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Waste History */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Waste History</h3>
                {/* Desktop Table View */}
                <div className="hidden lg:block bg-white border border-gray-200 rounded-lg overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Waste ID</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lot</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Waste Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity Before</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity Wasted</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity After</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {loading ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                            <div className="flex flex-col items-center gap-2">
                              <Loader2 className="w-5 h-5 animate-spin" />
                              <span>Loading waste records...</span>
                            </div>
                          </td>
                        </tr>
                      ) : filteredWasteRecords.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                            <div className="flex flex-col items-center gap-2">
                              <Trash2 className="w-8 h-8 text-gray-400" />
                              <span>{wasteRecords.length === 0 ? 'No waste records found' : 'No records match your filters'}</span>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredWasteRecords.map((record) => {
                          // Find the lot to get its quantity information for calculation
                          const lot = (record.lot_type === 'raw_material' ? rawMaterials : recurringProducts).find(l => l.id === record.lot_id);
                          if (!lot) {
                            return null;
                          }
                          
                          // Get all waste and transfer records for this lot, sorted chronologically by date then created_at
                          const lotWasteRecords = wasteRecords
                            .filter(r => r.lot_id === record.lot_id)
                            .sort((a, b) => {
                              const dateCompare = a.waste_date.localeCompare(b.waste_date);
                              if (dateCompare !== 0) return dateCompare;
                              return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                            });
                          const lotTransferOutRecords = transferRecords
                            .filter(r => r.from_lot_id === record.lot_id)
                            .sort((a, b) => {
                              const dateCompare = a.transfer_date.localeCompare(b.transfer_date);
                              if (dateCompare !== 0) return dateCompare;
                              return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                            });
                          const lotTransferInRecords = transferRecords
                            .filter(r => r.to_lot_id === record.lot_id)
                            .sort((a, b) => {
                              const dateCompare = a.transfer_date.localeCompare(b.transfer_date);
                              if (dateCompare !== 0) return dateCompare;
                              return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                            });
                          
                          // Combine all operations and sort by date, then by created_at for proper chronological order
                          const allOperations: Array<{date: string; createdAt: string; type: 'waste' | 'transfer_out' | 'transfer_in'; quantity: number; id: string}> = [
                            ...lotWasteRecords.map(r => ({date: r.waste_date, createdAt: r.created_at, type: 'waste' as const, quantity: r.quantity_wasted, id: r.id})),
                            ...lotTransferOutRecords.map(r => ({date: r.transfer_date, createdAt: r.created_at, type: 'transfer_out' as const, quantity: r.quantity_transferred, id: r.id})),
                            ...lotTransferInRecords.map(r => ({date: r.transfer_date, createdAt: r.created_at, type: 'transfer_in' as const, quantity: r.quantity_transferred, id: r.id})),
                          ].sort((a, b) => {
                            const dateCompare = a.date.localeCompare(b.date);
                            if (dateCompare !== 0) return dateCompare;
                            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                          });
                          
                          // Find the index of current waste record
                          const currentIndex = allOperations.findIndex(op => op.id === record.id && op.type === 'waste');
                          
                          if (currentIndex === -1) {
                            // Record not found in operations, skip calculation
                            return null;
                          }
                          
                          // Calculate quantity before: Work backwards from current quantity_available
                          // Start from current quantity_available (which already accounts for ALL operations including batches)
                          // Then add back operations that happened AFTER this record to get the state right before those operations
                          // Then add back THIS operation to get quantity before this waste
                          let quantityBefore = lot.quantity_available;
                          
                          // Add back operations that happened AFTER this record (operations from currentIndex + 1 onwards)
                          for (let i = currentIndex + 1; i < allOperations.length; i++) {
                            const op = allOperations[i];
                            if (op.type === 'waste' || op.type === 'transfer_out') {
                              quantityBefore += op.quantity; // Add back what was removed after this record
                            } else if (op.type === 'transfer_in') {
                              quantityBefore -= op.quantity; // Subtract what was added after this record
                            }
                          }
                          
                          // Now add back THIS waste operation to get the quantity available BEFORE this waste
                          quantityBefore += record.quantity_wasted;
                          const quantityAfter = quantityBefore - record.quantity_wasted;

                          return (
                            <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-3 font-mono text-xs text-gray-900">{record.waste_id || '—'}</td>
                              <td className="px-4 py-3">
                                <div className="flex flex-col">
                                  <span className="font-mono text-xs text-gray-900">{record.lot_identifier}</span>
                                  <span className="text-xs text-gray-600">{record.lot_name || '—'}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-gray-700">{record.waste_date}</td>
                              <td className="px-4 py-3 font-medium text-gray-900">
                                {quantityBefore.toFixed(2)} {record.unit}
                              </td>
                              <td className="px-4 py-3 font-medium text-red-700">
                                {record.quantity_wasted.toFixed(2)} {record.unit}
                              </td>
                              <td className="px-4 py-3 font-medium text-gray-900">
                                {quantityAfter.toFixed(2)} {record.unit}
                              </td>
                              <td className="px-4 py-3 text-gray-700 text-xs">{record.reason}</td>
                              <td className="px-4 py-3 text-gray-600 text-xs max-w-xs truncate" title={record.notes || undefined}>
                                {record.notes || '—'}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="lg:hidden space-y-3">
                  {loading ? (
                    <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                        <span className="text-gray-500">Loading waste records...</span>
                      </div>
                    </div>
                  ) : filteredWasteRecords.length === 0 ? (
                    <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Trash2 className="w-8 h-8 text-gray-400" />
                        <span className="text-gray-500">{wasteRecords.length === 0 ? 'No waste records found' : 'No records match your filters'}</span>
                      </div>
                    </div>
                  ) : (
                    filteredWasteRecords.map((record) => {
                      // Find the lot to get its quantity information for calculation
                      const lot = (record.lot_type === 'raw_material' ? rawMaterials : recurringProducts).find(l => l.id === record.lot_id);
                      if (!lot) {
                        return null;
                      }
                      
                      // Get all waste and transfer records for this lot, sorted chronologically by date then created_at
                      const lotWasteRecords = wasteRecords
                        .filter(r => r.lot_id === record.lot_id)
                        .sort((a, b) => {
                          const dateCompare = a.waste_date.localeCompare(b.waste_date);
                          if (dateCompare !== 0) return dateCompare;
                          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                        });
                      const lotTransferOutRecords = transferRecords
                        .filter(r => r.from_lot_id === record.lot_id)
                        .sort((a, b) => {
                          const dateCompare = a.transfer_date.localeCompare(b.transfer_date);
                          if (dateCompare !== 0) return dateCompare;
                          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                        });
                      const lotTransferInRecords = transferRecords
                        .filter(r => r.to_lot_id === record.lot_id)
                        .sort((a, b) => {
                          const dateCompare = a.transfer_date.localeCompare(b.transfer_date);
                          if (dateCompare !== 0) return dateCompare;
                          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                        });
                      
                      // Combine all operations and sort by date, then by created_at for proper chronological order
                      const allOperations: Array<{date: string; createdAt: string; type: 'waste' | 'transfer_out' | 'transfer_in'; quantity: number; id: string}> = [
                        ...lotWasteRecords.map(r => ({date: r.waste_date, createdAt: r.created_at, type: 'waste' as const, quantity: r.quantity_wasted, id: r.id})),
                        ...lotTransferOutRecords.map(r => ({date: r.transfer_date, createdAt: r.created_at, type: 'transfer_out' as const, quantity: r.quantity_transferred, id: r.id})),
                        ...lotTransferInRecords.map(r => ({date: r.transfer_date, createdAt: r.created_at, type: 'transfer_in' as const, quantity: r.quantity_transferred, id: r.id})),
                      ].sort((a, b) => {
                        const dateCompare = a.date.localeCompare(b.date);
                        if (dateCompare !== 0) return dateCompare;
                        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                      });
                      
                      // Find the index of current waste record
                      const currentIndex = allOperations.findIndex(op => op.id === record.id && op.type === 'waste');
                      
                      if (currentIndex === -1) {
                        // Record not found in operations, skip calculation
                        return null;
                      }
                      
                      // Calculate quantity before: Start from quantity_available (current state after all operations)
                      // Add back operations that happened AFTER this record to reconstruct the state before those operations
                      let quantityBefore = lot.quantity_available;
                      
                      // Add back operations that happened AFTER this record (exclude this record - start from currentIndex + 1)
                      for (let i = currentIndex + 1; i < allOperations.length; i++) {
                        const op = allOperations[i];
                        if (op.type === 'waste' || op.type === 'transfer_out') {
                          quantityBefore += op.quantity; // Add back what was removed after this record
                        } else if (op.type === 'transfer_in') {
                          quantityBefore -= op.quantity; // Subtract what was added after this record
                        }
                      }
                      
                      // Now add back THIS operation to get quantity before this waste
                      quantityBefore += record.quantity_wasted;
                      const quantityAfter = quantityBefore - record.quantity_wasted;

                      return (
                        <div key={record.id} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-mono text-xs font-semibold text-gray-900 mb-1">{record.waste_id || '—'}</p>
                              <div className="flex flex-col">
                                <p className="font-mono text-sm font-semibold text-gray-900">{record.lot_identifier}</p>
                                <p className="text-xs text-gray-600">{record.lot_name || '—'}</p>
                              </div>
                              <p className="text-xs text-gray-500 mt-1">{record.waste_date}</p>
                            </div>
                            <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                              {record.lot_type === 'raw_material' ? 'Raw Material' : 'Recurring Product'}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm border-t pt-2">
                            <div>
                              <span className="text-gray-500 text-xs">Quantity Before:</span>
                              <p className="font-medium text-gray-900">{quantityBefore.toFixed(2)} {record.unit}</p>
                            </div>
                            <div>
                              <span className="text-gray-500 text-xs">Quantity Wasted:</span>
                              <p className="font-medium text-red-700">{record.quantity_wasted.toFixed(2)} {record.unit}</p>
                            </div>
                            <div>
                              <span className="text-gray-500 text-xs">Quantity After:</span>
                              <p className="font-medium text-gray-900">{quantityAfter.toFixed(2)} {record.unit}</p>
                            </div>
                          </div>
                          <div className="text-sm border-t pt-2">
                            <span className="text-gray-500 text-xs">Reason:</span>
                            <p className="text-gray-900 mt-1">{record.reason}</p>
                          </div>
                          {record.notes && (
                            <div className="text-sm border-t pt-2">
                              <span className="text-gray-500 text-xs">Notes:</span>
                              <p className="text-gray-900 mt-1">{record.notes}</p>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Transfer Management Tab */}
          {activeTab === 'transfer' && (
            <div className="space-y-6">
              {canWrite && (
                <div className="bg-white border border-gray-200 rounded-lg p-4 md:p-6 space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Transfer Between Lots</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Lot Type *
                      </label>
                      <select
                        value={transferForm.lotType}
                        onChange={(e) => setTransferForm(prev => ({ ...prev, lotType: e.target.value as 'raw_material' | 'recurring_product', fromLotId: '', toLotId: '' }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="raw_material">Raw Material</option>
                        <option value="recurring_product">Recurring Product</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        From Lot (Source) *
                      </label>
                      <select
                        value={transferForm.fromLotId}
                        onChange={(e) => setTransferForm(prev => ({ ...prev, fromLotId: e.target.value, toLotId: e.target.value === prev.toLotId ? '' : prev.toLotId }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select source lot</option>
                        {(transferForm.lotType === 'raw_material' ? rawMaterials : recurringProducts)
                          .filter(lot => lot.quantity_available > 0)
                          .map((lot) => (
                            <option key={lot.id} value={lot.id}>
                              {lot.lot_id} - {lot.name} (Available: {lot.quantity_available} {lot.unit})
                            </option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        To Lot (Destination) *
                      </label>
                      <select
                        value={transferForm.toLotId}
                        onChange={(e) => setTransferForm(prev => ({ ...prev, toLotId: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select destination lot</option>
                        {(transferForm.lotType === 'raw_material' ? rawMaterials : recurringProducts)
                          .filter(lot => lot.id !== transferForm.fromLotId && lot.unit === (transferForm.lotType === 'raw_material' ? rawMaterials.find(l => l.id === transferForm.fromLotId)?.unit : recurringProducts.find(l => l.id === transferForm.fromLotId)?.unit))
                          .map((lot) => (
                            <option key={lot.id} value={lot.id}>
                              {lot.lot_id} - {lot.name} (Available: {lot.quantity_available} {lot.unit})
                            </option>
                          ))}
                      </select>
                    </div>

                    {transferForm.fromLotId && (
                      <div className="md:col-span-2 p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Source Available:</span>{' '}
                          {(transferForm.lotType === 'raw_material' ? rawMaterials : recurringProducts)
                            .find(l => l.id === transferForm.fromLotId)?.quantity_available || 0}{' '}
                          {(transferForm.lotType === 'raw_material' ? rawMaterials : recurringProducts)
                            .find(l => l.id === transferForm.fromLotId)?.unit || ''}
                        </p>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Quantity to Transfer *
                      </label>
                      <input
                        type="number"
                        value={transferForm.quantity}
                        onChange={(e) => setTransferForm(prev => ({ ...prev, quantity: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                        placeholder="0"
                        step="any"
                        min="0"
                        max={transferForm.fromLotId ? (transferForm.lotType === 'raw_material' ? rawMaterials : recurringProducts).find(l => l.id === transferForm.fromLotId)?.quantity_available : undefined}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Transfer Date *
                      </label>
                      <input
                        type="date"
                        value={transferForm.transferDate}
                        onChange={(e) => setTransferForm(prev => ({ ...prev, transferDate: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Reason *
                      </label>
                      <input
                        type="text"
                        value={transferForm.reason}
                        onChange={(e) => setTransferForm(prev => ({ ...prev, reason: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., Consolidation, Quality adjustment"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Notes
                      </label>
                      <textarea
                        value={transferForm.notes}
                        onChange={(e) => setTransferForm(prev => ({ ...prev, notes: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                        rows={3}
                        placeholder="Additional details about the transfer"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={handleTransfer}
                      disabled={submitting || !transferForm.fromLotId || !transferForm.toLotId || !transferForm.quantity || !transferForm.reason}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 inline animate-spin mr-2" />
                          Transferring...
                        </>
                      ) : (
                        'Transfer'
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Search and Filters for Transfer */}
              <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4 mb-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  {/* Search */}
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={transferSearchTerm}
                      onChange={(e) => setTransferSearchTerm(e.target.value)}
                      placeholder="Search by lot IDs, reason, notes..."
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    {transferSearchTerm && (
                      <button
                        onClick={() => setTransferSearchTerm('')}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  
                  {/* Export Button - Only for R/W users */}
                  {canWrite && (
                    <button
                      onClick={() => exportTransferRecords(filteredTransferRecords)}
                      className="flex items-center justify-center gap-2 px-4 py-2 border-2 border-blue-300 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-all font-medium"
                      title="Export to Excel"
                    >
                      <Download className="w-4 h-4" />
                      <span className="text-sm">Export</span>
                    </button>
                  )}
                  
                  {/* Filter Toggle */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowTransferFilters(!showTransferFilters);
                    }}
                    className={`flex items-center justify-center gap-2 px-4 py-2 border-2 rounded-lg transition-all font-medium ${
                      showTransferFilters || transferFilterLotType !== 'all' || transferFilterDateFrom || transferFilterDateTo || transferFilterTransferId || transferFilterFromLotId !== 'all' || transferFilterToLotId !== 'all' || transferFilterReason || transferFilterQuantityMin || transferFilterQuantityMax || transferFilterCreatedBy !== 'all'
                        ? 'bg-blue-50 border-blue-400 text-blue-700 shadow-sm'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400'
                    }`}
                  >
                    <Filter className="w-4 h-4" />
                    <span className="text-sm">Filters</span>
                    {(() => {
                      const activeFiltersCount = [
                        transferFilterLotType !== 'all',
                        transferFilterDateFrom,
                        transferFilterDateTo,
                        transferFilterTransferId,
                        transferFilterFromLotId !== 'all',
                        transferFilterToLotId !== 'all',
                        transferFilterReason,
                        transferFilterQuantityMin,
                        transferFilterQuantityMax,
                        transferFilterCreatedBy !== 'all',
                      ].filter(Boolean).length;
                      return activeFiltersCount > 0 && (
                        <span className="bg-blue-600 text-white text-xs font-semibold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                          {activeFiltersCount}
                        </span>
                      );
                    })()}
                  </button>
                </div>

                {/* Filter Panel */}
                {showTransferFilters && (
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3 pt-3 border-t border-gray-200">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Lot Type
                      </label>
                      <select
                        value={transferFilterLotType}
                        onChange={(e) => setTransferFilterLotType(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="all">All Types</option>
                        <option value="raw_material">Raw Material</option>
                        <option value="recurring_product">Recurring Product</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Transfer ID
                      </label>
                      <input
                        type="text"
                        value={transferFilterTransferId}
                        onChange={(e) => setTransferFilterTransferId(e.target.value)}
                        placeholder="e.g., TRANSFER-001"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        From Lot
                      </label>
                      <select
                        value={transferFilterFromLotId}
                        onChange={(e) => setTransferFilterFromLotId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="all">All Lots</option>
                        {transferFilterLotType === 'raw_material' || transferFilterLotType === 'all'
                          ? rawMaterials.map((lot) => (
                              <option key={lot.id} value={lot.id}>
                                {lot.lot_id} - {lot.name}
                              </option>
                            ))
                          : null}
                        {transferFilterLotType === 'recurring_product' || transferFilterLotType === 'all'
                          ? recurringProducts.map((lot) => (
                              <option key={lot.id} value={lot.id}>
                                {lot.lot_id} - {lot.name}
                              </option>
                            ))
                          : null}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        To Lot
                      </label>
                      <select
                        value={transferFilterToLotId}
                        onChange={(e) => setTransferFilterToLotId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="all">All Lots</option>
                        {transferFilterLotType === 'raw_material' || transferFilterLotType === 'all'
                          ? rawMaterials.map((lot) => (
                              <option key={lot.id} value={lot.id}>
                                {lot.lot_id} - {lot.name}
                              </option>
                            ))
                          : null}
                        {transferFilterLotType === 'recurring_product' || transferFilterLotType === 'all'
                          ? recurringProducts.map((lot) => (
                              <option key={lot.id} value={lot.id}>
                                {lot.lot_id} - {lot.name}
                              </option>
                            ))
                          : null}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Reason
                      </label>
                      <input
                        type="text"
                        value={transferFilterReason}
                        onChange={(e) => setTransferFilterReason(e.target.value)}
                        placeholder="Filter by reason"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Date From
                      </label>
                      <input
                        type="date"
                        value={transferFilterDateFrom}
                        onChange={(e) => setTransferFilterDateFrom(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Date To
                      </label>
                      <input
                        type="date"
                        value={transferFilterDateTo}
                        onChange={(e) => setTransferFilterDateTo(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Quantity Min
                      </label>
                      <input
                        type="number"
                        value={transferFilterQuantityMin}
                        onChange={(e) => setTransferFilterQuantityMin(e.target.value)}
                        placeholder="Min quantity"
                        step="any"
                        min="0"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Quantity Max
                      </label>
                      <input
                        type="number"
                        value={transferFilterQuantityMax}
                        onChange={(e) => setTransferFilterQuantityMax(e.target.value)}
                        placeholder="Max quantity"
                        step="any"
                        min="0"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Created By
                      </label>
                      <select
                        value={transferFilterCreatedBy}
                        onChange={(e) => setTransferFilterCreatedBy(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="all">All Users</option>
                        {users.map((user) => (
                          <option key={user.id} value={user.auth_user_id}>
                            {user.full_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-3 lg:col-span-4 flex items-end">
                      <button
                        onClick={() => {
                          setTransferFilterLotType('all');
                          setTransferFilterDateFrom('');
                          setTransferFilterDateTo('');
                          setTransferFilterTransferId('');
                          setTransferFilterFromLotId('all');
                          setTransferFilterToLotId('all');
                          setTransferFilterReason('');
                          setTransferFilterQuantityMin('');
                          setTransferFilterQuantityMax('');
                          setTransferFilterCreatedBy('all');
                          setTransferSearchTerm('');
                        }}
                        className="w-full px-3 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        Clear All Filters
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Transfer History */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Transfer History</h3>
                {/* Desktop Table View */}
                <div className="hidden lg:block bg-white border border-gray-200 rounded-lg overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Transfer ID</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Transfer Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">From Lot</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">From Qty Before</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">To Lot</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">To Qty Before</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity Transferred</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">From Qty After</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">To Qty After</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {loading ? (
                        <tr>
                          <td colSpan={11} className="px-4 py-8 text-center text-gray-500">
                            <div className="flex flex-col items-center gap-2">
                              <Loader2 className="w-5 h-5 animate-spin" />
                              <span>Loading transfer records...</span>
                            </div>
                          </td>
                        </tr>
                      ) : filteredTransferRecords.length === 0 ? (
                        <tr>
                          <td colSpan={11} className="px-4 py-8 text-center text-gray-500">
                            <div className="flex flex-col items-center gap-2">
                              <ArrowRightLeft className="w-8 h-8 text-gray-400" />
                              <span>{transferRecords.length === 0 ? 'No transfer records found' : 'No records match your filters'}</span>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        filteredTransferRecords.map((record) => {
                          // Find the from lot and to lot for calculation
                          const fromLot = (record.lot_type === 'raw_material' ? rawMaterials : recurringProducts).find(l => l.id === record.from_lot_id);
                          const toLot = (record.lot_type === 'raw_material' ? rawMaterials : recurringProducts).find(l => l.id === record.to_lot_id);
                          if (!fromLot || !toLot) {
                            return null;
                          }
                          
                          // Get all waste and transfer records for the FROM lot, sorted chronologically by date then created_at
                          const fromLotWasteRecords = wasteRecords
                            .filter(r => r.lot_id === record.from_lot_id)
                            .sort((a, b) => {
                              const dateCompare = a.waste_date.localeCompare(b.waste_date);
                              if (dateCompare !== 0) return dateCompare;
                              return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                            });
                          const fromLotTransferOutRecords = transferRecords
                            .filter(r => r.from_lot_id === record.from_lot_id)
                            .sort((a, b) => {
                              const dateCompare = a.transfer_date.localeCompare(b.transfer_date);
                              if (dateCompare !== 0) return dateCompare;
                              return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                            });
                          const fromLotTransferInRecords = transferRecords
                            .filter(r => r.to_lot_id === record.from_lot_id)
                            .sort((a, b) => {
                              const dateCompare = a.transfer_date.localeCompare(b.transfer_date);
                              if (dateCompare !== 0) return dateCompare;
                              return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                            });
                          
                          // Combine all operations for FROM lot and sort by date, then by created_at for proper chronological order
                          const allFromLotOperations: Array<{date: string; createdAt: string; type: 'waste' | 'transfer_out' | 'transfer_in'; quantity: number; id: string}> = [
                            ...fromLotWasteRecords.map(r => ({date: r.waste_date, createdAt: r.created_at, type: 'waste' as const, quantity: r.quantity_wasted, id: r.id})),
                            ...fromLotTransferOutRecords.map(r => ({date: r.transfer_date, createdAt: r.created_at, type: 'transfer_out' as const, quantity: r.quantity_transferred, id: r.id})),
                            ...fromLotTransferInRecords.map(r => ({date: r.transfer_date, createdAt: r.created_at, type: 'transfer_in' as const, quantity: r.quantity_transferred, id: r.id})),
                          ].sort((a, b) => {
                            const dateCompare = a.date.localeCompare(b.date);
                            if (dateCompare !== 0) return dateCompare;
                            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                          });
                          
                          // Find the index of current transfer record
                          const currentIndex = allFromLotOperations.findIndex(op => op.id === record.id && op.type === 'transfer_out');
                          
                          if (currentIndex === -1) {
                            // Record not found in operations, skip calculation
                            return null;
                          }
                          
                          // Calculate quantity before: Start from quantity_available, add back operations that happened AFTER this record
                          // (excluding this record itself - that's why we start from currentIndex + 1)
                          let fromQuantityBefore = fromLot.quantity_available;
                          for (let i = currentIndex + 1; i < allFromLotOperations.length; i++) {
                            const op = allFromLotOperations[i];
                            if (op.type === 'waste' || op.type === 'transfer_out') {
                              fromQuantityBefore += op.quantity; // Add back what was removed after this record
                            } else if (op.type === 'transfer_in') {
                              fromQuantityBefore -= op.quantity; // Subtract what was added after this record
                            }
                          }
                          // Now add back THIS operation to get quantity before this transfer
                          fromQuantityBefore += record.quantity_transferred;
                          const fromQuantityAfter = fromQuantityBefore - record.quantity_transferred;

                          // Calculate quantities for TO lot
                          // Get all waste and transfer records for the TO lot
                          const toLotWasteRecords = wasteRecords
                            .filter(r => r.lot_id === record.to_lot_id)
                            .sort((a, b) => {
                              const dateCompare = a.waste_date.localeCompare(b.waste_date);
                              if (dateCompare !== 0) return dateCompare;
                              return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                            });
                          const toLotTransferOutRecords = transferRecords
                            .filter(r => r.from_lot_id === record.to_lot_id)
                            .sort((a, b) => {
                              const dateCompare = a.transfer_date.localeCompare(b.transfer_date);
                              if (dateCompare !== 0) return dateCompare;
                              return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                            });
                          const toLotTransferInRecords = transferRecords
                            .filter(r => r.to_lot_id === record.to_lot_id)
                            .sort((a, b) => {
                              const dateCompare = a.transfer_date.localeCompare(b.transfer_date);
                              if (dateCompare !== 0) return dateCompare;
                              return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                            });
                          
                          // Combine all operations for TO lot and sort by date, then by created_at
                          const allToLotOperations: Array<{date: string; createdAt: string; type: 'waste' | 'transfer_out' | 'transfer_in'; quantity: number; id: string}> = [
                            ...toLotWasteRecords.map(r => ({date: r.waste_date, createdAt: r.created_at, type: 'waste' as const, quantity: r.quantity_wasted, id: r.id})),
                            ...toLotTransferOutRecords.map(r => ({date: r.transfer_date, createdAt: r.created_at, type: 'transfer_out' as const, quantity: r.quantity_transferred, id: r.id})),
                            ...toLotTransferInRecords.map(r => ({date: r.transfer_date, createdAt: r.created_at, type: 'transfer_in' as const, quantity: r.quantity_transferred, id: r.id})),
                          ].sort((a, b) => {
                            const dateCompare = a.date.localeCompare(b.date);
                            if (dateCompare !== 0) return dateCompare;
                            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                          });
                          
                          // Find the index of current transfer record in TO lot operations (as transfer_in)
                          const toLotCurrentIndex = allToLotOperations.findIndex(op => op.id === record.id && op.type === 'transfer_in');
                          
                          // Calculate quantity before for TO lot: Start from quantity_available
                          let toQuantityBefore = toLot.quantity_available;
                          
                          if (toLotCurrentIndex !== -1) {
                            // Add back operations that happened AFTER this transfer (excluding this transfer itself)
                            for (let i = toLotCurrentIndex + 1; i < allToLotOperations.length; i++) {
                              const op = allToLotOperations[i];
                              if (op.type === 'waste' || op.type === 'transfer_out') {
                                toQuantityBefore += op.quantity; // Add back what was removed after this record
                              } else if (op.type === 'transfer_in') {
                                toQuantityBefore -= op.quantity; // Subtract what was added after this record
                              }
                            }
                            // Subtract THIS transfer to get quantity before (because transfer IN adds to TO lot)
                            toQuantityBefore -= record.quantity_transferred;
                          } else {
                            // If not found, fallback calculation: assume no operations after
                            toQuantityBefore = toLot.quantity_available - record.quantity_transferred;
                          }
                          
                          const toQuantityAfter = toQuantityBefore + record.quantity_transferred;

                          return (
                            <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-3 font-mono text-xs text-gray-900">{record.transfer_id || '—'}</td>
                              <td className="px-4 py-3 text-gray-700">{record.transfer_date}</td>
                              <td className="px-4 py-3">
                                <div className="flex flex-col">
                                  <span className="font-mono text-xs text-gray-900">{record.from_lot_identifier}</span>
                                  <span className="text-xs text-gray-600">{record.from_lot_name || '—'}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 font-medium text-gray-900">
                                {fromQuantityBefore.toFixed(2)} {record.unit}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-col">
                                  <span className="font-mono text-xs text-gray-900">{record.to_lot_identifier}</span>
                                  <span className="text-xs text-gray-600">{record.to_lot_name || '—'}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 font-medium text-gray-900">
                                {toQuantityBefore.toFixed(2)} {record.unit}
                              </td>
                              <td className="px-4 py-3 font-medium text-blue-700">
                                {record.quantity_transferred.toFixed(2)} {record.unit}
                              </td>
                              <td className="px-4 py-3 font-medium text-gray-900">
                                {fromQuantityAfter.toFixed(2)} {record.unit}
                              </td>
                              <td className="px-4 py-3 font-medium text-green-700">
                                {toQuantityAfter.toFixed(2)} {record.unit}
                              </td>
                              <td className="px-4 py-3 text-gray-700 text-xs">{record.reason}</td>
                              <td className="px-4 py-3 text-gray-600 text-xs max-w-xs truncate" title={record.notes || undefined}>
                                {record.notes || '—'}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="lg:hidden space-y-3">
                  {loading ? (
                    <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                        <span className="text-gray-500">Loading transfer records...</span>
                      </div>
                    </div>
                  ) : filteredTransferRecords.length === 0 ? (
                    <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <ArrowRightLeft className="w-8 h-8 text-gray-400" />
                        <span className="text-gray-500">{transferRecords.length === 0 ? 'No transfer records found' : 'No records match your filters'}</span>
                      </div>
                    </div>
                  ) : (
                    filteredTransferRecords.map((record) => {
                      // Find the from lot and to lot for calculation
                      const fromLot = (record.lot_type === 'raw_material' ? rawMaterials : recurringProducts).find(l => l.id === record.from_lot_id);
                      const toLot = (record.lot_type === 'raw_material' ? rawMaterials : recurringProducts).find(l => l.id === record.to_lot_id);
                      if (!fromLot || !toLot) {
                        return null;
                      }
                      
                      // Get all waste and transfer records for the FROM lot, sorted chronologically by date then created_at
                      const fromLotWasteRecords = wasteRecords
                        .filter(r => r.lot_id === record.from_lot_id)
                        .sort((a, b) => {
                          const dateCompare = a.waste_date.localeCompare(b.waste_date);
                          if (dateCompare !== 0) return dateCompare;
                          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                        });
                      const fromLotTransferOutRecords = transferRecords
                        .filter(r => r.from_lot_id === record.from_lot_id)
                        .sort((a, b) => {
                          const dateCompare = a.transfer_date.localeCompare(b.transfer_date);
                          if (dateCompare !== 0) return dateCompare;
                          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                        });
                      const fromLotTransferInRecords = transferRecords
                        .filter(r => r.to_lot_id === record.from_lot_id)
                        .sort((a, b) => {
                          const dateCompare = a.transfer_date.localeCompare(b.transfer_date);
                          if (dateCompare !== 0) return dateCompare;
                          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                        });
                      
                      // Combine all operations for FROM lot and sort by date, then by created_at for proper chronological order
                      const allFromLotOperations: Array<{date: string; createdAt: string; type: 'waste' | 'transfer_out' | 'transfer_in'; quantity: number; id: string}> = [
                        ...fromLotWasteRecords.map(r => ({date: r.waste_date, createdAt: r.created_at, type: 'waste' as const, quantity: r.quantity_wasted, id: r.id})),
                        ...fromLotTransferOutRecords.map(r => ({date: r.transfer_date, createdAt: r.created_at, type: 'transfer_out' as const, quantity: r.quantity_transferred, id: r.id})),
                        ...fromLotTransferInRecords.map(r => ({date: r.transfer_date, createdAt: r.created_at, type: 'transfer_in' as const, quantity: r.quantity_transferred, id: r.id})),
                      ].sort((a, b) => {
                        const dateCompare = a.date.localeCompare(b.date);
                        if (dateCompare !== 0) return dateCompare;
                        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                      });
                      
                      // Find the index of current transfer record
                      const currentIndex = allFromLotOperations.findIndex(op => op.id === record.id && op.type === 'transfer_out');
                      
                      if (currentIndex === -1) {
                        // Record not found in operations, skip calculation
                        return null;
                      }
                      
                      // Calculate quantity before: Start from quantity_available, add back operations that happened AFTER this record
                      // (excluding this record itself - that's why we start from currentIndex + 1)
                      let fromQuantityBefore = fromLot.quantity_available;
                      for (let i = currentIndex + 1; i < allFromLotOperations.length; i++) {
                        const op = allFromLotOperations[i];
                        if (op.type === 'waste' || op.type === 'transfer_out') {
                          fromQuantityBefore += op.quantity; // Add back what was removed after this record
                        } else if (op.type === 'transfer_in') {
                          fromQuantityBefore -= op.quantity; // Subtract what was added after this record
                        }
                      }
                      // Now add back THIS operation to get quantity before this transfer
                      fromQuantityBefore += record.quantity_transferred;
                      const fromQuantityAfter = fromQuantityBefore - record.quantity_transferred;

                      // Calculate quantities for TO lot
                      const toLotWasteRecords = wasteRecords
                        .filter(r => r.lot_id === record.to_lot_id)
                        .sort((a, b) => {
                          const dateCompare = a.waste_date.localeCompare(b.waste_date);
                          if (dateCompare !== 0) return dateCompare;
                          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                        });
                      const toLotTransferOutRecords = transferRecords
                        .filter(r => r.from_lot_id === record.to_lot_id)
                        .sort((a, b) => {
                          const dateCompare = a.transfer_date.localeCompare(b.transfer_date);
                          if (dateCompare !== 0) return dateCompare;
                          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                        });
                      const toLotTransferInRecords = transferRecords
                        .filter(r => r.to_lot_id === record.to_lot_id)
                        .sort((a, b) => {
                          const dateCompare = a.transfer_date.localeCompare(b.transfer_date);
                          if (dateCompare !== 0) return dateCompare;
                          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                        });
                      
                      const allToLotOperations: Array<{date: string; createdAt: string; type: 'waste' | 'transfer_out' | 'transfer_in'; quantity: number; id: string}> = [
                        ...toLotWasteRecords.map(r => ({date: r.waste_date, createdAt: r.created_at, type: 'waste' as const, quantity: r.quantity_wasted, id: r.id})),
                        ...toLotTransferOutRecords.map(r => ({date: r.transfer_date, createdAt: r.created_at, type: 'transfer_out' as const, quantity: r.quantity_transferred, id: r.id})),
                        ...toLotTransferInRecords.map(r => ({date: r.transfer_date, createdAt: r.created_at, type: 'transfer_in' as const, quantity: r.quantity_transferred, id: r.id})),
                      ].sort((a, b) => {
                        const dateCompare = a.date.localeCompare(b.date);
                        if (dateCompare !== 0) return dateCompare;
                        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                      });
                      
                      const toLotCurrentIndex = allToLotOperations.findIndex(op => op.id === record.id && op.type === 'transfer_in');
                      
                      let toQuantityBefore = toLot.quantity_available;
                      
                      if (toLotCurrentIndex !== -1) {
                        for (let i = toLotCurrentIndex + 1; i < allToLotOperations.length; i++) {
                          const op = allToLotOperations[i];
                          if (op.type === 'waste' || op.type === 'transfer_out') {
                            toQuantityBefore += op.quantity;
                          } else if (op.type === 'transfer_in') {
                            toQuantityBefore -= op.quantity;
                          }
                        }
                        toQuantityBefore -= record.quantity_transferred;
                      } else {
                        toQuantityBefore = toLot.quantity_available - record.quantity_transferred;
                      }
                      
                      const toQuantityAfter = toQuantityBefore + record.quantity_transferred;

                      return (
                        <div key={record.id} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-mono text-xs font-semibold text-gray-900 mb-1">{record.transfer_id || '—'}</p>
                              <p className="text-xs text-gray-500 mb-2">{record.transfer_date}</p>
                              <div className="flex items-center gap-2 mb-2">
                                <div className="flex flex-col">
                                  <span className="font-mono text-xs text-gray-900">From: {record.from_lot_identifier}</span>
                                  <span className="text-xs text-gray-600">{record.from_lot_name || '—'}</span>
                                </div>
                                <ArrowRightLeft className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                <div className="flex flex-col">
                                  <span className="font-mono text-xs text-gray-900">To: {record.to_lot_identifier}</span>
                                  <span className="text-xs text-gray-600">{record.to_lot_name || '—'}</span>
                                </div>
                              </div>
                            </div>
                            <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                              {record.lot_type === 'raw_material' ? 'Raw Material' : 'Recurring Product'}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm border-t pt-2">
                            <div>
                              <span className="text-gray-500 text-xs">From Lot - Qty Before:</span>
                              <p className="font-medium text-gray-900">{fromQuantityBefore.toFixed(2)} {record.unit}</p>
                            </div>
                            <div>
                              <span className="text-gray-500 text-xs">To Lot - Qty Before:</span>
                              <p className="font-medium text-gray-900">{toQuantityBefore.toFixed(2)} {record.unit}</p>
                            </div>
                            <div className="col-span-2">
                              <span className="text-gray-500 text-xs">Quantity Transferred:</span>
                              <p className="font-medium text-blue-700">{record.quantity_transferred.toFixed(2)} {record.unit}</p>
                            </div>
                            <div>
                              <span className="text-gray-500 text-xs">From Lot - Qty After:</span>
                              <p className="font-medium text-gray-900">{fromQuantityAfter.toFixed(2)} {record.unit}</p>
                            </div>
                            <div>
                              <span className="text-gray-500 text-xs">To Lot - Qty After:</span>
                              <p className="font-medium text-green-700">{toQuantityAfter.toFixed(2)} {record.unit}</p>
                            </div>
                          </div>
                          <div className="text-sm border-t pt-2">
                            <span className="text-gray-500 text-xs">Reason:</span>
                            <p className="text-gray-900 mt-1">{record.reason}</p>
                          </div>
                          {record.notes && (
                            <div className="text-sm border-t pt-2">
                              <span className="text-gray-500 text-xs">Notes:</span>
                              <p className="text-gray-900 mt-1">{record.notes}</p>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

