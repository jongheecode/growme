import { Modal, Text, TouchableOpacity, View } from 'react-native';
import { GrowthState, PersonalityType, Species } from '../api/growth';
import KkumiView from './KkumiView';
import { colors, fonts } from '../theme';

const SPECIES_LABEL: Record<Species, string> = {
  SPECIES_A: '새싹형',
  SPECIES_B: '햇살형',
  SPECIES_C: '방울형',
};

const STAGE_LABEL = ['알', '부화', '새싹', '자람', '만개'];

const PERSONALITY_INFO: Record<PersonalityType, { name: string; desc: string; steady: boolean; easygoing: boolean }> = {
  STEADY_EASYGOING: { name: '산책가형', desc: '매일 조금씩 여유롭게 걸어가는 꾸준러', steady: true, easygoing: true },
  STEADY_LASTMINUTE: { name: '질주러형', desc: '평소 꾸준하다 마감 앞에서 폭발하는 스타일', steady: true, easygoing: false },
  LOOSE_EASYGOING: { name: '몽상가형', desc: '마음 가는 대로, 여유롭게 자기 페이스대로', steady: false, easygoing: true },
  LOOSE_LASTMINUTE: { name: '벼락치기형', desc: '느슨하게 지내다 막판에 몰아서 해내는 스타일', steady: false, easygoing: false },
};

interface Props {
  visible: boolean;
  onClose: () => void;
  growth: GrowthState;
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14, alignItems: 'center' }}>
      <Text style={{ fontFamily: fonts.heading, fontSize: 20, color }}>{value}</Text>
      <Text style={{ fontFamily: fonts.body, fontSize: 11, color: colors.inkMuted, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

export default function KkumiInfoModal({ visible, onClose, growth }: Props) {
  const progressTotal = growth.xpIntoStage + (growth.xpToNextStage ?? 0);
  const progressRatio = progressTotal > 0 ? growth.xpIntoStage / progressTotal : 0;
  const info = growth.personality ? PERSONALITY_INFO[growth.personality.type] : null;
  const dotLeft = info ? (info.steady ? '72%' : '28%') : '50%';
  const dotTop = info ? (info.easygoing ? '25%' : '75%') : '50%';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View testID="kkumi-info-modal" style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(42,38,34,.4)' }}>
        <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, paddingBottom: 36 }}>
          <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center', marginBottom: 18 }}>
            <View style={{ width: 88, height: 88, backgroundColor: colors.card, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}>
              <KkumiView species={growth.species} stage={growth.stage} />
            </View>
            <View style={{ flex: 1 }}>
              <Text testID="kkumi-species-label" style={{ fontFamily: fonts.heading, fontSize: 20, color: colors.ink }}>
                {growth.species ? SPECIES_LABEL[growth.species] : '알'}
              </Text>
              <Text testID="kkumi-stage-label" style={{ fontFamily: fonts.body, fontSize: 13, color: colors.inkMuted, marginTop: 2 }}>
                {`${growth.stage}단계`}
              </Text>
              {info ? (
                <View style={{ alignSelf: 'flex-start', marginTop: 8, backgroundColor: '#EFE8F7', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 5 }}>
                  <Text style={{ fontFamily: fonts.heading, fontSize: 12, color: '#7A63B8' }}>{info.name}</Text>
                </View>
              ) : null}
            </View>
          </View>

          <View style={{ height: 10, backgroundColor: colors.border, borderRadius: 6, overflow: 'hidden', marginBottom: 18 }}>
            <View
              testID="kkumi-xp-bar-fill"
              style={{ width: `${Math.round(progressRatio * 100)}%`, height: '100%', backgroundColor: colors.green }}
            />
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 18 }}>
            <StatCard label="단계" value={STAGE_LABEL[growth.stage]} color={colors.green} />
            <StatCard label="누적 XP" value={growth.totalXp} color={colors.goldText} />
            <StatCard label="포인트" value={growth.points} color={colors.peach} />
          </View>

          <Text style={{ fontFamily: fonts.heading, fontSize: 16, color: colors.ink, marginBottom: 6 }}>성격 유형</Text>
          <Text testID="kkumi-personality-label" style={{ fontFamily: fonts.body, fontSize: 13, color: colors.inkMuted, lineHeight: 20, marginBottom: 14 }}>
            {info ? info.desc : '성격 파악 중...'}
          </Text>

          {info ? (
            <View style={{ position: 'relative', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 20, height: 140, marginBottom: 6 }}>
              <View
                style={{
                  position: 'absolute',
                  left: dotLeft,
                  top: dotTop,
                  width: 22,
                  height: 22,
                  marginLeft: -11,
                  marginTop: -11,
                  borderRadius: 11,
                  backgroundColor: colors.green,
                }}
              />
            </View>
          ) : null}

          <TouchableOpacity
            testID="kkumi-modal-close"
            onPress={onClose}
            style={{ marginTop: 8, backgroundColor: colors.green, borderRadius: 16, paddingVertical: 15, alignItems: 'center' }}
          >
            <Text style={{ fontFamily: fonts.heading, color: '#fff', fontSize: 15 }}>닫기</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
