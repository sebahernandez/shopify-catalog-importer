import { describe, expect, it, vi } from 'vitest';
import type { TemplateWriter } from '../ports/template-writer.port.js';
import { GenerateTemplateUseCase } from './generate-template.use-case.js';
import { templateDefinition } from './template-content.js';

describe('GenerateTemplateUseCase', () => {
  it('hands the fixed template definition to the writer and returns its bytes', () => {
    const bytes = new Uint8Array([80, 75]);
    const write = vi.fn<TemplateWriter['write']>(() => bytes);
    expect(new GenerateTemplateUseCase({ write }).execute()).toBe(bytes);
    expect(write).toHaveBeenCalledExactlyOnceWith(templateDefinition());
  });
});
