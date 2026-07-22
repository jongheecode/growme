import { getAnthropicClient } from './anthropicClient';
import { Personality } from './growth';

const OUTCOME_LABEL = { COMPLETED: '완료', FAILED: '실패' } as const;

// AI 호출이 실패했을 때(크레딧 소진, API 장애 등) 완료/실패 반응을
// 아예 못 보여주는 대신 쓰는 프리셋 문구 풀. AI가 복구되면 이후
// 요청부터는 다시 실시간 생성된 문구가 쓰인다.
const FALLBACK_REACTIONS: Record<'COMPLETED' | 'FAILED', string[]> = {
  COMPLETED: [
    '잘했어! 오늘도 한 걸음 나아갔어',
    '멋지다, 꾸준히 하고 있어!',
    '해냈구나, 정말 대견해',
    '오늘도 완료! 이 기세 좋아',
  ],
  FAILED: [
    '괜찮아, 다음에 다시 해보자',
    '이런 날도 있는 거지, 너무 자책하지 마',
    '다음 기회에 잘 해보자, 응원할게',
    '한 번 놓쳤다고 멈추는 건 아니야',
  ],
};

export function pickFallbackReaction(
  outcome: 'COMPLETED' | 'FAILED',
  rand: () => number = Math.random
): string {
  const pool = FALLBACK_REACTIONS[outcome];
  return pool[Math.floor(rand() * pool.length)];
}

function personalityDescription(personality: Personality | null): string {
  if (!personality) {
    return '아직 사용자의 성격 유형을 알 수 없어. 중립적인 톤으로 반응해줘.';
  }
  const axisADesc = personality.axisA === 'STEADY' ? '꾸준한 편이고' : '느슨한 편이고';
  const axisBDesc =
    personality.axisB === 'EASYGOING' ? '마감보다 여유있게 끝내는 편이야' : '마감 막판에 몰아치는 편이야';
  return `이 사용자는 ${axisADesc} ${axisBDesc}. 그 성격에 맞는 말투로 반응해줘.`;
}

export async function generateReaction(
  task: { title: string },
  personality: Personality | null,
  outcome: 'COMPLETED' | 'FAILED'
): Promise<string> {
  const systemPrompt = `너는 '꾸미'라는 이름의 다정한 동반자야. 사용자가 태스크를 ${OUTCOME_LABEL[outcome]}했어. ${personalityDescription(personality)} 스크립트처럼 정형화된 말고, 태스크 '${task.title}'에 대해 짧게 한두 문장으로 자연스럽게 반응해.`;

  const response = await getAnthropicClient().messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 256,
    system: systemPrompt,
    messages: [{ role: 'user', content: `태스크: ${task.title}` }],
  });

  const content = response.content as Array<{ type: string; text?: string }>;
  const textBlock = content.find((b) => b.type === 'text');
  if (!textBlock?.text) throw new Error('no reaction text returned');
  return textBlock.text;
}
