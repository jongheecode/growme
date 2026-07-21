import Svg, { Circle, Path } from 'react-native-svg';

export type IconName = 'home' | 'history' | 'friends' | 'shop' | 'profile' | 'ranking' | 'challenge' | 'search' | 'clock';

type CircleShape = { circle: true; cx: number; cy: number; r: number; fillKey?: boolean };
type PathShape = { d: string; fillKey?: boolean };
type Shape = CircleShape | PathShape;

const GEO: Record<IconName, Shape[]> = {
  home: [{ d: 'M4 11.5 12 4l8 7.5' }, { d: 'M6 10.5V20h12v-9.5', fillKey: true }],
  history: [
    { circle: true, cx: 12, cy: 12, r: 8, fillKey: true },
    { d: 'M12 8v4l3 2' },
  ],
  friends: [
    { circle: true, cx: 9, cy: 9, r: 3, fillKey: true },
    { d: 'M3.5 19c.6-3 2.9-4.5 5.5-4.5S13.9 16 14.5 19' },
    { circle: true, cx: 17, cy: 8, r: 2.3 },
    { d: 'M16 14.7c2.2.2 3.7 1.7 4.2 4.3' },
  ],
  shop: [{ d: 'M6 8h12l-1 11H7L6 8Z', fillKey: true }, { d: 'M9 8a3 3 0 0 1 6 0' }],
  profile: [
    { circle: true, cx: 12, cy: 9, r: 3.3, fillKey: true },
    { d: 'M5.5 20c.7-3.5 3.4-5.2 6.5-5.2S17.8 16.5 18.5 20' },
  ],
  ranking: [{ d: 'M6 20v-6' }, { d: 'M12 20V6' }, { d: 'M18 20v-9' }, { d: 'M4 20h16' }],
  challenge: [{ d: 'M6 21V4' }, { d: 'M6 4h11l-2 3.5L17 11H6', fillKey: true }],
  search: [{ circle: true, cx: 11, cy: 11, r: 6 }, { d: 'M20 20l-4-4' }],
  clock: [{ circle: true, cx: 12, cy: 12, r: 7 }, { d: 'M12 8.5V12l2.5 1.5' }],
};

interface Props {
  name: IconName;
  color: string;
  size?: number;
  active?: boolean;
}

export default function Icon({ name, color, size = 24, active = false }: Props) {
  return (
    <Svg testID={`icon-${name}`} width={size} height={size} viewBox="0 0 24 24" fill="none">
      {GEO[name].map((s, i) => {
        const fill = active && s.fillKey ? `${color}22` : 'none';
        return 'circle' in s ? (
          <Circle key={i} cx={s.cx} cy={s.cy} r={s.r} stroke={color} strokeWidth={1.9} fill={fill} />
        ) : (
          <Path key={i} d={s.d} stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" fill={fill} />
        );
      })}
    </Svg>
  );
}
