import { createBrowserRouter } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ActivitySelectPage from './pages/ActivitySelectPage';
import TimerPage from './pages/TimerPage';
import HistoryPage from './pages/HistoryPage';
import ProfilePage from './pages/ProfilePage';

const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/signup', element: <SignupPage /> },
  { path: '/activities', element: <ActivitySelectPage /> },
  { path: '/timer/:activityId', element: <TimerPage /> },
  { path: '/history', element: <HistoryPage /> },
  { path: '/profile', element: <ProfilePage /> },
]);

export default router;
