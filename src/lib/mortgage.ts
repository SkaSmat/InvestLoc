import type { LMNPInput, LMNPResult, RegimeFiscal } from '@/types'

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
