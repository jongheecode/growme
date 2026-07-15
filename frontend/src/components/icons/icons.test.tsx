import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { BoltIcon } from './BoltIcon';
import { ClockIcon } from './ClockIcon';
import { StarIcon } from './StarIcon';

describe('stat icons', () => {
  it('renders BoltIcon as an svg with the given color', () => {
    const { container } = render(<BoltIcon color="#e85d82" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(container.querySelector('polygon')).toHaveAttribute('fill', '#e85d82');
  });

  it('renders ClockIcon as an svg with the given color', () => {
    const { container } = render(<ClockIcon color="#3fbf99" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(container.querySelector('circle')).toHaveAttribute('stroke', '#3fbf99');
  });

  it('renders StarIcon as an svg with the given color', () => {
    const { container } = render(<StarIcon color="#c98a00" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(container.querySelector('path')).toHaveAttribute('fill', '#c98a00');
  });
});
