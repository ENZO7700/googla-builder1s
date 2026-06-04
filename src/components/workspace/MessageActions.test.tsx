import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MessageActions from './MessageActions';

describe('MessageActions', () => {
  it('shows code-only button when content has code blocks', () => {
    render(<MessageActions content="text\n```js\nx=1\n```" />);
    expect(screen.getByTitle('Iba kód')).toBeInTheDocument();
  });

  it('hides code-only button without code blocks', () => {
    render(<MessageActions content="just text" />);
    expect(screen.queryByTitle('Iba kód')).not.toBeInTheDocument();
  });

  it('shows preview button only when html block + handler present', () => {
    const onPreview = vi.fn();
    const { rerender } = render(<MessageActions content="```html\n<div/>\n```" onSendToPreview={onPreview} />);
    const btn = screen.getByTitle('Do Preview');
    fireEvent.click(btn);
    expect(onPreview).toHaveBeenCalledWith(expect.stringContaining('<div'));

    rerender(<MessageActions content="```python\npass\n```" onSendToPreview={onPreview} />);
    expect(screen.queryByTitle('Do Preview')).not.toBeInTheDocument();
  });

  it('shows regenerate and continue when handlers are provided', () => {
    render(<MessageActions content="x" onRegenerate={() => {}} onContinue={() => {}} />);
    expect(screen.getByTitle('Regenerovať')).toBeInTheDocument();
    expect(screen.getByTitle('Pokračovať')).toBeInTheDocument();
  });

  it('calls regenerate handler on click', () => {
    const fn = vi.fn();
    render(<MessageActions content="x" onRegenerate={fn} />);
    fireEvent.click(screen.getByTitle('Regenerovať'));
    expect(fn).toHaveBeenCalled();
  });
});
