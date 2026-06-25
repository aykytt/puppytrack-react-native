import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, Check, X, Trash } from 'phosphor-react-native';
import { useAuth } from '../../src/lib/AuthContext';
import { useLang } from '../../src/lib/LangContext';
import { supabase, fetchDogs, fetchLogs, fetchFeedingLogs } from '../../src/lib/supabase';
import { colors, sp, radius, shadow } from '../../src/theme';
import { T } from '../../src/constants';
import { toDateStr } from '../../src/utils';
import type { Dog, TrainingLog, FeedingLog } from '../../src/types';

type HistoryItem =
  | { kind: 'training'; data: TrainingLog; date: string; time: string }
  | { kind: 'feeding'; data: FeedingLog; date: string; time: string };

function isoToDateStr(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

function isoToTimeStr(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function HistoryScreen() {
  const { user } = useAuth();
  const { lang } = useLang();
  const t = T[lang];
  const [dogs, setDogs] = useState<Dog[]>([]);
  const [logs, setLogs] = useState<TrainingLog[]>([]);
  const [feedingLogs, setFeedingLogs] = useState<FeedingLog[]>([]);
  const [filter, setFilter] = useState('all');

  useFocusEffect(useCallback(() => {
    if (!user) return;
    Promise.all([fetchDogs(user.id), fetchLogs(user.id), fetchFeedingLogs(user.id)])
      .then(([d, l, f]) => { setDogs(d); setLogs(l); setFeedingLogs(f); });
  }, [user]));

  const activeDog = dogs[0];
  const activeLogs = activeDog ? logs.filter(l => l.dog_id === activeDog.id) : [];
  const activeFeeding = activeDog ? feedingLogs.filter(f => f.dog_id === activeDog.id) : [];

  const allItems: HistoryItem[] = [
    ...activeLogs.map(log => ({ kind: 'training' as const, data: log, date: log.date, time: log.time })),
    ...activeFeeding.map(fl => ({ kind: 'feeding' as const, data: fl, date: isoToDateStr(fl.timestamp), time: isoToTimeStr(fl.timestamp) })),
  ];

  const filtered =
    filter === 'all' ? allItems :
    filter === 'feeding' ? allItems.filter(i => i.kind === 'feeding') :
    allItems.filter(i => i.kind === 'training' && (i.data as TrainingLog).type === filter);

  const grouped = filtered.reduce<Record<string, HistoryItem[]>>((acc, item) => {
    if (!acc[item.date]) acc[item.date] = [];
    acc[item.date].push(item);
    return acc;
  }, {});

  const sortedDates = Object.keys(grouped).sort((a, b) => {
    const toKey = (d: string) => d.split('.').reverse().join('');
    return toKey(b).localeCompare(toKey(a));
  });
  sortedDates.forEach(date => grouped[date].sort((a, b) => b.time.localeCompare(a.time)));

  const subLabel = (sv: string) => ({ pee: t.onlyPee, poop: t.onlyPoop, both: t.both }[sv] ?? sv);

  const filters: [string, string, number][] = [
    ['all', t.all, allItems.length],
    ['success', t.correctPlace, activeLogs.filter(l => l.type === 'success').length],
    ['accident', t.accidents, activeLogs.filter(l => l.type === 'accident').length],
    ['feeding', t.feedingFilter, activeFeeding.length],
  ];

  const deleteItem = async (item: HistoryItem) => {
    const label = item.kind === 'training'
      ? `${(item.data as TrainingLog).type === 'success' ? t.correctPlace : t.accidentStatus} · ${item.time}`
      : `${(item.data as FeedingLog).type === 'water' ? t.waterLog : t.foodLog} · ${item.time}`;
    Alert.alert(t.deleteLog, label, [
      { text: t.cancel ?? 'Cancel', style: 'cancel' },
      {
        text: t.delete ?? 'Delete', style: 'destructive', onPress: async () => {
          if (item.kind === 'training') {
            setLogs(prev => prev.filter(l => l.id !== item.data.id));
            await supabase.from('training_logs').delete().eq('id', item.data.id);
          } else {
            setFeedingLogs(prev => prev.filter(f => f.id !== item.data.id));
            await supabase.from('feeding_logs').delete().eq('id', item.data.id);
          }
        },
      },
    ]);
  };

  const addTodayEntry = () => {
    // Quick add: navigate or show a modal — for now shows an alert
    Alert.alert('Add Entry', 'Use the Home tab to add a new entry.');
  };

  if (!activeDog) return (
    <SafeAreaView style={s.root} edges={['top', 'left', 'right']}>
      <View style={s.empty}><Text style={{ fontSize: 40 }}>📋</Text><Text style={s.emptyText}>Add a dog first.</Text></View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={s.root} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false} bounces={false} overScrollMode="never">
        <Text style={s.pageTitle}>{t.history}</Text>

        <TouchableOpacity style={s.addBtn} onPress={addTodayEntry} activeOpacity={0.8}>
          <Plus size={16} color={colors.accent600} />
          <Text style={s.addBtnText}>{t.addHistoryEntry}</Text>
        </TouchableOpacity>

        {/* Filter bar */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: sp[4] }}>
          <View style={s.filterBar}>
            {filters.map(([k, label, cnt]) => (
              <TouchableOpacity key={k} style={[s.filterBtn, filter === k && s.filterBtnActive]} onPress={() => setFilter(k)} activeOpacity={0.8}>
                <Text style={[s.filterLabel, filter === k && s.filterLabelActive]}>{label}</Text>
                <View style={[s.filterBadge, filter === k && s.filterBadgeActive]}>
                  <Text style={[s.filterBadgeText, filter === k && s.filterBadgeTextActive]}>{cnt}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {sortedDates.length === 0 && (
          <View style={s.emptyState}>
            <Text style={{ fontSize: 40 }}>📋</Text>
            <Text style={s.emptyTitle}>{t.emptyTitle}</Text>
            <Text style={s.emptyDesc}>{t.emptyDesc}</Text>
          </View>
        )}

        {sortedDates.map(date => (
          <View key={date}>
            <Text style={s.dateLbl}>{date}</Text>
            {grouped[date].map(item => {
              if (item.kind === 'training') {
                const log = item.data as TrainingLog;
                return (
                  <View key={log.id} style={s.logItem}>
                    <View style={[s.logIco, log.type === 'success' ? s.logIcoG : s.logIcoR]}>
                      {log.type === 'success'
                        ? <Check size={13} weight="bold" color={colors.success} />
                        : <X size={13} weight="bold" color={colors.danger} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.logTitle}>{log.type === 'success' ? t.correctPlace : t.accidentStatus}</Text>
                      <Text style={s.logSub}>{subLabel(log.sub)} · {log.location ?? 'indoor'} · {log.time}</Text>
                    </View>
                    <TouchableOpacity onPress={() => deleteItem(item)} hitSlop={8}>
                      <Trash size={16} color={colors.neutral400} />
                    </TouchableOpacity>
                  </View>
                );
              }
              const fl = item.data as FeedingLog;
              return (
                <View key={fl.id} style={s.logItem}>
                  <View style={s.logIcoNeutral}>
                    <Text style={{ fontSize: 12 }}>{fl.type === 'water' ? '💧' : '🍖'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.logTitle}>{fl.type === 'water' ? t.waterLog : t.foodLog}</Text>
                    <Text style={s.logSub}>{item.time}</Text>
                  </View>
                  <TouchableOpacity onPress={() => deleteItem(item)} hitSlop={8}>
                    <Trash size={16} color={colors.neutral400} />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
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
  pageTitle: { fontFamily: 'Fraunces_900Black', fontSize: 28, color: colors.neutral900, marginBottom: sp[6] },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: sp[2],
    paddingVertical: sp[2] + 2, paddingHorizontal: sp[3],
    borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.accent200,
    backgroundColor: colors.accent50, marginBottom: sp[4],
    alignSelf: 'flex-start',
  },
  addBtnText: { fontFamily: 'DMSans_700Bold', fontSize: 13, color: colors.accent600 },
  filterBar: { flexDirection: 'row', gap: sp[2] },
  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: sp[1], paddingVertical: sp[1] + 2, paddingHorizontal: sp[3], borderRadius: radius.full, borderWidth: 1.5, borderColor: colors.neutral200, backgroundColor: '#fff' },
  filterBtnActive: { backgroundColor: colors.accent500, borderColor: colors.accent500 },
  filterLabel: { fontFamily: 'DMSans_700Bold', fontSize: 12, color: colors.neutral600 },
  filterLabelActive: { color: '#fff' },
  filterBadge: { backgroundColor: colors.neutral100, borderRadius: radius.full, paddingHorizontal: 6, paddingVertical: 1, minWidth: 20, alignItems: 'center' },
  filterBadgeActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  filterBadgeText: { fontFamily: 'DMSans_700Bold', fontSize: 11, color: colors.neutral500 },
  filterBadgeTextActive: { color: '#fff' },
  emptyState: { alignItems: 'center', paddingTop: sp[8] },
  emptyTitle: { fontFamily: 'DMSans_700Bold', fontSize: 16, color: colors.neutral900, marginTop: sp[3] },
  emptyDesc: { fontFamily: 'DMSans_400Regular', fontSize: 13, color: colors.neutral500, marginTop: sp[1], textAlign: 'center' },
  dateLbl: { fontFamily: 'DMSans_700Bold', fontSize: 11, color: colors.neutral500, letterSpacing: 0.5, marginVertical: sp[2] },
  logItem: { backgroundColor: '#fff', borderRadius: radius.lg, padding: sp[3], flexDirection: 'row', alignItems: 'center', gap: sp[3], marginBottom: sp[2], ...shadow.sm },
  logIco: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  logIcoG: { backgroundColor: colors.successLight },
  logIcoR: { backgroundColor: colors.dangerLight },
  logIcoNeutral: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.neutral100 },
  logTitle: { fontFamily: 'DMSans_700Bold', fontSize: 13, color: colors.neutral900 },
  logSub: { fontFamily: 'DMSans_400Regular', fontSize: 11, color: colors.neutral500, marginTop: 2 },
});
