import { Fragment, useEffect, useMemo, useState } from 'react';
import { Shield, Package, Box, Factory, Plus, Edit2, Trash2, X, Save, RefreshCw, AlertCircle, CheckCircle2, Ruler, User, Mail, Users, History, FileText, BarChart3, Layers, ArrowRightLeft, LayoutGrid, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
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
import type {
  CustomerType,
  CreateCustomerTypeInput,
  UpdateCustomerTypeInput,
} from '../types/customer-types';
import {
  fetchCustomerTypes,
  createCustomerType,
  updateCustomerType,
  deleteCustomerType,
  checkCustomerTypeUsage,
  validateTypeKey,
  formatTypeKey,
} from '../lib/customer-types';
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
import type {
  RawMaterialLifecycleConfig,
  RawMaterialLifecycleStage,
} from '../types/raw-material-lifecycle';
import {
  fetchRawMaterialLifecycleConfigByTagId,
  upsertRawMaterialLifecycleConfig,
} from '../lib/raw-material-lifecycles';
import type {
  TransformationRuleWithTarget,
  TransformationRuleStep,
} from '../types/transformation-rules';
import {
  fetchTransformationRulesBySourceTagId,
  upsertTransformationRulesForSource,
} from '../lib/transformation-rules';
import type { RawMaterialType, CreateRawMaterialTypeInput } from '../types/raw-material-types';
import { fetchRawMaterialTypes, createRawMaterialType, updateRawMaterialType } from '../lib/raw-material-types';
import type {
  EmailDistributionList,
  EmailTemplate,
  EmailTriggerConfigWithRelations,
  CreateDistributionListInput,
  UpdateEmailTemplateInput,
} from '../types/transactional-email';
import {
  fetchDistributionLists,
  createDistributionList,
  updateDistributionList,
  deleteDistributionList,
  fetchDistributionListMembers,
  addDistributionListMember,
  removeDistributionListMember,
  fetchEmailTemplates,
  updateEmailTemplate,
  fetchTriggerConfig,
  upsertTriggerConfig,
  fetchUsersForMemberPicker,
  sendTestTransactionEmail,
  fetchEmailLogs,
  sendFinanceReportEmail,
  sendSalesReportEmail,
  sendInventoryReportEmail,
} from '../lib/transactional-email';
import { TRANSACTIONAL_EMAIL_TRIGGER_KEYS } from '../types/transactional-email';

type TagSection = 'raw-materials' | 'recurring-products' | 'produced-goods' | 'raw-material-types';
type UnitSection = 'raw-materials-units' | 'recurring-products-units' | 'produced-goods-units';
type TransactionalEmailSection = 'distribution-lists' | 'triggers' | 'templates' | 'email-log' | 'finance-report' | 'sales-report' | 'inventory-report';
type MainSection = 'tags' | 'units' | 'customer-types' | 'transactional-email';

interface AdminProps {
  onBack?: () => void;
}

export function Admin({ onBack }: AdminProps = {}) {
  const { profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [mainSection, setMainSection] = useState<MainSection>('tags');
  const [activeTagSection, setActiveTagSection] = useState<TagSection>('raw-materials');
  const [activeUnitSection, setActiveUnitSection] = useState<UnitSection>('raw-materials-units');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Raw Material Tags
  const [rawMaterialTags, setRawMaterialTags] = useState<RawMaterialTag[]>([]);
  const [rawMaterialTypes, setRawMaterialTypes] = useState<RawMaterialType[]>([]);
  const [showRawMaterialForm, setShowRawMaterialForm] = useState(false);
  const [editingRawMaterialTag, setEditingRawMaterialTag] = useState<RawMaterialTag | null>(null);
  const [showRawMaterialTypeForm, setShowRawMaterialTypeForm] = useState(false);
  const [editingRawMaterialType, setEditingRawMaterialType] = useState<RawMaterialType | null>(null);
  const [rawMaterialFormData, setRawMaterialFormData] = useState<CreateTagInput>({
    tag_key: '',
    display_name: '',
    description: '',
    lot_prefix: '',
    allowed_unit_ids: [],
    allowed_conditions: [],
    lifecycle_type: '',
    status: 'active',
  });
  const [newConditionInput, setNewConditionInput] = useState('');

  // Raw Material Lifecycle (multi-stage) editor
  const [showLifecycleEditor, setShowLifecycleEditor] = useState(false);
  const [lifecycleEditingTag, setLifecycleEditingTag] = useState<RawMaterialTag | null>(null);
  const [lifecycleLoading, setLifecycleLoading] = useState(false);
  const [lifecycleSaving, setLifecycleSaving] = useState(false);
  const [lifecycleConfig, setLifecycleConfig] = useState<RawMaterialLifecycleConfig | null>(null);
  const [lifecycleStagesDraft, setLifecycleStagesDraft] = useState<Array<{
    stage_key: string;
    stage_label: string;
    stage_order: number;
    is_default: boolean;
    makes_usable: boolean;
  }>>([]);

  // Transformation rules editor (allowed targets + default steps per source tag)
  const [showTransformRulesEditor, setShowTransformRulesEditor] = useState(false);
  const [transformRulesEditingTag, setTransformRulesEditingTag] = useState<RawMaterialTag | null>(null);
  const [transformRulesLoading, setTransformRulesLoading] = useState(false);
  const [transformRulesSaving, setTransformRulesSaving] = useState(false);
  const [transformRulesDraft, setTransformRulesDraft] = useState<Array<{ target_tag_id: string; default_steps: TransformationRuleStep[] }>>([]);

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
    archive_threshold: 5,
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
    archive_threshold: 5,
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

  // Customer Types
  const [customerTypes, setCustomerTypes] = useState<CustomerType[]>([]);
  const [showCustomerTypeForm, setShowCustomerTypeForm] = useState(false);
  const [editingCustomerType, setEditingCustomerType] = useState<CustomerType | null>(null);
  const [customerTypeFormData, setCustomerTypeFormData] = useState<CreateCustomerTypeInput>({
    type_key: '',
    display_name: '',
    description: '',
    status: 'active',
  });

  // Transactional Email
  const [transactionalEmailSection, setTransactionalEmailSection] = useState<TransactionalEmailSection>('distribution-lists');
  const [distributionLists, setDistributionLists] = useState<EmailDistributionList[]>([]);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [triggerConfigs, setTriggerConfigs] = useState<EmailTriggerConfigWithRelations[]>([]);
  const [usersForPicker, setUsersForPicker] = useState<{ id: string; full_name: string; email: string }[]>([]);
  const [showDlForm, setShowDlForm] = useState(false);
  const [editingDl, setEditingDl] = useState<EmailDistributionList | null>(null);
  const [dlFormData, setDlFormData] = useState<CreateDistributionListInput>({ name: '', description: '' });
  const [managingMembersDlId, setManagingMembersDlId] = useState<string | null>(null);
  const [dlMembers, setDlMembers] = useState<{ id: string; user_id: string; user?: { full_name: string; email: string } | null }[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [templateFormData, setTemplateFormData] = useState<UpdateEmailTemplateInput>({});
  const [triggerFormByKey, setTriggerFormByKey] = useState<Record<string, { template_id: string; distribution_list_id: string; enabled: boolean }>>({});
  const [testEmailLoading, setTestEmailLoading] = useState(false);

  // Email log
  const [emailLogs, setEmailLogs] = useState<Array<{ id: string; trigger_key: string; recipient_count: number; sent_at: string; payload_snapshot: Record<string, unknown> | null; error_message: string | null }>>([]);
  const [emailLogsTotal, setEmailLogsTotal] = useState(0);
  const [emailLogsLoading, setEmailLogsLoading] = useState(false);
  const [emailLogFilters, setEmailLogFilters] = useState({ triggerKey: '', fromDate: '', toDate: '', status: '' as '' | 'success' | 'error' });
  const [emailLogPage, setEmailLogPage] = useState(0);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const emailLogPageSize = 25;

  // Finance report (manual send)
  const [financeReportStartDate, setFinanceReportStartDate] = useState('');
  const [financeReportEndDate, setFinanceReportEndDate] = useState('');
  const [financeReportDlId, setFinanceReportDlId] = useState('');
  const [financeReportSending, setFinanceReportSending] = useState(false);

  // Sales report (manual send)
  const [salesReportStartDate, setSalesReportStartDate] = useState('');
  const [salesReportEndDate, setSalesReportEndDate] = useState('');
  const [salesReportDlId, setSalesReportDlId] = useState('');
  const [salesReportSending, setSalesReportSending] = useState(false);

  // Inventory report (manual send)
  const [inventoryReportStartDate, setInventoryReportStartDate] = useState('');
  const [inventoryReportEndDate, setInventoryReportEndDate] = useState('');
  const [inventoryReportDlId, setInventoryReportDlId] = useState('');
  const [inventoryReportSending, setInventoryReportSending] = useState(false);

  // Only show templates that are used by current triggers (cleaner Admin email page)
  const usedEmailTemplates = useMemo(
    () => emailTemplates.filter((t) => TRANSACTIONAL_EMAIL_TRIGGER_KEYS.some((k) => k.key === t.trigger_key)),
    [emailTemplates]
  );

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
      } else if (mainSection === 'units') {
        loadAllUnits();
      } else if (mainSection === 'customer-types') {
        loadCustomerTypes();
      } else if (mainSection === 'transactional-email') {
        loadTransactionalEmailData();
      }
    }
  }, [isAdmin, mainSection, activeTagSection, activeUnitSection]);

  const loadAllTags = async () => {
    setLoading(true);
    setError(null);
    try {
      const [rawTags, recurringTags, producedTags, rawTypes, rawUnits] = await Promise.all([
        fetchRawMaterialTags(true),
        fetchRecurringProductTags(true),
        fetchProducedGoodsTags(true),
        fetchRawMaterialTypes(true),
        fetchRawMaterialUnits(true),
      ]);
      setRawMaterialTags(rawTags);
      setRecurringProductTags(recurringTags);
      setProducedGoodsTags(producedTags);
      setRawMaterialTypes(rawTypes);
      setRawMaterialUnits(rawUnits);
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

  const loadCustomerTypes = async () => {
    setLoading(true);
    setError(null);
    try {
      const types = await fetchCustomerTypes(true); // Include inactive
      setCustomerTypes(types);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load customer types');
    } finally {
      setLoading(false);
    }
  };

  const loadTransactionalEmailData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [lists, templates, configs, users] = await Promise.all([
        fetchDistributionLists(),
        fetchEmailTemplates(),
        fetchTriggerConfig(),
        fetchUsersForMemberPicker(),
      ]);
      setDistributionLists(lists);
      setEmailTemplates(templates);
      setTriggerConfigs(configs);
      setUsersForPicker(users);
      const initial: Record<string, { template_id: string; distribution_list_id: string; enabled: boolean }> = {};
      TRANSACTIONAL_EMAIL_TRIGGER_KEYS.forEach(({ key }) => {
        const cfg = configs.find((c) => c.trigger_key === key);
        initial[key] = {
          template_id: cfg?.template_id ?? '',
          distribution_list_id: cfg?.distribution_list_id ?? '',
          enabled: cfg?.enabled ?? false,
        };
      });
      setTriggerFormByKey(initial);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transactional email data');
    } finally {
      setLoading(false);
    }
  };

  const loadEmailLogs = async () => {
    setEmailLogsLoading(true);
    setError(null);
    try {
      const { logs, total } = await fetchEmailLogs({
        triggerKey: emailLogFilters.triggerKey || undefined,
        fromDate: emailLogFilters.fromDate || undefined,
        toDate: emailLogFilters.toDate || undefined,
        status: emailLogFilters.status || undefined,
        limit: emailLogPageSize,
        offset: emailLogPage * emailLogPageSize,
      });
      setEmailLogs(logs);
      setEmailLogsTotal(total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load email logs');
    } finally {
      setEmailLogsLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin && mainSection === 'transactional-email' && transactionalEmailSection === 'email-log') {
      void loadEmailLogs();
    }
  }, [isAdmin, mainSection, transactionalEmailSection, emailLogFilters.triggerKey, emailLogFilters.fromDate, emailLogFilters.toDate, emailLogFilters.status, emailLogPage]);

  // Reset to first page when filters change
  useEffect(() => {
    setEmailLogPage(0);
  }, [emailLogFilters.triggerKey, emailLogFilters.fromDate, emailLogFilters.toDate, emailLogFilters.status]);

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
      setRawMaterialFormData({
        tag_key: '',
        display_name: '',
        description: '',
        lot_prefix: '',
        allowed_unit_ids: [],
        lifecycle_type: '',
        status: 'active',
      });
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
      setRawMaterialFormData({
        tag_key: '',
        display_name: '',
        description: '',
        lot_prefix: '',
        allowed_unit_ids: [],
        lifecycle_type: '',
        status: 'active',
      });
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
      lot_prefix: tag.lot_prefix || '',
      allowed_unit_ids: tag.allowed_unit_ids || [],
      allowed_conditions: tag.allowed_conditions || [],
      lifecycle_type: tag.lifecycle_type || '',
      status: tag.status,
    });
    setNewConditionInput('');
    setShowRawMaterialForm(true);
  };

  const openLifecycleEditor = async (tag: RawMaterialTag) => {
    setError(null);
    setSuccess(null);
    setLifecycleEditingTag(tag);
    setShowLifecycleEditor(true);
    setLifecycleLoading(true);
    try {
      const cfg = await fetchRawMaterialLifecycleConfigByTagId(tag.id);
      setLifecycleConfig(cfg);
      if (cfg && cfg.stages.length > 0) {
        setLifecycleStagesDraft(
          cfg.stages
            .slice()
            .sort((a, b) => a.stage_order - b.stage_order)
            .map((s) => ({
              stage_key: s.stage_key,
              stage_label: s.stage_label,
              stage_order: s.stage_order,
              is_default: s.is_default,
              makes_usable: s.makes_usable,
            }))
        );
      } else {
        // Default template (admin can edit)
        setLifecycleStagesDraft([
          { stage_key: 'NOT_USABLE', stage_label: 'Full Raw', stage_order: 1, is_default: true, makes_usable: false },
          { stage_key: 'IN_RIPENING', stage_label: 'In Ripening', stage_order: 2, is_default: false, makes_usable: false },
          { stage_key: 'READY_FOR_PRODUCTION', stage_label: 'Ready for Production', stage_order: 3, is_default: false, makes_usable: true },
        ]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load lifecycle configuration');
    } finally {
      setLifecycleLoading(false);
    }
  };

  const closeLifecycleEditor = () => {
    setShowLifecycleEditor(false);
    setLifecycleEditingTag(null);
    setLifecycleConfig(null);
    setLifecycleStagesDraft([]);
  };

  const normalizeStageKey = (value: string) =>
    (value || '')
      .toUpperCase()
      .replace(/[^A-Z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');

  const saveLifecycleEditor = async () => {
    if (!lifecycleEditingTag) return;
    setLifecycleSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const stages = lifecycleStagesDraft
        .map((s, idx) => ({
          ...s,
          stage_key: normalizeStageKey(s.stage_key),
          stage_order: idx + 1,
        }))
        .filter((s) => s.stage_key && s.stage_label);

      if (stages.length < 2) {
        setError('Add at least 2 stages for a multi-stage lifecycle.');
        setLifecycleSaving(false);
        return;
      }

      const stageKeys = new Set<string>();
      for (const s of stages) {
        if (stageKeys.has(s.stage_key)) {
          setError(`Duplicate stage key: ${s.stage_key}`);
          setLifecycleSaving(false);
          return;
        }
        stageKeys.add(s.stage_key);
      }

      // Ensure exactly one default
      const defaultCount = stages.filter((s) => s.is_default).length;
      if (defaultCount !== 1) {
        setError('Select exactly one default stage.');
        setLifecycleSaving(false);
        return;
      }

      // Linear transitions (stage 1 -> stage 2 -> stage 3 ...)
      const transitions = stages.slice(0, -1).map((s, idx) => ({
        from_stage_key: s.stage_key,
        to_stage_key: stages[idx + 1].stage_key,
      }));

      const saved = await upsertRawMaterialLifecycleConfig({
        raw_material_tag_id: lifecycleEditingTag.id,
        stages,
        transitions,
      });
      setLifecycleConfig(saved);

      // Mark tag as admin-managed multi-stage (optional marker; lifecycle tables are the source of truth)
      if (profile?.id && lifecycleEditingTag.lifecycle_type !== 'multi_stage') {
        const updated = await updateRawMaterialTag(lifecycleEditingTag.id, { lifecycle_type: 'multi_stage' }, profile.id);
        setRawMaterialTags((prev) => prev.map((t) => (t.id === updated.id ? updated : t)).sort((a, b) => a.display_name.localeCompare(b.display_name)));
        setLifecycleEditingTag(updated);
      }

      setSuccess('Lifecycle saved successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save lifecycle');
    } finally {
      setLifecycleSaving(false);
    }
  };

  const openTransformRulesEditor = async (tag: RawMaterialTag) => {
    setTransformRulesEditingTag(tag);
    setShowTransformRulesEditor(true);
    setTransformRulesLoading(true);
    setTransformRulesDraft([]);
    try {
      const rules = await fetchTransformationRulesBySourceTagId(tag.id);
      setTransformRulesDraft(
        rules.map((r) => ({ target_tag_id: r.target_tag_id, default_steps: r.default_steps || [] }))
      );
    } catch {
      setTransformRulesDraft([]);
    } finally {
      setTransformRulesLoading(false);
    }
  };

  const closeTransformRulesEditor = () => {
    if (!transformRulesSaving) {
      setShowTransformRulesEditor(false);
      setTransformRulesEditingTag(null);
      setTransformRulesDraft([]);
    }
  };

  const saveTransformRulesEditor = async () => {
    if (!transformRulesEditingTag?.id) return;
    setTransformRulesSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await upsertTransformationRulesForSource({
        source_tag_id: transformRulesEditingTag.id,
        rules: transformRulesDraft.filter((r) => r.target_tag_id),
      });
      setSuccess('Transformation targets saved.');
      closeTransformRulesEditor();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save transformation rules');
    } finally {
      setTransformRulesSaving(false);
    }
  };

  const handleCreateRawMaterialType = async () => {
    if (!profile?.id) {
      setError('User authentication required');
      return;
    }
    if (!rawMaterialTypeFormData.type_key?.trim() || !rawMaterialTypeFormData.type_name?.trim() || !rawMaterialTypeFormData.raw_material_tag_id) {
      setError('Type key, type name, and linked tag are required');
      return;
    }
    if (!validateTagKey(rawMaterialTypeFormData.type_key)) {
      setError('Type key must be lowercase, alphanumeric with underscores only (e.g., banana)');
      return;
    }
    try {
      setError(null);
      setSuccess(null);
      const created = await createRawMaterialType(
        {
          type_key: rawMaterialTypeFormData.type_key.trim(),
          type_name: rawMaterialTypeFormData.type_name.trim(),
          raw_material_tag_id: rawMaterialTypeFormData.raw_material_tag_id,
          allowed_unit_ids: rawMaterialTypeFormData.allowed_unit_ids,
          status: rawMaterialTypeFormData.status,
        },
        profile.id
      );
      setRawMaterialTypes((prev) => [...prev, created].sort((a, b) => a.type_name.localeCompare(b.type_name)));
      setRawMaterialTypeFormData({ type_key: '', type_name: '', raw_material_tag_id: '', allowed_unit_ids: [], status: 'active' });
      setShowRawMaterialTypeForm(false);
      setSuccess('Raw material type created successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create raw material type');
    }
  };

  const handleUpdateRawMaterialType = async () => {
    if (!profile?.id || !editingRawMaterialType) {
      setError('User authentication or type selection required');
      return;
    }
    try {
      setError(null);
      setSuccess(null);
      const updated = await updateRawMaterialType(
        editingRawMaterialType.id,
        {
          type_name: rawMaterialTypeFormData.type_name.trim(),
          raw_material_tag_id: rawMaterialTypeFormData.raw_material_tag_id,
          allowed_unit_ids: rawMaterialTypeFormData.allowed_unit_ids,
          status: rawMaterialTypeFormData.status,
        },
        profile.id
      );
      setRawMaterialTypes((prev) =>
        prev.map((t) => (t.id === updated.id ? updated : t)).sort((a, b) => a.type_name.localeCompare(b.type_name))
      );
      setEditingRawMaterialType(null);
      setRawMaterialTypeFormData({ type_key: '', type_name: '', raw_material_tag_id: '', allowed_unit_ids: [], status: 'active' });
      setShowRawMaterialTypeForm(false);
      setSuccess('Raw material type updated successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update raw material type');
    }
  };

  const handleEditRawMaterialType = (type: RawMaterialType) => {
    setEditingRawMaterialType(type);
    setRawMaterialTypeFormData({
      type_key: type.type_key,
      type_name: type.type_name,
      raw_material_tag_id: type.raw_material_tag_id,
      allowed_unit_ids: type.allowed_unit_ids || [],
      status: type.status,
    });
    setShowRawMaterialTypeForm(true);
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
      setRawMaterialUnitFormData({ unit_key: '', display_name: '', description: '', allows_decimal: false, archive_threshold: 5, status: 'active' });
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
      setRawMaterialUnitFormData({ unit_key: '', display_name: '', description: '', allows_decimal: false, archive_threshold: 5, status: 'active' });
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
      archive_threshold: unit.archive_threshold ?? 5,
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
      setRecurringProductUnitFormData({ unit_key: '', display_name: '', description: '', allows_decimal: false, archive_threshold: 5, status: 'active' });
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
      setRecurringProductUnitFormData({ unit_key: '', display_name: '', description: '', allows_decimal: false, archive_threshold: 5, status: 'active' });
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
      archive_threshold: unit.archive_threshold ?? 5,
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

  // Customer Types Handlers
  const handleCreateCustomerType = async () => {
    if (!profile?.id) {
      setError('User authentication required');
      return;
    }

    if (!customerTypeFormData.type_key || !customerTypeFormData.display_name) {
      setError('Type key and display name are required');
      return;
    }

    if (!validateTypeKey(customerTypeFormData.type_key)) {
      setError('Type key must be lowercase, alphanumeric with underscores only (e.g., hotel, restaurant)');
      return;
    }

    try {
      setError(null);
      setSuccess(null);
      const created = await createCustomerType(customerTypeFormData, profile.id);
      setCustomerTypes((prev) => [...prev, created].sort((a, b) => a.display_name.localeCompare(b.display_name)));
      setCustomerTypeFormData({ type_key: '', display_name: '', description: '', status: 'active' });
      setShowCustomerTypeForm(false);
      setSuccess('Customer type created successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create customer type');
    }
  };

  const handleUpdateCustomerType = async () => {
    if (!profile?.id || !editingCustomerType) {
      setError('User authentication or customer type selection required');
      return;
    }

    try {
      setError(null);
      setSuccess(null);
      const updated = await updateCustomerType(editingCustomerType.id, customerTypeFormData, profile.id);
      setCustomerTypes((prev) =>
        prev.map((type) => (type.id === updated.id ? updated : type)).sort((a, b) => a.display_name.localeCompare(b.display_name))
      );
      setEditingCustomerType(null);
      setCustomerTypeFormData({ type_key: '', display_name: '', description: '', status: 'active' });
      setShowCustomerTypeForm(false);
      setSuccess('Customer type updated successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update customer type');
    }
  };

  const handleEditCustomerType = (type: CustomerType) => {
    setEditingCustomerType(type);
    setCustomerTypeFormData({
      type_key: type.type_key,
      display_name: type.display_name,
      description: type.description || '',
      status: type.status,
    });
    setShowCustomerTypeForm(true);
  };

  const handleDeleteCustomerType = async (type: CustomerType) => {
    if (!window.confirm(`Are you sure you want to delete "${type.display_name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setError(null);
      const usageCount = await checkCustomerTypeUsage(type.id);
      if (usageCount > 0) {
        setError(`Cannot delete customer type. It is used by ${usageCount} customer(s).`);
        return;
      }
      await deleteCustomerType(type.id);
      setCustomerTypes((prev) => prev.filter((t) => t.id !== type.id));
      setSuccess('Customer type deleted successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete customer type');
    }
  };

  // Auto-generate type_key from display_name
  const handleCustomerTypeDisplayNameChange = (displayName: string) => {
    const formatted = formatTypeKey(displayName);
    setCustomerTypeFormData((prev) => ({ ...prev, display_name: displayName, type_key: formatted }));
  };

  // Transactional Email Handlers
  const handleSaveDl = async () => {
    if (!dlFormData.name.trim()) {
      setError('Name is required');
      return;
    }
    try {
      setError(null);
      setSuccess(null);
      if (editingDl) {
        const updated = await updateDistributionList(editingDl.id, dlFormData);
        setDistributionLists((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
        setEditingDl(null);
        setSuccess('Distribution list updated');
      } else {
        const created = await createDistributionList(dlFormData);
        setDistributionLists((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
        setSuccess('Distribution list created');
      }
      setShowDlForm(false);
      setDlFormData({ name: '', description: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save distribution list');
    }
  };

  const handleDeleteDl = async (dl: EmailDistributionList) => {
    if (!window.confirm(`Delete distribution list "${dl.name}"? This cannot be undone.`)) return;
    try {
      setError(null);
      await deleteDistributionList(dl.id);
      setDistributionLists((prev) => prev.filter((d) => d.id !== dl.id));
      setSuccess('Distribution list deleted');
      if (managingMembersDlId === dl.id) setManagingMembersDlId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete distribution list');
    }
  };

  const openManageMembers = async (dlId: string) => {
    setManagingMembersDlId(dlId);
    try {
      const members = await fetchDistributionListMembers(dlId);
      setDlMembers(members);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load members');
    }
  };

  const handleAddMember = async (dlId: string, userId: string) => {
    try {
      setError(null);
      await addDistributionListMember(dlId, userId);
      const members = await fetchDistributionListMembers(dlId);
      setDlMembers(members);
      if (managingMembersDlId === dlId) setManagingMembersDlId(dlId);
      setSuccess('Member added');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add member');
    }
  };

  const handleRemoveMember = async (dlId: string, userId: string) => {
    try {
      setError(null);
      await removeDistributionListMember(dlId, userId);
      const members = await fetchDistributionListMembers(dlId);
      setDlMembers(members);
      setSuccess('Member removed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove member');
    }
  };

  const handleSaveTriggerConfig = async (triggerKey: string) => {
    const form = triggerFormByKey[triggerKey];
    if (!form?.template_id || !form?.distribution_list_id) {
      setError('Select a template and a distribution list');
      return;
    }
    try {
      setError(null);
      setSuccess(null);
      await upsertTriggerConfig(triggerKey, form);
      const configs = await fetchTriggerConfig();
      setTriggerConfigs(configs);
      setSuccess('Trigger configuration saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save trigger config');
    }
  };

  const handleSaveTemplate = async () => {
    if (!editingTemplate) return;
    try {
      setError(null);
      setSuccess(null);
      await updateEmailTemplate(editingTemplate.id, templateFormData);
      const templates = await fetchEmailTemplates();
      setEmailTemplates(templates);
      setEditingTemplate(null);
      setTemplateFormData({});
      setSuccess('Template updated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update template');
    }
  };

  const handleSendTestEmail = async (triggerKey: string, templateId?: string, distributionListId?: string) => {
    setTestEmailLoading(true);
    setError(null);
    setSuccess(null);
    const eventTypeLabels: Record<string, string> = {
      order_created: 'Order Created',
      order_payment_received: 'ORDER PAYMENT RECEIVED',
      order_completed: 'ORDER COMPLETED',
      order_locked: 'Order Locked',
      order_hold: 'Order Put on Hold',
      raw_material_lot_created: 'Raw Material Lot Created',
      raw_material_transform: 'Raw Material Transformed',
      recurring_product_lot_created: 'Recurring Product Lot Created',
      production_batch_completed: 'Production Batch Completed',
    };
    try {
      const { data, error: fnError } = await sendTestTransactionEmail(
        triggerKey,
        {
          order_event_type: eventTypeLabels[triggerKey] ?? triggerKey,
          event_type: eventTypeLabels[triggerKey] ?? triggerKey,
          order_id: 'test-order-id',
          order_number: 'ORD-TEST-001',
          order_date: new Date().toISOString().slice(0, 10),
          order_date_formatted: new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
          customer_name: 'Test Customer',
          total_amount: 99,
          total_amount_formatted: '₹99.00',
          discount_amount_formatted: '₹0.00',
          net_amount_formatted: '₹99.00',
          total_paid_formatted: '₹0.00',
          sold_by_name: 'Test User',
          status: 'READY_FOR_PAYMENT',
          payment_status: '',
          items_table: '<tr><td colspan="4" style="padding:20px;text-align:center;color:#94a3b8;">No items</td></tr>',
          event_message: 'Test notification',
          completed_at_formatted: '',
          locked_at_formatted: '',
          locked_by_name: '',
          hold_reason: '',
          held_at_formatted: '',
          held_by_name: '',
          unlock_reason: '',
          notes: '',
          batch_id: 'BATCH-TEST-001',
          batch_date_formatted: new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
          batch_status: 'Locked',
          qa_status: 'approved',
          responsible_user_name: 'Test User',
          production_start_date_formatted: new Date().toLocaleDateString('en-IN', { dateStyle: 'medium' }),
          production_end_date_formatted: new Date().toLocaleDateString('en-IN', { dateStyle: 'medium' }),
          additional_information: '',
          qa_reason: '',
          custom_fields_display: '',
          raw_materials_table: '<tr><td style="padding:8px 12px;">Test Material</td><td style="padding:8px 12px;">LOT-001</td><td style="padding:8px 12px;text-align:right;">10 kg</td></tr>',
          recurring_products_table: '<tr><td style="padding:8px 12px;">Test Packaging</td><td style="padding:8px 12px;text-align:right;">5 pcs</td></tr>',
          outputs_table: '<tr><td style="padding:8px 12px;">Test Output</td><td style="padding:8px 12px;">Tag A</td><td style="padding:8px 12px;">500 g</td><td style="padding:8px 12px;text-align:right;">100 units</td></tr>',
          processed_goods_table: '<tr><td style="padding:8px 12px;">Test Product</td><td style="padding:8px 12px;">Tag A</td><td style="padding:8px 12px;">BATCH-TEST-001</td><td style="padding:8px 12px;">500 g</td><td style="padding:8px 12px;text-align:right;">100 units</td><td style="padding:8px 12px;">1 Mar 2026</td></tr>',
          outputs_count: 1,
          processed_goods_count: 1,
          view_lot_url: typeof window !== 'undefined' ? `${window.location.origin}/operations/raw-materials?lotId=LOT-TEST-001` : 'https://example.com/operations/raw-materials',
          view_batch_url: typeof window !== 'undefined' ? `${window.location.origin}/operations/production?batchId=BATCH-TEST-001` : 'https://example.com/operations/production',
          source_lot_id: 'LOT-BAN-001',
          source_lot_name: 'Banana – Test',
          new_lot_id: 'FIN-BAN-PEEL-001',
          new_lot_name: 'Banana Peel – 05Mar2026',
          quantity_processed: 100,
          output_quantity: 25,
          source_unit: 'kg',
          output_unit: 'kg',
          transform_date_formatted: new Date().toLocaleDateString('en-IN', { dateStyle: 'medium' }),
          transformed_by_name: 'Test User',
          steps_display: 'Peel → Dry',
          view_source_url: typeof window !== 'undefined' ? `${window.location.origin}/operations/raw-materials?lotId=LOT-BAN-001` : 'https://example.com/operations/raw-materials',
          view_new_lot_url: typeof window !== 'undefined' ? `${window.location.origin}/operations/raw-materials?lotId=FIN-BAN-PEEL-001` : 'https://example.com/operations/raw-materials',
        },
        templateId && distributionListId ? { templateId, distributionListId } : undefined
      );
      if (fnError) {
        setError(fnError.message);
        return;
      }
      if (data?.sent && data?.recipientCount != null) {
        setSuccess(`Test email sent to ${data.recipientCount} recipient(s). Check inbox (and spam).`);
      } else {
        setError(data?.reason ?? data?.error ?? 'Email was not sent. Check trigger is configured and enabled, and DL has members.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test failed');
    } finally {
      setTestEmailLoading(false);
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
    { id: 'raw-materials' as TagSection, label: 'Raw Material Tags', icon: Package, color: 'text-green-600', bgColor: 'bg-green-100' },
    {
      id: 'raw-material-types' as TagSection,
      label: 'Raw Material Types',
      icon: Layers,
      color: 'text-teal-600',
      bgColor: 'bg-teal-100',
    },
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

  const mainNavItems: { id: MainSection; label: string; icon: typeof Shield; short?: string }[] = [
    { id: 'tags', label: 'Tags', icon: LayoutGrid, short: 'Tags' },
    { id: 'units', label: 'Units', icon: Ruler, short: 'Units' },
    { id: 'customer-types', label: 'Customer Types', icon: User, short: 'Customer Types' },
    { id: 'transactional-email', label: 'Transactional Email', icon: Mail, short: 'Email' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex flex-col md:flex-row max-w-7xl mx-auto">
        {/* Sidebar */}
        <aside className="w-full md:w-64 shrink-0 border-b md:border-b-0 md:border-r border-gray-200 bg-white md:min-h-screen sticky top-0 flex flex-col z-10 shadow-sm md:shadow-none">
          <div className="p-4 border-b border-gray-100 shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 shadow-md shadow-indigo-200 text-white flex items-center justify-center">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base font-bold text-gray-900 leading-tight">Admin</h1>
                <p className="text-xs text-gray-500 font-medium hidden md:block mt-0.5">Configuration</p>
              </div>
            </div>

            <button
              onClick={() => {
                if (mainSection === 'tags') loadAllTags();
                else if (mainSection === 'units') loadAllUnits();
                else if (mainSection === 'customer-types') loadCustomerTypes();
                else if (mainSection === 'transactional-email') loadTransactionalEmailData();
              }}
              disabled={loading}
              className="md:hidden flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
          <nav className="p-2 md:p-3 space-x-2 md:space-x-0 md:space-y-1 flex md:flex-col overflow-x-auto md:overflow-y-auto no-scrollbar scroll-smooth">
            {mainNavItems.map(({ id, label, icon: Icon, short }) => {
              const isActive = mainSection === id;
              return (
                <button
                  key={id}
                  onClick={() => {
                    setMainSection(id);
                    setError(null);
                    setSuccess(null);
                  }}
                  className={`flex-shrink-0 md:w-full flex items-center gap-2 md:gap-3 px-3.5 py-2.5 rounded-xl text-left transition-all duration-200 whitespace-nowrap ${isActive
                    ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-sm ring-1 ring-indigo-100/50'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 font-medium'
                    }`}
                >
                  <Icon className={`w-4 h-4 md:w-5 md:h-5 shrink-0 ${isActive ? 'opacity-100 text-indigo-600' : 'opacity-70'}`} />
                  <span className="text-sm hidden md:inline">{label}</span>
                  <span className="text-sm md:hidden">{short || label}</span>
                  {isActive && <ChevronRight className="w-4 h-4 ml-auto text-indigo-500 hidden md:block" />}
                </button>
              );
            })}
          </nav>
          <div className="p-4 border-t border-gray-100 mt-auto shrink-0 hidden md:block">
            <button
              onClick={() => {
                if (mainSection === 'tags') loadAllTags();
                else if (mainSection === 'units') loadAllUnits();
                else if (mainSection === 'customer-types') loadCustomerTypes();
                else if (mainSection === 'transactional-email') loadTransactionalEmailData();
              }}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-gray-700 bg-white border border-gray-200 shadow-sm rounded-xl hover:bg-gray-50 hover:text-gray-900 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
              Refresh Data
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-6 pb-20 md:pb-12 bg-gray-50">
          {/* Error/Success Messages */}
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-red-700">{error}</p>
              </div>
              <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800 shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          {success && (
            <div className="mb-4 bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-green-700">{success}</p>
              </div>
              <button onClick={() => setSuccess(null)} className="text-green-600 hover:text-green-800 shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Module Access Management Quick Link */}
          <div className="mb-6">
            <button
              onClick={() => navigate('/admin/module-access')}
              className="w-full bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 border-2 border-blue-200 hover:border-blue-300 rounded-2xl p-6 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <Shield className="w-7 h-7" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-lg font-bold text-gray-900 mb-1">Module Access Management</h3>
                    <p className="text-sm text-gray-600">
                      Control user permissions and module visibility across the platform
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-6 h-6 text-blue-600 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          </div>

          {/* Section title + sub-nav */}
          {mainSection === 'tags' && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Tags</h2>
              <div className="flex overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:pb-0 sm:flex-wrap sm:overflow-visible gap-2 no-scrollbar">
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
                        setShowRawMaterialTypeForm(false);
                        setEditingRawMaterialTag(null);
                        setEditingRecurringProductTag(null);
                        setEditingProducedGoodsTag(null);
                        setEditingRawMaterialType(null);
                        setError(null);
                        setSuccess(null);
                      }}
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap flex-shrink-0 transition-all ${isActive
                        ? `${section.bgColor} ${section.color} shadow-sm ring-1 ring-black/5`
                        : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                    >
                      <Icon className="w-4 h-4" />
                      {section.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {mainSection === 'units' && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Units</h2>
              <div className="flex overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:pb-0 sm:flex-wrap sm:overflow-visible gap-2 no-scrollbar">
                {[
                  { id: 'raw-materials-units' as UnitSection, label: 'Raw Material Units', icon: Package, activeClass: 'bg-green-100 text-green-700', borderClass: 'border-green-200' },
                  { id: 'recurring-products-units' as UnitSection, label: 'Recurring Product Units', icon: Box, activeClass: 'bg-purple-100 text-purple-700', borderClass: 'border-purple-200' },
                  { id: 'produced-goods-units' as UnitSection, label: 'Produced Goods Units', icon: Factory, activeClass: 'bg-blue-100 text-blue-700', borderClass: 'border-blue-200' },
                ].map(({ id, label, icon: Icon, activeClass }) => {
                  const isActive = activeUnitSection === id;
                  return (
                    <button
                      key={id}
                      onClick={() => {
                        setActiveUnitSection(id);
                        setShowRawMaterialUnitForm(false);
                        setShowRecurringProductUnitForm(false);
                        setShowProducedGoodsUnitForm(false);
                        setEditingRawMaterialUnit(null);
                        setEditingRecurringProductUnit(null);
                        setEditingProducedGoodsUnit(null);
                        setError(null);
                        setSuccess(null);
                      }}
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap flex-shrink-0 transition-all ${isActive ? `${activeClass} shadow-sm ring-1 ring-black/5` : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {mainSection === 'customer-types' && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Customer Types</h2>
              <p className="text-sm text-gray-500 mt-1">Define customer types for the sales module.</p>
            </div>
          )}

          {mainSection === 'transactional-email' && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Transactional Email</h2>
              <p className="text-sm text-gray-500 mb-3">Distribution lists, triggers, templates, and report emails.</p>
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Configuration</p>
                  <div className="flex overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:pb-0 sm:flex-wrap sm:overflow-visible gap-2 no-scrollbar">
                    {[
                      { id: 'distribution-lists' as const, label: 'Distribution Lists', Icon: Users },
                      { id: 'triggers' as const, label: 'Triggers', Icon: Package },
                      { id: 'templates' as const, label: 'Templates', Icon: Mail },
                    ].map(({ id, label, Icon }) => (
                      <button
                        key={id}
                        onClick={() => setTransactionalEmailSection(id)}
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap flex-shrink-0 transition-all ${transactionalEmailSection === id
                          ? 'bg-indigo-100 text-indigo-700 shadow-sm ring-1 ring-indigo-200'
                          : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                          }`}
                      >
                        <Icon className="w-4 h-4" />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Activity</p>
                  <div className="flex overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:pb-0 sm:flex-wrap sm:overflow-visible gap-2 no-scrollbar">
                    <button
                      onClick={() => setTransactionalEmailSection('email-log')}
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap flex-shrink-0 transition-all ${transactionalEmailSection === 'email-log'
                        ? 'bg-amber-100 text-amber-800 shadow-sm ring-1 ring-amber-200'
                        : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                    >
                      <History className="w-4 h-4" />
                      Email Log
                    </button>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Reports</p>
                  <div className="flex overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:pb-0 sm:flex-wrap sm:overflow-visible gap-2 no-scrollbar">
                    {[
                      { id: 'finance-report' as const, label: 'Finance Report', Icon: FileText },
                      { id: 'sales-report' as const, label: 'Sales Report', Icon: BarChart3 },
                      { id: 'inventory-report' as const, label: 'Inventory Report', Icon: Package },
                    ].map(({ id, label, Icon }) => (
                      <button
                        key={id}
                        onClick={() => setTransactionalEmailSection(id)}
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap flex-shrink-0 transition-all ${transactionalEmailSection === id
                          ? 'bg-emerald-100 text-emerald-800 shadow-sm ring-1 ring-emerald-200'
                          : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                          }`}
                      >
                        <Icon className="w-4 h-4" />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Active Section Content */}
          {(loading && mainSection === 'tags' && (activeTagSection === 'raw-materials' || activeTagSection === 'raw-material-types')) && (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-8 text-center">
              <RefreshCw className="w-6 h-6 animate-spin text-gray-400 mx-auto" />
            </div>
          )}

          {loading && mainSection === 'units' && activeUnitSection === 'raw-materials-units' && (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-8 text-center">
              <RefreshCw className="w-6 h-6 animate-spin text-gray-400 mx-auto" />
            </div>
          )}

          {/* Raw Material Tags Section */}
          {mainSection === 'tags' && activeTagSection === 'raw-materials' && !loading && (
            <div className="space-y-4">
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 md:p-6">
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
                        setRawMaterialFormData({ tag_key: '', display_name: '', description: '', lot_prefix: '', allowed_unit_ids: [], allowed_conditions: [], lifecycle_type: '', status: 'active' });
                        setNewConditionInput('');
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
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Lot ID Prefix
                        </label>
                        <input
                          type="text"
                          value={rawMaterialFormData.lot_prefix || ''}
                          onChange={(e) => {
                            const raw = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
                            setRawMaterialFormData((prev) => ({ ...prev, lot_prefix: raw }));
                          }}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 font-mono text-sm"
                          placeholder="e.g., RAW-BAN, FIN-BAN-PEEL"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Uppercase letters, numbers, and hyphen only. Used as prefix for new lot IDs (e.g., RAW-BAN-001).
                        </p>
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
                        <label className="block text-sm font-medium text-gray-700 mb-1">Allowed Units</label>
                        <div className="border border-gray-300 rounded-lg p-3 max-h-40 overflow-y-auto space-y-2">
                          {rawMaterialUnits.length === 0 ? (
                            <p className="text-sm text-gray-500">
                              No raw material units. Add units under Admin → Units → Raw Material Units.
                            </p>
                          ) : (
                            rawMaterialUnits.map((unit) => {
                              const checked = rawMaterialFormData.allowed_unit_ids?.includes(unit.id) ?? false;
                              return (
                                <label key={unit.id} className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => {
                                      setRawMaterialFormData((prev) => {
                                        const current = prev.allowed_unit_ids || [];
                                        return {
                                          ...prev,
                                          allowed_unit_ids: checked
                                            ? current.filter((id) => id !== unit.id)
                                            : [...current, unit.id],
                                        };
                                      });
                                    }}
                                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                                  />
                                  <span className="text-sm">{unit.display_name}</span>
                                </label>
                              );
                            })
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Only these units will be available when creating lots with this tag.
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Allowed Conditions</label>
                        <div className="border border-gray-300 rounded-lg p-3 space-y-2">
                          <div className="flex flex-wrap gap-1.5">
                            {(rawMaterialFormData.allowed_conditions || []).map((c) => (
                              <span
                                key={c}
                                className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-sm"
                              >
                                {c}
                                <button
                                  type="button"
                                  onClick={() =>
                                    setRawMaterialFormData((prev) => ({
                                      ...prev,
                                      allowed_conditions: (prev.allowed_conditions || []).filter((x) => x !== c),
                                    }))
                                  }
                                  className="text-gray-500 hover:text-red-600"
                                  aria-label={`Remove ${c}`}
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </span>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={newConditionInput}
                              onChange={(e) => setNewConditionInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  const v = newConditionInput.trim();
                                  if (v && !(rawMaterialFormData.allowed_conditions || []).includes(v)) {
                                    setRawMaterialFormData((prev) => ({
                                      ...prev,
                                      allowed_conditions: [...(prev.allowed_conditions || []), v],
                                    }));
                                    setNewConditionInput('');
                                  }
                                }
                              }}
                              placeholder="Add condition (e.g. Raw, Ripe)"
                              className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-green-500"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const v = newConditionInput.trim();
                                if (v && !(rawMaterialFormData.allowed_conditions || []).includes(v)) {
                                  setRawMaterialFormData((prev) => ({
                                    ...prev,
                                    allowed_conditions: [...(prev.allowed_conditions || []), v],
                                  }));
                                  setNewConditionInput('');
                                }
                              }}
                              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 flex items-center gap-1"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Add
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Conditions shown in the lot form for this tag. Add &quot;Other&quot; to allow custom values.
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Lifecycle Behavior</label>
                        <select
                          value={rawMaterialFormData.lifecycle_type || ''}
                          onChange={(e) =>
                            setRawMaterialFormData((prev) => ({
                              ...prev,
                              lifecycle_type: e.target.value || '',
                            }))
                          }
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                        >
                          <option value="">Standard (no special lifecycle)</option>
                          <option value="multi_stage">Multi-stage (admin managed)</option>
                          <option value="banana_multi_stage">Banana multi-stage (legacy)</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                          Use Multi-stage to configure stages and transitions in the Lifecycle editor.
                        </p>
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
                          setRawMaterialFormData({ tag_key: '', display_name: '', description: '', lot_prefix: '', allowed_unit_ids: [], allowed_conditions: [], lifecycle_type: '', status: 'active' });
                          setNewConditionInput('');
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
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lot Prefix</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Allowed Units</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lifecycle</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {rawMaterialTags.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                            No tags found. Create your first tag to get started.
                          </td>
                        </tr>
                      ) : (
                        rawMaterialTags.map((tag) => {
                          const unitNames =
                            (tag.allowed_unit_ids || [])
                              .map((id) => rawMaterialUnits.find((u) => u.id === id)?.display_name)
                              .filter(Boolean)
                              .join(', ') || '—';
                          const lifecycleLabel =
                            tag.lifecycle_type === 'multi_stage'
                              ? 'Multi-stage'
                              : tag.lifecycle_type === 'banana_multi_stage'
                                ? 'Banana multi-stage (legacy)'
                                : 'Standard';

                          return (
                            <tr key={tag.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm font-mono text-gray-900">{tag.tag_key}</td>
                              <td className="px-4 py-3 text-sm font-medium text-gray-900">{tag.display_name}</td>
                              <td className="px-4 py-3 text-sm font-mono text-gray-700">
                                {tag.lot_prefix || '—'}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-700">{unitNames}</td>
                              <td className="px-4 py-3 text-sm text-gray-700">{lifecycleLabel}</td>
                              <td className="px-4 py-3">
                                <span
                                  className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${tag.status === 'active'
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
                                  {(tag.lifecycle_type === 'multi_stage' || tag.lifecycle_type === 'banana_multi_stage') && (
                                    <>
                                      <button
                                        onClick={() => openLifecycleEditor(tag)}
                                        className="text-emerald-600 hover:text-emerald-700 transition-colors"
                                        title="Manage lifecycle"
                                      >
                                        <Layers className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => openTransformRulesEditor(tag)}
                                        className="text-amber-600 hover:text-amber-700 transition-colors"
                                        title="Transformation targets"
                                      >
                                        <ArrowRightLeft className="w-4 h-4" />
                                      </button>
                                    </>
                                  )}
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
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Raw Material Types Section — define types and allowed units per type */}
          {mainSection === 'tags' && activeTagSection === 'raw-material-types' && !loading && (
            <div className="space-y-4">
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 md:p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">Raw Material Types</h2>
                    <p className="text-sm text-gray-600 mt-1">Define types (e.g. Banana) and which units appear in the form for that type. Users see only these units when creating a lot of this type.</p>
                  </div>
                  {!showRawMaterialTypeForm && (
                    <button
                      onClick={() => {
                        setShowRawMaterialTypeForm(true);
                        setEditingRawMaterialType(null);
                        setRawMaterialTypeFormData({ type_key: '', type_name: '', raw_material_tag_id: '', allowed_unit_ids: [], status: 'active' });
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Create Type
                    </button>
                  )}
                </div>

                {showRawMaterialTypeForm && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4 space-y-4">
                    <h3 className="font-semibold text-gray-900">
                      {editingRawMaterialType ? 'Edit Raw Material Type' : 'Create Raw Material Type'}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Type Name *</label>
                        <input
                          type="text"
                          value={rawMaterialTypeFormData.type_name}
                          onChange={(e) => {
                            const name = e.target.value;
                            setRawMaterialTypeFormData((prev) => ({
                              ...prev,
                              type_name: name,
                              type_key: editingRawMaterialType ? prev.type_key : (prev.type_key || formatTagKey(name)),
                            }));
                          }}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-teal-500"
                          placeholder="e.g., Banana"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Type Key (System Identifier) *</label>
                        <input
                          type="text"
                          value={rawMaterialTypeFormData.type_key}
                          onChange={(e) =>
                            setRawMaterialTypeFormData((prev) => ({ ...prev, type_key: e.target.value.toLowerCase().trim().replace(/\s+/g, '_') }))
                          }
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-teal-500 font-mono text-sm"
                          placeholder="e.g., banana"
                          disabled={!!editingRawMaterialType}
                        />
                        <p className="text-xs text-gray-500 mt-1">Lowercase, alphanumeric with underscores</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Linked Tag *</label>
                        <select
                          value={rawMaterialTypeFormData.raw_material_tag_id}
                          onChange={(e) => setRawMaterialTypeFormData((prev) => ({ ...prev, raw_material_tag_id: e.target.value }))}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-teal-500"
                        >
                          <option value="">Select tag</option>
                          {rawMaterialTags.map((tag) => (
                            <option key={tag.id} value={tag.id}>
                              {tag.display_name} {tag.lot_prefix ? `(${tag.lot_prefix})` : ''}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">Tag used for lots of this type (e.g. Banana)</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Allowed Units</label>
                        <div className="border border-gray-300 rounded-lg p-3 max-h-40 overflow-y-auto space-y-2">
                          {rawMaterialUnits.length === 0 ? (
                            <p className="text-sm text-gray-500">No raw material units. Add units under Admin → Units → Raw Material Units.</p>
                          ) : (
                            rawMaterialUnits.map((unit) => {
                              const checked = rawMaterialTypeFormData.allowed_unit_ids.includes(unit.id);
                              return (
                                <label key={unit.id} className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => {
                                      setRawMaterialTypeFormData((prev) => ({
                                        ...prev,
                                        allowed_unit_ids: checked
                                          ? prev.allowed_unit_ids.filter((id) => id !== unit.id)
                                          : [...prev.allowed_unit_ids, unit.id],
                                      }));
                                    }}
                                    className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                                  />
                                  <span className="text-sm">{unit.display_name}</span>
                                </label>
                              );
                            })
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Only these units will show in the lot form when this type is selected.</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                        <select
                          value={rawMaterialTypeFormData.status}
                          onChange={(e) =>
                            setRawMaterialTypeFormData((prev) => ({ ...prev, status: e.target.value as 'active' | 'inactive' }))
                          }
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-teal-500"
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => (editingRawMaterialType ? handleUpdateRawMaterialType() : handleCreateRawMaterialType())}
                        className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
                      >
                        <Save className="w-4 h-4 inline mr-1" />
                        {editingRawMaterialType ? 'Update' : 'Create'}
                      </button>
                      <button
                        onClick={() => {
                          setShowRawMaterialTypeForm(false);
                          setEditingRawMaterialType(null);
                          setRawMaterialTypeFormData({ type_key: '', type_name: '', raw_material_tag_id: '', allowed_unit_ids: [], status: 'active' });
                        }}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type Name</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type Key</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Linked Tag</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Allowed Units</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {rawMaterialTypes.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                            No raw material types yet. Create one to control which units appear per type (e.g. Banana → Kg, Ltr).
                          </td>
                        </tr>
                      ) : (
                        rawMaterialTypes.map((t) => {
                          const linkedTag = rawMaterialTags.find((tag) => tag.id === t.raw_material_tag_id);
                          const unitNames = (t.allowed_unit_ids || [])
                            .map((id) => rawMaterialUnits.find((u) => u.id === id)?.display_name)
                            .filter(Boolean)
                            .join(', ');
                          return (
                            <tr key={t.id}>
                              <td className="px-4 py-3 text-sm text-gray-900">{t.type_name}</td>
                              <td className="px-4 py-3 text-sm font-mono text-gray-600">{t.type_key}</td>
                              <td className="px-4 py-3 text-sm text-gray-600">{linkedTag?.display_name ?? '—'}</td>
                              <td className="px-4 py-3 text-sm text-gray-600">{unitNames || '—'}</td>
                              <td className="px-4 py-3">
                                <span
                                  className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${t.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                                    }`}
                                >
                                  {t.status}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => handleEditRawMaterialType(t)}
                                  className="text-teal-600 hover:text-teal-700 transition-colors"
                                  title="Edit"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })
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
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 md:p-6">
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
                                className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${tag.status === 'active'
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
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 md:p-6">
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
                                className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${tag.status === 'active'
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
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 md:p-6">
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
                        setRawMaterialUnitFormData({ unit_key: '', display_name: '', description: '', allows_decimal: false, archive_threshold: 5, status: 'active' });
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
                          onChange={(e) => {
                            const allowsDecimal = e.target.value === 'true';
                            setRawMaterialUnitFormData((prev) => ({
                              ...prev,
                              allows_decimal: allowsDecimal,
                              ...(allowsDecimal ? {} : { archive_threshold: Math.round(prev.archive_threshold ?? 5) }),
                            }));
                          }}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                        >
                          <option value="false">No (Whole numbers only, e.g., pieces, boxes)</option>
                          <option value="true">Yes (Decimal values allowed, e.g., kg, ltr)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Archive threshold</label>
                        <input
                          type="number"
                          min={0}
                          step={rawMaterialUnitFormData.allows_decimal ? 'any' : '1'}
                          value={rawMaterialUnitFormData.allows_decimal
                            ? (rawMaterialUnitFormData.archive_threshold ?? 5)
                            : Math.round(rawMaterialUnitFormData.archive_threshold ?? 5)}
                          onChange={(e) => {
                            const raw = parseFloat(e.target.value) || 0;
                            const val = Math.max(0, raw);
                            setRawMaterialUnitFormData((prev) => ({
                              ...prev,
                              archive_threshold: prev.allows_decimal ? val : Math.round(val),
                            }));
                          }}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500"
                          placeholder={rawMaterialUnitFormData.allows_decimal ? 'e.g. 0.2 for kg, 5 for pieces' : 'e.g. 5 (whole numbers only)'}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          {rawMaterialUnitFormData.allows_decimal
                            ? 'Lots can be archived when quantity ≤ this value (in this unit)'
                            : 'Whole numbers only (unit does not allow decimals)'}
                        </p>
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
                          setRawMaterialUnitFormData({ unit_key: '', display_name: '', description: '', allows_decimal: false, archive_threshold: 5, status: 'active' });
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
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Archive threshold</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {rawMaterialUnits.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
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
                                className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${unit.allows_decimal
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-orange-100 text-orange-800'
                                  }`}
                              >
                                {unit.allows_decimal ? 'Yes' : 'No'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{unit.archive_threshold ?? 5}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{unit.description || '—'}</td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${unit.status === 'active'
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
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 md:p-6">
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
                        setRecurringProductUnitFormData({ unit_key: '', display_name: '', description: '', allows_decimal: false, archive_threshold: 5, status: 'active' });
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
                          onChange={(e) => {
                            const allowsDecimal = e.target.value === 'true';
                            setRecurringProductUnitFormData((prev) => ({
                              ...prev,
                              allows_decimal: allowsDecimal,
                              ...(allowsDecimal ? {} : { archive_threshold: Math.round(prev.archive_threshold ?? 5) }),
                            }));
                          }}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500"
                        >
                          <option value="false">No (Whole numbers only, e.g., pieces, boxes)</option>
                          <option value="true">Yes (Decimal values allowed, e.g., kg, ltr)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Archive threshold</label>
                        <input
                          type="number"
                          min={0}
                          step={recurringProductUnitFormData.allows_decimal ? 'any' : '1'}
                          value={recurringProductUnitFormData.allows_decimal
                            ? (recurringProductUnitFormData.archive_threshold ?? 5)
                            : Math.round(recurringProductUnitFormData.archive_threshold ?? 5)}
                          onChange={(e) => {
                            const raw = parseFloat(e.target.value) || 0;
                            const val = Math.max(0, raw);
                            setRecurringProductUnitFormData((prev) => ({
                              ...prev,
                              archive_threshold: prev.allows_decimal ? val : Math.round(val),
                            }));
                          }}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500"
                          placeholder={recurringProductUnitFormData.allows_decimal ? 'e.g. 0.2 for kg, 5 for pieces' : 'e.g. 5 (whole numbers only)'}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          {recurringProductUnitFormData.allows_decimal
                            ? 'Lots can be archived when quantity ≤ this value (in this unit)'
                            : 'Whole numbers only (unit does not allow decimals)'}
                        </p>
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
                          setRecurringProductUnitFormData({ unit_key: '', display_name: '', description: '', allows_decimal: false, archive_threshold: 5, status: 'active' });
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
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Archive threshold</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {recurringProductUnits.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
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
                                className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${unit.allows_decimal
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-orange-100 text-orange-800'
                                  }`}
                              >
                                {unit.allows_decimal ? 'Yes' : 'No'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{unit.archive_threshold ?? 5}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{unit.description || '—'}</td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${unit.status === 'active'
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
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 md:p-6">
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
                                className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${unit.allows_decimal
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
                                className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${unit.status === 'active'
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

          {/* Customer Types Section */}
          {mainSection === 'customer-types' && !loading && (
            <div className="space-y-4">
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 md:p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">Customer Types</h2>
                    <p className="text-sm text-gray-600 mt-1">Define customer types for the sales module. Control which types are available for new customers.</p>
                  </div>
                  {!showCustomerTypeForm && (
                    <button
                      onClick={() => {
                        setShowCustomerTypeForm(true);
                        setEditingCustomerType(null);
                        setCustomerTypeFormData({ type_key: '', display_name: '', description: '', status: 'active' });
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Create Customer Type
                    </button>
                  )}
                </div>

                {showCustomerTypeForm && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4 space-y-4">
                    <h3 className="font-semibold text-gray-900">
                      {editingCustomerType ? 'Edit Customer Type' : 'Create New Customer Type'}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Display Name *</label>
                        <input
                          type="text"
                          value={customerTypeFormData.display_name}
                          onChange={(e) => handleCustomerTypeDisplayNameChange(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                          placeholder="e.g., Hotel, Restaurant, Retail"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Type Key (System Identifier) *</label>
                        <input
                          type="text"
                          value={customerTypeFormData.type_key}
                          onChange={(e) =>
                            setCustomerTypeFormData((prev) => ({ ...prev, type_key: e.target.value.toLowerCase().trim() }))
                          }
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                          placeholder="e.g., hotel, restaurant, retail"
                          disabled={!!editingCustomerType}
                        />
                        <p className="text-xs text-gray-500 mt-1">Lowercase, alphanumeric with underscores only</p>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                        <textarea
                          value={customerTypeFormData.description || ''}
                          onChange={(e) => setCustomerTypeFormData((prev) => ({ ...prev, description: e.target.value }))}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                          rows={2}
                          placeholder="Optional description"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                        <select
                          value={customerTypeFormData.status}
                          onChange={(e) =>
                            setCustomerTypeFormData((prev) => ({ ...prev, status: e.target.value as 'active' | 'inactive' }))
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
                          setShowCustomerTypeForm(false);
                          setEditingCustomerType(null);
                          setCustomerTypeFormData({ type_key: '', display_name: '', description: '', status: 'active' });
                        }}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => (editingCustomerType ? handleUpdateCustomerType() : handleCreateCustomerType())}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Save className="w-4 h-4" />
                        {editingCustomerType ? 'Update Customer Type' : 'Create Customer Type'}
                      </button>
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type Key</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Display Name</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {customerTypes.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                            No customer types found. Create your first customer type to get started.
                          </td>
                        </tr>
                      ) : (
                        customerTypes.map((type) => (
                          <tr key={type.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-mono text-gray-900">{type.type_key}</td>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{type.display_name}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{type.description || '—'}</td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${type.status === 'active'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-800'
                                  }`}
                              >
                                {type.status}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleEditCustomerType(type)}
                                  className="text-blue-600 hover:text-blue-700 transition-colors"
                                  title="Edit"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteCustomerType(type)}
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

          {/* Transactional Email Section */}
          {mainSection === 'transactional-email' && !loading && (
            <div className="space-y-4">
              <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
                <strong>SMTP:</strong> Configure in Supabase Dashboard → Project Settings → Edge Functions → Secrets: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM. Optional: SMTP_FROM_NAME (e.g. Hatvoni Insider), SMTP_SECURE (TLS).
              </div>

              {transactionalEmailSection === 'distribution-lists' && (
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 md:p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">Distribution Lists</h2>
                      <p className="text-sm text-gray-600 mt-1">Manage email distribution lists and their members (employees).</p>
                    </div>
                    {!showDlForm && (
                      <button
                        onClick={() => {
                          setShowDlForm(true);
                          setEditingDl(null);
                          setDlFormData({ name: '', description: '' });
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Create List
                      </button>
                    )}
                  </div>
                  {showDlForm && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4 space-y-4">
                      <h3 className="font-semibold text-gray-900">{editingDl ? 'Edit list' : 'New distribution list'}</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                          <input
                            type="text"
                            value={dlFormData.name}
                            onChange={(e) => setDlFormData((p) => ({ ...p, name: e.target.value }))}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                            placeholder="e.g., Sales team"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                          <input
                            type="text"
                            value={dlFormData.description ?? ''}
                            onChange={(e) => setDlFormData((p) => ({ ...p, description: e.target.value || undefined }))}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                            placeholder="Optional"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => {
                            setShowDlForm(false);
                            setEditingDl(null);
                            setDlFormData({ name: '', description: '' });
                          }}
                          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                        <button onClick={handleSaveDl} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                          <Save className="w-4 h-4" />
                          Save
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {distributionLists.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                              No distribution lists. Create one and add members to use for transactional emails.
                            </td>
                          </tr>
                        ) : (
                          distributionLists.map((dl) => (
                            <tr key={dl.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 font-medium text-gray-900">{dl.name}</td>
                              <td className="px-4 py-3 text-sm text-gray-700">{dl.description || '—'}</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => openManageMembers(dl.id)}
                                    className="text-blue-600 hover:text-blue-700"
                                    title="Manage members"
                                  >
                                    <Users className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingDl(dl);
                                      setDlFormData({ name: dl.name, description: dl.description ?? '' });
                                      setShowDlForm(true);
                                    }}
                                    className="text-blue-600 hover:text-blue-700"
                                    title="Edit"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => handleDeleteDl(dl)} className="text-red-600 hover:text-red-700" title="Delete">
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
                  {managingMembersDlId && (
                    <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-gray-900">Members</h3>
                        <button onClick={() => setManagingMembersDlId(null)} className="text-gray-600 hover:text-gray-800">
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">Add: select a user and click Add. Members must have an <strong>email</strong> set in Users to receive emails.</p>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {usersForPicker
                          .filter((u) => !dlMembers.some((m) => m.user_id === u.id))
                          .map((u) => (
                            <button
                              key={u.id}
                              onClick={() => handleAddMember(managingMembersDlId, u.id)}
                              className="px-3 py-1.5 text-sm bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200"
                            >
                              {u.full_name} ({u.email}) <Plus className="w-3 h-3 inline" />
                            </button>
                          ))}
                        {usersForPicker.filter((u) => !dlMembers.some((m) => m.user_id === u.id)).length === 0 && (
                          <span className="text-sm text-gray-500">All users are already members.</span>
                        )}
                      </div>
                      <ul className="divide-y divide-gray-200">
                        {dlMembers.map((m) => (
                          <li key={m.id} className="py-2 flex items-center justify-between">
                            <span className="text-sm">{m.user?.full_name ?? '—'} ({m.user?.email ?? '—'})</span>
                            <button
                              onClick={() => handleRemoveMember(managingMembersDlId, m.user_id)}
                              className="text-red-600 hover:text-red-700 text-sm"
                            >
                              Remove
                            </button>
                          </li>
                        ))}
                        {dlMembers.length === 0 && <li className="py-2 text-sm text-gray-500">No members yet.</li>}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {transactionalEmailSection === 'triggers' && (
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 md:p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">Triggers</h2>
                  <p className="text-sm text-gray-600 mb-4">Map each event to a template and distribution list. When the event occurs, the email is sent to the list. You can use the same template for all triggers (e.g. pick &quot;Order completed&quot; for Order created and Order payment received).</p>
                  <div className="space-y-4">
                    {TRANSACTIONAL_EMAIL_TRIGGER_KEYS.map(({ key, label }) => {
                      const form = triggerFormByKey[key] ?? { template_id: '', distribution_list_id: '', enabled: false };
                      return (
                        <div key={key} className="border border-gray-200 rounded-lg p-4 flex flex-wrap items-end gap-4">
                          <div className="font-medium text-gray-900">{label}</div>
                          <div className="flex-1 min-w-[200px]">
                            <label className="block text-xs text-gray-500 mb-1">Template</label>
                            <select
                              value={form.template_id}
                              onChange={(e) =>
                                setTriggerFormByKey((p) => ({
                                  ...p,
                                  [key]: { ...p[key], template_id: e.target.value, distribution_list_id: form.distribution_list_id, enabled: form.enabled },
                                }))
                              }
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            >
                              <option value="">Select template</option>
                              {usedEmailTemplates.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.name} ({t.trigger_key})
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="flex-1 min-w-[200px]">
                            <label className="block text-xs text-gray-500 mb-1">Distribution list</label>
                            <select
                              value={form.distribution_list_id}
                              onChange={(e) =>
                                setTriggerFormByKey((p) => ({
                                  ...p,
                                  [key]: { ...p[key], distribution_list_id: e.target.value, template_id: form.template_id, enabled: form.enabled },
                                }))
                              }
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            >
                              <option value="">Select list</option>
                              {distributionLists.map((d) => (
                                <option key={d.id} value={d.id}>
                                  {d.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={form.enabled}
                              onChange={(e) =>
                                setTriggerFormByKey((p) => ({
                                  ...p,
                                  [key]: { ...p[key], enabled: e.target.checked, template_id: form.template_id, distribution_list_id: form.distribution_list_id },
                                }))
                              }
                            />
                            <span className="text-sm">Enabled</span>
                          </label>
                          <button
                            onClick={() => handleSaveTriggerConfig(key)}
                            disabled={!form.template_id || !form.distribution_list_id}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => handleSendTestEmail(key, form.template_id, form.distribution_list_id)}
                            disabled={testEmailLoading || !form.template_id || !form.distribution_list_id}
                            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            title={!form.template_id || !form.distribution_list_id ? 'Select a template and distribution list to send a test' : ''}
                          >
                            {testEmailLoading ? 'Sending…' : 'Send test email'}
                          </button>
                        </div>
                      );
                    })}
                    <p className="text-sm text-gray-500 mt-4">Emails are sent to the selected distribution list when an order is created, payment received, completed, locked, or put on hold. Use the same template for all; subject uses the event type (e.g. Order Created, ORDER PAYMENT RECEIVED, ORDER COMPLETED).</p>
                  </div>
                </div>
              )}

              {transactionalEmailSection === 'templates' && (
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 md:p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">Templates</h2>
                  <p className="text-sm text-gray-600 mb-4">Placeholders: {'{{order_event_type}}'}, {'{{event_message}}'}, {'{{order_number}}'}, {'{{order_date_formatted}}'}, {'{{customer_name}}'}, {'{{items_table}}'}, {'{{net_amount_formatted}}'}, {'{{total_paid_formatted}}'}, {'{{order_details_url}}'}, etc. Empty fields show as blank.</p>
                  <div className="space-y-4">
                    {emailTemplates.map((t) => (
                      <div key={t.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-gray-900">{t.name}</span>
                          {editingTemplate?.id === t.id ? (
                            <div className="flex gap-2">
                              <button onClick={() => { setEditingTemplate(null); setTemplateFormData({}); }} className="text-gray-600 hover:text-gray-800">Cancel</button>
                              <button onClick={handleSaveTemplate} className="text-blue-600 hover:text-blue-700">Save</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingTemplate(t);
                                setTemplateFormData({ subject: t.subject, body_html: t.body_html, body_text: t.body_text ?? undefined });
                              }}
                              className="text-blue-600 hover:text-blue-700"
                            >
                              Edit
                            </button>
                          )}
                        </div>
                        {editingTemplate?.id === t.id ? (
                          <div className="space-y-3 text-sm">
                            <div>
                              <label className="block text-gray-600 mb-1">Subject</label>
                              <input
                                value={templateFormData.subject ?? ''}
                                onChange={(e) => setTemplateFormData((p) => ({ ...p, subject: e.target.value }))}
                                className="w-full border border-gray-300 rounded px-2 py-1"
                              />
                            </div>
                            <div>
                              <label className="block text-gray-600 mb-1">Body (HTML)</label>
                              <textarea
                                value={templateFormData.body_html ?? ''}
                                onChange={(e) => setTemplateFormData((p) => ({ ...p, body_html: e.target.value }))}
                                className="w-full border border-gray-300 rounded px-2 py-1 font-mono text-xs"
                                rows={6}
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-gray-700">
                            <p><strong>Subject:</strong> {t.subject}</p>
                            <p className="mt-1 truncate"><strong>Body:</strong> {t.body_html.slice(0, 100)}…</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {transactionalEmailSection === 'email-log' && (
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 md:p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">Email Log</h2>
                  <p className="text-sm text-gray-600 mb-4">Monitor all transactional emails sent. Filter by trigger, date range, and status.</p>

                  <div className="flex flex-wrap gap-3 mb-4">
                    <select
                      value={emailLogFilters.triggerKey}
                      onChange={(e) => setEmailLogFilters((p) => ({ ...p, triggerKey: e.target.value }))}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="">All triggers</option>
                      {TRANSACTIONAL_EMAIL_TRIGGER_KEYS.map(({ key, label }) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                      <option value="unknown">unknown</option>
                    </select>
                    <input
                      type="date"
                      value={emailLogFilters.fromDate}
                      onChange={(e) => setEmailLogFilters((p) => ({ ...p, fromDate: e.target.value }))}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      placeholder="From"
                    />
                    <input
                      type="date"
                      value={emailLogFilters.toDate}
                      onChange={(e) => setEmailLogFilters((p) => ({ ...p, toDate: e.target.value }))}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      placeholder="To"
                    />
                    <select
                      value={emailLogFilters.status}
                      onChange={(e) => setEmailLogFilters((p) => ({ ...p, status: e.target.value as '' | 'success' | 'error' }))}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="">All</option>
                      <option value="success">Success</option>
                      <option value="error">Error</option>
                    </select>
                    <button
                      onClick={() => void loadEmailLogs()}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                    >
                      <RefreshCw className={`w-4 h-4 ${emailLogsLoading ? 'animate-spin' : ''}`} />
                      Refresh
                    </button>
                  </div>

                  {emailLogsLoading ? (
                    <div className="py-12 text-center text-gray-500">Loading…</div>
                  ) : emailLogs.length === 0 ? (
                    <div className="py-12 text-center text-gray-500">No email logs found.</div>
                  ) : (
                    <>
                      <div className="overflow-x-auto border border-gray-200 rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Sent at</th>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Trigger</th>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Recipients</th>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Status</th>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Details</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 bg-white">
                            {emailLogs.map((log) => (
                              <Fragment key={log.id}>
                                <tr className="hover:bg-gray-50">
                                  <td className="px-4 py-2 text-sm text-gray-900 whitespace-nowrap">
                                    {new Date(log.sent_at).toLocaleString()}
                                  </td>
                                  <td className="px-4 py-2 text-sm text-gray-700">{log.trigger_key}</td>
                                  <td className="px-4 py-2 text-sm text-gray-700">{log.recipient_count}</td>
                                  <td className="px-4 py-2">
                                    {log.error_message ? (
                                      <span className="px-2 py-0.5 text-xs bg-red-100 text-red-800 rounded">Error</span>
                                    ) : (
                                      <span className="px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded">Success</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-2">
                                    <button
                                      onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                                      className="text-blue-600 hover:text-blue-700 text-sm"
                                    >
                                      {expandedLogId === log.id ? 'Hide' : 'Show'} payload
                                    </button>
                                    {log.error_message && (
                                      <div className="mt-1 text-xs text-red-600 max-w-xs truncate" title={log.error_message}>
                                        {log.error_message}
                                      </div>
                                    )}
                                  </td>
                                </tr>
                                {expandedLogId === log.id && (
                                  <tr>
                                    <td colSpan={5} className="px-4 py-3 bg-gray-50">
                                      <div className="text-xs font-mono overflow-x-auto max-h-48 overflow-y-auto">
                                        <pre className="whitespace-pre-wrap break-words">
                                          {JSON.stringify(log.payload_snapshot, null, 2)}
                                        </pre>
                                        {log.error_message && (
                                          <div className="mt-2 text-red-600">
                                            <strong>Error:</strong> {log.error_message}
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="flex items-center justify-between mt-4">
                        <span className="text-sm text-gray-600">
                          Showing {emailLogPage * emailLogPageSize + 1}–{Math.min((emailLogPage + 1) * emailLogPageSize, emailLogsTotal)} of {emailLogsTotal}
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEmailLogPage((p) => Math.max(0, p - 1))}
                            disabled={emailLogPage === 0}
                            className="px-3 py-1.5 border border-gray-300 rounded text-sm disabled:opacity-50 hover:bg-gray-50"
                          >
                            Previous
                          </button>
                          <button
                            onClick={() => setEmailLogPage((p) => p + 1)}
                            disabled={(emailLogPage + 1) * emailLogPageSize >= emailLogsTotal}
                            className="px-3 py-1.5 border border-gray-300 rounded text-sm disabled:opacity-50 hover:bg-gray-50"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {transactionalEmailSection === 'finance-report' && (
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 md:p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">Send Finance Report</h2>
                  <p className="text-sm text-gray-600 mb-4">Run a finance report for a date range and send it to a distribution list. Data is taken from Finance Analytics (metrics, income, expenses, cash flow, receivables).</p>

                  <div className="flex flex-wrap items-end gap-4 mb-6">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">From date</label>
                      <input
                        type="date"
                        value={financeReportStartDate}
                        onChange={(e) => setFinanceReportStartDate(e.target.value)}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">To date</label>
                      <input
                        type="date"
                        value={financeReportEndDate}
                        onChange={(e) => setFinanceReportEndDate(e.target.value)}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="min-w-[200px]">
                      <label className="block text-xs text-gray-500 mb-1">Distribution list</label>
                      <select
                        value={financeReportDlId}
                        onChange={(e) => setFinanceReportDlId(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      >
                        <option value="">Select list</option>
                        {distributionLists.map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={async () => {
                        if (!financeReportStartDate || !financeReportEndDate) {
                          setError('Please select both From and To dates.');
                          return;
                        }
                        if (!financeReportDlId) {
                          setError('Please select a distribution list.');
                          return;
                        }
                        const template = emailTemplates.find((t) => t.trigger_key === 'finance_report');
                        if (!template) {
                          setError('Finance report template not found. Run migration 20260302100000_add_finance_report_email_template.sql.');
                          return;
                        }
                        setError(null);
                        setSuccess(null);
                        setFinanceReportSending(true);
                        try {
                          const result = await sendFinanceReportEmail(
                            financeReportStartDate,
                            financeReportEndDate,
                            financeReportDlId,
                            template.id
                          );
                          if (result.sent) {
                            setSuccess(`Finance report sent to ${result.recipientCount ?? 0} recipient(s).`);
                          } else {
                            setError(result.error ?? 'Failed to send report.');
                          }
                        } finally {
                          setFinanceReportSending(false);
                        }
                      }}
                      disabled={financeReportSending || !financeReportStartDate || !financeReportEndDate || !financeReportDlId}
                      className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {financeReportSending ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Sending…
                        </>
                      ) : (
                        <>
                          <Mail className="w-4 h-4" />
                          Send finance report
                        </>
                      )}
                    </button>
                  </div>

                  {!emailTemplates.some((t) => t.trigger_key === 'finance_report') && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                      Finance report template is not in the database yet. Run the migration <code className="bg-amber-100 px-1 rounded">20260302100000_add_finance_report_email_template.sql</code> to add it.
                    </div>
                  )}
                </div>
              )}

              {transactionalEmailSection === 'sales-report' && (
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 md:p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">Send Sales Report</h2>
                  <p className="text-sm text-gray-600 mb-4">Run a sales report for a date range and send it to a distribution list. Data is taken from Sales Analytics (summary, customer/product sales, outstanding payments, trends, distribution).</p>
                  <div className="flex flex-wrap items-end gap-4 mb-6">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">From date</label>
                      <input type="date" value={salesReportStartDate} onChange={(e) => setSalesReportStartDate(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">To date</label>
                      <input type="date" value={salesReportEndDate} onChange={(e) => setSalesReportEndDate(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div className="min-w-[200px]">
                      <label className="block text-xs text-gray-500 mb-1">Distribution list</label>
                      <select value={salesReportDlId} onChange={(e) => setSalesReportDlId(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                        <option value="">Select list</option>
                        {distributionLists.map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={async () => {
                        if (!salesReportStartDate || !salesReportEndDate) { setError('Please select both From and To dates.'); return; }
                        if (!salesReportDlId) { setError('Please select a distribution list.'); return; }
                        const template = emailTemplates.find((t) => t.trigger_key === 'sales_report');
                        if (!template) { setError('Sales report template not found. Run migration 20260302110000_add_sales_report_email_template.sql.'); return; }
                        setError(null); setSuccess(null); setSalesReportSending(true);
                        try {
                          const result = await sendSalesReportEmail(salesReportStartDate, salesReportEndDate, salesReportDlId, template.id);
                          if (result.sent) setSuccess(`Sales report sent to ${result.recipientCount ?? 0} recipient(s).`);
                          else setError(result.error ?? 'Failed to send report.');
                        } finally { setSalesReportSending(false); }
                      }}
                      disabled={salesReportSending || !salesReportStartDate || !salesReportEndDate || !salesReportDlId}
                      className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {salesReportSending ? <><RefreshCw className="w-4 h-4 animate-spin" /> Sending…</> : <><Mail className="w-4 h-4" /> Send sales report</>}
                    </button>
                  </div>
                  {!emailTemplates.some((t) => t.trigger_key === 'sales_report') && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                      Sales report template is not in the database yet. Run the migration <code className="bg-amber-100 px-1 rounded">20260302110000_add_sales_report_email_template.sql</code> to add it.
                    </div>
                  )}
                </div>
              )}

              {transactionalEmailSection === 'inventory-report' && (
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 md:p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">Send Inventory Report</h2>
                  <p className="text-sm text-gray-600 mb-4">Run an inventory report for a date range and send it to a distribution list. Data is taken from Inventory Analytics (current stock, out of stock, low stock, consumption, new arrivals).</p>
                  <div className="flex flex-wrap items-end gap-4 mb-6">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">From date</label>
                      <input type="date" value={inventoryReportStartDate} onChange={(e) => setInventoryReportStartDate(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">To date</label>
                      <input type="date" value={inventoryReportEndDate} onChange={(e) => setInventoryReportEndDate(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div className="min-w-[200px]">
                      <label className="block text-xs text-gray-500 mb-1">Distribution list</label>
                      <select value={inventoryReportDlId} onChange={(e) => setInventoryReportDlId(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                        <option value="">Select list</option>
                        {distributionLists.map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={async () => {
                        if (!inventoryReportStartDate || !inventoryReportEndDate) { setError('Please select both From and To dates.'); return; }
                        if (!inventoryReportDlId) { setError('Please select a distribution list.'); return; }
                        const template = emailTemplates.find((t) => t.trigger_key === 'inventory_report');
                        if (!template) { setError('Inventory report template not found. Run migration 20260302120000_add_inventory_report_email_template.sql.'); return; }
                        setError(null); setSuccess(null); setInventoryReportSending(true);
                        try {
                          const result = await sendInventoryReportEmail(inventoryReportStartDate, inventoryReportEndDate, inventoryReportDlId, template.id);
                          if (result.sent) setSuccess(`Inventory report sent to ${result.recipientCount ?? 0} recipient(s).`);
                          else setError(result.error ?? 'Failed to send report.');
                        } finally { setInventoryReportSending(false); }
                      }}
                      disabled={inventoryReportSending || !inventoryReportStartDate || !inventoryReportEndDate || !inventoryReportDlId}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {inventoryReportSending ? <><RefreshCw className="w-4 h-4 animate-spin" /> Sending…</> : <><Mail className="w-4 h-4" /> Send inventory report</>}
                    </button>
                  </div>
                  {!emailTemplates.some((t) => t.trigger_key === 'inventory_report') && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                      Inventory report template is not in the database yet. Run the migration <code className="bg-amber-100 px-1 rounded">20260302120000_add_inventory_report_email_template.sql</code> to add it.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Transformation Rules Editor Modal */}
          {showTransformRulesEditor && transformRulesEditingTag && (
            <div className="fixed inset-0 z-50 overflow-y-auto">
              <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                <div
                  className="fixed inset-0 transition-opacity bg-gray-900/40 backdrop-blur-sm"
                  onClick={closeTransformRulesEditor}
                />
                <div className="inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-3xl sm:w-full border border-gray-100">
                  <div className="bg-white px-6 pt-6 pb-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          Transformation targets: <span className="font-semibold">{transformRulesEditingTag.display_name}</span>
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          Define which raw material tags can be created by transforming lots of this tag (e.g. Banana → Banana Peel). Optionally set default process steps for each target.
                        </p>
                      </div>
                      <button
                        onClick={closeTransformRulesEditor}
                        className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100"
                        disabled={transformRulesSaving}
                        title="Close"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                  <div className="px-6 pb-6 space-y-4">
                    {transformRulesLoading ? (
                      <div className="p-6 text-center text-gray-500">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                        Loading…
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          <label className="text-sm font-medium text-gray-700">Add target:</label>
                          <select
                            value=""
                            onChange={(e) => {
                              const id = e.target.value;
                              if (!id) return;
                              if (transformRulesDraft.some((r) => r.target_tag_id === id)) return;
                              const tag = rawMaterialTags.find((t) => t.id === id);
                              setTransformRulesDraft((prev) => [...prev, { target_tag_id: id, default_steps: tag ? [{ key: 'extract', label: 'Extract' }, { key: 'drying', label: 'Drying' }, { key: 'sorting', label: 'Sorting' }, { key: 'other', label: 'Other' }] : [] }]);
                              e.target.value = '';
                            }}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500"
                          >
                            <option value="">Select tag…</option>
                            {rawMaterialTags
                              .filter((t) => t.id !== transformRulesEditingTag.id && !transformRulesDraft.some((d) => d.target_tag_id === t.id))
                              .map((t) => (
                                <option key={t.id} value={t.id}>{t.display_name}</option>
                              ))}
                          </select>
                        </div>
                        <div className="overflow-x-auto border border-gray-200 rounded-xl">
                          <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Target tag</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Default steps (order)</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {transformRulesDraft.map((row, rowIdx) => {
                                const targetTag = rawMaterialTags.find((t) => t.id === row.target_tag_id);
                                return (
                                  <tr key={row.target_tag_id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                      {targetTag?.display_name ?? row.target_tag_id}
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex flex-wrap items-center gap-1">
                                        {row.default_steps.map((step, stepIdx) => (
                                          <span key={stepIdx} className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-800 rounded text-xs">
                                            {step.label || step.key || 'Step'}
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setTransformRulesDraft((prev) =>
                                                  prev.map((r, i) =>
                                                    i === rowIdx
                                                      ? { ...r, default_steps: r.default_steps.filter((_, j) => j !== stepIdx) }
                                                      : r
                                                  )
                                                )
                                              }
                                              className="text-amber-600 hover:text-amber-800"
                                            >
                                              ×
                                            </button>
                                          </span>
                                        ))}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const label = prompt('Step label:');
                                            if (label?.trim()) {
                                              const key = label.toLowerCase().replace(/\s+/g, '_');
                                              setTransformRulesDraft((prev) =>
                                                prev.map((r, i) =>
                                                  i === rowIdx ? { ...r, default_steps: [...r.default_steps, { key, label: label.trim() }] } : r
                                                )
                                              );
                                            }
                                          }}
                                          className="text-xs text-amber-600 hover:text-amber-800"
                                        >
                                          + Add step
                                        </button>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                      <button
                                        type="button"
                                        onClick={() => setTransformRulesDraft((prev) => prev.filter((_, i) => i !== rowIdx))}
                                        className="text-red-600 hover:text-red-800 text-sm"
                                      >
                                        Remove
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                              {transformRulesDraft.length === 0 && (
                                <tr>
                                  <td colSpan={3} className="px-4 py-6 text-center text-sm text-gray-500">
                                    No transformation targets. Add a target tag above to allow transforming lots of this tag into another (e.g. Banana → Banana Peel).
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={closeTransformRulesEditor}
                            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                            disabled={transformRulesSaving}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={saveTransformRulesEditor}
                            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 text-sm flex items-center gap-2"
                            disabled={transformRulesSaving}
                          >
                            {transformRulesSaving ? <><RefreshCw className="w-4 h-4 animate-spin" /> Saving…</> : 'Save'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Raw Material Lifecycle Editor Modal */}
          {showLifecycleEditor && lifecycleEditingTag && (
            <div className="fixed inset-0 z-50 overflow-y-auto">
              <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                <div
                  className="fixed inset-0 transition-opacity bg-gray-900/40 backdrop-blur-sm"
                  onClick={closeLifecycleEditor}
                />
                <div className="inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-3xl sm:w-full border border-gray-100">
                  <div className="bg-white px-6 pt-6 pb-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          Manage lifecycle: <span className="font-semibold">{lifecycleEditingTag.display_name}</span>
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          Configure stages and the default stage. Transitions are linear (Stage 1 → Stage 2 → …).
                        </p>
                      </div>
                      <button
                        onClick={closeLifecycleEditor}
                        className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100"
                        disabled={lifecycleSaving}
                        title="Close"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  </div>

                  <div className="px-6 pb-6 space-y-4">
                    {lifecycleLoading ? (
                      <div className="p-6 text-center text-gray-500">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                        Loading lifecycle…
                      </div>
                    ) : (
                      <>
                        <div className="overflow-x-auto border border-gray-200 rounded-xl">
                          <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stage Key</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Label</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Default</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Makes Usable</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {lifecycleStagesDraft.map((s, idx) => (
                                <tr key={`${s.stage_key}-${idx}`} className="hover:bg-gray-50">
                                  <td className="px-4 py-3 text-sm text-gray-700">{idx + 1}</td>
                                  <td className="px-4 py-3">
                                    <input
                                      value={s.stage_key}
                                      onChange={(e) =>
                                        setLifecycleStagesDraft((prev) =>
                                          prev.map((row, i) => (i === idx ? { ...row, stage_key: e.target.value } : row))
                                        )
                                      }
                                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
                                      placeholder="e.g. IN_RIPENING"
                                    />
                                  </td>
                                  <td className="px-4 py-3">
                                    <input
                                      value={s.stage_label}
                                      onChange={(e) =>
                                        setLifecycleStagesDraft((prev) =>
                                          prev.map((row, i) => (i === idx ? { ...row, stage_label: e.target.value } : row))
                                        )
                                      }
                                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                                      placeholder="e.g. In Ripening"
                                    />
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <input
                                      type="radio"
                                      name="default-stage"
                                      checked={!!s.is_default}
                                      onChange={() =>
                                        setLifecycleStagesDraft((prev) =>
                                          prev.map((row, i) => ({ ...row, is_default: i === idx }))
                                        )
                                      }
                                      className="text-emerald-600 focus:ring-emerald-500"
                                    />
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <input
                                      type="checkbox"
                                      checked={!!s.makes_usable}
                                      onChange={() =>
                                        setLifecycleStagesDraft((prev) =>
                                          prev.map((row, i) => (i === idx ? { ...row, makes_usable: !row.makes_usable } : row))
                                        )
                                      }
                                      className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                    />
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (idx === 0) return;
                                          setLifecycleStagesDraft((prev) => {
                                            const next = [...prev];
                                            const tmp = next[idx - 1];
                                            next[idx - 1] = next[idx];
                                            next[idx] = tmp;
                                            return next;
                                          });
                                        }}
                                        className="px-2 py-1 text-xs border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                                        disabled={idx === 0}
                                      >
                                        Up
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setLifecycleStagesDraft((prev) => {
                                            if (idx >= prev.length - 1) return prev;
                                            const next = [...prev];
                                            const tmp = next[idx + 1];
                                            next[idx + 1] = next[idx];
                                            next[idx] = tmp;
                                            return next;
                                          });
                                        }}
                                        className="px-2 py-1 text-xs border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                                        disabled={idx >= lifecycleStagesDraft.length - 1}
                                      >
                                        Down
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setLifecycleStagesDraft((prev) => prev.filter((_, i) => i !== idx))
                                        }
                                        className="px-2 py-1 text-xs border border-red-200 text-red-700 rounded-md hover:bg-red-50"
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                              {lifecycleStagesDraft.length === 0 && (
                                <tr>
                                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-500">
                                    No stages yet. Add your first stage.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              setLifecycleStagesDraft((prev) => [
                                ...prev,
                                {
                                  stage_key: '',
                                  stage_label: '',
                                  stage_order: prev.length + 1,
                                  is_default: prev.length === 0,
                                  makes_usable: false,
                                },
                              ])
                            }
                            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                            disabled={lifecycleSaving}
                          >
                            <Plus className="w-4 h-4 inline mr-2" />
                            Add stage
                          </button>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={closeLifecycleEditor}
                              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                              disabled={lifecycleSaving}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={saveLifecycleEditor}
                              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center gap-2"
                              disabled={lifecycleSaving || lifecycleLoading}
                            >
                              {lifecycleSaving ? <><RefreshCw className="w-4 h-4 animate-spin" /> Saving…</> : <>Save lifecycle</>}
                            </button>
                          </div>
                        </div>

                        <div className="text-xs text-gray-500 space-y-1">
                          <p>Notes: Stage keys are stored in lots as <code className="bg-gray-100 px-1 rounded">usability_status</code>. Use uppercase keys (e.g. <code className="bg-gray-100 px-1 rounded">IN_RIPENING</code>).</p>
                          <p>Mark at least one stage as &quot;Makes usable&quot; so that when a lot is changed to that stage, the Transform button becomes available. The lot stays non-usable until the user transforms it.</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
