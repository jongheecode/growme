import cron from 'node-cron';
import { closeStaleSessions } from './jobs/staleSessionJob';
import { runDecayJob } from './jobs/decayJob';

export function registerCronJobs() {
  cron.schedule('*/5 * * * *', closeStaleSessions);
  cron.schedule('0 0 * * *', runDecayJob);
}
