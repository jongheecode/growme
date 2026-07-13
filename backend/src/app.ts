import express from 'express';
import cors from 'cors';
import authRouter from './routes/auth';

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/auth', authRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

export default app;
