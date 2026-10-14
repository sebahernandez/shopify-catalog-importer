import type { TemplateWriter } from '../ports/template-writer.port.js';
import { templateDefinition } from './template-content.js';

/** Produces the downloadable workbook template; it holds no state and reads nothing. */
export class GenerateTemplateUseCase {
  constructor(private readonly writer: TemplateWriter) {}

  execute(): Uint8Array {
    return this.writer.write(templateDefinition());
  }
}
