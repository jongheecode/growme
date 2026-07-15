export type Category = 'EXERCISE' | 'STUDY' | 'READING' | 'ETC';

interface Tint {
  light: string;
  dark: string;
}

// ETC keeps the original mint/teal from the reference art; other categories
// get their own hue so the dominant-category visual difference (design doc's
// "카테고리 비중으로 외형이 결정된다") is visible even while stage 0-3 art is shared.
export const CATEGORY_TINT: Record<Category, Tint> = {
  EXERCISE: { light: '#FFAB91', dark: '#FF8A65' },
  STUDY: { light: '#90CAF9', dark: '#64B5F6' },
  READING: { light: '#CE93D8', dark: '#BA68C8' },
  ETC: { light: '#8FD4C8', dark: '#6BC5B8' },
};

function Shadow() {
  return <ellipse cx="0" cy="55" rx="48" ry="14" fill="#000" opacity="0.06" />;
}

function EggStage() {
  return (
    <svg viewBox="-60 -20 120 100" className="w-full h-full">
      <Shadow />
      <ellipse cx="0" cy="20" rx="42" ry="52" fill="#F2D0A4" />
      <ellipse cx="-14" cy="5" rx="12" ry="16" fill="#FBEAD2" opacity="0.7" />
      <path
        d="M-30 25 Q-20 19 -10 25 Q0 31 10 25 Q20 19 30 25"
        fill="none"
        stroke="#D9A867"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M-24 43 Q-14 37 -4 43 Q6 49 16 43"
        fill="none"
        stroke="#D9A867"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.6"
      />
    </svg>
  );
}

function HatchStage({ tint }: { tint: Tint }) {
  return (
    <svg viewBox="-60 -30 120 120" className="w-full h-full">
      <Shadow />
      <path d="M-40 -10 L-40 5 Q-40 28 0 28 Q40 28 40 5 L40 -10 Z" fill="#F2D0A4" />
      <path
        d="M-40 -10 L-30 -18 L-20 -10 L-10 -20 L0 -10 L10 -20 L20 -10 L30 -18 L40 -10"
        fill="none"
        stroke="#D9A867"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="0" cy="-20" r="26" fill={tint.light} />
      <circle cx="-9" cy="-24" r="4.5" fill="#2C3E3A" />
      <circle cx="9" cy="-24" r="4.5" fill="#2C3E3A" />
      <circle cx="-7.5" cy="-25.5" r="1.5" fill="#fff" />
      <circle cx="10.5" cy="-25.5" r="1.5" fill="#fff" />
      <path d="M-6 -14 Q0 -10 6 -14" fill="none" stroke="#2C3E3A" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="-16" cy="-18" r="4" fill="#F5A5A5" opacity="0.5" />
      <circle cx="16" cy="-18" r="4" fill="#F5A5A5" opacity="0.5" />
    </svg>
  );
}

function BabyStage({ tint }: { tint: Tint }) {
  return (
    <svg viewBox="-60 -50 120 120" className="w-full h-full">
      <Shadow />
      <ellipse cx="0" cy="-8" rx="40" ry="38" fill={tint.light} />
      <path d="M-22 -38 Q-26 -54 -14 -48" fill="none" stroke={tint.light} strokeWidth="7" strokeLinecap="round" />
      <path d="M22 -38 Q26 -54 14 -48" fill="none" stroke={tint.light} strokeWidth="7" strokeLinecap="round" />
      <circle cx="-13" cy="-12" r="5.5" fill="#2C3E3A" />
      <circle cx="13" cy="-12" r="5.5" fill="#2C3E3A" />
      <circle cx="-11" cy="-14" r="1.8" fill="#fff" />
      <circle cx="15" cy="-14" r="1.8" fill="#fff" />
      <path d="M-8 0 Q0 6 8 0" fill="none" stroke="#2C3E3A" strokeWidth="2" strokeLinecap="round" />
      <circle cx="-22" cy="-4" r="5" fill="#F5A5A5" opacity="0.5" />
      <circle cx="22" cy="-4" r="5" fill="#F5A5A5" opacity="0.5" />
    </svg>
  );
}

function GrownStage({ tint }: { tint: Tint }) {
  return (
    <svg viewBox="-65 -80 130 150" className="w-full h-full">
      <Shadow />
      <ellipse cx="0" cy="-10" rx="46" ry="44" fill={tint.dark} />
      <path d="M-26 -42 Q-34 -64 -18 -54" fill="none" stroke={tint.dark} strokeWidth="8" strokeLinecap="round" />
      <path d="M26 -42 Q34 -64 18 -54" fill="none" stroke={tint.dark} strokeWidth="8" strokeLinecap="round" />
      <circle cx="-24" cy="-58" r="3" fill="#FFD97D" />
      <circle cx="24" cy="-58" r="3" fill="#FFD97D" />
      <circle cx="-15" cy="-14" r="6" fill="#2C3E3A" />
      <circle cx="15" cy="-14" r="6" fill="#2C3E3A" />
      <circle cx="-12.5" cy="-16.5" r="2" fill="#fff" />
      <circle cx="17.5" cy="-16.5" r="2" fill="#fff" />
      <path d="M-10 0 Q0 8 10 0" fill="none" stroke="#2C3E3A" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="-26" cy="-4" r="5.5" fill="#F5A5A5" opacity="0.5" />
      <circle cx="26" cy="-4" r="5.5" fill="#F5A5A5" opacity="0.5" />
      <path d="M-4 -68 L0 -80 L4 -68 Z" fill="#FFD97D" />
      <circle cx="0" cy="-82" r="4" fill="#FFD97D" />
    </svg>
  );
}

export function KkumiCharacter({ stage, category }: { stage: number; category: Category }) {
  const tint = CATEGORY_TINT[category];
  // Stages 3-4 share the "성장" art (the reference design only defines 4 distinct
  // looks: 알/부화/아기/성장); stage 4 is the same visual as the fully-grown stage 3.
  const visualStage = Math.min(stage, 3);

  if (visualStage === 0) return <EggStage />;
  if (visualStage === 1) return <HatchStage tint={tint} />;
  if (visualStage === 2) return <BabyStage tint={tint} />;
  return <GrownStage tint={tint} />;
}
