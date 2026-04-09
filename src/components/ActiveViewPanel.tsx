import { Suspense, lazy, type ComponentProps } from 'react';
import type { ViewKey } from '../types';
import type * as AssessmentViewModule from '../views/AssessmentView';
import type * as ControlViewModule from '../views/ControlView';
import type * as DashboardViewModule from '../views/DashboardView';
import type * as GovernanceViewModule from '../views/GovernanceView';
import type * as KritisViewModule from '../views/KritisView';
import type * as MeasuresViewModule from '../views/MeasuresView';
import type * as ModulesViewModule from '../views/ModulesView';
import type * as OperationsViewModule from '../views/OperationsView';
import type * as PlatformViewModule from '../views/PlatformView';
import type * as ProgramViewModule from '../views/ProgramView';
import type * as ReportViewModule from '../views/ReportView';
import type * as ResilienceViewModule from '../views/ResilienceView';
import type * as RolloutViewModule from '../views/RolloutView';

const AssessmentView = lazy(async () => ({ default: (await import('../views/AssessmentView')).AssessmentView }));
const ControlView = lazy(async () => ({ default: (await import('../views/ControlView')).ControlView }));
const DashboardView = lazy(async () => ({ default: (await import('../views/DashboardView')).DashboardView }));
const GovernanceView = lazy(async () => ({ default: (await import('../views/GovernanceView')).GovernanceView }));
const KritisView = lazy(async () => ({ default: (await import('../views/KritisView')).KritisView }));
const MeasuresView = lazy(async () => ({ default: (await import('../views/MeasuresView')).MeasuresView }));
const ModulesView = lazy(async () => ({ default: (await import('../views/ModulesView')).ModulesView }));
const OperationsView = lazy(async () => ({ default: (await import('../views/OperationsView')).OperationsView }));
const PlatformView = lazy(async () => ({ default: (await import('../views/PlatformView')).PlatformView }));
const ProgramView = lazy(async () => ({ default: (await import('../views/ProgramView')).ProgramView }));
const ReportView = lazy(async () => ({ default: (await import('../views/ReportView')).ReportView }));
const ResilienceView = lazy(async () => ({ default: (await import('../views/ResilienceView')).ResilienceView }));
const RolloutView = lazy(async () => ({ default: (await import('../views/RolloutView')).RolloutView }));

type AssessmentViewProps = ComponentProps<typeof AssessmentViewModule.AssessmentView>;
type ControlViewProps = ComponentProps<typeof ControlViewModule.ControlView>;
type DashboardViewProps = ComponentProps<typeof DashboardViewModule.DashboardView>;
type GovernanceViewProps = ComponentProps<typeof GovernanceViewModule.GovernanceView>;
type KritisViewProps = ComponentProps<typeof KritisViewModule.KritisView>;
type MeasuresViewProps = ComponentProps<typeof MeasuresViewModule.MeasuresView>;
type ModulesViewProps = ComponentProps<typeof ModulesViewModule.ModulesView>;
type OperationsViewProps = ComponentProps<typeof OperationsViewModule.OperationsView>;
type PlatformViewProps = ComponentProps<typeof PlatformViewModule.PlatformView>;
type ProgramViewProps = ComponentProps<typeof ProgramViewModule.ProgramView>;
type ReportViewProps = ComponentProps<typeof ReportViewModule.ReportView>;
type ResilienceViewProps = ComponentProps<typeof ResilienceViewModule.ResilienceView>;
type RolloutViewProps = ComponentProps<typeof RolloutViewModule.RolloutView>;

interface ActiveViewPanelProps {
  activeView: ViewKey;
  readOnlyHint: string;
  programViewProps: ProgramViewProps;
  dashboardViewProps: DashboardViewProps;
  assessmentViewProps: AssessmentViewProps;
  measuresViewProps: MeasuresViewProps;
  governanceViewProps: GovernanceViewProps;
  resilienceViewProps: ResilienceViewProps;
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
