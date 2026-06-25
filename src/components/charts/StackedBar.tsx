import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { colors, sp } from '../../theme';
import { DATA_COLORS } from '../../constants';

interface DataPoint { l: string; p: number; k: number; b: number; }
interface Props { data: DataPoint[]; }

function AnimatedStack({ total, max, p, k, b, delay }: { total: number; max: number; p: number; k: number; b: number; delay: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  const h = Math.max(total > 0 ? 6 : 0, (total / max) * 100);

  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: h,
      duration: 900,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [h]);

  const ph = total > 0 ? (p / total) * h : 0;
  const kh = total > 0 ? (k / total) * h : 0;
  const bh = total > 0 ? (b / total) * h : 0;

  return (
    <Animated.View style={[s.stack, { height: anim }]}>
      <View style={{ height: bh, backgroundColor: DATA_COLORS.both }} />
      <View style={{ height: kh, backgroundColor: DATA_COLORS.poop }} />
      <View style={{ height: ph, backgroundColor: DATA_COLORS.pee }} />
    </Animated.View>
  );
}

export function StackedBar({ data }: Props) {
  const max = Math.max(...data.map(d => d.p + d.k + d.b), 1);
  return (
    <View style={s.container}>
      {data.map((d, i) => {
        const total = d.p + d.k + d.b;
        return (
          <View key={i} style={s.col}>
            <Text style={s.val}>{total > 0 ? String(total) : ''}</Text>
            <AnimatedStack total={total} max={max} p={d.p} k={d.k} b={d.b} delay={i * 100} />
            <Text style={s.label}>{d.l}</Text>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'flex-end', height: 130, marginTop: sp[2], gap: 4 },
  col: { flex: 1, alignItems: 'center', gap: 3 },
  val: { fontSize: 9, fontFamily: 'DMSans_700Bold', color: colors.neutral500, minHeight: 12, lineHeight: 12 },
  stack: { width: '100%', borderRadius: 3, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, overflow: 'hidden', justifyContent: 'flex-end' },
  label: { fontSize: 10, fontFamily: 'DMSans_600SemiBold', color: colors.neutral500 },
});
