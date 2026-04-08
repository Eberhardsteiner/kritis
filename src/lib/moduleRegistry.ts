import { builtInModulePacks } from '../data/builtInModulePacks';
import { baseDomains } from '../data/baseDomains';
import { baseQuestions } from '../data/baseQuestions';
import { baseRoleTemplates } from '../data/governanceBase';
import { defaultDocumentFolders } from '../data/workspaceBase';
import { baseAuditChecklist, baseKritisRequirements } from '../data/kritisBase';
import type {
  ActionTemplateDefinition,
  AuditChecklistItemDefinition,
  BusinessProcessTemplateDefinition,
  DependencyTemplateDefinition,
  EvidenceTemplateDefinition,
  ExerciseTemplateDefinition,
  MaturityProfileDefinition,
  ModuleEngineCapability,
  ModuleOverlayDefinition,
  ModulePackContainer,
  ModulePackFormat,
  ModulePackManifest,
  ModulePackRegistryEntry,
  ModuleValidationResult,
  QuestionDefinition,
  RequirementDefinition,
  RoleTemplateDefinition,
  ScenarioTemplateDefinition,
  SectorModuleDefinition,
} from '../types';

export const MODULE_ENGINE_ID = 'krisenfest-sector-engine';
export const MODULE_ENGINE_VERSION = '1.0.0';
export const MODULE_ENGINE_APP_VERSION = '1.8.0';

const validDomainIds = new Set(baseDomains.map((domain) => domain.id));
const baseQuestionIds = new Set(baseQuestions.map((question) => question.id));
const baseRequirementIds = new Set(baseKritisRequirements.map((requirement) => requirement.id));
const baseRoleTemplateIds = new Set(baseRoleTemplates.map((entry) => entry.id));
const baseChecklistIds = new Set(baseAuditChecklist.map((entry) => entry.id));

const supportedCapabilities = new Set<ModuleEngineCapability>([
  'assessment',
  'actions',
  'evidence',
  'governance',
  'kritis',
  'bia',
  'documents',
  'reporting',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isSemver(value: unknown): boolean {
  return /^\d+\.\d+\.\d+$/.test(sanitizeString(value));
}

function compareSemver(left: unknown, right: unknown): number {
  const parse = (value: unknown) => (isSemver(value)
    ? sanitizeString(value).split('.').map((part) => Number(part))
    : [0, 0, 0]);
  const [lMajor, lMinor, lPatch] = parse(left);
  const [rMajor, rMinor, rPatch] = parse(right);
  if (lMajor !== rMajor) return lMajor - rMajor;
  if (lMinor !== rMinor) return lMinor - rMinor;
  return lPatch - rPatch;
}

function deduplicateStrings(values: unknown): string[] {
  const seen = new Set<string>();
  return Array.isArray(values)
    ? values
      .map((entry) => sanitizeString(entry))
      .filter((entry) => entry.length > 0 && !seen.has(entry) && seen.add(entry))
    : [];
}

function normalizeModulePackManifest(input: unknown): ModulePackManifest | undefined {
  if (!isRecord(input)) {
    return undefined;
  }

  const packType = sanitizeString(input.packType) === 'overlay' ? 'overlay' : 'module';
  const compatibility = isRecord(input.compatibility)
    ? {
        minAppVersion: sanitizeString(input.compatibility.minAppVersion),
        minEngineVersion: sanitizeString(input.compatibility.minEngineVersion),
      }
    : undefined;

  return {
    packId: sanitizeString(input.packId),
    packType,
    moduleId: sanitizeString(input.moduleId),
    name: sanitizeString(input.name),
    version: sanitizeString(input.version),
    description: sanitizeString(input.description),
    engine: sanitizeString(input.engine),
    engineVersion: sanitizeString(input.engineVersion),
    sectorCategory: sanitizeString(input.sectorCategory),
    industryClass: sanitizeString(input.industryClass),
    maintainer: sanitizeString(input.maintainer),
    tags: deduplicateStrings(input.tags),
    capabilities: deduplicateStrings(input.capabilities)
      .filter((entry): entry is ModuleEngineCapability => supportedCapabilities.has(entry as ModuleEngineCapability)),
    compatibility,
    releaseChannel: ['core', 'sector', 'overlay', 'custom'].includes(sanitizeString(input.releaseChannel))
      ? sanitizeString(input.releaseChannel) as ModulePackManifest['releaseChannel']
      : undefined,
  };
}

function validateModulePackManifest(
  manifest: ModulePackManifest | undefined,
  errors: string[],
  path = 'manifest',
): manifest is ModulePackManifest {
  if (!manifest) {
    errors.push(`${path} fehlt oder ist ungültig.`);
    return false;
  }

  if (!manifest.packId) {
    errors.push(`${path}.packId fehlt oder ist leer.`);
  }
  if (!['module', 'overlay'].includes(manifest.packType)) {
    errors.push(`${path}.packType muss module oder overlay sein.`);
  }
  if (!manifest.moduleId) {
    errors.push(`${path}.moduleId fehlt oder ist leer.`);
  }
  if (!manifest.name) {
    errors.push(`${path}.name fehlt oder ist leer.`);
  }
  if (!manifest.description) {
    errors.push(`${path}.description fehlt oder ist leer.`);
  }
  if (!isSemver(manifest.version)) {
    errors.push(`${path}.version muss dem Format x.y.z entsprechen.`);
  }
  if (manifest.engine && manifest.engine !== MODULE_ENGINE_ID) {
    errors.push(`${path}.engine muss ${MODULE_ENGINE_ID} sein.`);
  }
  if (manifest.engineVersion && !isSemver(manifest.engineVersion)) {
    errors.push(`${path}.engineVersion muss dem Format x.y.z entsprechen.`);
  }
  if (manifest.compatibility?.minAppVersion && !isSemver(manifest.compatibility.minAppVersion)) {
    errors.push(`${path}.compatibility.minAppVersion muss dem Format x.y.z entsprechen.`);
  }
  if (manifest.compatibility?.minEngineVersion && !isSemver(manifest.compatibility.minEngineVersion)) {
    errors.push(`${path}.compatibility.minEngineVersion muss dem Format x.y.z entsprechen.`);
  }
  if (manifest.compatibility?.minEngineVersion && compareSemver(manifest.compatibility.minEngineVersion, MODULE_ENGINE_VERSION) > 0) {
    errors.push(`${path}.compatibility.minEngineVersion erfordert eine neuere Engine-Version.`);
  }
  if (manifest.compatibility?.minAppVersion && compareSemver(manifest.compatibility.minAppVersion, MODULE_ENGINE_APP_VERSION) > 0) {
    errors.push(`${path}.compatibility.minAppVersion erfordert eine neuere App-Version.`);
  }
  return errors.length === 0;
}

function isLikelyOverlayPayload(value: unknown): value is ModuleOverlayDefinition {
  return isRecord(value) && sanitizeString(value.id).length > 0 && (value.schemaVersion === undefined || Number.isFinite(Number(value.schemaVersion)));
}

function validateOverlayObject(value: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return ['module muss ein Objekt sein.'];
  }
  if (!sanitizeString(value.id)) {
    errors.push('module.id fehlt oder ist leer.');
  }
  if (!isSemver(value.version)) {
    errors.push('module.version muss dem Format x.y.z entsprechen.');
  }
  if (value.additionalQuestions !== undefined && !Array.isArray(value.additionalQuestions)) {
    errors.push('module.additionalQuestions muss ein Array sein.');
  }
  if (value.recommendedActions !== undefined && !Array.isArray(value.recommendedActions)) {
    errors.push('module.recommendedActions muss ein Array sein.');
  }
  if (value.evidenceTemplates !== undefined && !Array.isArray(value.evidenceTemplates)) {
    errors.push('module.evidenceTemplates muss ein Array sein.');
  }
  if (value.documentFolders !== undefined && !Array.isArray(value.documentFolders)) {
    errors.push('module.documentFolders muss ein Array sein.');
  }
  if (value.auditChecklist !== undefined && !Array.isArray(value.auditChecklist)) {
    errors.push('module.auditChecklist muss ein Array sein.');
  }
  return errors;
}

function normalizeModuleContainer(input: unknown): ModulePackContainer | undefined {
  if (!isRecord(input)) {
    return undefined;
  }
  const manifest = normalizeModulePackManifest(input.manifest);
  const containerVersion = Number.isFinite(Number(input.containerVersion)) ? Number(input.containerVersion) : undefined;
  if (!manifest || !containerVersion || !('module' in input)) {
    return undefined;
  }
  return {
    containerVersion,
    manifest,
    targetModuleId: sanitizeString(input.targetModuleId),
    module: input.module as ModulePackContainer['module'],
  };
}

export function buildSyntheticManifestFromModule(module: SectorModuleDefinition): ModulePackManifest {
  return {
    packId: `legacy-${module.id}`,
    packType: 'module',
    moduleId: module.id,
    name: module.name,
    version: module.version,
    description: module.description,
    engine: MODULE_ENGINE_ID,
    engineVersion: MODULE_ENGINE_VERSION,
    sectorCategory: module.sectorCategory,
    capabilities: ['assessment', 'actions', 'evidence', 'governance', 'kritis', 'bia', 'documents', 'reporting'],
    compatibility: {
      minAppVersion: MODULE_ENGINE_APP_VERSION,
      minEngineVersion: MODULE_ENGINE_VERSION,
    },
    releaseChannel: 'custom',
  };
}

export function getModuleFromContainer(container: ModulePackContainer): SectorModuleDefinition {
  return container.module as SectorModuleDefinition;
}

export function getBuiltInManifestByModuleId(moduleId: string): ModulePackManifest | undefined {
  return builtInModulePacks.find((entry) => entry.manifest.moduleId === moduleId)?.manifest;
}

export const builtInModuleContainers: ModulePackContainer[] = builtInModulePacks;
export const builtInModules: SectorModuleDefinition[] = builtInModuleContainers.map(getModuleFromContainer);

export function getAllModules(uploadedModules: SectorModuleDefinition[]): SectorModuleDefinition[] {
  return [...builtInModules, ...uploadedModules];
}

export function getModuleById(
  moduleId: string,
  uploadedModules: SectorModuleDefinition[],
): SectorModuleDefinition | undefined {
  return getAllModules(uploadedModules).find((module) => module.id === moduleId);
}

export function getQuestionsForModule(module?: SectorModuleDefinition): QuestionDefinition[] {
  if (!module?.additionalQuestions?.length) {
    return baseQuestions;
  }

  const seen = new Set<string>();
  return [...baseQuestions, ...module.additionalQuestions].filter((question) => {
    if (seen.has(question.id)) {
      return false;
    }
    seen.add(question.id);
    return true;
  });
}

export function getDomainWeight(domainId: string, module?: SectorModuleDefinition): number {
  return module?.domainWeightAdjustments?.[domainId] ?? 1;
}

export function getKritisRequirementsForModule(
  module?: SectorModuleDefinition,
): RequirementDefinition[] {
  const seen = new Set<string>();
  return [
    ...baseKritisRequirements,
    ...(module?.kritisExtension?.additionalRequirements ?? []),
  ].filter((requirement) => {
    if (seen.has(requirement.id)) {
      return false;
    }
    seen.add(requirement.id);
    return true;
  });
}

export function getActionTemplatesForModule(
  module?: SectorModuleDefinition,
): ActionTemplateDefinition[] {
  return module?.recommendedActions ?? [];
}

export function getEvidenceTemplatesForModule(
  module?: SectorModuleDefinition,
): EvidenceTemplateDefinition[] {
  return module?.evidenceTemplates ?? [];
}

export function getDocumentFoldersForModule(
  module?: SectorModuleDefinition,
): string[] {
  const merged = [...defaultDocumentFolders, ...(module?.documentFolders ?? [])];
  const seen = new Set<string>();

  return merged.filter((entry) => {
    const normalized = entry.trim();
    if (!normalized || seen.has(normalized)) {
      return false;
    }
    seen.add(normalized);
    return true;
  });
}

export function getRoleTemplatesForModule(
  module?: SectorModuleDefinition,
): RoleTemplateDefinition[] {
  const merged = [...baseRoleTemplates, ...(module?.roleTemplates ?? [])];
  const seen = new Set<string>();

  return merged.filter((entry) => {
    if (seen.has(entry.id)) {
      return false;
    }
    seen.add(entry.id);
    return true;
  });
}

export function getAuditChecklistForModule(
  module?: SectorModuleDefinition,
): AuditChecklistItemDefinition[] {
  const merged = [...baseAuditChecklist, ...(module?.auditChecklist ?? [])];
  const seen = new Set<string>();

  return merged.filter((entry) => {
    if (seen.has(entry.id)) {
      return false;
    }
    seen.add(entry.id);
    return true;
  });
}

export function getProcessTemplatesForModule(
  module?: SectorModuleDefinition,
): BusinessProcessTemplateDefinition[] {
  return module?.processTemplates ?? [];
}

export function getDependencyTemplatesForModule(
  module?: SectorModuleDefinition,
): DependencyTemplateDefinition[] {
  return module?.dependencyTemplates ?? [];
}

export function getScenarioTemplatesForModule(
  module?: SectorModuleDefinition,
): ScenarioTemplateDefinition[] {
  return module?.scenarioTemplates ?? [];
}

export function getExerciseTemplatesForModule(
  module?: SectorModuleDefinition,
): ExerciseTemplateDefinition[] {
  return module?.exerciseTemplates ?? [];
}

export function getMaturityProfileForModule(
  module?: SectorModuleDefinition,
): MaturityProfileDefinition | undefined {
  return module?.maturityProfile;
}

function validateStringArray(
  value: unknown,
  errors: string[],
  path: string,
): value is string[] {
  if (!Array.isArray(value)) {
    errors.push(`${path} muss ein Array sein.`);
    return false;
  }

  const invalidEntry = value.find((entry) => typeof entry !== 'string' || !entry.trim());
  if (invalidEntry !== undefined) {
    errors.push(`${path} darf nur nichtleere Strings enthalten.`);
    return false;
  }

  return true;
}

function validateQuestion(
  question: unknown,
  errors: string[],
  path: string,
  duplicateCheck: Set<string>,
): question is QuestionDefinition {
  const startLength = errors.length;

  if (!isRecord(question)) {
    errors.push(`${path} muss ein Objekt sein.`);
    return false;
  }

  const requiredStringFields = ['id', 'domainId', 'title', 'prompt', 'guidance', 'recommendation'];
  for (const field of requiredStringFields) {
    if (typeof question[field] !== 'string' || !String(question[field]).trim()) {
      errors.push(`${path}.${field} fehlt oder ist leer.`);
    }
  }

  if (typeof question.weight !== 'number' || Number.isNaN(question.weight) || question.weight <= 0) {
    errors.push(`${path}.weight muss eine Zahl größer 0 sein.`);
  }

  if (typeof question.id === 'string') {
    if (baseQuestionIds.has(question.id)) {
      errors.push(`${path}.id "${question.id}" kollidiert mit einer Basisfrage.`);
    }
    if (duplicateCheck.has(question.id)) {
      errors.push(`${path}.id "${question.id}" ist innerhalb des Moduls doppelt.`);
    }
    duplicateCheck.add(question.id);
  }

  if (typeof question.domainId === 'string' && !validDomainIds.has(question.domainId)) {
    errors.push(`${path}.domainId "${question.domainId}" ist nicht unterstützt.`);
  }

  if (question.tags !== undefined) {
    validateStringArray(question.tags, errors, `${path}.tags`);
  }
  if (question.lawRefs !== undefined) {
    validateStringArray(question.lawRefs, errors, `${path}.lawRefs`);
  }

  return errors.length === startLength;
}

function validateRequirement(
  requirement: unknown,
  errors: string[],
  path: string,
  duplicateCheck: Set<string>,
): requirement is RequirementDefinition {
  const startLength = errors.length;

  if (!isRecord(requirement)) {
    errors.push(`${path} muss ein Objekt sein.`);
    return false;
  }

  if (typeof requirement.id !== 'string' || !requirement.id.trim()) {
    errors.push(`${path}.id fehlt oder ist leer.`);
  }
  if (typeof requirement.title !== 'string' || !requirement.title.trim()) {
    errors.push(`${path}.title fehlt oder ist leer.`);
  }
  if (typeof requirement.description !== 'string' || !requirement.description.trim()) {
    errors.push(`${path}.description fehlt oder ist leer.`);
  }
  if (typeof requirement.guidance !== 'string' || !requirement.guidance.trim()) {
    errors.push(`${path}.guidance fehlt oder ist leer.`);
  }

  if (typeof requirement.id === 'string') {
    if (baseRequirementIds.has(requirement.id)) {
      errors.push(`${path}.id "${requirement.id}" kollidiert mit einer Basisanforderung.`);
    }
    if (duplicateCheck.has(requirement.id)) {
      errors.push(`${path}.id "${requirement.id}" ist innerhalb des Moduls doppelt.`);
    }
    duplicateCheck.add(requirement.id);
  }

  return errors.length === startLength;
}

function validateActionTemplate(
  template: unknown,
  errors: string[],
  path: string,
  duplicateCheck: Set<string>,
): template is ActionTemplateDefinition {
  const startLength = errors.length;

  if (!isRecord(template)) {
    errors.push(`${path} muss ein Objekt sein.`);
    return false;
  }

  if (typeof template.id !== 'string' || !template.id.trim()) {
    errors.push(`${path}.id fehlt oder ist leer.`);
  }
  if (typeof template.title !== 'string' || !template.title.trim()) {
    errors.push(`${path}.title fehlt oder ist leer.`);
  }
  if (typeof template.description !== 'string' || !template.description.trim()) {
    errors.push(`${path}.description fehlt oder ist leer.`);
  }

  if (typeof template.id === 'string') {
    if (duplicateCheck.has(template.id)) {
      errors.push(`${path}.id "${template.id}" ist innerhalb der recommendedActions doppelt.`);
    }
    duplicateCheck.add(template.id);
  }

  if (
    template.priority !== undefined
    && !['kritisch', 'hoch', 'mittel', 'niedrig'].includes(String(template.priority))
  ) {
    errors.push(`${path}.priority muss kritisch, hoch, mittel oder niedrig sein.`);
  }

  if (template.folder !== undefined && (typeof template.folder !== 'string' || !template.folder.trim())) {
    errors.push(`${path}.folder muss ein nichtleerer String sein.`);
  }
  if (template.tags !== undefined) {
    validateStringArray(template.tags, errors, `${path}.tags`);
  }
  if (template.relatedQuestionIds !== undefined) {
    validateStringArray(template.relatedQuestionIds, errors, `${path}.relatedQuestionIds`);
  }
  if (template.relatedRequirementIds !== undefined) {
    validateStringArray(template.relatedRequirementIds, errors, `${path}.relatedRequirementIds`);
  }

  return errors.length === startLength;
}

function validateEvidenceTemplate(
  template: unknown,
  errors: string[],
  path: string,
  duplicateCheck: Set<string>,
): template is EvidenceTemplateDefinition {
  const startLength = errors.length;

  if (!isRecord(template)) {
    errors.push(`${path} muss ein Objekt sein.`);
    return false;
  }

  if (typeof template.id !== 'string' || !template.id.trim()) {
    errors.push(`${path}.id fehlt oder ist leer.`);
  }
  if (typeof template.title !== 'string' || !template.title.trim()) {
    errors.push(`${path}.title fehlt oder ist leer.`);
  }
  if (typeof template.type !== 'string' || !template.type.trim()) {
    errors.push(`${path}.type fehlt oder ist leer.`);
  }

  if (typeof template.id === 'string') {
    if (duplicateCheck.has(template.id)) {
      errors.push(`${path}.id "${template.id}" ist innerhalb der evidenceTemplates doppelt.`);
    }
    duplicateCheck.add(template.id);
  }

  if (
    typeof template.type === 'string'
    && !['policy', 'plan', 'report', 'test', 'training', 'contract', 'backup', 'other'].includes(template.type)
  ) {
    errors.push(`${path}.type ist nicht unterstützt.`);
  }

  if (template.folder !== undefined && (typeof template.folder !== 'string' || !template.folder.trim())) {
    errors.push(`${path}.folder muss ein nichtleerer String sein.`);
  }
  if (template.tags !== undefined) {
    validateStringArray(template.tags, errors, `${path}.tags`);
  }
  if (template.relatedQuestionIds !== undefined) {
    validateStringArray(template.relatedQuestionIds, errors, `${path}.relatedQuestionIds`);
  }
  if (template.relatedRequirementIds !== undefined) {
    validateStringArray(template.relatedRequirementIds, errors, `${path}.relatedRequirementIds`);
  }

  return errors.length === startLength;
}

function validateRoleTemplate(
  template: unknown,
  errors: string[],
  path: string,
  duplicateCheck: Set<string>,
): template is RoleTemplateDefinition {
  const startLength = errors.length;

  if (!isRecord(template)) {
    errors.push(`${path} muss ein Objekt sein.`);
    return false;
  }

  if (typeof template.id !== 'string' || !template.id.trim()) {
    errors.push(`${path}.id fehlt oder ist leer.`);
  }
  if (typeof template.label !== 'string' || !template.label.trim()) {
    errors.push(`${path}.label fehlt oder ist leer.`);
  }
  if (typeof template.responsibility !== 'string' || !template.responsibility.trim()) {
    errors.push(`${path}.responsibility fehlt oder ist leer.`);
  }

  if (typeof template.id === 'string') {
    if (baseRoleTemplateIds.has(template.id)) {
      errors.push(`${path}.id "${template.id}" kollidiert mit einer Basisrolle.`);
    }
    if (duplicateCheck.has(template.id)) {
      errors.push(`${path}.id "${template.id}" ist innerhalb der roleTemplates doppelt.`);
    }
    duplicateCheck.add(template.id);
  }

  if (template.focusAreas !== undefined) {
    validateStringArray(template.focusAreas, errors, `${path}.focusAreas`);
  }

  return errors.length === startLength;
}

function validateChecklistItem(
  item: unknown,
  errors: string[],
  path: string,
  duplicateCheck: Set<string>,
): item is AuditChecklistItemDefinition {
  const startLength = errors.length;

  if (!isRecord(item)) {
    errors.push(`${path} muss ein Objekt sein.`);
    return false;
  }

  const requiredStringFields = ['id', 'area', 'title', 'guidance'];
  for (const field of requiredStringFields) {
    if (typeof item[field] !== 'string' || !String(item[field]).trim()) {
      errors.push(`${path}.${field} fehlt oder ist leer.`);
    }
  }

  if (typeof item.id === 'string') {
    if (baseChecklistIds.has(item.id)) {
      errors.push(`${path}.id "${item.id}" kollidiert mit einem Basis-Prüfpunkt.`);
    }
    if (duplicateCheck.has(item.id)) {
      errors.push(`${path}.id "${item.id}" ist innerhalb der auditChecklist doppelt.`);
    }
    duplicateCheck.add(item.id);
  }

  if (
    item.severity !== undefined
    && !['high', 'medium', 'low'].includes(String(item.severity))
  ) {
    errors.push(`${path}.severity muss high, medium oder low sein.`);
  }

  if (item.relatedQuestionIds !== undefined) {
    validateStringArray(item.relatedQuestionIds, errors, `${path}.relatedQuestionIds`);
  }
  if (item.relatedRequirementIds !== undefined) {
    validateStringArray(item.relatedRequirementIds, errors, `${path}.relatedRequirementIds`);
  }

  return errors.length === startLength;
}

function validateProcessTemplate(
  template: unknown,
  errors: string[],
  path: string,
  duplicateCheck: Set<string>,
): template is BusinessProcessTemplateDefinition {
  const startLength = errors.length;

  if (!isRecord(template)) {
    errors.push(`${path} muss ein Objekt sein.`);
    return false;
  }

  if (typeof template.id !== 'string' || !template.id.trim()) {
    errors.push(`${path}.id fehlt oder ist leer.`);
  }
  if (typeof template.title !== 'string' || !template.title.trim()) {
    errors.push(`${path}.title fehlt oder ist leer.`);
  }

  if (typeof template.id === 'string') {
    if (duplicateCheck.has(template.id)) {
      errors.push(`${path}.id "${template.id}" ist innerhalb der processTemplates doppelt.`);
    }
    duplicateCheck.add(template.id);
  }

  if (template.criticality !== undefined && !['kritisch', 'hoch', 'mittel', 'niedrig'].includes(String(template.criticality))) {
    errors.push(`${path}.criticality muss kritisch, hoch, mittel oder niedrig sein.`);
  }

  return errors.length === startLength;
}

function validateDependencyTemplate(
  template: unknown,
  errors: string[],
  path: string,
  duplicateCheck: Set<string>,
): template is DependencyTemplateDefinition {
  const startLength = errors.length;

  if (!isRecord(template)) {
    errors.push(`${path} muss ein Objekt sein.`);
    return false;
  }

  if (typeof template.id !== 'string' || !template.id.trim()) {
    errors.push(`${path}.id fehlt oder ist leer.`);
  }
  if (typeof template.title !== 'string' || !template.title.trim()) {
    errors.push(`${path}.title fehlt oder ist leer.`);
  }
  if (typeof template.category !== 'string' || !template.category.trim()) {
    errors.push(`${path}.category fehlt oder ist leer.`);
  }

  if (typeof template.id === 'string') {
    if (duplicateCheck.has(template.id)) {
      errors.push(`${path}.id "${template.id}" ist innerhalb der dependencyTemplates doppelt.`);
    }
    duplicateCheck.add(template.id);
  }

  if (template.criticality !== undefined && !['kritisch', 'hoch', 'mittel', 'niedrig'].includes(String(template.criticality))) {
    errors.push(`${path}.criticality muss kritisch, hoch, mittel oder niedrig sein.`);
  }

  return errors.length === startLength;
}

function validateScenarioTemplate(
  template: unknown,
  errors: string[],
  path: string,
  duplicateCheck: Set<string>,
): template is ScenarioTemplateDefinition {
  const startLength = errors.length;

  if (!isRecord(template)) {
    errors.push(`${path} muss ein Objekt sein.`);
    return false;
  }

  const requiredFields = ['id', 'title', 'category', 'description'];
  for (const field of requiredFields) {
    if (typeof template[field] !== 'string' || !String(template[field]).trim()) {
      errors.push(`${path}.${field} fehlt oder ist leer.`);
    }
  }

  if (typeof template.id === 'string') {
    if (duplicateCheck.has(template.id)) {
      errors.push(`${path}.id "${template.id}" ist innerhalb der scenarioTemplates doppelt.`);
    }
    duplicateCheck.add(template.id);
  }

  if (template.likelihood !== undefined && (typeof template.likelihood !== 'number' || template.likelihood < 1 || template.likelihood > 5)) {
    errors.push(`${path}.likelihood muss zwischen 1 und 5 liegen.`);
  }
  if (template.impact !== undefined && (typeof template.impact !== 'number' || template.impact < 1 || template.impact > 5)) {
    errors.push(`${path}.impact muss zwischen 1 und 5 liegen.`);
  }
  if (template.linkedProcessTemplateIds !== undefined) {
    validateStringArray(template.linkedProcessTemplateIds, errors, `${path}.linkedProcessTemplateIds`);
  }
  if (template.linkedDependencyTemplateIds !== undefined) {
    validateStringArray(template.linkedDependencyTemplateIds, errors, `${path}.linkedDependencyTemplateIds`);
  }
  if (template.exerciseTypeHint !== undefined && !['tabletop', 'simulation', 'technical', 'alarm', 'supplier'].includes(String(template.exerciseTypeHint))) {
    errors.push(`${path}.exerciseTypeHint ist nicht unterstützt.`);
  }

  return errors.length === startLength;
}

function validateExerciseTemplate(
  template: unknown,
  errors: string[],
  path: string,
  duplicateCheck: Set<string>,
): template is ExerciseTemplateDefinition {
  const startLength = errors.length;

  if (!isRecord(template)) {
    errors.push(`${path} muss ein Objekt sein.`);
    return false;
  }

  if (typeof template.id !== 'string' || !template.id.trim()) {
    errors.push(`${path}.id fehlt oder ist leer.`);
  }
  if (typeof template.title !== 'string' || !template.title.trim()) {
    errors.push(`${path}.title fehlt oder ist leer.`);
  }

  if (typeof template.id === 'string') {
    if (duplicateCheck.has(template.id)) {
      errors.push(`${path}.id "${template.id}" ist innerhalb der exerciseTemplates doppelt.`);
    }
    duplicateCheck.add(template.id);
  }

  if (template.exerciseType !== undefined && !['tabletop', 'simulation', 'technical', 'alarm', 'supplier'].includes(String(template.exerciseType))) {
    errors.push(`${path}.exerciseType ist nicht unterstützt.`);
  }
  if (template.cadenceMonths !== undefined && (typeof template.cadenceMonths !== 'number' || template.cadenceMonths < 1 || template.cadenceMonths > 36)) {
    errors.push(`${path}.cadenceMonths muss zwischen 1 und 36 liegen.`);
  }

  return errors.length === startLength;
}

function validateMaturityProfile(
  input: unknown,
  errors: string[],
): input is MaturityProfileDefinition {
  if (!isRecord(input)) {
    errors.push('maturityProfile muss ein Objekt sein.');
    return false;
  }

  if (input.targetOverall !== undefined) {
    if (typeof input.targetOverall !== 'number' || input.targetOverall < 0 || input.targetOverall > 100) {
      errors.push('maturityProfile.targetOverall muss zwischen 0 und 100 liegen.');
    }
  }

  if (input.targetByDomain !== undefined) {
    if (!isRecord(input.targetByDomain)) {
      errors.push('maturityProfile.targetByDomain muss ein Objekt sein.');
    } else {
      for (const [domainId, value] of Object.entries(input.targetByDomain)) {
        if (!validDomainIds.has(domainId)) {
          errors.push(`maturityProfile.targetByDomain enthält unbekannte Domain "${domainId}".`);
        }
        if (typeof value !== 'number' || value < 0 || value > 100) {
          errors.push(`maturityProfile.targetByDomain für "${domainId}" muss zwischen 0 und 100 liegen.`);
        }
      }
    }
  }

  if (input.notes !== undefined) {
    validateStringArray(input.notes, errors, 'maturityProfile.notes');
  }

  return !errors.length;
}

export function validateModuleObject(input: unknown): ModuleValidationResult {
  const errors: string[] = [];
  const duplicateQuestions = new Set<string>();
  const duplicateRequirements = new Set<string>();
  const duplicateActions = new Set<string>();
  const duplicateEvidence = new Set<string>();
  const duplicateRoles = new Set<string>();
  const duplicateChecklistItems = new Set<string>();
  const duplicateProcesses = new Set<string>();
  const duplicateDependencies = new Set<string>();
  const duplicateScenarios = new Set<string>();
  const duplicateExercises = new Set<string>();

  if (!isRecord(input)) {
    return {
      valid: false,
      errors: ['Die JSON-Datei muss ein Objekt auf oberster Ebene enthalten.'],
    };
  }

  const requiredStringFields = ['id', 'name', 'version', 'description'];
  for (const field of requiredStringFields) {
    if (typeof input[field] !== 'string' || !String(input[field]).trim()) {
      errors.push(`Feld "${field}" fehlt oder ist leer.`);
    }
  }

  if (typeof input.schemaVersion !== 'number' || input.schemaVersion !== 1) {
    errors.push('schemaVersion muss aktuell den Wert 1 haben.');
  }

  if (input.domainWeightAdjustments !== undefined) {
    if (!isRecord(input.domainWeightAdjustments)) {
      errors.push('domainWeightAdjustments muss ein Objekt sein.');
    } else {
      for (const [domainId, weight] of Object.entries(input.domainWeightAdjustments)) {
        if (!validDomainIds.has(domainId)) {
          errors.push(`domainWeightAdjustments enthält unbekannte Domain "${domainId}".`);
        }
        if (typeof weight !== 'number' || Number.isNaN(weight) || weight <= 0) {
          errors.push(`Gewicht für Domain "${domainId}" muss eine Zahl größer 0 sein.`);
        }
      }
    }
  }

  if (input.additionalQuestions !== undefined) {
    if (!Array.isArray(input.additionalQuestions)) {
      errors.push('additionalQuestions muss ein Array sein.');
    } else {
      input.additionalQuestions.forEach((question, index) => {
        validateQuestion(question, errors, `additionalQuestions[${index}]`, duplicateQuestions);
      });
    }
  }

  if (input.recommendedActions !== undefined) {
    if (!Array.isArray(input.recommendedActions)) {
      errors.push('recommendedActions muss ein Array sein.');
    } else {
      input.recommendedActions.forEach((template, index) => {
        validateActionTemplate(template, errors, `recommendedActions[${index}]`, duplicateActions);
      });
    }
  }

  if (input.evidenceTemplates !== undefined) {
    if (!Array.isArray(input.evidenceTemplates)) {
      errors.push('evidenceTemplates muss ein Array sein.');
    } else {
      input.evidenceTemplates.forEach((template, index) => {
        validateEvidenceTemplate(template, errors, `evidenceTemplates[${index}]`, duplicateEvidence);
      });
    }
  }

  if (input.roleTemplates !== undefined) {
    if (!Array.isArray(input.roleTemplates)) {
      errors.push('roleTemplates muss ein Array sein.');
    } else {
      input.roleTemplates.forEach((template, index) => {
        validateRoleTemplate(template, errors, `roleTemplates[${index}]`, duplicateRoles);
      });
    }
  }

  if (input.auditChecklist !== undefined) {
    if (!Array.isArray(input.auditChecklist)) {
      errors.push('auditChecklist muss ein Array sein.');
    } else {
      input.auditChecklist.forEach((item, index) => {
        validateChecklistItem(item, errors, `auditChecklist[${index}]`, duplicateChecklistItems);
      });
    }
  }

  if (input.processTemplates !== undefined) {
    if (!Array.isArray(input.processTemplates)) {
      errors.push('processTemplates muss ein Array sein.');
    } else {
      input.processTemplates.forEach((template, index) => {
        validateProcessTemplate(template, errors, `processTemplates[${index}]`, duplicateProcesses);
      });
    }
  }

  if (input.dependencyTemplates !== undefined) {
    if (!Array.isArray(input.dependencyTemplates)) {
      errors.push('dependencyTemplates muss ein Array sein.');
    } else {
      input.dependencyTemplates.forEach((template, index) => {
        validateDependencyTemplate(template, errors, `dependencyTemplates[${index}]`, duplicateDependencies);
      });
    }
  }

  if (input.scenarioTemplates !== undefined) {
    if (!Array.isArray(input.scenarioTemplates)) {
      errors.push('scenarioTemplates muss ein Array sein.');
    } else {
      input.scenarioTemplates.forEach((template, index) => {
        validateScenarioTemplate(template, errors, `scenarioTemplates[${index}]`, duplicateScenarios);
      });
    }
  }

  if (input.exerciseTemplates !== undefined) {
    if (!Array.isArray(input.exerciseTemplates)) {
      errors.push('exerciseTemplates muss ein Array sein.');
    } else {
      input.exerciseTemplates.forEach((template, index) => {
        validateExerciseTemplate(template, errors, `exerciseTemplates[${index}]`, duplicateExercises);
      });
    }
  }

  if (input.maturityProfile !== undefined) {
    validateMaturityProfile(input.maturityProfile, errors);
  }

  if (input.uiHints !== undefined) {
    if (!isRecord(input.uiHints)) {
      errors.push('uiHints muss ein Objekt sein.');
    } else if (input.uiHints.focusAreas !== undefined) {
      validateStringArray(input.uiHints.focusAreas, errors, 'uiHints.focusAreas');
    }
  }

  if (input.kritisExtension !== undefined) {
    if (!isRecord(input.kritisExtension)) {
      errors.push('kritisExtension muss ein Objekt sein.');
    } else {
      const extension = input.kritisExtension;
      if (extension.eligibleSectors !== undefined) {
        validateStringArray(extension.eligibleSectors, errors, 'kritisExtension.eligibleSectors');
      }
      if (extension.hints !== undefined) {
        validateStringArray(extension.hints, errors, 'kritisExtension.hints');
      }
      if (extension.additionalRequirements !== undefined) {
        if (!Array.isArray(extension.additionalRequirements)) {
          errors.push('kritisExtension.additionalRequirements muss ein Array sein.');
        } else {
          extension.additionalRequirements.forEach((requirement, index) => {
            validateRequirement(
              requirement,
              errors,
              `kritisExtension.additionalRequirements[${index}]`,
              duplicateRequirements,
            );
          });
        }
      }
    }
  }

  if (errors.length) {
    return { valid: false, errors };
  }

  const module = input as unknown as SectorModuleDefinition;
  return {
    valid: true,
    errors: [],
    module,
    packType: 'module',
    format: 'legacy',
    manifest: buildSyntheticManifestFromModule(module),
  };
}

export function parseAndValidateModule(jsonText: string): ModuleValidationResult {
  try {
    const parsed = JSON.parse(jsonText);
    const container = normalizeModuleContainer(parsed);
    if (container) {
      const errors: string[] = [];
      validateModulePackManifest(container.manifest, errors);
      if (container.containerVersion !== 1) {
        errors.push('containerVersion muss aktuell den Wert 1 haben.');
      }

      if (container.manifest.packType === 'overlay') {
        if (!container.targetModuleId) {
          errors.push('targetModuleId fehlt oder ist leer.');
        }
        if (container.manifest.moduleId && container.manifest.moduleId !== sanitizeString((container.module as ModuleOverlayDefinition)?.id)) {
          errors.push('manifest.moduleId und module.id müssen bei Overlay-Paketen übereinstimmen.');
        }
        errors.push(...validateOverlayObject(container.module));
        if (errors.length) {
          return {
            valid: false,
            errors,
            packType: 'overlay',
            format: 'container',
            targetModuleId: container.targetModuleId,
            containerVersion: container.containerVersion,
            manifest: container.manifest,
          };
        }
        return {
          valid: true,
          errors: [],
          packType: 'overlay',
          format: 'container',
          targetModuleId: container.targetModuleId,
          containerVersion: container.containerVersion,
          manifest: container.manifest,
        };
      }

      const moduleValidation = validateModuleObject(container.module);
      if (!moduleValidation.valid || !moduleValidation.module) {
        return {
          ...moduleValidation,
          packType: 'module',
          format: 'container',
          containerVersion: container.containerVersion,
          manifest: container.manifest,
        };
      }
      if (container.manifest.moduleId && container.manifest.moduleId !== moduleValidation.module.id) {
        return {
          valid: false,
          errors: ['manifest.moduleId und module.id müssen übereinstimmen.'],
          packType: 'module',
          format: 'container',
          containerVersion: container.containerVersion,
          manifest: container.manifest,
        };
      }
      return {
        ...moduleValidation,
        packType: 'module',
        format: 'container',
        containerVersion: container.containerVersion,
        manifest: container.manifest,
      };
    }

    const legacyOverlayTarget = isRecord(parsed) ? sanitizeString(parsed.targetModuleId) : '';
    const legacyPackType = isRecord(parsed) && sanitizeString(parsed.packType) === 'overlay' ? 'overlay' : 'module';
    if (legacyPackType === 'overlay') {
      const overlayModule = isRecord(parsed) ? parsed.module : undefined;
      const errors: string[] = [];
      if (!legacyOverlayTarget) {
        errors.push('targetModuleId fehlt oder ist leer.');
      }
      if (!isLikelyOverlayPayload(overlayModule)) {
        errors.push('module fehlt oder ist leer.');
      } else {
        errors.push(...validateOverlayObject(overlayModule));
      }
      return {
        valid: errors.length === 0,
        errors,
        packType: 'overlay',
        format: 'legacy',
        targetModuleId: legacyOverlayTarget,
        manifest: isLikelyOverlayPayload(overlayModule)
          ? {
              packId: `legacy-overlay-${sanitizeString(overlayModule.id)}`,
              packType: 'overlay',
              moduleId: sanitizeString(overlayModule.id),
              name: sanitizeString(overlayModule.name) || sanitizeString(overlayModule.id),
              version: sanitizeString(overlayModule.version),
              description: sanitizeString(overlayModule.description) || 'Legacy-Overlay',
              engine: MODULE_ENGINE_ID,
              engineVersion: MODULE_ENGINE_VERSION,
              releaseChannel: 'overlay',
            }
          : undefined,
      };
    }

    return validateModuleObject(parsed);
  } catch (error) {
    return {
      valid: false,
      errors: [
        error instanceof Error
          ? `Ungültiges JSON: ${error.message}`
          : 'Ungültiges JSON.',
      ],
    };
  }
}

function mergeById<T extends { id: string }>(baseValues?: T[], overlayValues?: T[]): T[] {
  const map = new Map<string, T>();
  (baseValues ?? []).forEach((entry) => {
    if (entry?.id) {
      map.set(entry.id, entry);
    }
  });
  (overlayValues ?? []).forEach((entry) => {
    if (entry?.id) {
      map.set(entry.id, entry);
    }
  });
  return [...map.values()];
}

function mergeStringLists(baseValues?: string[], overlayValues?: string[]): string[] {
  const seen = new Set<string>();
  return [...(baseValues ?? []), ...(overlayValues ?? [])]
    .map((entry) => String(entry || '').trim())
    .filter((entry) => entry.length > 0 && !seen.has(entry) && seen.add(entry));
}

export function applyModuleOverlay(
  baseModule: SectorModuleDefinition,
  overlay: ModuleOverlayDefinition,
  targetModuleId: string,
): SectorModuleDefinition {
  return {
    ...baseModule,
    id: targetModuleId || baseModule.id,
    name: overlay.name || baseModule.name,
    description: overlay.description || baseModule.description,
    sectorCategory: overlay.sectorCategory || baseModule.sectorCategory,
    version: overlay.version ? `${baseModule.version}+overlay.${overlay.version}` : baseModule.version,
    schemaVersion: overlay.schemaVersion ?? baseModule.schemaVersion,
    domainWeightAdjustments: {
      ...(baseModule.domainWeightAdjustments ?? {}),
      ...(overlay.domainWeightAdjustments ?? {}),
    },
    additionalQuestions: mergeById(baseModule.additionalQuestions, overlay.additionalQuestions),
    recommendedActions: mergeById(baseModule.recommendedActions, overlay.recommendedActions),
    evidenceTemplates: mergeById(baseModule.evidenceTemplates, overlay.evidenceTemplates),
    documentFolders: mergeStringLists(baseModule.documentFolders, overlay.documentFolders),
    roleTemplates: mergeById(baseModule.roleTemplates, overlay.roleTemplates),
    maturityProfile: overlay.maturityProfile
      ? {
          ...(baseModule.maturityProfile ?? {}),
          ...overlay.maturityProfile,
          targetByDomain: {
            ...(baseModule.maturityProfile?.targetByDomain ?? {}),
            ...(overlay.maturityProfile?.targetByDomain ?? {}),
          },
        }
      : baseModule.maturityProfile,
    auditChecklist: mergeById(baseModule.auditChecklist, overlay.auditChecklist),
    processTemplates: mergeById(baseModule.processTemplates, overlay.processTemplates),
    dependencyTemplates: mergeById(baseModule.dependencyTemplates, overlay.dependencyTemplates),
    scenarioTemplates: mergeById(baseModule.scenarioTemplates, overlay.scenarioTemplates),
    exerciseTemplates: mergeById(baseModule.exerciseTemplates, overlay.exerciseTemplates),
    uiHints: {
      ...(baseModule.uiHints ?? {}),
      ...(overlay.uiHints ?? {}),
      focusAreas: mergeStringLists(baseModule.uiHints?.focusAreas, overlay.uiHints?.focusAreas),
    },
    kritisExtension: {
      ...(baseModule.kritisExtension ?? {}),
      ...(overlay.kritisExtension ?? {}),
      eligibleSectors: mergeStringLists(baseModule.kritisExtension?.eligibleSectors, overlay.kritisExtension?.eligibleSectors),
      hints: mergeStringLists(baseModule.kritisExtension?.hints, overlay.kritisExtension?.hints),
      additionalRequirements: mergeById(
        baseModule.kritisExtension?.additionalRequirements,
        overlay.kritisExtension?.additionalRequirements,
      ),
    },
  };
}

export function buildEffectiveModuleCatalog(
  uploadedModules: SectorModuleDefinition[],
  registryEntries: ModulePackRegistryEntry[],
): SectorModuleDefinition[] {
  const catalog = new Map<string, SectorModuleDefinition>();

  builtInModules.forEach((module) => {
    catalog.set(module.id, module);
  });

  uploadedModules.forEach((module) => {
    catalog.set(module.id, module);
  });

  const releasedEntries = registryEntries
    .filter((entry) => entry.status === 'released')
    .sort((left, right) => String(left.releasedAt || left.uploadedAt).localeCompare(String(right.releasedAt || right.uploadedAt)));

  releasedEntries
    .filter((entry) => entry.packType === 'module')
    .forEach((entry) => {
      const module = entry.module as SectorModuleDefinition;
      if (module?.id) {
        catalog.set(module.id, module);
      }
    });

  releasedEntries
    .filter((entry) => entry.packType === 'overlay')
    .forEach((entry) => {
      const targetId = entry.targetModuleId || entry.moduleId;
      const current = catalog.get(targetId);
      const overlay = entry.module as ModuleOverlayDefinition;
      if (current && overlay?.id) {
        catalog.set(targetId, applyModuleOverlay(current, overlay, targetId));
      }
    });

  return [...catalog.values()];
}

export function getModuleByIdFromCatalog(
  moduleId: string,
  catalog: SectorModuleDefinition[],
): SectorModuleDefinition | undefined {
  return catalog.find((module) => module.id === moduleId);
}
