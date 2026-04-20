/**
 * Typen für den Risikokatalog (Feature B3).
 *
 * Die Taxonomie folgt dem All-Gefahren-Ansatz nach § 12 KRITISDachG:
 * sechs Hauptkategorien, jede mit kuratierten Unterkategorien. Bewertung
 * erfolgt über eine 5×5-Matrix (Eintrittswahrscheinlichkeit × Auswirkung).
 */

export type RiskCategoryId =
  | 'nature'
  | 'technical'
  | 'human_intentional'
  | 'human_unintentional'
  | 'interdependency'
  | 'cyber_physical';

export type RiskScore = 1 | 2 | 3 | 4 | 5;

export type RiskCriticality = 'akzeptabel' | 'beobachten' | 'handeln' | 'sofort';

export interface RiskSubCategory {
  id: string;
  label: string;
  beschreibung: string;
  typischeIndikatoren: string[];
  verlinkungZu: string[];
}

export interface RiskCategory {
  id: RiskCategoryId;
  label: string;
  beschreibung: string;
  subCategories: RiskSubCategory[];
}

export interface RiskEntry {
  id: string;
  categoryId: RiskCategoryId;
  subCategoryId: string;
  titel: string;
  beschreibung: string;
  eintrittswahrscheinlichkeit: RiskScore;
  auswirkung: RiskScore;
  affectedAssetIds: string[];
  affectedProcessIds: string[];
  affectedInterdependencies: string[];
  mitigationMeasureIds: string[];
  residualRisk: RiskScore;
  reviewDate: string;
  owner: string;
}
