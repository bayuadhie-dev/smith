import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../../components/ui/button';

describe('Button', () => {
  it('renders children correctly', () => {
    render(<Button>Klik saya</Button>);
    expect(screen.getByRole('button', { name: 'Klik saya' })).toBeInTheDocument();
  });

  it('applies default variant and size classes', () => {
    render(<Button>Default</Button>);
    const button = screen.getByRole('button', { name: 'Default' });
    expect(button.className).toContain('bg-primary');
    expect(button.className).toContain('h-10');
  });

  it('applies destructive variant classes when specified', () => {
    render(<Button variant="destructive">Hapus</Button>);
    const button = screen.getByRole('button', { name: 'Hapus' });
    expect(button.className).toContain('bg-destructive');
  });

  it('applies sm size classes when specified', () => {
    render(<Button size="sm">Kecil</Button>);
    const button = screen.getByRole('button', { name: 'Kecil' });
    expect(button.className).toContain('h-9');
  });

  it('calls onClick handler when clicked', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Submit</Button>);
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>);
    const button = screen.getByRole('button', { name: 'Disabled' });
    expect(button).toBeDisabled();
  });

  it('merges custom className with default classes', () => {
    render(<Button className="custom-class">Custom</Button>);
    const button = screen.getByRole('button', { name: 'Custom' });
    expect(button.className).toContain('custom-class');
    expect(button.className).toContain('inline-flex');
  });
});
