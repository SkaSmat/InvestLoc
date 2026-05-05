import { useEffect, useState } from 'react'
import { ExternalLink, RefreshCw, TrendingUp, Trophy, AlertCircle, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { getOpportunities } from '@/lib/supabase'
import { formatPrice, formatPct } from '@/lib/utils'
import type { Opportunity } from '@/types'

// ─── Score badge ──────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  if (score >= 80)
    return <Badge className="bg-green-600 hover:bg-green-600 text-white">{score}/100 ★</Badge>
  if (score >= 70)
    return <Badge className="bg-blue-600 hover:bg-blue-600 text-white">{score}/100</Badge>
  return <Badge variant="secondary">{score}/100</Badge>
}

// ─── Barre de score décomposée ────────────────────────────────────────────────

function ScoreBreakdown({ opp }: { opp: Opportunity }) {
  const segments = [
    { label: 'DVF', value: opp.scoreDvf, max: 40, color: 'bg-blue-500' },
    { label: 'Renta', value: opp.scoreRentabilite, max: 30, color: 'bg-green-500' },
    { label: 'Zone', value: opp.scoreQuartier, max: 20, color: 'bg-yellow-500' },
    { label: 'Négo', value: opp.scoreNego, max: 10, color: 'bg-orange-500' },
  ]

  return (
    <div className="space-y-1.5">
      <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
        {segments.map(({ label, value, max, color }) => (
          <div
            key={label}
            className={`${color} opacity-80`}
            style={{ width: `${(value / max) * (max)}%`, flex: `0 0 ${(value / 100) * 100}%` }}
            title={`${label}: ${value}/${max}`}
          />
        ))}
        <div className="bg-muted flex-1" />
      </div>
      <div className="flex gap-3 text-xs text-muted-foreground">
        {segments.map(({ label, value, max }) => (
          <span key={label}>
            <span className="font-medium text-foreground">{value}</span>/{max} {label}
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── Carte opportunité ────────────────────────────────────────────────────────

function OpportunityCard({ opp }: { opp: Opportunity }) {
  const ecartColor =
    (opp.dvfEcartPct ?? 0) <= -5 ? 'text-green-600' :
    (opp.dvfEcartPct ?? 0) <= 5 ? 'text-foreground' : 'text-destructive'

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-4 pb-4 space-y-3">
        {/* En-tête */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-snug line-clamp-2">{opp.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {opp.city} · {opp.postalCode}
            </p>
          </div>
          <ScoreBadge score={opp.scoreTotal} />
        </div>

        {/* Prix & métriques */}
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Prix</p>
            <p className="font-bold">{formatPrice(opp.price)}</p>
            <p className="text-xs text-muted-foreground">
              {opp.surface ? `${Math.round(opp.price / opp.surface).toLocaleString('fr-FR')} €/m²` : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Rendement brut</p>
            <p className={`font-bold ${opp.rendementBrut >= 7 ? 'text-green-600' : opp.rendementBrut >= 5 ? 'text-yellow-600' : 'text-destructive'}`}>
              {formatPct(opp.rendementBrut)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Écart DVF</p>
            <p className={`font-bold ${ecartColor}`}>
              {(opp.dvfEcartPct ?? 0) > 0 ? '+' : ''}{formatPct(opp.dvfEcartPct ?? 0)}
            </p>
          </div>
        </div>

        {/* Barre score */}
        <ScoreBreakdown opp={opp} />

        {/* Action */}
        <div className="flex items-center justify-between pt-1">
          {opp.publishedAt && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(opp.publishedAt).toLocaleDateString('fr-FR')}
            </span>
          )}
          <Button variant="outline" size="sm" asChild className="ml-auto gap-1.5">
            <a href={opp.listingUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
              Voir l'annonce
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────

export function OpportunitiesPage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await getOpportunities()
      setOpportunities(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const top = opportunities.filter((o) => o.scoreTotal >= 70)
  const others = opportunities.filter((o) => o.scoreTotal < 70)

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      {/* En-tête */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-1">Opportunités</h1>
          <p className="text-muted-foreground text-sm">
            Biens détectés automatiquement chaque matin — score ≥ 60/100
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      {/* Erreur */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-md bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="h-5 w-5 shrink-0" />
          {error}
        </div>
      )}

      {/* Chargement */}
      {loading && (
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      )}

      {/* Vide */}
      {!loading && !error && opportunities.length === 0 && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-muted-foreground">
              <TrendingUp className="h-5 w-5" />
              Aucune opportunité pour l'instant
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              Le chasseur automatique tourne chaque matin à 7h. Les biens avec un score ≥ 60/100
              apparaissent ici.
            </p>
            <p className="text-xs">
              Pour déclencher une recherche manuellement, appelez la Edge Function{' '}
              <code className="bg-muted px-1 rounded">daily-scraper</code> depuis le dashboard Supabase.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Top opportunités ≥ 70 */}
      {!loading && top.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-yellow-500" />
            <h2 className="text-sm font-semibold">Meilleures opportunités</h2>
            <Badge variant="secondary">{top.length}</Badge>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {top.map((opp) => (
              <OpportunityCard key={opp.id} opp={opp} />
            ))}
          </div>
        </div>
      )}

      {/* Autres ≥ 60 */}
      {!loading && others.length > 0 && (
        <>
          {top.length > 0 && <Separator />}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground">Autres opportunités</h2>
            <div className="grid grid-cols-2 gap-4">
              {others.map((opp) => (
                <OpportunityCard key={opp.id} opp={opp} />
              ))}
            </div>
          </div>
        </>
      )}

      {/* Légende scoring */}
      {!loading && opportunities.length > 0 && (
        <div className="rounded-lg bg-muted/30 p-4 text-xs text-muted-foreground space-y-1">
          <p className="font-semibold text-foreground">Composition du score /100</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 mt-1">
            <span>🔵 DVF — positionnement prix marché (0–40 pts)</span>
            <span>🟢 Rentabilité — rendement brut estimé (0–30 pts)</span>
            <span>🟡 Zone — attractivité du département IDF (0–20 pts)</span>
            <span>🟠 Négo — potentiel de négociation (0–10 pts)</span>
          </div>
        </div>
      )}
    </div>
  )
}
