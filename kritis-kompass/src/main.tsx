import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { assessKritisApplicability } from './lib/scoring';
import { loadModulePack, MODULE_PACK_IDS } from './lib/loadModulePack';
import type { CompanyProfile } from './types';
import './index.css';

// Smoke-Test-Hooks: in der DevTools-Konsole verfuegbar.
// In Phase 6 wieder entfernen, sobald die Views echte Aufrufer sind.
declare global {
  interface Window {
    testApplicability: typeof assessKritisApplicability;
    testLoadModulePack: typeof loadModulePack;
    testModulePackIds: typeof MODULE_PACK_IDS;
    testDummyProfile: CompanyProfile;
  }
}

const dummyProfile: CompanyProfile = {
  companyName: 'Demo-Stadtwerke',
  industryLabel: 'Energie',
  locations: '2',
  employees: '450',
  criticalService: 'Stromversorgung Mittelspannung',
  personsServed: '600000',
};

window.testApplicability = assessKritisApplicability;
window.testLoadModulePack = loadModulePack;
window.testModulePackIds = MODULE_PACK_IDS;
window.testDummyProfile = dummyProfile;

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root-Element #root nicht gefunden.');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
