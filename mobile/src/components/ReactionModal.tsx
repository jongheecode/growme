import { Modal, View, Text, TouchableOpacity } from 'react-native';

interface Props {
  visible: boolean;
  text: string;
  outcome: 'COMPLETED' | 'FAILED';
  onDismiss: () => void;
}

export default function ReactionModal({ visible, text, outcome, onDismiss }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View testID="reaction-modal" style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ backgroundColor: '#fff', padding: 24, borderRadius: 16 }}>
          <Text testID="reaction-outcome-label">{outcome === 'COMPLETED' ? '완료!' : '아쉬워요'}</Text>
          <Text testID="reaction-text">{text}</Text>
          <TouchableOpacity testID="reaction-modal-dismiss" onPress={onDismiss}>
            <Text>확인</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
