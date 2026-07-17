import cron from 'node-cron';
import { closeStaleSessions } from './jobs/staleSessionJob';

export function registerCronJobs() {
  cron.schedule('*/5 * * * *', closeStaleSessions);
}
