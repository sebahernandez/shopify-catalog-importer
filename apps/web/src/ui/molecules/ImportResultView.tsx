import type { ImportResponse } from '@importer/contracts';
import { es } from '../../i18n/es';
import { Notice } from '../atoms/Notice';
import { joinId } from '../ids';

export function ImportResultView({ response }: { readonly response: ImportResponse }) {
  const { totals, results, stoppedEarly } = response;
  const skippedLocal = results.reduce(
    (sum, result) => sum + (result.status === 'created' ? result.imagesSkipped.localFile : 0),
    0,
  );
  const skippedOver = results.reduce(
    (sum, result) => sum + (result.status === 'created' ? result.imagesSkipped.overLimit : 0),
    0,
  );
  const clean = totals.failed === 0 && !stoppedEarly;
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-base font-medium text-gray-900">{es.import.resultHeading}</h3>
      <Notice tone={clean ? 'success' : 'warning'}>
        <p className="font-medium">{clean ? es.import.allCreated : es.import.someFailed}</p>
      </Notice>
      <dl className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-md border border-gray-300 p-3">
          <dt className="text-xs text-gray-600">{es.import.totals.products}</dt>
          <dd className="text-xl font-semibold text-gray-900">{totals.products}</dd>
        </div>
        <div className="rounded-md border border-green-400 p-3">
          <dt className="text-xs text-gray-600">{es.import.totals.created}</dt>
          <dd className="text-xl font-semibold text-green-800">{totals.created}</dd>
        </div>
        <div className="rounded-md border border-red-400 p-3">
          <dt className="text-xs text-gray-600">{es.import.totals.failed}</dt>
          <dd className="text-xl font-semibold text-red-800">{totals.failed}</dd>
        </div>
      </dl>
      {stoppedEarly ? (
        <Notice tone="danger">
          <p>{es.import.stoppedEarly}</p>
        </Notice>
      ) : null}
      {skippedLocal === 0 ? null : (
        <Notice tone="warning">
          <p>{es.import.imagesSkippedLocal(skippedLocal)}</p>
        </Notice>
      )}
      {skippedOver === 0 ? null : (
        <Notice tone="warning">
          <p>{es.import.imagesSkippedOver(skippedOver)}</p>
        </Notice>
      )}
      <Notice tone="info">
        <p>{es.import.draftNote}</p>
        <p>{es.import.repeatWarning}</p>
      </Notice>
      {results.length === 0 ? null : (
        <div className="flex flex-col gap-2">
          <h4 className="text-sm font-medium text-gray-900">{es.import.resultsHeading}</h4>
          <ul className="flex flex-col gap-2">
            {results.map((result) =>
              result.status === 'created' ? (
                <li
                  key={result.productKey}
                  className="flex flex-col gap-1 rounded-md border border-green-400 p-3 text-sm"
                >
                  <p className="font-medium text-green-900">{es.import.created}</p>
                  <p className="text-gray-900">{es.import.productKey(result.productKey)}</p>
                  <p className="text-gray-700">{es.import.productId(result.productId)}</p>
                  <p className="text-gray-700">{es.import.shopifyHandle(result.shopifyHandle)}</p>
                  {result.mediaStatuses.length === 0 ? null : (
                    <p className="text-gray-700">
                      {es.import.media(
                        result.mediaStatuses
                          .map((status) => es.import.mediaStatuses[status])
                          .join(', '),
                      )}
                    </p>
                  )}
                  {result.warnings.length === 0 ? null : (
                    <p className="text-amber-900">
                      {es.import.warnings(result.warnings.join(', '))}
                    </p>
                  )}
                </li>
              ) : (
                <li
                  key={result.productKey}
                  className="flex flex-col gap-1 rounded-md border border-red-400 p-3 text-sm"
                >
                  <p className="font-medium text-red-900">{es.import.failed}</p>
                  <p className="text-gray-900">{es.import.productKey(result.productKey)}</p>
                  <p className="text-gray-700">{es.import.handle(result.handle)}</p>
                  <p className="text-gray-900">{es.import.failures[result.failure.code]}</p>
                  {result.failure.details.length === 0 ? null : (
                    <ul className="list-disc pl-5 text-xs text-gray-700">
                      {result.failure.details.map((detail, index) => (
                        <li key={joinId(detail.field, detail.code, index)}>
                          {es.import.detailEntry(detail.field, detail.code)}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ),
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
