import { PersonalityType } from './api/growth';

export interface PersonalityInfo {
  name: string;
  desc: string;
  steady: boolean;
  easygoing: boolean;
}

export const PERSONALITY_INFO: Record<PersonalityType, PersonalityInfo> = {
  STEADY_EASYGOING: { name: '산책가형', desc: '매일 조금씩 여유롭게 걸어가는 꾸준러', steady: true, easygoing: true },
  STEADY_LASTMINUTE: { name: '질주러형', desc: '평소 꾸준하다 마감 앞에서 폭발하는 스타일', steady: true, easygoing: false },
  LOOSE_EASYGOING: { name: '몽상가형', desc: '마음 가는 대로, 여유롭게 자기 페이스대로', steady: false, easygoing: true },
  LOOSE_LASTMINUTE: { name: '벼락치기형', desc: '느슨하게 지내다 막판에 몰아서 해내는 스타일', steady: false, easygoing: false },
};
