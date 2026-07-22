import { prisma } from '../db';

export async function getMutuallyBlockedUserIds(userId: string): Promise<string[]> {
  const blocks = await prisma.blockedUser.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
  });
  return blocks.map((b) => (b.blockerId === userId ? b.blockedId : b.blockerId));
}
