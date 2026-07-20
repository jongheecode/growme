import express from 'express';
import cors from 'cors';
import authRouter from './routes/auth';
import oauthGoogleRouter from './routes/oauthGoogle';
import oauthKakaoRouter from './routes/oauthKakao';
import activitiesRouter from './routes/activities';
import sessionsRouter from './routes/sessions';
import historyRouter from './routes/history';
import usersRouter from './routes/users';
import tasksRouter from './routes/tasks';
import growthRouter from './routes/growth';
import goalsRouter from './routes/goals';
import friendsRouter from './routes/friends';
import leaderboardRouter from './routes/leaderboard';
import challengesRouter from './routes/challenges';
import shopRouter from './routes/shop';

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/auth', oauthGoogleRouter);
app.use('/api/auth', oauthKakaoRouter);
app.use('/api/activities', activitiesRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/history', historyRouter);
app.use('/api/users', usersRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/growth', growthRouter);
app.use('/api/goals', goalsRouter);
app.use('/api/friends', friendsRouter);
app.use('/api/leaderboard', leaderboardRouter);
app.use('/api/challenges', challengesRouter);
app.use('/api/shop', shopRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

export default app;
