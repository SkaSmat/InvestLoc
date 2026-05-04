import { createClient } from '@supabase/supabase-js'
import type { FinancialSettings, SearchProfile, Opportunity } from '@/types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ─── Financial Settings ───────────────────────────────────────────────────────

export const DEFAULT_FINANCIAL_SETTINGS: FinancialSettings = {
  tauxCredit: 3.3,
  tauxAssurance: 0.1,
  duree: 25,
  fraisNotairesPct: 7.5,
  tmi: 30,
}

export async function getFinancialSettings(): Promise<FinancialSettings> {
  const { data, error } = await supabase
    .from('financial_settings')
    .select('*')
    .limit(1)
    .maybeSingle()

  if (error || !data) return DEFAULT_FINANCIAL_SETTINGS
  return data as FinancialSettings
}

export async function upsertFinancialSettings(
  settings: Omit<FinancialSettings, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
): Promise<void> {
  const { error } = await supabase
    .from('financial_settings')
    .upsert({ ...settings, updated_at: new Date().toISOString() })
  if (error) throw error
}

// ─── Search Profile ───────────────────────────────────────────────────────────

export const DEFAULT_SEARCH_PROFILE: SearchProfile = {
  zones: ['75', '77', '78', '91', '92', '93', '94', '95'],
  budgetMax: 200000,
  rendementMinBrut: 7,
  typeBien: 'appartement',
  surfaceMin: 15,
  surfaceMax: 60,
}

export async function getSearchProfile(): Promise<SearchProfile> {
  const { data, error } = await supabase
    .from('search_profiles')
    .select('*')
    .limit(1)
    .maybeSingle()

  if (error || !data) return DEFAULT_SEARCH_PROFILE
  return data as SearchProfile
}

export async function upsertSearchProfile(
  profile: Omit<SearchProfile, 'id' | 'userId' | 'createdAt'>
): Promise<void> {
  const { error } = await supabase.from('search_profiles').upsert(profile)
  if (error) throw error
}

// ─── Opportunities ────────────────────────────────────────────────────────────

export async function getOpportunities(): Promise<Opportunity[]> {
  const { data, error } = await supabase
    .from('opportunities')
    .select('*')
    .order('score_total', { ascending: false })
    .limit(50)

  if (error) throw error
  return (data ?? []) as Opportunity[]
}

// ─── Edge Function : extract-listing ─────────────────────────────────────────

export async function invokeExtractListing(url: string) {
  const { data, error } = await supabase.functions.invoke('extract-listing', {
    body: { url },
  })
  if (error) throw error
  return data
}
