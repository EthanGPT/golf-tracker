import type { Session } from '@supabase/supabase-js'
import type { AppData } from './domain'
import { supabase } from './supabase'

export async function loadCloudData(session: Session): Promise<AppData | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from('user_data').select('data').eq('user_id', session.user.id).maybeSingle()
  if (error) throw error
  return (data?.data as AppData | undefined) || null
}

export async function saveCloudData(session: Session, appData: AppData) {
  if (!supabase) return
  const { error } = await supabase.from('user_data').upsert({ user_id: session.user.id, data: appData, updated_at: new Date().toISOString() })
  if (error) throw error
}
