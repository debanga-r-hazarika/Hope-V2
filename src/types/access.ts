import { MODULE_DEFINITIONS, type ModuleId } from './modules';

export type AccessLevel = 'read-write' | 'read-only' | 'no-access';

/** Operations sub-module IDs stored in user_module_access (existing backend module_name values). */
export type OperationsSubModuleId =
  | 'operations-raw-materials'
  | 'operations-recurring-products'
  | 'operations-production-batches';

export const OPERATIONS_SUB_MODULE_IDS: OperationsSubModuleId[] = [
  'operations-raw-materials',
  'operations-recurring-products',
  'operations-production-batches',
];

/** Operations sub-modules for access control UI (backend uses these as module_name). */
export const OPERATIONS_SUB_MODULE_DEFINITIONS: Array<{ id: OperationsSubModuleId; name: string }> = [
  { id: 'operations-raw-materials', name: 'Raw Material Module' },
  { id: 'operations-recurring-products', name: 'Recurring Product Module' },
  { id: 'operations-production-batches', name: 'Production Module' },
];

export interface OperationsSubModuleAccess {
  rawMaterial: AccessLevel;
  recurringProduct: AccessLevel;
  production: AccessLevel;
}

export interface ModuleAccess {
  moduleId: ModuleId | OperationsSubModuleId;
  moduleName: string;
  accessLevel: AccessLevel;
}

export type ModuleAccessMap = Record<ModuleId, AccessLevel>;

const defaultAccess: ModuleAccessMap = MODULE_DEFINITIONS.reduce((acc, module) => {
  acc[module.id] = 'no-access';
  return acc;
}, {} as ModuleAccessMap);

export const getDefaultModuleAccess = () => ({ ...defaultAccess });

export const getAdminAccess = () =>
  MODULE_DEFINITIONS.reduce((acc, module) => {
    acc[module.id] = 'read-write';
    return acc;
  }, {} as ModuleAccessMap);




