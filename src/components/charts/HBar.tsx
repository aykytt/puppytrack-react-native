import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { colors, sp } from '../../theme';

interface Props { label: string; sp: number; ap: number; }

export function HBar({ label, sp: successPct, ap }: Props) {
  const successAnim = useRef(new Animated.Value(0)).current;
  const dangerAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    successAnim.setValue(0);
    dangerAnim.setValue(0);
    Animated.parallel([
      Animated.timing(successAnim, { toValue: successPct, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.timing(dangerAnim,  { toValue: ap,         duration: 700, delay: 80, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
    ]).start();
  }, [successPct, ap]);

  const successWidth = successAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });
  const dangerWidth  = dangerAnim.interpolate({  inputRange: [0, 100], outputRange: ['0%', '100%'] });

  return (
    <View style={s.row}>
      <Text style={s.label}>{label}</Text>
      <View style={s.track}>
        <Animated.View style={[s.fill, { width: successWidth, backgroundColor: colors.success }]} />
        <Animated.View style={[s.fill, { width: dangerWidth,  backgroundColor: colors.danger }]} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', gap: sp[2], marginBottom: sp[3] },
  label: { fontSize: 12, fontFamily: 'DMSans_600SemiBold', color: colors.neutral500, width: 40, flexShrink: 0 },
  track: { flex: 1, height: 12, borderRadius: 6, overflow: 'hidden', flexDirection: 'row', backgroundColor: colors.neutral100 },
  fill:  { height: '100%' },
});
