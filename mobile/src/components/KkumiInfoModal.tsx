import { Modal, View, Text, TouchableOpacity } from 'react-native';
import { GrowthState, PersonalityType, Species } from '../api/growth';

const SPECIES_LABEL: Record<Species, string> = {
  SPECIES_A: '종 A',
  SPECIES_B: '종 B',
  SPECIES_C: '종 C',
};

const PERSONALITY_LABEL: Record<PersonalityType, string> = {
  STEADY_EASYGOING: '꾸준하고 여유로운 편',
  STEADY_LASTMINUTE: '꾸준하지만 막판에 몰아치는 편',
  LOOSE_EASYGOING: '느슨하지만 여유로운 편',
  LOOSE_LASTMINUTE: '느슨하고 막판에 몰아치는 편',
};

interface Props {
  visible: boolean;
  onClose: () => void;
  growth: GrowthState;
}

export default function KkumiInfoModal({ visible, onClose, growth }: Props) {
  const progressTotal = growth.xpIntoStage + (growth.xpToNextStage ?? 0);
  const progressRatio = progressTotal > 0 ? growth.xpIntoStage / progressTotal : 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View testID="kkumi-info-modal" style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ backgroundColor: '#fff', padding: 24, borderRadius: 16 }}>
          <Text testID="kkumi-species-label">{growth.species ? SPECIES_LABEL[growth.species] : '알'}</Text>
          <Text testID="kkumi-stage-label">{`${growth.stage}단계`}</Text>
          <View style={{ height: 8, backgroundColor: '#eee', borderRadius: 4 }}>
            <View
              testID="kkumi-xp-bar-fill"
              style={{ width: `${Math.round(progressRatio * 100)}%`, height: 8, backgroundColor: '#6BC5B8', borderRadius: 4 }}
            />
          </View>
          <Text testID="kkumi-personality-label">
            {growth.personality ? PERSONALITY_LABEL[growth.personality.type] : '성격 파악 중'}
          </Text>
          <TouchableOpacity testID="kkumi-modal-close" onPress={onClose}>
            <Text>닫기</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
