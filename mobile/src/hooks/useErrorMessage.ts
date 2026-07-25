import { useCallback } from 'react';
import NetInfo from '@react-native-community/netinfo';

const OFFLINE_MESSAGE = '인터넷 연결을 확인해주세요';

// 전역 오프라인 배너는 "연결이 끊겼다"는 사실만 알려줄 뿐, 화면마다
// 실패했을 때 뜨는 "다시 시도" 문구는 서버 오류든 오프라인이든 항상
// 똑같았다. 이 훅으로 오프라인일 때는 원인이 명확한 문구로 바꿔준다.
//
// 반환하는 함수는 offline 값이 바뀔 때만 참조가 바뀌도록 useCallback으로
// 감싼다 — 그렇지 않으면 이 함수를 의존성으로 쓰는 화면들의 useCallback/
// useEffect가 매 렌더마다 다시 실행돼 API를 중복 호출하게 된다.
export function useErrorMessage() {
  const net = NetInfo.useNetInfo();
  const offline = net.isConnected === false || net.isInternetReachable === false;

  return useCallback((fallback: string) => (offline ? OFFLINE_MESSAGE : fallback), [offline]);
}
