import { View } from 'react-native';
import { Species } from '../api/growth';
import { AccessorySlot } from '../api/shop';

const SPECIES_COLORS: Record<Species, string> = {
  SPECIES_A: '#FFAB91',
  SPECIES_B: '#90CAF9',
  SPECIES_C: '#CE93D8',
};

const SLOT_BADGE_COLORS: Record<AccessorySlot, string> = {
  HAT: '#FFD54F',
  FACE: '#81C784',
  BACKGROUND: '#BA68C8',
};

interface Props {
  species: Species | null;
  stage: number;
  accessories?: { slot: AccessorySlot }[];
}

export default function KkumiView({ species, stage, accessories }: Props) {
  const size = 80 + stage * 20;
  const color = species ? SPECIES_COLORS[species] : '#F2D0A4';
  return (
    <View>
      <View
        testID="kkumi-view"
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }}
      />
      {stage > 0 &&
        accessories?.map((a) => (
          <View
            key={a.slot}
            testID={`accessory-badge-${a.slot}`}
            style={{
              position: 'absolute',
              width: 16,
              height: 16,
              borderRadius: 8,
              backgroundColor: SLOT_BADGE_COLORS[a.slot],
            }}
          />
        ))}
    </View>
  );
}
