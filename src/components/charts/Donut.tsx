import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { DATA_COLORS } from '../../constants';
import { colors } from '../../theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props { pee?: number; poop?: number; both?: number; }

export function Donut({ pee = 60, poop = 25, both = 15 }: Props) {
  const r = 52, cx = 64, cy = 64, sw = 18;
  const c = 2 * Math.PI * r;
  const g = 4;
  const pd = (pee / 100) * c;
  const kd = (poop / 100) * c;
  const bd = (both / 100) * c;

  const animPee  = useRef(new Animated.Value(0)).current;
  const animPoop = useRef(new Animated.Value(0)).current;
  const animBoth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    [animPee, animPoop, animBoth].forEach(a => a.setValue(0));
    const timing = (anim: Animated.Value, toValue: number, delay: number) =>
      Animated.timing(anim, { toValue, delay, duration: 1000, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    Animated.parallel([
      timing(animPee, pd, 0),
      timing(animPoop, kd, 250),
      timing(animBoth, bd, 500),
    ]).start();
  }, [pee, poop, both]);

  const da = (anim: Animated.Value) =>
    anim.interpolate({ inputRange: [0, c], outputRange: [`0 ${c}`, `${c} ${c}`] });

  return (
    <Svg width={128} height={128} viewBox="0 0 128 128">
      <Circle cx={cx} cy={cy} r={r} fill="none" stroke={colors.neutral200} strokeWidth={sw} />
      <AnimatedCircle cx={cx} cy={cy} r={r} fill="none" stroke={DATA_COLORS.pee} strokeWidth={sw}
        strokeDashoffset={c * 0.25} strokeLinecap="round" strokeDasharray={da(animPee) as any} />
      <AnimatedCircle cx={cx} cy={cy} r={r} fill="none" stroke={DATA_COLORS.poop} strokeWidth={sw}
        strokeDashoffset={c * 0.25 - pd} strokeLinecap="round" strokeDasharray={da(animPoop) as any} />
      <AnimatedCircle cx={cx} cy={cy} r={r} fill="none" stroke={DATA_COLORS.both} strokeWidth={sw}
        strokeDashoffset={c * 0.25 - pd - kd} strokeLinecap="round" strokeDasharray={da(animBoth) as any} />
    </Svg>
  );
}
