export type ModuleId =
  | 'finance'
  | 'analytics'
  | 'documents'
  | 'agile'
  | 'operations'
  | 'sales';

export interface ModuleDefinition {
  id: ModuleId;
  name: string;
  description: string;
}

export const MODULE_DEFINITIONS: ModuleDefinition[] = [
  { id: 'finance', name: 'Finance', description: 'Manage budgets and expenses' },
  { id: 'analytics', name: 'Analytics', description: 'View performance metrics' },
  { id: 'documents', name: 'Documents', description: 'Manage files and records' },
  { id: 'agile', name: 'Agile', description: 'Boards, backlog, and roadmap' },
  { id: 'operations', name: 'Operations', description: 'Production and inventory management' },
  { id: 'sales', name: 'Sales', description: 'Orders, customers, and invoicing' },
];

export const MODULE_IDS = MODULE_DEFINITIONS.map((module) => module.id);
