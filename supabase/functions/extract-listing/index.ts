// Supabase Edge Function — Deno runtime
// Extrait les données structurées d'une annonce immobilière via Claude tool_use.
// La clé ANTHROPIC_API_KEY est stockée en secret Supabase, jamais exposée côté frontend.

import Anthropic from 'npm:@anthropic-ai/sdk@0.24.0'
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const client = new Anthropic({
  apiKey: Deno.env.get('ANTHROPIC_API_KEY'),
})

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
)

const CACHE_TTL_DAYS = 7

// Outil Claude : forcer une sortie JSON structurée
const extractTool: Anthropic.Tool = {
  name: 'extract_property',
  description:
    "Extrait les donnees structurees d'une annonce immobiliere depuis son contenu textuel.",
  input_schema: {
    type: 'object' as const,
    properties: {
      title: { type: 'string', description: "Titre de l'annonce" },
      price: { type: 'number', description: 'Prix FAI en euros' },
      surface: { type: 'number', description: 'Surface habitable en m²' },
      rooms: { type: 'integer', description: 'Nombre de pièces' },
      address: { type: 'string', description: 'Adresse complète ou partielle' },
      postalCode: {
        type: 'string',
        description: 'Code postal (5 chiffres)',
        pattern: '^\\d{5}$',
      },
      city: { type: 'string', description: 'Nom de la ville' },
      condition: {
        type: 'string',
        enum: ['neuf', 'bon', 'moyen', 'travaux'],
        description: 'État général du bien',
      },
      publishedAt: {
        type: 'string',
        description: 'Date de publication au format ISO 8601 (YYYY-MM-DD), null si inconnue',
        nullable: true,
      },
      description: { type: 'string', description: 'Description complète du bien' },
      images: {
        type: 'array',
        items: { type: 'string' },
        description: 'URLs des photos (peut être vide)',
      },
    },
    required: [
      'title',
      'price',
      'surface',
      'rooms',
      'address',
      'postalCode',
      'city',
      'condition',
      'description',
    ],
  },
}

async function fetchAndScrape(url: string): Promise<{ html: string; scraperUsed: string }> {
  let html = ''
  let scraperUsed = 'direct'

  // Tier 1 : fetch direct (fonctionne sur PAP, certains sites sans protection)
  try {
    const directRes = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9',
      },
      signal: AbortSignal.timeout(8000),
    })
    if (directRes.ok) {
      const raw = await directRes.text()
      const stripped = raw.replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ')
      if (stripped.split(' ').length > 300) {
        return { html: raw, scraperUsed: 'direct' }
      }
    }
  } catch { /* next tier */ }

  // Tier 2 : Jina AI Reader (gratuit, ~200 req/jour, bon pour pages statiques)
  try {
    const jinaRes = await fetch(`https://r.jina.ai/${encodeURIComponent(url)}`, {
      headers: { 'Accept': 'text/html', 'X-Return-Format': 'html' },
      signal: AbortSignal.timeout(10000),
    })
    if (jinaRes.ok) {
      const raw = await jinaRes.text()
      const stripped = raw.replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ')
      if (stripped.split(' ').length > 300) {
        return { html: raw, scraperUsed: 'jina' }
      }
    }
  } catch { /* next tier */ }

  // Tier 3 : Firecrawl (500 crédits/mois gratuits, JS rendering)
  const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY')
  if (firecrawlKey) {
    try {
      const fcRes = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${firecrawlKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          formats: ['html'],
          actions: [{ type: 'wait', milliseconds: 2000 }],
        }),
        signal: AbortSignal.timeout(30000),
      })
      if (fcRes.ok) {
        const fcData = await fcRes.json()
        const raw: string = fcData?.data?.html ?? ''
        const stripped = raw.replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ')
        if (stripped.split(' ').length > 300) {
          return { html: raw, scraperUsed: 'firecrawl' }
        }
      }
    } catch { /* next tier */ }
  }

  // Tier 4 : ScrapingBee (payant — uniquement si clé encore présente)
  const scrapingBeeKey = Deno.env.get('SCRAPINGBEE_API_KEY')
  if (scrapingBeeKey) {
    const params = new URLSearchParams({
      api_key: scrapingBeeKey,
      url,
      render_js: 'true',
      premium_proxy: 'true',
      country_code: 'fr',
      block_ads: 'true',
      wait: '2000',
    })
    const pageRes = await fetch(`https://app.scrapingbee.com/api/v1/?${params}`, {
      signal: AbortSignal.timeout(30000),
    })
    if (pageRes.ok) {
      return { html: await pageRes.text(), scraperUsed: 'scrapingbee' }
    }
  }

  if (!html) throw new Error("Impossible de récupérer l'annonce (tous les scrapers ont échoué)")
  return { html, scraperUsed }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { url } = await req.json()
    if (!url || typeof url !== 'string') {
      return new Response(JSON.stringify({ error: 'url manquante' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Vérifier le cache Supabase (TTL 7 jours) ──────────────────────────────
    const { data: cached } = await supabase
      .from('listing_cache')
      .select('data, scraped_at')
      .eq('url', url)
      .single()

    if (cached) {
      const age = (Date.now() - new Date(cached.scraped_at).getTime()) / (1000 * 60 * 60 * 24)
      if (age < CACHE_TTL_DAYS) {
        console.log(`Cache hit for ${url} (age: ${age.toFixed(1)} days)`)
        return new Response(JSON.stringify(cached.data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'HIT' },
        })
      }
    }

    // ── Scraping ──────────────────────────────────────────────────────────────
    const { html, scraperUsed } = await fetchAndScrape(url)

    console.log(`Scraper used: ${scraperUsed} for ${url}`)
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .slice(0, 15000)

    // ── Appel Claude avec tool_use ────────────────────────────────────────────
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      tools: [extractTool],
      tool_choice: { type: 'tool', name: 'extract_property' },
      messages: [
        {
          role: 'user',
          content: `Extrais les données de cette annonce immobilière française.\n\nURL : ${url}\n\nContenu de la page :\n${text}`,
        },
      ],
    })

    const toolUse = response.content.find((b) => b.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') {
      throw new Error("Claude n'a pas retourne de resultat structure")
    }

    const propertyData = { ...(toolUse.input as Record<string, unknown>), url }

    // ── Mettre en cache ───────────────────────────────────────────────────────
    await supabase
      .from('listing_cache')
      .upsert({ url, data: propertyData, scraped_at: new Date().toISOString() }, { onConflict: 'url' })

    return new Response(JSON.stringify(propertyData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'MISS' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
