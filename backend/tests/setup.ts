import { execSync } from 'child_process';
import { beforeAll, beforeEach, afterAll } from 'vitest';
import { prisma } from '../src/db';

beforeAll(() => {
  execSync('npx prisma db push --skip-generate', {
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
    stdio: 'inherit',
  });
});

beforeEach(async () => {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "Session","Activity","Growth","User" CASCADE'
  );
});

afterAll(async () => {
  await prisma.$disconnect();
});
