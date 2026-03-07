import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Package, ShoppingBag, DollarSign, Plus } from 'lucide-react';
import type { AccessLevel } from '../types/access';
import { useAuth } from '../contexts/AuthContext';
import type { InventoryTarget, InventoryTargetFormData, InventoryTargetProgress } from '../types/inventory-targets';
import type { SalesTarget, SalesTargetFormData, SalesTargetProgress } from '../types/sales-targets';
import type { FinanceTarget, FinanceTargetFormData, FinanceTargetProgress } from '../types/finance-targets';
import { InventoryTargetModal } from '../components/InventoryTargetModal';
import { InventoryTargetCard } from '../components/InventoryTargetCard';
import { SalesTargetModal } from '../components/SalesTargetModal';
import { SalesTargetCard } from '../components/SalesTargetCard';
import { FinanceTargetModal } from '../components/FinanceTargetModal';
import { FinanceTargetCard } from '../components/FinanceTargetCard';
import {
  fetchInventoryTargetsWithProgress,
  createInventoryTarget,
  updateInventoryTarget,
  deleteInventoryTarget,
  updateInventoryTargetStatus,
} from '../lib/inventory-targets';
import {
  fetchTargetsWithProgress as fetchSalesTargetsWithProgress,
  createSalesTarget,
  updateSalesTarget,
  deleteSalesTarget,
  updateTargetStatus as updateSalesTargetStatus,
} from '../lib/sales-targets';
import {
  fetchFinanceTargetsWithProgress,
  createFinanceTarget,
  updateFinanceTarget,
  deleteFinanceTarget,
  updateFinanceTargetStatus,
} from '../lib/finance-targets';

interface TargetsOverviewProps {
  accessLevel: AccessLevel;
}

type TargetCategory = 'sales' | 'inventory' | 'finance';
type ModalMode = 'create' | 'edit';

export function TargetsOverview({ accessLevel }: TargetsOverviewProps) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  
  // Check if user has R/W access to Analytics module (admins have this by default)
  const hasWriteAccess = accessLevel === 'read-write';

  // Separate states for each target type
  const [inventoryTargets, setInventoryTargets] = useState<InventoryTargetProgress[]>([]);
  const [salesTargets, setSalesTargets] = useState<SalesTargetProgress[]>([]);
  const [financeTargets, setFinanceTargets] = useState<FinanceTargetProgress[]>([]);

  // Modal states
  const [activeCategory, setActiveCategory] = useState<TargetCategory | null>(null);
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [selectedInventoryTarget, setSelectedInventoryTarget] = useState<InventoryTarget | null>(null);
  const [selectedSalesTarget, setSelectedSalesTarget] = useState<SalesTarget | null>(null);
  const [selectedFinanceTarget, setSelectedFinanceTarget] = useState<FinanceTarget | null>(null);

  useEffect(() => {
    loadTargets();
  }, []);

  const loadTargets = async () => {
    setLoading(true);
    try {
      const [inventory, sales, finance] = await Promise.all([
        fetchInventoryTargetsWithProgress('active'),
        fetchSalesTargetsWithProgress('active'),
        fetchFinanceTargetsWithProgress('active'),
      ]);
      setInventoryTargets(inventory);
      setSalesTargets(sales);
      setFinanceTargets(finance);
    } catch (err) {
      console.error('Failed to load targets:', err);
    } finally {
      setLoading(false);
    }
  };

  // Inventory target handlers
  const handleCreateInventoryTarget = async (formData: InventoryTargetFormData) => {
    if (!profile) return;
    await createInventoryTarget(formData, profile.id);
    await loadTargets();
    setActiveCategory(null);
  };

  const handleUpdateInventoryTarget = async (formData: InventoryTargetFormData) => {
    if (!profile || !selectedInventoryTarget) return;
    await updateInventoryTarget(selectedInventoryTarget.id, formData, profile.id);
    await loadTargets();
    setActiveCategory(null);
    setSelectedInventoryTarget(null);
  };

  const handleDeleteInventoryTarget = async (targetId: string) => {
    if (!confirm('Are you sure you want to delete this target?')) return;
    await deleteInventoryTarget(targetId);
    await loadTargets();
  };

  const handleInventoryStatusChange = async (targetId: string, status: 'active' | 'completed' | 'cancelled') => {
    if (!profile) return;
    await updateInventoryTargetStatus(targetId, status, profile.id);
    await loadTargets();
  };

  // Sales target handlers
  const handleCreateSalesTarget = async (formData: SalesTargetFormData) => {
    if (!profile) return;
    await createSalesTarget(formData, profile.id);
    await loadTargets();
    setActiveCategory(null);
  };

  const handleUpdateSalesTarget = async (formData: SalesTargetFormData) => {
    if (!profile || !selectedSalesTarget) return;
    await updateSalesTarget(selectedSalesTarget.id, formData, profile.id);
    await loadTargets();
    setActiveCategory(null);
    setSelectedSalesTarget(null);
  };

  const handleDeleteSalesTarget = async (targetId: string) => {
    if (!confirm('Are you sure you want to delete this target?')) return;
    await deleteSalesTarget(targetId);
    await loadTargets();
  };

  const handleSalesStatusChange = async (targetId: string, status: 'active' | 'completed' | 'cancelled') => {
    if (!profile) return;
    await updateSalesTargetStatus(targetId, status, profile.id);
    await loadTargets();
  };

  // Finance target handlers
  const handleCreateFinanceTarget = async (formData: FinanceTargetFormData) => {
    if (!profile) return;
    await createFinanceTarget(formData, profile.id);
    await loadTargets();
    setActiveCategory(null);
  };

  const handleUpdateFinanceTarget = async (formData: FinanceTargetFormData) => {
    if (!profile || !selectedFinanceTarget) return;
    await updateFinanceTarget(selectedFinanceTarget.id, formData, profile.id);
    await loadTargets();
    setActiveCategory(null);
    setSelectedFinanceTarget(null);
  };

  const handleDeleteFinanceTarget = async (targetId: string) => {
    if (!confirm('Are you sure you want to delete this target?')) return;
    await deleteFinanceTarget(targetId);
    await loadTargets();
  };

  const handleFinanceStatusChange = async (targetId: string, status: 'active' | 'completed' | 'cancelled') => {
    if (!profile) return;
    await updateFinanceTargetStatus(targetId, status, profile.id);
    await loadTargets();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading targets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="relative rounded-[2rem] bg-slate-900 p-8 sm:p-10 text-white shadow-2xl overflow-hidden mb-8 border border-slate-800">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 opacity-30 pointer-events-none">
          <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full bg-rose-600 blur-[100px]"></div>
          <div className="absolute top-20 -right-10 w-64 h-64 rounded-full bg-pink-600 blur-[80px]"></div>
          <div className="absolute -bottom-20 left-1/3 w-96 h-96 rounded-full bg-purple-600 blur-[100px]"></div>
        </div>

        <div className="relative z-10">
          <button
            type="button"
            onClick={() => navigate('/analytics')}
            className="group flex items-center gap-2 text-slate-400 hover:text-white font-medium mb-6 transition-colors w-fit"
          >
            <div className="p-1.5 rounded-full bg-slate-800 group-hover:bg-slate-700 transition-colors border border-slate-700">
              <ChevronLeft className="w-4 h-4" />
            </div>
            <span className="text-sm tracking-wide">Back to Analytics</span>
          </button>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4 text-transparent bg-clip-text bg-gradient-to-r from-white via-rose-100 to-slate-300">
            Targets Management
          </h1>
          <p className="text-slate-400 text-lg sm:text-xl font-light">
            {hasWriteAccess ? 'Create and manage performance targets across sales, inventory, and finance.' : 'View all performance targets across sales, inventory, and finance.'}
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-emerald-50 to-white rounded-2xl p-6 border border-emerald-100 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-emerald-100 text-emerald-600 rounded-xl">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Sales Targets</h3>
          </div>
          <p className="text-3xl font-bold text-emerald-600">{salesTargets.length}</p>
          <p className="text-sm text-slate-500 mt-1">Active targets</p>
        </div>

        <div className="bg-gradient-to-br from-indigo-50 to-white rounded-2xl p-6 border border-indigo-100 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-indigo-100 text-indigo-600 rounded-xl">
              <Package className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Inventory Targets</h3>
          </div>
          <p className="text-3xl font-bold text-indigo-600">{inventoryTargets.length}</p>
          <p className="text-sm text-slate-500 mt-1">Active targets</p>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-white rounded-2xl p-6 border border-amber-100 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-amber-100 text-amber-600 rounded-xl">
              <DollarSign className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Finance Targets</h3>
          </div>
          <p className="text-3xl font-bold text-amber-600">{financeTargets.length}</p>
          <p className="text-sm text-slate-500 mt-1">Active targets</p>
        </div>
      </div>

      {/* Quick Links for users with R/W access */}
      {hasWriteAccess && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 mb-4">View Targets by Category</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => navigate('/analytics/sales')}
              className="flex items-center gap-3 p-4 rounded-xl border-2 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50 transition-all text-left group"
            >
              <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg group-hover:bg-emerald-200 transition-colors">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">Sales Analytics</p>
                <p className="text-sm text-slate-500">View targets in context</p>
              </div>
            </button>

            <button
              onClick={() => navigate('/analytics/inventory')}
              className="flex items-center gap-3 p-4 rounded-xl border-2 border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50 transition-all text-left group"
            >
              <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg group-hover:bg-indigo-200 transition-colors">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">Inventory Analytics</p>
                <p className="text-sm text-slate-500">View targets in context</p>
              </div>
            </button>

            <button
              onClick={() => navigate('/analytics/finance')}
              className="flex items-center gap-3 p-4 rounded-xl border-2 border-amber-200 hover:border-amber-400 hover:bg-amber-50 transition-all text-left group"
            >
              <div className="p-2 bg-amber-100 text-amber-600 rounded-lg group-hover:bg-amber-200 transition-colors">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">Finance Analytics</p>
                <p className="text-sm text-slate-500">View targets in context</p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Sales Targets Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Sales Targets</h2>
          </div>
          {hasWriteAccess && (
            <button
              onClick={() => {
                setActiveCategory('sales');
                setModalMode('create');
                setSelectedSalesTarget(null);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors font-medium"
            >
              <Plus className="w-4 h-4" />
              Create Sales Target
            </button>
          )}
        </div>

        {salesTargets.length === 0 ? (
          <div className="bg-emerald-50 rounded-xl p-8 text-center border border-emerald-100">
            <ShoppingBag className="w-12 h-12 text-emerald-300 mx-auto mb-3" />
            <p className="text-slate-600">No active sales targets</p>
            {hasWriteAccess && <p className="text-sm text-slate-500 mt-1">Create your first sales target to start tracking performance</p>}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {salesTargets.map((targetProgress) => (
              <SalesTargetCard
                key={targetProgress.target.id}
                targetProgress={targetProgress}
                onEdit={() => {
                  setActiveCategory('sales');
                  setModalMode('edit');
                  setSelectedSalesTarget(targetProgress.target);
                }}
                onDelete={() => handleDeleteSalesTarget(targetProgress.target.id)}
                onStatusChange={(status) => handleSalesStatusChange(targetProgress.target.id, status)}
                hasWriteAccess={hasWriteAccess}
              />
            ))}
          </div>
        )}
      </div>

      {/* Inventory Targets Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
              <Package className="w-5 h-5" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Inventory Targets</h2>
          </div>
          {hasWriteAccess && (
            <button
              onClick={() => {
                setActiveCategory('inventory');
                setModalMode('create');
                setSelectedInventoryTarget(null);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium"
            >
              <Plus className="w-4 h-4" />
              Create Inventory Target
            </button>
          )}
        </div>

        {inventoryTargets.length === 0 ? (
          <div className="bg-indigo-50 rounded-xl p-8 text-center border border-indigo-100">
            <Package className="w-12 h-12 text-indigo-300 mx-auto mb-3" />
            <p className="text-slate-600">No active inventory targets</p>
            {hasWriteAccess && <p className="text-sm text-slate-500 mt-1">Create your first inventory target to start tracking performance</p>}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {inventoryTargets.map((targetProgress) => (
              <InventoryTargetCard
                key={targetProgress.target.id}
                targetProgress={targetProgress}
                onEdit={() => {
                  setActiveCategory('inventory');
                  setModalMode('edit');
                  setSelectedInventoryTarget(targetProgress.target);
                }}
                onDelete={() => handleDeleteInventoryTarget(targetProgress.target.id)}
                onStatusChange={(status) => handleInventoryStatusChange(targetProgress.target.id, status)}
                hasWriteAccess={hasWriteAccess}
              />
            ))}
          </div>
        )}
      </div>

      {/* Finance Targets Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
              <DollarSign className="w-5 h-5" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Finance Targets</h2>
          </div>
          {hasWriteAccess && (
            <button
              onClick={() => {
                setActiveCategory('finance');
                setModalMode('create');
                setSelectedFinanceTarget(null);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors font-medium"
            >
              <Plus className="w-4 h-4" />
              Create Finance Target
            </button>
          )}
        </div>

        {financeTargets.length === 0 ? (
          <div className="bg-amber-50 rounded-xl p-8 text-center border border-amber-100">
            <DollarSign className="w-12 h-12 text-amber-300 mx-auto mb-3" />
            <p className="text-slate-600">No active finance targets</p>
            {hasWriteAccess && <p className="text-sm text-slate-500 mt-1">Create your first finance target to start tracking performance</p>}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {financeTargets.map((targetProgress) => (
              <FinanceTargetCard
                key={targetProgress.target.id}
                targetProgress={targetProgress}
                onEdit={() => {
                  setActiveCategory('finance');
                  setModalMode('edit');
                  setSelectedFinanceTarget(targetProgress.target);
                }}
                onDelete={() => handleDeleteFinanceTarget(targetProgress.target.id)}
                onStatusChange={(status) => handleFinanceStatusChange(targetProgress.target.id, status)}
                hasWriteAccess={hasWriteAccess}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {activeCategory === 'inventory' && (
        <InventoryTargetModal
          isOpen={true}
          onClose={() => {
            setActiveCategory(null);
            setSelectedInventoryTarget(null);
          }}
          onSave={modalMode === 'create' ? handleCreateInventoryTarget : handleUpdateInventoryTarget}
          target={selectedInventoryTarget}
          mode={modalMode}
        />
      )}

      {activeCategory === 'sales' && (
        <SalesTargetModal
          isOpen={true}
          onClose={() => {
            setActiveCategory(null);
            setSelectedSalesTarget(null);
          }}
          onSave={modalMode === 'create' ? handleCreateSalesTarget : handleUpdateSalesTarget}
          target={selectedSalesTarget}
          mode={modalMode}
        />
      )}

      {activeCategory === 'finance' && (
        <FinanceTargetModal
          isOpen={true}
          onClose={() => {
            setActiveCategory(null);
            setSelectedFinanceTarget(null);
          }}
          onSave={modalMode === 'create' ? handleCreateFinanceTarget : handleUpdateFinanceTarget}
          target={selectedFinanceTarget}
          mode={modalMode}
        />
      )}
    </div>
  );
}
