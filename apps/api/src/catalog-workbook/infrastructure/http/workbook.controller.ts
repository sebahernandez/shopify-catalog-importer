import {
  Controller,
  Get,
  Header,
  HttpCode,
  Inject,
  Post,
  Req,
  StreamableFile,
  UseFilters,
} from '@nestjs/common';
import type { ValidationReport } from '@importer/contracts';
import { WORKBOOK_LIMITS } from '../../application/catalog-workbook.tokens.js';
import { GenerateTemplateUseCase } from '../../application/generate-template.use-case.js';
import { ValidateWorkbookUseCase } from '../../application/validate-workbook.use-case.js';
import type { WorkbookLimits } from '../../domain/workbook-limits.js';
import { readBoundedBody, UploadRejection, type BodySource } from './bounded-body-reader.js';
import { WorkbookExceptionFilter } from './workbook-exception.filter.js';

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const UPLOAD_TYPES: ReadonlySet<string> = new Set([XLSX_TYPE, 'application/octet-stream']);

/**
 * The workbook routes, thin adapters over the use cases. `GET template` reads no request input.
 * `POST validate` takes the file as the raw body (design D6) and answers with the report only:
 * the draft stays in the process. Nothing here touches the network, files or a database.
 */
@Controller('workbook')
export class WorkbookController {
  constructor(
    @Inject(GenerateTemplateUseCase) private readonly template: GenerateTemplateUseCase,
    @Inject(ValidateWorkbookUseCase) private readonly validator: ValidateWorkbookUseCase,
    @Inject(WORKBOOK_LIMITS) private readonly limits: WorkbookLimits,
  ) {}

  @Get('template')
  @Header('Cache-Control', 'no-store')
  download(): StreamableFile {
    return new StreamableFile(this.template.execute(), {
      type: XLSX_TYPE,
      disposition: 'attachment; filename="catalog-template.xlsx"',
    });
  }

  @Post('validate')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @UseFilters(WorkbookExceptionFilter)
  async validate(@Req() request: BodySource): Promise<ValidationReport> {
    // A missing type is read as octet-stream (RFC 9110), so an empty request is 400, not 415.
    const type = request.headers['content-type']?.split(';')[0]?.trim().toLowerCase();
    if (type !== undefined && !UPLOAD_TYPES.has(type)) {
      throw new UploadRejection('WORKBOOK_UNSUPPORTED_MEDIA_TYPE', true);
    }
    const { bytes, sha256 } = await readBoundedBody(request, this.limits.maxUploadBytes);
    return (await this.validator.execute(bytes, sha256)).report;
  }
}
