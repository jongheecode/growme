import { getAnthropicClient } from './anthropicClient';
import { Personality } from './growth';

const OUTCOME_LABEL = { COMPLETED: '완료', FAILED: '실패' } as const;

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
