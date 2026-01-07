import { useEffect, useState } from 'react';
import { RefreshCw, AlertTriangle, ArrowRightLeft, Trash2, Package, Loader2 } from 'lucide-react';
import type { AccessLevel } from '../types/access';
import type { RawMaterial, RecurringProduct, WasteRecord, TransferRecord } from '../types/operations';
import {
  fetchRawMaterials,
  fetchRecurringProducts,
  recordWaste,
  transferBetweenLots,
  fetchWasteRecords,
  fetchTransferRecords,
  checkRawMaterialInLockedBatches,
  checkRecurringProductInLockedBatches,
} from '../lib/operations';
import { useModuleAccess } from '../contexts/ModuleAccessContext';

interface WasteTransferManagementProps {
  accessLevel: AccessLevel;
}

type TabType = 'waste' | 'transfer';

export function WasteTransferManagement({ accessLevel }: WasteTransferManagementProps) {
  const { userId } = useModuleAccess();
  const canWrite = accessLevel === 'read-write';
  const [activeTab, setActiveTab] = useState<TabType>('waste');

  // Data state
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [recurringProducts, setRecurringProducts] = useState<RecurringProduct[]>([]);
  const [wasteRecords, setWasteRecords] = useState<WasteRecord[]>([]);
  const [transferRecords, setTransferRecords] = useState<TransferRecord[]>([]);
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

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [rawMaterialsData, recurringProductsData, wasteData, transferData] = await Promise.all([
        fetchRawMaterials(),
        fetchRecurringProducts(),
        fetchWasteRecords(),
        fetchTransferRecords(),
      ]);
      setRawMaterials(rawMaterialsData);
      setRecurringProducts(recurringProductsData);
      setWasteRecords(wasteData);
      setTransferRecords(transferData);
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
        userId || undefined
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
        userId || undefined
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
                        step="0.01"
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

              {/* Waste History */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Waste History</h3>
                {/* Desktop Table View */}
                <div className="hidden lg:block bg-white border border-gray-200 rounded-lg overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lot ID</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recorded By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {loading ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                            <div className="flex flex-col items-center gap-2">
                              <Loader2 className="w-5 h-5 animate-spin" />
                              <span>Loading waste records...</span>
                            </div>
                          </td>
                        </tr>
                      ) : wasteRecords.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                            <div className="flex flex-col items-center gap-2">
                              <Trash2 className="w-8 h-8 text-gray-400" />
                              <span>No waste records found</span>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        wasteRecords.map((record) => (
                          <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 text-gray-700">{record.waste_date}</td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                                {record.lot_type === 'raw_material' ? 'Raw Material' : 'Recurring Product'}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-mono text-gray-900">{record.lot_identifier}</td>
                            <td className="px-4 py-3 font-medium text-gray-900">
                              {record.quantity_wasted} {record.unit}
                            </td>
                            <td className="px-4 py-3 text-gray-700">{record.reason}</td>
                            <td className="px-4 py-3 text-gray-700">{record.created_by_name || '—'}</td>
                          </tr>
                        ))
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
                  ) : wasteRecords.length === 0 ? (
                    <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Trash2 className="w-8 h-8 text-gray-400" />
                        <span className="text-gray-500">No waste records found</span>
                      </div>
                    </div>
                  ) : (
                    wasteRecords.map((record) => (
                      <div key={record.id} className="bg-white border border-gray-200 rounded-lg p-4 space-y-2">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-mono text-sm font-semibold text-gray-900">{record.lot_identifier}</p>
                            <p className="text-xs text-gray-500 mt-1">{record.waste_date}</p>
                          </div>
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                            {record.lot_type === 'raw_material' ? 'Raw Material' : 'Recurring Product'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-gray-500">Quantity:</span>
                            <span className="ml-1 font-medium text-gray-900">{record.quantity_wasted} {record.unit}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Recorded By:</span>
                            <span className="ml-1 text-gray-900">{record.created_by_name || '—'}</span>
                          </div>
                          <div className="col-span-2">
                            <span className="text-gray-500">Reason:</span>
                            <span className="ml-1 text-gray-900">{record.reason}</span>
                          </div>
                        </div>
                      </div>
                    ))
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
                        step="0.01"
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

              {/* Transfer History */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Transfer History</h3>
                {/* Desktop Table View */}
                <div className="hidden lg:block bg-white border border-gray-200 rounded-lg overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">From Lot</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">To Lot</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recorded By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {loading ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                            <div className="flex flex-col items-center gap-2">
                              <Loader2 className="w-5 h-5 animate-spin" />
                              <span>Loading transfer records...</span>
                            </div>
                          </td>
                        </tr>
                      ) : transferRecords.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                            <div className="flex flex-col items-center gap-2">
                              <ArrowRightLeft className="w-8 h-8 text-gray-400" />
                              <span>No transfer records found</span>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        transferRecords.map((record) => (
                          <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 text-gray-700">{record.transfer_date}</td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                                {record.lot_type === 'raw_material' ? 'Raw Material' : 'Recurring Product'}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-mono text-gray-900">{record.from_lot_identifier}</td>
                            <td className="px-4 py-3 font-mono text-gray-900">{record.to_lot_identifier}</td>
                            <td className="px-4 py-3 font-medium text-gray-900">
                              {record.quantity_transferred} {record.unit}
                            </td>
                            <td className="px-4 py-3 text-gray-700">{record.reason}</td>
                            <td className="px-4 py-3 text-gray-700">{record.created_by_name || '—'}</td>
                          </tr>
                        ))
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
                  ) : transferRecords.length === 0 ? (
                    <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <ArrowRightLeft className="w-8 h-8 text-gray-400" />
                        <span className="text-gray-500">No transfer records found</span>
                      </div>
                    </div>
                  ) : (
                    transferRecords.map((record) => (
                      <div key={record.id} className="bg-white border border-gray-200 rounded-lg p-4 space-y-2">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-semibold text-gray-900">{record.from_lot_identifier}</span>
                              <ArrowRightLeft className="w-4 h-4 text-gray-400" />
                              <span className="font-mono text-sm font-semibold text-gray-900">{record.to_lot_identifier}</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{record.transfer_date}</p>
                          </div>
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                            {record.lot_type === 'raw_material' ? 'Raw Material' : 'Recurring Product'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-gray-500">Quantity:</span>
                            <span className="ml-1 font-medium text-gray-900">{record.quantity_transferred} {record.unit}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Recorded By:</span>
                            <span className="ml-1 text-gray-900">{record.created_by_name || '—'}</span>
                          </div>
                          <div className="col-span-2">
                            <span className="text-gray-500">Reason:</span>
                            <span className="ml-1 text-gray-900">{record.reason}</span>
                          </div>
                        </div>
                      </div>
                    ))
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

