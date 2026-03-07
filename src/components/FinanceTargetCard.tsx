import { TrendingUp, TrendingDown, DollarSign, Percent, Calendar, Edit2, Trash2, CheckCircle, XCircle, Clock } from 'lucide-react';
import type { FinanceTargetProgress } from '../types/finance-targets';

interface FinanceTargetCardProps {
  targetProgress: FinanceTargetProgress;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: 'active' | 'completed' | 'cancelled') => void;
  hasWriteAccess?: boolean;
}

export function FinanceTargetCard({ targetProgress, onEdit, onDelete, onStatusChange, hasWriteAccess = true }: FinanceTargetCardProps) {
  const { target, current_value, progress_percentage, is_achieved, days_remaining, status_message } = targetProgress;

  const isExpired = days_remaining <= 0;
  const effectiveStatus = isExpired && target.status === 'active' ? 'expired' : target.status;

  const formatValue = (value: number) => {
    if (target.target_type === 'profit_margin_target') {
      return `${value.toFixed(2)}%`;
    } else if (target.target_type === 'collection_period_target') {
      return `${Math.round(value)} days`;
    } else if (target.target_type === 'expense_ratio_target') {
      return value.toFixed(2);
    } else {
      // Currency values
      return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
    }
  };

  // Determine if target is exceeded (for "higher is better" targets)
  const isExceeded = () => {
    const lowerIsBetter = ['expense_limit', 'collection_period_target', 'expense_ratio_target'].includes(target.target_type);
    if (lowerIsBetter) {
      // For "lower is better", exceeded means current > target (bad)
      return current_value > target.target_value;
    } else {
      // For "higher is better", exceeded means current > target (good)
      return current_value > target.target_value;
    }
  };

  const getRemainingLabel = () => {
    const lowerIsBetter = ['expense_limit', 'collection_period_target', 'expense_ratio_target'].includes(target.target_type);
    
    if (lowerIsBetter) {
      // For "lower is better" targets
      if (current_value > target.target_value) {
        return 'Exceeded';
      } else {
        return 'Remaining';
      }
    } else {
      // For "higher is better" targets
      if (current_value > target.target_value) {
        return 'Exceeded';
      } else {
        return 'Remaining';
      }
    }
  };

  const getRemainingValue = () => {
    const lowerIsBetter = ['expense_limit', 'collection_period_target', 'expense_ratio_target'].includes(target.target_type);
    
    if (lowerIsBetter) {
      // For "lower is better" targets
      if (current_value > target.target_value) {
        // Show how much over the limit
        return Math.abs(current_value - target.target_value);
      } else {
        // Show remaining buffer
        return Math.abs(target.target_value - current_value);
      }
    } else {
      // For "higher is better" targets
      if (current_value > target.target_value) {
        // Show how much exceeded
        return Math.abs(current_value - target.target_value);
      } else {
        // Show remaining to reach target
        return Math.abs(target.target_value - current_value);
      }
    }
  };

  const getProgressColor = () => {
    if (is_achieved) return 'bg-emerald-500';
    if (progress_percentage >= 75) return 'bg-blue-500';
    if (progress_percentage >= 50) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const getStatusBadge = () => {
    switch (effectiveStatus) {
      case 'active':
        return <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-md">Active</span>;
      case 'expired':
        return <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-semibold rounded-md">Expired</span>;
      case 'completed':
        return <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-md">Completed</span>;
      case 'cancelled':
        return <span className="px-2 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded-md">Cancelled</span>;
    }
  };

  const getTargetTypeIcon = () => {
    switch (target.target_type) {
      case 'revenue_target':
        return <TrendingUp className="w-4 h-4 text-indigo-600" />;
      case 'expense_limit':
        return <TrendingDown className="w-4 h-4 text-indigo-600" />;
      case 'cash_flow_target':
        return <DollarSign className="w-4 h-4 text-indigo-600" />;
      case 'profit_margin_target':
        return <Percent className="w-4 h-4 text-indigo-600" />;
      case 'collection_period_target':
        return <Clock className="w-4 h-4 text-indigo-600" />;
      case 'expense_ratio_target':
        return <Percent className="w-4 h-4 text-indigo-600" />;
    }
  };

  const getTargetTypeLabel = () => {
    switch (target.target_type) {
      case 'revenue_target': return 'Revenue Target';
      case 'expense_limit': return 'Expense Limit';
      case 'cash_flow_target': return 'Cash Flow Target';
      case 'profit_margin_target': return 'Profit Margin Target';
      case 'collection_period_target': return 'Collection Period Target';
      case 'expense_ratio_target': return 'Expense Ratio Target';
    }
  };

  const getFulfillmentComment = () => {
      const totalPeriodDays = Math.ceil((new Date(target.period_end).getTime() - new Date(target.period_start).getTime()) / (1000 * 60 * 60 * 24));
      const daysRemainingPercent = totalPeriodDays > 0 ? Math.max(0, (days_remaining / totalPeriodDays) * 100) : 0;

      // Determine if this is a "lower is better" target
      const lowerIsBetter = ['expense_limit', 'collection_period_target', 'expense_ratio_target'].includes(target.target_type);

      // For "lower is better" targets, is_achieved means you've REACHED the limit (bad!)
      // For "higher is better" targets, is_achieved means you've REACHED the goal (good!)
      if (is_achieved) {
        if (lowerIsBetter) {
          // Reached the expense limit - this is a warning, not a celebration!
          if (days_remaining > 7) {
            return {
              text: '⚠️ Limit reached! You\'ve used your full budget. Monitor spending carefully!',
              color: 'text-amber-600 bg-amber-50',
            };
          } else if (days_remaining > 0) {
            return {
              text: '⚠️ Budget fully utilized. Avoid additional expenses!',
              color: 'text-amber-600 bg-amber-50',
            };
          } else {
            return {
              text: '⚠️ Period ended at budget limit. Review spending for next period.',
              color: 'text-amber-600 bg-amber-50',
            };
          }
        } else {
          // Reached revenue/profit target - this IS a celebration!
          if (days_remaining > 7) {
            return {
              text: '🎉 Target Achieved Early! Excellent financial management!',
              color: 'text-emerald-600 bg-emerald-50',
            };
          } else if (days_remaining > 0) {
            return {
              text: '✅ Target Achieved! Great work!',
              color: 'text-emerald-600 bg-emerald-50',
            };
          } else {
            return {
              text: '✅ Target Completed Successfully!',
              color: 'text-emerald-600 bg-emerald-50',
            };
          }
        }
      }

      // Check if exceeded (bad for expense limits, good for revenue targets)
      const isExceededBad = lowerIsBetter && current_value > target.target_value;

      // Expired but not achieved
      if (isExpired) {
        if (isExceededBad) {
          return {
            text: '❌ Limit exceeded! Review spending and implement cost controls.',
            color: 'text-red-600 bg-red-50',
          };
        } else if (progress_percentage >= 90) {
          return {
            text: '😔 So close! Target missed by a small margin.',
            color: 'text-orange-600 bg-orange-50',
          };
        } else if (progress_percentage >= 75) {
          return {
            text: '⚠️ Target not met. Good effort but fell short.',
            color: 'text-orange-600 bg-orange-50',
          };
        } else {
          return {
            text: '❌ Target missed. Review financial strategies.',
            color: 'text-red-600 bg-red-50',
          };
        }
      }

      // Active targets - check if currently exceeding limit (bad)
      if (isExceededBad) {
        return {
          text: '🚨 ALERT: Limit exceeded! Immediate action required to reduce expenses!',
          color: 'text-red-600 bg-red-50',
        };
      }

      // Active targets - consider both progress and time
      if (progress_percentage >= 90) {
        if (lowerIsBetter) {
          // For expense limits at 90%+, this is CRITICAL if there's still time left
          if (daysRemainingPercent > 50) {
            // Used 90%+ of budget with more than half the time remaining - CRITICAL!
            return {
              text: '🚨 CRITICAL: 90%+ of budget used with significant time remaining! Implement strict cost controls immediately!',
              color: 'text-red-600 bg-red-50',
            };
          } else if (daysRemainingPercent > 25) {
            // Used 90%+ with 25-50% time remaining - URGENT
            return {
              text: '⚠️ URGENT: Budget nearly exhausted! Minimize all non-essential expenses!',
              color: 'text-orange-600 bg-orange-50',
            };
          } else {
            // Used 90%+ with less than 25% time remaining - still concerning but more acceptable
            return {
              text: '⚠️ Budget nearly depleted. Monitor remaining expenses carefully!',
              color: 'text-amber-600 bg-amber-50',
            };
          }
        } else {
          // For revenue targets, 90%+ is great!
          return {
            text: '🔥 Almost there! Just a little more to go!',
            color: 'text-blue-600 bg-blue-50',
          };
        }
      } else if (progress_percentage >= 75) {
        if (lowerIsBetter) {
          if (daysRemainingPercent > 50) {
            // Used 75%+ of budget with more than half the time remaining - WARNING
            return {
              text: '⚠️ WARNING: 75%+ of budget used with significant time remaining! Control spending now!',
              color: 'text-orange-600 bg-orange-50',
            };
          } else if (daysRemainingPercent < 25) {
            return {
              text: '⏰ Budget usage is high but period is ending soon. Monitor final expenses!',
              color: 'text-amber-600 bg-amber-50',
            };
          } else {
            return {
              text: '💪 Good cost control! Keep monitoring expenses!',
              color: 'text-indigo-600 bg-indigo-50',
            };
          }
        } else {
          if (daysRemainingPercent < 25) {
            return {
              text: '⏰ Good progress but time is running out! Sprint to finish!',
              color: 'text-amber-600 bg-amber-50',
            };
          }
          return {
            text: '💪 Great progress! Keep up the momentum!',
            color: 'text-indigo-600 bg-indigo-50',
          };
        }
      } else if (progress_percentage >= 50) {
        if (daysRemainingPercent < 30) {
          return {
            text: lowerIsBetter
              ? '⚠️ Spending is moderate but time is running out! Watch expenses!'
              : '🚨 Halfway but running out of time! Urgent action needed!',
            color: lowerIsBetter ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50',
          };
        }
        return {
          text: lowerIsBetter
            ? '📊 Halfway through budget. Monitor spending to stay on track!'
            : '📈 Halfway there! Push harder to reach the goal!',
          color: 'text-amber-600 bg-amber-50',
        };
      } else if (progress_percentage >= 25) {
        if (daysRemainingPercent < 50) {
          return {
            text: lowerIsBetter
              ? '⚠️ Spending is low but time is running out! Maintain control!'
              : '🚨 Critical! Behind schedule - immediate action required!',
            color: lowerIsBetter ? 'text-indigo-600 bg-indigo-50' : 'text-red-600 bg-red-50',
          };
        }
        return {
          text: lowerIsBetter
            ? '✅ Excellent cost control! Well within budget!'
            : '⚠️ Needs attention! Accelerate efforts to meet target!',
          color: lowerIsBetter ? 'text-emerald-600 bg-emerald-50' : 'text-orange-600 bg-orange-50',
        };
      } else {
        return {
          text: lowerIsBetter
            ? '🌟 Outstanding! Minimal spending - excellent financial discipline!'
            : '🚨 Critical! Significant effort required immediately!',
          color: lowerIsBetter ? 'text-emerald-600 bg-emerald-50' : 'text-red-600 bg-red-50',
        };
      }
    }

  const fulfillmentComment = getFulfillmentComment();

  return (
    <div className="bg-white rounded-xl border border-slate-200 hover:shadow-lg transition-all overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-indigo-50 to-violet-50 border-b border-slate-200">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
              {getTargetTypeIcon()}
            </div>
            <div>
              <h3 className="font-bold text-slate-900">{target.target_name}</h3>
              <p className="text-xs text-indigo-600 font-semibold mt-0.5">{getTargetTypeLabel()}</p>
            </div>
          </div>
          {getStatusBadge()}
        </div>
        
        {target.description && (
          <p className="text-sm text-slate-600 mt-2">{target.description}</p>
        )}
      </div>

      {/* Progress */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-slate-700">Progress</span>
          <span className="text-sm font-bold text-slate-900">{progress_percentage.toFixed(1)}%</span>
        </div>
        
        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden mb-4">
          <div
            className={`h-full ${getProgressColor()} transition-all duration-500 rounded-full`}
            style={{ width: `${Math.min(progress_percentage, 100)}%` }}
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center p-3 bg-slate-50 rounded-lg">
            <div className="text-xs text-slate-600 mb-1">Target</div>
            <div className="font-bold text-slate-900 text-sm">{formatValue(target.target_value)}</div>
          </div>
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-xs text-blue-600 mb-1">Current</div>
            <div className="font-bold text-blue-700 text-sm">{formatValue(current_value)}</div>
          </div>
          <div className={`text-center p-3 rounded-lg ${isExceeded() ? 'bg-purple-50' : 'bg-amber-50'}`}>
            <div className={`text-xs mb-1 ${isExceeded() ? 'text-purple-600' : 'text-amber-600'}`}>{getRemainingLabel()}</div>
            <div className={`font-bold text-sm ${isExceeded() ? 'text-purple-700' : 'text-amber-700'}`}>{formatValue(getRemainingValue())}</div>
          </div>
        </div>

        {/* Period & Days */}
        <div className="flex items-center justify-between text-xs text-slate-600 mb-3">
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            <span>{new Date(target.period_start).toLocaleDateString()} - {new Date(target.period_end).toLocaleDateString()}</span>
          </div>
          <div className={`font-semibold ${isExpired ? 'text-orange-600' : days_remaining > 7 ? 'text-slate-600' : 'text-red-600'}`}>
            {isExpired ? 'Expired' : `${days_remaining} days left`}
          </div>
        </div>

        {/* Status Message */}
        {status_message && (
          <div className="mb-3 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-xs font-medium text-slate-700">{status_message}</p>
          </div>
        )}

        {/* Fulfillment Comment */}
        <div className={`mb-4 pb-4 border-b px-3 py-2 rounded-lg ${fulfillmentComment.color}`}>
          <p className={`text-xs font-semibold ${fulfillmentComment.color.split(' ')[0]}`}>
            {fulfillmentComment.text}
          </p>
        </div>

        {/* Actions */}
        {hasWriteAccess ? (
          <div className="flex gap-2">
            {effectiveStatus === 'active' && !isExpired && (
              <>
                <button
                  type="button"
                  onClick={onEdit}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors text-sm font-medium"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </button>
                {is_achieved && (
                  <button
                    type="button"
                    onClick={() => onStatusChange('completed')}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-lg transition-colors text-sm font-medium"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Complete
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onStatusChange('cancelled')}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors text-sm font-medium"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </>
            )}
            {effectiveStatus === 'expired' && (
              <>
                {is_achieved ? (
                  <button
                    type="button"
                    onClick={() => onStatusChange('completed')}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-lg transition-colors text-sm font-medium"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Mark as Completed
                  </button>
                ) : (
                  <div className="flex-1 text-center px-3 py-2 bg-orange-50 text-orange-700 rounded-lg text-sm font-medium">
                    Target period ended
                  </div>
                )}
                <button
                  type="button"
                  onClick={onDelete}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors text-sm font-medium"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
            {(effectiveStatus === 'completed' || effectiveStatus === 'cancelled') && (
              <button
                type="button"
                onClick={onDelete}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors text-sm font-medium"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            )}
          </div>
        ) : (
          <div className="text-center px-3 py-2 bg-slate-50 text-slate-600 rounded-lg text-xs font-medium border border-slate-200">
            View-only access • Contact admin to modify targets
          </div>
        )}
      </div>
    </div>
  );
}
