import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type Dispatch,
  type ReactNode,
} from 'react';
import { loadModulePack } from '../lib/loadModulePack';
import type {
  AnswerEntry,
  ApplicabilityResult,
  CompanyProfile,
  IndicatorAnswers,
  IndicatorStageKey,
  ScoreSnapshot,
  SectorModulePack,
} from '../types';

const STORAGE_KEY = 'kritis-kompass-state';

export interface AssessmentState {
  sector?: string;
  profile: Partial<CompanyProfile>;
  indicators: IndicatorAnswers;
  applicability?: ApplicabilityResult;
  modulePackId?: string;
  /** Aktuell geladenes Pack. NICHT persistiert — wird beim Mount nachgeladen. */
  modulePack?: SectorModulePack;
  /** Loader-Indikator fuer UX (Spinner/Skeleton). */
  modulePackLoading: boolean;
  /** Modul bewusst uebersprungen — Phase B trotz fehlendem Pack. */
  modulePackSkipped: boolean;
  answers: Record<string, AnswerEntry>;
  score?: ScoreSnapshot;
}

function emptyIndicators(): IndicatorAnswers {
  return {
    stage1_direct: {},
    stage2_supplier: {},
    stage3_context: {},
  };
}

export const initialAssessmentState: AssessmentState = {
  profile: {},
  indicators: emptyIndicators(),
  answers: {},
  modulePackLoading: false,
  modulePackSkipped: false,
};

export type AssessmentAction =
  | { type: 'SET_PROFILE_FIELD'; field: keyof CompanyProfile; value: string }
  | { type: 'SET_INDICATOR'; stage: IndicatorStageKey; key: string; value: unknown }
  | { type: 'SET_APPLICABILITY'; value: ApplicabilityResult | undefined }
  | { type: 'SELECT_MODULE_PACK'; id: string }
  | { type: 'SKIP_MODULE_PACK' }
  | { type: 'CLEAR_MODULE_PACK' }
  | { type: '_MODULE_PACK_LOADING'; id: string }
  | { type: '_MODULE_PACK_LOADED'; id: string; pack: SectorModulePack | undefined }
  | { type: 'SET_ANSWER'; questionId: string; answer: AnswerEntry }
  | { type: 'RESET_ANSWERS_FOR_QUESTIONS'; questionIds: string[] }
  | { type: 'SET_SCORE'; value: ScoreSnapshot | undefined }
  | { type: 'RESET' }
  | { type: 'HYDRATE_FROM_STORAGE'; state: AssessmentState };

function reducer(state: AssessmentState, action: AssessmentAction): AssessmentState {
  switch (action.type) {
    case 'SET_PROFILE_FIELD':
      return {
        ...state,
        profile: { ...state.profile, [action.field]: action.value },
      };
    case 'SET_INDICATOR':
      return {
        ...state,
        indicators: {
          ...state.indicators,
          [action.stage]: {
            ...state.indicators[action.stage],
            [action.key]: action.value,
          },
        },
      };
    case 'SET_APPLICABILITY':
      return { ...state, applicability: action.value };
    case 'SELECT_MODULE_PACK':
      // ID setzen; Pack-Inhalt kommt asynchron via _MODULE_PACK_LOADED.
      // modulePackSkipped zuruecksetzen — der User entscheidet sich nun fuer ein Modul.
      if (state.modulePackId === action.id && state.modulePack?.id) {
        // Selbe ID, Pack schon geladen — nichts zu tun.
        return { ...state, modulePackSkipped: false };
      }
      return {
        ...state,
        modulePackId: action.id,
        modulePack: state.modulePack?.packId === action.id ? state.modulePack : undefined,
        modulePackSkipped: false,
        modulePackLoading: state.modulePack?.id !== action.id,
      };
    case 'SKIP_MODULE_PACK':
      return {
        ...state,
        modulePackId: undefined,
        modulePack: undefined,
        modulePackLoading: false,
        modulePackSkipped: true,
      };
    case 'CLEAR_MODULE_PACK':
      return {
        ...state,
        modulePackId: undefined,
        modulePack: undefined,
        modulePackLoading: false,
        modulePackSkipped: false,
      };
    case '_MODULE_PACK_LOADING':
      // Schutz vor Race-Conditions: nur fuer die aktuelle ID setzen.
      if (state.modulePackId !== action.id) return state;
      return { ...state, modulePackLoading: true };
    case '_MODULE_PACK_LOADED':
      // Race-Schutz: ignorieren, wenn der User schon ein anderes Modul gewaehlt hat.
      if (state.modulePackId !== action.id) return state;
      return { ...state, modulePack: action.pack, modulePackLoading: false };
    case 'SET_ANSWER':
      return {
        ...state,
        answers: { ...state.answers, [action.questionId]: action.answer },
      };
    case 'RESET_ANSWERS_FOR_QUESTIONS': {
      const drop = new Set(action.questionIds);
      const next: Record<string, AnswerEntry> = {};
      Object.entries(state.answers).forEach(([id, entry]) => {
        if (!drop.has(id)) {
          next[id] = entry;
        }
      });
      return { ...state, answers: next };
    }
    case 'SET_SCORE':
      return { ...state, score: action.value };
    case 'RESET':
      return { ...initialAssessmentState, indicators: emptyIndicators() };
    case 'HYDRATE_FROM_STORAGE':
      return action.state;
    default:
      return state;
  }
}

interface AssessmentContextValue {
  state: AssessmentState;
  dispatch: Dispatch<AssessmentAction>;
}

const AssessmentContext = createContext<AssessmentContextValue | undefined>(undefined);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function coerceIndicators(value: unknown): IndicatorAnswers {
  if (!isPlainObject(value)) {
    return emptyIndicators();
  }
  const stage1 = isPlainObject(value.stage1_direct) ? value.stage1_direct : {};
  const stage2 = isPlainObject(value.stage2_supplier) ? value.stage2_supplier : {};
  const stage3 = isPlainObject(value.stage3_context) ? value.stage3_context : {};
  return {
    stage1_direct: stage1,
    stage2_supplier: stage2,
    stage3_context: stage3,
  };
}

function loadFromStorage(): AssessmentState | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!isPlainObject(parsed)) {
      return null;
    }
    const profile = isPlainObject(parsed.profile)
      ? (parsed.profile as Partial<CompanyProfile>)
      : {};
    const answers = isPlainObject(parsed.answers)
      ? (parsed.answers as Record<string, AnswerEntry>)
      : {};
    return {
      sector: typeof parsed.sector === 'string' ? parsed.sector : undefined,
      profile,
      indicators: coerceIndicators(parsed.indicators),
      applicability: parsed.applicability as ApplicabilityResult | undefined,
      modulePackId: typeof parsed.modulePackId === 'string' ? parsed.modulePackId : undefined,
      // modulePack-Inhalt wird absichtlich NICHT persistiert — Loader holt nach.
      modulePack: undefined,
      modulePackLoading: false,
      modulePackSkipped: parsed.modulePackSkipped === true,
      answers,
      score: parsed.score as ScoreSnapshot | undefined,
    };
  } catch {
    return null;
  }
}

function buildPersistableSnapshot(state: AssessmentState): unknown {
  // Pack-Inhalt nicht persistieren — er kommt nach jedem Reload neu vom Server.
  // modulePackLoading ist transient.
  const { modulePack: _modulePack, modulePackLoading: _loading, ...rest } = state;
  return rest;
}

export function AssessmentProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(
    reducer,
    initialAssessmentState,
    (fallback) => loadFromStorage() ?? fallback,
  );
  const skipFirstPersistRef = useRef(true);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    if (skipFirstPersistRef.current) {
      skipFirstPersistRef.current = false;
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(buildPersistableSnapshot(state)));
    } catch {
      // Quota voll oder Storage gesperrt — bewusst still.
    }
  }, [state]);

  // Loader-Effect: holt den Pack-Inhalt, sobald sich modulePackId aendert.
  useEffect(() => {
    const id = state.modulePackId;
    if (!id) {
      return;
    }
    if (state.modulePack?.packId === id) {
      return;
    }
    let cancelled = false;
    dispatch({ type: '_MODULE_PACK_LOADING', id });
    loadModulePack(id)
      .then((pack) => {
        if (!cancelled) {
          dispatch({ type: '_MODULE_PACK_LOADED', id, pack });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          // Fehler unauffaellig — UI faellt auf "kein Modul" zurueck. In Phase 7
          // ggf. Fehler-Toast oder Telemetrie ergaenzen.
          // eslint-disable-next-line no-console
          console.warn('Module pack laden fehlgeschlagen:', error);
          dispatch({ type: '_MODULE_PACK_LOADED', id, pack: undefined });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [state.modulePackId, state.modulePack]);

  const value = useMemo(() => ({ state, dispatch }), [state]);

  return <AssessmentContext.Provider value={value}>{children}</AssessmentContext.Provider>;
}

export function useAssessment(): AssessmentContextValue {
  const context = useContext(AssessmentContext);
  if (!context) {
    throw new Error('useAssessment muss innerhalb eines AssessmentProvider verwendet werden.');
  }
  return context;
}

// Convenience-Hook fuer Komponenten, die nur den Pack-Status brauchen.
export function useModulePack(): {
  pack: SectorModulePack | undefined;
  packId: string | undefined;
  loading: boolean;
  skipped: boolean;
  select: (id: string) => void;
  skip: () => void;
  clear: () => void;
} {
  const { state, dispatch } = useAssessment();
  const select = useCallback((id: string) => dispatch({ type: 'SELECT_MODULE_PACK', id }), [dispatch]);
  const skip = useCallback(() => dispatch({ type: 'SKIP_MODULE_PACK' }), [dispatch]);
  const clear = useCallback(() => dispatch({ type: 'CLEAR_MODULE_PACK' }), [dispatch]);
  return {
    pack: state.modulePack,
    packId: state.modulePackId,
    loading: state.modulePackLoading,
    skipped: state.modulePackSkipped,
    select,
    skip,
    clear,
  };
}
