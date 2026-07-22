import { render, screen } from '@testing-library/react-native';
import NetInfo from '@react-native-community/netinfo';
import OfflineBanner from './OfflineBanner';

describe('OfflineBanner', () => {
  it('renders nothing when online', () => {
    (NetInfo.useNetInfo as jest.Mock).mockReturnValue({ isConnected: true, isInternetReachable: true });
    render(<OfflineBanner />);
    expect(screen.queryByTestId('offline-banner')).toBeNull();
  });

  it('shows a banner when disconnected', () => {
    (NetInfo.useNetInfo as jest.Mock).mockReturnValue({ isConnected: false, isInternetReachable: false });
    render(<OfflineBanner />);
    expect(screen.getByTestId('offline-banner')).toBeTruthy();
  });

  it('shows a banner when connected but internet is unreachable', () => {
    (NetInfo.useNetInfo as jest.Mock).mockReturnValue({ isConnected: true, isInternetReachable: false });
    render(<OfflineBanner />);
    expect(screen.getByTestId('offline-banner')).toBeTruthy();
  });

  it('stays hidden while reachability is still being determined', () => {
    (NetInfo.useNetInfo as jest.Mock).mockReturnValue({ isConnected: true, isInternetReachable: null });
    render(<OfflineBanner />);
    expect(screen.queryByTestId('offline-banner')).toBeNull();
  });
});
