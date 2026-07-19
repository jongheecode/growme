import { Category, Difficulty } from '@prisma/client';
import { getAnthropicClient } from './anthropicClient';

export interface TaskSuggestion {
  title: string;
  category: Category;
  difficulty: Difficulty;
  dueChoice: 'TODAY' | 'THIS_WEEK';
}

const CATEGORIES = ['EXERCISE', 'STUDY', 'READING', 'ETC'];
const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'];
const DUE_CHOICES = ['TODAY', 'THIS_WEEK'];

const SYSTEM_PROMPT = `너는 '꾸미'라는 이름의 다정한 동반자야. 사용자의 목표를 보고, 오늘 하루 안에 실행할 수 있을 만한 구체적인 하위 태스크를 1~5개 제안해. 반드시 suggest_tasks 도구를 호출해서 제안해.`;

const SUGGEST_TASKS_TOOL = {
  name: 'suggest_tasks',
  description: '목표에 대한 실행 가능한 하위 태스크를 1~5개 제안할 때 호출한다',
  input_schema: {
    type: 'object' as const,
    properties: {
      suggestions: {
        type: 'array' as const,
        minItems: 1,
        maxItems: 5,
        items: {
          type: 'object' as const,
          properties: {
            title: { type: 'string' as const },
            category: { type: 'string' as const, enum: CATEGORIES },
            difficulty: { type: 'string' as const, enum: DIFFICULTIES },
            dueChoice: { type: 'string' as const, enum: DUE_CHOICES },
          },
          required: ['title', 'category', 'difficulty', 'dueChoice'],
        },
      },
    },
    required: ['suggestions'],
  },
};

function isValidSuggestion(value: unknown): value is TaskSuggestion {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.title === 'string' &&
    v.title.length > 0 &&
    typeof v.category === 'string' &&
    CATEGORIES.includes(v.category) &&
    typeof v.difficulty === 'string' &&
    DIFFICULTIES.includes(v.difficulty) &&
    typeof v.dueChoice === 'string' &&
    DUE_CHOICES.includes(v.dueChoice)
  );
}

export async function suggestTasks(goal: { title: string; category: Category }): Promise<TaskSuggestion[]> {
  const response = await getAnthropicClient().messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools: [SUGGEST_TASKS_TOOL],
    tool_choice: { type: 'tool', name: 'suggest_tasks' },
    messages: [{ role: 'user', content: `목표: ${goal.title} (카테고리: ${goal.category})` }],
  });

  const content = response.content as Array<{ type: string; name?: string; input?: unknown }>;
  const toolBlock = content.find((b) => b.type === 'tool_use' && b.name === 'suggest_tasks');
  if (!toolBlock) return [];

  const input = toolBlock.input as { suggestions?: unknown };
  if (!Array.isArray(input.suggestions)) return [];

  return input.suggestions.filter(isValidSuggestion);
}
