import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { useFocusTimer } from '../hooks/useFocusTimer';
import TimerPage from './TimerPage';

vi.mock('../hooks/useFocusTimer');

function renderTimerPage() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/timer/activity-1']}>
        <Routes>
          <Route path="/timer/:activityId" element={<TimerPage />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

describe('TimerPage', () => {
  it('shows a coral progress ring while running', () => {
    vi.mocked(useFocusTimer).mockReturnValue({
      elapsedSeconds: 12,
      isPaused: false,
      error: null,
      end: vi.fn(),
    });

    const { container } = renderTimerPage();
    expect(container.querySelector('circle')).toHaveAttribute('stroke', '#ff7a9c');
  });

  it('switches the ring to honey when paused', () => {
    vi.mocked(useFocusTimer).mockReturnValue({
      elapsedSeconds: 12,
      isPaused: true,
      error: null,
      end: vi.fn(),
    });

    const { container } = renderTimerPage();
    expect(container.querySelector('circle')).toHaveAttribute('stroke', '#ffd166');
  });
});
