import { BREED_SIZES } from './constants';
import type { Dog, TrainingLog, FeedingLog, Prediction, Lang } from './types';

export function computeAgeMonths(dog: Dog): number {
  if (dog.birth_date) {
    const [y, m] = dog.birth_date.split('-').map(Number);
    const now = new Date();
    return Math.max(1, (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m));
  }
  return dog.age_months;
}

export function toBirthDate(ageMonths: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - ageMonths);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

export function toDateStr(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

export function computePrediction(dog: Dog, logs: TrainingLog[]): Prediction | null {
  if (!dog || !logs.length) return null;
  const breedCap = BREED_SIZES[dog.breed_size].bladderHours * 60;
  const ageCap   = Math.max(30, computeAgeMonths(dog) * 30);
  const capacity = Math.min(ageCap, breedCap);
  const lastLog  = logs.find(l => l.sub === 'pee' || l.sub === 'both');
  if (!lastLog) return null;
  const [lh, lm] = lastLog.time.split(':').map(Number);
  if (isNaN(lh) || isNaN(lm)) return null;
  const now      = new Date();
  const elapsed  = ((now.getHours() * 60 + now.getMinutes()) - (lh * 60 + lm) + 1440) % 1440;
  const remaining = Math.round(capacity - elapsed);
  return {
    remaining,
    urgency: remaining <= 0 ? 'now' : remaining <= 15 ? 'soon' : 'normal',
  };
}

export function getPredMessage(dog: Dog, urgency: string, remaining: number, lang: Lang): string {
  const age = computeAgeMonths(dog);
  const g = age < 4 ? 'puppy' : age < 8 ? 'young' : 'adult';
  const garden = dog.home === 'garden';
  const n = dog.name;

  if (lang === 'tr') {
    if (urgency === 'now') {
      if (g === 'puppy') return garden ? `Tuvalet vakti! ${n} çok küçük, hemen bahçeye bırakın.` : `Tuvalet vakti! ${n} çok küçük, hızlıca dışarı çıkın.`;
      if (g === 'young') return garden ? `${n} için tuvalet vakti! Hemen bahçeye bırakın.` : `${n} için tuvalet vakti! Hemen dışarı.`;
      return garden ? `${n} için tuvalet vakti geldi. Bahçeye bırakın.` : `${n} için tuvalet vakti geldi. Dışarıya çıkın.`;
    }
    if (urgency === 'soon') {
      if (g === 'puppy') return garden ? `${n} birazdan ihtiyaç duyacak. Bahçeye bırakmaya hazır olun.` : `${n} birazdan ihtiyaç duyacak. Dışarı çıkmaya hazır olun.`;
      if (g === 'young') return garden ? `${n} yakında bahçeye gitmek isteyecek. Hazırlanın.` : `${n} yakında dışarı çıkmak isteyecek. Hazırlanın.`;
      return garden ? `Yaklaşıyor! ${n}'u bahçeye bırakmak için hazırlanın.` : `Yaklaşıyor! ${n}'u dışarı çıkarmak için hazırlanın.`;
    }
    if (g === 'puppy') return garden ? `${n} ~${remaining} dk içinde ihtiyaç duyabilir. Küçük yaşta sık sık bahçeye bırakın.` : `${n} ~${remaining} dk içinde ihtiyaç duyabilir. Küçük yaşta sık sık dışarı çıkın.`;
    if (g === 'young') return garden ? `${n} yaklaşık ${remaining} dk içinde bahçeye gitmek isteyecek.` : `${n} yaklaşık ${remaining} dk içinde dışarı çıkmak isteyecek.`;
    return garden ? `${n} muhtemelen ${remaining} dk içinde bahçeye gitmek isteyecek.` : `${n} muhtemelen ${remaining} dk içinde dışarıya çıkacak.`;
  }

  if (urgency === 'now') {
    if (g === 'puppy') return garden ? `Bathroom time! ${n} is very young — let to the garden right now.` : `Bathroom time! ${n} is very young — take outside right now.`;
    if (g === 'young') return garden ? `Time to go! Let ${n} into the garden now.` : `Time to go! Take ${n} outside now.`;
    return garden ? `Bathroom time for ${n}. Open the garden.` : `Bathroom time for ${n}. Head outside.`;
  }
  if (urgency === 'soon') {
    if (g === 'puppy') return garden ? `${n} will need to go soon. Get ready to open the garden.` : `${n} will need to go soon. Get ready to head outside.`;
    if (g === 'young') return garden ? `${n} will want the garden soon. Get ready.` : `${n} will want to go out soon. Get the leash ready.`;
    return garden ? `Almost time! Get ready to let ${n} to the garden.` : `Almost time! Get ready to take ${n} outside.`;
  }
  if (g === 'puppy') return garden ? `${n} may need to go in ~${remaining} min. Young pups need frequent garden access.` : `${n} may need to go in ~${remaining} min. Young pups need frequent outdoor trips.`;
  if (g === 'young') return garden ? `${n} will likely want the garden in about ${remaining} min.` : `${n} will likely want to go outside in about ${remaining} min.`;
  return garden ? `${n} will probably want the garden in ${remaining} min.` : `${n} will probably head outside in ${remaining} min.`;
}

export function getInsight(logs: TrainingLog[], t: Record<string, string>): string {
  if (!logs.length) return t.insightNoData;
  const rate = logs.filter(l => l.type === 'success').length / logs.length;
  return rate >= 0.7 ? t.insightGreat : rate >= 0.4 ? t.insightOk : t.insightBad;
}

export function computeLevel(logs: TrainingLog[]): 1 | 2 | 3 | 4 | 5 {
  const total = logs.length;
  const rate = total ? logs.filter(l => l.type === 'success').length / total : 0;
  if (total >= 100 && rate >= 0.85) return 5;
  if (total >= 50  && rate >= 0.70) return 4;
  if (total >= 25  && rate >= 0.50) return 3;
  if (total >= 10  && rate >= 0.30) return 2;
  return 1;
}

export function computeStreak(logs: TrainingLog[]): number {
  const sorted = [...new Set(logs.map(l => l.date))].sort((a, b) => {
    const p = (s: string) => s.split('.').reverse().join('-');
    return new Date(p(b)).getTime() - new Date(p(a)).getTime();
  });
  let streak = 0;
  for (const date of sorted) {
    if (!logs.some(l => l.date === date && l.type === 'accident')) streak++;
    else break;
  }
  return streak;
}

export function getLastAccidentSub(logs: TrainingLog[]): 'pee' | 'poop' | 'both' | null {
  return logs.find(l => l.type === 'accident')?.sub ?? null;
}

export function computePeakHours(logs: TrainingLog[]): { from: number; to: number } | null {
  const accidents = logs.filter(l => l.type === 'accident');
  if (!accidents.length) return null;
  const windows = [0, 4, 8, 12, 16, 20].map(h => ({
    from: h, to: h + 4,
    count: accidents.filter(l => { const hr = parseInt(l.time.split(':')[0]); return hr >= h && hr < h + 4; }).length,
  }));
  return windows.reduce((max, w) => w.count > max.count ? w : max);
}

export function generateSeedLogs(dogId: string): TrainingLog[] {
  const now   = new Date();
  const nowH  = now.getHours();
  const logs: TrainingLog[] = [];

  const typeCycle: ('success' | 'accident')[] = [
    'success','success','success','accident',
    'success','success','accident','success',
  ];
  const subCycle: ('pee' | 'poop' | 'both')[] = [
    'pee','pee','poop','pee','both','pee','poop','pee',
  ];
  // Her gün farklı saat seçimi → bar grafiklerde doğal değişkenlik
  const hourSets: number[][] = [
    [7, 9, 11, 13, 15, 17, 19, 21],  // d=0 today
    [7, 9, 11, 13, 15, 17, 19, 21],  // d=1
    [7, 9, 11, 15, 17, 19, 21],       // d=2: 7
    [7, 9, 13, 15, 17, 19],           // d=3: 6
    [7, 9, 11, 13, 15, 17, 19, 21],  // d=4: 8
    [9, 11, 13, 15, 17, 19],          // d=5: 6
    [7, 9, 11, 17, 19, 21],           // d=6: 6
    [7, 9, 13, 15, 17, 21],           // d=7: 6
    [7, 11, 13, 15, 17, 19, 21],      // d=8: 7
    [9, 11, 15, 17, 19],              // d=9: 5
    [7, 9, 13, 17, 21],               // d=10: 5
    [7, 11, 15, 19],                  // d=11: 4
    [7, 13, 19],                      // d=12: 3
    [9, 15],                          // d=13: 2 (ilk gün)
  ];

  for (let d = 0; d < 14; d++) {
    const date    = toDateStr(new Date(now.getTime() - d * 86400000));
    const isEarly = d >= 11;
    const hours   = hourSets[d];

    for (let i = 0; i < hours.length; i++) {
      const h = hours[i];
      if (d === 0 && h >= nowH) continue;

      const cycleIdx = (d * 3 + i) % typeCycle.length;
      const type: 'success' | 'accident' =
        d <= 2  ? 'success' :
        isEarly ? (cycleIdx < 3 ? 'accident' : 'success') :
        typeCycle[cycleIdx];

      const sub  = subCycle[(d * 2 + i) % subCycle.length];
      const min  = (d * 7 + i * 11) % 60;
      const time = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;

      logs.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, dog_id: dogId, date, time, type, sub, location: 'indoor' as const });
    }
  }

  return logs.sort((a, b) => {
    const toKey = (l: TrainingLog) => l.date.split('.').reverse().join('-') + 'T' + l.time;
    return toKey(b).localeCompare(toKey(a));
  });
}

// ── Feeding rhythm ─────────────────────────────────────────────────

function parseTrainingLogDate(log: TrainingLog): Date {
  const [d, m, y] = log.date.split('.');
  const [h, min] = log.time.split(':');
  return new Date(+y, +m - 1, +d, +h, +min);
}

export function computeWaterDeltas(
  feedingLogs: FeedingLog[],
  trainingLogs: TrainingLog[],
  dogId: string
): number[] {
  const waterEvents = feedingLogs
    .filter(f => f.dog_id === dogId && f.type === 'water')
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const peeEvents = trainingLogs
    .filter(l => l.dog_id === dogId && (l.sub === 'pee' || l.sub === 'both'))
    .map(l => ({ ms: parseTrainingLogDate(l).getTime() }))
    .sort((a, b) => a.ms - b.ms);

  const deltas: number[] = [];
  for (const water of waterEvents) {
    const wMs = new Date(water.timestamp).getTime();
    const next = peeEvents.find(p => {
      const delta = (p.ms - wMs) / 60000;
      return delta > 0 && delta <= 120;
    });
    if (next) deltas.push(Math.round((next.ms - wMs) / 60000));
  }
  return deltas.slice(-10);
}

export function computeFoodDeltas(
  feedingLogs: FeedingLog[],
  trainingLogs: TrainingLog[],
  dogId: string
): number[] {
  const foodEvents = feedingLogs
    .filter(f => f.dog_id === dogId && f.type === 'food')
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const poopEvents = trainingLogs
    .filter(l => l.dog_id === dogId && (l.sub === 'poop' || l.sub === 'both'))
    .map(l => ({ ms: parseTrainingLogDate(l).getTime() }))
    .sort((a, b) => a.ms - b.ms);

  const deltas: number[] = [];
  for (const food of foodEvents) {
    const fMs = new Date(food.timestamp).getTime();
    const next = poopEvents.find(p => {
      const delta = (p.ms - fMs) / 60000;
      return delta > 0 && delta <= 240;
    });
    if (next) deltas.push(Math.round((next.ms - fMs) / 60000));
  }
  return deltas.slice(-10);
}

export function computeAvgMinutes(deltas: number[]): number | null {
  if (deltas.length < 3) return null;
  return Math.round(deltas.reduce((a, b) => a + b, 0) / deltas.length);
}

export function computeWaterPairCount(
  feedingLogs: FeedingLog[],
  trainingLogs: TrainingLog[],
  dogId: string,
): number {
  const waterEvents = feedingLogs
    .filter(f => f.dog_id === dogId && f.type === 'water')
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const peeEvents = trainingLogs
    .filter(l => l.dog_id === dogId && (l.sub === 'pee' || l.sub === 'both'))
    .map(l => ({ ms: parseTrainingLogDate(l).getTime() }))
    .sort((a, b) => a.ms - b.ms);
  let count = 0;
  for (const w of waterEvents) {
    const wMs = new Date(w.timestamp).getTime();
    if (peeEvents.some(p => { const d = (p.ms - wMs) / 60000; return d > 0 && d <= 120; })) count++;
  }
  return count;
}

export function computeFoodPairCount(
  feedingLogs: FeedingLog[],
  trainingLogs: TrainingLog[],
  dogId: string,
): number {
  const foodEvents = feedingLogs
    .filter(f => f.dog_id === dogId && f.type === 'food')
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const poopEvents = trainingLogs
    .filter(l => l.dog_id === dogId && (l.sub === 'poop' || l.sub === 'both'))
    .map(l => ({ ms: parseTrainingLogDate(l).getTime() }))
    .sort((a, b) => a.ms - b.ms);
  let count = 0;
  for (const f of foodEvents) {
    const fMs = new Date(f.timestamp).getTime();
    if (poopEvents.some(p => { const d = (p.ms - fMs) / 60000; return d > 0 && d <= 240; })) count++;
  }
  return count;
}

export function generateSeedFeedingLogs(
  trainingLogs: TrainingLog[],
  dogId: string,
  userId: string,
): FeedingLog[] {
  const result: FeedingLog[] = [];
  for (const log of trainingLogs) {
    if (log.dog_id !== dogId) continue;
    const logMs = parseTrainingLogDate(log).getTime();
    if (log.sub === 'pee' || log.sub === 'both') {
      result.push({
        id: generateUUID(),
        dog_id: dogId, user_id: userId, type: 'water',
        timestamp: new Date(logMs - 30 * 60000).toISOString(),
        source: 'manual',
      });
    }
    if (log.sub === 'poop' || log.sub === 'both') {
      result.push({
        id: generateUUID(),
        dog_id: dogId, user_id: userId, type: 'food',
        timestamp: new Date(logMs - 60 * 60000).toISOString(),
        source: 'manual',
      });
    }
  }
  return result;
}

export function getFeedingOffset(dog: Dog, type: 'water' | 'food'): number {
  const v = type === 'water' ? dog.water_offset : dog.food_offset;
  return Math.max(5, Math.min(120, v ?? 30));
}

export async function setFeedingOffset(
  dogId: string,
  type: 'water' | 'food',
  minutes: number,
  supabaseClient: { from: (t: string) => any },
): Promise<void> {
  const col = type === 'water' ? 'water_offset' : 'food_offset';
  const val = Math.max(5, Math.min(120, minutes));
  await supabaseClient.from('dogs').update({ [col]: val }).eq('id', dogId);
}
