import { render, screen, fireEvent } from '@testing-library/react-native';
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
});
