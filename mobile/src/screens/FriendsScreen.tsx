import { useCallback, useEffect, useState } from 'react';
import { Alert, AlertButton, View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import {
  Friend,
  FriendRequest,
  acceptFriendRequest,
  listFriendRequests,
  listFriends,
  requestFriend,
} from '../api/friends';
import { blockUser, reportUser } from '../api/safety';
import KkumiView from '../components/KkumiView';
import Icon from '../components/Icon';
import { useErrorMessage } from '../hooks/useErrorMessage';
import { colors, fonts } from '../theme';

const STAGE_LABEL = ['알', '부화', '새싹', '자람', '만개'];
const REPORT_REASONS = ['스팸', '부적절한 콘텐츠', '괴롭힘', '기타'];

export default function FriendsScreen() {
  const resolveError = useErrorMessage();
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const [requestList, friendList] = await Promise.all([listFriendRequests(), listFriends()]);
      setRequests(requestList);
      setFriends(friendList);
    } catch {
      setError(resolveError('친구 정보를 불러오지 못했어요'));
    }
  }, [resolveError]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSendRequest() {
    if (nickname.trim().length === 0) return;
    try {
      await requestFriend(nickname.trim());
      setNickname('');
      await load();
    } catch {
      setError(resolveError('친구 요청을 보내지 못했어요'));
    }
  }

  async function handleAccept(id: string) {
    try {
      await acceptFriendRequest(id);
      await load();
    } catch {
      setError(resolveError('요청을 수락하지 못했어요'));
    }
  }

  async function handleBlock(friend: Friend) {
    try {
      await blockUser(friend.id);
      await load();
    } catch {
      setError(resolveError('차단하지 못했어요'));
    }
  }

  async function handleReport(friend: Friend, reason: string) {
    try {
      await reportUser(friend.id, reason);
    } catch {
      setError(resolveError('신고를 접수하지 못했어요'));
    }
  }

  function openReportReasons(friend: Friend) {
    Alert.alert(
      '신고 사유 선택',
      undefined,
      [
        ...REPORT_REASONS.map((reason): AlertButton => ({ text: reason, onPress: () => handleReport(friend, reason) })),
        { text: '취소', style: 'cancel' },
      ]
    );
  }

  function openFriendActions(friend: Friend) {
    Alert.alert(friend.nickname, undefined, [
      { text: '신고', onPress: () => openReportReasons(friend) },
      { text: '차단', style: 'destructive', onPress: () => handleBlock(friend) },
      { text: '취소', style: 'cancel' },
    ]);
  }

  if (error) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <Text testID="friends-error" style={{ fontFamily: fonts.body, color: colors.fail, marginBottom: 10 }}>
          {error}
        </Text>
        <TouchableOpacity testID="friends-retry" onPress={load}>
          <Text style={{ fontFamily: fonts.heading, color: colors.green }}>다시 시도</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 18 }}>
      <Text style={{ fontFamily: fonts.heading, fontSize: 26, color: colors.ink, marginBottom: 14 }}>친구</Text>

      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 18 }}>
        <TextInput
          testID="friend-nickname-input"
          placeholder="닉네임으로 친구 찾기"
          placeholderTextColor={colors.inkFaint}
          value={nickname}
          onChangeText={setNickname}
          style={{
            flex: 1,
            padding: 12,
            borderWidth: 1.5,
            borderColor: colors.border,
            borderRadius: 14,
            backgroundColor: colors.card,
            fontFamily: fonts.body,
            fontSize: 14,
            color: colors.ink,
          }}
        />
        <TouchableOpacity
          testID="send-request-button"
          onPress={handleSendRequest}
          style={{ paddingHorizontal: 18, borderRadius: 14, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontFamily: fonts.heading, color: '#fff', fontSize: 14 }}>추가</Text>
        </TouchableOpacity>
      </View>

      {requests.length > 0 ? (
        <>
          <Text style={{ fontFamily: fonts.heading, fontSize: 14, color: colors.inkMuted, marginBottom: 8 }}>
            받은 요청 <Text style={{ color: colors.peach }}>{requests.length}</Text>
          </Text>
          <View style={{ gap: 8, marginBottom: 16 }}>
            {requests.map((r) => (
              <View
                key={r.id}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 11 }}
              >
                <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: fonts.heading, color: colors.inkMuted }}>{r.requesterNickname[0]}</Text>
                </View>
                <Text style={{ flex: 1, fontFamily: fonts.heading, fontSize: 14, color: colors.ink }}>{`${r.requesterNickname}님의 친구 요청`}</Text>
                <TouchableOpacity
                  testID={`accept-request-${r.id}`}
                  onPress={() => handleAccept(r.id)}
                  style={{ backgroundColor: colors.green, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 7 }}
                >
                  <Text style={{ fontFamily: fonts.heading, color: '#fff', fontSize: 12 }}>수락</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </>
      ) : null}

      <Text style={{ fontFamily: fonts.heading, fontSize: 14, color: colors.inkMuted, marginBottom: 8 }}>내 친구 {friends.length}</Text>
      {friends.length === 0 ? (
        <View style={{ alignItems: 'center', padding: 30, backgroundColor: colors.card, borderRadius: 20 }}>
          <View style={{ width: 90, height: 90, borderRadius: 45, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
            <KkumiView species="SPECIES_C" stage={0} size={70} />
            <View
              style={{
                position: 'absolute',
                right: -2,
                bottom: -2,
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="search" color={colors.goldText} size={18} />
            </View>
          </View>
          <Text style={{ fontFamily: fonts.heading, fontSize: 15, color: colors.ink, marginBottom: 4 }}>친구가 없어요</Text>
          <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.inkMuted, textAlign: 'center' }}>
            닉네임으로 친구를 찾아 함께 자라요
          </Text>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {friends.map((f) => (
            <View
              key={f.id}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 12 }}
            >
              <View style={{ width: 56, height: 56, backgroundColor: colors.background, borderRadius: 16, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                <KkumiView species={f.species} stage={f.stage} size={44} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.heading, fontSize: 16, color: colors.ink }}>{f.nickname}</Text>
                <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.inkMuted, marginTop: 2 }}>{`${STAGE_LABEL[f.stage]} · ${f.stage}단계 · ${f.totalXp}XP`}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontFamily: fonts.heading, fontSize: 16, color: colors.green }}>{f.totalXp}</Text>
                <Text style={{ fontFamily: fonts.body, fontSize: 10, color: colors.inkFaint }}>누적 XP</Text>
              </View>
              <TouchableOpacity testID={`friend-actions-${f.id}`} onPress={() => openFriendActions(f)} style={{ padding: 6 }}>
                <Text style={{ color: colors.inkFaint, fontSize: 18 }}>⋯</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
