import { useEffect, useMemo, useState } from 'react';
import { Download, Save } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { AssessmentView } from './views/AssessmentView';
import { DashboardView } from './views/DashboardView';
import { KritisView } from './views/KritisView';
import { ModulesView } from './views/ModulesView';
import { exportAssessmentAsJson } from './lib/exporters';
import {
  builtInModules,
  getKritisRequirementsForModule,
  getModuleById,
  getQuestionsForModule,
  parseAndValidateModule,
} from './lib/moduleRegistry';
import {
  assessKritisApplicability,
  computeScoreSnapshot,
  getRequirementProgress,
} from './lib/scoring';
import { loadState, saveState } from './lib/storage';
import type { AppState, CompanyProfile, RequirementStatus, SectorModuleDefinition } from './types';

interface ImportFeedback {
  type: 'success' | 'error';
  text: string;
  details?: string[];
}

const defaultCompanyProfile: CompanyProfile = {
  companyName: '',
  industryLabel: '',
  locations: '',
  employees: '',
  criticalService: '',
  personsServed: '',
};

function createInitialState(): AppState {
  const loaded = loadState();

  return {
    activeView: loaded?.activeView ?? 'dashboard',
    selectedModuleId: loaded?.selectedModuleId ?? builtInModules[0].id,
    uploadedModules: loaded?.uploadedModules ?? [],
    answers: loaded?.answers ?? {},
    requirementStates: loaded?.requirementStates ?? {},
    companyProfile: {
      ...defaultCompanyProfile,
      ...(loaded?.companyProfile ?? {}),
    },
  };
}

export default function App() {
  const [state, setState] = useState<AppState>(createInitialState);
  const [feedback, setFeedback] = useState<ImportFeedback | null>(null);

  const currentModule = useMemo(
    () => getModuleById(state.selectedModuleId, state.uploadedModules) ?? builtInModules[0],
    [state.selectedModuleId, state.uploadedModules],
  );

  const questions = useMemo(
    () => getQuestionsForModule(currentModule),
    [currentModule],
  );

  const scoreSnapshot = useMemo(
    () => computeScoreSnapshot(questions, state.answers, currentModule),
    [questions, state.answers, currentModule],
  );

  const requirements = useMemo(
    () => getKritisRequirementsForModule(currentModule),
    [currentModule],
  );

  const requirementProgress = useMemo(
    () => getRequirementProgress(requirements, state.requirementStates),
    [requirements, state.requirementStates],
  );

  const kritisApplicability = useMemo(
    () => assessKritisApplicability(state.companyProfile, currentModule),
    [state.companyProfile, currentModule],
  );

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    if (!getModuleById(state.selectedModuleId, state.uploadedModules)) {
      setState((current) => ({
        ...current,
        selectedModuleId: builtInModules[0].id,
      }));
    }
  }, [state.selectedModuleId, state.uploadedModules]);

  function setActiveView(activeView: AppState['activeView']) {
    setState((current) => ({ ...current, activeView }));
  }

  function updateProfileField(field: keyof CompanyProfile, value: string) {
    setState((current) => ({
      ...current,
      companyProfile: {
        ...current.companyProfile,
        [field]: value,
      },
    }));
  }

  function selectModule(moduleId: string) {
    setState((current) => {
      const module = getModuleById(moduleId, current.uploadedModules) ?? builtInModules[0];
      const shouldPrefillIndustry = !current.companyProfile.industryLabel.trim();

      return {
        ...current,
        selectedModuleId: moduleId,
        companyProfile: shouldPrefillIndustry
          ? {
              ...current.companyProfile,
              industryLabel: module.sectorCategory ?? module.name,
            }
          : current.companyProfile,
      };
    });
  }

  function handleScoreChange(questionId: string, score: number | null) {
    setState((current) => ({
      ...current,
      answers: {
        ...current.answers,
        [questionId]: {
          score: score as 0 | 1 | 2 | 3 | 4 | null,
          note: current.answers[questionId]?.note ?? '',
        },
      },
    }));
  }

  function handleNoteChange(questionId: string, note: string) {
    setState((current) => ({
      ...current,
      answers: {
        ...current.answers,
        [questionId]: {
          score: current.answers[questionId]?.score ?? null,
          note,
        },
      },
    }));
  }

  function handleRequirementChange(requirementId: string, status: RequirementStatus) {
    setState((current) => ({
      ...current,
      requirementStates: {
        ...current.requirementStates,
        [requirementId]: status,
      },
    }));
  }

  async function handleImportFiles(files: FileList | null) {
    if (!files?.length) {
      return;
    }

    const file = files[0];
    const jsonText = await file.text();
    const result = parseAndValidateModule(jsonText);

    if (!result.valid || !result.module) {
      setFeedback({
        type: 'error',
        text: `Das Modul "${file.name}" konnte nicht importiert werden.`,
        details: result.errors,
      });
      return;
    }

    if (builtInModules.some((module) => module.id === result.module?.id)) {
      setFeedback({
        type: 'error',
        text: `Die ID "${result.module.id}" ist bereits durch ein integriertes Modul belegt.`,
      });
      return;
    }

    setState((current) => {
      const uploadedModules = [
        ...current.uploadedModules.filter((module) => module.id !== result.module?.id),
        result.module as SectorModuleDefinition,
      ];

      return {
        ...current,
        uploadedModules,
        selectedModuleId: result.module?.id ?? current.selectedModuleId,
        activeView: 'modules',
      };
    });

    setFeedback({
      type: 'success',
      text: `Modul "${result.module.name}" wurde importiert oder aktualisiert und als aktives Profil gewählt.`,
    });
  }

  function handleExport() {
    exportAssessmentAsJson({
      companyProfile: state.companyProfile,
      module: currentModule,
      scoreSnapshot,
      answers: state.answers,
      requirementStates: state.requirementStates,
    });
  }

  return (
    <div className="app-shell">
      <Sidebar activeView={state.activeView} onChange={setActiveView} />

      <div className="main-shell">
        <header className="topbar card">
          <div className="topbar-head">
            <div>
              <p className="eyebrow">Projektsteuerung</p>
              <h2>Unternehmensprofil und aktives Branchenmodul</h2>
            </div>
            <div className="topbar-actions">
              <div className="inline-note">
                <Save size={16} />
                <span>Automatisch lokal gespeichert</span>
              </div>
              <button type="button" className="button secondary" onClick={handleExport}>
                <Download size={16} />
                JSON exportieren
              </button>
            </div>
          </div>

          <div className="profile-grid">
            <label className="field-label">
              Unternehmen
              <input
                type="text"
                placeholder="z. B. Musterwerke GmbH"
                value={state.companyProfile.companyName}
                onChange={(event) => updateProfileField('companyName', event.target.value)}
              />
            </label>
            <label className="field-label">
              Branche / Segment
              <input
                type="text"
                placeholder="z. B. Krankenhaus, Produktion, Energie"
                value={state.companyProfile.industryLabel}
                onChange={(event) => updateProfileField('industryLabel', event.target.value)}
              />
            </label>
            <label className="field-label">
              Aktives Modul
              <select
                value={state.selectedModuleId}
                onChange={(event) => selectModule(event.target.value)}
              >
                {[...builtInModules, ...state.uploadedModules].map((module) => (
                  <option key={module.id} value={module.id}>
                    {module.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-label">
              Mitarbeitende
              <input
                type="text"
                placeholder="z. B. 850"
                value={state.companyProfile.employees}
                onChange={(event) => updateProfileField('employees', event.target.value)}
              />
            </label>
            <label className="field-label">
              Standorte / Werke
              <input
                type="text"
                placeholder="z. B. 3 Standorte, 1 Rechenzentrum"
                value={state.companyProfile.locations}
                onChange={(event) => updateProfileField('locations', event.target.value)}
              />
            </label>
            <label className="field-label wide">
              Kritische Dienstleistung / Versorgung
              <input
                type="text"
                placeholder="z. B. Notfallversorgung, Stromverteilung, Trinkwasserversorgung"
                value={state.companyProfile.criticalService}
                onChange={(event) => updateProfileField('criticalService', event.target.value)}
              />
            </label>
            <label className="field-label">
              Versorgte Personen
              <input
                type="text"
                placeholder="z. B. 500000"
                value={state.companyProfile.personsServed}
                onChange={(event) => updateProfileField('personsServed', event.target.value)}
              />
            </label>
          </div>
        </header>

        <main className="content-shell">
          {state.activeView === 'dashboard' ? (
            <DashboardView
              companyName={state.companyProfile.companyName}
              module={currentModule}
              scoreSnapshot={scoreSnapshot}
              requirementScore={requirementProgress.score}
              applicability={kritisApplicability}
              onGoToAssessment={() => setActiveView('assessment')}
              onGoToKritis={() => setActiveView('kritis')}
            />
          ) : null}

          {state.activeView === 'assessment' ? (
            <AssessmentView
              questions={questions}
              answers={state.answers}
              domainScores={scoreSnapshot.domainScores}
              onScoreChange={handleScoreChange}
              onNoteChange={handleNoteChange}
            />
          ) : null}

          {state.activeView === 'modules' ? (
            <ModulesView
              builtInModules={builtInModules}
              uploadedModules={state.uploadedModules}
              selectedModuleId={state.selectedModuleId}
              onSelectModule={selectModule}
              onImportFiles={handleImportFiles}
              feedback={feedback}
            />
          ) : null}

          {state.activeView === 'kritis' ? (
            <KritisView
              applicability={kritisApplicability}
              requirements={requirements}
              requirementStates={state.requirementStates}
              module={currentModule}
              onChangeStatus={handleRequirementChange}
            />
          ) : null}
        </main>
      </div>
    </div>
  );
}
