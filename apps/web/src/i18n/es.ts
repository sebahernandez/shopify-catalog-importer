import type {
  ApiError,
  AuthKind,
  ImportFailureCode,
  ImportMediaStatus,
  StoreStatus,
  VerificationProblem,
} from '@importer/contracts';
import type { HealthState } from '../health-state';

// Every user-visible string of the web package lives here, in neutral Spanish. Components import
// this catalog and never carry copy of their own. The product name is not translated.
export const es = {
  product: 'Shopify Catalog Importer',
  health: {
    heading: 'Estado de la API',
    states: {
      loading: 'Comprobando el estado de la API…',
      ok: 'La API y la base de datos están operativas',
      degraded: 'La API responde, pero la base de datos no está disponible',
      unreachable: 'No se pudo conectar con la API',
    } satisfies Record<HealthState, string>,
    version: (version: string): string => `Versión de la API de Shopify: ${version}`,
  },
  wizard: {
    intro: 'Importa un catálogo desde un libro de Excel a tu tienda de Shopify en tres pasos.',
    steps: {
      store: 'Tienda',
      file: 'Archivo',
      import: 'Importar',
    },
    stepLabel: (number: number, name: string): string => `Paso ${number}: ${name}`,
    locked: {
      file: 'Elige una tienda conectada para continuar con el archivo.',
      import: 'Valida un archivo sin errores para poder importar.',
    },
  },
  common: {
    retry: 'Reintentar',
  },
  stores: {
    heading: 'Tienda de destino',
    listHeading: 'Tiendas guardadas',
    loading: 'Cargando tiendas…',
    empty: 'Todavía no hay tiendas guardadas. Agrega una abajo.',
    select: 'Usar esta tienda',
    selected: 'Tienda elegida',
    selectedName: (name: string): string => `Tienda elegida: ${name}`,
    domain: (domain: string): string => `Dominio: ${domain}`,
    statuses: {
      UNVERIFIED: 'Sin verificar',
      CONNECTED: 'Conectada',
      AUTH_FAILED: 'Credenciales rechazadas',
      SCOPE_MISSING: 'Faltan permisos',
      UNAVAILABLE: 'No disponible',
    } satisfies Record<StoreStatus, string>,
    createHeading: 'Agregar una tienda',
    displayName: 'Nombre de la tienda',
    domainLabel: 'Dominio de Shopify',
    domainHint: 'Debe terminar en .myshopify.com, por ejemplo mi-tienda.myshopify.com',
    authKindLabel: 'Tipo de credenciales',
    authKinds: {
      static_token: 'Token de acceso',
      client_credentials: 'ID y secreto de cliente',
    } satisfies Record<AuthKind, string>,
    accessToken: 'Token de acceso de Admin API',
    clientId: 'ID de cliente',
    clientSecret: 'Secreto de cliente',
    secretHint: 'Se guarda cifrado y nunca se vuelve a mostrar.',
    create: 'Guardar tienda',
    creating: 'Guardando…',
    created: 'La tienda se guardó. Ahora verifica la conexión.',
    replaceHeading: 'Reemplazar credenciales',
    replace: 'Reemplazar credenciales',
    replacing: 'Reemplazando…',
    replaced: 'Las credenciales se reemplazaron. Verifica la conexión de nuevo.',
    listFailed: 'No se pudo cargar la lista de tiendas.',
  },
  verification: {
    heading: 'Conexión con Shopify',
    notConnected: 'Esta tienda todavía no está conectada. Verifica la conexión antes de continuar.',
    connected: 'La tienda está conectada y lista para importar.',
    verify: 'Verificar conexión',
    verifyAgain: 'Verificar de nuevo',
    verifying: 'Verificando la conexión…',
    outcomeOk: 'Conexión verificada: la tienda está conectada.',
    outcomeFailed: 'La verificación encontró problemas:',
    shop: (name: string): string => `Tienda de Shopify: ${name}`,
    missingScopes: 'Permisos que faltan en la app de Shopify:',
    missingScopesHint:
      'Agrega esos permisos a la app, reinstálala en la tienda y vuelve a verificar.',
    problems: {
      AUTH_FAILED:
        'Shopify rechazó las credenciales. Revisa el token o reemplaza las credenciales.',
      SCOPE_MISSING: 'La app no tiene todos los permisos necesarios.',
      SHOP_UNAVAILABLE: 'La tienda no está disponible en este momento.',
      STORE_NOT_FOUND: 'Shopify no encontró una tienda con ese dominio.',
      THROTTLED: 'Shopify limitó las solicitudes. Espera un momento y reintenta.',
      QUERY_TOO_COSTLY: 'Shopify rechazó la consulta por ser demasiado costosa.',
      SERVER_ERROR: 'Shopify respondió con un error del servidor. Reintenta más tarde.',
      VERSION_UNSUPPORTED: 'La versión de la API de Shopify no está disponible para esta tienda.',
      NETWORK: 'No se pudo llegar a Shopify. Revisa tu conexión y reintenta.',
      TIMEOUT: 'Shopify tardó demasiado en responder. Reintenta.',
      INVALID_RESPONSE: 'Shopify devolvió una respuesta que no se pudo interpretar.',
      GRAPHQL_ERROR: 'Shopify devolvió un error al procesar la consulta.',
      CREDENTIAL_EXCHANGE_FAILED:
        'Shopify no aceptó el ID y el secreto de cliente. Revisa los datos o reemplaza las credenciales.',
      API_VERSION_MISMATCH: 'La versión de la API de Shopify no coincide con la configurada.',
      CREDENTIALS_UNREADABLE:
        'No se pudieron leer las credenciales guardadas. Reemplázalas e inténtalo de nuevo.',
    } satisfies Record<VerificationProblem['code'], string>,
  },
  file: {
    heading: 'Archivo de catálogo',
    intro: 'Sube un libro .xlsx con las hojas de la plantilla.',
    template: 'Descargar plantilla',
    templating: 'Descargando…',
    templateFailed: 'No se pudo descargar la plantilla.',
    choose: 'Archivo de Excel (.xlsx)',
    chosen: (name: string, kilobytes: number): string => `${name} (${kilobytes} KB)`,
    validating: 'Validando el archivo…',
    revalidate: 'Validar de nuevo',
    reportHeading: 'Resultado de la validación',
    valid: 'El archivo es válido. Puedes continuar con la importación.',
    validWithWarnings: 'El archivo es válido, pero tiene advertencias que conviene revisar.',
    invalid: 'El archivo tiene errores. Corrígelos y súbelo de nuevo para poder importar.',
    errorCount: (count: number): string => (count === 1 ? '1 error' : `${count} errores`),
    warningCount: (count: number): string =>
      count === 1 ? '1 advertencia' : `${count} advertencias`,
    counts: (errors: number, warnings: number): string =>
      `${es.file.errorCount(errors)} · ${es.file.warningCount(warnings)}`,
    truncated: 'La lista está incompleta: solo se muestran los primeros problemas.',
    issuesHeading: 'Problemas encontrados',
    severity: { error: 'Error', warning: 'Advertencia' },
    location: (sheet: string | null, row: number | null, field: string | null): string => {
      const parts = [
        sheet === null ? null : `Hoja ${sheet}`,
        row === null ? null : `fila ${row}`,
        field === null ? null : `columna ${field}`,
      ].filter((part): part is string => part !== null);
      return parts.length === 0 ? 'Archivo completo' : parts.join(', ');
    },
    suggestion: (text: string): string => `Qué hacer: ${text}`,
  },
  import: {
    heading: 'Importar productos',
    ready: (store: string): string => `Se importará el catálogo a ${store}.`,
    draftNote:
      'Los productos se crean como borrador (DRAFT) en Shopify. Publícalos desde el administrador de Shopify cuando estén listos.',
    repeatWarning:
      'Esta importación no es idempotente: si vuelves a importar el mismo archivo, los handles que ya existan se informarán como ya usados.',
    start: 'Importar',
    running: 'Importando, no cierres la ventana',
    runningDetail:
      'La importación es una sola solicitud y puede tardar varios minutos según la cantidad de productos.',
    cancel: 'Cancelar la espera',
    cancelWarning:
      'Si cancelas, la importación puede seguir en el servidor: revisa Shopify antes de volver a importar.',
    resultHeading: 'Resultado de la importación',
    totals: {
      products: 'Productos',
      created: 'Creados',
      failed: 'Fallidos',
    },
    allCreated: 'Todos los productos se crearon como borrador.',
    someFailed: 'Algunos productos no se pudieron crear.',
    stoppedEarly:
      'La importación se detuvo antes de terminar por un error que afecta a todos los productos. Los productos pendientes no se enviaron.',
    imagesSkippedLocal: (count: number): string =>
      count === 1
        ? 'Imágenes de archivo local no se importan: 1 imagen se omitió.'
        : `Imágenes de archivo local no se importan: ${count} imágenes se omitieron.`,
    imagesSkippedOver: (count: number): string =>
      `${count} imágenes superan el máximo de Shopify y se omitieron.`,
    resultsHeading: 'Detalle por producto',
    created: 'Creado',
    failed: 'Falló',
    handle: (handle: string): string => `Handle: ${handle}`,
    productId: (id: string): string => `ID en Shopify: ${id}`,
    shopifyHandle: (handle: string): string => `Handle en Shopify: ${handle}`,
    productKey: (key: string): string => `Clave: ${key}`,
    warnings: (codes: string): string => `Avisos de Shopify: ${codes}`,
    detailEntry: (field: string | null, code: string | null): string =>
      [field, code].filter((part): part is string => part !== null).join(': '),
    mediaStatuses: {
      UPLOADED: 'subida',
      PROCESSING: 'procesando',
      READY: 'lista',
      FAILED: 'fallida',
      UNKNOWN: 'desconocida',
    } satisfies Record<ImportMediaStatus, string>,
    media: (statuses: string): string => `Imágenes: ${statuses}`,
    importAnother: 'Importar otro archivo',
    failures: {
      SHOPIFY_REJECTED: 'Shopify rechazó el producto por datos no válidos.',
      HANDLE_TAKEN: 'El handle ya lo usa otro producto de la tienda.',
      LOCATION_NOT_FOUND:
        'Una variante usa una ubicación que no es una ubicación activa de la tienda.',
      LOCATION_AMBIGUOUS:
        'Una variante usa un nombre de ubicación que coincide con más de una ubicación activa.',
      LOCATION_REQUIRED:
        'Una variante no indica ubicación y la tienda no tiene exactamente una ubicación activa.',
      TOO_MANY_VARIANTS: 'El producto tiene más variantes de las que Shopify permite.',
      PRODUCT_INVALID: 'El producto no se pudo armar con los datos del archivo.',
      SHOPIFY_ERROR: 'Shopify respondió con un error y el producto no se creó.',
      STORE_ACCESS_FAILED:
        'Shopify rechazó las credenciales, los permisos o la tienda, y el producto no se creó.',
      THROTTLED: 'Shopify limitó las solicitudes y el producto no se creó. Reintenta más tarde.',
      OUTCOME_UNKNOWN:
        'No se pudo leer la respuesta de Shopify: el producto puede existir o no. Revísalo en Shopify antes de reintentar.',
      NOT_ATTEMPTED: 'No se envió: la importación se detuvo antes de llegar a este producto.',
    } satisfies Record<ImportFailureCode, string>,
  },
  errors: {
    api: {
      HOST_NOT_ALLOWED: 'La API rechazó la solicitud porque el servidor no está permitido.',
      ORIGIN_NOT_ALLOWED:
        'La API rechazó la solicitud porque el origen de la página no está permitido.',
      WORKBOOK_FILE_REQUIRED: 'No se recibió ningún archivo. Elige un archivo .xlsx.',
      WORKBOOK_TOO_LARGE: 'El archivo es demasiado grande. Reduce su tamaño y vuelve a intentarlo.',
      WORKBOOK_UNSUPPORTED_MEDIA_TYPE: 'El tipo de archivo no es compatible. Sube un libro .xlsx.',
      STORE_NOT_FOUND: 'La tienda ya no existe. Actualiza la lista y elige otra.',
      STORE_DOMAIN_INVALID: 'El dominio no es válido. Usa el dominio .myshopify.com de la tienda.',
      STORE_ALREADY_EXISTS: 'Ya hay una tienda guardada con ese dominio.',
      STORE_CREDENTIALS_INVALID: 'Las credenciales no son válidas. Revisa los datos ingresados.',
      STORE_REQUEST_INVALID: 'Los datos enviados no son válidos. Revisa el formulario.',
      STORE_NOT_CONNECTED: 'La tienda no está conectada. Verifica la conexión antes de importar.',
      WORKBOOK_INVALID: 'El archivo tiene errores. No se envió nada a Shopify.',
      SHOPIFY_REQUEST_FAILED: 'No se pudo llegar a Shopify. No se creó nada.',
    } satisfies Record<ApiError['error']['code'], string>,
    unexpected:
      'La API respondió algo inesperado. Reintenta; si persiste, revisa los registros del servidor.',
    invalidResponse: 'La respuesta de la API no tiene el formato esperado.',
    network: 'No se pudo conectar con la API. Revisa que esté en ejecución y reintenta.',
    timeout: 'La API tardó demasiado en responder.',
    aborted: 'La solicitud se canceló.',
    importUnknown:
      'No se pudo confirmar el resultado de la importación. Es posible que algunos productos sí se hayan creado: revisa Shopify antes de volver a importar.',
  },
};
