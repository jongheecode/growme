import { View } from 'react-native';
import { Species } from '../api/growth';

const SPECIES_COLORS: Record<Species, string> = {
  SPECIES_A: '#FFAB91',
  SPECIES_B: '#90CAF9',
  SPECIES_C: '#CE93D8',
};

interface Props {
  species: Species | null;
  stage: number;
}

export default function KkumiView({ species, stage }: Props) {
  const size = 80 + stage * 20;
  const color = species ? SPECIES_COLORS[species] : '#F2D0A4';
  return (
    <View
      testID="kkumi-view"
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }}
    />
  );
}
