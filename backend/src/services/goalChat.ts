import Anthropic from '@anthropic-ai/sdk';
import { Category } from '@prisma/client';

let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

export const SYSTEM_PROMPT = `너는 '꾸미'라는 이름의 다정한 동반자야. 사용자가 앱을 처음 켰거나 새 목표를 정하고 싶을 때 자연스러운 대화로 말을 걸어. 형식적인 질문지처럼 묻지 말고, 친구처럼 편하게 이야기를 나누면서 사용자가 요즘 관심 있어 하는 일이나 이루고 싶은 것을 자연스럽게 끌어내. 대화 중 사용자의 목표가 실행 가능한 수준으로 구체적이라고 판단되면(예: "매일 영어 리스닝 습관 만들기") set_goal 도구를 호출해서 목표를 확정해. 목표가 너무 막연하면(예: "그냥 잘 살고 싶어") 도구를 호출하지 말고 좀 더 구체적으로 물어봐.`;

export const SET_GOAL_TOOL = {
  name: 'set_goal',
  description: '대화에서 사용자의 목표가 충분히 구체적으로 드러났을 때 호출한다',
  input_schema: {
    type: 'object' as const,
    properties: {
      title: { type: 'string' as const },
      category: { type: 'string' as const, enum: ['EXERCISE', 'STUDY', 'READING', 'ETC'] },
    },
    required: ['title', 'category'],
  },
};

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface GoalChatResult {
  reply: string;
  goalInput: { title: string; category: Category } | null;
}

function isValidCategory(value: unknown): value is Category {
  return typeof value === 'string' && (Object.values(Category) as string[]).includes(value);
}

export async function runGoalChat(messages: ChatMessage[]): Promise<GoalChatResult> {
  const response = await getAnthropicClient().messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools: [SET_GOAL_TOOL],
    messages,
  });

  const content = response.content as Array<{ type: string; text?: string; name?: string; input?: unknown }>;
  const textBlock = content.find((b) => b.type === 'text');
  const toolBlock = content.find((b) => b.type === 'tool_use' && b.name === 'set_goal');

  const reply = textBlock?.text ?? '좋아, 목표를 정했어!';

  if (toolBlock) {
    const input = toolBlock.input as { title?: unknown; category?: unknown };
    if (typeof input.title === 'string' && input.title.length > 0 && isValidCategory(input.category)) {
      return { reply, goalInput: { title: input.title, category: input.category } };
    }
  }

  return { reply, goalInput: null };
}
