interface IconProps {
  className?: string;
  color?: string;
}

export function StarIcon({ className, color = 'currentColor' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <path
        d="M12 2 14.47 8.60 21.51 8.91 15.99 13.30 17.88 20.09 12 16.2 6.12 20.09 8.01 13.30 2.49 8.91 9.53 8.60 Z"
        fill={color}
      />
    </svg>
  );
}
