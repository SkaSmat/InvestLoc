import type { DVFAnalysisResult, DVFTransaction } from '@/types'
import { getCodeInsee } from './geo'

interface DVFMutation {
  date_mutation: string
  valeur_fonciere: string
  surface_reelle_bati: string
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.floor((p / 100) * sorted.length)
  return sorted[Math.min(idx, sorted.length - 1)]
}

/**
 * Calcule la tendance annuelle (% / an) par régression linéaire simple sur
 * la médiane des prix/m² trimestriels.
 */
function computeTendance(transactions: DVFTransaction[]): number {
  if (transactions.length < 4) return 0

  // Grouper par trimestre
  const byQuarter = new Map<string, number[]>()
  for (const t of transactions) {
    const d = new Date(t.date)
    const key = `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`
    if (!byQuarter.has(key)) byQuarter.set(key, [])
    byQuarter.get(key)!.push(t.prixM2)
  }

  const quarters = Array.from(byQuarter.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, prices]) => median(prices))

  if (quarters.length < 2) return 0

  // Régression linéaire (moindres carrés)
  const n = quarters.length
  const xMean = (n - 1) / 2
  const yMean = quarters.reduce((s, v) => s + v, 0) / n
  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (quarters[i] - yMean)
    den += (i - xMean) ** 2
  }
  const slope = den === 0 ? 0 : num / den
  // slope = €/m² par trimestre → annualiser et convertir en %
  const tendancePctAn = den === 0 ? 0 : ((slope * 4) / yMean) * 100
  return Math.round(tendancePctAn * 10) / 10
}

/**
 * Récupère les mutations DVF pour une commune + calcule les stats marché.
 * Filtre sur les appartements dont la surface est dans [surface*0.5, surface*2].
 */
export async function fetchDVFStats(
  codePostal: string,
  city: string,
  surface: number,
  prixAnnonce: number
): Promise<DVFAnalysisResult> {
  const codeInsee = await getCodeInsee(codePostal, city)

  const url =
    `https://api.dvf.etalab.gouv.fr/geoapi/mutations?` +
    `code_commune=${codeInsee}&nature_mutation=Vente&type_local=Appartement&` +
    `fields=date_mutation,valeur_fonciere,surface_reelle_bati`

  const res = await fetch(url)
  if (!res.ok) throw new Error(`DVF API error: ${res.status}`)

  const json = await res.json()
  const mutations: DVFMutation[] = json.features
    ? json.features.map((f: { properties: DVFMutation }) => f.properties)
    : json

  // Filtrer : surface cohérente, prix raisonnable
  const surfaceMin = surface * 0.5
  const surfaceMax = surface * 2.0

  const transactions: DVFTransaction[] = mutations
    .filter((m) => {
      const s = parseFloat(m.surface_reelle_bati)
      const p = parseFloat(m.valeur_fonciere)
      return s >= surfaceMin && s <= surfaceMax && p > 10000 && p < 5000000
    })
    .map((m) => {
      const s = parseFloat(m.surface_reelle_bati)
      const p = parseFloat(m.valeur_fonciere)
      return {
        date: m.date_mutation,
        prix: p,
        surface: s,
        prixM2: Math.round(p / s),
      }
    })

  if (transactions.length === 0) {
    throw new Error(`Aucune transaction DVF trouvée pour ${city} (${codePostal})`)
  }

  const prixM2s = transactions.map((t) => t.prixM2)
  const med = Math.round(median(prixM2s))
  const p10 = Math.round(percentile(prixM2s, 10))
  const p90 = Math.round(percentile(prixM2s, 90))
  const tendance = computeTendance(transactions)

  const prixM2Annonce = prixAnnonce / surface
  const ecartPourcent = Math.round(((prixM2Annonce - med) / med) * 1000) / 10

  return {
    codeInsee,
    mediane: med,
    p10,
    p90,
    tendance,
    ecartPourcent,
    transactions,
    nbTransactions: transactions.length,
  }
}
