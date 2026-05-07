import { createClient } from 'npm:@supabase/supabase-js'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

function computeTendance(transactions: { date: string; prixM2: number }[]): number {
  if (transactions.length < 4) return 0
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
  const n = quarters.length
  const xMean = (n - 1) / 2
  const yMean = quarters.reduce((s, v) => s + v, 0) / n
  let num = 0, den = 0
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (quarters[i] - yMean)
    den += (i - xMean) ** 2
  }
  const slope = den === 0 ? 0 : num / den
  return Math.round(((slope * 4) / yMean) * 1000) / 10
}

async function getCodeInsee(codePostal: string, city: string): Promise<string> {
  const url = `https://geo.api.gouv.fr/communes?codePostal=${codePostal}&fields=code,nom&format=json`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Geo API error: ${res.status}`)
  const communes = await res.json()
  if (!communes.length) throw new Error(`Commune introuvable pour ${codePostal}`)
  if (communes.length === 1) return communes[0].code
  const normalized = city.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const match = communes.find((c: { nom: string }) =>
    c.nom.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(normalized)
  )
  return (match ?? communes[0]).code
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { codePostal, city, surface, prixAnnonce } = await req.json()

    const codeInsee = await getCodeInsee(codePostal, city)

    const url = `https://api.dvf.etalab.gouv.fr/geoapi/mutations?` +
      `code_commune=${codeInsee}&nature_mutation=Vente&type_local=Appartement&` +
      `fields=date_mutation,valeur_fonciere,surface_reelle_bati`

    const res = await fetch(url)
    if (!res.ok) throw new Error(`DVF API error: ${res.status}`)

    const json = await res.json()
    const mutations: DVFMutation[] = json.features
      ? json.features.map((f: { properties: DVFMutation }) => f.properties)
      : json

    const surfaceMin = surface * 0.5
    const surfaceMax = surface * 2.0

    const transactions = mutations
      .filter((m) => {
        const s = parseFloat(m.surface_reelle_bati)
        const p = parseFloat(m.valeur_fonciere)
        return s >= surfaceMin && s <= surfaceMax && p > 10000 && p < 5000000
      })
      .map((m) => ({
        date: m.date_mutation,
        prix: parseFloat(m.valeur_fonciere),
        surface: parseFloat(m.surface_reelle_bati),
        prixM2: Math.round(parseFloat(m.valeur_fonciere) / parseFloat(m.surface_reelle_bati)),
      }))

    if (transactions.length === 0) {
      throw new Error(`Aucune transaction DVF trouvee pour ${city} (${codePostal})`)
    }

    const prixM2s = transactions.map((t) => t.prixM2)
    const med = Math.round(median(prixM2s))
    const p10 = Math.round(percentile(prixM2s, 10))
    const p90 = Math.round(percentile(prixM2s, 90))
    const tendance = computeTendance(transactions)
    const prixM2Annonce = prixAnnonce / surface
    const ecartPourcent = Math.round(((prixM2Annonce - med) / med) * 1000) / 10

    return new Response(
      JSON.stringify({ codeInsee, mediane: med, p10, p90, tendance, ecartPourcent, transactions, nbTransactions: transactions.length }),
      { headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur interne'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }
})
