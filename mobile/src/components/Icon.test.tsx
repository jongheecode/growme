import { render, screen } from '@testing-library/react-native';
import Icon from './Icon';

describe('Icon', () => {
  it.each(['home', 'history', 'friends', 'shop', 'profile', 'ranking', 'challenge', 'search', 'clock'] as const)(
    'renders the %s icon',
    (name) => {
      render(<Icon name={name} color="#5FA97D" />);
      expect(screen.getByTestId(`icon-${name}`)).toBeTruthy();
    }
  );
});
