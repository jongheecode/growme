import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Text, TouchableOpacity, View } from 'react-native';
import { Species } from '../api/growth';
import KkumiView from './KkumiView';
import { colors, fonts } from '../theme';

interface Props {
  visible: boolean;
  text: string;
  outcome: 'COMPLETED' | 'FAILED';
  onDismiss: () => void;
  xp?: number;
  points?: number;
  species?: Species | null;
  stage?: number;
  hatch?: boolean;
}

const HATCH_REVEAL_DELAY = 1500;

export default function ReactionModal({ visible, text, outcome, onDismiss, xp, points, species, stage, hatch }: Props) {
  const [phase, setPhase] = useState<'egg' | 'reveal'>(hatch ? 'egg' : 'reveal');
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!hatch) return;
    setPhase('egg');
    const timer = setTimeout(() => setPhase('reveal'), HATCH_REVEAL_DELAY);
    return () => clearTimeout(timer);
  }, [hatch, visible]);

  useEffect(() => {
    if (phase !== 'egg') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shake, { toValue: 1, duration: 140, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(shake, { toValue: -1, duration: 140, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0, duration: 140, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [phase, shake]);

  const showingEgg = !!hatch && phase === 'egg';
  const isCompleted = outcome === 'COMPLETED';
  const outcomeLabel = !isCompleted ? '아쉬워요' : showingEgg ? '두근두근...' : hatch ? '태어났어요!' : '완료!';
  const displayText = showingEgg ? '알이 흔들려요. 곧 무언가 태어날 것 같아요!' : text;
  const canDismiss = !showingEgg;
  const dismissLabel = !isCompleted ? '다시 힘내볼게' : hatch ? '반가워, 꾸미!' : '좋아!';
  const rotate = shake.interpolate({ inputRange: [-1, 1], outputRange: ['-8deg', '8deg'] });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={canDismiss ? onDismiss : () => {}}>
      <View
        testID="reaction-modal"
        style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(42,38,34,.4)', padding: 26 }}
      >
        <View style={{ backgroundColor: colors.background, padding: 26, borderRadius: 24, width: '100%', alignItems: 'center' }}>
          {isCompleted && (
            <Animated.View style={{ transform: [{ rotate: showingEgg ? rotate : '0deg' }], marginBottom: 8 }}>
              <KkumiView species={showingEgg ? null : species ?? null} stage={showingEgg ? 0 : stage ?? 0} />
            </Animated.View>
          )}
          <Text testID="reaction-outcome-label" style={{ fontFamily: fonts.heading, fontSize: 22, color: colors.ink }}>
            {outcomeLabel}
          </Text>
          <Text
            testID="reaction-text"
            style={{ fontFamily: fonts.body, fontSize: 14, color: colors.inkMuted, textAlign: 'center', marginTop: 8, marginBottom: 16 }}
          >
            {displayText}
          </Text>
          {isCompleted && !showingEgg && xp != null && (
            <View testID="reaction-rewards" style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              <View style={{ backgroundColor: colors.goldTint, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 14 }}>
                <Text style={{ fontFamily: fonts.heading, color: colors.goldText }}>{`+${xp} XP`}</Text>
              </View>
              {points != null && (
                <View style={{ backgroundColor: colors.goldTint, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 14 }}>
                  <Text style={{ fontFamily: fonts.heading, color: colors.goldText }}>{`+${points} P`}</Text>
                </View>
              )}
            </View>
          )}
          {canDismiss && (
            <TouchableOpacity
              testID="reaction-modal-dismiss"
              onPress={onDismiss}
              style={{ backgroundColor: colors.green, paddingVertical: 14, borderRadius: 16, width: '100%', alignItems: 'center' }}
            >
              <Text style={{ fontFamily: fonts.heading, color: '#fff', fontSize: 16 }}>{dismissLabel}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}
