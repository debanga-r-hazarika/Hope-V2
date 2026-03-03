import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { FinanceTarget, FinanceTargetFormData, FinanceTargetType } from '../types/finance-targets';

interface FinanceTargetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (formData: FinanceTargetFormData) => Promise<void>;
  target: FinanceTarget | null;
  mode: 'create' | 'edit';
}

export function FinanceTargetModal({ isOpen, onClose, onSave, target, mode }: FinanceTargetModalProps) {
  const [formData, setFormData] = useState<FinanceTargetFormData>({
    target_name: '',
    target_type: 'revenue_target',
    target_value: 0,
    period_start: '',
    period_end: '',
    description: '',
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && target && mode === 'edit') {
      setFormData({
        target_name: target.target_name,
        target_type: target.target_type,
        target_value: target.target_value,
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
        target_type: 'revenue_target',
        target_value: 0,
        period_start: start.toISOString().split('T')[0],
        period_end: end.toISOString().split('T')[0],
        description: '',
      });
    }
  }, [isOpen, target, mode]);

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

  const getTargetTypeDescription = (type: FinanceTargetType): string => {
    switch (type) {
      case 'revenue_target': return 'Set a target for total revenue in the period';
      case 'expense_limit': return 'Set a maximum limit for total expenses';
      case 'cash_flow_target': return 'Set a target for net cash flow (income - expenses)';
      case 'profit_margin_target': return 'Set a target profit margin percentage';
      case 'collection_period_target': return 'Set a target for average collection period in days';
      case 'expense_ratio_target': return 'Set a target for expense-to-revenue ratio';
    }
  };

  const getValueLabel = (type: FinanceTargetType): string => {
    switch (type) {
      case 'revenue_target': return 'Target Revenue (₹)';
      case 'expense_limit': return 'Maximum Expenses (₹)';
      case 'cash_flow_target': return 'Target Cash Flow (₹)';
      case 'profit_margin_target': return 'Target Margin (%)';
      case 'collection_period_target': return 'Target Days';
      case 'expense_ratio_target': return 'Target Ratio (e.g., 0.8 for 80%)';
    }
  };

  const getValuePlaceholder = (type: FinanceTargetType): string => {
    switch (type) {
      case 'revenue_target': return 'e.g., 500000';
      case 'expense_limit': return 'e.g., 300000';
      case 'cash_flow_target': return 'e.g., 200000';
      case 'profit_margin_target': return 'e.g., 25 for 25%';
      case 'collection_period_target': return 'e.g., 30 days';
      case 'expense_ratio_target': return 'e.g., 0.7 for 70%';
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
              {mode === 'create' ? 'Create Finance Target' : 'Edit Finance Target'}
            </h2>
            <p className="text-indigo-100 text-sm mt-1">
              Set financial goals and track performance
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
              placeholder="e.g., Q1 Revenue Target"
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
              onChange={(e) => setFormData({ ...formData, target_type: e.target.value as FinanceTargetType })}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="revenue_target">Revenue Target</option>
              <option value="expense_limit">Expense Limit</option>
              <option value="cash_flow_target">Cash Flow Target</option>
              <option value="profit_margin_target">Profit Margin Target</option>
              <option value="collection_period_target">Collection Period Target</option>
              <option value="expense_ratio_target">Expense Ratio Target</option>
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
              step={formData.target_type === 'expense_ratio_target' ? '0.01' : formData.target_type === 'profit_margin_target' ? '0.1' : '1'}
              value={formData.target_value}
              onChange={(e) => setFormData({ ...formData, target_value: parseFloat(e.target.value) || 0 })}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder={getValuePlaceholder(formData.target_type)}
            />
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
