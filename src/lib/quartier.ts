import { supabase } from './supabase'
import type { QuartierScore } from '@/types'

export async function fetchQuartierScore(
  city: string,
  postalCode: string,
  address: string
): Promise<QuartierScore> {
  const { data, error } = await supabase.functions.invoke('score-quartier', {
    body: { city, postalCode, address },
  })
  if (error) throw error
  if (data.error) throw new Error(data.error)
  return data as QuartierScore
}
