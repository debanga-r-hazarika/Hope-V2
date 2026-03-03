import React, { useState, useEffect } from 'react';
import { X, Target, Calendar, TrendingUp, Package } from 'lucide-react';
import type { SalesTarget, SalesTargetFormData } from '../types/sales-targets';
import { ModernButton } from './ui/ModernButton';
import { supabase } from '../lib/supabase';

interface SalesTargetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (formData: SalesTargetFormData) => Promise<void>;
  target?: SalesTarget | null;
  mode: 'create' | 'edit';
}

export function SalesTargetModal({ isOpen, onClose, onSave, target, mode }: SalesTargetModalProps) {
  const [formData, setFormData] = useState<SalesTargetFormData>({
    target_name: '',
    target_type: 'sales_quantity',
    target_value: 0,
    tag_id: null,
    period_start: '',
    period_end: '',
    description: '',
  });

  const [productTags, setProductTags] = useState<{ id: string; display_name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadProductTags();
      if (mode === 'edit' && target) {
        setFormData({
          target_name: target.target_name,
          target_type: target.target_type,
          target_value: target.target_value,
          tag_id: target.tag_id,
          period_start: target.period_start,
          period_end: target.period_end,
          description: target.description || '',
        });
      } else {
        // Reset form for create mode
        setFormData({
          target_name: '',
          target_type: 'sales_quantity',
          target_value: 0,
          tag_id: null,
          period_start: '',
          period_end: '',
          description: '',
        });
      }
    }
  }, [isOpen, mode, target]);

  const loadProductTags = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('produced_goods_tags')
        .select('id, display_name')
        .eq('status', 'active')
        .order('display_name', { ascending: true });

      if (error) throw error;
      setProductTags(data || []);
    } catch (err) {
      console.error('Failed to load product tags:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch (err) {
      console.error('Failed to save target:', err);
      alert('Failed to save target. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-violet-600 text-white p-6 rounded-t-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold">
                {mode === 'create' ? 'Create Sales Target' : 'Edit Sales Target'}
              </h2>
              <p className="text-indigo-100 text-sm">Set goals to track sales performance</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Target Name */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Target Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.target_name}
              onChange={(e) => setFormData({ ...formData, target_name: e.target.value })}
              className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="e.g., Q1 Sales Target"
              required
            />
          </div>

          {/* Target Type */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Target Type <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, target_type: 'sales_quantity' })}
                className={`p-4 rounded-xl border-2 transition-all ${
                  formData.target_type === 'sales_quantity'
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <Package className="w-5 h-5 mx-auto mb-2" />
                <div className="font-semibold text-sm">Quantity</div>
                <div className="text-xs text-slate-500 mt-1">Units sold</div>
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, target_type: 'sales_revenue' })}
                className={`p-4 rounded-xl border-2 transition-all ${
                  formData.target_type === 'sales_revenue'
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <TrendingUp className="w-5 h-5 mx-auto mb-2" />
                <div className="font-semibold text-sm">Revenue</div>
                <div className="text-xs text-slate-500 mt-1">Sales value</div>
              </button>
            </div>
          </div>

          {/* Product Tag (Optional) */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Product Tag (Optional)
            </label>
            <select
              value={formData.tag_id || ''}
              onChange={(e) => setFormData({ ...formData, tag_id: e.target.value || null })}
              className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              disabled={loading}
            >
              <option value="">All Products</option>
              {productTags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.display_name}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1">
              Leave empty to track all products, or select a specific product tag
            </p>
          </div>

          {/* Target Value */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Target Value <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={formData.target_value}
              onChange={(e) => setFormData({ ...formData, target_value: parseFloat(e.target.value) || 0 })}
              className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder={formData.target_type === 'sales_quantity' ? 'e.g., 1000' : 'e.g., 500000'}
              min="0"
              step="0.01"
              required
            />
            <p className="text-xs text-slate-500 mt-1">
              {formData.target_type === 'sales_quantity' 
                ? 'Total quantity to be sold' 
                : 'Total revenue to be achieved (in ₹)'}
            </p>
          </div>

          {/* Period */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Start Date <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="date"
                  value={formData.period_start}
                  onChange={(e) => setFormData({ ...formData, period_start: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                End Date <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="date"
                  value={formData.period_end}
                  onChange={(e) => setFormData({ ...formData, period_end: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  min={formData.period_start}
                  required
                />
              </div>
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
              className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              rows={3}
              placeholder="Add notes about this target..."
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <ModernButton
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={saving}
            >
              Cancel
            </ModernButton>
            <ModernButton
              type="submit"
              variant="primary"
              className="flex-1"
              disabled={saving}
            >
              {saving ? 'Saving...' : mode === 'create' ? 'Create Target' : 'Update Target'}
            </ModernButton>
          </div>
        </form>
      </div>
    </div>
  );
}
