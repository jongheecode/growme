interface IconProps {
  className?: string;
  color?: string;
}

export function DumbbellIcon({ className, color = 'currentColor' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <rect x="1" y="9" width="4" height="6" rx="1.5" fill={color} />
      <rect x="19" y="9" width="4" height="6" rx="1.5" fill={color} />
      <rect x="6" y="11" width="12" height="2" rx="1" fill={color} />
    </svg>
  );
}
