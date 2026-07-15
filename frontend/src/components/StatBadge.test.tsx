import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import StatBadge from './StatBadge';
import { BoltIcon } from './icons/BoltIcon';

describe('StatBadge', () => {
  it('renders the value and label', () => {
    render(<StatBadge icon={<BoltIcon />} value="3일" label="연속" tint="coral" />);
    expect(screen.getByText('3일')).toBeInTheDocument();
    expect(screen.getByText('연속')).toBeInTheDocument();
  });

  it('renders the passed icon', () => {
    const { container } = render(<StatBadge icon={<BoltIcon />} value="3일" label="연속" tint="coral" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});
