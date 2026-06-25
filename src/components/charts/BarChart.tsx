import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { colors, sp } from '../../theme';

interface DataPoint { l: string; v: number; }
interface Props { data: DataPoint[]; color?: string; }

function AnimatedBar({ height, color, delay }: { height: number; color: string; delay: number }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: height,
      duration: 900,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [height]);

  return <Animated.View style={[s.bar, { height: anim, backgroundColor: color }]} />;
}

export function BarChart({ data, color = colors.danger }: Props) {
  const max = Math.max(...data.map(d => d.v), 1);
  return (
    <View style={s.container}>
      {data.map((d, i) => (
        <View key={i} style={s.col}>
          <Text style={s.val}>{d.v > 0 ? String(d.v) : ''}</Text>
          <AnimatedBar height={Math.max(d.v > 0 ? 6 : 0, (d.v / max) * 100)} color={color} delay={i * 100} />
          <Text style={s.label}>{d.l}</Text>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'flex-end', height: 130, marginTop: sp[2], gap: 4 },
  col: { flex: 1, alignItems: 'center', gap: 3 },
  val: { fontSize: 9, fontFamily: 'DMSans_700Bold', color: colors.neutral500, minHeight: 12, lineHeight: 12 },
  bar: { width: '100%', borderRadius: 3, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  label: { fontSize: 10, fontFamily: 'DMSans_600SemiBold', color: colors.neutral500 },
});
