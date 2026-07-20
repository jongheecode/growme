import { render, screen, fireEvent } from '@testing-library/react-native';
import KkumiInfoModal from './KkumiInfoModal';
import { GrowthState } from '../api/growth';

const eggGrowth: GrowthState = {
  totalXp: 0,
  species: null,
  stage: 0,
  xpIntoStage: 0,
  xpToNextStage: null,
  personality: null,
  points: 0,
};

const grownGrowth: GrowthState = {
  totalXp: 60,
  species: 'SPECIES_A',
  stage: 1,
  xpIntoStage: 10,
  xpToNextStage: 100,
  personality: { axisA: 'STEADY', axisB: 'EASYGOING', type: 'STEADY_EASYGOING' },
  points: 0,
};

describe('KkumiInfoModal', () => {
  it('shows egg state and "성격 파악 중..." when there is no personality data', () => {
    render(<KkumiInfoModal visible onClose={() => {}} growth={eggGrowth} />);
    expect(screen.getByTestId('kkumi-species-label')).toHaveTextContent('알');
    expect(screen.getByTestId('kkumi-personality-label')).toHaveTextContent('성격 파악 중...');
  });

  it('shows the species, stage and personality label once grown', () => {
    render(<KkumiInfoModal visible onClose={() => {}} growth={grownGrowth} />);
    expect(screen.getByTestId('kkumi-stage-label')).toHaveTextContent('1단계');
    expect(screen.getByTestId('kkumi-personality-label')).not.toHaveTextContent('성격 파악 중');
  });

  it('calls onClose when the close button is pressed', () => {
    const onClose = jest.fn();
    render(<KkumiInfoModal visible onClose={onClose} growth={grownGrowth} />);
    fireEvent.press(screen.getByTestId('kkumi-modal-close'));
    expect(onClose).toHaveBeenCalled();
  });
});
