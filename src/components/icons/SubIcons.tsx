import Svg, { Path, Ellipse } from 'react-native-svg';

const C = '#E8520A';

export function PeeSVG() {
  return (
    <Svg width={26} height={26} viewBox="0 0 28 28" fill="none">
      <Path d="M14 4C14 4 7 11.5 7 16.5C7 20.09 10.13 23 14 23C17.87 23 21 20.09 21 16.5C21 11.5 14 4 14 4Z" stroke={C} strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}

export function PoopSVG() {
  return (
    <Svg width={26} height={26} viewBox="0 0 28 28" fill="none">
      <Ellipse cx={14} cy={20} rx={7} ry={3} stroke={C} strokeWidth={1.8} />
      <Ellipse cx={14} cy={17} rx={5} ry={2.5} stroke={C} strokeWidth={1.8} />
      <Ellipse cx={14} cy={14.5} rx={3.5} ry={2} stroke={C} strokeWidth={1.8} />
      <Path d="M14 12.5C14 12.5 12.5 11 13 9.5C13.5 8 15.5 8 15.5 6.5" stroke={C} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

export function BothSVG() {
  return (
    <Svg width={26} height={26} viewBox="0 0 28 28" fill="none">
      <Path d="M10 5C10 5 5.5 10 5.5 13C5.5 15.48 7.51 17.5 10 17.5C12.49 17.5 14.5 15.48 14.5 13C14.5 10 10 5 10 5Z" stroke={C} strokeWidth={1.7} strokeLinejoin="round" />
      <Ellipse cx={20} cy={23} rx={4.5} ry={1.8} stroke={C} strokeWidth={1.6} />
      <Ellipse cx={20} cy={21} rx={3.2} ry={1.6} stroke={C} strokeWidth={1.6} />
      <Ellipse cx={20} cy={19.2} rx={2.2} ry={1.3} stroke={C} strokeWidth={1.6} />
      <Path d="M20 17.9C20 17.9 19 17 19.3 16C19.6 15 21 15 21 13.8" stroke={C} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}
