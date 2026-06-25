import { useEffect, useRef, useState } from 'react';
import { Animated } from 'react-native';

export function useCountUp(target: number, duration = 700): number {
  const [value, setValue] = useState(0);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    anim.setValue(0);
    const listener = anim.addListener(({ value: v }) => setValue(Math.round(v)));
    Animated.timing(anim, { toValue: target, duration, useNativeDriver: false, easing: t => t }).start();
    return () => anim.removeListener(listener);
  }, [target]);

  return value;
}
