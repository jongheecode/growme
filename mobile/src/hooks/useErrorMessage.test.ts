import { renderHook } from '@testing-library/react-native';
import NetInfo from '@react-native-community/netinfo';
import { useErrorMessage } from './useErrorMessage';

describe('useErrorMessage', () => {
  it('returns the fallback message when online', () => {
    (NetInfo.useNetInfo as jest.Mock).mockReturnValue({ isConnected: true, isInternetReachable: true });
    const { result } = renderHook(() => useErrorMessage());
    expect(result.current('할일을 추가하지 못했어요')).toBe('할일을 추가하지 못했어요');
  });

  it('returns an offline message when disconnected', () => {
    (NetInfo.useNetInfo as jest.Mock).mockReturnValue({ isConnected: false, isInternetReachable: false });
    const { result } = renderHook(() => useErrorMessage());
    expect(result.current('할일을 추가하지 못했어요')).toBe('인터넷 연결을 확인해주세요');
  });

  it('returns an offline message when connected but internet is unreachable', () => {
    (NetInfo.useNetInfo as jest.Mock).mockReturnValue({ isConnected: true, isInternetReachable: false });
    const { result } = renderHook(() => useErrorMessage());
    expect(result.current('할일을 추가하지 못했어요')).toBe('인터넷 연결을 확인해주세요');
  });
});
