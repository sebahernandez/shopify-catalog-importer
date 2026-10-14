/** One sheet of the template; every cell is text, so typed identifiers never turn into numbers. */
export interface TemplateSheet {
  readonly name: string;
  /** Row 0 is the header. */
  readonly rows: readonly (readonly string[])[];
  /** Zero-based columns whose typed values must stay text. */
  readonly textColumns?: readonly number[];
  readonly widths?: readonly number[];
  /** Zero-based column that offers a TRUE/FALSE list. */
  readonly trueFalseColumn?: number;
}

export interface TemplateDefinition {
  readonly sheets: readonly TemplateSheet[];
}

export interface TemplateWriter {
  /** The same definition always yields the same bytes. */
  write(definition: TemplateDefinition): Uint8Array;
}
