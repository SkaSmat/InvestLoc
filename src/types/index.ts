// ─── Listing extrait par Claude (Edge Function) ──────────────────────────────

export interface PropertyData {
  url: string
  title: string
  price: number
  surface: number
  rooms: number
  address: string
  postalCode: string
  city: string
  /** 'neuf' | 'bon' | 'moyen' | 'travaux' */
  condition: 'neuf' | 'bon' | 'moyen' | 'travaux'
  publishedAt: string | null
  description: string
  images: string[]
}

// ─── DVF ─────────────────────────────────────────────────────────────────────

export interface DVFTransaction {
  date: string
  prix: number
  surface: number
  prixM2: number
}

export interface DVFAnalysisResult {
  codeInsee: string
  mediane: number
  p10: number
  p90: number
  /** Tendance annuelle en % */
  tendance: number
  /** Écart entre le prix annoncé et la médiane DVF (%) — positif = bien cher */
  ecartPourcent: number
  transactions: DVFTransaction[]
  nbTransactions: number
}

// ─── LMNP / Rentabilité ───────────────────────────────────────────────────────

export interface LMNPInput {
  prixFAI: number
  surface: number
  loyerMensuel: number
  apport: number
  travaux: number
  /** Durée en années */
  duree: number
  /** Taux crédit annuel en % */
  tauxCredit: number
  /** Taux assurance annuel en % */
  tauxAssurance: number
  /** Frais de notaire en % du prix FAI */
  fraisNotairesPct: number
  /** Tranche marginale d'imposition en % */
  tmi: number
}

export interface RegimeFiscal {
  label: string
  /** Recettes annuelles */
  recettesAnnuelles: number
  /** Charges déductibles annuelles */
  chargesDeductibles: number
  /** Base imposable */
  baseImposable: number
  /** Impôt total (IR + PS) */
  impotAnnuel: number
  /** Cash-flow mensuel net */
  cashflowMensuel: number
}

export interface LMNPResult {
  // Données de base
  prixTotal: number
  mensualiteCredit: number
  coutTotalCredit: number
  interetsTotal: number

  // Rendements
  rendementBrut: number
  rendementNet: number

  // Régimes fiscaux
  microBIC: RegimeFiscal
  reel: RegimeFiscal

  // Amortissements (régime réel)
  amortissementImmeuble: number
  amortissementMobilier: number
  amortissementTotal: number
}

// ─── Profil de chasse ─────────────────────────────────────────────────────────

export interface SearchProfile {
  id?: string
  userId?: string
  zones: string[]
  budgetMax: number
  rendementMinBrut: number
  typeBien: 'appartement' | 'maison' | 'tous'
  surfaceMin: number
  surfaceMax: number
  createdAt?: string
}

// ─── Paramètres financiers ────────────────────────────────────────────────────

export interface FinancialSettings {
  id?: string
  userId?: string
  tauxCredit: number
  tauxAssurance: number
  duree: number
  fraisNotairesPct: number
  tmi: number
  createdAt?: string
  updatedAt?: string
}

// ─── Opportunités chasseur ────────────────────────────────────────────────────

export interface Opportunity {
  id?: string
  listingUrl: string
  title: string
  price: number
  surface: number
  city: string
  postalCode: string
  rendementBrut: number
  scoreTotal: number
  scoreDvf: number
  scoreRentabilite: number
  scoreQuartier: number
  scoreNego: number
  dvfEcartPct: number
  publishedAt: string | null
  createdAt?: string
}

// ─── États de l'interface ─────────────────────────────────────────────────────

export type AnalysisStep =
  | 'url_input'
  | 'extracting'
  | 'form'
  | 'analyzing'
  | 'results'

export interface AnalysisState {
  step: AnalysisStep
  url: string
  property: PropertyData | null
  dvf: DVFAnalysisResult | null
  error: string | null
}
