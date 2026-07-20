import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import * as friendsApi from '../api/friends';
import FriendsScreen from './FriendsScreen';

jest.mock('../api/friends');

const requests: friendsApi.FriendRequest[] = [
  { id: 'r1', requesterId: 'u1', requesterNickname: '철수' },
];

const friends: friendsApi.Friend[] = [
  { id: 'u2', nickname: '영희', species: 'SPECIES_A', stage: 1, totalXp: 60 },
];

beforeEach(() => {
  jest.clearAllMocks();
  (friendsApi.listFriendRequests as jest.Mock).mockResolvedValue([]);
  (friendsApi.listFriends as jest.Mock).mockResolvedValue([]);
  (friendsApi.requestFriend as jest.Mock).mockResolvedValue({ id: 'new-request' });
  (friendsApi.acceptFriendRequest as jest.Mock).mockResolvedValue(undefined);
});

describe('FriendsScreen', () => {
  it('loads friend requests and friends on mount', async () => {
    (friendsApi.listFriends as jest.Mock).mockResolvedValue(friends);
    render(<FriendsScreen />);
    await waitFor(() => expect(screen.getByText(/영희/)).toBeTruthy());
    expect(friendsApi.listFriendRequests).toHaveBeenCalled();
    expect(friendsApi.listFriends).toHaveBeenCalled();
  });

  it('shows pending requests and accepts one', async () => {
    (friendsApi.listFriendRequests as jest.Mock).mockResolvedValue(requests);
    render(<FriendsScreen />);
    await waitFor(() => expect(screen.getByText(/철수/)).toBeTruthy());

    fireEvent.press(screen.getByTestId('accept-request-r1'));
    await waitFor(() => expect(friendsApi.acceptFriendRequest).toHaveBeenCalledWith('r1'));
  });

  it('sends a friend request by nickname', async () => {
    render(<FriendsScreen />);
    await waitFor(() => expect(screen.getByTestId('friend-nickname-input')).toBeTruthy());

    fireEvent.changeText(screen.getByTestId('friend-nickname-input'), '영희');
    fireEvent.press(screen.getByTestId('send-request-button'));
    await waitFor(() => expect(friendsApi.requestFriend).toHaveBeenCalledWith('영희'));
  });

  it('shows an error with a retry button on load failure', async () => {
    (friendsApi.listFriends as jest.Mock).mockRejectedValueOnce(new Error('친구 목록을 불러오지 못했어요'));
    render(<FriendsScreen />);
    await waitFor(() => expect(screen.getByTestId('friends-error')).toBeTruthy());

    fireEvent.press(screen.getByTestId('friends-retry'));
    await waitFor(() => expect(friendsApi.listFriends).toHaveBeenCalledTimes(2));
  });
});
