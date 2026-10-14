import { Module, type DynamicModule } from '@nestjs/common';
import {
  ARCHIVE_INSPECTOR,
  TEMPLATE_WRITER,
  WORKBOOK_LIMITS,
  WORKBOOK_READER,
} from './application/catalog-workbook.tokens.js';
import { GenerateTemplateUseCase } from './application/generate-template.use-case.js';
import { ValidateWorkbookUseCase } from './application/validate-workbook.use-case.js';
import { withLimits, type WorkbookLimits } from './domain/workbook-limits.js';
import { WorkbookController } from './infrastructure/http/workbook.controller.js';
import { OoxmlTemplateWriter } from './infrastructure/ooxml/ooxml-template-writer.js';
import { SheetJsWorkbookReader } from './infrastructure/reader/sheetjs-workbook-reader.js';
import { ZipArchiveInspector } from './infrastructure/zip/zip-archive-inspector.js';
import type { ArchiveInspector } from './ports/archive-inspector.port.js';
import type { TemplateWriter } from './ports/template-writer.port.js';
import type { WorkbookReader } from './ports/workbook-reader.port.js';

export interface CatalogWorkbookOptions {
  /** Overrides for the default workbook limits; only tests pass this. */
  readonly limits?: Partial<WorkbookLimits>;
}

/** Wires the workbook adapters to the use cases and declares the workbook routes. */
@Module({})
export class CatalogWorkbookModule {
  static forRoot(options: CatalogWorkbookOptions = {}): DynamicModule {
    return {
      module: CatalogWorkbookModule,
      controllers: [WorkbookController],
      providers: [
        { provide: WORKBOOK_LIMITS, useFactory: () => withLimits(options.limits) },
        { provide: ARCHIVE_INSPECTOR, useFactory: () => new ZipArchiveInspector() },
        { provide: WORKBOOK_READER, useFactory: () => new SheetJsWorkbookReader() },
        { provide: TEMPLATE_WRITER, useFactory: () => new OoxmlTemplateWriter() },
        {
          provide: ValidateWorkbookUseCase,
          useFactory: (
            inspector: ArchiveInspector,
            reader: WorkbookReader,
            limits: WorkbookLimits,
          ) => new ValidateWorkbookUseCase(inspector, reader, limits),
          inject: [ARCHIVE_INSPECTOR, WORKBOOK_READER, WORKBOOK_LIMITS],
        },
        {
          provide: GenerateTemplateUseCase,
          useFactory: (writer: TemplateWriter) => new GenerateTemplateUseCase(writer),
          inject: [TEMPLATE_WRITER],
        },
      ],
      exports: [ValidateWorkbookUseCase, GenerateTemplateUseCase],
    };
  }
}
