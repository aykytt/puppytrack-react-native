import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Dog, TrainingLog, FeedingLog } from '../types';

const SUPABASE_URL = 'https://ugplpcoqszxaralbsdvq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_WGtnJQoIo7GcnGJDnT4Yuw_EC5x42dD';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});

export async function fetchDogs(userId: string): Promise<Dog[]> {
  const { data } = await supabase.from('dogs').select('*').eq('user_id', userId).order('created_at');
  return (data ?? []).map(({ level: _l, ...d }) => ({
    ...d,
    level: 1,
    water_offset:      d.water_offset      ?? 30,
    food_offset:       d.food_offset       ?? 30,
    water_pair_count:  d.water_pair_count  ?? 0,
    food_pair_count:   d.food_pair_count   ?? 0,
  }));
}

export async function fetchLogs(userId: string): Promise<TrainingLog[]> {
  const { data } = await supabase.from('training_logs').select('*').eq('user_id', userId).order('date', { ascending: false });
  return data ?? [];
}

export async function fetchFeedingLogs(userId: string): Promise<FeedingLog[]> {
  const { data } = await supabase.from('feeding_logs').select('*').eq('user_id', userId).order('timestamp', { ascending: false });
  return data ?? [];
}
