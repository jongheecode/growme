import { initSentry } from './services/sentry';

initSentry();

import app from './app';
import { registerCronJobs } from './cron';

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

app.listen(PORT, () => {
  console.log(`growme backend listening on ${PORT}`);
  registerCronJobs();
});
