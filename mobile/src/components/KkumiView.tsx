import Svg, { Circle, Ellipse, G, Line, Path } from 'react-native-svg';
import { Species } from '../api/growth';
import { AccessorySlot } from '../api/shop';
import { speciesPalette, DesignSpecies } from '../theme';

const SPECIES_MAP: Record<Species, DesignSpecies> = {
  SPECIES_A: 'mint',
  SPECIES_B: 'peach',
  SPECIES_C: 'lav',
};

const EGG_PALETTE = { body: '#E4C79A', lite: '#F2D0A4', dark: '#C9A876', cheek: '#F2A98F', shell: '#F6E4C7' };

interface AccessoryProp {
  slot: AccessorySlot;
  key?: string;
}

interface Props {
  species: Species | null;
  stage: number;
  accessories?: AccessoryProp[];
}

function SpeciesAccent({ species, dark }: { species: DesignSpecies; dark: string }) {
  if (species === 'mint') {
    return <Path d="M -6 -2 L 6 -2 L 0 -14 Z" fill={dark} />;
  }
  if (species === 'peach') {
    return (
      <G>
        <Circle cx={-16} cy={-6} r={9} fill="none" stroke={dark} strokeWidth={2.5} />
        <Circle cx={16} cy={-6} r={9} fill="none" stroke={dark} strokeWidth={2.5} />
      </G>
    );
  }
  return (
    <G>
      <Line x1={0} y1={-4} x2={0} y2={-16} stroke={dark} strokeWidth={2} />
      <Circle cx={0} cy={-18} r={4} fill={dark} />
    </G>
  );
}

function Hat({ hatKey, top }: { hatKey: string; top: number }) {
  if (hatKey === 'crown') {
    return (
      <Path
        d={`M -14 ${top} L -14 ${top - 10} L -7 ${top - 2} L 0 ${top - 14} L 7 ${top - 2} L 14 ${top - 10} L 14 ${top} Z`}
        fill="#F3C969"
      />
    );
  }
  return (
    <G>
      <Circle cx={0} cy={top - 2} r={5} fill="#EE9E86" />
      <Path d={`M 0 ${top - 2} L -12 ${top - 8} L -8 ${top + 2} Z`} fill="#F3A9C0" />
      <Path d={`M 0 ${top - 2} L 12 ${top - 8} L 8 ${top + 2} Z`} fill="#F3A9C0" />
    </G>
  );
}

function Glasses({ eyeY }: { eyeY: number }) {
  return (
    <G>
      <Circle cx={-13} cy={eyeY} r={8} fill="rgba(255,255,255,.3)" stroke="#3A322C" strokeWidth={2} />
      <Circle cx={13} cy={eyeY} r={8} fill="rgba(255,255,255,.3)" stroke="#3A322C" strokeWidth={2} />
      <Line x1={-5} y1={eyeY} x2={5} y2={eyeY} stroke="#3A322C" strokeWidth={2} />
    </G>
  );
}

export default function KkumiView({ species, stage, accessories }: Props) {
  const size = 80 + stage * 20;
  const designSpecies = species ? SPECIES_MAP[species] : null;
  const P = designSpecies ? speciesPalette[designSpecies] : EGG_PALETTE;
  const cx = size / 2;
  const cy = size / 2;

  const hatAcc = stage > 0 ? accessories?.find((a) => a.slot === 'HAT') : undefined;
  const faceAcc = stage > 0 ? accessories?.find((a) => a.slot === 'FACE') : undefined;

  function accessoryLayer(anchorX: number, hatTopY: number, eyeY: number) {
    return (
      <G>
        {faceAcc && (
          <G x={anchorX} y={eyeY} testID="accessory-badge-FACE">
            <Glasses eyeY={0} />
          </G>
        )}
        {hatAcc && (
          <G x={anchorX} y={hatTopY} testID="accessory-badge-HAT">
            <Hat hatKey={hatAcc.key ?? 'crown'} top={0} />
          </G>
        )}
      </G>
    );
  }

  let creature;
  if (stage === 0) {
    const rx = size * 0.32;
    const ry = size * 0.4;
    creature = (
      <G>
        <Ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={P.lite} />
        <Circle cx={cx - rx * 0.35} cy={cy - ry * 0.1} r={rx * 0.14} fill={P.body} opacity={0.5} />
        <Circle cx={cx + rx * 0.15} cy={cy - ry * 0.35} r={rx * 0.1} fill={P.body} opacity={0.5} />
        <Ellipse cx={cx - rx * 0.3} cy={cy - ry * 0.45} rx={rx * 0.18} ry={ry * 0.25} fill="rgba(255,255,255,.5)" />
      </G>
    );
  } else if (stage === 1) {
    const shellRx = size * 0.3;
    const headR = size * 0.16;
    creature = (
      <G>
        <Ellipse cx={cx} cy={cy + size * 0.14} rx={shellRx} ry={size * 0.16} fill={P.shell} />
        <Circle cx={cx} cy={cy - size * 0.02} r={headR} fill={P.body} />
        <Circle cx={cx - headR * 0.35} cy={cy - size * 0.02} r={headR * 0.14} fill="#3A322C" />
        <Circle cx={cx + headR * 0.35} cy={cy - size * 0.02} r={headR * 0.14} fill="#3A322C" />
        <Path
          d={`M ${cx - headR * 0.15} ${cy + headR * 0.35} Q ${cx} ${cy + headR * 0.5} ${cx + headR * 0.15} ${cy + headR * 0.35}`}
          stroke="#3A322C"
          strokeWidth={2}
          fill="none"
        />
        {accessoryLayer(cx, cy - size * 0.02 - headR, cy - size * 0.02)}
      </G>
    );
  } else {
    const rx = size * (0.27 + stage * 0.015);
    const ry = size * (0.28 + stage * 0.015);
    const bodyCy = cy + size * 0.06;
    const eyeY = bodyCy - ry * 0.08;
    creature = (
      <G>
        {stage >= 4 && (
          <G>
            <Ellipse cx={cx - rx * 0.55} cy={bodyCy + ry * 0.92} rx={rx * 0.22} ry={ry * 0.14} fill={P.dark} />
            <Ellipse cx={cx + rx * 0.55} cy={bodyCy + ry * 0.92} rx={rx * 0.22} ry={ry * 0.14} fill={P.dark} />
          </G>
        )}
        {stage >= 3 && (
          <G>
            <Ellipse cx={cx - rx * 1.05} cy={bodyCy} rx={rx * 0.2} ry={ry * 0.16} fill={P.dark} />
            <Ellipse cx={cx + rx * 1.05} cy={bodyCy} rx={rx * 0.2} ry={ry * 0.16} fill={P.dark} />
          </G>
        )}
        <G x={cx} y={bodyCy - ry}>
          <SpeciesAccent species={designSpecies ?? 'mint'} dark={P.dark} />
        </G>
        <Ellipse cx={cx} cy={bodyCy} rx={rx} ry={ry} fill={P.body} />
        <Circle cx={cx - rx * 0.36} cy={eyeY} r={rx * 0.1} fill="#3A322C" />
        <Circle cx={cx + rx * 0.36} cy={eyeY} r={rx * 0.1} fill="#3A322C" />
        <Circle cx={cx - rx * 0.55} cy={bodyCy + ry * 0.25} r={rx * 0.14} fill={P.cheek} opacity={0.7} />
        <Circle cx={cx + rx * 0.55} cy={bodyCy + ry * 0.25} r={rx * 0.14} fill={P.cheek} opacity={0.7} />
        <Path
          d={`M ${cx - rx * 0.12} ${bodyCy + ry * 0.32} Q ${cx} ${bodyCy + ry * 0.42} ${cx + rx * 0.12} ${bodyCy + ry * 0.32}`}
          stroke="#3A322C"
          strokeWidth={2}
          fill="none"
        />
        {accessoryLayer(cx, bodyCy - ry, eyeY)}
      </G>
    );
  }

  return (
    <Svg testID="kkumi-view" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {creature}
    </Svg>
  );
}
