import { render, screen } from '@testing-library/react-native';
import KkumiView from './KkumiView';

describe('KkumiView', () => {
  it('renders without a species (egg state)', () => {
    render(<KkumiView species={null} stage={0} />);
    expect(screen.getByTestId('kkumi-view')).toBeTruthy();
  });

  it('renders with a species and stage', () => {
    render(<KkumiView species="SPECIES_B" stage={2} />);
    expect(screen.getByTestId('kkumi-view')).toBeTruthy();
  });
});
