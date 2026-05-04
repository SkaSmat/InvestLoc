import { formatPriceM2, formatPct } from '@/lib/utils'
import type { DVFAnalysisResult, PropertyData } from '@/types'

interface PricePositionBarProps {
  dvf: DVFAnalysisResult
  property: PropertyData
}

export function PricePositionBar({ dvf, property }: PricePositionBarProps) {
  const prixM2Annonce = property.price / property.surface
  const { p10, mediane, p90, ecartPourcent } = dvf

  // Position relative sur la barre [p10, p90]
  const range = p90 - p10
  const clampedPos = Math.min(Math.max(prixM2Annonce, p10), p90)
  const pct = range > 0 ? ((clampedPos - p10) / range) * 100 : 50

  const isAbove = ecartPourcent > 5
  const isBelow = ecartPourcent < -5
  const color = isAbove ? 'text-destructive' : isBelow ? 'text-green-600' : 'text-foreground'
  const label = isAbove ? 'Au-dessus du marché' : isBelow ? 'En-dessous du marché' : 'Dans la moyenne'

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">Position marché DVF</span>
        <span className={`text-sm font-semibold ${color}`}>
          {ecartPourcent > 0 ? '+' : ''}
          {formatPct(ecartPourcent)} — {label}
        </span>
      </div>

      {/* Barre positionnement */}
      <div className="relative h-6">
        {/* Track */}
        <div className="absolute inset-y-2 left-0 right-0 rounded-full bg-gradient-to-r from-green-200 via-yellow-200 to-red-200" />

        {/* Médiane */}
        <div
          className="absolute inset-y-0 w-0.5 bg-muted-foreground/50"
          style={{ left: `${((mediane - p10) / (p90 - p10)) * 100}%` }}
        />

        {/* Curseur prix annoncé */}
        <div
          className="absolute top-0 -translate-x-1/2 h-6 w-3 rounded-sm bg-primary shadow"
          style={{ left: `${pct}%` }}
        />
      </div>

      {/* Légende */}
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>P10 {formatPriceM2(p10)}</span>
        <span>Médiane {formatPriceM2(mediane)}</span>
        <span>P90 {formatPriceM2(p90)}</span>
      </div>

      <div className="text-center text-xs text-muted-foreground">
        Ce bien : <span className="font-medium text-foreground">{formatPriceM2(Math.round(prixM2Annonce))}</span>
        {' · '}Basé sur {dvf.nbTransactions} transactions DVF
      </div>
    </div>
  )
}
