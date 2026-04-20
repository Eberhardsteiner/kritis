import type { Scenario } from '../types';
import { parseScenario } from '../schema';
import cyberEnergy from './cyber-energy-2026.json';
import floodCascade from './flood-cascade-2026.json';
import supplyChainLogistics from './supply-chain-logistics-2026.json';

/**
 * Drei startfertige Szenarien nach § 18 KRITISDachG. Jedes Szenario wird
 * beim Import durch das Zod-Schema validiert; bei Inkonsistenz wirft der
 * Aufruf sofort (vor dem App-Start sichtbar, nicht erst zur Laufzeit).
 */

export const builtInScenarios: Scenario[] = [
  parseScenario(cyberEnergy),
  parseScenario(floodCascade),
  parseScenario(supplyChainLogistics),
];

export function getBuiltInScenarioById(scenarioId: string): Scenario | undefined {
  return builtInScenarios.find((scenario) => scenario.id === scenarioId);
}
