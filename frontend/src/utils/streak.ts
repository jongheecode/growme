export function computeCurrentStreak(totalsByDate: Record<string, number>, today: Date = new Date()): number {
  let streak = 0;
  const cursor = new Date(today);
  for (;;) {
    const key = cursor.toISOString().slice(0, 10);
    const seconds = totalsByDate[key] ?? 0;
    if (seconds <= 0) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
