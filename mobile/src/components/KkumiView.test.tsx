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

  it('renders a badge for each equipped accessory when stage > 0', () => {
    render(
      <KkumiView
        species="SPECIES_B"
        stage={1}
        accessories={[{ slot: 'HAT' }, { slot: 'FACE' }]}
      />
    );
    expect(screen.getByTestId('accessory-badge-HAT')).toBeTruthy();
    expect(screen.getByTestId('accessory-badge-FACE')).toBeTruthy();
    expect(screen.queryByTestId('accessory-badge-BACKGROUND')).toBeNull();
  });

  it('does not render accessories at stage 0 (egg)', () => {
    render(<KkumiView species={null} stage={0} accessories={[{ slot: 'HAT' }]} />);
    expect(screen.queryByTestId('accessory-badge-HAT')).toBeNull();
  });
});
