import type { PropertyData, DVFAnalysisResult } from '@/types'
import { daysSince } from './utils'

export interface NegociationFactor {
  label: string
  score: number
  maxScore: number
  detail: string
}

export interface NegociationResult {
  scoreTotal: number
  /** 0–100 : potentiel de négociation global */
  potentiel: 'faible' | 'modéré' | 'bon' | 'fort'
  factors: NegociationFactor[]
  /** Prix d'offre recommandé */
  offreRecommandee: number
  /** Prix d'offre basse (plancher agressif) */
  offreBasse: number
  /** Remise en % sur le prix annoncé */
  remisePct: number
  remiseBasePct: number
  arguments: string[]
}

// ─── Facteur 1 : écart DVF ────────────────────────────────────────────────────

function scoreDVF(ecartPourcent: number): NegociationFactor {
  let score = 0
  let detail = ''

  if (ecartPourcent > 20) {
    score = 40
    detail = `+${ecartPourcent.toFixed(1)}% au-dessus de la médiane DVF — surcote très élevée`
  } else if (ecartPourcent > 10) {
    score = 28
    detail = `+${ecartPourcent.toFixed(1)}% au-dessus de la médiane — bien surévalué`
  } else if (ecartPourcent > 5) {
    score = 16
    detail = `+${ecartPourcent.toFixed(1)}% au-dessus de la médiane — légère surcote`
  } else if (ecartPourcent > 0) {
    score = 6
    detail = `+${ecartPourcent.toFixed(1)}% — dans la fourchette haute du marché`
  } else if (ecartPourcent > -5) {
    score = 0
    detail = `${ecartPourcent.toFixed(1)}% — prix dans la moyenne DVF`
  } else {
    score = 0
    detail = `${ecartPourcent.toFixed(1)}% en dessous de la médiane — bien déjà bien positionné`
  }

  return { label: 'Positionnement DVF', score, maxScore: 40, detail }
}

// ─── Facteur 2 : ancienneté de l'annonce ─────────────────────────────────────

function scoreAnciennete(publishedAt: string | null): NegociationFactor {
  if (!publishedAt) {
    return {
      label: 'Ancienneté annonce',
      score: 5,
      maxScore: 30,
      detail: 'Date de publication inconnue — marge par défaut',
    }
  }

  const jours = daysSince(publishedAt)
  let score = 0
  let detail = ''

  if (jours > 90) {
    score = 30
    detail = `${jours} jours en ligne — vendeur probablement pressé de vendre`
  } else if (jours > 60) {
    score = 22
    detail = `${jours} jours en ligne — annonce qui stagne, fort levier`
  } else if (jours > 30) {
    score = 14
    detail = `${jours} jours en ligne — début de stagnation, levier modéré`
  } else if (jours > 14) {
    score = 6
    detail = `${jours} jours en ligne — annonce récente, levier limité`
  } else {
    score = 0
    detail = `${jours} jours en ligne — annonce très fraîche, peu de levier temporel`
  }

  return { label: 'Ancienneté annonce', score, maxScore: 30, detail }
}

// ─── Facteur 3 : état du bien ─────────────────────────────────────────────────

function scoreEtat(condition: PropertyData['condition']): NegociationFactor {
  const map: Record<PropertyData['condition'], { score: number; detail: string }> = {
    travaux: { score: 30, detail: 'Travaux à prévoir — argument fort pour décote' },
    moyen: { score: 18, detail: 'État moyen — remise pour remise à niveau' },
    bon: { score: 5, detail: "Bon état — peu de marge sur l'état" },
    neuf: { score: 0, detail: "Bien neuf / rénové — aucun argument sur l'état" },
  }
  const { score, detail } = map[condition]
  return { label: 'État du bien', score, maxScore: 30, detail }
}

// ─── Fourchette d'offre ───────────────────────────────────────────────────────

function computeFourchette(
  prix: number,
  score: number
): { offreRecommandee: number; offreBasse: number; remisePct: number; remiseBasePct: number } {
  // remise recommandée / remise basse selon score /100
  let remisePct: number
  let remiseBasePct: number

  if (score >= 80) {
    remisePct = 12
    remiseBasePct = 18
  } else if (score >= 60) {
    remisePct = 9
    remiseBasePct = 14
  } else if (score >= 40) {
    remisePct = 6
    remiseBasePct = 10
  } else if (score >= 20) {
    remisePct = 4
    remiseBasePct = 7
  } else {
    remisePct = 2
    remiseBasePct = 4
  }

  return {
    offreRecommandee: Math.round(prix * (1 - remisePct / 100) / 1000) * 1000,
    offreBasse: Math.round(prix * (1 - remiseBasePct / 100) / 1000) * 1000,
    remisePct,
    remiseBasePct,
  }
}

// ─── Arguments de négociation ─────────────────────────────────────────────────

function buildArguments(
  factors: NegociationFactor[],
  dvf: DVFAnalysisResult,
  property: PropertyData,
  publishedAt: string | null
): string[] {
  const args: string[] = []
  const jours = publishedAt ? daysSince(publishedAt) : null

  // DVF
  if (dvf.ecartPourcent > 5) {
    args.push(
      `Les données DVF officielles montrent une médiane de marché à ${dvf.mediane.toLocaleString('fr-FR')} €/m² ` +
        `sur ${dvf.nbTransactions} transactions — ce bien est affiché ${dvf.ecartPourcent > 0 ? '+' : ''}${dvf.ecartPourcent.toFixed(1)}% au-dessus.`
    )
  }

  // Ancienneté
  if (jours && jours > 30) {
    args.push(
      `L'annonce est en ligne depuis ${jours} jours sans preneur, ce qui témoigne d'un prix de mise en vente trop élevé par rapport au marché.`
    )
  }

  // État
  if (property.condition === 'travaux') {
    args.push(
      `Des travaux sont nécessaires pour mettre le bien aux normes locatives LMNP (isolation, équipements). ` +
        `Le coût doit être intégré dans le prix d'acquisition.`
    )
  } else if (property.condition === 'moyen') {
    args.push(
      `L'état général du bien est moyen et nécessite une remise à niveau avant mise en location. ` +
        `Cette rénovation doit être répercutée sur le prix d'achat.`
    )
  }

  // P10 DVF (argument technique)
  if (dvf.p10 > 0) {
    args.push(
      `Les transactions au 10ème percentile montrent des prix à ${dvf.p10.toLocaleString('fr-FR')} €/m² sur ce secteur, ` +
        `ce qui prouve qu'il existe des opportunités mieux positionnées sur ce marché.`
    )
  }

  // Argument générique sur la durée du crédit
  args.push(
    `Sur 25 ans de crédit, chaque 1% de remise sur le prix représente plusieurs milliers d'euros d'intérêts économisés ` +
      `et améliore directement le cash-flow mensuel.`
  )

  return args

  void factors
}

// ─── Export principal ─────────────────────────────────────────────────────────

export function computeNegociation(
  property: PropertyData,
  dvf: DVFAnalysisResult
): NegociationResult {
  const f1 = scoreDVF(dvf.ecartPourcent)
  const f2 = scoreAnciennete(property.publishedAt)
  const f3 = scoreEtat(property.condition)
  const factors = [f1, f2, f3]

  const scoreTotal = f1.score + f2.score + f3.score

  let potentiel: NegociationResult['potentiel']
  if (scoreTotal >= 70) potentiel = 'fort'
  else if (scoreTotal >= 45) potentiel = 'bon'
  else if (scoreTotal >= 20) potentiel = 'modéré'
  else potentiel = 'faible'

  const fourchette = computeFourchette(property.price, scoreTotal)
  const args = buildArguments(factors, dvf, property, property.publishedAt)

  return {
    scoreTotal,
    potentiel,
    factors,
    ...fourchette,
    arguments: args,
  }
}
