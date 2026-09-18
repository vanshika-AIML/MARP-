import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import GenerationVisual from './GenerationVisual';
afterEach(cleanup);
it('shows indeterminate activity without backend progress', () => {
  render(<GenerationVisual event={{ type: 'idle', progress: 0 }} />);
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Making room for your ideas');
});
it('shows only real active backend progress and ignores a previous completion', () => {
  const { rerender } = render(<GenerationVisual event={{ type: 'generating_slide', progress: 42, message: 'Building slide two', slideIndex: 1 }} />);
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '42');
  expect(screen.getByText('Building slide two')).toBeInTheDocument();
  rerender(<GenerationVisual event={{ type: 'completed', progress: 100 }} />);
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
});
