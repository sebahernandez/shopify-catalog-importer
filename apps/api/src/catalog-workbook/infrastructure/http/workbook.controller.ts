import { Controller, Get, Header, Inject, StreamableFile } from '@nestjs/common';
import { GenerateTemplateUseCase } from '../../application/generate-template.use-case.js';

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * `GET /api/workbook/template`: a thin adapter over the template use case. It reads no request
 * input, touches no network and writes nothing; the validation route arrives with U10.
 */
@Controller('workbook')
export class WorkbookController {
  constructor(
    @Inject(GenerateTemplateUseCase) private readonly template: GenerateTemplateUseCase,
  ) {}

  @Get('template')
  @Header('Cache-Control', 'no-store')
  download(): StreamableFile {
    return new StreamableFile(this.template.execute(), {
      type: XLSX_TYPE,
      disposition: 'attachment; filename="catalog-template.xlsx"',
    });
  }
}
