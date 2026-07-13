import { createBrowserRouter } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import ActivitySelectPage from './pages/ActivitySelectPage';
import TimerPage from './pages/TimerPage';
import HistoryPage from './pages/HistoryPage';

const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/activities', element: <ActivitySelectPage /> },
  { path: '/timer/:activityId', element: <TimerPage /> },
  { path: '/history', element: <HistoryPage /> },
]);

export default router;
