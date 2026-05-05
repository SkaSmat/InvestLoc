import { useState } from 'react'
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { MapPin, Loader2, AlertCircle, Bus, ShoppingBag, GraduationCap, Shield, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { fetchQuartierScore } from '@/lib/quartier'
import type { PropertyData, QuartierAxe, QuartierScore } from '@/types'

interface QuartierSectionProps {
  property: PropertyData
}

const AXES: {
  key: keyof Omit<QuartierScore, 'total' | 'synthese'>
  label: string
  icon: React.ElementType
}[] = [
  { key: 'transports', label: 'Transports', icon: Bus },
  { key: 'commerces', label: 'Commerces', icon: ShoppingBag },
  { key: 'ecoles', label: 'Écoles', icon: GraduationCap },
  { key: 'securite', label: 'Sécurité', icon: Shield },
  { key: 'dynamiqueImmo', label: 'Dynamique immo', icon: TrendingUp },
]

function ScoreDots({ score }: { score: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={`h-2 w-2 rounded-full ${
            i < score ? 'bg-primary' : 'bg-muted'
          }`}
        />
      ))}
    </div>
  )
}

function AxeRow({ axe, label, icon: Icon }: { axe: QuartierAxe; label: string; icon: React.ElementType }) {
  const color =
    axe.score >= 4 ? 'text-green-600' : axe.score >= 3 ? 'text-yellow-600' : 'text-destructive'

  return (
    <div className="flex items-start gap-3 py-2">
      <Icon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium">{label}</span>
          <div className="flex items-center gap-2 shrink-0">
            <ScoreDots score={axe.score} />
            <span className={`text-sm font-bold w-3 ${color}`}>{axe.score}</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
          {axe.justification}
        </p>
      </div>
    </div>
  )
}

function TotalBadge({ total }: { total: number }) {
  const color =
    total >= 20 ? 'text-green-600 bg-green-50' :
    total >= 15 ? 'text-yellow-600 bg-yellow-50' :
    'text-destructive bg-destructive/10'
  const label =
    total >= 20 ? 'Quartier excellent' :
    total >= 15 ? 'Quartier correct' :
    total >= 10 ? 'Quartier moyen' : 'Quartier difficile'

  return (
    <div className={`rounded-lg px-4 py-3 flex items-center justify-between ${color}`}>
      <span className="text-sm font-semibold">{label}</span>
      <span className="text-2xl font-bold">{total}<span className="text-sm font-normal">/25</span></span>
    </div>
  )
}

export function QuartierSection({ property }: QuartierSectionProps) {
  const [score, setScore] = useState<QuartierScore | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleScore() {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchQuartierScore(property.city, property.postalCode, property.address)
      setScore(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du scoring')
    } finally {
      setLoading(false)
    }
  }

  const radarData = score
    ? AXES.map(({ key, label }) => ({
        subject: label,
        score: (score[key] as QuartierAxe).score,
        fullMark: 5,
      }))
    : []

  // ── État initial ──────────────────────────────────────────────────────────────
  if (!score && !loading) {
    return (
      <div className="text-center py-8 space-y-3">
        <MapPin className="h-10 w-10 mx-auto text-muted-foreground/40" />
        <div>
          <p className="text-sm font-medium">{property.city} ({property.postalCode})</p>
          <p className="text-xs text-muted-foreground mt-1">
            Analyse IA du quartier sur 5 axes — transports, commerces, écoles, sécurité, dynamique immo
          </p>
        </div>
        <Button onClick={handleScore} className="gap-2">
          <MapPin className="h-4 w-4" />
          Scorer le quartier
        </Button>
        <p className="text-xs text-muted-foreground">Utilise Claude + recherche web (~10s)</p>
      </div>
    )
  }

  // ── Chargement ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Recherche en cours sur {property.city}…
        </div>
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-6 w-2/4" />
        <Skeleton className="h-6 w-3/4" />
      </div>
    )
  }

  // ── Erreur ────────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
        <Button variant="outline" size="sm" onClick={handleScore}>
          Réessayer
        </Button>
      </div>
    )
  }

  // ── Résultats ─────────────────────────────────────────────────────────────────
  if (!score) return null

  return (
    <div className="space-y-5">
      <TotalBadge total={score.total} />

      {/* Radar chart */}
      <ResponsiveContainer width="100%" height={240}>
        <RadarChart data={radarData}>
          <PolarGrid stroke="hsl(var(--border))" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          />
          <PolarRadiusAxis
            domain={[0, 5]}
            tick={{ fontSize: 9 }}
            tickCount={6}
            stroke="hsl(var(--border))"
          />
          <Tooltip
            formatter={(v: number) => [`${v}/5`, 'Score']}
          />
          <Radar
            dataKey="score"
            stroke="hsl(var(--primary))"
            fill="hsl(var(--primary))"
            fillOpacity={0.25}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>

      {/* Détail par axe */}
      <div className="divide-y divide-border">
        {AXES.map(({ key, label, icon }) => (
          <AxeRow
            key={key}
            axe={score[key] as QuartierAxe}
            label={label}
            icon={icon}
          />
        ))}
      </div>

      {/* Synthèse */}
      {score.synthese && (
        <div className="rounded-lg bg-muted/30 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
            Synthèse IA
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">{score.synthese}</p>
        </div>
      )}

      <Button variant="ghost" size="sm" onClick={handleScore} className="gap-1.5">
        <Loader2 className="h-3.5 w-3.5" />
        Rafraîchir l'analyse
      </Button>
    </div>
  )
}
