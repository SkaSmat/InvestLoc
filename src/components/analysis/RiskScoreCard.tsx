import { ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { RiskScore } from '@/types'

function niveauConfig(niveau: RiskScore['niveau']) {
  if (niveau === 'faible') return { label: 'Risque faible', color: 'text-green-600', bg: 'bg-green-50 border-green-200', Icon: ShieldCheck }
  if (niveau === 'modéré') return { label: 'Risque modéré', color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200', Icon: ShieldAlert }
  return { label: 'Risque élevé', color: 'text-destructive', bg: 'bg-red-50 border-red-200', Icon: ShieldX }
}

export function RiskScoreCard({ risk, tri }: { risk: RiskScore; tri: number }) {
  const { label, color, bg, Icon } = niveauConfig(risk.niveau)

  return (
    <Card className={`border ${bg}`}>
      <CardHeader className="pb-2 pt-4">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Icon className={`h-4 w-4 ${color}`} />
            Score de risque
          </span>
          <span className={`text-2xl font-bold ${color}`}>{risk.total}<span className="text-xs font-normal text-muted-foreground">/100</span></span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className={`text-xs font-semibold uppercase tracking-wide ${color}`}>{label}</span>
          <span className="text-xs text-muted-foreground">
            TRI 10 ans : <span className={`font-semibold ${tri >= 8 ? 'text-green-600' : tri >= 4 ? 'text-yellow-600' : 'text-destructive'}`}>{tri > 0 ? '+' : ''}{tri}%</span>
          </span>
        </div>

        {/* Barre globale */}
        <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${risk.niveau === 'faible' ? 'bg-green-500' : risk.niveau === 'modéré' ? 'bg-yellow-500' : 'bg-red-500'}`}
            style={{ width: `${risk.total}%` }}
          />
        </div>

        {/* Détail des critères */}
        <div className="space-y-1.5 pt-1">
          {risk.criteria.map((c) => (
            <div key={c.label} className="flex items-center gap-2 text-xs">
              <div className="flex-1 text-muted-foreground truncate">{c.label}</div>
              <div className="text-muted-foreground">{c.detail}</div>
              <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary/70"
                  style={{ width: `${(c.score / c.max) * 100}%` }}
                />
              </div>
              <div className="w-8 text-right font-medium">{c.score}/{c.max}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
