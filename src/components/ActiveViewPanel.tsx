import { Suspense, lazy, type ComponentProps } from 'react';
import type { ViewKey } from '../types';
import type * as AssessmentViewModule from '../features/assessment/views/AssessmentView';
import type * as ControlViewModule from '../views/ControlView';
import type * as DashboardViewModule from '../views/DashboardView';
import type * as GovernanceViewModule from '../features/governance/views/GovernanceView';
import type * as KritisViewModule from '../views/KritisView';
import type * as MeasuresViewModule from '../features/measures/views/MeasuresView';
import type * as ModulesViewModule from '../views/ModulesView';
import type * as OperationsViewModule from '../views/OperationsView';
import type * as PlatformViewModule from '../features/platform/views/PlatformView';
import type * as ProgramViewModule from '../views/ProgramView';
import type * as ReportViewModule from '../views/ReportView';
import type * as ResilienceViewModule from '../features/operations/views/ResilienceView';
import type * as ResiliencePlanViewModule from '../views/ResiliencePlanView';
import type * as RolloutViewModule from '../views/RolloutView';
import type * as TabletopExerciseViewModule from '../views/TabletopExerciseView';

const AssessmentView = lazy(async () => ({ default: (await import('../features/assessment')).AssessmentView }));
const ControlView = lazy(async () => ({ default: (await import('../views/ControlView')).ControlView }));
const DashboardView = lazy(async () => ({ default: (await import('../views/DashboardView')).DashboardView }));
const GovernanceView = lazy(async () => ({ default: (await import('../features/governance')).GovernanceView }));
const KritisView = lazy(async () => ({ default: (await import('../views/KritisView')).KritisView }));
const MeasuresView = lazy(async () => ({ default: (await import('../features/measures')).MeasuresView }));
const ModulesView = lazy(async () => ({ default: (await import('../views/ModulesView')).ModulesView }));
const OperationsView = lazy(async () => ({ default: (await import('../views/OperationsView')).OperationsView }));
const PlatformView = lazy(async () => ({ default: (await import('../features/platform')).PlatformView }));
const ProgramView = lazy(async () => ({ default: (await import('../views/ProgramView')).ProgramView }));
const ReportView = lazy(async () => ({ default: (await import('../views/ReportView')).ReportView }));
const ResilienceView = lazy(async () => ({ default: (await import('../features/operations')).ResilienceView }));
const ResiliencePlanView = lazy(async () => ({ default: (await import('../views/ResiliencePlanView')).ResiliencePlanView }));
const RolloutView = lazy(async () => ({ default: (await import('../views/RolloutView')).RolloutView }));
const TabletopExerciseView = lazy(async () => ({ default: (await import('../views/TabletopExerciseView')).TabletopExerciseView }));

export type AssessmentViewProps = ComponentProps<typeof AssessmentViewModule.AssessmentView>;
export type ControlViewProps = ComponentProps<typeof ControlViewModule.ControlView>;
export type DashboardViewProps = ComponentProps<typeof DashboardViewModule.DashboardView>;
export type GovernanceViewProps = ComponentProps<typeof GovernanceViewModule.GovernanceView>;
export type KritisViewProps = ComponentProps<typeof KritisViewModule.KritisView>;
export type MeasuresViewProps = ComponentProps<typeof MeasuresViewModule.MeasuresView>;
export type ModulesViewProps = ComponentProps<typeof ModulesViewModule.ModulesView>;
export type OperationsViewProps = ComponentProps<typeof OperationsViewModule.OperationsView>;
export type PlatformViewProps = ComponentProps<typeof PlatformViewModule.PlatformView>;
export type ProgramViewProps = ComponentProps<typeof ProgramViewModule.ProgramView>;
export type ReportViewProps = ComponentProps<typeof ReportViewModule.ReportView>;
export type ResilienceViewProps = ComponentProps<typeof ResilienceViewModule.ResilienceView>;
export type ResiliencePlanViewProps = ComponentProps<typeof ResiliencePlanViewModule.ResiliencePlanView>;
export type RolloutViewProps = ComponentProps<typeof RolloutViewModule.RolloutView>;
export type TabletopExerciseViewProps = ComponentProps<typeof TabletopExerciseViewModule.TabletopExerciseView>;

export interface ActiveViewPanelProps {
  activeView: ViewKey;
  readOnlyHint: string;
  programViewProps: ProgramViewProps;
  dashboardViewProps: DashboardViewProps;
  assessmentViewProps: AssessmentViewProps;
  measuresViewProps: MeasuresViewProps;
  governanceViewProps: GovernanceViewProps;
  resilienceViewProps: ResilienceViewProps;
  resiliencePlanViewProps: ResiliencePlanViewProps;
  tabletopExerciseViewProps: TabletopExerciseViewProps;
  controlViewProps: ControlViewProps;
  platformViewProps: PlatformViewProps;
  operationsViewProps: OperationsViewProps;
  rolloutViewProps: RolloutViewProps;
  modulesViewProps: ModulesViewProps;
  kritisViewProps: KritisViewProps;
  reportViewProps: ReportViewProps;
}

export function ActiveViewPanel({
  activeView,
  readOnlyHint,
  programViewProps,
  dashboardViewProps,
  assessmentViewProps,
  measuresViewProps,
  governanceViewProps,
  resilienceViewProps,
  resiliencePlanViewProps,
  tabletopExerciseViewProps,
  controlViewProps,
  platformViewProps,
  operationsViewProps,
  rolloutViewProps,
  modulesViewProps,
  kritisViewProps,
  reportViewProps,
}: ActiveViewPanelProps) {
  return (
    <>
      {readOnlyHint ? (
        <div className="feedback-box error">
          <strong>{readOnlyHint}</strong>
        </div>
      ) : null}

      <Suspense fallback={<main className="content-shell"><section className="card"><p>Ansicht wird geladen...</p></section></main>}>
        <main className="content-shell">
          {activeView === 'program' ? <ProgramView {...programViewProps} /> : null}
          {activeView === 'dashboard' ? <DashboardView {...dashboardViewProps} /> : null}
          {activeView === 'assessment' ? <AssessmentView {...assessmentViewProps} /> : null}
          {activeView === 'measures' ? <MeasuresView {...measuresViewProps} /> : null}
          {activeView === 'governance' ? <GovernanceView {...governanceViewProps} /> : null}
          {activeView === 'resilience' ? <ResilienceView {...resilienceViewProps} /> : null}
          {activeView === 'resilience_plan' ? <ResiliencePlanView {...resiliencePlanViewProps} /> : null}
          {activeView === 'tabletop_exercise' ? <TabletopExerciseView {...tabletopExerciseViewProps} /> : null}
          {activeView === 'control' ? <ControlView {...controlViewProps} /> : null}
          {activeView === 'platform' ? <PlatformView {...platformViewProps} /> : null}
          {activeView === 'operations' ? <OperationsView {...operationsViewProps} /> : null}
          {activeView === 'rollout' ? <RolloutView {...rolloutViewProps} /> : null}
          {activeView === 'modules' ? <ModulesView {...modulesViewProps} /> : null}
          {activeView === 'kritis' ? <KritisView {...kritisViewProps} /> : null}
          {activeView === 'report' ? <ReportView {...reportViewProps} /> : null}
        </main>
      </Suspense>
    </>
  );
}
