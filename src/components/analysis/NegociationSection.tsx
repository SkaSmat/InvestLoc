import { useMemo } from 'react'
import { MessageSquare, TrendingDown, AlertTriangle, CheckCircle, Copy } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { computeNegociation } from '@/lib/negociation'
import { formatPrice, formatPct } from '@/lib/utils'
import type { PropertyData, DVFAnalysisResult } from '@/types'

interface NegociationSectionProps {
  property: PropertyData
  dvf: DVFAnalysisResult
}

const potentielConfig = {
  faible: { label: 'Faible', color: 'text-muted-foreground', bg: 'bg-muted/40', icon: CheckCircle },
  modéré: { label: 'Modéré', color: 'text-yellow-600', bg: 'bg-yellow-50', icon: AlertTriangle },
  bon: { label: 'Bon', color: 'text-blue-600', bg: 'bg-blue-50', icon: TrendingDown },
  fort: { label: 'Fort', color: 'text-green-600', bg: 'bg-green-50', icon: TrendingDown },
}

function ScoreBar({ score, max }: { score: number; max: number }) {
  const pct = Math.round((score / max) * 100)
  const color =
    pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-yellow-500' : pct >= 15 ? 'bg-blue-400' : 'bg-muted-foreground/30'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground w-10 text-right">
        {score}/{max}
      </span>
    </div>
  )
}

export function NegociationSection({ property, dvf }: NegociationSectionProps) {
  const result = useMemo(() => computeNegociation(property, dvf), [property, dvf])
  const config = potentielConfig[result.potentiel]
  const Icon = config.icon

  function copyArguments() {
    const text = result.arguments.map((a, i) => `${i + 1}. ${a}`).join('\n\n')
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="space-y-6">
      {/* Score global */}
      <div className={`rounded-lg p-4 flex items-center justify-between ${config.bg}`}>
        <div className="flex items-center gap-3">
          <Icon className={`h-6 w-6 ${config.color}`} />
          <div>
            <p className="text-sm font-semibold">
              Potentiel de négociation{' '}
              <span className={config.color}>{config.label}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Score {result.scoreTotal}/100
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Remise conseillée</p>
          <p className={`text-xl font-bold ${config.color}`}>
            -{formatPct(result.remisePct, 0)}
          </p>
        </div>
      </div>

      {/* Facteurs */}
      <div className="space-y-3">
        <p className="text-sm font-medium">Facteurs analysés</p>
        {result.factors.map((f) => (
          <div key={f.label} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="font-medium">{f.label}</span>
            </div>
            <ScoreBar score={f.score} max={f.maxScore} />
            <p className="text-xs text-muted-foreground">{f.detail}</p>
          </div>
        ))}
      </div>

      <Separator />

      {/* Fourchette d'offre */}
      <div>
        <p className="text-sm font-medium mb-3">Fourchette d'offre</p>
        <div className="grid grid-cols-2 gap-3">
          <Card className="border-primary/30">
            <CardContent className="pt-4 pb-4 text-center">
              <Badge className="mb-2">Offre recommandée</Badge>
              <p className="text-2xl font-bold text-primary">
                {formatPrice(result.offreRecommandee)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                -{formatPct(result.remisePct, 0)} soit{' '}
                {formatPrice(property.price - result.offreRecommandee)} de remise
              </p>
            </CardContent>
          </Card>
          <Card className="border-muted">
            <CardContent className="pt-4 pb-4 text-center">
              <Badge variant="outline" className="mb-2">Offre basse</Badge>
              <p className="text-2xl font-bold text-muted-foreground">
                {formatPrice(result.offreBasse)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                -{formatPct(result.remiseBasePct, 0)} soit{' '}
                {formatPrice(property.price - result.offreBasse)} de remise
              </p>
            </CardContent>
          </Card>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Prix affiché : {formatPrice(property.price)} — toujours négocier par écrit
        </p>
      </div>

      <Separator />

      {/* Arguments */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Arguments de négociation
          </p>
          <Button variant="ghost" size="sm" onClick={copyArguments} className="gap-1.5">
            <Copy className="h-3.5 w-3.5" />
            Copier
          </Button>
        </div>
        <ol className="space-y-3">
          {result.arguments.map((arg, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="shrink-0 mt-0.5 h-5 w-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                {i + 1}
              </span>
              <p className="text-muted-foreground leading-relaxed">{arg}</p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
