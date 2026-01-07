import { MODULE_DEFINITIONS, type ModuleId } from './modules';

export type AccessLevel = 'read-write' | 'read-only' | 'no-access';

export interface ModuleAccess {
  moduleId: ModuleId;
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




