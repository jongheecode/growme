interface IconProps {
  className?: string;
  color?: string;
}

export function OpenBookIcon({ className, color = 'currentColor' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <path d="M2 5 C2 5 6 4 12 6 L12 19 C6 17 2 18 2 18 Z" fill={color} />
      <path d="M22 5 C22 5 18 4 12 6 L12 19 C18 17 22 18 22 18 Z" fill={color} opacity="0.75" />
    </svg>
  );
}
