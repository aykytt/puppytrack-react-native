import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_GIVEN = '@pt:consent_given';
const KEY_COUNT = '@pt:consent_count';
const KEY_LAST  = '@pt:consent_last';

export async function shouldShowConsent(totalLogs: number): Promise<boolean> {
  if (totalLogs < 10) return false;
  const [given, countStr, last] = await Promise.all([
    AsyncStorage.getItem(KEY_GIVEN),
    AsyncStorage.getItem(KEY_COUNT),
    AsyncStorage.getItem(KEY_LAST),
  ]);
  if (given === 'true') return false;
  const count = parseInt(countStr ?? '0');
  if (count >= 3) return false;
  if (count === 0) return true;
  if (!last) return true;
  const days = (Date.now() - new Date(last).getTime()) / 86400000;
  return days >= 10;
}

export async function acceptConsent(): Promise<void> {
  await AsyncStorage.setItem(KEY_GIVEN, 'true');
}

export async function dismissConsent(): Promise<void> {
  const countStr = await AsyncStorage.getItem(KEY_COUNT);
  const next = parseInt(countStr ?? '0') + 1;
  await Promise.all([
    AsyncStorage.setItem(KEY_COUNT, String(next)),
    AsyncStorage.setItem(KEY_LAST, new Date().toISOString()),
  ]);
}

export async function getConsentGiven(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEY_GIVEN)) === 'true';
}

export async function clearConsent(): Promise<void> {
  await AsyncStorage.removeItem(KEY_GIVEN);
}
