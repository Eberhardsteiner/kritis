import industryCorePack from '../module-packs/industry-core.container.json';
import healthcareCorePack from '../module-packs/healthcare-core.container.json';
import energyCorePack from '../module-packs/energy-core.container.json';
import logisticsCorePack from '../module-packs/logistics-core.container.json';
import type { ModulePackContainer } from '../types';

export const builtInModulePacks: ModulePackContainer[] = [
  industryCorePack,
  healthcareCorePack,
  energyCorePack,
  logisticsCorePack,
] as ModulePackContainer[];
