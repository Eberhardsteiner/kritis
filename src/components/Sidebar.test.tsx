import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Sidebar } from './Sidebar';

describe('Sidebar', () => {
  it('shows the current sprint status and allows navigation', () => {
    const onChange = vi.fn();

    render(<Sidebar activeView="program" onChange={onChange} />);

    expect(screen.getByText('Sprint P4')).toBeInTheDocument();
    expect(screen.getByText(/Status 2.1.0/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /übersicht/i }));
    expect(onChange).toHaveBeenCalledWith('dashboard');
  });
});
