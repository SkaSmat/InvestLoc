// Supabase Edge Function — Deno runtime
// Chasseur autonome quotidien : scan annonces → pipeline DVF + LMNP + négo → score /100
// Déclenchée par pg_cron chaque matin à 7h ou manuellement.

import Anthropic from 'npm:@anthropic-ai/sdk@0.24.0'
import { createClient } from 'npm:@supabase/supabase-js@2'

// ─── Clients ──────────────────────────────────────────────────────────────────

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─── Types internes ───────────────────────────────────────────────────────────

interface RawListing {
  url: string
  title: string
  price: number
  surface: number
  rooms: number
  city: string
  postalCode: string
  condition: 'neuf' | 'bon' | 'moyen' | 'travaux'
  publishedAt: string | null
  description: string
}

interface DVFStats {
  mediane: number
  ecartPourcent: number
  nbTransactions: number
}

interface PipelineResult {
  listing: RawListing
  dvfEcartPct: number
  rendementBrut: number
  scoreDvf: number
  scoreRentabilite: number
  scoreQuartier: number
  scoreNego: number
  scoreTotal: number
}

interface SearchProfile {
  zones: string[]
  budget_max: number
  rendement_min_brut: number
  surface_min: number
  surface_max: number
}

// ─── Scoring DVF (0-40 pts) ───────────────────────────────────────────────────

function scoreDVF(ecartPct: number): number {
  if (ecartPct < -10) return 40
  if (ecartPct < -5) return 32
  if (ecartPct < 0) return 24
  if (ecartPct < 5) return 16
  if (ecartPct < 10) return 8
  return 0
}

// ─── Scoring rentabilité (0-30 pts) ──────────────────────────────────────────

function scoreRentabilite(rendementBrut: number): number {
  if (rendementBrut >= 9) return 30
  if (rendementBrut >= 8) return 24
  if (rendementBrut >= 7) return 18
  if (rendementBrut >= 6) return 12
  if (rendementBrut >= 5) return 6
  return 0
}

// ─── Scoring quartier par zone (0-20 pts) ────────────────────────────────────
// Proxy rapide basé sur le département IDF — pas d'API call par listing

function scoreZone(postalCode: string): number {
  const dept = postalCode.slice(0, 2)
  const scores: Record<string, number> = {
    '75': 20, // Paris
    '92': 18, // Hauts-de-Seine
    '94': 15, // Val-de-Marne
    '78': 14, // Yvelines
    '91': 13, // Essonne
    '93': 11, // Seine-Saint-Denis
    '77': 9,  // Seine-et-Marne
    '95': 9,  // Val-d'Oise
  }
  return scores[dept] ?? 10
}

// ─── Scoring négociation (0-10 pts) ──────────────────────────────────────────

function scoreNego(
  ecartPct: number,
  condition: RawListing['condition'],
  publishedAt: string | null
): number {
  let s = 0
  // DVF
  if (ecartPct > 10) s += 4
  else if (ecartPct > 5) s += 2
  // État
  if (condition === 'travaux') s += 3
  else if (condition === 'moyen') s += 2
  // Ancienneté
  if (publishedAt) {
    const days = Math.floor((Date.now() - new Date(publishedAt).getTime()) / 86400000)
    if (days > 60) s += 3
    else if (days > 30) s += 2
    else if (days > 14) s += 1
  }
  return Math.min(s, 10)
}

// ─── LMNP rendement brut (sans crédit) ───────────────────────────────────────

function computeRendementBrut(price: number, surface: number): number {
  // Loyer estimé : 18€/m²/mois en IDF (hypothèse conservative)
  const loyerMensuel = surface * 18
  const loyerAnnuel = loyerMensuel * 12 * 0.92 // vacance 8%
  const prixTotal = price * 1.075 // frais notaires 7.5%
  return (loyerAnnuel / prixTotal) * 100
}

// ─── Appel DVF ────────────────────────────────────────────────────────────────

async function fetchDVFEcart(
  postalCode: string,
  city: string,
  surface: number,
  price: number
): Promise<DVFStats> {
  // Résolution code INSEE
  const geoRes = await fetch(
    `https://geo.api.gouv.fr/communes?codePostal=${postalCode}&fields=code,nom&format=json`
  )
  const communes = await geoRes.json()
  if (!communes.length) throw new Error(`Commune inconnue: ${postalCode}`)
  const cityNorm = city.toLowerCase().normalize('NFD').replace(/\p{Mn}/gu, '')
  const match = communes.find((c: { nom: string }) => {
    const n = c.nom.toLowerCase().normalize('NFD').replace(/\p{Mn}/gu, '')
    return n.includes(cityNorm) || cityNorm.includes(n)
  }) ?? communes[0]
  const codeInsee = match.code

  const dvfRes = await fetch(
    `https://api.dvf.etalab.gouv.fr/geoapi/mutations?` +
    `code_commune=${codeInsee}&nature_mutation=Vente&type_local=Appartement&` +
    `fields=valeur_fonciere,surface_reelle_bati`
  )
  const json = await dvfRes.json()
  const mutations = json.features
    ? json.features.map((f: { properties: Record<string, string> }) => f.properties)
    : json

  const surfaceMin = surface * 0.5
  const surfaceMax = surface * 2
  const prixM2s: number[] = mutations
    .filter((m: Record<string, string>) => {
      const s = parseFloat(m.surface_reelle_bati)
      const p = parseFloat(m.valeur_fonciere)
      return s >= surfaceMin && s <= surfaceMax && p > 10000 && p < 5000000
    })
    .map((m: Record<string, string>) =>
      Math.round(parseFloat(m.valeur_fonciere) / parseFloat(m.surface_reelle_bati))
    )

  if (!prixM2s.length) return { mediane: 0, ecartPourcent: 0, nbTransactions: 0 }

  const sorted = [...prixM2s].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const mediane = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
  const prixM2Annonce = price / surface
  const ecartPourcent = Math.round(((prixM2Annonce - mediane) / mediane) * 1000) / 10

  return { mediane, ecartPourcent, nbTransactions: prixM2s.length }
}

// ─── Recherche Claude web_search ─────────────────────────────────────────────

async function searchListings(profile: SearchProfile): Promise<RawListing[]> {
  const zonesLabel = profile.zones.join(', ')
  const today = new Date().toISOString().split('T')[0]

  const prompt = `Tu es un chasseur immobilier expert en LMNP meublé.
Aujourd'hui c'est le ${today}. Recherche des appartements mis en vente dans les dernières 48h
sur SeLoger, LeBonCoin, BienIci et PAP correspondant à ce profil :

- Zones : ${zonesLabel} (départements IDF)
- Budget max : ${profile.budget_max.toLocaleString('fr-FR')} € FAI
- Surface : ${profile.surface_min}–${profile.surface_max} m²
- Type : appartements uniquement

Pour chaque annonce trouvée, extrais les informations disponibles.
Retourne entre 3 et 8 annonces réelles avec leur URL.`

  const listingsTool: Anthropic.Tool = {
    name: 'save_listings',
    description: 'Sauvegarde la liste des annonces trouvées',
    input_schema: {
      type: 'object' as const,
      properties: {
        listings: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              url: { type: 'string' },
              title: { type: 'string' },
              price: { type: 'number' },
              surface: { type: 'number' },
              rooms: { type: 'integer' },
              city: { type: 'string' },
              postalCode: { type: 'string', pattern: '^\\d{5}$' },
              condition: { type: 'string', enum: ['neuf', 'bon', 'moyen', 'travaux'] },
              publishedAt: { type: 'string', nullable: true },
              description: { type: 'string' },
            },
            required: ['url', 'title', 'price', 'surface', 'rooms', 'city', 'postalCode'],
          },
        },
      },
      required: ['listings'],
    },
  }

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    tools: [
      // @ts-ignore
      { type: 'web_search_20250305', name: 'web_search' },
      listingsTool,
    ],
    messages: [{ role: 'user', content: prompt }],
  })

  const toolUse = response.content.find(
    (b) => b.type === 'tool_use' && b.name === 'save_listings'
  )
  if (!toolUse || toolUse.type !== 'tool_use') return []

  const { listings } = toolUse.input as { listings: RawListing[] }
  return listings.filter(
    (l) =>
      l.price > 0 &&
      l.price <= profile.budget_max &&
      l.surface >= profile.surface_min &&
      l.surface <= profile.surface_max
  )
}

// ─── Pipeline complet pour un listing ────────────────────────────────────────

async function processListing(listing: RawListing): Promise<PipelineResult | null> {
  try {
    const dvf = await fetchDVFEcart(
      listing.postalCode,
      listing.city,
      listing.surface,
      listing.price
    )
    const rendement = computeRendementBrut(listing.price, listing.surface)

    const s1 = scoreDVF(dvf.ecartPourcent)
    const s2 = scoreRentabilite(rendement)
    const s3 = scoreZone(listing.postalCode)
    const s4 = scoreNego(dvf.ecartPourcent, listing.condition ?? 'bon', listing.publishedAt)
    const total = s1 + s2 + s3 + s4

    return {
      listing,
      dvfEcartPct: dvf.ecartPourcent,
      rendementBrut: Math.round(rendement * 10) / 10,
      scoreDvf: s1,
      scoreRentabilite: s2,
      scoreQuartier: s3,
      scoreNego: s4,
      scoreTotal: total,
    }
  } catch {
    return null
  }
}

// ─── Sauvegarde en BDD ────────────────────────────────────────────────────────

async function saveOpportunity(result: PipelineResult): Promise<void> {
  const { listing } = result

  // Déduplique sur l'URL
  const { data: existing } = await supabase
    .from('opportunities')
    .select('id')
    .eq('listing_url', listing.url)
    .maybeSingle()

  if (existing) return

  await supabase.from('opportunities').insert({
    listing_url: listing.url,
    title: listing.title,
    price: listing.price,
    surface: listing.surface,
    city: listing.city,
    postal_code: listing.postalCode,
    rendement_brut: result.rendementBrut,
    score_total: result.scoreTotal,
    score_dvf: result.scoreDvf,
    score_rentabilite: result.scoreRentabilite,
    score_quartier: result.scoreQuartier,
    score_nego: result.scoreNego,
    dvf_ecart_pct: result.dvfEcartPct,
    published_at: listing.publishedAt,
  })
}

// ─── Handler principal ────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const startedAt = Date.now()
  const log: string[] = []

  try {
    // 1. Lire les profils de chasse
    const { data: profiles } = await supabase.from('search_profiles').select('*')
    const activeProfiles: SearchProfile[] = profiles ?? [
      {
        zones: ['75', '77', '78', '91', '92', '93', '94', '95'],
        budget_max: 200000,
        rendement_min_brut: 7,
        surface_min: 15,
        surface_max: 60,
      },
    ]

    log.push(`${activeProfiles.length} profil(s) de chasse actif(s)`)

    let totalFound = 0
    let totalSaved = 0

    for (const profile of activeProfiles) {
      // 2. Recherche Claude + web_search
      log.push(`Recherche annonces pour zones [${profile.zones.join(',')}]…`)
      const listings = await searchListings(profile)
      log.push(`${listings.length} annonce(s) trouvée(s)`)
      totalFound += listings.length

      // 3. Pipeline complet par listing (en parallèle, max 5 à la fois)
      const chunks: RawListing[][] = []
      for (let i = 0; i < listings.length; i += 5) chunks.push(listings.slice(i, i + 5))

      for (const chunk of chunks) {
        const results = await Promise.all(chunk.map(processListing))
        for (const result of results) {
          if (!result) continue
          log.push(
            `${result.listing.city} ${result.listing.postalCode} — ` +
            `${result.listing.price.toLocaleString('fr-FR')}€ — ` +
            `score ${result.scoreTotal}/100 — ` +
            `rendement ${result.rendementBrut}%`
          )
          // 4. Sauvegarder si score >= 60
          if (result.scoreTotal >= 60) {
            await saveOpportunity(result)
            totalSaved++
            log.push(`  ✓ Sauvegardée (score ${result.scoreTotal}/100)`)
          }
        }
      }
    }

    const duration = Math.round((Date.now() - startedAt) / 1000)
    log.push(`Terminé en ${duration}s — ${totalFound} trouvées, ${totalSaved} sauvegardées`)

    return new Response(
      JSON.stringify({ success: true, totalFound, totalSaved, log }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    return new Response(
      JSON.stringify({ success: false, error: message, log }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
