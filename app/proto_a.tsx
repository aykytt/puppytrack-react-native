// PROTOTYPE A — Solid Colored Buttons
// Test: navigate to /proto_a in dev menu
import { useState, useRef, useCallback, useEffect } from 'react';
import { useFocusEffect } from 'expo-router';
import { router } from 'expo-router';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Animated, Pressable, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WarningCircle, Timer, ClipboardText, Check, X, CaretRight } from 'phosphor-react-native';
import { useAuth } from '../src/lib/AuthContext';
import { useLang } from '../src/lib/LangContext';
import { supabase, fetchDogs, fetchLogs, fetchFeedingLogs } from '../src/lib/supabase';
import { colors, sp, radius, shadow } from '../src/theme';
import { T } from '../src/constants';
import { toDateStr, computePrediction, getPredMessage, getFeedingOffset, computeWaterPairCount, computeFoodPairCount, generateUUID } from '../src/utils';
import { useCountUp } from '../src/hooks/useCountUp';
import { PeeSVG, PoopSVG, BothSVG } from '../src/components/icons/SubIcons';
import type { Dog, TrainingLog, FeedingLog, Lang } from '../src/types';

type Sub = 'pee' | 'poop' | 'both';

function formatShortDate(d: Date, lang: Lang): string {
  return d.toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

function RhythmBar({ icon, count }: { icon: string; count: number }) {
  const inCycle = (count % 10 === 0 && count > 0) ? 10 : count % 10;
  return (
    <View style={rb.row}>
      <Text style={rb.icon}>{icon}</Text>
      <View style={rb.track}><View style={[rb.fill, { width: `${inCycle * 10}%` as any }]} /></View>
      <Text style={rb.count}>{inCycle}/10</Text>
    </View>
  );
}
const rb = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', gap: sp[2] },
  icon:  { fontSize: 16, width: 24 },
  track: { flex: 1, height: 7, backgroundColor: colors.neutral100, borderRadius: 4, overflow: 'hidden' },
  fill:  { height: '100%', backgroundColor: colors.accent500, borderRadius: 4 },
  count: { fontFamily: 'DMSans_700Bold', fontSize: 11, color: colors.neutral600, minWidth: 32, textAlign: 'right' },
});

export default function ProtoA() {
  const { user } = useAuth();
  const { lang } = useLang();
  const t = T[lang];
  const [dogs, setDogs] = useState<Dog[]>([]);
  const [logs, setLogs] = useState<TrainingLog[]>([]);
  const [feedingLogs, setFeedingLogs] = useState<FeedingLog[]>([]);
  const [sub, setSub] = useState<{ type: 'success' | 'accident' } | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'accident'; subtype: Sub } | null>(null);
  const [feedingToast, setFeedingToast] = useState<'water' | 'food' | null>(null);
  const toastAnim = useRef(new Animated.Value(0)).current;
  const toastY    = useRef(new Animated.Value(-8)).current;

  const activeDog = dogs[0];
  const activeLogs = activeDog ? logs.filter(l => l.dog_id === activeDog.id) : [];
  const todayStr = toDateStr(new Date());
  const today = activeLogs.filter(l => l.date === todayStr);
  const sc = today.filter(l => l.type === 'success').length;
  const ac = today.filter(l => l.type === 'accident').length;
  const total = today.length;
  const sp_ = total ? Math.round(sc / total * 100) : 0;
  const ap  = total ? Math.round(ac / total * 100) : 0;
  const pred = activeDog ? computePrediction(activeDog, activeLogs) : null;
  const waterPairCount = activeDog ? computeWaterPairCount(feedingLogs, logs, activeDog.id) : 0;
  const foodPairCount  = activeDog ? computeFoodPairCount(feedingLogs, logs, activeDog.id)  : 0;
  const animTotal = useCountUp(total);
  const animSp = useCountUp(sp_);
  const animAp = useCountUp(ap);

  useFocusEffect(useCallback(() => {
    if (!user) return;
    Promise.all([fetchDogs(user.id), fetchLogs(user.id), fetchFeedingLogs(user.id)])
      .then(([d, l, f]) => { setDogs(d); setLogs(l); setFeedingLogs(f); });
  }, [user]));

  const showToast = (type: 'success' | 'accident', subtype: Sub) => {
    toastY.setValue(-8);
    setToast({ type, subtype });
    Animated.sequence([
      Animated.parallel([
        Animated.timing(toastAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(toastY,    { toValue: 0, duration: 250, useNativeDriver: true }),
      ]),
      Animated.delay(2500),
      Animated.parallel([
        Animated.timing(toastAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(toastY,    { toValue: -8, duration: 250, useNativeDriver: true }),
      ]),
    ]).start(() => setToast(null));
  };

  const addLog = async (type: 'success' | 'accident', subtype: Sub) => {
    if (!activeDog || !user) return;
    const id = Math.random().toString(36).slice(2);
    const now = new Date();
    const log: TrainingLog = {
      id, dog_id: activeDog.id, date: todayStr, type, sub: subtype,
      time: `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`,
      location: 'indoor',
    };
    setLogs(prev => [log, ...prev]);
    setSub(null);
    showToast(type, subtype);
    await supabase.from('training_logs').insert({ ...log, user_id: user.id });
  };

  const addFeedingLog = async (type: 'water' | 'food') => {
    if (!activeDog || !user) return;
    const fl: FeedingLog = {
      id: generateUUID(), dog_id: activeDog.id, user_id: user.id, type,
      timestamp: new Date().toISOString(), source: 'manual',
    };
    setFeedingLogs(prev => [fl, ...prev]);
    setFeedingToast(type);
    setTimeout(() => setFeedingToast(null), 3000);
    await supabase.from('feeding_logs').insert(fl);
  };

  const subLabel = (sv: Sub) => ({ pee: t.onlyPee, poop: t.onlyPoop, both: t.both }[sv]);

  if (!activeDog) return (
    <SafeAreaView style={s.root} edges={['top','left','right']}>
      <View style={s.empty}>
        <Text style={s.emptyEmoji}>🐾</Text>
        <Text style={s.emptyTitle}>Welcome to PuppyTrack</Text>
        <TouchableOpacity style={s.emptyBtn} onPress={() => router.navigate('/(tabs)/profile')} activeOpacity={0.85}>
          <Text style={s.emptyBtnText}>Add your dog →</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  if (sub) return (
    <SafeAreaView style={s.root} edges={['top','left','right']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} bounces={false} overScrollMode="never">
        <View style={s.subHdr}>
          <TouchableOpacity onPress={() => setSub(null)} hitSlop={12}><X size={22} color={colors.neutral700} /></TouchableOpacity>
          <Text style={s.subHdrTitle}>{t.selectType}</Text>
        </View>
        <View style={[s.chip, sub.type === 'success' ? s.chipG : s.chipR]}>
          {sub.type === 'success' ? <Check size={12} weight="bold" color={colors.success} /> : <X size={12} weight="bold" color={colors.danger} />}
          <Text style={[s.chipTxt, sub.type === 'success' ? s.chipTxtG : s.chipTxtR]}>
            {sub.type === 'success' ? t.correctPlace : t.accidentStatus}
          </Text>
        </View>
        {([['pee', <PeeSVG />], ['poop', <PoopSVG />], ['both', <BothSVG />]] as [Sub, React.ReactNode][]).map(([sv, icon]) => (
          <TouchableOpacity key={sv} style={s.actionBtn} onPress={() => addLog(sub.type, sv)} activeOpacity={0.8}>
            <View style={s.actionIcon}>{icon}</View>
            <Text style={s.actionText}>{subLabel(sv)}</Text>
            <CaretRight size={18} color={colors.neutral400} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={s.root} edges={['top','left','right']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} bounces={false} overScrollMode="never">

        {/* TopBar */}
        <View style={s.topBar}>
          <View style={s.logo}>
            <View style={s.logoIcon}><Text style={{ fontSize: 16 }}>🐾</Text></View>
            <Text style={s.logoText}>PuppyTrack</Text>
          </View>
          <Text style={s.dogName}>{activeDog.name}</Text>
        </View>

        <Text style={s.pageTitle}>{t.today}</Text>

        {/* Toast */}
        {toast && (
          <Animated.View style={[s.toast, { opacity: toastAnim, transform: [{ translateY: toastY }] }]}>
            <Text style={{ fontSize: 18 }}>{toast.type === 'success' ? '✅' : '⚠️'}</Text>
            <View style={{ marginLeft: sp[3] }}>
              <Text style={s.toastTitle}>{t.saved}</Text>
              <Text style={s.toastSub}>{subLabel(toast.subtype)}</Text>
            </View>
          </Animated.View>
        )}

        {/* Stat cards */}
        <View style={[s.statRow, { marginBottom: sp[5] }]}>
          <View style={[s.statCard, s.statCardNeutral]}>
            <Text style={s.statLbl}>{t.todayRec}</Text>
            <Text style={s.statVal}>{animTotal} <Text style={s.statUnit}>{t.records}</Text></Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statLbl}>{t.success}</Text>
            <Text style={[s.statVal, { color: colors.success }]}>%{animSp}</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statLbl}>{t.accident}</Text>
            <Text style={[s.statVal, { color: colors.danger }]}>%{animAp}</Text>
          </View>
        </View>

        {/* Prediction banner */}
        {!toast && (
          <View style={{ marginBottom: sp[4] }}>
            {pred ? (() => {
              const isNow = pred.urgency === 'now', isSoon = pred.urgency === 'soon';
              const color = isNow ? colors.danger : colors.accent500;
              return (
                <View style={[s.predBanner, (isNow || isSoon) && { borderLeftWidth: 3, borderLeftColor: color }]}>
                  {isNow ? <WarningCircle size={22} weight="bold" color={color} /> : <Timer size={22} weight="bold" color={color} />}
                  <View style={{ marginLeft: sp[2], flex: 1 }}>
                    <Text style={[s.predTitle, isNow && { color }]}>{t.pred}</Text>
                    <Text style={s.predText}>{getPredMessage(activeDog, pred.urgency, pred.remaining, lang)}</Text>
                  </View>
                </View>
              );
            })() : (
              <View style={s.infoBanner}>
                <ClipboardText size={20} color={colors.neutral500} />
                <Text style={s.infoText}>{t.noRecord}</Text>
              </View>
            )}
          </View>
        )}

        {/* ── OPTION A: Solid colored action buttons ── */}
        <Text style={s.sectionLabel}>LOG</Text>
        <TouchableOpacity
          style={[s.solidBtn, s.solidBtnSuccess]}
          onPress={() => setSub({ type: 'success' })}
          activeOpacity={0.85}
        >
          <Text style={s.solidBtnLabel}>{t.correctPlace}</Text>
          <View style={s.solidBtnCircle}>
            <Check size={20} weight="bold" color={colors.success} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.solidBtn, s.solidBtnAccident]}
          onPress={() => setSub({ type: 'accident' })}
          activeOpacity={0.85}
        >
          <Text style={s.solidBtnLabel}>{t.accidentStatus}</Text>
          <View style={s.solidBtnCircle}>
            <X size={20} weight="bold" color={colors.danger} />
          </View>
        </TouchableOpacity>

        {/* Feeding buttons — smaller, outlined with accent tint */}
        <View style={s.feedingRow}>
          <TouchableOpacity style={s.feedBtn} onPress={() => addFeedingLog('water')} activeOpacity={0.8}>
            <Text style={s.feedBtnText}>💧 {t.waterLog}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.feedBtn} onPress={() => addFeedingLog('food')} activeOpacity={0.8}>
            <Text style={s.feedBtnText}>🍖 {t.foodLog}</Text>
          </TouchableOpacity>
        </View>

        {feedingToast && (
          <View style={s.feedToast}>
            <Text style={s.feedToastText}>✓ {t.feedingLogged} · {getFeedingOffset(activeDog, feedingToast)} min</Text>
          </View>
        )}

        {/* Rhythm card */}
        <View style={s.rhythmCard}>
          <Text style={s.rhythmLabel}>{t.rhythmLabel}</Text>
          <RhythmBar icon="💧" count={waterPairCount} />
          <RhythmBar icon="🍖" count={foodPairCount} />
          <Text style={s.rhythmCta}>{t.rhythmCta}</Text>
          {(waterPairCount >= 10 || foodPairCount >= 10) && (
            <>
              <View style={s.rhythmDivider} />
              {waterPairCount >= 10 && <Text style={s.rhythmResult}>{t.rhythmWaterResult(activeDog.water_offset)}</Text>}
              {foodPairCount >= 10  && <Text style={s.rhythmResult}>{t.rhythmFoodResult(activeDog.food_offset)}</Text>}
              {feedingLogs[0] && (
                <View style={s.rhythmUpdated}>
                  <Timer size={11} color={colors.neutral500} />
                  <Text style={s.rhythmUpdatedText}>{t.rhythmLastCalc} {formatShortDate(new Date(feedingLogs[0].timestamp), lang)}</Text>
                </View>
              )}
            </>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:  { flex: 1, backgroundColor: colors.neutral100 },
  scroll: { padding: sp[4], paddingBottom: 100 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: sp[8] },
  emptyEmoji: { fontSize: 52, marginBottom: sp[3] },
  emptyTitle: { fontFamily: 'Fraunces_900Black', fontSize: 22, color: colors.neutral900, textAlign: 'center', marginBottom: sp[5] },
  emptyBtn: { backgroundColor: colors.accent500, borderRadius: radius.md, paddingVertical: sp[3], paddingHorizontal: sp[6] },
  emptyBtnText: { color: '#fff', fontFamily: 'DMSans_700Bold', fontSize: 15 },

  topBar:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: sp[3] },
  logo:    { flexDirection: 'row', alignItems: 'center', gap: sp[2] },
  logoIcon: { width: 32, height: 32, borderRadius: radius.sm, backgroundColor: colors.accent50, alignItems: 'center', justifyContent: 'center' },
  logoText: { fontFamily: 'DMSans_700Bold', fontSize: 15, color: colors.accent600, letterSpacing: -0.3 },
  dogName:  { fontFamily: 'DMSans_600SemiBold', fontSize: 13, color: colors.neutral600 },
  pageTitle: { fontFamily: 'Fraunces_900Black', fontSize: 28, color: colors.neutral900, lineHeight: 34, marginBottom: sp[6] },

  toast: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: radius.lg, padding: sp[3], marginBottom: sp[3], ...shadow.md },
  toastTitle: { fontFamily: 'DMSans_700Bold', fontSize: 13, color: colors.neutral900 },
  toastSub:   { fontFamily: 'DMSans_400Regular', fontSize: 11, color: colors.neutral500 },

  statRow:        { flexDirection: 'row', gap: sp[2] },
  statCard:       { flex: 1, backgroundColor: '#fff', borderRadius: radius.lg, padding: sp[3], ...shadow.sm, borderWidth: 2, borderColor: 'transparent' },
  statCardNeutral: { borderColor: colors.neutral200 },
  statLbl:  { fontFamily: 'DMSans_700Bold', fontSize: 10, color: colors.neutral500, letterSpacing: 0.5, marginBottom: sp[1] },
  statVal:  { fontFamily: 'DMSans_700Bold', fontSize: 19, color: colors.neutral900 },
  statUnit: { fontFamily: 'DMSans_500Medium', fontSize: 11, color: colors.neutral500 },

  predBanner: { backgroundColor: '#fff', borderRadius: radius.lg, padding: sp[3], flexDirection: 'row', alignItems: 'center', ...shadow.sm },
  predTitle:  { fontFamily: 'DMSans_700Bold', fontSize: 11, color: colors.neutral500, letterSpacing: 0.5 },
  predText:   { fontFamily: 'DMSans_400Regular', fontSize: 13, color: colors.neutral900, marginTop: 2 },
  infoBanner: { backgroundColor: '#fff', borderRadius: radius.lg, padding: sp[3], flexDirection: 'row', alignItems: 'center', gap: sp[2], ...shadow.sm },
  infoText:   { fontFamily: 'DMSans_400Regular', fontSize: 12, color: colors.neutral700, flex: 1 },

  // ── OPTION A styles ──
  sectionLabel: {
    fontFamily: 'DMSans_700Bold', fontSize: 10, color: colors.neutral500,
    letterSpacing: 1, marginBottom: sp[2], marginTop: sp[1],
  },
  solidBtn: {
    borderRadius: radius.xl, paddingVertical: sp[4], paddingHorizontal: sp[4],
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: sp[2],
  },
  solidBtnSuccess: { backgroundColor: colors.success },
  solidBtnAccident: { backgroundColor: colors.danger },
  solidBtnLabel: { fontFamily: 'DMSans_700Bold', fontSize: 17, color: '#fff' },
  solidBtnCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },

  feedingRow: { flexDirection: 'row', gap: sp[2], marginTop: sp[3] },
  feedBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    padding: sp[3], borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.accent200, backgroundColor: colors.accent50,
  },
  feedBtnText: { fontFamily: 'DMSans_600SemiBold', fontSize: 13, color: colors.accent700 },
  feedToast: { marginTop: sp[2], padding: sp[2], borderRadius: radius.md, backgroundColor: colors.neutral200, alignItems: 'center' },
  feedToastText: { fontFamily: 'DMSans_600SemiBold', fontSize: 12, color: colors.neutral600 },

  rhythmCard:        { backgroundColor: '#fff', borderRadius: radius.lg, padding: sp[4], marginTop: sp[4], gap: sp[2], ...shadow.sm },
  rhythmLabel:       { fontFamily: 'DMSans_700Bold', fontSize: 10, color: colors.neutral600, letterSpacing: 0.8, marginBottom: sp[1] },
  rhythmCta:         { fontFamily: 'DMSans_400Regular', fontSize: 12, color: colors.neutral500, lineHeight: 17, marginTop: sp[1] },
  rhythmDivider:     { height: 1, backgroundColor: colors.neutral100, marginVertical: sp[2] },
  rhythmResult:      { fontFamily: 'DMSans_600SemiBold', fontSize: 13, color: colors.neutral800 },
  rhythmUpdated:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: sp[1] },
  rhythmUpdatedText: { fontFamily: 'DMSans_400Regular', fontSize: 10, color: colors.neutral600 },

  subHdr:      { flexDirection: 'row', alignItems: 'center', gap: sp[2], marginBottom: sp[5] },
  subHdrTitle: { fontFamily: 'DMSans_700Bold', fontSize: 16, color: colors.neutral900 },
  chip:    { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: sp[1], paddingHorizontal: sp[3], paddingVertical: sp[1], borderRadius: radius.full, marginBottom: sp[3] },
  chipG:   { backgroundColor: colors.successLight },
  chipR:   { backgroundColor: colors.dangerLight },
  chipTxt: { fontFamily: 'DMSans_700Bold', fontSize: 12 },
  chipTxtG: { color: colors.success },
  chipTxtR: { color: colors.danger },
  actionBtn:  { backgroundColor: '#fff', borderRadius: radius.xl, padding: sp[4], marginBottom: sp[2], flexDirection: 'row', alignItems: 'center', gap: sp[3], ...shadow.sm },
  actionIcon: { width: 40, alignItems: 'center', justifyContent: 'center' },
  actionText: { flex: 1, fontFamily: 'DMSans_600SemiBold', fontSize: 15, color: colors.neutral900 },
});
