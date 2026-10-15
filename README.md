# Shopify Catalog Importer

Aplicación local para importar un catálogo de productos desde Excel hacia Shopify.

> **Estado: S2, tiendas y pasarela de Shopify.** Esta versión arranca, valida su configuración,
> protege una clave de cifrado, responde en la ruta `GET /health`, muestra una página de estado,
> registra tiendas con sus credenciales cifradas (`/api/stores`) y puede verificar una tienda con
> consultas de solo lectura a la API de administración de Shopify. **Todavía no importa catálogos y
> no lee archivos Excel. Nada se verificó contra una tienda real de Shopify** (vea
> [Qué se verificó y qué no](#qué-se-verificó-y-qué-no)).

## Requisitos

| Requisito | Detalle                                                                                                                             |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Node 24   | Fijado en `.node-version`. Con fnm: `fnm install 24 && fnm use 24`.                                                                 |
| pnpm      | Versión 12.11.2, fijada en `packageManager`. Se obtiene con `corepack enable` (viene con Node).                                     |
| SQLite    | `better-sqlite3` es un módulo nativo. Se usa un binario precompilado si existe; si no, hace falta una cadena de compilación de C++. |
| Red       | La instalación descarga paquetes y el motor de migraciones de Prisma.                                                               |

pnpm 12 bloquea los scripts de instalación de las dependencias. `pnpm-workspace.yaml` aprueba solo
los necesarios: `better-sqlite3` y `@prisma/engines`.

Verificado únicamente en macOS con Apple Silicon. No se probó en Linux ni en Windows.

## Inicio rápido

Desde la raíz del repositorio, en este orden:

```sh
pnpm install --frozen-lockfile
cp env.example .env        # opcional: los valores por defecto ya funcionan
pnpm db:migrate
pnpm dev
```

Con `pnpm dev` en marcha, en otra terminal:

```sh
curl --fail -sS -i http://127.0.0.1:3000/health
```

Respuesta esperada: `HTTP/1.1 200 OK` y un cuerpo como
`{"status":"ok","database":"up","shopifyApiVersion":"2026-10"}`.

Después abra <http://127.0.0.1:5173>. La página muestra el estado de la API en español.

Para detener todo, pulse `Ctrl+C` en la terminal de `pnpm dev`.

## Primer arranque

- La carpeta de datos (`./data` por defecto) se crea con permisos solo para el propietario (0700) y
  el archivo `importer.db` con 0600. Lo hace `pnpm db:migrate` o, si no, el arranque de la API.
- Si no existe el archivo de clave, la API genera uno nuevo y escribe en el registro un aviso único:
  haga una copia de seguridad ahora (vea [Clave de cifrado](#clave-de-cifrado)).
- La API no aplica migraciones al arrancar. Si la base de datos no está migrada, se detiene con un
  error que lo indica: ejecute `pnpm db:migrate`.

## Variables de entorno

Se leen del entorno real y del archivo `.env` de la raíz (copia de `env.example`). Si una variable
está en ambos, **gana el entorno real**.

| Variable                 | Por defecto                                   | Regla                                                                 |
| ------------------------ | --------------------------------------------- | --------------------------------------------------------------------- |
| `NODE_ENV`               | `development`                                 | `development`, `test` o `production`.                                 |
| `API_HOST`               | `127.0.0.1`                                   | Dirección o nombre válido. Fuera de loopback exige la opción.         |
| `API_PORT`               | `3000`                                        | Entero de 1 a 65535, sin signo ni ceros a la izquierda.               |
| `WEB_HOST`               | `127.0.0.1`                                   | Igual que `API_HOST`.                                                 |
| `WEB_PORT`               | `5173`                                        | Igual que `API_PORT`.                                                 |
| `ALLOW_NON_LOOPBACK`     | `false`                                       | Exactamente `true` o `false`. Cualquier otro valor es error.          |
| `ALLOWED_ORIGINS`        | `http://127.0.0.1:5173,http://localhost:5173` | Orígenes exactos, separados por coma. Sin comodines ni rutas.         |
| `SHOPIFY_API_VERSION`    | `2026-10`                                     | Año, guion y mes `01`, `04`, `07` o `10`. Única fuente de la versión. |
| `DATA_DIR`               | `./data`                                      | Ruta no vacía. Las relativas parten de la raíz del repositorio.       |
| `SECRET_KEY_FILE`        | `~/.shopify-catalog-importer/secret.key`      | Ruta del archivo de clave. `~` es su carpeta personal.                |
| `SQLITE_BUSY_TIMEOUT_MS` | `5000`                                        | Entero positivo.                                                      |
| `LOG_LEVEL`              | `info`                                        | `error`, `warn`, `info` o `debug`.                                    |

El valor por defecto de `ALLOWED_ORIGINS` se deriva de `WEB_PORT`.

Reglas generales:

- Un valor **vacío es un error**, no "sin definir". Para usar el valor por defecto, borre la línea.
- Las variables desconocidas se **ignoran**: un nombre mal escrito toma el valor por defecto sin
  avisar. Solo en el archivo `.env`, un nombre casi igual a uno válido genera un aviso en el
  registro.
- Un error de configuración nombra las variables y el motivo, nunca los valores.

### Cuidado: Vite no lee `.env`

El servidor de desarrollo de la web (Vite) lee **solo el entorno real**, no el archivo `.env`.
`WEB_HOST`, `WEB_PORT`, `API_HOST`, `API_PORT` y `ALLOW_NON_LOOPBACK` escritos en el archivo llegan a
la API pero no a Vite. Si no coinciden, las listas de `Host` y `Origin` que la API deriva de su
configuración rechazan la página. Forma segura: definirlas en el entorno de la terminal, para ambos
procesos:

```sh
WEB_PORT=5200 pnpm dev
```

## Clave de cifrado

La clave vive **fuera de la base de datos**, en un archivo. Por defecto es
`~/.shopify-catalog-importer/secret.key` (carpeta oculta en su carpeta personal). Cámbiela con
`SECRET_KEY_FILE`.

> **Atención: si pierde la clave, los secretos cifrados son irrecuperables.** Desde S2 esos
> secretos son las **credenciales reales de sus tiendas de Shopify** (tokens de acceso y secretos de
> cliente). No existe forma de descifrarlos sin la clave. Haga una copia de seguridad del archivo en un lugar privado (por ejemplo,
> un gestor de contraseñas o un volumen cifrado). Quien tenga la clave y la base de datos puede leer
> los secretos: guarde la copia con el mismo cuidado.

- **Formato:** texto, una clave por línea: un identificador, dos puntos y 32 bytes en base64
  (`k1:...`). La última línea es la clave activa.
- **Permisos:** el archivo y su carpeta deben ser solo del propietario (sin bits de grupo ni otros).
  La aplicación se niega a usar permisos más abiertos y explica cómo corregirlos (`chmod 700` en la
  carpeta, `chmod 600` en el archivo).
- **Git:** la regla `*.key` de `.gitignore` lo excluye. Nunca lo añada al repositorio.
- **Pérdida:** si la base de datos ya contiene el registro de comprobación de la clave y el archivo
  no existe, la aplicación **se detiene con un error** y no genera una clave nueva.
- **Clave equivocada:** si el archivo no corresponde a esa base de datos, también se detiene.
- **Alcance:** no hay herramienta de rotación de claves. La base contiene el registro de
  comprobación de la clave y, por cada tienda, un sobre cifrado con sus credenciales reales
  (empieza por `sb1.`). Perder la clave significa volver a introducir las credenciales de cada
  tienda.

## Seguridad local

Por defecto, la API escucha solo en loopback (`127.0.0.1`).

- `ALLOW_NON_LOOPBACK=true` permite otro `API_HOST` (por ejemplo `0.0.0.0`) y registra un aviso
  `non_loopback_bind`. La lista de `Host` aceptados se deriva de la configuración, así que
  `ALLOWED_ORIGINS` debe nombrar el origen que usará; si no, **toda petición se rechaza con 403**.
- **No exponga esta aplicación a Internet.** Eso exigiría autenticación y más medidas de seguridad
  que esta versión no tiene.

| Regla  | Qué se comprueba                                                    | Si falla                                   |
| ------ | ------------------------------------------------------------------- | ------------------------------------------ |
| Host   | Debe estar en la lista derivada de la configuración (todo método).  | 403                                        |
| Origin | En métodos de escritura, si viene, debe estar en `ALLOWED_ORIGINS`. | 403                                        |
| CORS   | Solo los orígenes de la lista; sin comodín ni credenciales.         | sin cabecera `Access-Control-Allow-Origin` |

Las lecturas (`GET`, `HEAD`, `OPTIONS`) no se ven afectadas por la regla de `Origin`.

**Escrituras sin cabecera `Origin`.** Se permiten, salvo que `Sec-Fetch-Site` valga `cross-site` o
`same-site` (o cualquier valor distinto de ausente, `same-origin` o `none`). Motivo: los clientes
locales que no son navegadores (`curl`, scripts) no envían `Origin`. Esto **no es autenticación**:
cualquier proceso local puede omitir ambas cabeceras. El riesgo residual es un navegador antiguo que
no envíe ninguna de las dos en una escritura entre sitios. Las reglas solo actúan sobre rutas que
existen.

## Comandos de desarrollo

| Comando             | Qué hace                                                                    |
| ------------------- | --------------------------------------------------------------------------- |
| `pnpm dev`          | Compila contratos y arranca en paralelo contratos (vigilancia), API y Vite. |
| `pnpm build`        | Compila contratos, API (`apps/api/dist`) y web (`apps/web/dist`).           |
| `pnpm check`        | `typecheck`, `lint`, `format:check` y `test`, en ese orden.                 |
| `pnpm typecheck`    | Comprueba tipos en todos los paquetes.                                      |
| `pnpm lint`         | ESLint sobre todo el repositorio.                                           |
| `pnpm format:check` | Comprueba el formato con Prettier. `pnpm format` lo aplica.                 |
| `pnpm test`         | Vitest en todos los paquetes.                                               |
| `pnpm db:generate`  | Genera el cliente de Prisma (`apps/api/src/generated`).                     |
| `pnpm db:migrate`   | Aplica las migraciones pendientes (`prisma migrate deploy`).                |

`pnpm dev`, `build`, `typecheck`, `test` y `lint` generan el cliente de Prisma por sí solos, por lo
que en un clon nuevo basta con el orden del inicio rápido. Para ejecutar la API compilada:
`pnpm build` y luego `node apps/api/dist/main.js` desde la raíz.

## Estructura

```text
apps/api            API NestJS (configuración, seguridad local, clave, persistencia, /health)
apps/api/src/stores Módulo de tiendas: registro, credenciales cifradas, pasarela de Shopify
                    (cliente HTTP y simulador), verificación y rutas /api/stores
apps/web            Página de estado (React, Vite, Tailwind). Depende solo de packages/contracts
packages/contracts  Esquemas compartidos (zod): respuesta de /health, errores, Money
openspec            Artefactos de planificación del proceso SDD
env.example         Ejemplo de configuración sin secretos
```

Ignorados por Git: `node_modules`, `dist`, `data/`, `.env` y `.env.*`, `*.key`,
`apps/api/src/generated/`.

## Códigos de salida

| Código | Significado                                                                             |
| ------ | --------------------------------------------------------------------------------------- |
| `1`    | Error de arranque conocido: configuración, clave, base de datos o dirección de escucha. |
| `70`   | Error inesperado.                                                                       |

En ambos casos se imprime **una línea** en `stderr`. Con `1` contiene nombres y motivos, nunca
valores (`Startup failed: ConfigError INVALID_CONFIG: ...`). Con `70` contiene solo el nombre de la
clase del error (`Startup failed: unexpected error (...)`).

## Limitaciones conocidas

- Vite no lee `.env` (vea arriba).
- `GET /health` comprueba conectividad e identidad del archivo de base de datos. No detecta una
  tabla eliminada.
- Dos **primeros** arranques simultáneos sin archivo de clave: el que pierde se aborta. Reinicie.
  Nunca se sobrescribe una clave.
- Con `NODE_ENV=development` exportado, `pnpm build` produce un paquete web de desarrollo.
- `localhost` se acepta como loopback por su nombre; la dirección realmente enlazada se verifica
  después de escuchar.
- Las comprobaciones de permisos de archivos no se aplican en Windows.
- La página solo funciona con la ruta de salud en el mismo origen. En desarrollo lo da el proxy de
  Vite; el despliegue de la web en producción aún no está diseñado.
- Un error inesperado al arrancar imprime solo el nombre de su clase.
- La guarda de seguridad actúa solo en rutas existentes.
- Prisma está en 7.10 (la 8 es candidata a versión) y TypeScript en 6.0.3, porque typescript-eslint
  lo exige.
- No hay integración continua configurada.
- Las pruebas que abren sockets usan solo loopback y pueden fallar en entornos aislados que los
  prohíban.
- **La API local no tiene autenticación.** Cualquier proceso de su máquina puede crear, reemplazar
  o borrar las credenciales de las tiendas mediante `/api/stores`: solo se aplican las guardas de
  `Host` y `Origin`, que no son autenticación. Este riesgo residual no está resuelto.
- El conjunto de valores secretos que el registro oculta **crece durante la vida del proceso**: no
  se puede quitar un valor, así que un token de una tienda borrada o reemplazada sigue ocultándose
  hasta el siguiente arranque, y el costo de ocultar crece con ese conjunto.
- La verificación de una tienda envía solicitudes reales a `https://<tienda>.myshopify.com`.
  Ninguna prueba ni comando de verificación del repositorio lo hizo.

## Qué se verificó y qué no

- Pruebas automatizadas (API, web y contratos) y un arranque desde un clon limpio siguiendo este
  documento, en macOS con Apple Silicon.
- Un proceso automático **no** abrió la página en un navegador real.
- **Nada se verificó contra una tienda real de Shopify.** Todo el comportamiento de la pasarela se
  probó con un simulador y con respuestas escritas a mano a partir de la documentación (cada
  ejemplo está etiquetado `hand-authored-from-documentation`; ninguno es una grabación real).
- Lo que **no** se verificó y queda como suposición hasta una prueba contra una tienda real:
  - el límite de ritmo (throttling), tanto el estado 429 como el error `THROTTLED` dentro de una
    respuesta 200, y los valores de coste;
  - la forma exacta del acceso denegado (`ACCESS_DENIED`) y de la falta de permisos;
  - la respuesta ante un token inválido o revocado;
  - el avance de versión (version fall-forward) y la cabecera `X-Shopify-API-Version`;
  - los errores del intercambio de credenciales de cliente (client credentials), incluido
    `shop_not_permitted`;
  - las cadenas exactas de los permisos concedidos (granted scopes);
  - los valores del plan de la tienda (`publicDisplayName` y similares);
  - los límites de `locations` (tamaño de página, permiso necesario);
  - las redirecciones por cambio de nombre de una tienda (se rechazan sin seguirlas).
- Una **prueba de humo en vivo** contra una tienda de desarrollo está prevista para una etapa
  posterior; hasta entonces trate la verificación de una tienda como no comprobada.
