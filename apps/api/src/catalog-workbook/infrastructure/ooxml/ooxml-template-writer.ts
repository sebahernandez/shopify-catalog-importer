import type { TemplateDefinition, TemplateWriter } from '../../ports/template-writer.port.js';
import { writePackage, type PackageOptions } from './package-writer.js';

/** Writes the template with the own minimal OOXML writer; the bytes depend only on the input. */
export class OoxmlTemplateWriter implements TemplateWriter {
  constructor(private readonly options: PackageOptions = {}) {}

  write(definition: TemplateDefinition): Uint8Array {
    return writePackage(definition.sheets, this.options);
  }
}
