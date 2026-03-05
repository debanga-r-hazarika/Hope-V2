import { useState, useEffect } from 'react';
import { X, Loader2, Package, ArrowRight } from 'lucide-react';
import type { RawMaterial } from '../types/operations';
import type { RawMaterialTag } from '../types/tags';
import type { RawMaterialUnit } from '../types/units';
import type { TransformationRuleWithTarget } from '../types/transformation-rules';
import { transformRawMaterial, calculateStockBalance } from '../lib/operations';
import { buildRawMaterialTransformPayload, notifyTransactionEmail } from '../lib/transactional-email';
import { useAuth } from '../contexts/AuthContext';
import { useModuleAccess } from '../contexts/ModuleAccessContext';

interface TransformToBananaPeelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newLot?: RawMaterial) => void;
  sourceLot: RawMaterial;
  rawMaterialUnits: RawMaterialUnit[];
  rawMaterialTags: RawMaterialTag[];
  /** If provided, only these targets are shown in the dropdown (from Admin transformation rules). */
  allowedTargets?: TransformationRuleWithTarget[];
  users: Array<{ id: string; full_name: string; email: string }>;
}

export function TransformToBananaPeelModal({
  isOpen,
  onClose,
  onSuccess,
  sourceLot,
  rawMaterialUnits,
  rawMaterialTags,
  allowedTargets,
  users,
}: TransformToBananaPeelModalProps) {
  const { user } = useAuth();
  const { userId } = useModuleAccess();
  const [step, setStep] = useState<1 | 2>(1);
  const [quantityToProcess, setQuantityToProcess] = useState('');
  const [outputQuantity, setOutputQuantity] = useState('');
  const [outputUnitId, setOutputUnitId] = useState('');
  const [targetTagId, setTargetTagId] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [steps, setSteps] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [availableBalance, setAvailableBalance] = useState<number | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetOptions = allowedTargets?.length
    ? rawMaterialTags.filter((t) => allowedTargets.some((a) => a.target_tag_id === t.id))
    : rawMaterialTags.filter((t) => t.id !== sourceLot.raw_material_tag_id);

  useEffect(() => {
    if (isOpen && sourceLot) {
      setLoadingBalance(true);
      calculateStockBalance('raw_material', sourceLot.id)
        .then(setAvailableBalance)
        .catch(() => setAvailableBalance(sourceLot.quantity_available))
        .finally(() => setLoadingBalance(false));
    }
  }, [isOpen, sourceLot]);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setEffectiveDate(new Date().toISOString().split('T')[0]);
      setSteps([]);
      setNotes('');
      const defaultTarget = allowedTargets?.length
        ? allowedTargets[0].target_tag_id
        : rawMaterialTags.find((t) => t.tag_key === 'banana_peel')?.id || rawMaterialTags.find((t) => t.id !== sourceLot.raw_material_tag_id)?.id || '';
      setTargetTagId(defaultTarget);
      setOutputUnitId('');
      const defaultUser = users.find((u) => u.id === userId) || users[0];
      setSelectedUserId(defaultUser?.id || '');
      setError(null);
    }
  }, [isOpen, rawMaterialTags, allowedTargets, users, userId, sourceLot.raw_material_tag_id]);

  useEffect(() => {
    if (targetTagId && allowedTargets?.length) {
      const rule = allowedTargets.find((a) => a.target_tag_id === targetTagId);
      if (rule?.default_steps?.length) {
        setSteps(rule.default_steps.map((s) => s.key));
      }
    }
  }, [targetTagId, allowedTargets]);

  const selectedTargetTag = rawMaterialTags.find((t) => t.id === targetTagId);
  const allowedUnitsForTarget = selectedTargetTag?.allowed_unit_ids && selectedTargetTag.allowed_unit_ids.length > 0
    ? rawMaterialUnits.filter((u) => selectedTargetTag.allowed_unit_ids?.includes(u.id))
    : rawMaterialUnits;

  // Get unit objects for validation
  const sourceUnit = rawMaterialUnits.find((u) => u.display_name === sourceLot.unit);
  const outputUnit = rawMaterialUnits.find((u) => u.id === outputUnitId);

  const handleQuantityToProcessChange = (value: string) => {
    setQuantityToProcess(value);
    if (sourceUnit && !sourceUnit.allows_decimal && value) {
      const numValue = parseFloat(value);
      if (!isNaN(numValue) && numValue % 1 !== 0) {
        setError(`Unit "${sourceUnit.display_name}" does not allow decimal values. Please enter a whole number.`);
        return;
      }
    }
    setError(null);
  };

  const handleOutputQuantityChange = (value: string) => {
    setOutputQuantity(value);
    if (outputUnit && !outputUnit.allows_decimal && value) {
      const numValue = parseFloat(value);
      if (!isNaN(numValue) && numValue % 1 !== 0) {
        setError(`Unit "${outputUnit.display_name}" does not allow decimal values. Please enter a whole number.`);
        return;
      }
    }
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (step === 1) {
      // Validate step 1 fields
      if (!targetTagId) {
        setError('Select the new tag for the transformed lot (e.g. Banana Peel).');
        return;
      }
      if (!effectiveDate) {
        setError('Select a transformation date.');
        return;
      }
      const parentDate = new Date(sourceLot.received_date);
      const chosenDate = new Date(effectiveDate);
      if (Number.isNaN(parentDate.getTime()) || Number.isNaN(chosenDate.getTime())) {
        setError('Invalid date selected.');
        return;
      }
      if (chosenDate < parentDate) {
        setError('Transformation date cannot be before the parent lot received date.');
        return;
      }
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (chosenDate > today) {
        setError('Transformation date cannot be in the future.');
        return;
      }
      if (!selectedUserId) {
        setError('Please select who performed the transformation.');
        return;
      }
      setError(null);
      setStep(2);
      return;
    }

    // Step 2 validation and submit
    const qty = parseFloat(quantityToProcess);
    const outQty = parseFloat(outputQuantity);
    if (isNaN(qty) || qty <= 0 || isNaN(outQty) || outQty <= 0) {
      setError('Enter valid positive quantities for both input and output.');
      return;
    }
    // Validate decimal for source unit
    if (sourceUnit && !sourceUnit.allows_decimal && qty % 1 !== 0) {
      setError(`Unit "${sourceUnit.display_name}" does not allow decimal values. Please enter a whole number for quantity to process.`);
      return;
    }
    // Validate decimal for output unit
    if (outputUnit && !outputUnit.allows_decimal && outQty % 1 !== 0) {
      setError(`Unit "${outputUnit.display_name}" does not allow decimal values. Please enter a whole number for output quantity.`);
      return;
    }
    if (availableBalance != null && qty > availableBalance) {
      setError(`Quantity to process cannot exceed available balance (${availableBalance} ${sourceLot.unit}).`);
      return;
    }
    if (!outputUnitId) {
      setError('Select an output unit.');
      return;
    }
    setSubmitting(true);
    try {
      const newLot = await transformRawMaterial(
        sourceLot.id,
        qty,
        outQty,
        outputUnitId,
        targetTagId,
        effectiveDate,
        steps,
        selectedUserId || userId || undefined
      );
      const transformedByName = users.find((u) => u.id === (selectedUserId || userId))?.full_name ?? '';
      const payload = buildRawMaterialTransformPayload({
        source_lot_id: sourceLot.lot_id,
        source_lot_name: sourceLot.name ?? '',
        source_unit: sourceLot.unit ?? '',
        new_lot_id: newLot.lot_id,
        new_lot_name: newLot.name ?? '',
        output_unit: outputUnit?.display_name ?? '',
        quantity_processed: qty,
        output_quantity: outQty,
        transform_date: effectiveDate,
        transformed_by_name: transformedByName,
        steps,
      });
      notifyTransactionEmail('raw_material_transform', payload);
      onSuccess(newLot);
      onClose();
      setQuantityToProcess('');
      setOutputQuantity('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transformation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedRule = allowedTargets?.find((r) => r.target_tag_id === targetTagId);
  const stepLabelsForPicker = selectedRule?.default_steps?.length
    ? selectedRule.default_steps.map((s) => ({ value: s.key, label: s.label }))
    : [
        { value: 'extract_banana', label: 'Extract banana' },
        { value: 'drying', label: 'Drying' },
        { value: 'sorting', label: 'Sorting' },
        { value: 'other', label: 'Other' },
      ];

  const qtyNum = parseFloat(quantityToProcess);
  const outQtyNum = parseFloat(outputQuantity);
  const yieldPct = qtyNum > 0 && outQtyNum > 0 ? Math.round((outQtyNum / qtyNum) * 100) : null;
  const outputExceedsInput = qtyNum > 0 && outQtyNum > qtyNum;

  const doneByName = selectedUserId ? users.find((u) => u.id === selectedUserId)?.full_name : '';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden />
        <div className="relative bg-white rounded-2xl shadow-xl border border-gray-100 max-w-lg w-full p-6">
          <div className="flex items-center justify-between mb-5 pb-4 border-b border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Package className="w-5 h-5 text-amber-600" />
              {selectedTargetTag ? `Transform to ${selectedTargetTag.display_name}` : 'Transform / Process'}
            </h3>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-xl transition-colors" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-2 mb-4 text-xs font-medium text-gray-600">
            <span className={`px-2 py-0.5 rounded-full ${step === 1 ? 'bg-amber-600 text-white' : 'bg-gray-200 text-gray-800'}`}>
              1. Type & Date
            </span>
            <span className={`px-2 py-0.5 rounded-full ${step === 2 ? 'bg-amber-600 text-white' : 'bg-gray-200 text-gray-800'}`}>
              2. Quantities & Steps
            </span>
          </div>
          {step === 2 && (
            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-900">
              <p className="font-medium">Summary</p>
              <p className="text-xs mt-1">
                From <span className="font-mono">{sourceLot.lot_id}</span>
                {selectedTargetTag && (
                  <>
                    <ArrowRight className="inline w-3 h-3 mx-1" />
                    {selectedTargetTag.display_name}
                  </>
                )}
                {' · '}{effectiveDate}
                {doneByName && ` · By ${doneByName}`}
              </p>
              <p className="text-xs mt-1">
                Available: <strong>{availableBalance != null ? availableBalance.toFixed(2) : '—'} {sourceLot.unit}</strong>
              </p>
            </div>
          )}
          {step === 1 && (
            <p className="text-sm text-gray-600 mb-4">
              Deduct from <span className="font-mono font-medium">{sourceLot.lot_id}</span> and create a new lot. Ledger movements will be recorded.
            </p>
          )}
          {step === 1 && (loadingBalance ? (
            <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading available balance…
            </div>
          ) : step === 1 ? (
            <p className="text-sm text-gray-700 mb-4">
              Available: <strong>{availableBalance != null ? availableBalance.toFixed(2) : '—'} {sourceLot.unit}</strong>
            </p>
          ) : null)}
          <form onSubmit={handleSubmit} className="space-y-4">
            {step === 1 && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New lot tag *</label>
                  <select
                    value={targetTagId}
                    onChange={(e) => {
                      setTargetTagId(e.target.value);
                      setOutputUnitId('');
                    }}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 bg-gray-50 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
                  >
                    <option value="">Select target tag…</option>
                    {targetOptions.map((t) => (
                      <option key={t.id} value={t.id}>{t.display_name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Transformation date *</label>
                    <input
                      type="date"
                      value={effectiveDate}
                      min={sourceLot.received_date}
                      onChange={(e) => setEffectiveDate(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 bg-gray-50 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Transformation done by *</label>
                    <select
                      value={selectedUserId}
                      onChange={(e) => setSelectedUserId(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 bg-gray-50 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
                    >
                      <option value="">Select user</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    How much {sourceLot.unit} used from this lot? *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step={sourceUnit?.allows_decimal ? 'any' : '1'}
                    value={quantityToProcess}
                    onChange={(e) => handleQuantityToProcessChange(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 bg-gray-50 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
                    placeholder="e.g. 50"
                    required
                  />
                  {sourceUnit && (
                    <p className="mt-1 text-xs text-gray-500">
                      {sourceUnit.allows_decimal ? 'Decimals allowed' : 'Whole numbers only'}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    How much quantity made in the new lot? *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step={outputUnit?.allows_decimal ? 'any' : '1'}
                    value={outputQuantity}
                    onChange={(e) => handleOutputQuantityChange(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 bg-gray-50 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
                    placeholder="e.g. 10"
                    required
                    disabled={!outputUnitId}
                  />
                  {outputUnit && (
                    <p className="mt-1 text-xs text-gray-500">
                      {outputUnit.allows_decimal ? 'Decimals allowed' : 'Whole numbers only'}
                    </p>
                  )}
                  {yieldPct != null && (
                    <p className="mt-1 text-xs text-gray-600">
                      Yield: {yieldPct}% (output ÷ input)
                    </p>
                  )}
                  {outputExceedsInput && (
                    <p className="mt-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl">
                      Output is greater than input. Please confirm this is correct.
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Output unit *</label>
                  <select
                    value={outputUnitId}
                    onChange={(e) => {
                      setOutputUnitId(e.target.value);
                      // Re-validate output quantity when unit changes
                      if (outputQuantity) {
                        const newUnit = rawMaterialUnits.find((u) => u.id === e.target.value);
                        if (newUnit && !newUnit.allows_decimal) {
                          const numValue = parseFloat(outputQuantity);
                          if (!isNaN(numValue) && numValue % 1 !== 0) {
                            setError(`Unit "${newUnit.display_name}" does not allow decimal values. Please enter a whole number.`);
                            return;
                          }
                        }
                        setError(null);
                      }
                    }}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 bg-gray-50 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
                  >
                    <option value="">Select unit</option>
                    {allowedUnitsForTarget.map((u) => (
                      <option key={u.id} value={u.id}>{u.display_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Transformation steps (in order)</label>
                  <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50 space-y-2">
                    {stepLabelsForPicker.map(({ value, label }) => {
                      const checked = steps.includes(value);
                      return (
                        <label key={value} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setSteps((prev) =>
                                checked ? prev.filter((s) => s !== value) : [...prev, value]
                              );
                            }}
                            className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                          />
                          <span>{label}</span>
                        </label>
                      );
                    })}
                  </div>
                  {steps.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      Selected order:{' '}
                      {steps
                        .map((s, idx) => `${idx + 1}. ${s.replace(/_/g, ' ')}`)
                        .join('  ›  ')}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 bg-gray-50 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all min-h-[72px] resize-y text-sm"
                    placeholder="Optional notes for the new lot (e.g. drying conditions, batch remarks). Leave blank for no notes."
                    rows={2}
                  />
                </div>
              </>
            )}
            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 p-3 rounded-xl">
                {error}
              </div>
            )}
            <div className="flex gap-2 justify-end pt-4 mt-4 border-t border-gray-100">
              {step === 2 && (
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  disabled={submitting}
                  className="px-4 py-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-50 text-sm font-medium text-gray-700 transition-colors"
                >
                  Back
                </button>
              )}
              <button type="button" onClick={onClose} className="px-4 py-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors">
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2.5 bg-amber-600 text-white rounded-xl hover:bg-amber-700 disabled:opacity-50 flex items-center gap-2 text-sm font-medium shadow-sm transition-colors"
              >
                {submitting && step === 2 && <Loader2 className="w-4 h-4 animate-spin" />}
                {step === 1 ? 'Next' : 'Transform'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
