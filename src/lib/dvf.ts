import type { DVFAnalysisResult } from '@/types'
import { supabase } from './supabase'

export async function fetchDVFStats(
  codePostal: string,
  city: string,
  surface: number,
  prixAnnonce: number
): Promise<DVFAnalysisResult> {
  const { data, error } = await supabase.functions.invoke('dvf-stats', {
    body: { codePostal, city, surface, prixAnnonce },
  })
  if (error) throw error
  if (data.error) throw new Error(data.error)
  return data as DVFAnalysisResult
}
