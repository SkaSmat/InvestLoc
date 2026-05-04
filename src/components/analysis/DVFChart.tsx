import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import type { DVFAnalysisResult, PropertyData } from '@/types'
import { formatPriceM2 } from '@/lib/utils'

interface DVFChartProps {
  dvf: DVFAnalysisResult
  property: PropertyData
}

interface BinData {
  label: string
  count: number
  rangeMin: number
  rangeMax: number
}

function buildHistogram(values: number[], bins = 10): BinData[] {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const step = Math.ceil((max - min) / bins / 100) * 100 || 500

  const buckets: BinData[] = []
  for (let lower = Math.floor(min / 100) * 100; lower < max; lower += step) {
    buckets.push({
      label: `${(lower / 1000).toFixed(1)}k`,
      count: 0,
      rangeMin: lower,
      rangeMax: lower + step,
    })
  }

  for (const v of values) {
    const bucket = buckets.find((b) => v >= b.rangeMin && v < b.rangeMax)
    if (bucket) bucket.count++
  }

  return buckets.filter((b) => b.count > 0)
}

export function DVFChart({ dvf, property }: DVFChartProps) {
  const prixM2Annonce = Math.round(property.price / property.surface)
  const prixM2s = dvf.transactions.map((t) => t.prixM2)
  const data = buildHistogram(prixM2s)

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Distribution des prix/m² DVF</p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
          <Tooltip
            formatter={(value: number) => [`${value} ventes`, 'Transactions']}
            labelFormatter={(label) => `~${label}/m²`}
          />
          <Bar dataKey="count" fill="hsl(var(--primary))" opacity={0.7} radius={[3, 3, 0, 0]} />
          <ReferenceLine
            x={data.find((b) => dvf.mediane >= b.rangeMin && dvf.mediane < b.rangeMax)?.label}
            stroke="hsl(var(--muted-foreground))"
            strokeDasharray="4 2"
            label={{ value: 'Médiane', position: 'top', fontSize: 11 }}
          />
          <ReferenceLine
            x={data.find((b) => prixM2Annonce >= b.rangeMin && prixM2Annonce < b.rangeMax)?.label}
            stroke="hsl(var(--destructive))"
            strokeWidth={2}
            label={{ value: 'Ce bien', position: 'top', fontSize: 11 }}
          />
        </BarChart>
      </ResponsiveContainer>
      <p className="text-xs text-muted-foreground text-center">
        Médiane marché : {formatPriceM2(dvf.mediane)} · Ce bien : {formatPriceM2(prixM2Annonce)}
        {dvf.tendance !== 0 && (
          <span>
            {' · '}Tendance {dvf.tendance > 0 ? '+' : ''}
            {dvf.tendance} %/an
          </span>
        )}
      </p>
    </div>
  )
}
