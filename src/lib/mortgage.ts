import type { LMNPInput, LMNPResult, RegimeFiscal, RiskScore } from '@/types'

/**
 * Calcule la mensualité d'un prêt (capital + intérêts) à taux fixe.
 */
function mensualiteCredit(capital: number, tauxAnnuel: number, dureeAns: number): number {
  const r = tauxAnnuel / 100 / 12
  const n = dureeAns * 12
  if (r === 0) return capital / n
  return (capital * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
}

/**
 * Calcul LMNP complet : micro-BIC vs régime réel.
 *
 * Hypothèses régime réel :
 *  - Amortissement immeuble : 85% du prix net vendeur sur 30 ans (linéaire)
 *  - Amortissement mobilier : 15% du prix net vendeur + travaux sur 7 ans
 *  - Charges : taxe foncière 10% du loyer annuel, gestion 8%, assurance PNO 200€/an,
 *    entretien 1% du prix, mensualité assurance crédit
 */
export function computeLMNP(input: LMNPInput): LMNPResult {
  const {
    prixFAI,
    surface,
    loyerMensuel,
    apport,
    travaux,
    duree,
    tauxCredit,
    tauxAssurance,
    fraisNotairesPct,
    tmi,
  } = input

  // ── Prix total ──────────────────────────────────────────────────────────────
  const fraisNotaires = prixFAI * (fraisNotairesPct / 100)
  const prixTotal = prixFAI + fraisNotaires + travaux

  // ── Crédit ─────────────────────────────────────────────────────────────────
  const capitalEmprunte = prixTotal - apport
  const mensualite = mensualiteCredit(capitalEmprunte, tauxCredit, duree)
  const mensualiteAssurance = capitalEmprunte * (tauxAssurance / 100) / 12
  const mensualiteTotale = mensualite + mensualiteAssurance
  const coutTotalCredit = mensualiteTotale * duree * 12
  const interetsTotal = coutTotalCredit - capitalEmprunte

  // ── Recettes / charges communes ────────────────────────────────────────────
  const loyerAnnuel = loyerMensuel * 12
  // Vacance locative 8%
  const recettesAnnuelles = loyerAnnuel * 0.92

  const taxeFonciere = loyerAnnuel * 0.1
  const fraisGestion = recettesAnnuelles * 0.08
  const assurancePNO = 200
  const entretien = prixFAI * 0.01
  const assuranceCredit = mensualiteAssurance * 12

  const chargesHorsCredit =
    taxeFonciere + fraisGestion + assurancePNO + entretien + assuranceCredit

  // ── Rendements brut / net ───────────────────────────────────────────────────
  const rendementBrut = (recettesAnnuelles / prixTotal) * 100
  const rendementNet = ((recettesAnnuelles - chargesHorsCredit) / prixTotal) * 100

  // ── Amortissements (régime réel) ───────────────────────────────────────────
  // Prix net vendeur = prix FAI - frais agence estimés à 5%
  const prixNetVendeur = prixFAI * 0.95
  // Immeuble : 85% du net vendeur sur 30 ans
  const amortissementImmeuble = (prixNetVendeur * 0.85) / 30
  // Mobilier : 15% du net vendeur + travaux sur 7 ans
  const amortissementMobilier = (prixNetVendeur * 0.15 + travaux) / 7
  const amortissementTotal = amortissementImmeuble + amortissementMobilier

  // ── Micro-BIC ──────────────────────────────────────────────────────────────
  // Abattement 50% sur recettes (plafond 77 700 €)
  const baseImposableMicro = recettesAnnuelles * 0.5
  // Cotisations sociales 17.2%
  const csgMicro = baseImposableMicro * 0.172
  const irMicro = baseImposableMicro * (tmi / 100)
  const impotMicro = csgMicro + irMicro

  const cashflowMensuelMicro =
    (recettesAnnuelles - chargesHorsCredit - mensualite * 12 - impotMicro) / 12

  const microBIC: RegimeFiscal = {
    label: 'Micro-BIC',
    recettesAnnuelles,
    chargesDeductibles: recettesAnnuelles * 0.5,
    baseImposable: baseImposableMicro,
    impotAnnuel: Math.round(impotMicro),
    cashflowMensuel: Math.round(cashflowMensuelMicro),
  }

  // ── Régime réel ────────────────────────────────────────────────────────────
  // Charges déductibles : charges courantes + intérêts crédit (année 1) + amortissements
  const interetsAnnee1 = capitalEmprunte * (tauxCredit / 100)
  const chargesReelles =
    chargesHorsCredit - assuranceCredit + interetsAnnee1 + amortissementTotal

  const beneficeReel = recettesAnnuelles - chargesReelles
  // Si déficit, report possible mais on suppose base = 0 pour simplifier
  const baseImposableReel = Math.max(0, beneficeReel)

  const csgReel = baseImposableReel * 0.172
  const irReel = baseImposableReel * (tmi / 100)
  const impotReel = csgReel + irReel

  const cashflowMensuelReel =
    (recettesAnnuelles - chargesHorsCredit - mensualite * 12 - impotReel) / 12

  const reel: RegimeFiscal = {
    label: 'Régime réel',
    recettesAnnuelles,
    chargesDeductibles: Math.round(chargesReelles),
    baseImposable: Math.round(baseImposableReel),
    impotAnnuel: Math.round(impotReel),
    cashflowMensuel: Math.round(cashflowMensuelReel),
  }

  return {
    prixTotal: Math.round(prixTotal),
    mensualiteCredit: Math.round(mensualiteTotale),
    coutTotalCredit: Math.round(coutTotalCredit),
    interetsTotal: Math.round(interetsTotal),
    rendementBrut: Math.round(rendementBrut * 10) / 10,
    rendementNet: Math.round(rendementNet * 10) / 10,
    microBIC,
    reel,
    amortissementImmeuble: Math.round(amortissementImmeuble),
    amortissementMobilier: Math.round(amortissementMobilier),
    amortissementTotal: Math.round(amortissementTotal),
  }

  // suppress unused warning
  void surface
}

/**
 * Calcule le TRI (Taux de Rendement Interne) sur un horizon donné.
 * Utilise la méthode de Newton-Raphson sur les flux de trésorerie actualisés.
 *
 * Flux : [-apport, CF_mensuel * 12, ..., CF_mensuel * 12 + valeur_revente]
 * Hypothèse de revente : prix d'achat + tendance DVF par an
 */
export function computeTRI(
  input: LMNPInput & { cashflowMensuelNet: number },
  tendanceDVF: number,
  horizonAns = 10
): number {
  const { prixFAI, fraisNotairesPct, travaux, apport, cashflowMensuelNet } = input
  const fraisNotaires = prixFAI * (fraisNotairesPct / 100)
  const prixTotal = prixFAI + fraisNotaires + travaux

  // Flux annuels : cash-flow net annuel
  const cfAnnuel = cashflowMensuelNet * 12

  // Valeur de revente estimée (tendance DVF annuelle sur le prix FAI)
  const tauxApreciation = 1 + tendanceDVF / 100
  const valeurRevente = prixFAI * Math.pow(tauxApreciation, horizonAns)
  // On soustrait le capital restant dû à la revente (simplification : on suppose crédit soldé)
  const plusValueNette = valeurRevente - prixTotal

  const cashflows = [
    -apport,
    ...Array(horizonAns - 1).fill(cfAnnuel),
    cfAnnuel + plusValueNette,
  ]

  // Newton-Raphson pour trouver r tel que NPV(r) = 0
  let r = 0.08
  for (let i = 0; i < 100; i++) {
    let npv = 0
    let dnpv = 0
    for (let t = 0; t < cashflows.length; t++) {
      npv += cashflows[t] / Math.pow(1 + r, t)
      dnpv -= (t * cashflows[t]) / Math.pow(1 + r, t + 1)
    }
    if (Math.abs(npv) < 0.01) break
    if (dnpv === 0) break
    r -= npv / dnpv
  }

  return Math.round(r * 1000) / 10 // retourne en %
}

/**
 * Calcule un score de risque global (0–100, plus élevé = moins risqué).
 */
export function computeRiskScore(
  input: LMNPInput,
  result: LMNPResult,
  ecartDVFPct: number,
  tendanceDVF: number
): RiskScore {
  const criteria: RiskScore['criteria'] = []

  // 1. Rendement brut (max 25 pts)
  const rendBrut = result.rendementBrut
  const ptRendement = rendBrut >= 8 ? 25 : rendBrut >= 6 ? 18 : rendBrut >= 4 ? 10 : 4
  criteria.push({ label: 'Rendement brut', score: ptRendement, max: 25, detail: `${rendBrut}%` })

  // 2. Cash-flow (max 25 pts) — prend le meilleur régime
  const cf = Math.max(result.microBIC.cashflowMensuel, result.reel.cashflowMensuel)
  const ptCf = cf >= 200 ? 25 : cf >= 0 ? 15 : cf >= -200 ? 6 : 0
  criteria.push({ label: 'Cash-flow mensuel', score: ptCf, max: 25, detail: `${cf > 0 ? '+' : ''}${cf} €/mois` })

  // 3. Positionnement prix DVF (max 20 pts) — écart négatif = bien sous-coté
  const ptDVF = ecartDVFPct <= -5 ? 20 : ecartDVFPct <= 0 ? 14 : ecartDVFPct <= 5 ? 9 : ecartDVFPct <= 10 ? 4 : 0
  criteria.push({ label: 'Prix vs marché DVF', score: ptDVF, max: 20, detail: `${ecartDVFPct > 0 ? '+' : ''}${ecartDVFPct}%` })

  // 4. Tendance de prix DVF (max 15 pts)
  const ptTendance = tendanceDVF >= 3 ? 15 : tendanceDVF >= 1 ? 10 : tendanceDVF >= 0 ? 6 : 0
  criteria.push({ label: 'Tendance marché', score: ptTendance, max: 15, detail: `${tendanceDVF > 0 ? '+' : ''}${tendanceDVF}%/an` })

  // 5. LTV (Loan-to-Value) (max 15 pts)
  const capitalEmprunte = result.prixTotal - input.apport
  const ltv = (capitalEmprunte / result.prixTotal) * 100
  const ptLTV = ltv <= 70 ? 15 : ltv <= 80 ? 11 : ltv <= 90 ? 6 : 2
  criteria.push({ label: 'Apport / LTV', score: ptLTV, max: 15, detail: `LTV ${Math.round(ltv)}%` })

  const total = criteria.reduce((s, c) => s + c.score, 0)
  const niveau: RiskScore['niveau'] = total >= 65 ? 'faible' : total >= 40 ? 'modéré' : 'élevé'

  return { total, niveau, criteria }
}
