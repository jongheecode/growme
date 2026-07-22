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
import safetyRouter from './routes/safety';

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map((o) => o.trim()).filter(Boolean);

const app = express();
// Railway(및 대부분의 PaaS)는 앱 앞에 리버스 프록시 1홉을 두므로,
// rate limiter가 X-Forwarded-For의 실제 클라이언트 IP를 보게 하려면 필요.
app.set('trust proxy', 1);
app.use(
  cors(
    allowedOrigins
      ? {
          origin: (origin, callback) => {
            if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
            callback(new Error('not allowed by CORS'));
          },
        }
      : undefined
  )
);
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
app.use('/api/safety', safetyRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

export default app;
