import { Text, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { colors, fonts } from '../theme';

export default function OfflineBanner() {
  const state = NetInfo.useNetInfo();
  const offline = state.isConnected === false || state.isInternetReachable === false;

  if (!offline) return null;

  return (
    <View
      testID="offline-banner"
      style={{
        backgroundColor: colors.fail,
        paddingVertical: 8,
        alignItems: 'center',
      }}
    >
      <Text style={{ fontFamily: fonts.body, color: '#fff', fontSize: 12 }}>인터넷 연결을 확인해주세요</Text>
    </View>
  );
}
