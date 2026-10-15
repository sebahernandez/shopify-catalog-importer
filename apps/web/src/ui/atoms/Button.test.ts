import { describe, expect, it } from 'vitest';
import { render } from '../ui-render';
import { Button } from './Button';

describe('Button', () => {
  it('renders its label as a plain button that does not submit by default', () => {
    const html = render(Button, { label: 'Importar' });
    expect(html).toContain('>Importar</button>');
    expect(html).toContain('type="button"');
    expect(html).not.toContain('disabled=""');
  });

  it('is disabled when asked to be, and disabled plus busy while its action runs', () => {
    expect(render(Button, { label: 'x', disabled: true })).toContain('disabled=""');
    const busy = render(Button, { label: 'x', busy: true });
    expect(busy).toContain('disabled=""');
    expect(busy).toContain('aria-busy="true"');
  });

  it('can be a submit button and has a visible focus style', () => {
    const html = render(Button, { label: 'x', type: 'submit', variant: 'secondary' });
    expect(html).toContain('type="submit"');
    expect(html).toContain('focus-visible:outline-2');
  });
});
