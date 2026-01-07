import { useEffect, useState } from 'react';
import { Plus, RefreshCw, Wrench } from 'lucide-react';
import type { AccessLevel } from '../types/access';
import type { Machine, Supplier } from '../types/operations';
import {
  createMachine,
  deleteMachine,
  fetchMachines,
  fetchSuppliers,
  updateMachine,
} from '../lib/operations';
import { useModuleAccess } from '../contexts/ModuleAccessContext';

interface MachinesProps {
  accessLevel: AccessLevel;
}

export function Machines({ accessLevel }: MachinesProps) {
  const { userId } = useModuleAccess();
  const canWrite = accessLevel === 'read-write';
  const [machines, setMachines] = useState<Machine[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    supplier_id: '',
    purchase_date: '',
    purchase_cost: '',
    status: 'active' as Machine['status'],
    notes: '',
  });

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [machinesData, suppliersData] = await Promise.all([
        fetchMachines(),
        fetchSuppliers(),
      ]);
      setMachines(machinesData);
      setSuppliers(suppliersData);
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

  const handleSubmit = async () => {
    if (!canWrite || !formData.name || !formData.category) {
      setError('Please fill in required fields');
      return;
    }

    try {
      if (editingId) {
        const updated = await updateMachine(editingId, {
          name: formData.name,
          category: formData.category,
          supplier_id: formData.supplier_id || undefined,
          purchase_date: formData.purchase_date || undefined,
          purchase_cost: formData.purchase_cost ? Number(formData.purchase_cost) : undefined,
          status: formData.status,
          notes: formData.notes || undefined,
        });
        setMachines((prev) => prev.map((m) => (m.id === editingId ? updated : m)));
      } else {
        const created = await createMachine({
          name: formData.name,
          category: formData.category,
          supplier_id: formData.supplier_id || undefined,
          purchase_date: formData.purchase_date || undefined,
          purchase_cost: formData.purchase_cost ? Number(formData.purchase_cost) : undefined,
          status: formData.status,
          notes: formData.notes || undefined,
          created_by: userId,
        });
        setMachines((prev) => [created, ...prev]);
      }
      setShowForm(false);
      setEditingId(null);
      setFormData({
        name: '',
        category: '',
        supplier_id: '',
        purchase_date: '',
        purchase_cost: '',
        status: 'active',
        notes: '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save machine');
    }
  };

  const handleEdit = (machine: Machine) => {
    setEditingId(machine.id);
    setFormData({
      name: machine.name,
      category: machine.category,
      supplier_id: machine.supplier_id || '',
      purchase_date: machine.purchase_date || '',
      purchase_cost: machine.purchase_cost?.toString() || '',
      status: machine.status,
      notes: machine.notes || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!canWrite || !confirm('Delete this machine?')) return;

    try {
      await deleteMachine(id);
      setMachines((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete machine');
    }
  };

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
      {/* Action Bar */}
      {canWrite && (
        <div className="flex justify-end">
          <button
            onClick={() => {
              setShowForm(!showForm);
              setEditingId(null);
              setFormData({
                name: '',
                category: '',
                supplier_id: '',
                purchase_date: '',
                purchase_cost: '',
                status: 'active',
                notes: '',
              });
            }}
            className="flex items-center gap-2 px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Machine</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {canWrite && showForm && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 md:p-6 space-y-4">
          <h3 className="text-lg md:text-xl font-semibold text-gray-900">
            {editingId ? 'Edit Machine' : 'Add New Machine'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Machine Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-gray-500"
                placeholder="Enter machine name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-gray-500"
                placeholder="e.g., Processing, Packaging"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Supplier
              </label>
              <select
                value={formData.supplier_id}
                onChange={(e) => setFormData((prev) => ({ ...prev, supplier_id: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-gray-500"
              >
                <option value="">Select Supplier</option>
                {suppliers
                  .filter((s) => s.supplier_type === 'machine' || s.supplier_type === 'multiple')
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value as Machine['status'] }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-gray-500"
              >
                <option value="active">Active</option>
                <option value="maintenance">Maintenance</option>
                <option value="idle">Idle</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Purchase Date
              </label>
              <input
                type="date"
                value={formData.purchase_date}
                onChange={(e) => setFormData((prev) => ({ ...prev, purchase_date: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-gray-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Purchase Cost
              </label>
              <input
                type="number"
                value={formData.purchase_cost}
                onChange={(e) => setFormData((prev) => ({ ...prev, purchase_cost: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-gray-500"
                placeholder="Reference only"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-gray-500"
                rows={3}
                placeholder="Additional information"
              />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 justify-end pt-2">
            <button
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
              className="w-full sm:w-auto px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => void handleSubmit()}
              className="w-full sm:w-auto px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
            >
              {editingId ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      )}

      {/* Desktop Table View */}
      <div className="hidden lg:block bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Purchase Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cost</th>
              {canWrite && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={canWrite ? 7 : 6} className="px-4 py-8 text-center text-gray-500">
                  <div className="flex flex-col items-center gap-2">
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Loading machines...</span>
                  </div>
                </td>
              </tr>
            ) : machines.length === 0 ? (
              <tr>
                <td colSpan={canWrite ? 7 : 6} className="px-4 py-8 text-center text-gray-500">
                  <div className="flex flex-col items-center gap-2">
                    <Wrench className="w-8 h-8 text-gray-400" />
                    <span>No machines found</span>
                  </div>
                </td>
              </tr>
            ) : (
              machines.map((machine) => (
                <tr key={machine.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{machine.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{machine.category}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{machine.supplier_name || '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 text-xs rounded ${
                        machine.status === 'active'
                          ? 'bg-green-50 text-green-700'
                          : machine.status === 'maintenance'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {machine.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{machine.purchase_date || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {machine.purchase_cost ? `₹${machine.purchase_cost.toLocaleString('en-IN')}` : '—'}
                  </td>
                  {canWrite && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(machine)}
                          className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => void handleDelete(machine.id)}
                          className="text-sm text-red-600 hover:text-red-700 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  )}
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
              <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
              <span className="text-gray-500">Loading machines...</span>
            </div>
          </div>
        ) : machines.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
            <div className="flex flex-col items-center gap-2">
              <Wrench className="w-8 h-8 text-gray-400" />
              <span className="text-gray-500">No machines found</span>
            </div>
          </div>
        ) : (
          machines.map((machine) => (
            <div key={machine.id} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 text-base">{machine.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">{machine.category}</p>
                </div>
                <span
                  className={`px-2 py-1 text-xs rounded ${
                    machine.status === 'active'
                      ? 'bg-green-50 text-green-700'
                      : machine.status === 'maintenance'
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {machine.status}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-500">Supplier:</span>
                  <span className="ml-1 text-gray-900">{machine.supplier_name || '—'}</span>
                </div>
                <div>
                  <span className="text-gray-500">Purchase Date:</span>
                  <span className="ml-1 text-gray-900">{machine.purchase_date || '—'}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500">Cost:</span>
                  <span className="ml-1 text-gray-900">
                    {machine.purchase_cost ? `₹${machine.purchase_cost.toLocaleString('en-IN')}` : '—'}
                  </span>
                </div>
              </div>

              {canWrite && (
                <div className="flex gap-2 pt-2 border-t border-gray-100">
                  <button
                    onClick={() => handleEdit(machine)}
                    className="flex-1 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => void handleDelete(machine.id)}
                    className="flex-1 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
