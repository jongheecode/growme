interface IconProps {
  className?: string;
  color?: string;
}

export function PencilIcon({ className, color = 'currentColor' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <g transform="rotate(45 12 12)">
        <rect x="9" y="2" width="6" height="14" rx="1" fill={color} />
        <polygon points="9 16 15 16 12 21" fill={color} />
        <rect x="9" y="2" width="6" height="3" fill="#fff" opacity="0.5" />
      </g>
    </svg>
  );
}
