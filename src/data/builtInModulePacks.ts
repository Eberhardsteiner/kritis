import industryCorePack from '../module-packs/industry-core.container.json';
import healthcareCorePack from '../module-packs/healthcare-core.container.json';
import energyCorePack from '../module-packs/energy-core.container.json';
import logisticsCorePack from '../module-packs/logistics-core.container.json';
import waterCorePack from '../module-packs/water-core.container.json';
import itTelecomCorePack from '../module-packs/it-telecom-core.container.json';
import financeCorePack from '../module-packs/finance-core.container.json';
import administrationCorePack from '../module-packs/administration-core.container.json';
import kmuBasisCorePack from '../module-packs/kmu-basis-core.container.json';
import defenceCorePack from '../module-packs/defence-core.container.json';
import type { ModulePackContainer } from '../types';

export const builtInModulePacks: ModulePackContainer[] = [
  industryCorePack,
  healthcareCorePack,
  energyCorePack,
  logisticsCorePack,
  waterCorePack,
  itTelecomCorePack,
  financeCorePack,
  administrationCorePack,
  kmuBasisCorePack,
  defenceCorePack,
] as ModulePackContainer[];
