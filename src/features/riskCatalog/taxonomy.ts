import type { RiskCategory, RiskSubCategory } from './types';

/**
 * Kuratierte Taxonomie nach § 12 KRITISDachG (All-Gefahren-Ansatz).
 *
 * Die Unterkategorien sind bewusst nicht erschöpfend; sie decken die in der
 * KRITIS-Beratungspraxis am häufigsten relevanten Gefährdungslagen ab.
 * Beraterinnen können per RiskEntry-Freitextfeldern abweichende Szenarien
 * anlegen, ohne die Taxonomie zu verändern.
 *
 * Verlinkung: `verlinkungZu` enthält KRITIS-/BSIG-Requirement-IDs, die üblicherweise
 * von der jeweiligen Gefährdung berührt werden. Dient als UI-Hinweis, nicht als
 * zwingende Bindung.
 */
export const riskTaxonomy: RiskCategory[] = [
  {
    id: 'nature',
    label: 'Naturgefahren',
    beschreibung: 'Witterungs-, geologisch- und wetterbedingte Gefährdungen der Anlagen und Standorte.',
    subCategories: [
      {
        id: 'flooding',
        label: 'Hochwasser',
        beschreibung: 'Fluss- oder Sturzhochwasser, das Gebäude, Technik oder Zufahrten beeinträchtigt.',
        typischeIndikatoren: [
          'Pegelstände oberhalb HQ100',
          'Lage in amtlichen Überschwemmungsgebieten',
          'Wasserstand im Keller oder auf dem Gelände',
        ],
        verlinkungZu: ['de_kritis_risk_assessment', 'de_kritis_resilience_measures'],
      },
      {
        id: 'heavy_rain',
        label: 'Starkregen',
        beschreibung: 'Lokale Starkregenereignisse mit Rückstau, Oberflächenabfluss oder Überflutung.',
        typischeIndikatoren: [
          'DWD-Warnung Stufe 3/4',
          'Entwässerungskapazität überlastet',
          'Vollgelaufene Schächte oder Keller',
        ],
        verlinkungZu: ['de_kritis_risk_assessment', 'de_kritis_resilience_measures'],
      },
      {
        id: 'storm',
        label: 'Sturm',
        beschreibung: 'Orkan- oder Sturmtiefs mit Schäden an Gebäuden, Netzen oder Zufahrten.',
        typischeIndikatoren: ['Windgeschwindigkeit > 100 km/h', 'Sturmschäden in der Region', 'Netzausfälle'],
        verlinkungZu: ['de_kritis_risk_assessment', 'de_kritis_resilience_measures'],
      },
      {
        id: 'snow_load',
        label: 'Schneelast',
        beschreibung: 'Statisch relevante Schneelasten auf Dächern oder Freileitungen.',
        typischeIndikatoren: ['Schneelast > Bemessungswert', 'Eislast auf Leitungen', 'Dachverformung'],
        verlinkungZu: ['de_kritis_risk_assessment'],
      },
      {
        id: 'earthquake',
        label: 'Erdbeben',
        beschreibung: 'Seismische Ereignisse oberhalb der regionalen Nullschwelle.',
        typischeIndikatoren: ['Magnitude > 4', 'Erdbebenzone laut DIN EN 1998', 'Erschütterungsmeldung'],
        verlinkungZu: ['de_kritis_risk_assessment'],
      },
      {
        id: 'heat_wave',
        label: 'Hitzewelle',
        beschreibung: 'Langanhaltende Hitzeperioden mit Auswirkungen auf Kühlung, Personal und Anlagen.',
        typischeIndikatoren: ['Tage mit > 32 °C Maximaltemperatur', 'Überschreitung Kühlgrenzen', 'Ausfall Klimatechnik'],
        verlinkungZu: ['de_kritis_risk_assessment', 'de_kritis_resilience_measures'],
      },
      {
        id: 'cold_wave',
        label: 'Kältewelle',
        beschreibung: 'Anhaltende Frostperioden mit Frostschäden oder erhöhtem Energiebedarf.',
        typischeIndikatoren: ['Tage mit < -10 °C Minimaltemperatur', 'Frostschäden an Leitungen'],
        verlinkungZu: ['de_kritis_risk_assessment'],
      },
      {
        id: 'wildfire',
        label: 'Waldbrand',
        beschreibung: 'Vegetationsbrände im Anlagenumfeld mit Rauch-, Hitze- oder Evakuierungsfolgen.',
        typischeIndikatoren: ['Waldbrandgefahrenstufe 4/5', 'Rauchmeldungen auf dem Gelände', 'Evakuierungsradius'],
        verlinkungZu: ['de_kritis_risk_assessment', 'de_kritis_resilience_measures'],
      },
    ],
  },

  {
    id: 'technical',
    label: 'Technische Gefahren',
    beschreibung: 'Technisch bedingte Ausfälle und Schadensereignisse innerhalb oder am Rand der Anlage.',
    subCategories: [
      {
        id: 'power_outage',
        label: 'Stromausfall',
        beschreibung: 'Netzseitiger oder anlageninterner Ausfall der elektrischen Versorgung.',
        typischeIndikatoren: ['SAIDI-Überschreitung', 'USV-Laufzeit überschritten', 'Ausfall Notstromdiesel'],
        verlinkungZu: ['de_kritis_resilience_measures', 'de_kritis_resilience_plan'],
      },
      {
        id: 'comms_outage',
        label: 'Kommunikationsausfall',
        beschreibung: 'Ausfall der Sprach-, Daten- oder Leitstellenkommunikation.',
        typischeIndikatoren: ['Ausfall der Primär- oder Redundanzanbindung', 'Störung im Mobilfunknetz', 'Fehlende BOS-Anbindung'],
        verlinkungZu: ['de_kritis_resilience_measures', 'de_kritis_incident_reporting'],
      },
      {
        id: 'it_outage',
        label: 'IT-Ausfall',
        beschreibung: 'Ausfall zentraler IT- oder OT-Systeme ohne Cyberbezug (Hardware, Software, Betriebsfehler).',
        typischeIndikatoren: ['Bluescreens auf Kernsystemen', 'Datenbank-Korruption', 'Storage-Defekt'],
        verlinkungZu: ['de_kritis_resilience_measures', 'de_bsig_special_measures'],
      },
      {
        id: 'plant_fire',
        label: 'Anlagenbrand',
        beschreibung: 'Brandereignis innerhalb von Produktions-, Lager- oder Serverräumen.',
        typischeIndikatoren: ['Auslösung Brandmeldeanlage', 'Brandschäden', 'Rauchentwicklung'],
        verlinkungZu: ['de_kritis_resilience_measures', 'de_kritis_resilience_plan'],
      },
      {
        id: 'explosion',
        label: 'Explosion',
        beschreibung: 'Detonation oder Verpuffung infolge von Prozessstoffen, Gas oder Staub.',
        typischeIndikatoren: ['ATEX-Zone 0/1-Auslösung', 'Druckwellenschäden', 'Gasalarm'],
        verlinkungZu: ['de_kritis_resilience_measures'],
      },
      {
        id: 'supply_chain_disruption',
        label: 'Lieferkettenunterbrechung',
        beschreibung: 'Ausfall kritischer Zulieferer oder Transportwege.',
        typischeIndikatoren: ['Lieferverzug > 14 Tage', 'Single-Source-Abhängigkeit', 'Transportsperren'],
        verlinkungZu: ['de_bsig_risk_management', 'de_kritis_risk_assessment'],
      },
    ],
  },

  {
    id: 'human_intentional',
    label: 'Menschliche Gefahren · intentional',
    beschreibung: 'Vorsätzliche Handlungen von Dritten oder Beschäftigten mit Schadensabsicht.',
    subCategories: [
      {
        id: 'sabotage',
        label: 'Sabotage',
        beschreibung: 'Gezielte Beeinträchtigung von Anlagen, Steuerungen oder Versorgung.',
        typischeIndikatoren: ['Manipulation an Steuertechnik', 'Unbefugte Konfigurationsänderung', 'Hinweise aus dem Umfeld'],
        verlinkungZu: ['de_kritis_resilience_measures', 'de_bsig_special_measures'],
      },
      {
        id: 'terror',
        label: 'Terror',
        beschreibung: 'Politisch oder ideologisch motivierte Angriffe auf kritische Anlagen.',
        typischeIndikatoren: ['Erhöhte Gefährdungslage (BfV/Polizei)', 'Bedrohungsschreiben', 'Auffällige Aufklärung'],
        verlinkungZu: ['de_kritis_resilience_measures'],
      },
      {
        id: 'insider_attack',
        label: 'Insider-Angriff',
        beschreibung: 'Missbrauch legitimen Zugangs durch interne oder privilegierte Personen.',
        typischeIndikatoren: ['Auffällige Admin-Aktivität', 'Zugriff außerhalb der Arbeitszeit', 'Zunehmende Kündigungsindikatoren'],
        verlinkungZu: ['de_bsig_risk_management', 'de_bsig_special_measures'],
      },
      {
        id: 'physical_breakin',
        label: 'Physischer Einbruch',
        beschreibung: 'Gewaltsames oder heimliches Eindringen in Anlagenbereiche.',
        typischeIndikatoren: ['Zaunanomalien', 'Fehlerhafte Zutrittsversuche', 'Einbruchsspuren'],
        verlinkungZu: ['de_kritis_resilience_measures'],
      },
      {
        id: 'drone_incident',
        label: 'Drohnen-Vorfall',
        beschreibung: 'Unbefugter UAV-Überflug oder Nutzlast-Abwurf über der Anlage.',
        typischeIndikatoren: ['Detektion durch Anti-Drohnen-System', 'Sichtmeldung Wachpersonal', 'Störung im Funkspektrum'],
        verlinkungZu: ['de_kritis_resilience_measures'],
      },
    ],
  },

  {
    id: 'human_unintentional',
    label: 'Menschliche Gefahren · nicht intentional',
    beschreibung: 'Fehler, Personalausfall oder Knappheiten ohne Schadensabsicht.',
    subCategories: [
      {
        id: 'human_error',
        label: 'Bedienfehler',
        beschreibung: 'Fehlerhafte Konfiguration, Steuerung oder Eingaben im laufenden Betrieb.',
        typischeIndikatoren: ['Near-Miss-Berichte', 'Fehleingaben in Leitständen', 'Abweichende Arbeitsanweisungen'],
        verlinkungZu: ['de_kritis_resilience_measures', 'de_bsig_management_governance'],
      },
      {
        id: 'skill_shortage',
        label: 'Fachkräftemangel',
        beschreibung: 'Fehlende Qualifikation oder Kapazität für sicherheitsrelevante Rollen.',
        typischeIndikatoren: ['Unbesetzte Schlüsselstellen > 3 Monate', 'Schulungsquote < Ziel', 'Überstundenquote'],
        verlinkungZu: ['de_bsig_management_governance', 'de_kritis_management_accountability'],
      },
      {
        id: 'strike',
        label: 'Streik',
        beschreibung: 'Arbeitskampfmaßnahmen mit Auswirkungen auf Betrieb oder Lieferkette.',
        typischeIndikatoren: ['Angekündigte Warnstreiks', 'Tarifauseinandersetzung', 'Ausfall einer Schicht'],
        verlinkungZu: ['de_kritis_resilience_plan'],
      },
      {
        id: 'pandemic',
        label: 'Pandemie',
        beschreibung: 'Ausbreitung einer Infektionskrankheit mit Personal- oder Lieferketteneffekten.',
        typischeIndikatoren: ['Inzidenz > kritische Schwelle', 'Quarantäneregelungen', 'Ausfallquote Personal'],
        verlinkungZu: ['de_kritis_resilience_plan', 'de_kritis_resilience_measures'],
      },
    ],
  },

  {
    id: 'interdependency',
    label: 'Interdependenzen',
    beschreibung: 'Kaskadeneffekte aus der Abhängigkeit von anderen kritischen Infrastrukturen oder externen Dienstleistern.',
    subCategories: [
      {
        id: 'cross_sector_cascade',
        label: 'Kaskade über Sektorgrenzen',
        beschreibung: 'Ausfall in einem anderen KRITIS-Sektor mit Folgewirkung, z. B. Stromausfall → Wasserversorgung.',
        typischeIndikatoren: ['Abhängigkeit von einzelnem Versorger', 'Fehlende Blackstart-Fähigkeit', 'Keine sektorübergreifende Übung'],
        verlinkungZu: ['de_kritis_risk_assessment', 'de_kritis_resilience_plan'],
      },
      {
        id: 'external_dependency',
        label: 'Abhängigkeit von externen Dienstleistern',
        beschreibung: 'Kritische Fremdleistung (IT, Logistik, Spezialtechnik) ohne Fallback.',
        typischeIndikatoren: ['Single-Source-Vertrag', 'SLA-Lücken', 'Fehlende Zweitquelle'],
        verlinkungZu: ['de_bsig_risk_management', 'de_kritis_risk_assessment'],
      },
      {
        id: 'network_cascade',
        label: 'Netzwerk-Kaskade',
        beschreibung: 'Ausbreitung von Störungen über gemeinsam genutzte Netze (Fernwärme, Daten, Strom).',
        typischeIndikatoren: ['Engpasselement ohne Redundanz', 'Historische Kaskadenereignisse', 'Fehlende Netzsegmentierung'],
        verlinkungZu: ['de_kritis_risk_assessment'],
      },
    ],
  },

  {
    id: 'cyber_physical',
    label: 'Cyber-physische Kaskaden',
    beschreibung:
      'Cybervorfälle mit physischer Auswirkung auf die Anlage. Reiner Cyberbezug ohne physische Wirkung gehört ins BSIG/NIS2-Regime.',
    subCategories: [
      {
        id: 'ot_incident',
        label: 'OT-Übergriff',
        beschreibung: 'Eingriff in Steuerungs- oder Prozessleittechnik (OT) mit Auswirkungen auf die Anlage.',
        typischeIndikatoren: ['Anomalien im OT-Monitoring', 'Unautorisiertes SPS-Programm', 'Ausfall Sicherheitsfunktionen'],
        verlinkungZu: ['de_bsig_special_measures', 'de_kritis_resilience_measures'],
      },
      {
        id: 'malware_physical',
        label: 'Malware mit physischer Auswirkung',
        beschreibung: 'Schadsoftware, die Aktoren oder Sicherheitssteuerungen beeinflusst (z. B. Triton, Industroyer).',
        typischeIndikatoren: ['IOC-Treffer in OT', 'Abweichungen in Sicherheits-SPS', 'Fehlalarme in Safety-Layer'],
        verlinkungZu: ['de_bsig_special_measures'],
      },
      {
        id: 'ransomware_production',
        label: 'Ransomware auf Produktionssysteme',
        beschreibung: 'Verschlüsselung oder Sperrung produktionsnaher Systeme, die zum Stillstand zwingt.',
        typischeIndikatoren: ['Verschlüsselte Dateien auf Produktionsservern', 'Löse­geld­forderung', 'Stillstand der Fertigungslinie'],
        verlinkungZu: ['de_bsig_risk_management', 'de_kritis_resilience_measures'],
      },
    ],
  },
];

const categoryIndex = new Map(riskTaxonomy.map((category) => [category.id, category]));

const subCategoryIndex: Map<string, RiskSubCategory> = new Map(
  riskTaxonomy.flatMap((category) =>
    category.subCategories.map((sub): [string, RiskSubCategory] => [`${category.id}::${sub.id}`, sub]),
  ),
);

export function findCategory(categoryId: string): RiskCategory | undefined {
  return categoryIndex.get(categoryId as RiskCategory['id']);
}

export function findSubCategory(categoryId: string, subCategoryId: string): RiskSubCategory | undefined {
  return subCategoryIndex.get(`${categoryId}::${subCategoryId}`);
}

export function countTaxonomyEntries(): { categories: number; subCategories: number } {
  return {
    categories: riskTaxonomy.length,
    subCategories: riskTaxonomy.reduce((sum, category) => sum + category.subCategories.length, 0),
  };
}
