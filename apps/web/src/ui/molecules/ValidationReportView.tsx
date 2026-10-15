import { renderIssue, type ValidationReport } from '@importer/contracts';
import { es } from '../../i18n/es';
import { Notice, type NoticeTone } from '../atoms/Notice';
import { joinId } from '../ids';

function verdict(report: ValidationReport): { tone: NoticeTone; text: string } {
  if (!report.valid) return { tone: 'danger', text: es.file.invalid };
  return report.summary.warningCount > 0
    ? { tone: 'warning', text: es.file.validWithWarnings }
    : { tone: 'success', text: es.file.valid };
}

const SEVERITY_CLASSES: Record<'error' | 'warning', string> = {
  error: 'text-xs font-semibold uppercase text-red-800',
  warning: 'text-xs font-semibold uppercase text-amber-900',
};

export function ValidationReportView({ report }: { readonly report: ValidationReport }) {
  const { tone, text } = verdict(report);
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-base font-medium text-gray-900">{es.file.reportHeading}</h3>
      <Notice tone={tone}>
        <p className="font-medium">{text}</p>
        <p>{es.file.counts(report.summary.errorCount, report.summary.warningCount)}</p>
      </Notice>
      {report.truncated ? (
        <Notice tone="warning">
          <p>{es.file.truncated}</p>
        </Notice>
      ) : null}
      {report.issues.length === 0 ? null : (
        <div className="flex flex-col gap-2">
          <h4 className="text-sm font-medium text-gray-900">{es.file.issuesHeading}</h4>
          <ol className="flex flex-col gap-2">
            {report.issues.map((issue, index) => {
              const { message, suggestedAction } = renderIssue(issue.code, issue.params);
              return (
                <li
                  key={joinId(issue.code, issue.sheet, issue.row, index)}
                  className="flex flex-col gap-1 rounded-md border border-gray-300 p-3 text-sm"
                >
                  <p className="flex flex-wrap items-baseline gap-2">
                    <span className={SEVERITY_CLASSES[issue.severity]}>
                      {es.file.severity[issue.severity]}
                    </span>
                    <span className="text-xs text-gray-700">
                      {es.file.location(issue.sheet, issue.row, issue.field)}
                    </span>
                  </p>
                  <p className="text-gray-900">{message}</p>
                  <p className="text-gray-700">{es.file.suggestion(suggestedAction)}</p>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
