import { describe, expect, it } from 'vitest';
import { render } from '../ui-render';
import { TextField } from './TextField';

const base = { id: 'f', label: 'Nombre', value: 'abc', onChange: () => undefined };

describe('TextField', () => {
  it('ties the label to the input and keeps the value', () => {
    const html = render(TextField, base);
    expect(html).toMatch(/<label for="f"[^>]*>Nombre<\/label>/);
    expect(html).toContain('id="f"');
    expect(html).toContain('value="abc"');
    expect(html).toContain('required=""');
  });

  it('links a hint with aria-describedby only when there is one', () => {
    expect(render(TextField, base)).not.toContain('aria-describedby');
    const html = render(TextField, { ...base, hint: 'Ayuda' });
    expect(html).toContain('aria-describedby="f-hint"');
    expect(html).toContain('id="f-hint"');
  });

  it('can hide a secret and be disabled', () => {
    const html = render(TextField, { ...base, type: 'password', disabled: true });
    expect(html).toContain('type="password"');
    expect(html).toContain('disabled=""');
    expect(html).toContain('autoComplete="off"');
  });
});
