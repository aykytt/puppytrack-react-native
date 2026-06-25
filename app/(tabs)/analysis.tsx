import { useState, useCallback, useRef, useEffect } from 'react';
import { useFocusEffect } from 'expo-router';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Animated, Easing } from 'react-native';

function FadeUp({ children }: { children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);
  return <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>;
}
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lightning, Confetti, Clock } from 'phosphor-react-native';
import { useAuth } from '../../src/lib/AuthContext';
import { useLang } from '../../src/lib/LangContext';
import { fetchDogs, fetchLogs } from '../../src/lib/supabase';
import { colors, sp, radius, shadow } from '../../src/theme';
import { T, DATA_COLORS } from '../../src/constants';
import { toDateStr, getInsight, computeStreak, getLastAccidentSub, computePeakHours } from '../../src/utils';
import { BarChart } from '../../src/components/charts/BarChart';
import { StackedBar } from '../../src/components/charts/StackedBar';
import { Donut } from '../../src/components/charts/Donut';
import { HBar } from '../../src/components/charts/HBar';
import type { Dog, TrainingLog } from '../../src/types';

type TabKey = 'summary' | 'time' | 'trend' | 'dist';
const DL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function AnalysisScreen() {
  const { user } = useAuth();
  const { lang } = useLang();
  const t = T[lang];
  const [dogs, setDogs] = useState<Dog[]>([]);
  const [logs, setLogs] = useState<TrainingLog[]>([]);
  const [tab, setTab] = useState<TabKey>('summary');

  useFocusEffect(useCallback(() => {
    if (!user) return;
    Promise.all([fetchDogs(user.id), fetchLogs(user.id)])
      .then(([d, l]) => { setDogs(d); setLogs(l); });
  }, [user]));

  const activeDog = dogs[0];
  const activeLogs = activeDog ? logs.filter(l => l.dog_id === activeDog.id) : [];
  const count = activeLogs.length;
  const progress = Math.round((count / 15) * 100);
  const progressAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    progressAnim.setValue(0);
    Animated.timing(progressAnim, { toValue: progress, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [progress]);
  const dataState = count === 0 ? 'empty' : count < 15 ? 'low' : 'sufficient';

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86400000);
    return { date: toDateStr(d), label: DL[d.getDay()] };
  });
  const hourly = [0, 4, 8, 12, 16, 20].map(h => ({
    l: String(h),
    v: activeLogs.filter(l => l.type === 'accident' && parseInt(l.time.split(':')[0]) >= h && parseInt(l.time.split(':')[0]) < h + 4).length,
  }));
  const weekly = last7.map(({ date, label }) => ({
    l: label,
    p: activeLogs.filter(l => l.date === date && l.sub === 'pee').length,
    k: activeLogs.filter(l => l.date === date && l.sub === 'poop').length,
    b: activeLogs.filter(l => l.date === date && l.sub === 'both').length,
  }));
  const accData = last7.map(({ date, label }) => ({
    l: label,
    v: activeLogs.filter(l => l.date === date && l.type === 'accident').length,
  }));
  const periods = [t.night, t.morning, t.noon, t.evening].map((name, i) => {
    const from = [0, 6, 12, 18][i], to = [6, 12, 18, 24][i];
    return { n: name, v: activeLogs.filter(l => l.type === 'accident' && parseInt(l.time.split(':')[0]) >= from && parseInt(l.time.split(':')[0]) < to).length };
  });

  const streak = computeStreak(activeLogs);
  const lastAccSub = getLastAccidentSub(activeLogs);
  const peak = computePeakHours(activeLogs);
  const insight = getInsight(activeLogs, t);

  const peeLogs = activeLogs.filter(l => l.type === 'accident' && l.sub === 'pee').length;
  const poopLogs = activeLogs.filter(l => l.type === 'accident' && l.sub === 'poop').length;
  const bothLogs = activeLogs.filter(l => l.type === 'accident' && l.sub === 'both').length;
  const accTotal = peeLogs + poopLogs + bothLogs || 1;
  const peePct = Math.round(peeLogs / accTotal * 100);
  const poopPct = Math.round(poopLogs / accTotal * 100);
  const bothPct = 100 - peePct - poopPct;
  const peeS = activeLogs.filter(l => l.type === 'success' && l.sub === 'pee').length;
  const poopS = activeLogs.filter(l => l.type === 'success' && l.sub === 'poop').length;
  const bothS = activeLogs.filter(l => l.type === 'success' && l.sub === 'both').length;
  const hb = (su: number, a: number) => { const tot = su + a || 1; return { sp: Math.round(su / tot * 100), ap: Math.round(a / tot * 100) }; };

  const sc = activeLogs.filter(l => l.type === 'success').length;
  const ac = activeLogs.filter(l => l.type === 'accident').length;

  const TABS: [TabKey, string][] = [['summary', t.summary], ['time', t.time], ['trend', t.trend], ['dist', t.dist]];

  if (!activeDog || dataState === 'empty') return (
    <SafeAreaView style={s.root} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} bounces={false} overScrollMode="never">
        <Text style={s.pageTitle}>{t.analysis}</Text>
        <View style={s.emptyState}>
          <Text style={{ fontSize: 48 }}>📊</Text>
          <Text style={s.emptyTitle}>{t.emptyTitle}</Text>
          <Text style={s.emptyDesc}>{t.emptyDesc}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );

  if (dataState === 'low') {
    const progressWidth = progressAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });
    return (
      <SafeAreaView style={s.root} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} bounces={false} overScrollMode="never">
          <Text style={s.pageTitle}>{t.analysis}</Text>
          <View style={s.card}>
            <Text style={s.cardTitle}>{t.lowDataTitle}</Text>
            <Text style={s.cardSub}>{count} {t.lowDataDesc} {15 - count} {t.lowDataNeeded}</Text>
            <View style={s.pbar}><Animated.View style={[s.pfill, { width: progressWidth, backgroundColor: colors.accent500 }]} /></View>
          </View>
          <View style={s.card}>
            <View style={{ flexDirection: 'row', gap: sp[2], alignItems: 'flex-start' }}>
              <Lightning size={20} weight="bold" color={colors.accent500} style={{ flexShrink: 0 }} />
              <Text style={s.insightText}>{insight}</Text>
            </View>
          </View>
          <View style={s.statRow}>
            <View style={s.statCard}><Text style={s.statLbl}>{t.success}</Text><Text style={[s.statVal, { color: colors.success }]}>{sc}</Text></View>
            <View style={s.statCard}><Text style={s.statLbl}>{t.accident}</Text><Text style={[s.statVal, { color: colors.danger }]}>{ac}</Text></View>
            <View style={s.statCard}><Text style={s.statLbl}>{t.totalDays}</Text><Text style={s.statVal}>{count}</Text></View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} bounces={false} overScrollMode="never">
        <Text style={s.pageTitle}>{t.analysis}</Text>

        {/* Tab bar */}
        <View style={s.tabBar}>
          {TABS.map(([k, l]) => (
            <TouchableOpacity key={k} style={[s.tabBtn, tab === k && s.tabBtnActive]} onPress={() => setTab(k)} activeOpacity={0.8}>
              <Text style={[s.tabLabel, tab === k && s.tabLabelActive]}>{l.toLocaleUpperCase('en-US')}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {tab === 'summary' && (
          <FadeUp><View>
            <View style={s.card}>
              <View style={{ flexDirection: 'row', gap: sp[2], alignItems: 'flex-start' }}>
                <Lightning size={20} weight="bold" color={colors.accent500} />
                <Text style={s.insightText}>{insight}</Text>
              </View>
            </View>
            <View style={s.card}>
              <Text style={s.sectionLabel}>{t.streakTitle.toLocaleUpperCase('en-US')}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: sp[2] }}>
                <Text style={s.streakNum}>{streak}</Text>
                <Text style={s.streakUnit}>{t.days}</Text>
              </View>
              <View style={s.streakBadge}>
                <Confetti size={18} weight="bold" color={colors.accent500} />
                <Text style={s.streakBadgeText}>
                  {streak > 0 ? `${streak} days without an accident!` : 'Start your streak today!'}
                </Text>
              </View>
              {lastAccSub && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp[1], marginTop: sp[1] }}>
                  <Clock size={13} color={colors.neutral500} />
                  <Text style={s.lastAccText}>
                    Last accident: {lastAccSub === 'pee' ? t.pee : lastAccSub === 'poop' ? t.poop : t.bothShort}
                  </Text>
                </View>
              )}
            </View>
            <View style={s.card}>
              <Text style={s.cardTitle}>{t.timePeriod}</Text>
              <View style={s.slotGrid}>
                {periods.map(({ n, v }) => (
                  <View key={n} style={s.slot}>
                    <Text style={s.slotName}>{n}</Text>
                    <Text style={s.slotVal}>{v}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View></FadeUp>
        )}

        {tab === 'time' && (
          <FadeUp><View>
            <View style={s.card}>
              <Text style={s.cardTitle}>{t.hourly}</Text>
              <Text style={s.cardSub}>{t.last24}</Text>
              <BarChart data={hourly} color={colors.danger} />
              <Text style={s.insightText}>
                {peak
                  ? `For ${activeDog.name}, ${String(peak.from).padStart(2, '0')}:00–${String(peak.to).padStart(2, '0')}:00 is the highest-risk window. Head outside then.`
                  : 'Risk hours will appear here once accident data builds up.'}
              </Text>
            </View>
          </View></FadeUp>
        )}

        {tab === 'trend' && (
          <FadeUp><View>
            <View style={s.card}>
              <Text style={s.cardTitle}>{t.dailyDist}</Text>
              <Text style={s.cardSub}>{t.last7}</Text>
              <StackedBar data={weekly} />
              <View style={s.legend}>
                {([[DATA_COLORS.pee, t.pee], [DATA_COLORS.poop, t.poop], [DATA_COLORS.both, t.bothShort]] as [string, string][]).map(([c, l]) => (
                  <View key={l} style={s.legItem}>
                    <View style={[s.legDot, { backgroundColor: c }]} />
                    <Text style={s.legLabel}>{l}</Text>
                  </View>
                ))}
              </View>
            </View>
            <View style={s.card}>
              <Text style={s.cardTitle}>{t.accCount}</Text>
              <Text style={s.cardSub}>{t.last7}</Text>
              <BarChart data={accData} color={colors.danger} />
            </View>
          </View></FadeUp>
        )}

        {tab === 'dist' && (
          <FadeUp><View>
            <View style={s.card}>
              <Text style={s.cardTitle}>{t.accType}</Text>
              <Text style={s.cardSub}>{t.last7}</Text>
              <View style={{ alignItems: 'center', marginVertical: sp[2] }}>
                <Donut pee={peePct} poop={poopPct} both={bothPct} />
              </View>
              <View style={[s.legend, { justifyContent: 'center' }]}>
                {([[DATA_COLORS.pee, t.pee], [DATA_COLORS.poop, t.poop], [DATA_COLORS.both, t.bothShort]] as [string, string][]).map(([c, l]) => (
                  <View key={l} style={s.legItem}>
                    <View style={[s.legDot, { backgroundColor: c }]} />
                    <Text style={s.legLabel}>{l}</Text>
                  </View>
                ))}
              </View>
            </View>
            <View style={s.card}>
              <Text style={s.cardTitle}>{t.detailedComp}</Text>
              <Text style={s.cardSub}>{t.last7}</Text>
              <HBar label={t.pee}       {...hb(peeS, peeLogs)} />
              <HBar label={t.poop}      {...hb(poopS, poopLogs)} />
              <HBar label={t.bothShort} {...hb(bothS, bothLogs)} />
              <View style={s.legend}>
                <View style={s.legItem}><View style={[s.legDot, { backgroundColor: colors.success }]} /><Text style={s.legLabel}>{t.correctPlace}</Text></View>
                <View style={s.legItem}><View style={[s.legDot, { backgroundColor: colors.danger }]} /><Text style={s.legLabel}>{t.accidentStatus}</Text></View>
              </View>
            </View>
          </View></FadeUp>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.neutral100 },
  scroll: { padding: sp[4], paddingBottom: 100 },
  pageTitle: { fontFamily: 'Fraunces_900Black', fontSize: 28, color: colors.neutral900, marginBottom: sp[6] },
  emptyState: { alignItems: 'center', paddingTop: sp[10] },
  emptyTitle: { fontFamily: 'DMSans_700Bold', fontSize: 17, color: colors.neutral900, marginTop: sp[3] },
  emptyDesc: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: colors.neutral500, marginTop: sp[2], textAlign: 'center' },
  card: { backgroundColor: '#fff', borderRadius: radius.lg, padding: sp[4], marginBottom: sp[3], ...shadow.sm },
  cardTitle: { fontFamily: 'DMSans_700Bold', fontSize: 14, color: colors.neutral900, marginBottom: 4 },
  cardSub: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: colors.neutral500, marginBottom: sp[2] },
  insightText: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: colors.neutral700, lineHeight: 20, flex: 1 },
  statRow: { flexDirection: 'row', gap: sp[2], marginBottom: sp[3] },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: radius.lg, padding: sp[3], ...shadow.sm },
  statLbl: { fontFamily: 'DMSans_700Bold', fontSize: 10, color: colors.neutral500, letterSpacing: 0.5, marginBottom: sp[1] },
  statVal: { fontFamily: 'DMSans_700Bold', fontSize: 20, color: colors.neutral900 },
  pbar: { height: 8, backgroundColor: colors.neutral100, borderRadius: 4, overflow: 'hidden', marginTop: sp[2] },
  pfill: { height: '100%', borderRadius: 4 } as any,
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: radius.lg, padding: 4, marginBottom: sp[4], ...shadow.sm, gap: 2 },
  tabBtn: { flex: 1, paddingVertical: sp[1] + 2, borderRadius: radius.md, alignItems: 'center' },
  tabBtnActive: { backgroundColor: colors.accent500 },
  tabLabel: { fontFamily: 'DMSans_700Bold', fontSize: 11, color: colors.neutral500, letterSpacing: 0.5 },
  tabLabelActive: { color: '#fff' },
  sectionLabel: { fontFamily: 'DMSans_700Bold', fontSize: 10, color: colors.neutral500, letterSpacing: 0.5, marginBottom: sp[1] },
  streakNum: { fontFamily: 'Fraunces_900Black', fontSize: 40, color: colors.neutral900 },
  streakUnit: { fontFamily: 'DMSans_600SemiBold', fontSize: 16, color: colors.neutral500 },
  streakBadge: { flexDirection: 'row', alignItems: 'center', gap: sp[1], backgroundColor: colors.accent50, borderRadius: radius.md, padding: sp[2], marginTop: sp[2] },
  streakBadgeText: { fontFamily: 'DMSans_600SemiBold', fontSize: 13, color: colors.accent600 },
  lastAccText: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: colors.neutral500 },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: sp[2], marginTop: sp[2] },
  slot: { flex: 1, minWidth: '40%', backgroundColor: colors.neutral100, borderRadius: radius.md, padding: sp[2], flexDirection: 'row', justifyContent: 'space-between' },
  slotName: { fontFamily: 'DMSans_600SemiBold', fontSize: 12, color: colors.neutral600 },
  slotVal: { fontFamily: 'DMSans_700Bold', fontSize: 14, color: colors.neutral900 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: sp[3], marginTop: sp[3] },
  legItem: { flexDirection: 'row', alignItems: 'center', gap: sp[1] },
  legDot: { width: 10, height: 10, borderRadius: 5 },
  legLabel: { fontFamily: 'DMSans_600SemiBold', fontSize: 12, color: colors.neutral600 },
});
