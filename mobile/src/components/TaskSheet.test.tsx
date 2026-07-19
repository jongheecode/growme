import { render, screen, fireEvent } from '@testing-library/react-native';
import TaskSheet from './TaskSheet';
import { Task } from '../api/tasks';

const tasks: Task[] = [
  { id: '1', title: '운동하기', category: 'EXERCISE', difficulty: 'EASY', xpValue: 10, dueAt: new Date().toISOString(), status: 'PENDING', completedAt: null, createdAt: new Date().toISOString(), goalId: null, reactionText: null, reactionShownAt: null },
  { id: '2', title: '독서 30분', category: 'READING', difficulty: 'MEDIUM', xpValue: 20, dueAt: new Date().toISOString(), status: 'COMPLETED', completedAt: new Date().toISOString(), createdAt: new Date().toISOString(), goalId: null, reactionText: null, reactionShownAt: null },
];

describe('TaskSheet', () => {
  it('shows the done/total count on the collapsed button', () => {
    render(<TaskSheet tasks={tasks} onComplete={() => {}} onCreate={() => {}} />);
    expect(screen.getByTestId('task-fab-count')).toHaveTextContent('1/2');
  });

  it('expands to show the task list when the button is pressed', () => {
    render(<TaskSheet tasks={tasks} onComplete={() => {}} onCreate={() => {}} />);
    fireEvent.press(screen.getByTestId('task-fab'));
    expect(screen.getByTestId('task-list')).toBeTruthy();
    expect(screen.getByText(/운동하기/)).toBeTruthy();
  });

  it('calls onComplete with the task id when the complete button is pressed', () => {
    const onComplete = jest.fn();
    render(<TaskSheet tasks={tasks} onComplete={onComplete} onCreate={() => {}} />);
    fireEvent.press(screen.getByTestId('task-fab'));
    fireEvent.press(screen.getByTestId('task-complete-1'));
    expect(onComplete).toHaveBeenCalledWith('1');
  });

  it('calls onCreate with the form values on submit', () => {
    const onCreate = jest.fn();
    render(<TaskSheet tasks={tasks} onComplete={() => {}} onCreate={onCreate} />);
    fireEvent.press(screen.getByTestId('task-fab'));
    fireEvent.changeText(screen.getByTestId('new-task-title'), '리스닝 20분');
    fireEvent.press(screen.getByTestId('category-STUDY'));
    fireEvent.press(screen.getByTestId('difficulty-HARD'));
    fireEvent.press(screen.getByTestId('due-week'));
    fireEvent.press(screen.getByTestId('add-task-submit'));
    expect(onCreate).toHaveBeenCalledWith('리스닝 20분', 'STUDY', 'HARD', 'THIS_WEEK');
  });

  it('closes back to the collapsed button', () => {
    render(<TaskSheet tasks={tasks} onComplete={() => {}} onCreate={() => {}} />);
    fireEvent.press(screen.getByTestId('task-fab'));
    fireEvent.press(screen.getByTestId('task-sheet-close'));
    expect(screen.getByTestId('task-fab')).toBeTruthy();
  });

  it('requests suggestions when the button is pressed', () => {
    const onRequestSuggestions = jest.fn();
    render(
      <TaskSheet
        tasks={tasks}
        onComplete={() => {}}
        onCreate={() => {}}
        onRequestSuggestions={onRequestSuggestions}
      />
    );
    fireEvent.press(screen.getByTestId('task-fab'));
    fireEvent.press(screen.getByTestId('request-suggestions'));
    expect(onRequestSuggestions).toHaveBeenCalled();
  });

  it('shows suggestion cards and accepts one', () => {
    const onAcceptSuggestion = jest.fn();
    const suggestions = [{ title: '단어 암기', category: 'STUDY' as const, difficulty: 'MEDIUM' as const, dueChoice: 'TODAY' as const }];
    render(
      <TaskSheet
        tasks={tasks}
        onComplete={() => {}}
        onCreate={() => {}}
        suggestions={suggestions}
        onAcceptSuggestion={onAcceptSuggestion}
      />
    );
    fireEvent.press(screen.getByTestId('task-fab'));
    expect(screen.getByText(/단어 암기/)).toBeTruthy();
    fireEvent.press(screen.getByTestId('suggestion-accept-0'));
    expect(onAcceptSuggestion).toHaveBeenCalledWith(suggestions[0]);
  });

  it('rejects a suggestion without calling onAcceptSuggestion', () => {
    const onAcceptSuggestion = jest.fn();
    const onRejectSuggestion = jest.fn();
    const suggestions = [{ title: '단어 암기', category: 'STUDY' as const, difficulty: 'MEDIUM' as const, dueChoice: 'TODAY' as const }];
    render(
      <TaskSheet
        tasks={tasks}
        onComplete={() => {}}
        onCreate={() => {}}
        suggestions={suggestions}
        onAcceptSuggestion={onAcceptSuggestion}
        onRejectSuggestion={onRejectSuggestion}
      />
    );
    fireEvent.press(screen.getByTestId('task-fab'));
    fireEvent.press(screen.getByTestId('suggestion-reject-0'));
    expect(onRejectSuggestion).toHaveBeenCalledWith(0);
    expect(onAcceptSuggestion).not.toHaveBeenCalled();
  });

  it('shows a loading label instead of the button while suggestions are loading', () => {
    render(
      <TaskSheet tasks={tasks} onComplete={() => {}} onCreate={() => {}} suggestionsLoading />
    );
    fireEvent.press(screen.getByTestId('task-fab'));
    expect(screen.getByText('추천받는 중...')).toBeTruthy();
  });
});
