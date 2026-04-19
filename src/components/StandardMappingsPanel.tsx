import { useState } from 'react';
import { BookMarked, ChevronDown, ChevronRight } from 'lucide-react';
import {
  ALL_STANDARD_IDS,
  getRelevanceLabel,
  groupMappingsByStandard,
  standardLabels,
} from '../lib/standardMappings';
import type { MappingRelevance, StandardControlReference } from '../types';

interface StandardMappingsPanelProps {
  mappings: StandardControlReference[];
  defaultOpen?: boolean;
}

function getRelevanceTone(relevance: MappingRelevance): 'success' | 'warn' | 'outline' {
  if (relevance === 'primary') {
    return 'success';
  }
  if (relevance === 'secondary') {
    return 'warn';
  }
  return 'outline';
}

export function StandardMappingsPanel({ mappings, defaultOpen = false }: StandardMappingsPanelProps) {
  const [open, setOpen] = useState(defaultOpen);

  if (mappings.length === 0) {
    return null;
  }

  const grouped = groupMappingsByStandard(mappings);

  return (
    <section className="nested-card top-gap">
      <button
        type="button"
        className="link-button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <BookMarked size={14} />
        <span>
          <strong>Standard-Mappings</strong>
          <span className="muted small">{' '}· {mappings.length} Treffer in {ALL_STANDARD_IDS.filter((id) => grouped[id].length > 0).length} Standards</span>
        </span>
      </button>

      {open ? (
        <div className="top-gap">
          {ALL_STANDARD_IDS.map((standardId) => {
            const entries = grouped[standardId];
            if (entries.length === 0) {
              return null;
            }
            return (
              <div key={standardId} className="top-gap">
                <p className="eyebrow">{standardLabels[standardId]}</p>
                <ul className="plain-list">
                  {entries.map((entry) => (
                    <li key={`${entry.standardId}-${entry.controlId}`}>
                      <div className="question-title-row">
                        <strong>{entry.controlId}</strong>
                        <span className={`chip ${getRelevanceTone(entry.relevance)}`}>
                          {getRelevanceLabel(entry.relevance)}
                        </span>
                      </div>
                      <p className="muted small">{entry.controlTitle}</p>
                      {entry.note ? <p className="muted small">{entry.note}</p> : null}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
