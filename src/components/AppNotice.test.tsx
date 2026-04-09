import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppNotice } from './AppNotice';

describe('AppNotice', () => {
  it('renders the current notice details when a notice is present', () => {
    render(
      <AppNotice
        notice={{
          type: 'error',
          text: 'Synchronisierung fehlgeschlagen.',
          details: ['Server nicht erreichbar', 'Bitte später erneut versuchen'],
        }}
      />,
    );

    expect(screen.getByText('Synchronisierung fehlgeschlagen.')).toBeInTheDocument();
    expect(screen.getByText('Server nicht erreichbar')).toBeInTheDocument();
    expect(screen.getByText('Bitte später erneut versuchen')).toBeInTheDocument();
  });

  it('renders nothing when no notice is present', () => {
    const { container } = render(<AppNotice notice={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
