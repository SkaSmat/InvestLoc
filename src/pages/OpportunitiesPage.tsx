import { BarChart3, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function OpportunitiesPage() {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1">Opportunités</h1>
        <p className="text-muted-foreground">
          Biens détectés automatiquement selon votre profil de chasse — disponible en Sprint 5.
        </p>
      </div>

      {/* Placeholder Sprint 5 */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-muted-foreground">
            <BarChart3 className="h-5 w-5" />
            Chasseur autonome — Sprint 5
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Un agent IA scrute chaque jour SeLoger, LeBonCoin et BienIci à votre place. Chaque bien
            est noté sur 100 points :
          </p>
          <ul className="space-y-1 list-disc list-inside">
            <li>40 pts — Positionnement prix DVF</li>
            <li>30 pts — Rentabilité LMNP</li>
            <li>20 pts — Score quartier (transports, écoles, commerces…)</li>
            <li>10 pts — Potentiel de négociation</li>
          </ul>
          <p>Seuls les biens avec un score ≥ 60/100 sont remontés.</p>
          <div className="flex items-center gap-2 mt-4">
            <Clock className="h-4 w-4" />
            <Badge variant="secondary">À venir — Sprint 5</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
