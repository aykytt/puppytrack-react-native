import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  TextInput, Switch, Alert, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { ArrowLeft, Bell, MapPin, Export, Gear, Plus, CaretRight, Medal } from 'phosphor-react-native';
import { useAuth } from '../../src/lib/AuthContext';
import { useLang } from '../../src/lib/LangContext';
import { supabase, fetchDogs, fetchLogs, fetchFeedingLogs } from '../../src/lib/supabase';
import {
  requestNotifPermissions, getNotifPermissionStatus,
  setMorningReminder, setNightReminder, setWeeklyReminder,
} from '../../src/lib/notifications';
import { colors, sp, radius, shadow } from '../../src/theme';
import { T, BREED_SIZES, HOME_TYPES, LEVELS, DOG_AVATARS, PRIVACY_URL } from '../../src/constants';
import {
  computeLevel, computeStreak, toDateStr, computeAgeMonths, toBirthDate,
  computeWaterDeltas, computeFoodDeltas, computeAvgMinutes,
  getFeedingOffset, setFeedingOffset, generateSeedLogs, generateSeedFeedingLogs,
} from '../../src/utils';
import type { Dog, TrainingLog, FeedingLog } from '../../src/types';
import { getConsentGiven, acceptConsent as saveConsent, clearConsent } from '../../src/lib/consentStorage';

type SubPage = 'addDog' | 'notifs' | 'settings' | 'location' | 'export' | null;

function formatBirthDate(bd: string, approximate: boolean): string {
  const parts = bd.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  if (approximate || parts.length === 2) return `${months[parseInt(parts[1]) - 1]} ${parts[0]}`;
  return `${months[parseInt(parts[1]) - 1]} ${parts[2]}, ${parts[0]}`;
}

function SubHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={s.subHdr}>
      <TouchableOpacity onPress={onBack} hitSlop={12}>
        <ArrowLeft size={22} color={colors.neutral700} />
      </TouchableOpacity>
      <Text style={s.subHdrTitle}>{title}</Text>
    </View>
  );
}

function ProgressBar({ value, color = colors.accent500 }: { value: number; color?: string }) {
  return (
    <View style={s.pbar}>
      <View style={[s.pfill, { width: `${Math.min(100, value)}%` as any, backgroundColor: color }]} />
    </View>
  );
}

export default function ProfileScreen() {
  const { user } = useAuth();
  const { lang, setLang } = useLang();
  const t = T[lang];
  const [dogs, setDogs] = useState<Dog[]>([]);
  const [logs, setLogs] = useState<TrainingLog[]>([]);
  const [feedingLogs, setFeedingLogs] = useState<FeedingLog[]>([]);
  const [activeDogId, setActiveDogId] = useState<string | null>(null);
  const [subPage, setSubPage] = useState<SubPage>(null);
  const [loading, setLoading] = useState(true);
  const [notifs, setNotifs] = useState({ morning: true, night: false, weekly: true });
  const [dataConsent, setDataConsent] = useState(false);
  const [editName, setEditName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [showDeleteZone, setShowDeleteZone] = useState(false);
  const [waterOffset, setWaterOffsetLocal] = useState(30);
  const [foodOffset, setFoodOffsetLocal] = useState(30);

  // AddDog form state
  const [newName, setNewName] = useState('');
  const [newAge, setNewAge] = useState(2);
  const [newBreed, setNewBreed] = useState<Dog['breed_size']>('medium');
  const [newHome, setNewHome] = useState<Dog['home']>('apartment');
  const [newAvatar, setNewAvatar] = useState('🐶');
  const [newBirthDate, setNewBirthDate] = useState<string | null>(null);
  const [approximateMode, setApproximateMode] = useState(false);
  const [showBirthPicker, setShowBirthPicker] = useState(false);
  const [showEditBirthPicker, setShowEditBirthPicker] = useState(false);
  const [editApproximateMode, setEditApproximateMode] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([fetchDogs(user.id), fetchLogs(user.id), fetchFeedingLogs(user.id), getConsentGiven()] as const)
      .then(([d, l, f, given]) => {
        setDogs(d); setLogs(l); setFeedingLogs(f);
        setDataConsent(given);
        if (d[0]) {
          setActiveDogId(d[0].id);
          setEditName(d[0].name);
          setWaterOffsetLocal(d[0].water_offset ?? 30);
          setFoodOffsetLocal(d[0].food_offset ?? 30);
        }
        else setSubPage('addDog');
        setLoading(false);
      });
  }, [user]);

  const activeDog = dogs.find(d => d.id === activeDogId) ?? dogs[0];
  const dogLogs = activeDog ? logs.filter(l => l.dog_id === activeDog.id) : [];
  const sc = dogLogs.filter(l => l.type === 'success').length;
  const total = dogLogs.length;
  const rate = total ? Math.round(sc / total * 100) : 0;
  const level = computeLevel(dogLogs);
  const streak = computeStreak(dogLogs);
  const todayStr = toDateStr(new Date());
  const currentAge = activeDog ? computeAgeMonths(activeDog) : 0;
  const peeTarget = currentAge < 4 ? 6 : currentAge < 8 ? 5 : 4;
  const todayPee = dogLogs.filter(l => l.date === todayStr && l.type === 'success' && (l.sub === 'pee' || l.sub === 'both')).length;
  const days = [...new Set(dogLogs.map(l => l.date))].length;

  const updateDog = async (dogId: string, updates: Partial<Dog>) => {
    setDogs(prev => prev.map(d => d.id === dogId ? { ...d, ...updates } : d));
    await supabase.from('dogs').update(updates).eq('id', dogId);
  };

  const addDog = async () => {
    if (!user || !newName.trim()) return;
    let ageMonths = newAge;
    if (newBirthDate) {
      const [y, m] = newBirthDate.split('-').map(Number);
      const now = new Date();
      ageMonths = Math.max(1, (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m));
    }
    const { data, error } = await supabase.from('dogs').insert({
      name: newName.trim(),
      breed: BREED_SIZES[newBreed]['en'],
      breed_size: newBreed,
      age_months: ageMonths,
      ...(newBirthDate && { birth_date: newBirthDate }),
      home: newHome,
      avatar: newAvatar,
      user_id: user.id,
    }).select().single();
    if (error || !data) {
      Alert.alert('Error', error?.message ?? 'Could not save dog. Please try again.');
      return;
    }
    setDogs(prev => [...prev, { ...data, level: 1 }]);
    setActiveDogId(data.id);
    setSubPage(null);
    setNewName(''); setNewAge(2); setNewBreed('medium'); setNewHome('apartment'); setNewAvatar('🐶');
    setNewBirthDate(null); setApproximateMode(false);
  };

  const deleteDog = async () => {
    if (!activeDog) return;
    await supabase.from('training_logs').delete().eq('dog_id', activeDog.id);
    await supabase.from('feeding_logs').delete().eq('dog_id', activeDog.id);
    await supabase.from('dogs').delete().eq('id', activeDog.id);
    const remaining = dogs.filter(d => d.id !== activeDog.id);
    setDogs(remaining);
    setLogs(prev => prev.filter(l => l.dog_id !== activeDog.id));
    setFeedingLogs(prev => prev.filter(f => f.dog_id !== activeDog.id));
    setActiveDogId(remaining[0]?.id ?? null);
    setSubPage(remaining.length === 0 ? 'addDog' : null); setDeleteConfirm(''); setShowDeleteZone(false);
  };

  const seedData = async () => {
    if (!activeDog || !user) return;
    const seedLogs = generateSeedLogs(activeDog.id);
    const seedFeeds = generateSeedFeedingLogs(seedLogs, activeDog.id, user.id);

    // Feeding logs first — trigger needs them when training logs are inserted
    const { error: fErr } = await supabase.from('feeding_logs').insert(seedFeeds);
    if (fErr) { Alert.alert('Error', fErr.message); return; }

    const toInsert = seedLogs.map(({ id: _id, ...l }) => ({ ...l, user_id: user.id }));
    const { error } = await supabase.from('training_logs').insert(toInsert);
    if (error) { Alert.alert('Error', error.message); return; }

    const updatedDogs = await fetchDogs(user.id);
    setDogs(updatedDogs);
    setLogs(prev => [...seedLogs, ...prev]);
    setFeedingLogs(prev => [...seedFeeds, ...prev]);
    Alert.alert('Done', 'Test data loaded.');
  };

  const changeOffset = async (type: 'water' | 'food', delta: number) => {
    if (!activeDog) return;
    const current = type === 'water' ? waterOffset : foodOffset;
    const next = Math.max(5, Math.min(120, current + delta));
    if (type === 'water') setWaterOffsetLocal(next); else setFoodOffsetLocal(next);
    await setFeedingOffset(activeDog.id, type, next, supabase);
    setDogs(prev => prev.map(d => d.id === activeDog.id
      ? { ...d, water_offset: type === 'water' ? next : d.water_offset, food_offset: type === 'food' ? next : d.food_offset }
      : d));
  };

  // ── Sub pages ──────────────────────────────────────────────────────────────

  if (subPage === 'addDog') return (
    <SafeAreaView style={s.root} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} bounces={false} overScrollMode="never">
        <SubHeader title={t.addDogTitle} onBack={() => setSubPage(null)} />
        <View style={s.card}>
          <Text style={s.fieldLabel}>{t.dogNameLabel}</Text>
          <TextInput
            style={s.input}
            placeholder={t.dogNamePlaceholder}
            placeholderTextColor={colors.neutral400}
            value={newName}
            onChangeText={setNewName}
            maxLength={20}
          />
          <Text style={[s.fieldLabel, { marginTop: sp[3] }]}>Birth Date (optional)</Text>
          <TouchableOpacity style={s.dateField} onPress={() => setShowBirthPicker(true)}>
            <Text style={newBirthDate ? s.dateFieldText : s.dateFieldPlaceholder}>
              {newBirthDate ? formatBirthDate(newBirthDate, approximateMode) : 'Select birth date'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.checkRow} onPress={() => setApproximateMode(p => !p)}>
            <View style={[s.checkbox, approximateMode && s.checkboxChecked]}>
              {approximateMode && <Text style={{ color: '#fff', fontSize: 10, lineHeight: 14 }}>✓</Text>}
            </View>
            <Text style={s.checkLabel}>I don't know the exact day</Text>
          </TouchableOpacity>
          {!newBirthDate && (
            <>
              <Text style={[s.fieldLabel, { marginTop: sp[2] }]}>{t.dogAgeLabel}</Text>
              <View style={s.stepperRow}>
                <TouchableOpacity style={s.stepperBtn} onPress={() => setNewAge(Math.max(1, newAge - 1))}><Text style={s.stepperBtnText}>−</Text></TouchableOpacity>
                <Text style={s.stepperVal}>{newAge} {t.months}</Text>
                <TouchableOpacity style={s.stepperBtn} onPress={() => setNewAge(Math.min(120, newAge + 1))}><Text style={s.stepperBtnText}>+</Text></TouchableOpacity>
              </View>
            </>
          )}
          <Text style={[s.fieldLabel, { marginTop: sp[3] }]}>{t.dogBreedLabel}</Text>
          <View style={s.optRow}>
            {(['small', 'medium', 'large', 'giant'] as Dog['breed_size'][]).map(k => (
              <TouchableOpacity key={k} style={[s.optBtn, newBreed === k && s.optBtnSel]} onPress={() => setNewBreed(k)}>
                <Text style={[s.optBtnText, newBreed === k && s.optBtnTextSel]}>{(t as any)[k]}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[s.fieldLabel, { marginTop: sp[3] }]}>{t.dogHomeLabel}</Text>
          <View style={s.optRow}>
            {(['apartment', 'garden'] as Dog['home'][]).map(k => (
              <TouchableOpacity key={k} style={[s.optBtn, newHome === k && s.optBtnSel]} onPress={() => setNewHome(k)}>
                <Text style={[s.optBtnText, newHome === k && s.optBtnTextSel]}>{k === 'apartment' ? t.apartment : t.house}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[s.fieldLabel, { marginTop: sp[3] }]}>{t.dogAvatarLabel}</Text>
          <View style={s.avatarGrid}>
            {DOG_AVATARS.map(a => (
              <TouchableOpacity key={a} style={[s.avatarBtn, newAvatar === a && s.avatarBtnSel]} onPress={() => setNewAvatar(a)}>
                <Text style={{ fontSize: 22 }}>{a}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <TouchableOpacity
          style={[s.primaryBtn, !newName.trim() && s.primaryBtnDisabled]}
          onPress={addDog}
          disabled={!newName.trim()}
          activeOpacity={0.85}>
          <Text style={s.primaryBtnText}>{t.saveDog}</Text>
        </TouchableOpacity>
      </ScrollView>
      <DateTimePickerModal
        isVisible={showBirthPicker}
        mode="date"
        maximumDate={new Date()}
        accentColor={colors.accent500}
        themeVariant="light"
        onConfirm={(date) => {
          if (approximateMode) {
            setNewBirthDate(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
          } else {
            setNewBirthDate(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`);
          }
          setShowBirthPicker(false);
        }}
        onCancel={() => setShowBirthPicker(false)}
      />
    </SafeAreaView>
  );

  if (subPage === 'notifs') {
    const waterDeltas = activeDog ? computeWaterDeltas(feedingLogs, logs, activeDog.id) : [];
    const foodDeltas  = activeDog ? computeFoodDeltas(feedingLogs, logs, activeDog.id) : [];
    const waterAvg = computeAvgMinutes(waterDeltas);
    const foodAvg  = computeAvgMinutes(foodDeltas);

    const handleToggle = async (k: keyof typeof notifs, v: boolean) => {
      const granted = await requestNotifPermissions();
      if (!granted) {
        Alert.alert(
          'Notifications blocked',
          'Open your device settings and enable notifications for PuppyTrack.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ],
        );
        return;
      }
      setNotifs(p => ({ ...p, [k]: v }));
      const name = activeDog?.name ?? 'your dog';
      if (k === 'morning') setMorningReminder(name, v);
      else if (k === 'night') setNightReminder(name, v);
      else if (k === 'weekly') setWeeklyReminder(name, v);
    };

    const RhythmCard = ({ type, icon, title, avg, offset }: { type: 'water' | 'food'; icon: string; title: string; avg: number | null; offset: number }) => (
      <View style={[s.card, { marginBottom: sp[3] }]}>
        <Text style={s.cardTitle}>{icon} {title}</Text>
        {avg !== null
          ? <Text style={s.cardSub}>{activeDog?.name} averages {avg} min after</Text>
          : <Text style={s.cardSub}>{t.noRhythmData}</Text>}
        <View style={s.offsetRow}>
          <Text style={s.offsetLabel}>{t.alertIn}</Text>
          <View style={s.stepperRow}>
            <TouchableOpacity style={s.stepperBtn} onPress={() => changeOffset(type, -5)}><Text style={s.stepperBtnText}>−</Text></TouchableOpacity>
            <Text style={s.stepperVal}>{offset} min</Text>
            <TouchableOpacity style={s.stepperBtn} onPress={() => changeOffset(type, +5)}><Text style={s.stepperBtnText}>+</Text></TouchableOpacity>
          </View>
        </View>
      </View>
    );

    return (
      <SafeAreaView style={s.root} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} bounces={false} overScrollMode="never">
          <SubHeader title={t.notifs} onBack={() => setSubPage(null)} />
          <Text style={s.sectionLabel}>{t.feedingRhythm.toLocaleUpperCase('en-US')}</Text>
          <RhythmCard type="water" icon="💧" title={t.waterRhythm} avg={waterAvg} offset={waterOffset} />
          <RhythmCard type="food"  icon="🍖" title={t.foodRhythm}  avg={foodAvg}  offset={foodOffset} />
          <Text style={[s.sectionLabel, { marginTop: sp[4] }]}>{t.otherNotifs.toLocaleUpperCase('en-US')}</Text>
          {([['morning', t.morningReminder, '07:00'], ['night', t.nightCheck, '22:00'], ['weekly', t.weeklyReport, 'Every Mon']] as [keyof typeof notifs, string, string][]).map(([k, label, sub]) => (
            <View key={k} style={s.notifItem}>
              <View>
                <Text style={s.notifLabel}>{label}</Text>
                <Text style={s.notifSub}>{sub}</Text>
              </View>
              <Switch
                value={notifs[k]}
                onValueChange={v => handleToggle(k, v)}
                trackColor={{ true: colors.accent500, false: colors.neutral200 }}
                thumbColor="#fff"
              />
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (subPage === 'settings' && activeDog) {
    const confirmWord = 'DELETE';
    const dogLogCount = logs.filter(l => l.dog_id === activeDog.id).length;
    const isOnlyDog = dogs.length === 1;
    const canDelete = deleteConfirm === confirmWord;
    const ageNow = computeAgeMonths(activeDog);

    return (
      <SafeAreaView style={s.root} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} bounces={false} overScrollMode="never">
          <SubHeader title={`${activeDog.name} — ${t.settings}`} onBack={() => { setSubPage(null); setDeleteConfirm(''); setShowDeleteZone(false); }} />

          <View style={s.settingRow}>
            <Text style={s.settingLabel}>{t.dogNameLabel}</Text>
            <TextInput
              style={s.settingInput}
              value={editName}
              onChangeText={setEditName}
              autoCapitalize="words"
              onBlur={() => { const tr = editName.trim(); if (tr) updateDog(activeDog.id, { name: tr }); else setEditName(activeDog.name); }}
            />
          </View>

          <View style={[s.settingRow, { alignItems: 'flex-start' }]}>
            <Text style={[s.settingLabel, { paddingTop: 6 }]}>{t.dogAvatarLabel}</Text>
            <View style={s.avatarGrid}>
              {DOG_AVATARS.map(emoji => (
                <TouchableOpacity key={emoji} style={[s.avatarBtn, activeDog.avatar === emoji && s.avatarBtnSel]} onPress={() => updateDog(activeDog.id, { avatar: emoji })}>
                  <Text style={{ fontSize: 20 }}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={s.settingRow}>
            <Text style={s.settingLabel}>{t.dogAge}</Text>
            <TouchableOpacity onPress={() => setShowEditBirthPicker(true)}>
              <Text style={s.linkText}>
                {activeDog.birth_date ? formatBirthDate(activeDog.birth_date, activeDog.birth_date.length <= 7) : `${ageNow} ${t.months}`}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={[s.settingRow, { justifyContent: 'flex-start' }]}>
            <TouchableOpacity style={s.checkRow} onPress={() => setEditApproximateMode(p => !p)}>
              <View style={[s.checkbox, editApproximateMode && s.checkboxChecked]}>
                {editApproximateMode && <Text style={{ color: '#fff', fontSize: 10, lineHeight: 14 }}>✓</Text>}
              </View>
              <Text style={s.checkLabel}>I don't know the exact day</Text>
            </TouchableOpacity>
          </View>

          <View style={s.settingRow}>
            <Text style={s.settingLabel}>Test Data</Text>
            <TouchableOpacity style={s.ghostBtn} onPress={seedData}>
              <Text style={s.ghostBtnText}>🧪 Load</Text>
            </TouchableOpacity>
          </View>

          <View style={s.settingRow}>
            <Text style={s.settingLabel}>Language</Text>
            <View style={s.langToggle}>
              <TouchableOpacity style={[s.langBtn, lang === 'tr' && s.langBtnActive]} onPress={() => setLang('tr')}>
                <Text style={[s.langText, lang === 'tr' && s.langTextActive]}>TR</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.langBtn, lang === 'en' && s.langBtnActive]} onPress={() => setLang('en')}>
                <Text style={[s.langText, lang === 'en' && s.langTextActive]}>EN</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={s.settingRow}>
            <View>
              <Text style={s.settingLabel}>{t.dataShareLabel}</Text>
              <Text style={s.settingDesc}>{t.dataShareDesc}</Text>
            </View>
            <Switch
              value={dataConsent}
              onValueChange={async (v) => { setDataConsent(v); if (v) await saveConsent(); else await clearConsent(); }}
              trackColor={{ true: colors.accent500, false: colors.neutral200 }}
              thumbColor="#fff"
            />
          </View>

          <View style={s.settingRow}>
            <Text style={s.settingLabel}>{t.privacyPolicy}</Text>
            <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_URL)}>
              <Text style={s.linkText}>Open</Text>
            </TouchableOpacity>
          </View>

          <View style={s.settingRow}>
            <Text style={[s.settingLabel, { color: colors.neutral500 }]}>{t.logoutBtn}</Text>
            <TouchableOpacity style={[s.ghostBtn, { backgroundColor: colors.dangerLight }]} onPress={() => supabase.auth.signOut()}>
              <Text style={[s.ghostBtnText, { color: colors.danger }]}>{t.logoutBtn}</Text>
            </TouchableOpacity>
          </View>

          {!showDeleteZone && (
            <View style={s.dangerSection}>
              <TouchableOpacity style={s.deleteTriggerBtn} onPress={() => setShowDeleteZone(true)}>
                <Text style={s.deleteTriggerText}>Delete {activeDog.name}…</Text>
              </TouchableOpacity>
            </View>
          )}

          {showDeleteZone && (
            <View style={s.dangerZone}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp[1], marginBottom: sp[2] }}>
                <Text>⚠️</Text>
                <Text style={s.dangerTitle}>DANGER ZONE</Text>
              </View>
              <Text style={s.dangerDesc}>
                All data for <Text style={{ fontFamily: 'DMSans_700Bold' }}>{activeDog.name}</Text>, including <Text style={{ fontFamily: 'DMSans_700Bold' }}>{dogLogCount} records</Text>, will be permanently deleted. This cannot be undone.
              </Text>
              {isOnlyDog && (
                <View style={s.onlyDogWarning}>
                  <Text style={s.onlyDogText}>🐾 This is your only dog. Deleting it will return the app to the welcome screen.</Text>
                </View>
              )}
              <Text style={s.confirmPrompt}>Type <Text style={{ fontFamily: 'DMSans_700Bold', color: colors.danger }}>DELETE</Text> to confirm:</Text>
              <TextInput
                style={[s.confirmInput, canDelete && { borderColor: colors.danger }]}
                value={deleteConfirm}
                onChangeText={setDeleteConfirm}
                placeholder="DELETE"
                placeholderTextColor={colors.neutral400}
                autoCapitalize="characters"
              />
              <TouchableOpacity
                style={[s.deleteBtn, !canDelete && s.deleteBtnDisabled]}
                disabled={!canDelete}
                onPress={deleteDog}>
                <Text style={[s.deleteBtnText, !canDelete && { color: colors.neutral400 }]}>Delete {activeDog.name}</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      <DateTimePickerModal
        isVisible={showEditBirthPicker}
        mode="date"
        maximumDate={new Date()}
        accentColor={colors.accent500}
        themeVariant="light"
        date={activeDog.birth_date ? (() => { const [y, m, d] = activeDog.birth_date!.split('-'); return new Date(parseInt(y), parseInt(m) - 1, parseInt(d ?? '1')); })() : new Date()}
        onConfirm={(date) => {
          const bd = editApproximateMode
            ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
            : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
          const [y, m] = bd.split('-').map(Number);
          const now = new Date();
          const ageMonths = Math.max(1, (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m));
          updateDog(activeDog.id, { birth_date: bd, age_months: ageMonths });
          setShowEditBirthPicker(false);
        }}
        onCancel={() => setShowEditBirthPicker(false)}
      />
      </SafeAreaView>
    );
  }

  if (subPage === 'location') return (
    <SafeAreaView style={s.root} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} bounces={false} overScrollMode="never">
        <SubHeader title={t.location} onBack={() => setSubPage(null)} />
        <View style={s.card}>
          <Text style={s.cardSub}>Location permission detects if your dog is inside or outside, so outdoor successes are tracked separately.</Text>
          <TouchableOpacity style={[s.primaryBtn, { marginTop: sp[3] }]} activeOpacity={0.85}>
            <Text style={s.primaryBtnText}>{t.enableLocation}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );

  if (subPage === 'export') return (
    <SafeAreaView style={s.root} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} bounces={false} overScrollMode="never">
        <SubHeader title={t.exportMenu} onBack={() => setSubPage(null)} />
        <View style={s.card}>
          <Text style={s.cardSub}>{total} records will be exported as PDF.</Text>
          <TouchableOpacity style={[s.primaryBtn, { marginTop: sp[3] }]} activeOpacity={0.85}>
            <Text style={s.primaryBtnText}>{t.exportBtn} ({total} records)</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );

  // ── Main profile view ──────────────────────────────────────────────────────

  if (loading) return <SafeAreaView style={s.root} edges={['top', 'left', 'right']} />;
  if (!activeDog) return null;

  const MENU: [typeof Bell, string, SubPage][] = [
    [Bell, t.notifs, 'notifs'],
    [MapPin, t.location, 'location'],
    [Export, t.exportMenu, 'export'],
    [Gear, t.settings, 'settings'],
  ];

  return (
    <SafeAreaView style={s.root} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} bounces={false} overScrollMode="never">
        <Text style={s.pageTitle}>{t.profile}</Text>

        {/* Dog switcher */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: sp[4] }}>
          <View style={s.switcher}>
            {dogs.map(dog => (
              <TouchableOpacity key={dog.id} style={[s.dogChip, dog.id === activeDogId && s.dogChipActive]} onPress={() => setActiveDogId(dog.id)} activeOpacity={0.8}>
                <Text style={{ fontSize: 16 }}>{dog.avatar}</Text>
                <Text style={[s.dogChipName, dog.id === activeDogId && s.dogChipNameActive]}>{dog.name}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={s.dogAddBtn} onPress={() => setSubPage('addDog')} activeOpacity={0.8}>
              <Plus size={18} color={colors.neutral400} />
              <Text style={s.dogAddText}>{t.addDog}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Hero */}
        <View style={[s.card, { marginBottom: sp[4] }]}>
          <View style={s.dogRow}>
            <View style={s.dogAva}><Text style={{ fontSize: 36 }}>{activeDog.avatar}</Text></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <TextInput
                style={s.dogName}
                value={editName}
                onChangeText={setEditName}
                onBlur={() => { const tr = editName.trim(); if (tr && tr !== activeDog.name) updateDog(activeDog.id, { name: tr }); else setEditName(activeDog.name); }}
                maxLength={20}
              />
              <Text style={s.dogBreed}>{activeDog.breed}</Text>
              <View style={s.dogTags}>
                <View style={s.dogTag}><Text style={s.dogTagText}>{currentAge} {t.months}</Text></View>
                <View style={s.dogTag}><Text style={s.dogTagText}>{BREED_SIZES[activeDog.breed_size]['en']}</Text></View>
                <View style={s.dogTag}><Text style={s.dogTagText}>{HOME_TYPES[activeDog.home]['en']}</Text></View>
              </View>
              <View style={s.levelBadge}>
                <Medal size={13} weight="bold" color={colors.accent600} />
                <Text style={s.levelText}>{LEVELS[level]['en']}</Text>
              </View>
            </View>
          </View>
          <View style={s.statsRow}>
            <View style={s.statItem}><Text style={s.statItemVal}>{total}</Text><Text style={s.statItemLbl}>{t.total}</Text></View>
            <View style={s.statItem}><Text style={s.statItemVal}>{days}</Text><Text style={s.statItemLbl}>{t.totalDays}</Text></View>
            <View style={s.statItem}><Text style={[s.statItemVal, { color: colors.success }]}>%{rate}</Text><Text style={s.statItemLbl}>{t.successRate}</Text></View>
          </View>
        </View>

        {/* Goals */}
        <View style={[s.card, { marginBottom: sp[4] }]}>
          <Text style={[s.cardTitle, { marginBottom: sp[3] }]}>{t.goals}</Text>
          <View style={s.goalRow}>
            <View style={s.goalTop}><Text style={s.goalLabel}>{t.dailyPee}</Text><Text style={[s.goalVal, { color: colors.success }]}>{todayPee}/{peeTarget}</Text></View>
            <ProgressBar value={(todayPee / peeTarget) * 100} color={colors.success} />
          </View>
          <View style={s.goalRow}>
            <View style={s.goalTop}><Text style={s.goalLabel}>{t.streak}</Text><Text style={[s.goalVal, { color: colors.accent500 }]}>{streak} Days</Text></View>
            <ProgressBar value={(streak / 7) * 100} color={colors.accent500} />
          </View>
        </View>

        {/* Menu */}
        {MENU.map(([Icon, label, page]) => (
          <TouchableOpacity key={page} style={s.menuItem} onPress={() => setSubPage(page)} activeOpacity={0.8}>
            <View style={s.menuIcon}><Icon size={20} color={colors.neutral600} /></View>
            <Text style={s.menuLabel}>{label}</Text>
            <CaretRight size={16} color={colors.neutral400} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.neutral100 },
  scroll: { padding: sp[4], paddingBottom: 100 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: colors.neutral500, marginTop: sp[3] },
  pageTitle: { fontFamily: 'Fraunces_900Black', fontSize: 28, color: colors.neutral900, marginBottom: sp[3] },
  subHdr: { flexDirection: 'row', alignItems: 'center', gap: sp[2], marginBottom: sp[5] },
  subHdrTitle: { fontFamily: 'DMSans_700Bold', fontSize: 16, color: colors.neutral900 },
  card: { backgroundColor: '#fff', borderRadius: radius.lg, padding: sp[4], marginBottom: sp[3], ...shadow.sm },
  cardTitle: { fontFamily: 'DMSans_700Bold', fontSize: 14, color: colors.neutral900 },
  cardSub: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: colors.neutral600, lineHeight: 20 },
  sectionLabel: { fontFamily: 'DMSans_700Bold', fontSize: 11, color: colors.neutral500, letterSpacing: 0.5, marginBottom: sp[2] },
  fieldLabel: { fontFamily: 'DMSans_700Bold', fontSize: 12, color: colors.neutral600, marginBottom: sp[1] },
  input: { borderWidth: 1.5, borderColor: colors.neutral200, borderRadius: radius.md, padding: sp[3], fontFamily: 'DMSans_400Regular', fontSize: 15, color: colors.neutral900, backgroundColor: '#fff' },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: sp[3] },
  stepperBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: colors.neutral200, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  stepperBtnText: { fontSize: 18, color: colors.neutral700, lineHeight: 22 },
  stepperVal: { fontFamily: 'DMSans_700Bold', fontSize: 14, color: colors.neutral900, minWidth: 60, textAlign: 'center' },
  optRow: { flexDirection: 'row', flexWrap: 'wrap', gap: sp[2] },
  optBtn: { paddingVertical: sp[1] + 2, paddingHorizontal: sp[3], borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.neutral200, backgroundColor: '#fff' },
  optBtnSel: { borderColor: colors.accent500, backgroundColor: colors.accent50 },
  optBtnText: { fontFamily: 'DMSans_600SemiBold', fontSize: 13, color: colors.neutral600 },
  optBtnTextSel: { color: colors.accent600 },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: sp[2] },
  avatarBtn: { width: 40, height: 40, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.neutral200, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  avatarBtnSel: { borderColor: colors.accent500, backgroundColor: colors.accent50 },
  dateField: { borderWidth: 1.5, borderColor: colors.neutral200, borderRadius: radius.md, padding: sp[3], backgroundColor: '#fff', marginBottom: sp[2] },
  dateFieldText: { fontFamily: 'DMSans_400Regular', fontSize: 15, color: colors.neutral900 },
  dateFieldPlaceholder: { fontFamily: 'DMSans_400Regular', fontSize: 15, color: colors.neutral500 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: sp[2], marginBottom: sp[1] },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: colors.neutral300, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  checkboxChecked: { backgroundColor: colors.accent500, borderColor: colors.accent500 },
  checkLabel: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: colors.neutral600 },
  primaryBtn: { backgroundColor: colors.accent500, borderRadius: radius.md, padding: sp[3], alignItems: 'center', marginBottom: sp[3] },
  primaryBtnDisabled: { opacity: 0.4 },
  primaryBtnText: { color: '#fff', fontFamily: 'DMSans_700Bold', fontSize: 14 },
  switcher: { flexDirection: 'row', gap: sp[2] },
  dogChip: { flexDirection: 'row', alignItems: 'center', gap: sp[1], paddingHorizontal: sp[3], paddingVertical: sp[2], borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.neutral200, backgroundColor: '#fff' },
  dogChipActive: { borderColor: colors.accent500, backgroundColor: colors.accent50 },
  dogChipName: { fontFamily: 'DMSans_700Bold', fontSize: 13, color: colors.neutral600 },
  dogChipNameActive: { color: colors.accent600 },
  dogAddBtn: { flexDirection: 'row', alignItems: 'center', gap: sp[1], paddingHorizontal: sp[3], paddingVertical: sp[2], borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.neutral200, borderStyle: 'dashed', backgroundColor: '#fff' },
  dogAddText: { fontFamily: 'DMSans_600SemiBold', fontSize: 13, color: colors.neutral500 },
  dogRow: { flexDirection: 'row', gap: sp[3], marginBottom: sp[4] },
  dogAva: { width: 64, height: 64, borderRadius: radius.lg, backgroundColor: colors.accent50, alignItems: 'center', justifyContent: 'center' },
  dogName: { fontFamily: 'Fraunces_900Black', fontSize: 20, color: colors.neutral900, flex: 1, padding: 0 },
  dogBreed: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: colors.neutral500, marginTop: 2 },
  dogTags: { flexDirection: 'row', flexWrap: 'wrap', gap: sp[1], marginTop: sp[1] },
  dogTag: { backgroundColor: colors.neutral100, borderRadius: radius.full, paddingHorizontal: sp[2], paddingVertical: 2 },
  dogTagText: { fontFamily: 'DMSans_600SemiBold', fontSize: 11, color: colors.neutral600 },
  levelBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: sp[1] },
  levelText: { fontFamily: 'DMSans_700Bold', fontSize: 11, color: colors.accent600, letterSpacing: 0.5 },
  statsRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.neutral100, paddingTop: sp[3] },
  statItem: { flex: 1, alignItems: 'center' },
  statItemVal: { fontFamily: 'Fraunces_900Black', fontSize: 24, color: colors.neutral900 },
  statItemLbl: { fontFamily: 'DMSans_700Bold', fontSize: 10, color: colors.neutral500, letterSpacing: 0.5, marginTop: 2 },
  goalRow: { marginBottom: sp[3] },
  goalTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: sp[1] },
  goalLabel: { fontFamily: 'DMSans_600SemiBold', fontSize: 13, color: colors.neutral700 },
  goalVal: { fontFamily: 'DMSans_700Bold', fontSize: 13 },
  pbar: { height: 8, backgroundColor: colors.neutral100, borderRadius: 4, overflow: 'hidden' },
  pfill: { height: '100%', borderRadius: 4 } as any,
  menuItem: { backgroundColor: '#fff', borderRadius: radius.lg, padding: sp[4], flexDirection: 'row', alignItems: 'center', gap: sp[3], marginBottom: sp[2], ...shadow.sm },
  menuIcon: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.neutral100, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { flex: 1, fontFamily: 'DMSans_600SemiBold', fontSize: 15, color: colors.neutral900 },
  notifItem: { backgroundColor: '#fff', borderRadius: radius.lg, padding: sp[4], flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: sp[2], ...shadow.sm },
  notifLabel: { fontFamily: 'DMSans_700Bold', fontSize: 14, color: colors.neutral900 },
  notifSub: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: colors.neutral500, marginTop: 2 },
  offsetRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: sp[2] },
  offsetLabel: { fontFamily: 'DMSans_600SemiBold', fontSize: 13, color: colors.neutral600 },
  settingRow: { backgroundColor: '#fff', borderRadius: radius.lg, padding: sp[4], flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: sp[2], gap: sp[3], ...shadow.sm },
  settingLabel: { fontFamily: 'DMSans_600SemiBold', fontSize: 14, color: colors.neutral900, flex: 1 },
  settingDesc: { fontFamily: 'DMSans_400Regular', fontSize: 11, color: colors.neutral500, marginTop: 2, maxWidth: 200, lineHeight: 16 },
  settingInput: { fontFamily: 'DMSans_700Bold', fontSize: 14, color: colors.neutral900, textAlign: 'center', borderWidth: 1.5, borderColor: colors.neutral200, borderRadius: radius.md, paddingHorizontal: sp[2], paddingVertical: sp[1], minWidth: 100 },
  ghostBtn: { backgroundColor: colors.neutral100, borderRadius: radius.md, paddingHorizontal: sp[3], paddingVertical: sp[1] + 2 },
  ghostBtnText: { fontFamily: 'DMSans_700Bold', fontSize: 13, color: colors.neutral500 },
  langToggle: { flexDirection: 'row', gap: 2, padding: 3, borderRadius: 8, borderWidth: 1, borderColor: colors.neutral200, backgroundColor: colors.neutral100 },
  langBtn: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6 },
  langBtnActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  langText: { fontFamily: 'DMSans_700Bold', fontSize: 12, color: colors.neutral500 },
  langTextActive: { color: colors.neutral900 },
  linkText: { fontFamily: 'DMSans_700Bold', fontSize: 13, color: colors.accent600 },
  dangerSection: { marginTop: sp[4], paddingTop: sp[4], borderTopWidth: 1, borderTopColor: colors.neutral200 },
  deleteTriggerBtn: { padding: sp[3], borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.neutral200 },
  deleteTriggerText: { fontFamily: 'DMSans_600SemiBold', fontSize: 13, color: colors.neutral500 },
  dangerZone: { marginTop: sp[4], padding: sp[4], borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.danger, backgroundColor: colors.dangerLight },
  dangerTitle: { fontFamily: 'DMSans_700Bold', fontSize: 12, color: colors.danger, letterSpacing: 0.5 },
  dangerDesc: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: colors.neutral700, lineHeight: 20, marginBottom: sp[2] },
  onlyDogWarning: { backgroundColor: 'rgba(184,48,48,0.08)', borderRadius: radius.md, padding: sp[2], marginBottom: sp[2] },
  onlyDogText: { fontFamily: 'DMSans_600SemiBold', fontSize: 12, color: colors.danger, lineHeight: 18 },
  confirmPrompt: { fontFamily: 'DMSans_600SemiBold', fontSize: 12, color: colors.neutral600, marginBottom: sp[2] },
  confirmInput: { borderWidth: 1.5, borderColor: colors.neutral200, borderRadius: radius.md, padding: sp[2], fontFamily: 'DMSans_700Bold', fontSize: 15, color: colors.danger, letterSpacing: 1, marginBottom: sp[3] },
  deleteBtn: { backgroundColor: colors.danger, borderRadius: radius.md, padding: sp[3], alignItems: 'center' },
  deleteBtnDisabled: { backgroundColor: colors.neutral200 },
  deleteBtnText: { fontFamily: 'DMSans_700Bold', fontSize: 14, color: '#fff' },
});
