export type ModuleId =
  | 'finance'
  | 'analytics'
  | 'documents'
  | 'agile'
  | 'operations'
  | 'sales'
  | 'tools';

export interface ModuleDefinition {
  id: ModuleId;
  name: string;
  description: string;
}

/** Modules that use Yes/No access only (no read-only). */
export const TOOLS_MODULE_ID: ModuleId = 'tools';

export const MODULE_DEFINITIONS: ModuleDefinition[] = [
  { id: 'finance', name: 'Finance', description: 'Manage budgets and expenses' },
  { id: 'analytics', name: 'Analytics', description: 'View performance metrics' },
  { id: 'documents', name: 'Documents', description: 'Manage files and records' },
  { id: 'agile', name: 'Agile', description: 'Boards, backlog, and roadmap' },
  { id: 'operations', name: 'Operations', description: 'Production and inventory management' },
  { id: 'sales', name: 'Sales', description: 'Orders, customers, and invoicing' },
  { id: 'tools', name: 'Tools', description: 'Company tools (not part of inventory)' },
];

export const MODULE_IDS = MODULE_DEFINITIONS.map((module) => module.id);
