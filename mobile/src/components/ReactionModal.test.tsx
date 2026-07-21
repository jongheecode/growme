import { render, screen, fireEvent, act } from '@testing-library/react-native';
import ReactionModal from './ReactionModal';

describe('ReactionModal', () => {
  it('shows the reaction text and outcome label for a completion', () => {
    render(<ReactionModal visible text="정말 잘했어!" outcome="COMPLETED" onDismiss={() => {}} />);
    expect(screen.getByTestId('reaction-text')).toHaveTextContent('정말 잘했어!');
    expect(screen.getByTestId('reaction-outcome-label')).toHaveTextContent('완료!');
  });

  it('shows the failure outcome label', () => {
    render(<ReactionModal visible text="괜찮아, 다음엔 잘할 거야" outcome="FAILED" onDismiss={() => {}} />);
    expect(screen.getByTestId('reaction-outcome-label')).toHaveTextContent('아쉬워요');
  });

  it('calls onDismiss when the confirm button is pressed', () => {
    const onDismiss = jest.fn();
    render(<ReactionModal visible text="x" outcome="COMPLETED" onDismiss={onDismiss} />);
    fireEvent.press(screen.getByTestId('reaction-modal-dismiss'));
    expect(onDismiss).toHaveBeenCalled();
  });

  it('shows XP and point reward badges for a completion', () => {
    render(<ReactionModal visible text="정말 잘했어!" outcome="COMPLETED" onDismiss={() => {}} xp={20} points={20} />);
    expect(screen.getByTestId('reaction-rewards')).toHaveTextContent('+20 XP+20 P');
  });

  it('does not show reward badges for a failure', () => {
    render(<ReactionModal visible text="괜찮아" outcome="FAILED" onDismiss={() => {}} />);
    expect(screen.queryByTestId('reaction-rewards')).toBeNull();
  });

  it('shows the egg-shake phase first when hatch is true, with no dismiss button', () => {
    render(
      <ReactionModal visible text="꾸미가 자랐어요" outcome="COMPLETED" onDismiss={() => {}} hatch species="SPECIES_A" stage={1} xp={10} points={10} />
    );
    expect(screen.getByTestId('reaction-outcome-label')).toHaveTextContent('두근두근...');
    expect(screen.queryByTestId('reaction-modal-dismiss')).toBeNull();
  });

  it('reveals the hatched kkumi and a dismiss button after the egg-shake delay', () => {
    jest.useFakeTimers();
    render(
      <ReactionModal visible text="꾸미가 자랐어요" outcome="COMPLETED" onDismiss={() => {}} hatch species="SPECIES_A" stage={1} xp={10} points={10} />
    );
    act(() => {
      jest.advanceTimersByTime(1500);
    });
    expect(screen.getByTestId('reaction-outcome-label')).toHaveTextContent('태어났어요!');
    expect(screen.getByTestId('reaction-modal-dismiss')).toBeTruthy();
    jest.useRealTimers();
  });
});
