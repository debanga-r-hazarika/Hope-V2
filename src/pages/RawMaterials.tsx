import { useEffect, useRef, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, RefreshCw, Package, X, Eye, Search, Filter, Download, Archive, ArchiveRestore, Edit, AlertCircle, Save } from 'lucide-react';
import type { AccessLevel } from '../types/access';
import type { RawMaterial, Supplier } from '../types/operations';
import {
  createRawMaterial,
  createSupplier,
  deleteRawMaterial,
  fetchRawMaterials,
  fetchSuppliers,
  fetchUsers,
  updateRawMaterial,
  checkRawMaterialInLockedBatches,
  archiveRawMaterial,
  unarchiveRawMaterial,
} from '../lib/operations';
import { fetchRawMaterialTags } from '../lib/tags';
import type { RawMaterialTag } from '../types/tags';
import { fetchRawMaterialUnits } from '../lib/units';
import type { RawMaterialUnit } from '../types/units';
import type { RawMaterialLifecycleConfig } from '../types/raw-material-lifecycle';
import type { TransformationRuleWithTarget } from '../types/transformation-rules';
import {
  fetchRawMaterialLifecycleConfigByTagId,
  getDefaultStageKey,
  isStageUsable,
} from '../lib/raw-material-lifecycles';
import { fetchAllTransformationRules } from '../lib/transformation-rules';
import { useModuleAccess } from '../contexts/ModuleAccessContext';
import { useAuth } from '../contexts/AuthContext';
import { LotDetailsModal } from '../components/LotDetailsModal';
import { LotPhotoUpload } from '../components/LotPhotoUpload';
import { exportRawMaterials } from '../utils/excelExport';
import { buildRawMaterialLotPayload, notifyTransactionEmail } from '../lib/transactional-email';
import { InfoDialog } from '../components/ui/InfoDialog';
import { ModernCard } from '../components/ui/ModernCard';
import { ModernButton } from '../components/ui/ModernButton';
import { MultiSelect } from '../components/ui/MultiSelect';
import { FilterPanel } from '../components/ui/FilterPanel';

interface RawMaterialsProps {
  accessLevel: AccessLevel;
}

interface User {
  id: string;
  full_name: string;
  email: string;
}

export function RawMaterials({ accessLevel }: RawMaterialsProps) {
  const { userId } = useModuleAccess();
  const { user: authUser } = useAuth();
  const canWrite = accessLevel === 'read-write';

  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [rawMaterialTags, setRawMaterialTags] = useState<RawMaterialTag[]>([]);
  const [selectedRawMaterialTagId, setSelectedRawMaterialTagId] = useState<string>('');
  const [rawMaterialUnits, setRawMaterialUnits] = useState<RawMaterialUnit[]>([]);
  const [lifecycleByTagId, setLifecycleByTagId] = useState<Record<string, RawMaterialLifecycleConfig | null>>({});
  const [transformationRulesBySourceTagId, setTransformationRulesBySourceTagId] = useState<Record<string, TransformationRuleWithTarget[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<RawMaterial | null>(null);
  const [lockStatus, setLockStatus] = useState<Record<string, { locked: boolean; batchIds: string[] }>>({});
  const [supplierFormData, setSupplierFormData] = useState({
    name: '',
    supplier_type: 'raw_material' as Supplier['supplier_type'],
  });
  const [formData, setFormData] = useState({
    name: '',
    supplier_id: '',
    raw_material_tag_ids: [] as string[],
    quantity_received: '',
    unit: '',
    condition: 'Kesa' as string,
    custom_condition: '',
    received_date: new Date().toISOString().split('T')[0],
    storage_notes: '',
    handover_to: '',
    amount_paid: '',
    usable: true,
    usability_status: '' as string,
    photo_urls: [] as string[],
  });
  const [autoNameLocked, setAutoNameLocked] = useState(true);

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSuppliers, setFilterSuppliers] = useState<string[]>([]);
  const [filterConditions, setFilterConditions] = useState<string[]>([]);
  const [filterHandovers, setFilterHandovers] = useState<string[]>([]);
  const [filterUnits, setFilterUnits] = useState<string[]>([]);
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [filterUsability, setFilterUsability] = useState<string[]>([]);
  const [filterTags, setFilterTags] = useState<string[]>([]);

  const [searchParams] = useSearchParams();
  const [showArchived, setShowArchived] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [materialsData, suppliersData, usersData, tagsData, unitsData] = await Promise.all([
        fetchRawMaterials(showArchived),
        fetchSuppliers(),
        fetchUsers(),
        fetchRawMaterialTags(false),
        fetchRawMaterialUnits(false),
      ]);
      setMaterials(materialsData);
      setSuppliers(suppliersData);
      setUsers(usersData);
      setRawMaterialTags(tagsData);
      setRawMaterialUnits(unitsData);

      // Load lifecycle configs for tags that are multi-stage (admin managed) or legacy banana
      const lifecycleCandidates = tagsData.filter(
        (t) => t.lifecycle_type === 'multi_stage' || t.lifecycle_type === 'banana_multi_stage' || t.tag_key === 'banana'
      );
      if (lifecycleCandidates.length > 0) {
        const results = await Promise.all(
          lifecycleCandidates.map(async (t) => {
            try {
              const cfg = await fetchRawMaterialLifecycleConfigByTagId(t.id);
              return [t.id, cfg] as const;
            } catch {
              return [t.id, null] as const;
            }
          })
        );
        setLifecycleByTagId((prev) => {
          const next = { ...prev };
          for (const [id, cfg] of results) next[id] = cfg;
          return next;
        });
      }

      try {
        const allRules = await fetchAllTransformationRules();
        const bySource: Record<string, TransformationRuleWithTarget[]> = {};
        for (const r of allRules) {
          if (!bySource[r.source_tag_id]) bySource[r.source_tag_id] = [];
          bySource[r.source_tag_id].push(r);
        }
        setTransformationRulesBySourceTagId(bySource);
      } catch {
        setTransformationRulesBySourceTagId({});
      }

      const lockStatusMap: Record<string, { locked: boolean; batchIds: string[] }> = {};
      for (const material of materialsData) {
        const checkResult = await checkRawMaterialInLockedBatches(material.id);
        lockStatusMap[material.id] = checkResult;
      }
      setLockStatus(lockStatusMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (accessLevel === 'no-access') return;
    void loadData();
  }, [accessLevel, showArchived]);

  const hasOpenedLotFromUrl = useRef(false);
  // Handle lotId URL parameter – open lot details when linked from email
  useEffect(() => {
    const lotIdParam = searchParams.get('lotId');
    if (!lotIdParam || loading || materials.length === 0 || hasOpenedLotFromUrl.current) return;
    const match = materials.find((m) => m.lot_id === lotIdParam);
    if (match) {
      hasOpenedLotFromUrl.current = true;
      setSelectedMaterial(match);
      setShowDetailsModal(true);
    }
  }, [searchParams, loading, materials]);

  const handleCreateSupplier = async () => {
    if (!supplierFormData.name.trim()) {
      setError('Supplier name is required');
      return;
    }

    try {
      const created = await createSupplier({
        name: supplierFormData.name,
        supplier_type: supplierFormData.supplier_type,
        created_by: userId || undefined,
      });

      setSuppliers((prev) => [...prev, created]);
      setFormData((prev) => ({ ...prev, supplier_id: created.id }));
      setShowSupplierModal(false);
      setSupplierFormData({ name: '', supplier_type: 'raw_material' });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create supplier');
    }
  };

  const getUnitValue = () => formData.unit || '';
  const getSelectedUnit = (): RawMaterialUnit | null => rawMaterialUnits.find(u => u.display_name === formData.unit) || null;

  const handleQuantityChange = (value: string) => {
    const selectedUnit = getSelectedUnit();
    if (selectedUnit && !selectedUnit.allows_decimal) {
      const numValue = parseFloat(value);
      if (!isNaN(numValue) && numValue % 1 !== 0) {
        setError(`Unit "${selectedUnit.display_name}" does not allow decimal values. Please enter a whole number.`);
        return;
      }
    }
    setFormData((prev) => ({ ...prev, quantity_received: value }));
    setError(null);
  };

  const getConditionValue = () =>
    formData.condition === 'Other' ? (formData.custom_condition || 'Other') : formData.condition;

  /** Selected tag from either Type dropdown or the single Tags selection (only one tag allowed). */
  const selectedTag: RawMaterialTag | undefined = useMemo(() => {
    const id = selectedRawMaterialTagId || (formData.raw_material_tag_ids && formData.raw_material_tag_ids[0]);
    return id ? rawMaterialTags.find((t) => t.id === id) : undefined;
  }, [rawMaterialTags, selectedRawMaterialTagId, formData.raw_material_tag_ids]);

  /** Units allowed for the selected tag (admin-configured). When no tag, none (unit dropdown disabled). */
  const allowedUnitsForSelectedTag = useMemo(() => {
    if (!selectedTag) return [];
    const ids = selectedTag.allowed_unit_ids;
    if (!ids || ids.length === 0) return [];
    return rawMaterialUnits.filter((u) => ids.includes(u.id));
  }, [selectedTag, rawMaterialUnits]);

  const selectedLifecycle = selectedTag ? lifecycleByTagId[selectedTag.id] ?? null : null;

  /** Stage label for list/badge: lifecycle-driven when configured; otherwise falls back to usable flag */
  function getUsabilityStatusLabel(material: RawMaterial): string {
    const tagId = material.raw_material_tag_ids?.[0] || material.raw_material_tag_id;
    const tag = tagId ? rawMaterialTags.find((t) => t.id === tagId) : undefined;
    const status = material.usability_status;
    if (tagId && lifecycleByTagId[tagId]?.stages?.length) {
      const cfg = lifecycleByTagId[tagId];
      const stage = cfg?.stages?.find((s) => s.stage_key === status);
      if (stage?.stage_label) return stage.stage_label;
      // Backward compatibility: map old values into a usable stage label if possible
      if (status && ['READY_FOR_PROCESSING', 'READY_FOR_PRODUCTION', 'PROCESSED'].includes(status)) {
        const usableStage = cfg?.stages?.find((s) => s.makes_usable);
        if (usableStage?.stage_label) return usableStage.stage_label;
      }
      if (status) return status;
    }
    return material.usable ? 'Usable' : 'Not Usable';
  }

  function isMaterialUsable(material: RawMaterial): boolean {
    const tagId = material.raw_material_tag_ids?.[0] || material.raw_material_tag_id;
    const cfg = tagId ? lifecycleByTagId[tagId] : null;
    if (cfg?.stages?.length) {
      const status = material.usability_status;
      // Backward compatibility: treat legacy READY_FOR_* and PROCESSED as usable when lifecycle exists
      if (status && ['READY_FOR_PROCESSING', 'READY_FOR_PRODUCTION', 'PROCESSED'].includes(status)) return true;
      return isStageUsable(cfg.stages, status);
    }
    return material.usable ?? true;
  }

  const formatDateLabel = (dateString: string) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    if (Number.isNaN(d.getTime())) return dateString;
    return d
      .toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
      .replace(/ /g, '');
  };

  const buildAutoName = (tag: RawMaterialTag | undefined, condition: string, customCondition: string, date: string) => {
    if (!tag) return '';
    const conditionLabel =
      condition === 'Other'
        ? (customCondition && customCondition.trim()) || 'Other'
        : condition || 'Raw';
    const dateLabel = formatDateLabel(date || new Date().toISOString().split('T')[0]);
    return `${tag.display_name}-${conditionLabel}-${dateLabel}`;
  };

  useEffect(() => {
    if (editingId) return;
    if (!autoNameLocked) return;
    const tag = selectedTag;
    if (!tag) return;
    const autoName = buildAutoName(tag, formData.condition, formData.custom_condition, formData.received_date);
    setFormData((prev) => ({ ...prev, name: autoName }));
  }, [selectedTag, formData.condition, formData.custom_condition, formData.received_date, editingId, autoNameLocked]);

  const handleSubmit = async () => {
    if (!canWrite || !formData.name || !formData.quantity_received || !getUnitValue()) {
      setError('Please fill in all required fields including a quantity and unit');
      return;
    }

    if (!authUser || !userId) {
      setError('User authentication required. Please wait for authentication to complete and try again.');
      return;
    }

    if (submitting) return;

    setSubmitting(true);
    try {
      const unitValue = getUnitValue();
      const conditionValue = getConditionValue();
      const quantityReceived = parseFloat(formData.quantity_received);
      if (isNaN(quantityReceived) || quantityReceived < 0) {
        setError('Please enter a valid quantity (0 or greater)');
        setSubmitting(false);
        return;
      }

      let result: RawMaterial;
      const primaryTag: RawMaterialTag | undefined =
        formData.raw_material_tag_ids.length > 0
          ? rawMaterialTags.find((t) => t.id === formData.raw_material_tag_ids[0])
          : selectedTag;
      const lifecycleCfg = primaryTag ? (lifecycleByTagId[primaryTag.id] ?? null) : null;
      const stageKeyForSave =
        formData.usability_status ||
        (lifecycleCfg?.stages?.length ? getDefaultStageKey(lifecycleCfg.stages) : null) ||
        null;
      if (editingId) {
        const derivedUsable = lifecycleCfg?.stages?.length
          ? isStageUsable(lifecycleCfg.stages, stageKeyForSave)
          : formData.usability_status
            ? ['READY_FOR_PROCESSING', 'READY_FOR_PRODUCTION', 'PROCESSED'].includes(formData.usability_status)
            : formData.usable;
        const updateData = {
          name: formData.name,
          supplier_id: formData.supplier_id || undefined,
          raw_material_tag_ids: formData.raw_material_tag_ids.length > 0 ? formData.raw_material_tag_ids : undefined,
          unit: unitValue,
          condition: conditionValue,
          received_date: formData.received_date,
          storage_notes: formData.storage_notes || undefined,
          handover_to: formData.handover_to || undefined,
          amount_paid: formData.amount_paid ? parseFloat(formData.amount_paid) : undefined,
          usable: derivedUsable,
          usability_status: stageKeyForSave || undefined,
          photo_urls: formData.photo_urls,
        };
        result = await updateRawMaterial(editingId, updateData);
        setMaterials((prev) => prev.map((m) => (m.id === editingId ? result : m)));
      } else {
        const tagIds = formData.raw_material_tag_ids;
        const derivedUsable = lifecycleCfg?.stages?.length
          ? isStageUsable(lifecycleCfg.stages, stageKeyForSave)
          : formData.usability_status
            ? ['READY_FOR_PROCESSING', 'READY_FOR_PRODUCTION', 'PROCESSED'].includes(formData.usability_status)
            : formData.usable;
        const materialData = {
          name: formData.name,
          supplier_id: formData.supplier_id || undefined,
          raw_material_tag_ids: tagIds.length > 0 ? tagIds : undefined,
          quantity_received: quantityReceived,
          quantity_available: quantityReceived,
          unit: unitValue,
          condition: conditionValue,
          received_date: formData.received_date,
          storage_notes: formData.storage_notes || undefined,
          handover_to: formData.handover_to || undefined,
          amount_paid: formData.amount_paid ? parseFloat(formData.amount_paid) : undefined,
          usable: derivedUsable,
          usability_status: stageKeyForSave || undefined,
          created_by: userId,
          photo_urls: formData.photo_urls,
        };
        result = await createRawMaterial(materialData);
        setMaterials((prev) => [result, ...prev]);
        const payload = buildRawMaterialLotPayload(result);
        notifyTransactionEmail('raw_material_lot_created', payload);
      }

      setShowForm(false);
      setEditingId(null);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${editingId ? 'update' : 'create'} raw material`);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      supplier_id: '',
      raw_material_tag_ids: [],
      quantity_received: '',
      unit: '',
      condition: 'Kesa',
      custom_condition: '',
      received_date: new Date().toISOString().split('T')[0],
      storage_notes: '',
      handover_to: '',
      amount_paid: '',
      usable: true,
      usability_status: '',
      photo_urls: [],
    });
    setSelectedRawMaterialTagId('');
    setAutoNameLocked(true);
  };

  const handleViewDetails = (material: RawMaterial) => {
    setSelectedMaterial(material);
    setShowDetailsModal(true);
  };

  const handleEditFromModal = () => {
    if (!selectedMaterial) return;

    const status = lockStatus[selectedMaterial.id];
    if (status?.locked) {
      setError(`Cannot edit this lot. It is used in locked production batch(es): ${status.batchIds.join(', ')}`);
      return;
    }

    handleEdit(selectedMaterial);
  };

  const handleEdit = (material: RawMaterial) => {
    setEditingId(material.id);
    setAutoNameLocked(false);
    const tagId =
      material.raw_material_tag_id ||
      (material.raw_material_tag_ids && material.raw_material_tag_ids.length > 0 ? material.raw_material_tag_ids[0] : '');
    setSelectedRawMaterialTagId(tagId || '');
    const knownConditions = ['Kesa', 'Poka', 'Baduliye Khuwa', 'Raw', 'Semi-ripe', 'Ripe'];
    const isKnownCondition = knownConditions.includes(material.condition || '');
    setFormData({
      name: material.name,
      supplier_id: material.supplier_id || '',
      raw_material_tag_ids: material.raw_material_tag_ids || (material.raw_material_tag_id ? [material.raw_material_tag_id] : []),
      quantity_received: material.quantity_received.toString(),
      unit: material.unit || '',
      condition: isKnownCondition ? (material.condition as string) : 'Other',
      custom_condition: isKnownCondition ? '' : (material.condition || ''),
      received_date: material.received_date,
      storage_notes: material.storage_notes || '',
      handover_to: material.handover_to || '',
      amount_paid: material.amount_paid ? material.amount_paid.toString() : '',
      usable: material.usable ?? true,
      usability_status: material.usability_status ?? '',
      photo_urls: material.photo_urls || [],
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getArchiveThreshold = (unitDisplayName: string): number => {
    const u = rawMaterialUnits.find((x) => x.display_name === unitDisplayName);
    return u?.archive_threshold ?? 5;
  };

  const handleArchive = async (id: string) => {
    if (!canWrite) return;

    const material = materials.find(m => m.id === id);
    if (!material) return;

    const threshold = getArchiveThreshold(material.unit);
    if (material.quantity_available > threshold) {
      setError(`Can only archive lots with quantity ${threshold} or less (threshold for ${material.unit})`);
      return;
    }

    try {
      setError(null);
      await archiveRawMaterial(id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to archive material');
    }
  };

  const handleUnarchive = async (id: string) => {
    if (!canWrite) return;

    try {
      setError(null);
      await unarchiveRawMaterial(id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unarchive material');
    }
  };

  const handleDelete = async (id: string) => {
    if (!canWrite) return;

    const status = lockStatus[id];
    if (status?.locked) {
      setError(`Cannot delete this lot. It is used in locked production batch(es): ${status.batchIds.join(', ')}`);
      setShowDeleteConfirm(null);
      return;
    }

    try {
      await deleteRawMaterial(id);
      setMaterials((prev) => prev.filter((m) => m.id !== id));
      const newLockStatus = { ...lockStatus };
      delete newLockStatus[id];
      setLockStatus(newLockStatus);
      setShowDeleteConfirm(null);

      // Close details modal after successful deletion
      setShowDetailsModal(false);
      setSelectedMaterial(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete raw material');
      setShowDeleteConfirm(null);
    }
  };

  // Derived options for filters
  const supplierOptions = useMemo(() =>
    suppliers
      .filter(s => s.supplier_type === 'raw_material' || s.supplier_type === 'multiple')
      .map(s => ({ value: s.id, label: s.name })),
    [suppliers]
  );

  const conditionOptions = useMemo(() => [
    { value: 'Kesa', label: 'Kesa' },
    { value: 'Poka', label: 'Poka' },
    { value: 'Baduliye Khuwa', label: 'Baduliye Khuwa' },
    { value: 'Other', label: 'Other' },
  ], []);

  const handoverOptions = useMemo(() =>
    users.map(u => ({ value: u.id, label: u.full_name })),
    [users]
  );

  const unitOptions = useMemo(() => {
    const uniqueUnits = Array.from(new Set(materials.map(m => m.unit))).sort();
    return uniqueUnits.map(u => ({ value: u, label: u }));
  }, [materials]);

  const usabilityOptions = useMemo(() => [
    { value: 'usable', label: 'Usable' },
    { value: 'not-usable', label: 'Not Usable' },
  ], []);

  const tagOptions = useMemo(() =>
    rawMaterialTags.map(t => ({ value: t.id, label: t.display_name })),
    [rawMaterialTags]
  );

  const activeFiltersCount = [
    filterSuppliers.length > 0,
    filterConditions.length > 0,
    filterHandovers.length > 0,
    filterUnits.length > 0,
    filterDateFrom !== '',
    filterDateTo !== '',
    filterUsability.length > 0,
    filterTags.length > 0,
  ].filter(Boolean).length;

  const handleClearAllFilters = () => {
    setFilterSuppliers([]);
    setFilterConditions([]);
    setFilterHandovers([]);
    setFilterUnits([]);
    setFilterDateFrom('');
    setFilterDateTo('');
    setFilterUsability([]);
    setFilterTags([]);
    setSearchTerm('');
  };

  const filteredMaterials = useMemo(() => {
    let filtered = [...materials];

    if (!showArchived) {
      filtered = filtered.filter((m) => !m.is_archived);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((m) =>
        m.name.toLowerCase().includes(term) ||
        m.lot_id.toLowerCase().includes(term) ||
        (m.supplier_name || '').toLowerCase().includes(term) ||
        (m.condition || '').toLowerCase().includes(term) ||
        (m.storage_notes || '').toLowerCase().includes(term)
      );
    }

    if (filterSuppliers.length > 0) {
      filtered = filtered.filter((m) => m.supplier_id && filterSuppliers.includes(m.supplier_id));
    }

    if (filterConditions.length > 0) {
      filtered = filtered.filter((m) => m.condition && filterConditions.includes(m.condition));
    }

    if (filterHandovers.length > 0) {
      filtered = filtered.filter((m) => m.handover_to && filterHandovers.includes(m.handover_to));
    }

    if (filterUnits.length > 0) {
      filtered = filtered.filter((m) => m.unit && filterUnits.includes(m.unit));
    }

    if (filterUsability.length > 0) {
      // If both are selected, it's effectively "all" (or union of both)
      // If only 'usable' is selected
      if (filterUsability.includes('usable') && !filterUsability.includes('not-usable')) {
        filtered = filtered.filter((m) => isMaterialUsable(m));
      }
      // If only 'not-usable' is selected
      else if (filterUsability.includes('not-usable') && !filterUsability.includes('usable')) {
        filtered = filtered.filter((m) => !isMaterialUsable(m));
      }
      // If both, do nothing (show all)
    }

    if (filterTags.length > 0) {
      filtered = filtered.filter((m) => {
        const itemTags = m.raw_material_tag_ids || (m.raw_material_tag_id ? [m.raw_material_tag_id] : []);
        return itemTags.some(tagId => filterTags.includes(tagId));
      });
    }

    if (filterDateFrom) filtered = filtered.filter((m) => m.received_date >= filterDateFrom);
    if (filterDateTo) filtered = filtered.filter((m) => m.received_date <= filterDateTo);

    return filtered;
  }, [
    materials,
    searchTerm,
    filterSuppliers,
    filterConditions,
    filterHandovers,
    filterUnits,
    filterDateFrom,
    filterDateTo,
    showArchived,
    filterUsability,
    filterTags
  ]);

  const displayedUsableMaterials = useMemo(() => {
    // If we are filtering by specific usability, we should respect that.
    // However, the view is split into two sections: Usable and Not Usable.
    // If the user selects "Not Usable" only, the Usable section should probably be empty or hidden?
    // The previous logic was:
    // const usableMaterials = useMemo(() => {
    //   if (filterUsability === 'not-usable') return [];
    //   return filteredMaterials.filter(m => m.usable ?? true);
    // }, ...);

    // With multi-select:
    // If 'not-usable' is selected and 'usable' is NOT selected -> Usable section empty.
    // If 'usable' is selected -> Usable section shows matches.
    // If neither selected -> Show all (default behavior implies showing everything available).

    const isUsableSelected = filterUsability.includes('usable');

    if (filterUsability.length > 0 && !isUsableSelected) return [];

    return filteredMaterials.filter((m) => isMaterialUsable(m));
  }, [filteredMaterials, filterUsability]);

  const displayedNotUsableMaterials = useMemo(() => {
    const isNotUsableSelected = filterUsability.includes('not-usable');

    if (filterUsability.length > 0 && !isNotUsableSelected) return [];

    return filteredMaterials.filter((m) => !isMaterialUsable(m));
  }, [filteredMaterials, filterUsability]);

  if (accessLevel === 'no-access') return null;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Package className="w-7 h-7 text-blue-600" />
            Raw Materials
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Add lots, track stock, and manage multi-stage materials (e.g. Banana → Banana Peel). Use filters to find lots quickly.
          </p>
        </div>
      </div>

      {/* Top Controls Card */}
      <ModernCard padding="sm" className="bg-white sticky top-0 z-20 shadow-sm border border-gray-100">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="flex-1 w-full sm:w-auto flex gap-2">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search materials..."
                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

          </div>

          <div className="flex gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl border transition-all text-sm font-medium ${showFilters
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
            >
              <Filter className="w-4 h-4" />
              <span className="hidden sm:inline">Filters</span>
              {activeFiltersCount > 0 && (
                <span className="flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setShowArchived(!showArchived)}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl border transition-all text-sm font-medium ${showArchived
                ? 'bg-amber-50 border-amber-200 text-amber-700'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
            >
              <Archive className="w-4 h-4" />
              <span className="hidden sm:inline">{showArchived ? 'Hide Archived' : 'Show Archived'}</span>
            </button>

            {canWrite && (
              <ModernButton
                onClick={() => exportRawMaterials(filteredMaterials)}
                variant="secondary"
                size="sm"
                icon={<Download className="w-4 h-4" />}
              >
                <span className="hidden sm:inline">Export</span>
              </ModernButton>
            )}

            {canWrite && (
              <ModernButton
                onClick={() => {
                  setShowForm(!showForm);
                  setEditingId(null);
                  resetForm();
                }}
                variant={showForm ? 'secondary' : 'primary'}
                size="sm"
                icon={showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              >
                {showForm ? 'Close' : 'Add Lot'}
              </ModernButton>
            )}
          </div>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="mt-4 animate-slide-down">
            <FilterPanel
              activeFiltersCount={activeFiltersCount}
              onClearAll={handleClearAllFilters}
            >
              <MultiSelect
                label="Supplier"
                options={supplierOptions}
                value={filterSuppliers}
                onChange={setFilterSuppliers}
                placeholder="All Suppliers"
              />

              <MultiSelect
                label="Condition"
                options={conditionOptions}
                value={filterConditions}
                onChange={setFilterConditions}
                placeholder="All Conditions"
              />

              <MultiSelect
                label="Tags"
                options={tagOptions}
                value={filterTags}
                onChange={setFilterTags}
                placeholder="All Tags"
              />

              <MultiSelect
                label="Collected by"
                options={handoverOptions}
                value={filterHandovers}
                onChange={setFilterHandovers}
                placeholder="All Users"
              />

              <MultiSelect
                label="Unit"
                options={unitOptions}
                value={filterUnits}
                onChange={setFilterUnits}
                placeholder="All Units"
              />

              <MultiSelect
                label="Usability Status"
                options={usabilityOptions}
                value={filterUsability}
                onChange={setFilterUsability}
                placeholder="All Materials"
              />

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider ml-1">From Date</label>
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-gray-50/50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider ml-1">To Date</label>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-gray-50/50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </FilterPanel>
          </div>
        )}
      </ModernCard>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            <span className="text-sm font-medium">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Add/Edit Form */}
      {canWrite && showForm && (
        <ModernCard className="animate-slide-down border border-blue-100 shadow-md bg-gradient-to-b from-white to-gray-50/30">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              {editingId ? <Edit className="w-5 h-5 text-blue-500" /> : <Plus className="w-5 h-5 text-green-500" />}
              {editingId ? 'Edit Raw Material Lot' : 'Add New Lot'}
            </h3>
            <button
              onClick={() => setShowForm(false)}
              className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-xl transition-colors"
              aria-label="Close form"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
            {/* Section: Type & identity */}
            <div className="md:col-span-2 pt-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Type & identity</p>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Raw Material Type / Tag</label>
              <select
                value={selectedRawMaterialTagId}
                onChange={(e) => {
                  const value = e.target.value;
                  setSelectedRawMaterialTagId(value);
                  if (!editingId) {
                    const tag = value ? rawMaterialTags.find((t) => t.id === value) : null;
                    if (tag) {
                      const allowedIds = tag.allowed_unit_ids ?? [];
                      const currentUnit = rawMaterialUnits.find((u) => u.display_name === formData.unit);
                      const unitStillAllowed = allowedIds.length > 0 && currentUnit && allowedIds.includes(currentUnit.id);
                      const cfg = lifecycleByTagId[tag.id] ?? null;
                      const defaultStage = cfg?.stages?.length ? getDefaultStageKey(cfg.stages) : null;
                      setFormData((prev) => {
                        const isBanana = tag.tag_key === 'banana';
                        const bananaConditions = ['Raw', 'Semi-ripe', 'Ripe', 'Other'];
                        const otherConditions = ['Kesa', 'Poka', 'Baduliye Khuwa', 'Other'];
                        const allowedConditions = isBanana ? bananaConditions : otherConditions;

                        let nextCondition = prev.condition;
                        let nextCustomCondition = prev.custom_condition;
                        if (!allowedConditions.includes(prev.condition)) {
                          nextCondition = isBanana ? 'Raw' : 'Kesa';
                          nextCustomCondition = '';
                        }

                        return {
                          ...prev,
                          raw_material_tag_ids: [tag.id],
                          condition: nextCondition,
                          custom_condition: nextCustomCondition,
                          usability_status: defaultStage || prev.usability_status || '',
                          usable: cfg?.stages?.length ? isStageUsable(cfg.stages, defaultStage) : prev.usable,
                          ...(unitStillAllowed ? {} : { unit: '' }),
                        };
                      });
                    } else {
                      setFormData((prev) => ({ ...prev, raw_material_tag_ids: [], usability_status: '' }));
                    }
                  }
                }}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              >
                <option value="">Select type...</option>
                {rawMaterialTags.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.display_name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                {selectedTag
                  ? `Lot ID prefix and units are set for ${selectedTag.display_name}. Units below are restricted to those allowed for this tag (managed in Admin → Tags).`
                  : 'Select a type to set lot ID prefix and allowed units for this lot.'}
              </p>
            </div>
            {/* Row 1 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Material Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => {
                  const value = e.target.value || '';
                  setAutoNameLocked(false);
                  setFormData((prev) => ({ ...prev, name: value }));
                }}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                placeholder="e.g., Banana"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Condition</label>
              <select
                value={formData.condition}
                onChange={(e) => setFormData((prev) => ({ ...prev, condition: e.target.value || '' }))}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all mb-2"
              >
                {selectedTag?.tag_key === 'banana' ? (
                  <>
                    <option value="Raw">Raw</option>
                    <option value="Semi-ripe">Semi-ripe</option>
                    <option value="Ripe">Ripe</option>
                    <option value="Other">Other - Please Specify</option>
                  </>
                ) : (
                  <>
                    <option value="Kesa">Kesa</option>
                    <option value="Poka">Poka</option>
                    <option value="Baduliye Khuwa">Baduliye Khuwa</option>
                    <option value="Other">Other - Please Specify</option>
                  </>
                )}
              </select>
              {formData.condition === 'Other' && (
                <input
                  type="text"
                  value={formData.custom_condition}
                  onChange={(e) => setFormData((prev) => ({ ...prev, custom_condition: e.target.value || '' }))}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  placeholder="Specify condition"
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Received Date</label>
              <input
                type="date"
                value={formData.received_date}
                onChange={(e) => setFormData((prev) => ({ ...prev, received_date: e.target.value || '' }))}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
            </div>

            {/* Row 3 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Supplier</label>
              <select
                value={formData.supplier_id}
                onChange={(e) => {
                  if (e.target.value === 'add-new') {
                    setShowSupplierModal(true);
                  } else {
                    setFormData((prev) => ({ ...prev, supplier_id: e.target.value || '' }));
                  }
                }}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              >
                <option value="">Select Supplier</option>
                {suppliers
                  .filter((s) => s.supplier_type === 'raw_material' || s.supplier_type === 'multiple')
                  .map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                <option value="add-new" className="text-blue-600 font-medium">➕ Add New Supplier</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount Paid</label>
                <input
                  type="number"
                  value={formData.amount_paid}
                  onChange={(e) => setFormData((prev) => ({ ...prev, amount_paid: e.target.value || '' }))}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  placeholder="0.00"
                  step="any"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Collected by</label>
                <select
                  value={formData.handover_to}
                  onChange={(e) => setFormData((prev) => ({ ...prev, handover_to: e.target.value || '' }))}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                >
                  <option value="">Select Person</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>{user.full_name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Notes / Storage notes */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
              <textarea
                value={formData.storage_notes}
                onChange={(e) => setFormData((prev) => ({ ...prev, storage_notes: e.target.value || '' }))}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all min-h-[80px] resize-y"
                placeholder="Storage notes, handling instructions, or any remarks for this lot..."
                rows={3}
              />
              <p className="mt-1 text-xs text-gray-500">Optional. Shown in lot details. Transformed lots get their own notes from the transform form.</p>
            </div>

            {/* Section: Quantity & unit */}
            <div className="md:col-span-2 pt-2 border-t border-gray-100 mt-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Quantity & unit</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:col-span-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Quantity *</label>
                <input
                  type="number"
                  value={formData.quantity_received}
                  onChange={(e) => handleQuantityChange(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  placeholder="100"
                  step={getSelectedUnit()?.allows_decimal ? 'any' : '1'}
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Unit *</label>
                <select
                  value={formData.unit}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, unit: e.target.value }));
                    const selectedUnit = rawMaterialUnits.find(u => u.display_name === e.target.value);
                    if (selectedUnit && !selectedUnit.allows_decimal && formData.quantity_received) {
                      const numValue = parseFloat(formData.quantity_received);
                      if (!isNaN(numValue) && numValue % 1 !== 0) {
                        setError(`Unit "${selectedUnit.display_name}" does not allow decimal values. Please enter a whole number.`);
                        setFormData((prev) => ({ ...prev, quantity_received: Math.floor(numValue).toString() }));
                      } else {
                        setError(null);
                      }
                    } else {
                      setError(null);
                    }
                  }}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                  disabled={!selectedTag || (selectedTag && allowedUnitsForSelectedTag.length === 0)}
                >
                  <option value="">
                    {!selectedTag
                      ? 'Select a tag first'
                      : allowedUnitsForSelectedTag.length === 0
                        ? 'No units configured for this tag'
                        : 'Select unit'}
                  </option>
                  {allowedUnitsForSelectedTag.map((unit) => (
                    <option key={unit.id} value={unit.display_name}>{unit.display_name}</option>
                  ))}
                </select>
                {!selectedTag && (
                  <p className="mt-1 text-xs text-amber-600">Choose a Raw Material Type / Tag above to enable unit selection.</p>
                )}
                {selectedTag && (
                  <p className="mt-1 text-xs text-gray-500">
                    {allowedUnitsForSelectedTag.length === 0
                      ? 'Admin must set Allowed Units for this tag in Admin → Tags.'
                      : 'Units are restricted to those allowed for this tag (managed in Admin → Tags).'}
                  </p>
                )}
              </div>
            </div>

            {/* Section: Status */}
            <div className="md:col-span-2 pt-2 border-t border-gray-100 mt-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Usability status</p>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Usability Status</label>
              {selectedLifecycle?.stages?.length ? (
                <>
                  {(() => {
                    const defaultKey = getDefaultStageKey(selectedLifecycle.stages);
                    const defaultStage = selectedLifecycle.stages.find((s) => s.stage_key === defaultKey);
                    const defaultIsUsable = isStageUsable(selectedLifecycle.stages, defaultKey);
                    return (
                      !defaultIsUsable && (
                        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2">
                          This type is not usable by default (default stage: <strong>{defaultStage?.stage_label ?? defaultKey}</strong>).
                        </p>
                      )
                    );
                  })()}
                  <select
                    value={formData.usability_status || getDefaultStageKey(selectedLifecycle.stages) || ''}
                    onChange={(e) => {
                      const value = e.target.value || '';
                      setFormData((prev) => ({
                        ...prev,
                        usability_status: value,
                        usable: isStageUsable(selectedLifecycle.stages, value),
                      }));
                    }}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500"
                  >
                    {selectedLifecycle.stages.map((s) => (
                      <option key={s.stage_key} value={s.stage_key}>
                        {s.stage_label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-xs text-gray-500">
                    {selectedLifecycle.stages
                      .slice()
                      .sort((a, b) => a.stage_order - b.stage_order)
                      .map((s) => s.stage_label)
                      .join(' → ')}
                  </p>
                </>
              ) : (
                <div className="flex flex-wrap gap-4 p-3 bg-gray-50 rounded-xl border border-gray-200 min-h-[46px] items-center">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={formData.usable === true}
                      onChange={() => setFormData((prev) => ({ ...prev, usable: true }))}
                      className="w-4 h-4 text-green-600 focus:ring-green-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Usable</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={formData.usable === false}
                      onChange={() => setFormData((prev) => ({ ...prev, usable: false }))}
                      className="w-4 h-4 text-amber-600 focus:ring-amber-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Not Usable</span>
                  </label>
                </div>
              )}
            </div>

            {/* Photo Upload Section */}
            <div className="col-span-1 md:col-span-2">
              <LotPhotoUpload
                lotId={editingId || 'temp'}
                existingPhotos={formData.photo_urls}
                onPhotosChange={(photos) => setFormData((prev) => ({ ...prev, photo_urls: photos }))}
                disabled={false}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-gray-100">
            <ModernButton
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
                resetForm();
              }}
              variant="secondary"
            >
              Cancel
            </ModernButton>
            <ModernButton
              onClick={() => void handleSubmit()}
              loading={submitting}
              icon={<Save className="w-4 h-4" />}
            >
              {editingId ? 'Update Lot' : 'Create Lot'}
            </ModernButton>
          </div>
        </ModernCard>
      )}

      {/* Main Content Area */}
      <div className="space-y-6">
        {loading ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-200 shadow-sm">
            <RefreshCw className="w-10 h-10 text-blue-500 animate-spin mx-auto mb-4" />
            <p className="text-gray-600 font-medium">Loading raw materials...</p>
            <p className="text-sm text-gray-400 mt-1">Fetching lots and filters</p>
          </div>
        ) : (
          <>
            {/* Usable Materials Section */}
            {(filterUsability.length === 0 || filterUsability.includes('usable')) && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-sm" />
                  <h2 className="text-lg font-bold text-gray-900">Usable Materials</h2>
                  <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                    {displayedUsableMaterials.length}
                  </span>
                </div>

                {displayedUsableMaterials.length === 0 ? (
                  <ModernCard className="text-center py-14 bg-gray-50/80 border border-gray-200 border-dashed rounded-2xl">
                    <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600 font-medium">No usable materials found</p>
                    <p className="text-sm text-gray-400 mt-1">Add a lot or adjust filters</p>
                  </ModernCard>
                ) : (
                  <>
                    {/* Desktop Table */}
                    <div className="hidden lg:block bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-gray-50/50 border-b border-gray-200 text-left">
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Lot ID</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Material</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Supplier</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Condition</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Usability Status</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Available</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Received</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Last Edited</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {displayedUsableMaterials.map((material) => (
                            <tr key={material.id} className="hover:bg-blue-50/30 transition-colors group">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="font-mono text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
                                  {material.lot_id}
                                </span>
                              </td>
                              <td className="px-6 py-4 font-medium text-gray-900">{material.name}</td>
                              <td className="px-6 py-4 text-sm text-gray-600">{material.supplier_name || '—'}</td>
                              <td className="px-6 py-4 text-sm text-gray-600">{material.condition}</td>
                              <td className="px-6 py-4">
                                <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                                  {getUsabilityStatusLabel(material)}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`font-semibold ${material.quantity_available === 0 ? 'text-red-600' :
                                  material.quantity_available < material.quantity_received * 0.2 ? 'text-amber-600' : 'text-green-600'
                                  }`}>
                                  {material.unit === 'Pieces' ? Math.floor(material.quantity_available) : material.quantity_available.toFixed(2)} {material.unit}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-500">{material.received_date}</td>
                              <td className="px-6 py-4 text-sm text-gray-500">
                                {material.updated_by_name ? (
                                  <div className="flex flex-col">
                                    <span className="font-medium">{material.updated_by_name}</span>
                                    <span className="text-xs text-gray-400">{new Date(material.updated_at).toLocaleDateString()}</span>
                                  </div>
                                ) : '—'}
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => handleViewDetails(material)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors" title="View details">
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  {canWrite && material.is_archived && (
                                    <button onClick={() => handleUnarchive(material.id)} className="p-2 text-green-600 hover:bg-green-50 rounded-xl transition-colors" title="Unarchive">
                                      <ArchiveRestore className="w-4 h-4" />
                                    </button>
                                  )}
                                  {canWrite && !material.is_archived && material.quantity_available <= getArchiveThreshold(material.unit) && (
                                    <button onClick={() => handleArchive(material.id)} className="p-2 text-amber-600 hover:bg-amber-50 rounded-xl transition-colors" title="Archive">
                                      <Archive className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Cards */}
                    <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {displayedUsableMaterials.map((material) => (
                        <ModernCard key={material.id} padding="sm" className="flex flex-col h-full">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h3 className="font-bold text-gray-900">{material.name}</h3>
                              <span className="font-mono text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded mt-1 inline-block">
                                {material.lot_id}
                              </span>
                            </div>
                            <span className={`px-2 py-1 rounded-lg text-xs font-bold ${material.quantity_available === 0 ? 'bg-red-100 text-red-700' :
                              material.quantity_available < material.quantity_received * 0.2 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                              }`}>
                              {material.unit === 'Pieces' ? Math.floor(material.quantity_available) : material.quantity_available.toFixed(1)} {material.unit}
                            </span>
                          </div>

                          <div className="space-y-2 text-sm text-gray-600 mb-4 flex-1">
                            <div className="flex justify-between">
                              <span className="text-gray-400">Supplier</span>
                              <span className="font-medium text-gray-900">{material.supplier_name || '—'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Condition</span>
                              <span className="font-medium text-gray-900">{material.condition}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-gray-400">Usability Status</span>
                              <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800">
                                {getUsabilityStatusLabel(material)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Received</span>
                              <span className="font-medium text-gray-900">{material.received_date}</span>
                            </div>
                          </div>

                          <div className="flex gap-2 pt-3 border-t border-gray-100 mt-auto">
                            <button
                              onClick={() => handleViewDetails(material)}
                              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 text-sm font-medium rounded-lg hover:bg-blue-100 transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              View
                            </button>
                            {canWrite && material.is_archived && (
                              <button
                                onClick={() => handleUnarchive(material.id)}
                                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-green-50 text-green-700 text-sm font-medium rounded-lg hover:bg-green-100 transition-colors"
                              >
                                <ArchiveRestore className="w-3.5 h-3.5" />
                              </button>
                            )}
{canWrite && material.quantity_available <= getArchiveThreshold(material.unit) && !material.is_archived && (
                                <button
                                  onClick={() => handleArchive(material.id)}
                                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-50 text-amber-700 text-sm font-medium rounded-lg hover:bg-amber-100 transition-colors"
                                >
                                  <Archive className="w-3.5 h-3.5" />
                                </button>
                              )}
                          </div>
                        </ModernCard>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Not Usable Materials Section */}
            {(filterUsability.length === 0 || filterUsability.includes('not-usable')) && (
              <div className="space-y-4 pt-6">
                <div className="flex items-center gap-2 px-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm" />
                  <h2 className="text-lg font-bold text-gray-900">Not Usable Materials</h2>
                  <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                    {displayedNotUsableMaterials.length}
                  </span>
                </div>

                {displayedNotUsableMaterials.length === 0 ? (
                  <ModernCard className="text-center py-14 bg-gray-50/80 border border-gray-200 border-dashed rounded-2xl">
                    <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600 font-medium">No materials marked as not usable</p>
                    <p className="text-sm text-gray-400 mt-1">Raw or in-ripening lots appear here</p>
                  </ModernCard>
                ) : (
                  <>
                    {/* Similar Table/Card structure for Not Usable materials - Reusing layout */}
                    <div className="hidden lg:block bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-gray-50/50 border-b border-gray-200 text-left">
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Lot ID</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Material</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Supplier</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Condition</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Usability Status</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Available</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Received</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Last Edited</th>
                            <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {displayedNotUsableMaterials.map((material) => (
                            <tr key={material.id} className="hover:bg-amber-50/30 transition-colors group">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="font-mono text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
                                  {material.lot_id}
                                </span>
                              </td>
                              <td className="px-6 py-4 font-medium text-gray-900">{material.name}</td>
                              <td className="px-6 py-4 text-sm text-gray-600">{material.supplier_name || '—'}</td>
                              <td className="px-6 py-4 text-sm text-gray-600">{material.condition}</td>
                              <td className="px-6 py-4">
                                <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-800">
                                  {getUsabilityStatusLabel(material)}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <span className="font-semibold text-amber-600">
                                  {material.unit === 'Pieces' ? Math.floor(material.quantity_available) : material.quantity_available.toFixed(2)} {material.unit}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-500">{material.received_date}</td>
                              <td className="px-6 py-4 text-sm text-gray-500">
                                {material.updated_by_name ? (
                                  <div className="flex flex-col">
                                    <span className="font-medium">{material.updated_by_name}</span>
                                    <span className="text-xs text-gray-400">{new Date(material.updated_at).toLocaleDateString()}</span>
                                  </div>
                                ) : '—'}
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => handleViewDetails(material)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors" title="View details">
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  {canWrite && material.is_archived && (
                                    <button onClick={() => handleUnarchive(material.id)} className="p-2 text-green-600 hover:bg-green-50 rounded-xl transition-colors" title="Unarchive">
                                      <ArchiveRestore className="w-4 h-4" />
                                    </button>
                                  )}
                                  {canWrite && !material.is_archived && material.quantity_available <= getArchiveThreshold(material.unit) && (
                                    <button onClick={() => handleArchive(material.id)} className="p-2 text-amber-600 hover:bg-amber-50 rounded-xl transition-colors" title="Archive">
                                      <Archive className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Cards for Not Usable */}
                    <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {displayedNotUsableMaterials.map((material) => (
                        <ModernCard key={material.id} padding="sm" className="flex flex-col h-full border-l-4 border-l-amber-400">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h3 className="font-bold text-gray-900">{material.name}</h3>
                              <span className="font-mono text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded mt-1 inline-block">
                                {material.lot_id}
                              </span>
                            </div>
                            <span className="px-2 py-1 rounded-lg text-xs font-bold bg-amber-100 text-amber-700">
                              {material.unit === 'Pieces' ? Math.floor(material.quantity_available) : material.quantity_available.toFixed(1)} {material.unit}
                            </span>
                          </div>

                          <div className="space-y-2 text-sm text-gray-600 mb-4 flex-1">
                            <div className="flex justify-between">
                              <span className="text-gray-400">Supplier</span>
                              <span className="font-medium text-gray-900">{material.supplier_name || '—'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">Condition</span>
                              <span className="font-medium text-gray-900">{material.condition}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-gray-400">Usability Status</span>
                              <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-800">
                                {getUsabilityStatusLabel(material)}
                              </span>
                            </div>
                          </div>

                          <div className="flex gap-2 pt-3 border-t border-gray-100 mt-auto">
                            <button
                              onClick={() => handleViewDetails(material)}
                              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 text-sm font-medium rounded-lg hover:bg-blue-100 transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              View
                            </button>
                            {canWrite && material.is_archived && (
                              <button
                                onClick={() => handleUnarchive(material.id)}
                                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-green-50 text-green-700 text-sm font-medium rounded-lg hover:bg-green-100 transition-colors"
                              >
                                <ArchiveRestore className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {canWrite && material.quantity_available <= getArchiveThreshold(material.unit) && !material.is_archived && (
                              <button
                                onClick={() => handleArchive(material.id)}
                                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-50 text-amber-700 text-sm font-medium rounded-lg hover:bg-amber-100 transition-colors"
                              >
                                <Archive className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </ModernCard>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Supplier Creation Modal */}
      {canWrite && showSupplierModal && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <ModernCard className="w-full max-w-md bg-white shadow-2xl rounded-2xl border border-gray-100 animate-slide-down">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900">Add New Supplier</h3>
              <button
                onClick={() => setShowSupplierModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Supplier Name</label>
                <input
                  type="text"
                  value={supplierFormData.name}
                  onChange={(e) => setSupplierFormData((prev) => ({ ...prev, name: e.target.value || '' }))}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  placeholder="Supplier name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Supplier Type</label>
                <select
                  value={supplierFormData.supplier_type}
                  onChange={(e) => setSupplierFormData((prev) => ({ ...prev, supplier_type: e.target.value as Supplier['supplier_type'] || 'raw_material' }))}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                >
                  <option value="raw_material">Raw Material</option>
                  <option value="recurring_product">Recurring Product</option>
                  <option value="machine">Machine</option>
                  <option value="multiple">Multiple</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <ModernButton onClick={() => setShowSupplierModal(false)} variant="secondary">
                Cancel
              </ModernButton>
              <ModernButton onClick={() => void handleCreateSupplier()}>
                Create Supplier
              </ModernButton>
            </div>
          </ModernCard>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <ModernCard className="w-full max-w-md bg-white shadow-2xl rounded-2xl border border-gray-100 animate-slide-down">
            <div className="flex flex-col items-center text-center p-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <X className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Delete Raw Material?</h3>
              <p className="text-gray-500 mb-6">
                Are you sure you want to delete this lot? This action cannot be undone.
              </p>
              <div className="flex gap-3 w-full">
                <ModernButton
                  onClick={() => setShowDeleteConfirm(null)}
                  variant="secondary"
                  fullWidth
                >
                  Cancel
                </ModernButton>
                <ModernButton
                  onClick={() => handleDelete(showDeleteConfirm)}
                  variant="danger"
                  fullWidth
                >
                  Delete
                </ModernButton>
              </div>
            </div>
          </ModernCard>
        </div>
      )}

      {/* Info Dialog */}
      <InfoDialog
        isOpen={showInfoDialog}
        onClose={() => setShowInfoDialog(false)}
        title="Raw Materials Guide"
        message="Manage your raw material inventory here. Add new lots, track quantities, and archive lots with low stock (≤5). Use filters to find specific materials quickly. Archived lots are hidden from production by default but can be viewed using the 'Show Archived' toggle."
        type="info"
      />

      {/* Lot Details Modal */}
      {selectedMaterial && (
        <LotDetailsModal
          isOpen={showDetailsModal}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedMaterial(null);
          }}
          onEdit={handleEditFromModal}
          onDelete={() => setShowDeleteConfirm(selectedMaterial.id)}
          lot={selectedMaterial}
          type="raw-material"
          isLocked={lockStatus[selectedMaterial.id]?.locked || false}
          batchIds={lockStatus[selectedMaterial.id]?.batchIds || []}
          canEdit={canWrite}
          onRefresh={async () => {
            await loadData();
            const updatedMaterials = await fetchRawMaterials(showArchived);
            const updated = updatedMaterials.find(m => m.id === selectedMaterial.id);
            if (updated) setSelectedMaterial(updated);
          }}
        onGoToLot={(lotId) => {
          const target = materials.find((m) => m.id === lotId);
          if (target) {
            setSelectedMaterial(target);
            setShowDetailsModal(true);
          } else {
            setError('Parent lot not found. Please refresh and try again.');
          }
        }}
        onTransformSuccess={async (newLot) => {
          const list = await fetchRawMaterials(showArchived);
          setMaterials(list);
          const found = list.find((m) => m.id === newLot.id);
          if (found) setSelectedMaterial(found);
        }}
        transformationRulesBySourceTagId={transformationRulesBySourceTagId}
        rawMaterialTags={rawMaterialTags}
        rawMaterialUnits={rawMaterialUnits}
        transformationUsers={users}
        />
      )}
    </div>
  );
}
