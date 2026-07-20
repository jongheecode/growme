import { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import {
  Friend,
  FriendRequest,
  acceptFriendRequest,
  listFriendRequests,
  listFriends,
  requestFriend,
} from '../api/friends';

export default function FriendsScreen() {
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
      setError('친구 정보를 불러오지 못했어요');
    }
  }, []);

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
      setError('친구 요청을 보내지 못했어요');
    }
  }

  async function handleAccept(id: string) {
    try {
      await acceptFriendRequest(id);
      await load();
    } catch {
      setError('요청을 수락하지 못했어요');
    }
  }

  if (error) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text testID="friends-error">{error}</Text>
        <TouchableOpacity testID="friends-retry" onPress={load}>
          <Text>다시 시도</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, padding: 16 }}>
      <TextInput
        testID="friend-nickname-input"
        placeholder="닉네임으로 친구 추가"
        value={nickname}
        onChangeText={setNickname}
      />
      <TouchableOpacity testID="send-request-button" onPress={handleSendRequest}>
        <Text>요청 보내기</Text>
      </TouchableOpacity>

      {requests.map((r) => (
        <View key={r.id}>
          <Text>{`${r.requesterNickname}님의 친구 요청`}</Text>
          <TouchableOpacity testID={`accept-request-${r.id}`} onPress={() => handleAccept(r.id)}>
            <Text>수락</Text>
          </TouchableOpacity>
        </View>
      ))}

      {friends.map((f) => (
        <View key={f.id}>
          <Text>{`${f.nickname} · ${f.stage}단계 · ${f.totalXp}XP`}</Text>
        </View>
      ))}
    </ScrollView>
  );
}
