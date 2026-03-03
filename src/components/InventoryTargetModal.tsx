import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { InventoryTarget, InventoryTargetFormData, InventoryTargetType } from '../types/inventory-targets';
import type { InventoryType } from '../types/inventory-analytics';
import { supabase } from '../lib/supabase';

interface InventoryTargetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (formData: InventoryTargetFormData) => Promise<void>;
  target: InventoryTarget | null;
  mode: 'create' | 'edit';
}

export function InventoryTargetModal({ isOpen, onClose, onSave, target, mode }: InventoryTargetModalProps) {
  const [formData, setFormData] = useState<InventoryTargetFormData>({
    target_name: '',
    target_type: 'stock_level',
    target_value: 0,
    tag_type: null,
    tag_id: null,
    period_start: '',
    period_end: '',
    description: '',
  });

  const [loading, setLoading] = useState(false);
  const [tags, setTags] = useState<{ id: string; display_name: string }[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);

  useEffect(() => {
    if (isOpen && target && mode === 'edit') {
      setFormData({
        target_name: target.target_name,
        target_type: target.target_type,
        target_value: target.target_value,
        tag_type: target.tag_type,
        tag_id: target.tag_id,
        period_start: target.period_start,
        period_end: target.period_end,
        description: target.description || '',
      });
    } else if (isOpen && mode === 'create') {
      // Set default dates (current month)
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      
      setFormData({
        target_name: '',
        target_type: 'stock_level',
        target_value: 0,
        tag_type: null,
        tag_id: null,
        period_start: start.toISOString().split('T')[0],
        period_end: end.toISOString().split('T')[0],
        description: '',
      });
    }
  }, [isOpen, target, mode]);

  // Load tags when tag_type changes
  useEffect(() => {
    if (formData.tag_type) {
      loadTags(formData.tag_type);
    } else {
      setTags([]);
      setFormData(prev => ({ ...prev, tag_id: null }));
    }
  }, [formData.tag_type]);

  const loadTags = async (tagType: InventoryType) => {
    setLoadingTags(true);
    try {
      const tableName = 
        tagType === 'raw_material' ? 'raw_material_tags' :
        tagType === 'recurring_product' ? 'recurring_product_tags' :
        'produced_goods_tags';

      const { data, error } = await supabase
        .from(tableName)
        .select('id, display_name')
        .eq('status', 'active')
        .order('display_name', { ascending: true });

      if (error) throw error;
      setTags(data || []);
    } catch (err) {
      console.error('Failed to load tags:', err);
      setTags([]);
    } finally {
      setLoadingTags(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Failed to save target:', error);
      alert('Failed to save target. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getTargetTypeLabel = (type: InventoryTargetType): string => {
    switch (type) {
      case 'stock_level': return 'Stock Level (Minimum to Maintain)';
      case 'consumption_limit': return 'Consumption Limit (Maximum Allowed)';
      case 'waste_reduction': return 'Waste Reduction (Target %)';
      case 'stock_turnover': return 'Stock Turnover (Target Rate)';
      case 'new_stock_arrival': return 'New Stock Arrival (Minimum to Add)';
    }
  };

  const getTargetTypeDescription = (type: InventoryTargetType): string => {
    switch (type) {
      case 'stock_level': return 'Maintain minimum stock levels to prevent stockouts';
      case 'consumption_limit': return 'Control consumption within budget limits';
      case 'waste_reduction': return 'Reduce waste percentage to improve efficiency';
      case 'stock_turnover': return 'Improve inventory turnover rate';
      case 'new_stock_arrival': return 'Ensure adequate new inventory is added';
    }
  };

  const getValueLabel = (type: InventoryTargetType): string => {
    switch (type) {
      case 'stock_level': return 'Minimum Stock Level';
      case 'consumption_limit': return 'Maximum Consumption';
      case 'waste_reduction': return 'Target Waste % (e.g., 5 for 5%)';
      case 'stock_turnover': return 'Target Turnover Rate (e.g., 2.0)';
      case 'new_stock_arrival': return 'Minimum New Stock to Add';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-violet-600 text-white p-6 rounded-t-2xl flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">
              {mode === 'create' ? 'Create Inventory Target' : 'Edit Inventory Target'}
            </h2>
            <p className="text-indigo-100 text-sm mt-1">
              Set goals for inventory management and tracking
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Target Name */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Target Name *
            </label>
            <input
              type="text"
              required
              value={formData.target_name}
              onChange={(e) => setFormData({ ...formData, target_name: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="e.g., Q1 Stock Level - Banana Peel"
            />
          </div>

          {/* Target Type */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Target Type *
            </label>
            <select
              required
              value={formData.target_type}
              onChange={(e) => setFormData({ ...formData, target_type: e.target.value as InventoryTargetType })}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="stock_level">Stock Level (Minimum to Maintain)</option>
              <option value="consumption_limit">Consumption Limit (Maximum Allowed)</option>
              <option value="waste_reduction">Waste Reduction (Target %)</option>
              <option value="stock_turnover">Stock Turnover (Target Rate)</option>
              <option value="new_stock_arrival">New Stock Arrival (Minimum to Add)</option>
            </select>
            <p className="text-xs text-slate-500 mt-1.5">
              {getTargetTypeDescription(formData.target_type)}
            </p>
          </div>

          {/* Target Value */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              {getValueLabel(formData.target_type)} *
            </label>
            <input
              type="number"
              required
              min="0"
              step="0.01"
              value={formData.target_value}
              onChange={(e) => setFormData({ ...formData, target_value: parseFloat(e.target.value) || 0 })}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Enter target value"
            />
          </div>

          {/* Inventory Type */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Inventory Type *
            </label>
            <select
              required
              value={formData.tag_type || ''}
              onChange={(e) => setFormData({ ...formData, tag_type: (e.target.value as InventoryType) || null })}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">Select inventory type</option>
              <option value="raw_material">Raw Materials</option>
              <option value="recurring_product">Recurring Products</option>
              <option value="produced_goods">Produced Goods</option>
            </select>
          </div>

          {/* Product Tag */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Specific Item (Optional)
            </label>
            <select
              value={formData.tag_id || ''}
              onChange={(e) => setFormData({ ...formData, tag_id: e.target.value || null })}
              disabled={!formData.tag_type || loadingTags}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
            >
              <option value="">All Items of Selected Type</option>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.display_name}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1.5">
              Leave empty to apply target to all items of the selected type
            </p>
          </div>

          {/* Period */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Period Start *
              </label>
              <input
                type="date"
                required
                value={formData.period_start}
                onChange={(e) => setFormData({ ...formData, period_start: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Period End *
              </label>
              <input
                type="date"
                required
                value={formData.period_end}
                onChange={(e) => setFormData({ ...formData, period_end: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Description (Optional)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
              placeholder="Add any additional notes about this target..."
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-slate-300 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold rounded-xl hover:from-indigo-700 hover:to-violet-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : mode === 'create' ? 'Create Target' : 'Update Target'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
