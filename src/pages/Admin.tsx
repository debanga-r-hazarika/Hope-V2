import { useEffect, useState } from 'react';
import { Shield, Package, Box, Factory, Plus, Edit2, Trash2, X, Save, RefreshCw, AlertCircle, CheckCircle2, Ruler } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import type {
  RawMaterialTag,
  RecurringProductTag,
  ProducedGoodsTag,
  CreateTagInput,
  UpdateTagInput,
} from '../types/tags';
import type {
  RawMaterialUnit,
  RecurringProductUnit,
  ProducedGoodsUnit,
  CreateUnitInput,
  UpdateUnitInput,
} from '../types/units';
import {
  fetchRawMaterialTags,
  createRawMaterialTag,
  updateRawMaterialTag,
  deleteRawMaterialTag,
  checkRawMaterialTagUsage,
  fetchRecurringProductTags,
  createRecurringProductTag,
  updateRecurringProductTag,
  deleteRecurringProductTag,
  checkRecurringProductTagUsage,
  fetchProducedGoodsTags,
  createProducedGoodsTag,
  updateProducedGoodsTag,
  deleteProducedGoodsTag,
  checkProducedGoodsTagUsage,
  validateTagKey,
  formatTagKey,
} from '../lib/tags';
import {
  fetchRawMaterialUnits,
  createRawMaterialUnit,
  updateRawMaterialUnit,
  deleteRawMaterialUnit,
  checkRawMaterialUnitUsage,
  fetchRecurringProductUnits,
  createRecurringProductUnit,
  updateRecurringProductUnit,
  deleteRecurringProductUnit,
  checkRecurringProductUnitUsage,
  fetchProducedGoodsUnits,
  createProducedGoodsUnit,
  updateProducedGoodsUnit,
  deleteProducedGoodsUnit,
  checkProducedGoodsUnitUsage,
  validateUnitKey,
  formatUnitKey,
} from '../lib/units';

type TagSection = 'raw-materials' | 'recurring-products' | 'produced-goods';
type UnitSection = 'raw-materials-units' | 'recurring-products-units' | 'produced-goods-units';
type MainSection = 'tags' | 'units';

interface AdminProps {
  onBack?: () => void;
}

export function Admin({ onBack }: AdminProps) {
  const { profile, loading: authLoading } = useAuth();
  const [mainSection, setMainSection] = useState<MainSection>('tags');
  const [activeTagSection, setActiveTagSection] = useState<TagSection>('raw-materials');
  const [activeUnitSection, setActiveUnitSection] = useState<UnitSection>('raw-materials-units');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Raw Material Tags
  const [rawMaterialTags, setRawMaterialTags] = useState<RawMaterialTag[]>([]);
  const [showRawMaterialForm, setShowRawMaterialForm] = useState(false);
  const [editingRawMaterialTag, setEditingRawMaterialTag] = useState<RawMaterialTag | null>(null);
  const [rawMaterialFormData, setRawMaterialFormData] = useState<CreateTagInput>({
    tag_key: '',
    display_name: '',
    description: '',
    status: 'active',
  });

  // Recurring Product Tags
  const [recurringProductTags, setRecurringProductTags] = useState<RecurringProductTag[]>([]);
  const [showRecurringProductForm, setShowRecurringProductForm] = useState(false);
  const [editingRecurringProductTag, setEditingRecurringProductTag] = useState<RecurringProductTag | null>(null);
  const [recurringProductFormData, setRecurringProductFormData] = useState<CreateTagInput>({
    tag_key: '',
    display_name: '',
    description: '',
    status: 'active',
  });

  // Produced Goods Tags
  const [producedGoodsTags, setProducedGoodsTags] = useState<ProducedGoodsTag[]>([]);
  const [showProducedGoodsForm, setShowProducedGoodsForm] = useState(false);
  const [editingProducedGoodsTag, setEditingProducedGoodsTag] = useState<ProducedGoodsTag | null>(null);
  const [producedGoodsFormData, setProducedGoodsFormData] = useState<CreateTagInput>({
    tag_key: '',
    display_name: '',
    description: '',
    status: 'active',
  });

  // Raw Material Units
  const [rawMaterialUnits, setRawMaterialUnits] = useState<RawMaterialUnit[]>([]);
  const [showRawMaterialUnitForm, setShowRawMaterialUnitForm] = useState(false);
  const [editingRawMaterialUnit, setEditingRawMaterialUnit] = useState<RawMaterialUnit | null>(null);
  const [rawMaterialUnitFormData, setRawMaterialUnitFormData] = useState<CreateUnitInput>({
    unit_key: '',
    display_name: '',
    description: '',
    allows_decimal: false,
    status: 'active',
  });

  // Recurring Product Units
  const [recurringProductUnits, setRecurringProductUnits] = useState<RecurringProductUnit[]>([]);
  const [showRecurringProductUnitForm, setShowRecurringProductUnitForm] = useState(false);
  const [editingRecurringProductUnit, setEditingRecurringProductUnit] = useState<RecurringProductUnit | null>(null);
  const [recurringProductUnitFormData, setRecurringProductUnitFormData] = useState<CreateUnitInput>({
    unit_key: '',
    display_name: '',
    description: '',
    allows_decimal: false,
    status: 'active',
  });

  // Produced Goods Units
  const [producedGoodsUnits, setProducedGoodsUnits] = useState<ProducedGoodsUnit[]>([]);
  const [showProducedGoodsUnitForm, setShowProducedGoodsUnitForm] = useState(false);
  const [editingProducedGoodsUnit, setEditingProducedGoodsUnit] = useState<ProducedGoodsUnit | null>(null);
  const [producedGoodsUnitFormData, setProducedGoodsUnitFormData] = useState<CreateUnitInput>({
    unit_key: '',
    display_name: '',
    description: '',
    allows_decimal: false,
    status: 'active',
  });

  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      setError('Access denied. Admin privileges required.');
    }
  }, [authLoading, isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      if (mainSection === 'tags') {
        loadAllTags();
      } else {
        loadAllUnits();
      }
    }
  }, [isAdmin, mainSection, activeTagSection, activeUnitSection]);

  const loadAllTags = async () => {
    setLoading(true);
    setError(null);
    try {
      const [rawTags, recurringTags, producedTags] = await Promise.all([
        fetchRawMaterialTags(true), // Include inactive
        fetchRecurringProductTags(true),
        fetchProducedGoodsTags(true),
      ]);
      setRawMaterialTags(rawTags);
      setRecurringProductTags(recurringTags);
      setProducedGoodsTags(producedTags);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tags');
    } finally {
      setLoading(false);
    }
  };

  const loadAllUnits = async () => {
    setLoading(true);
    setError(null);
    try {
      const [rawUnits, recurringUnits, producedUnits] = await Promise.all([
        fetchRawMaterialUnits(true), // Include inactive
        fetchRecurringProductUnits(true),
        fetchProducedGoodsUnits(true),
      ]);
      setRawMaterialUnits(rawUnits);
      setRecurringProductUnits(recurringUnits);
      setProducedGoodsUnits(producedUnits);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load units');
    } finally {
      setLoading(false);
    }
  };

  // Raw Material Tags Handlers
  const handleCreateRawMaterialTag = async () => {
    if (!profile?.id) {
      setError('User authentication required');
      return;
    }

    if (!rawMaterialFormData.tag_key || !rawMaterialFormData.display_name) {
      setError('Tag key and display name are required');
      return;
    }

    if (!validateTagKey(rawMaterialFormData.tag_key)) {
      setError('Tag key must be lowercase, alphanumeric with underscores only (e.g., banana_peel)');
      return;
    }

    try {
      setError(null);
      setSuccess(null);
      const created = await createRawMaterialTag(rawMaterialFormData, profile.id);
      setRawMaterialTags((prev) => [...prev, created].sort((a, b) => a.display_name.localeCompare(b.display_name)));
      setRawMaterialFormData({ tag_key: '', display_name: '', description: '', status: 'active' });
      setShowRawMaterialForm(false);
      setSuccess('Raw material tag created successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tag');
    }
  };

  const handleUpdateRawMaterialTag = async () => {
    if (!profile?.id || !editingRawMaterialTag) {
      setError('User authentication or tag selection required');
      return;
    }

    try {
      setError(null);
      setSuccess(null);
      const updated = await updateRawMaterialTag(editingRawMaterialTag.id, rawMaterialFormData, profile.id);
      setRawMaterialTags((prev) =>
        prev.map((tag) => (tag.id === updated.id ? updated : tag)).sort((a, b) => a.display_name.localeCompare(b.display_name))
      );
      setEditingRawMaterialTag(null);
      setRawMaterialFormData({ tag_key: '', display_name: '', description: '', status: 'active' });
      setShowRawMaterialForm(false);
      setSuccess('Raw material tag updated successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update tag');
    }
  };

  const handleEditRawMaterialTag = (tag: RawMaterialTag) => {
    setEditingRawMaterialTag(tag);
    setRawMaterialFormData({
      tag_key: tag.tag_key,
      display_name: tag.display_name,
      description: tag.description || '',
      status: tag.status,
    });
    setShowRawMaterialForm(true);
  };

  const handleDeleteRawMaterialTag = async (tag: RawMaterialTag) => {
    if (!window.confirm(`Are you sure you want to delete "${tag.display_name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setError(null);
      const usageCount = await checkRawMaterialTagUsage(tag.id);
      if (usageCount > 0) {
        setError(`Cannot delete tag. It is used by ${usageCount} raw material(s).`);
        return;
      }
      await deleteRawMaterialTag(tag.id);
      setRawMaterialTags((prev) => prev.filter((t) => t.id !== tag.id));
      setSuccess('Tag deleted successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete tag');
    }
  };

  // Recurring Product Tags Handlers (similar pattern)
  const handleCreateRecurringProductTag = async () => {
    if (!profile?.id) {
      setError('User authentication required');
      return;
    }

    if (!recurringProductFormData.tag_key || !recurringProductFormData.display_name) {
      setError('Tag key and display name are required');
      return;
    }

    if (!validateTagKey(recurringProductFormData.tag_key)) {
      setError('Tag key must be lowercase, alphanumeric with underscores only (e.g., bottle_250ml)');
      return;
    }

    try {
      setError(null);
      setSuccess(null);
      const created = await createRecurringProductTag(recurringProductFormData, profile.id);
      setRecurringProductTags((prev) => [...prev, created].sort((a, b) => a.display_name.localeCompare(b.display_name)));
      setRecurringProductFormData({ tag_key: '', display_name: '', description: '', status: 'active' });
      setShowRecurringProductForm(false);
      setSuccess('Recurring product tag created successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tag');
    }
  };

  const handleUpdateRecurringProductTag = async () => {
    if (!profile?.id || !editingRecurringProductTag) {
      setError('User authentication or tag selection required');
      return;
    }

    try {
      setError(null);
      setSuccess(null);
      const updated = await updateRecurringProductTag(editingRecurringProductTag.id, recurringProductFormData, profile.id);
      setRecurringProductTags((prev) =>
        prev.map((tag) => (tag.id === updated.id ? updated : tag)).sort((a, b) => a.display_name.localeCompare(b.display_name))
      );
      setEditingRecurringProductTag(null);
      setRecurringProductFormData({ tag_key: '', display_name: '', description: '', status: 'active' });
      setShowRecurringProductForm(false);
      setSuccess('Recurring product tag updated successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update tag');
    }
  };

  const handleEditRecurringProductTag = (tag: RecurringProductTag) => {
    setEditingRecurringProductTag(tag);
    setRecurringProductFormData({
      tag_key: tag.tag_key,
      display_name: tag.display_name,
      description: tag.description || '',
      status: tag.status,
    });
    setShowRecurringProductForm(true);
  };

  const handleDeleteRecurringProductTag = async (tag: RecurringProductTag) => {
    if (!window.confirm(`Are you sure you want to delete "${tag.display_name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setError(null);
      const usageCount = await checkRecurringProductTagUsage(tag.id);
      if (usageCount > 0) {
        setError(`Cannot delete tag. It is used by ${usageCount} recurring product(s).`);
        return;
      }
      await deleteRecurringProductTag(tag.id);
      setRecurringProductTags((prev) => prev.filter((t) => t.id !== tag.id));
      setSuccess('Tag deleted successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete tag');
    }
  };

  // Produced Goods Tags Handlers (similar pattern)
  const handleCreateProducedGoodsTag = async () => {
    if (!profile?.id) {
      setError('User authentication required');
      return;
    }

    if (!producedGoodsFormData.tag_key || !producedGoodsFormData.display_name) {
      setError('Tag key and display name are required');
      return;
    }

    if (!validateTagKey(producedGoodsFormData.tag_key)) {
      setError('Tag key must be lowercase, alphanumeric with underscores only (e.g., banana_alkali_liquid)');
      return;
    }

    try {
      setError(null);
      setSuccess(null);
      const created = await createProducedGoodsTag(producedGoodsFormData, profile.id);
      setProducedGoodsTags((prev) => [...prev, created].sort((a, b) => a.display_name.localeCompare(b.display_name)));
      setProducedGoodsFormData({ tag_key: '', display_name: '', description: '', status: 'active' });
      setShowProducedGoodsForm(false);
      setSuccess('Produced goods tag created successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tag');
    }
  };

  const handleUpdateProducedGoodsTag = async () => {
    if (!profile?.id || !editingProducedGoodsTag) {
      setError('User authentication or tag selection required');
      return;
    }

    try {
      setError(null);
      setSuccess(null);
      const updated = await updateProducedGoodsTag(editingProducedGoodsTag.id, producedGoodsFormData, profile.id);
      setProducedGoodsTags((prev) =>
        prev.map((tag) => (tag.id === updated.id ? updated : tag)).sort((a, b) => a.display_name.localeCompare(b.display_name))
      );
      setEditingProducedGoodsTag(null);
      setProducedGoodsFormData({ tag_key: '', display_name: '', description: '', status: 'active' });
      setShowProducedGoodsForm(false);
      setSuccess('Produced goods tag updated successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update tag');
    }
  };

  const handleEditProducedGoodsTag = (tag: ProducedGoodsTag) => {
    setEditingProducedGoodsTag(tag);
    setProducedGoodsFormData({
      tag_key: tag.tag_key,
      display_name: tag.display_name,
      description: tag.description || '',
      status: tag.status,
    });
    setShowProducedGoodsForm(true);
  };

  const handleDeleteProducedGoodsTag = async (tag: ProducedGoodsTag) => {
    if (!window.confirm(`Are you sure you want to delete "${tag.display_name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setError(null);
      const usageCount = await checkProducedGoodsTagUsage(tag.id);
      if (usageCount > 0) {
        setError(`Cannot delete tag. It is used by ${usageCount} produced good(s) or production batch(es).`);
        return;
      }
      await deleteProducedGoodsTag(tag.id);
      setProducedGoodsTags((prev) => prev.filter((t) => t.id !== tag.id));
      setSuccess('Tag deleted successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete tag');
    }
  };

  // Auto-generate tag_key from display_name
  const handleDisplayNameChange = (
    displayName: string,
    type: 'raw-material' | 'recurring-product' | 'produced-goods'
  ) => {
    const formatted = formatTagKey(displayName);
    if (type === 'raw-material') {
      setRawMaterialFormData((prev) => ({ ...prev, display_name: displayName, tag_key: formatted }));
    } else if (type === 'recurring-product') {
      setRecurringProductFormData((prev) => ({ ...prev, display_name: displayName, tag_key: formatted }));
    } else {
      setProducedGoodsFormData((prev) => ({ ...prev, display_name: displayName, tag_key: formatted }));
    }
  };

  // ============================================
  // UNIT HANDLERS
  // ============================================

  // Raw Material Units Handlers
  const handleCreateRawMaterialUnit = async () => {
    if (!profile?.id) {
      setError('User authentication required');
      return;
    }

    if (!rawMaterialUnitFormData.unit_key || !rawMaterialUnitFormData.display_name) {
      setError('Unit key and display name are required');
      return;
    }

    if (!validateUnitKey(rawMaterialUnitFormData.unit_key)) {
      setError('Unit key must be lowercase, alphanumeric with underscores only (e.g., kg, pieces)');
      return;
    }

    try {
      setError(null);
      setSuccess(null);
      const created = await createRawMaterialUnit(rawMaterialUnitFormData, profile.id);
      setRawMaterialUnits((prev) => [...prev, created].sort((a, b) => a.display_name.localeCompare(b.display_name)));
      setRawMaterialUnitFormData({ unit_key: '', display_name: '', description: '', allows_decimal: false, status: 'active' });
      setShowRawMaterialUnitForm(false);
      setSuccess('Raw material unit created successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create unit');
    }
  };

  const handleUpdateRawMaterialUnit = async () => {
    if (!profile?.id || !editingRawMaterialUnit) {
      setError('User authentication or unit selection required');
      return;
    }

    try {
      setError(null);
      setSuccess(null);
      const updated = await updateRawMaterialUnit(editingRawMaterialUnit.id, rawMaterialUnitFormData, profile.id);
      setRawMaterialUnits((prev) =>
        prev.map((unit) => (unit.id === updated.id ? updated : unit)).sort((a, b) => a.display_name.localeCompare(b.display_name))
      );
      setEditingRawMaterialUnit(null);
      setRawMaterialUnitFormData({ unit_key: '', display_name: '', description: '', allows_decimal: false, status: 'active' });
      setShowRawMaterialUnitForm(false);
      setSuccess('Raw material unit updated successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update unit');
    }
  };

  const handleEditRawMaterialUnit = (unit: RawMaterialUnit) => {
    setEditingRawMaterialUnit(unit);
    setRawMaterialUnitFormData({
      unit_key: unit.unit_key,
      display_name: unit.display_name,
      description: unit.description || '',
      allows_decimal: unit.allows_decimal,
      status: unit.status,
    });
    setShowRawMaterialUnitForm(true);
  };

  const handleDeleteRawMaterialUnit = async (unit: RawMaterialUnit) => {
    if (!window.confirm(`Are you sure you want to delete "${unit.display_name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setError(null);
      const usageCount = await checkRawMaterialUnitUsage(unit.id);
      if (usageCount > 0) {
        setError(`Cannot delete unit. It is used by ${usageCount} raw material(s).`);
        return;
      }
      await deleteRawMaterialUnit(unit.id);
      setRawMaterialUnits((prev) => prev.filter((u) => u.id !== unit.id));
      setSuccess('Unit deleted successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete unit');
    }
  };

  // Recurring Product Units Handlers
  const handleCreateRecurringProductUnit = async () => {
    if (!profile?.id) {
      setError('User authentication required');
      return;
    }

    if (!recurringProductUnitFormData.unit_key || !recurringProductUnitFormData.display_name) {
      setError('Unit key and display name are required');
      return;
    }

    if (!validateUnitKey(recurringProductUnitFormData.unit_key)) {
      setError('Unit key must be lowercase, alphanumeric with underscores only (e.g., pieces, boxes)');
      return;
    }

    try {
      setError(null);
      setSuccess(null);
      const created = await createRecurringProductUnit(recurringProductUnitFormData, profile.id);
      setRecurringProductUnits((prev) => [...prev, created].sort((a, b) => a.display_name.localeCompare(b.display_name)));
      setRecurringProductUnitFormData({ unit_key: '', display_name: '', description: '', allows_decimal: false, status: 'active' });
      setShowRecurringProductUnitForm(false);
      setSuccess('Recurring product unit created successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create unit');
    }
  };

  const handleUpdateRecurringProductUnit = async () => {
    if (!profile?.id || !editingRecurringProductUnit) {
      setError('User authentication or unit selection required');
      return;
    }

    try {
      setError(null);
      setSuccess(null);
      const updated = await updateRecurringProductUnit(editingRecurringProductUnit.id, recurringProductUnitFormData, profile.id);
      setRecurringProductUnits((prev) =>
        prev.map((unit) => (unit.id === updated.id ? updated : unit)).sort((a, b) => a.display_name.localeCompare(b.display_name))
      );
      setEditingRecurringProductUnit(null);
      setRecurringProductUnitFormData({ unit_key: '', display_name: '', description: '', allows_decimal: false, status: 'active' });
      setShowRecurringProductUnitForm(false);
      setSuccess('Recurring product unit updated successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update unit');
    }
  };

  const handleEditRecurringProductUnit = (unit: RecurringProductUnit) => {
    setEditingRecurringProductUnit(unit);
    setRecurringProductUnitFormData({
      unit_key: unit.unit_key,
      display_name: unit.display_name,
      description: unit.description || '',
      allows_decimal: unit.allows_decimal,
      status: unit.status,
    });
    setShowRecurringProductUnitForm(true);
  };

  const handleDeleteRecurringProductUnit = async (unit: RecurringProductUnit) => {
    if (!window.confirm(`Are you sure you want to delete "${unit.display_name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setError(null);
      const usageCount = await checkRecurringProductUnitUsage(unit.id);
      if (usageCount > 0) {
        setError(`Cannot delete unit. It is used by ${usageCount} recurring product(s).`);
        return;
      }
      await deleteRecurringProductUnit(unit.id);
      setRecurringProductUnits((prev) => prev.filter((u) => u.id !== unit.id));
      setSuccess('Unit deleted successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete unit');
    }
  };

  // Produced Goods Units Handlers
  const handleCreateProducedGoodsUnit = async () => {
    if (!profile?.id) {
      setError('User authentication required');
      return;
    }

    if (!producedGoodsUnitFormData.unit_key || !producedGoodsUnitFormData.display_name) {
      setError('Unit key and display name are required');
      return;
    }

    if (!validateUnitKey(producedGoodsUnitFormData.unit_key)) {
      setError('Unit key must be lowercase, alphanumeric with underscores only (e.g., kg, ltr, pieces)');
      return;
    }

    try {
      setError(null);
      setSuccess(null);
      const created = await createProducedGoodsUnit(producedGoodsUnitFormData, profile.id);
      setProducedGoodsUnits((prev) => [...prev, created].sort((a, b) => a.display_name.localeCompare(b.display_name)));
      setProducedGoodsUnitFormData({ unit_key: '', display_name: '', description: '', allows_decimal: false, status: 'active' });
      setShowProducedGoodsUnitForm(false);
      setSuccess('Produced goods unit created successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create unit');
    }
  };

  const handleUpdateProducedGoodsUnit = async () => {
    if (!profile?.id || !editingProducedGoodsUnit) {
      setError('User authentication or unit selection required');
      return;
    }

    try {
      setError(null);
      setSuccess(null);
      const updated = await updateProducedGoodsUnit(editingProducedGoodsUnit.id, producedGoodsUnitFormData, profile.id);
      setProducedGoodsUnits((prev) =>
        prev.map((unit) => (unit.id === updated.id ? updated : unit)).sort((a, b) => a.display_name.localeCompare(b.display_name))
      );
      setEditingProducedGoodsUnit(null);
      setProducedGoodsUnitFormData({ unit_key: '', display_name: '', description: '', allows_decimal: false, status: 'active' });
      setShowProducedGoodsUnitForm(false);
      setSuccess('Produced goods unit updated successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update unit');
    }
  };

  const handleEditProducedGoodsUnit = (unit: ProducedGoodsUnit) => {
    setEditingProducedGoodsUnit(unit);
    setProducedGoodsUnitFormData({
      unit_key: unit.unit_key,
      display_name: unit.display_name,
      description: unit.description || '',
      allows_decimal: unit.allows_decimal,
      status: unit.status,
    });
    setShowProducedGoodsUnitForm(true);
  };

  const handleDeleteProducedGoodsUnit = async (unit: ProducedGoodsUnit) => {
    if (!window.confirm(`Are you sure you want to delete "${unit.display_name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setError(null);
      const usageCount = await checkProducedGoodsUnitUsage(unit.id);
      if (usageCount > 0) {
        setError(`Cannot delete unit. It is used by ${usageCount} produced good(s) or production batch(es).`);
        return;
      }
      await deleteProducedGoodsUnit(unit.id);
      setProducedGoodsUnits((prev) => prev.filter((u) => u.id !== unit.id));
      setSuccess('Unit deleted successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete unit');
    }
  };

  // Auto-generate unit_key from display_name
  const handleUnitDisplayNameChange = (
    displayName: string,
    type: 'raw-material' | 'recurring-product' | 'produced-goods'
  ) => {
    const formatted = formatUnitKey(displayName);
    if (type === 'raw-material') {
      setRawMaterialUnitFormData((prev) => ({ ...prev, display_name: displayName, unit_key: formatted }));
    } else if (type === 'recurring-product') {
      setRecurringProductUnitFormData((prev) => ({ ...prev, display_name: displayName, unit_key: formatted }));
    } else {
      setProducedGoodsUnitFormData((prev) => ({ ...prev, display_name: displayName, unit_key: formatted }));
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <Shield className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-red-900 mb-2">Access Denied</h2>
          <p className="text-red-700">Admin privileges are required to access this page.</p>
          {onBack && (
            <button
              onClick={onBack}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Go Back
            </button>
          )}
        </div>
      </div>
    );
  }

  const tagSections = [
    { id: 'raw-materials' as TagSection, label: 'Raw Material Type Tags', icon: Package, color: 'text-green-600', bgColor: 'bg-green-100' },
    {
      id: 'recurring-products' as TagSection,
      label: 'Recurring Product Type Tags',
      icon: Box,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
    {
      id: 'produced-goods' as TagSection,
      label: 'Produced Goods Type Tags',
      icon: Factory,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4 sm:space-y-6 pt-4">
        {/* Header */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 md:p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Admin Configuration</h1>
                <p className="text-sm md:text-base text-gray-600 mt-1">Define classification standards and control inventory metadata</p>
              </div>
            </div>
            <button
              onClick={() => mainSection === 'tags' ? loadAllTags() : loadAllUnits()}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-green-700">{success}</p>
            </div>
            <button onClick={() => setSuccess(null)} className="text-green-600 hover:text-green-800">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Main Section Tabs (Tags vs Units) */}
        <div className="bg-white border border-gray-200 rounded-lg p-2 flex gap-2 mb-4">
          <button
            onClick={() => {
              setMainSection('tags');
              setError(null);
              setSuccess(null);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
              mainSection === 'tags'
                ? 'bg-indigo-100 text-indigo-600 font-semibold shadow-sm'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Package className="w-4 h-4" />
            <span className="text-sm">Tags</span>
          </button>
          <button
            onClick={() => {
              setMainSection('units');
              setError(null);
              setSuccess(null);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
              mainSection === 'units'
                ? 'bg-indigo-100 text-indigo-600 font-semibold shadow-sm'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Ruler className="w-4 h-4" />
            <span className="text-sm">Units</span>
          </button>
        </div>

        {/* Section Tabs */}
        {mainSection === 'tags' && (
          <div className="bg-white border border-gray-200 rounded-lg p-2 flex flex-wrap gap-2">
            {tagSections.map((section) => {
              const Icon = section.icon;
              const isActive = activeTagSection === section.id;
              return (
                <button
                  key={section.id}
                  onClick={() => {
                    setActiveTagSection(section.id);
                    setShowRawMaterialForm(false);
                    setShowRecurringProductForm(false);
                    setShowProducedGoodsForm(false);
                    setEditingRawMaterialTag(null);
                    setEditingRecurringProductTag(null);
                    setEditingProducedGoodsTag(null);
                    setError(null);
                    setSuccess(null);
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                    isActive
                      ? `${section.bgColor} ${section.color} font-semibold shadow-sm`
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm">{section.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {mainSection === 'units' && (
          <div className="bg-white border border-gray-200 rounded-lg p-2 flex flex-wrap gap-2">
            <button
              onClick={() => {
                setActiveUnitSection('raw-materials-units');
                setShowRawMaterialUnitForm(false);
                setEditingRawMaterialUnit(null);
                setError(null);
                setSuccess(null);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                activeUnitSection === 'raw-materials-units'
                  ? 'bg-green-100 text-green-600 font-semibold shadow-sm'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Package className="w-4 h-4" />
              <span className="text-sm">Raw Material Units</span>
            </button>
            <button
              onClick={() => {
                setActiveUnitSection('recurring-products-units');
                setShowRecurringProductUnitForm(false);
                setEditingRecurringProductUnit(null);
                setError(null);
                setSuccess(null);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                activeUnitSection === 'recurring-products-units'
                  ? 'bg-purple-100 text-purple-600 font-semibold shadow-sm'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Box className="w-4 h-4" />
              <span className="text-sm">Recurring Product Units</span>
            </button>
            <button
              onClick={() => {
                setActiveUnitSection('produced-goods-units');
                setShowProducedGoodsUnitForm(false);
                setEditingProducedGoodsUnit(null);
                setError(null);
                setSuccess(null);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                activeUnitSection === 'produced-goods-units'
                  ? 'bg-blue-100 text-blue-600 font-semibold shadow-sm'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Factory className="w-4 h-4" />
              <span className="text-sm">Produced Goods Units</span>
            </button>
          </div>
        )}

        {/* Active Section Content */}
        {loading && mainSection === 'tags' && activeTagSection === 'raw-materials' && (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
            <RefreshCw className="w-6 h-6 animate-spin text-gray-400 mx-auto" />
          </div>
        )}

        {loading && mainSection === 'units' && activeUnitSection === 'raw-materials-units' && (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
            <RefreshCw className="w-6 h-6 animate-spin text-gray-400 mx-auto" />
          </div>
        )}

        {/* Raw Material Tags Section */}
        {mainSection === 'tags' && activeTagSection === 'raw-materials' && !loading && (
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-lg p-4 md:p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Raw Material Type Tags</h2>
                  <p className="text-sm text-gray-600 mt-1">Define tags for classifying raw materials. Used in Phase 3 → Raw Materials.</p>
                </div>
                {!showRawMaterialForm && (
                  <button
                    onClick={() => {
                      setShowRawMaterialForm(true);
                      setEditingRawMaterialTag(null);
                      setRawMaterialFormData({ tag_key: '', display_name: '', description: '', status: 'active' });
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Create Tag
                  </button>
                )}
              </div>

              {showRawMaterialForm && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4 space-y-4">
                  <h3 className="font-semibold text-gray-900">
                    {editingRawMaterialTag ? 'Edit Tag' : 'Create New Tag'}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Display Name *
                      </label>
                      <input
                        type="text"
                        value={rawMaterialFormData.display_name}
                        onChange={(e) => handleDisplayNameChange(e.target.value, 'raw-material')}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                        placeholder="e.g., Banana Peel"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tag Key (System Identifier) *
                      </label>
                      <input
                        type="text"
                        value={rawMaterialFormData.tag_key}
                        onChange={(e) =>
                          setRawMaterialFormData((prev) => ({ ...prev, tag_key: e.target.value.toLowerCase().trim() }))
                        }
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 font-mono text-sm"
                        placeholder="e.g., banana_peel"
                        disabled={!!editingRawMaterialTag}
                      />
                      <p className="text-xs text-gray-500 mt-1">Lowercase, alphanumeric with underscores only</p>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <textarea
                        value={rawMaterialFormData.description || ''}
                        onChange={(e) => setRawMaterialFormData((prev) => ({ ...prev, description: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                        rows={2}
                        placeholder="Optional description"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      <select
                        value={rawMaterialFormData.status}
                        onChange={(e) =>
                          setRawMaterialFormData((prev) => ({ ...prev, status: e.target.value as 'active' | 'inactive' }))
                        }
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => {
                        setShowRawMaterialForm(false);
                        setEditingRawMaterialTag(null);
                        setRawMaterialFormData({ tag_key: '', display_name: '', description: '', status: 'active' });
                      }}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => (editingRawMaterialTag ? handleUpdateRawMaterialTag() : handleCreateRawMaterialTag())}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <Save className="w-4 h-4" />
                      {editingRawMaterialTag ? 'Update Tag' : 'Create Tag'}
                    </button>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tag Key</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Display Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {rawMaterialTags.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                          No tags found. Create your first tag to get started.
                        </td>
                      </tr>
                    ) : (
                      rawMaterialTags.map((tag) => (
                        <tr key={tag.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-mono text-gray-900">{tag.tag_key}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{tag.display_name}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{tag.description || '—'}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                tag.status === 'active'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {tag.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleEditRawMaterialTag(tag)}
                                className="text-blue-600 hover:text-blue-700 transition-colors"
                                title="Edit"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteRawMaterialTag(tag)}
                                className="text-red-600 hover:text-red-700 transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Recurring Product Tags Section - Similar structure */}
        {mainSection === 'tags' && activeTagSection === 'recurring-products' && !loading && (
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-lg p-4 md:p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Recurring Product Type Tags</h2>
                  <p className="text-sm text-gray-600 mt-1">Define tags for classifying recurring products (packaging, consumables). Used in Phase 3 → Recurring Products.</p>
                </div>
                {!showRecurringProductForm && (
                  <button
                    onClick={() => {
                      setShowRecurringProductForm(true);
                      setEditingRecurringProductTag(null);
                      setRecurringProductFormData({ tag_key: '', display_name: '', description: '', status: 'active' });
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Create Tag
                  </button>
                )}
              </div>

              {showRecurringProductForm && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4 space-y-4">
                  <h3 className="font-semibold text-gray-900">
                    {editingRecurringProductTag ? 'Edit Tag' : 'Create New Tag'}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Display Name *</label>
                      <input
                        type="text"
                        value={recurringProductFormData.display_name}
                        onChange={(e) => handleDisplayNameChange(e.target.value, 'recurring-product')}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500"
                        placeholder="e.g., Bottle 250ml"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tag Key (System Identifier) *</label>
                      <input
                        type="text"
                        value={recurringProductFormData.tag_key}
                        onChange={(e) =>
                          setRecurringProductFormData((prev) => ({ ...prev, tag_key: e.target.value.toLowerCase().trim() }))
                        }
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 font-mono text-sm"
                        placeholder="e.g., bottle_250ml"
                        disabled={!!editingRecurringProductTag}
                      />
                      <p className="text-xs text-gray-500 mt-1">Lowercase, alphanumeric with underscores only</p>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <textarea
                        value={recurringProductFormData.description || ''}
                        onChange={(e) => setRecurringProductFormData((prev) => ({ ...prev, description: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500"
                        rows={2}
                        placeholder="Optional description"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      <select
                        value={recurringProductFormData.status}
                        onChange={(e) =>
                          setRecurringProductFormData((prev) => ({ ...prev, status: e.target.value as 'active' | 'inactive' }))
                        }
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => {
                        setShowRecurringProductForm(false);
                        setEditingRecurringProductTag(null);
                        setRecurringProductFormData({ tag_key: '', display_name: '', description: '', status: 'active' });
                      }}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() =>
                        editingRecurringProductTag ? handleUpdateRecurringProductTag() : handleCreateRecurringProductTag()
                      }
                      className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      <Save className="w-4 h-4" />
                      {editingRecurringProductTag ? 'Update Tag' : 'Create Tag'}
                    </button>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tag Key</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Display Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {recurringProductTags.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                          No tags found. Create your first tag to get started.
                        </td>
                      </tr>
                    ) : (
                      recurringProductTags.map((tag) => (
                        <tr key={tag.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-mono text-gray-900">{tag.tag_key}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{tag.display_name}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{tag.description || '—'}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                tag.status === 'active'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {tag.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleEditRecurringProductTag(tag)}
                                className="text-blue-600 hover:text-blue-700 transition-colors"
                                title="Edit"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteRecurringProductTag(tag)}
                                className="text-red-600 hover:text-red-700 transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Produced Goods Tags Section - Similar structure */}
        {mainSection === 'tags' && activeTagSection === 'produced-goods' && !loading && (
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-lg p-4 md:p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Produced Goods Type Tags</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Define tags for classifying produced goods. Used in Phase 3 → Production → QA Approval Step.
                  </p>
                </div>
                {!showProducedGoodsForm && (
                  <button
                    onClick={() => {
                      setShowProducedGoodsForm(true);
                      setEditingProducedGoodsTag(null);
                      setProducedGoodsFormData({ tag_key: '', display_name: '', description: '', status: 'active' });
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Create Tag
                  </button>
                )}
              </div>

              {showProducedGoodsForm && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4 space-y-4">
                  <h3 className="font-semibold text-gray-900">
                    {editingProducedGoodsTag ? 'Edit Tag' : 'Create New Tag'}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Display Name *</label>
                      <input
                        type="text"
                        value={producedGoodsFormData.display_name}
                        onChange={(e) => handleDisplayNameChange(e.target.value, 'produced-goods')}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., Banana Alkali Liquid"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tag Key (System Identifier) *</label>
                      <input
                        type="text"
                        value={producedGoodsFormData.tag_key}
                        onChange={(e) =>
                          setProducedGoodsFormData((prev) => ({ ...prev, tag_key: e.target.value.toLowerCase().trim() }))
                        }
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                        placeholder="e.g., banana_alkali_liquid"
                        disabled={!!editingProducedGoodsTag}
                      />
                      <p className="text-xs text-gray-500 mt-1">Lowercase, alphanumeric with underscores only</p>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <textarea
                        value={producedGoodsFormData.description || ''}
                        onChange={(e) => setProducedGoodsFormData((prev) => ({ ...prev, description: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                        rows={2}
                        placeholder="Optional description"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      <select
                        value={producedGoodsFormData.status}
                        onChange={(e) =>
                          setProducedGoodsFormData((prev) => ({ ...prev, status: e.target.value as 'active' | 'inactive' }))
                        }
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => {
                        setShowProducedGoodsForm(false);
                        setEditingProducedGoodsTag(null);
                        setProducedGoodsFormData({ tag_key: '', display_name: '', description: '', status: 'active' });
                      }}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() =>
                        editingProducedGoodsTag ? handleUpdateProducedGoodsTag() : handleCreateProducedGoodsTag()
                      }
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Save className="w-4 h-4" />
                      {editingProducedGoodsTag ? 'Update Tag' : 'Create Tag'}
                    </button>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tag Key</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Display Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {producedGoodsTags.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                          No tags found. Create your first tag to get started.
                        </td>
                      </tr>
                    ) : (
                      producedGoodsTags.map((tag) => (
                        <tr key={tag.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-mono text-gray-900">{tag.tag_key}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{tag.display_name}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{tag.description || '—'}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                tag.status === 'active'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {tag.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleEditProducedGoodsTag(tag)}
                                className="text-blue-600 hover:text-blue-700 transition-colors"
                                title="Edit"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteProducedGoodsTag(tag)}
                                className="text-red-600 hover:text-red-700 transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================
            UNIT SECTIONS
            ============================================ */}

        {/* Raw Material Units Section */}
        {mainSection === 'units' && activeUnitSection === 'raw-materials-units' && !loading && (
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-lg p-4 md:p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Raw Material Units</h2>
                  <p className="text-sm text-gray-600 mt-1">Define units for measuring raw materials. Control whether decimal values are allowed (e.g., kg allows decimals, pieces do not).</p>
                </div>
                {!showRawMaterialUnitForm && (
                  <button
                    onClick={() => {
                      setShowRawMaterialUnitForm(true);
                      setEditingRawMaterialUnit(null);
                      setRawMaterialUnitFormData({ unit_key: '', display_name: '', description: '', allows_decimal: false, status: 'active' });
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Create Unit
                  </button>
                )}
              </div>

              {showRawMaterialUnitForm && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4 space-y-4">
                  <h3 className="font-semibold text-gray-900">
                    {editingRawMaterialUnit ? 'Edit Unit' : 'Create New Unit'}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Display Name *
                      </label>
                      <input
                        type="text"
                        value={rawMaterialUnitFormData.display_name}
                        onChange={(e) => handleUnitDisplayNameChange(e.target.value, 'raw-material')}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                        placeholder="e.g., Kg, Pieces, Ltr"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Unit Key (System Identifier) *
                      </label>
                      <input
                        type="text"
                        value={rawMaterialUnitFormData.unit_key}
                        onChange={(e) =>
                          setRawMaterialUnitFormData((prev) => ({ ...prev, unit_key: e.target.value.toLowerCase().trim() }))
                        }
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 font-mono text-sm"
                        placeholder="e.g., kg, pieces, ltr"
                        disabled={!!editingRawMaterialUnit}
                      />
                      <p className="text-xs text-gray-500 mt-1">Lowercase, alphanumeric with underscores only</p>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <textarea
                        value={rawMaterialUnitFormData.description || ''}
                        onChange={(e) => setRawMaterialUnitFormData((prev) => ({ ...prev, description: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                        rows={2}
                        placeholder="Optional description"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Allows Decimal</label>
                      <select
                        value={rawMaterialUnitFormData.allows_decimal ? 'true' : 'false'}
                        onChange={(e) =>
                          setRawMaterialUnitFormData((prev) => ({ ...prev, allows_decimal: e.target.value === 'true' }))
                        }
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                      >
                        <option value="false">No (Whole numbers only, e.g., pieces, boxes)</option>
                        <option value="true">Yes (Decimal values allowed, e.g., kg, ltr)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      <select
                        value={rawMaterialUnitFormData.status}
                        onChange={(e) =>
                          setRawMaterialUnitFormData((prev) => ({ ...prev, status: e.target.value as 'active' | 'inactive' }))
                        }
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => {
                        setShowRawMaterialUnitForm(false);
                        setEditingRawMaterialUnit(null);
                        setRawMaterialUnitFormData({ unit_key: '', display_name: '', description: '', allows_decimal: false, status: 'active' });
                      }}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => (editingRawMaterialUnit ? handleUpdateRawMaterialUnit() : handleCreateRawMaterialUnit())}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <Save className="w-4 h-4" />
                      {editingRawMaterialUnit ? 'Update Unit' : 'Create Unit'}
                    </button>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit Key</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Display Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Allows Decimal</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {rawMaterialUnits.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                          No units found. Create your first unit to get started.
                        </td>
                      </tr>
                    ) : (
                      rawMaterialUnits.map((unit) => (
                        <tr key={unit.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-mono text-gray-900">{unit.unit_key}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{unit.display_name}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                unit.allows_decimal
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-orange-100 text-orange-800'
                              }`}
                            >
                              {unit.allows_decimal ? 'Yes' : 'No'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">{unit.description || '—'}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                unit.status === 'active'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {unit.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleEditRawMaterialUnit(unit)}
                                className="text-blue-600 hover:text-blue-700 transition-colors"
                                title="Edit"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteRawMaterialUnit(unit)}
                                className="text-red-600 hover:text-red-700 transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Recurring Product Units Section */}
        {mainSection === 'units' && activeUnitSection === 'recurring-products-units' && !loading && (
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-lg p-4 md:p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Recurring Product Units</h2>
                  <p className="text-sm text-gray-600 mt-1">Define units for measuring recurring products. Control whether decimal values are allowed.</p>
                </div>
                {!showRecurringProductUnitForm && (
                  <button
                    onClick={() => {
                      setShowRecurringProductUnitForm(true);
                      setEditingRecurringProductUnit(null);
                      setRecurringProductUnitFormData({ unit_key: '', display_name: '', description: '', allows_decimal: false, status: 'active' });
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Create Unit
                  </button>
                )}
              </div>

              {showRecurringProductUnitForm && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4 space-y-4">
                  <h3 className="font-semibold text-gray-900">
                    {editingRecurringProductUnit ? 'Edit Unit' : 'Create New Unit'}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Display Name *</label>
                      <input
                        type="text"
                        value={recurringProductUnitFormData.display_name}
                        onChange={(e) => handleUnitDisplayNameChange(e.target.value, 'recurring-product')}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500"
                        placeholder="e.g., Pieces, Boxes, Bottles"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Unit Key (System Identifier) *</label>
                      <input
                        type="text"
                        value={recurringProductUnitFormData.unit_key}
                        onChange={(e) =>
                          setRecurringProductUnitFormData((prev) => ({ ...prev, unit_key: e.target.value.toLowerCase().trim() }))
                        }
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 font-mono text-sm"
                        placeholder="e.g., pieces, boxes, bottles"
                        disabled={!!editingRecurringProductUnit}
                      />
                      <p className="text-xs text-gray-500 mt-1">Lowercase, alphanumeric with underscores only</p>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <textarea
                        value={recurringProductUnitFormData.description || ''}
                        onChange={(e) => setRecurringProductUnitFormData((prev) => ({ ...prev, description: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500"
                        rows={2}
                        placeholder="Optional description"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Allows Decimal</label>
                      <select
                        value={recurringProductUnitFormData.allows_decimal ? 'true' : 'false'}
                        onChange={(e) =>
                          setRecurringProductUnitFormData((prev) => ({ ...prev, allows_decimal: e.target.value === 'true' }))
                        }
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="false">No (Whole numbers only, e.g., pieces, boxes)</option>
                        <option value="true">Yes (Decimal values allowed, e.g., kg, ltr)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      <select
                        value={recurringProductUnitFormData.status}
                        onChange={(e) =>
                          setRecurringProductUnitFormData((prev) => ({ ...prev, status: e.target.value as 'active' | 'inactive' }))
                        }
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => {
                        setShowRecurringProductUnitForm(false);
                        setEditingRecurringProductUnit(null);
                        setRecurringProductUnitFormData({ unit_key: '', display_name: '', description: '', allows_decimal: false, status: 'active' });
                      }}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => (editingRecurringProductUnit ? handleUpdateRecurringProductUnit() : handleCreateRecurringProductUnit())}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      <Save className="w-4 h-4" />
                      {editingRecurringProductUnit ? 'Update Unit' : 'Create Unit'}
                    </button>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit Key</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Display Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Allows Decimal</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {recurringProductUnits.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                          No units found. Create your first unit to get started.
                        </td>
                      </tr>
                    ) : (
                      recurringProductUnits.map((unit) => (
                        <tr key={unit.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-mono text-gray-900">{unit.unit_key}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{unit.display_name}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                unit.allows_decimal
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-orange-100 text-orange-800'
                              }`}
                            >
                              {unit.allows_decimal ? 'Yes' : 'No'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">{unit.description || '—'}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                unit.status === 'active'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {unit.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleEditRecurringProductUnit(unit)}
                                className="text-blue-600 hover:text-blue-700 transition-colors"
                                title="Edit"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteRecurringProductUnit(unit)}
                                className="text-red-600 hover:text-red-700 transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Produced Goods Units Section */}
        {mainSection === 'units' && activeUnitSection === 'produced-goods-units' && !loading && (
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-lg p-4 md:p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Produced Goods Units</h2>
                  <p className="text-sm text-gray-600 mt-1">Define units for measuring produced goods. Control whether decimal values are allowed.</p>
                </div>
                {!showProducedGoodsUnitForm && (
                  <button
                    onClick={() => {
                      setShowProducedGoodsUnitForm(true);
                      setEditingProducedGoodsUnit(null);
                      setProducedGoodsUnitFormData({ unit_key: '', display_name: '', description: '', allows_decimal: false, status: 'active' });
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Create Unit
                  </button>
                )}
              </div>

              {showProducedGoodsUnitForm && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4 space-y-4">
                  <h3 className="font-semibold text-gray-900">
                    {editingProducedGoodsUnit ? 'Edit Unit' : 'Create New Unit'}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Display Name *</label>
                      <input
                        type="text"
                        value={producedGoodsUnitFormData.display_name}
                        onChange={(e) => handleUnitDisplayNameChange(e.target.value, 'produced-goods')}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., Kg, Gm, Ltr, Pieces"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Unit Key (System Identifier) *</label>
                      <input
                        type="text"
                        value={producedGoodsUnitFormData.unit_key}
                        onChange={(e) =>
                          setProducedGoodsUnitFormData((prev) => ({ ...prev, unit_key: e.target.value.toLowerCase().trim() }))
                        }
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                        placeholder="e.g., kg, gm, ltr, pieces"
                        disabled={!!editingProducedGoodsUnit}
                      />
                      <p className="text-xs text-gray-500 mt-1">Lowercase, alphanumeric with underscores only</p>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <textarea
                        value={producedGoodsUnitFormData.description || ''}
                        onChange={(e) => setProducedGoodsUnitFormData((prev) => ({ ...prev, description: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                        rows={2}
                        placeholder="Optional description"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Allows Decimal</label>
                      <select
                        value={producedGoodsUnitFormData.allows_decimal ? 'true' : 'false'}
                        onChange={(e) =>
                          setProducedGoodsUnitFormData((prev) => ({ ...prev, allows_decimal: e.target.value === 'true' }))
                        }
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="false">No (Whole numbers only, e.g., pieces, boxes)</option>
                        <option value="true">Yes (Decimal values allowed, e.g., kg, ltr)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      <select
                        value={producedGoodsUnitFormData.status}
                        onChange={(e) =>
                          setProducedGoodsUnitFormData((prev) => ({ ...prev, status: e.target.value as 'active' | 'inactive' }))
                        }
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => {
                        setShowProducedGoodsUnitForm(false);
                        setEditingProducedGoodsUnit(null);
                        setProducedGoodsUnitFormData({ unit_key: '', display_name: '', description: '', allows_decimal: false, status: 'active' });
                      }}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => (editingProducedGoodsUnit ? handleUpdateProducedGoodsUnit() : handleCreateProducedGoodsUnit())}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Save className="w-4 h-4" />
                      {editingProducedGoodsUnit ? 'Update Unit' : 'Create Unit'}
                    </button>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit Key</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Display Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Allows Decimal</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {producedGoodsUnits.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                          No units found. Create your first unit to get started.
                        </td>
                      </tr>
                    ) : (
                      producedGoodsUnits.map((unit) => (
                        <tr key={unit.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-mono text-gray-900">{unit.unit_key}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{unit.display_name}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                unit.allows_decimal
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-orange-100 text-orange-800'
                              }`}
                            >
                              {unit.allows_decimal ? 'Yes' : 'No'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">{unit.description || '—'}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                unit.status === 'active'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {unit.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleEditProducedGoodsUnit(unit)}
                                className="text-blue-600 hover:text-blue-700 transition-colors"
                                title="Edit"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteProducedGoodsUnit(unit)}
                                className="text-red-600 hover:text-red-700 transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
