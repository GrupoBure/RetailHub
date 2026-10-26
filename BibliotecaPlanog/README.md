# Biblioteca de documentos Retail Hub

Frontend: https://grupobure.github.io/RetailHub/BibliotecaPlanog/

GitHub Pages aloja la interfaz pública. Los PDF permanecen en Dropbox, dentro de la carpeta de la aplicación. Supabase Auth valida usuarios y el servidor consulta el catálogo privado. No hay PDF ni credenciales en este repositorio.

## Estado

El servidor y la interfaz están preparados y sus controles fueron probados con servicios simulados. La activación real sigue pendiente del despliegue, los secretos de Dropbox y una prueba completa. `config.js` mantiene `apiBase` vacío hasta entonces. Los ejemplos de diseño no dan acceso a documentos reales.

## Activación en Supabase

1. Ejecutar `database/setup.sql` y después `database/002-tiendas.sql` en un proyecto dedicado. Las tablas usan RLS sin políticas públicas; solo el servidor accede con permisos de servicio.
2. Crear el primer administrador según las instrucciones del SQL. Desactivar el registro público en Authentication → Sign In / Providers. El inicio de sesión usa un nombre de usuario; los correos internos `.invalid` no sirven para recuperar contraseña por email. Un administrador reasigna contraseñas.
3. Crear una Edge Function llamada exactamente `retailhub-api`. Reemplazar todo el contenido de su `index.ts` con `server/retailhub-api.ts` y desplegar. Es un archivo independiente sin imports de Next.js, Cloudflare ni librerías externas.
4. En los ajustes de esa función, desactivar **Verify JWT** del gateway. Esto permite el login y el callback de Dropbox. Las rutas privadas siguen verificando cada sesión contra Supabase Auth y comprobando `rh_portal`, `disabled`, el rol y las tiendas asignadas. El archivo `server/config.toml` contiene el ajuste equivalente para CLI.
5. Supabase inyecta sus propias claves al servidor. El código admite las claves legacy y los diccionarios de claves nuevos. No copiar claves de servicio en `config.js`, GitHub o el navegador.
6. En Edge Functions → Secrets guardar `DROPBOX_APP_KEY` y `DROPBOX_APP_SECRET`. Opcional: `RH_ENCRYPTION_SECRET`, secreto aleatorio de al menos 32 caracteres. Si se omite, se deriva el cifrado de la clave privada inyectada de Supabase. Rotar esa clave requiere volver a autorizar Dropbox; los tickets previos dejan de funcionar.
7. La aplicación Dropbox debe usar Scoped API / App folder y permisos `files.metadata.read`, `files.content.read`, `files.content.write`. Añadir como OAuth redirect URI: `https://TU-PROYECTO.supabase.co/functions/v1/retailhub-api/dropbox/callback`.
8. Crear dentro de la carpeta Dropbox de la aplicación la ruta `Retail Hub/Portal`. Cada carpeta directamente dentro de Portal representa una tienda. Las secciones fijas son planogramas (PDF) y listados (Excel XLSX o XLS). Solo se catalogan archivos con formato y sección coincidentes. El nombre de la carpeta de la app puede aparecer traducido en Dropbox.
9. Comprobar la URL `https://TU-PROYECTO.supabase.co/functions/v1/retailhub-api/status`; debe devolver `auth:true`. Configurar `window.RH_CONFIG = { apiBase: "https://TU-PROYECTO.supabase.co/functions/v1/retailhub-api" };` en `config.js`. Publicar el cambio en GitHub y comprobar CORS desde la página real.
10. Iniciar sesión con el administrador, abrir Conexiones → Conectar Dropbox, autorizar y sincronizar. Probar subir un PDF, consultarlo, imprimirlo y descargarlo. Crear un lector de prueba y comprobar que no puede administrar, ver PDF ocultos ni acceder después de ser desactivado. No considerar la activación terminada antes de esta prueba real.

## Sesiones y archivos

El navegador conserva la sesión de usuario en `sessionStorage` para esa pestaña. No usa cookies de terceros. La clave de servicio y los secretos de Dropbox permanecen en el servidor. La autorización de Dropbox usa un estado cifrado, con vencimiento y consumo único. El refresh token de Dropbox se guarda cifrado en `rh_settings`.

El visor y las descargas usan tickets aleatorios de 15 minutos; se guarda únicamente su hash. Cada acceso vuelve a comprobar el usuario, su permiso para la tienda, el estado de la tienda, la publicación del documento y la ubicación actual del archivo en Dropbox. Quien posea el enlace puede abrirlo durante su vigencia; una vez descargado el archivo, la copia queda bajo responsabilidad del usuario. El servidor transmite el archivo desde Dropbox y admite rangos de bytes sin cargar el PDF completo en memoria.

**Almacenamiento y transferencia son cuotas diferentes.** Guardar PDF en Dropbox evita ocupar Supabase Storage, pero este servidor transmite los PDF mediante Edge Functions: sus descargas/consultas consumen la transferencia de Supabase, además de las invocaciones. Tener 1 TB disponible en Dropbox no equivale a tener 1 TB de transferencia gratuita en Supabase. Revisar el tráfico esperado y el plan vigente antes de abrir la biblioteca a todo el equipo. Si excede el plan, trasladar la transmisión de archivos a otro servidor y conservar Supabase para usuarios/catálogo.

Subidas en bloques de 8 MiB mediante sesiones de Dropbox. La subida no comprime PDF automáticamente: optimizar antes de subir. Un archivo con el mismo nombre se añade con otro nombre para evitar sobrescrituras accidentales. Para reemplazar conservando la entrada del catálogo, reemplazar el archivo en Dropbox y sincronizar. La sincronización añade y actualiza; no elimina automáticamente del catálogo los archivos borrados de Dropbox. Ocultar en el portal antes de borrar para evitar entradas sin archivo. La interfaz actual consulta hasta el límite de filas configurado en la API Supabase, con un máximo solicitado de 5000; revisar paginación si crece el catálogo.

## Código y comprobaciones

`index.html`, `config.js` y `assets/`: publicación compilada. `source/`: React/Vite editable. `server/`: función y comprobaciones. Para compilar el frontend: instalar dependencias en `source/` y ejecutar `npm run build`. Copiar su `dist/` a la carpeta publicada, conservando la configuración real del servidor.

Desde `source/`, con TypeScript instalado: `node ../server/test-api.mjs`. Las comprobaciones usan dobles de Supabase y Dropbox; no prueban credenciales ni conectividad reales. Cubren acceso anónimo/inhabilitado, privilegios, publicación, tickets vencidos, streaming parcial, OAuth de un solo uso, cifrado del token y ambas clases de claves Supabase.

## Administración de usuarios

Los administradores pueden editar nombre, usuario de ingreso y permisos, activar/desactivar, asignar una contraseña nueva y eliminar una cuenta con confirmación escrita del usuario. El servidor impide eliminar, desactivar o degradar la cuenta propia. La eliminación afecta a Supabase Auth; conserva los PDF y el catálogo. Los lectores no pueden usar estas operaciones.

Las contraseñas actuales no se consultan ni se guardan en texto recuperable. El botón de ojo solo muestra la contraseña nueva mientras se escribe al crear/restablecer una cuenta. Al guardar, se envía únicamente a Supabase Auth y no se devuelve ni se almacena en el catálogo o en el navegador.

Para aplicar esta versión, reemplazar el código de la función existente `retailhub-api` por `server/retailhub-api.ts` y volver a desplegar. Conservar los secretos existentes y Verify JWT desactivado. `GET /status` debe devolver `version: "2026-10-24-stores"`. Hasta entonces la interfaz deshabilita los botones nuevos de editar/eliminar y de tiendas para evitar operaciones contra una versión anterior. Esta versión requiere ejecutar primero `database/002-tiendas.sql`. No requiere volver a autorizar Dropbox.

## Tiendas y permisos

La pantalla principal muestra carpetas de tiendas; no una colección conjunta de PDF. Un lector solo recibe los nombres e identificadores de sus tiendas asignadas. Para consultar documentos debe seleccionar una tienda autorizada. Los administradores ven y gestionan todas. Crear una tienda o sincronizar una nueva carpeta no concede acceso a ningún lector automáticamente.

La correspondencia usa el identificador estable de la carpeta Dropbox, no solo su nombre. Renombrar una tienda y sincronizar conserva su identidad y permisos. Borrar una carpeta y crear otra con el mismo nombre crea una tienda distinta, sin lectores autorizados. Mover un PDF entre tiendas requiere sincronizar; antes de sincronizar, los enlaces anteriores se rechazan porque se verifica la ubicación actual del archivo contra la identidad de la carpeta. Mover una tienda fuera de la carpeta raíz también bloquea sus archivos.

La tabla privada `rh_stores` registra las carpetas. `rh_documents.store_id` asocia cada documento a una tienda. Los identificadores autorizados se guardan en `auth.users.raw_app_meta_data.store_ids` y se validan al crear/editar usuarios. No se leen permisos desde `user_metadata` ni desde claims sin validar del navegador: se consulta el usuario vigente en Auth. Máximo 100 tiendas asignadas por lector para mantener acotado el tamaño de su metadata y tokens. Un lector sin permisos explícitos ve cero tiendas y documentos. El rol administrador da acceso a todas las tiendas.

### Aplicar la actualización de tiendas

1. En SQL Editor ejecutar **todo** `database/002-tiendas.sql`. Es una migración adicional; no reemplazar ni borrar las tablas anteriores. No borra usuarios ni archivos.
2. Reemplazar el código de la función existente `retailhub-api` por el contenido completo de `server/retailhub-api.ts` y volver a desplegar. Conservar los secretos y Verify JWT desactivado. El endpoint `/status` debe mostrar `version: "2026-10-24-stores"`. Las protecciones por tienda solo están activas cuando esta función está desplegada; publicar la interfaz no modifica el servidor anterior.
3. Dentro de la carpeta de Dropbox de la aplicación usar `Retail Hub/Portal/NOMBRE DE TIENDA/`. Cada tienda usa `planogramas` para PDF y `listados` para Excel XLSX o XLS. Los archivos fuera de estas secciones no se muestran. Las carpetas que antes eran categorías directamente bajo Portal serán interpretadas como tiendas si se sincronizan sin reorganizar.
4. Para el PDF de prueba que estaba en `Portal/Planogramas`, crear una carpeta con el nombre de una tienda y mover allí esa carpeta Planogramas. El resultado será `Portal/Tienda de prueba/Planogramas/archivo.pdf`. La aplicación no mueve ni reorganiza los archivos existentes por su cuenta.
5. Actualizar GitHub Pages con Ctrl+F5 y pulsar Sincronizar Dropbox. También se pueden crear tiendas desde la página con **Crear tienda**. Los documentos anteriores sin tienda quedan inaccesibles hasta reorganizar y sincronizar. Los usuarios existentes quedan sin tiendas por defecto; los administradores conservan acceso a todas.
6. En Usuarios → Editar, marcar las **Tiendas autorizadas** de cada lector y guardar. Seleccionar rol Administrador da acceso global; no usarlo para alguien que solo debe ver algunas tiendas.
7. Probar con dos tiendas y dos lectores: cada lector solo ve la suya; no puede listar/abrir/descargar documentos de otra. Quitar una asignación y comprobar que un ticket anterior deja de funcionar. Verificar también editar/eliminar usuarios y cambiar contraseñas.

Los tickets del visor son enlaces de acceso temporal de 15 minutos vinculados al usuario que los generó: quien posea el enlace puede usarlo durante su vigencia mientras ese usuario siga autorizado. Revocar el permiso, ocultar el documento o desactivar la cuenta bloquea solicitudes nuevas. No es posible retirar un PDF que ya fue descargado.

Se comprobaron 48 casos de autorización e integración con servicios simulados, además de compilación y tipos del frontend/servidor. La ejecución del SQL y la prueba con las cuentas reales se hacen durante la activación. La transmisión de PDF sigue consumiendo transferencia de Supabase; dividir por tiendas no cambia esa cuota.

### Corrección de creación de carpetas

El build `store-folder-fix-1` normaliza la respuesta concreta de `files/create_folder_v2`, que devuelve FolderMetadata sin el discriminador `.tag` usado en los listados. Conserva la comprobación de que la carpeta esté inmediatamente bajo Portal. La repetición con el mismo nombre reutiliza la carpeta y la tienda existentes. Incluye pruebas para respuestas sin `.tag`, carpetas ya creadas y nombres con acentos. Solo requiere volver a desplegar la función, sin SQL adicional ni cambios de secretos.

### Eliminar una tienda del portal

El build `store-manage-1` añade un botón administrador **Eliminar del portal** en cada tarjeta de tienda. Exige escribir el nombre exacto de la tienda. Retira la tienda con `enabled=false`; conserva los documentos y las carpetas originales de Dropbox. También bloquea enlaces y subidas para administradores y lectores. Las copias ya descargadas permanecen en poder de sus usuarios.

La sincronización conserva `enabled=false`, y crear una tienda con la misma carpeta devuelve un conflicto: no restablece accesos anteriores automáticamente. Las antiguas referencias en metadata de usuarios no conceden acceso mientras la tienda esté retirada; al editar un usuario la interfaz excluye esas asignaciones inactivas. No requiere más SQL. Volver a desplegar la función y actualizar la página. El endpoint `/status` anuncia `features.deleteStores=true`; el botón se habilita tras detectar esa capacidad. Se comprobaron 48 casos con servicios simulados, incluida la retirada, sus permisos y la no reactivación al sincronizar.

### Editar una tienda

La tarjeta de cada tienda tiene un botón administrador **Editar**. Cambia su nombre tanto en Dropbox como en el catálogo, conservando su UUID, la identidad de la carpeta, los documentos y las asignaciones de usuarios. Se rechazan nombres inválidos y destinos ocupados; no se sobrescribe ni se mezcla otra tienda. El servidor usa el identificador de la carpeta al moverla.

Dropbox no admite renombrar cambiando únicamente mayúsculas/minúsculas en una sola llamada. Para ese caso se usa un nombre intermedio único dentro de Portal y se intenta restaurar el original si falla el segundo movimiento. Si Dropbox acepta un cambio pero falla la actualización de la base, sincronizar permite recuperar el nombre actual mediante la identidad estable de la carpeta.

El build `store-manage-1` anuncia `features.editStores=true` y `features.deleteStores=true`. La interfaz habilita los botones correspondientes solo después de detectar esas capacidades. Aplicar la función y refrescar con Ctrl+F5; no requiere SQL adicional. Las 48 comprobaciones usan servicios simulados; la operación real se prueba después del despliegue.

## Secciones fijas: planogramas y listados

El build `store-sections-1` crea automáticamente **planogramas** y **listados** dentro de cada tienda nueva. Reutiliza carpetas ya existentes, sin duplicarlas ni sobrescribirlas. Al sincronizar también prepara estas carpetas en las tiendas activas existentes. No crea carpetas nuevas dentro de tiendas retiradas. No requiere SQL adicional: se conserva el catálogo actual y su columna category con los valores canónicos Planogramas/Listados.

Estructura: `Retail Hub/Portal/NOMBRE DE TIENDA/planogramas/archivo.pdf` y `Retail Hub/Portal/NOMBRE DE TIENDA/listados/archivo.xlsx` (o `.xls`). Se admiten mayúsculas/minúsculas en el nombre de las secciones y extensiones; las carpetas nuevas se crean en minúsculas. Se pueden organizar archivos en subcarpetas adicionales dentro de una sección. No se publican archivos sueltos en la raíz de la tienda, formatos cruzados (Excel en planogramas o PDF en listados), categorías distintas, CSV, XLSM ni otros formatos. Los archivos existentes no se mueven automáticamente; colocarlos en la sección correcta y sincronizar.

La interfaz muestra exactamente dos secciones, filtra su contenido y limita la selección/carga al formato correspondiente. Los PDF usan el visor existente; los Excel se descargan para abrirlos o imprimirlos en la aplicación de Excel. No se envían a un visor público. Las descargas de Excel usan su MIME real y Content-Disposition attachment incluso al abrir un enlace sin parámetro download.

El servidor valida sección y extensión al catalogar, listar, crear enlaces, descargar y subir. Verifica la ubicación actual en Dropbox antes de abrir un archivo. Las subidas también validan una firma básica PDF, ZIP para XLSX u OLE para XLS; no constituye una validación completa del contenido del libro. Los permisos por tienda, desactivación de cuentas y publicación aplican a ambos tipos de archivo.

Aplicación: volver a desplegar `server/retailhub-api.ts`, conservar secretos/Verify JWT y refrescar GitHub Pages. `/status` debe anunciar `build: "store-sections-1"` y `features.storeSections=true`. Luego sincronizar para crear carpetas en tiendas existentes. La interfaz limita nuevas cargas/creación hasta detectar esta capacidad. Se comprobaron 59 casos con servicios simulados, además de tipos y compilación. La creación y las cargas reales se prueban después del despliegue.

## Eliminar archivos de planogramas y listados

El build `document-delete-1` añade una papelera administrador a cada tarjeta de PDF, XLSX y XLS. El diálogo muestra el nombre del archivo y de la tienda/sección e indica que se borrará del portal y de Dropbox. La confirmación solicita únicamente borrar ese archivo; las carpetas planogramas/listados y las tiendas se conservan. Esta operación difiere de **Eliminar tienda del portal**, que conserva sus archivos en Dropbox.

El servidor verifica el administrador vigente, tienda activa, categoría, nombre confirmado y ubicación actual antes de eliminar. Solo acepta metadatos de tipo file. Usa el identificador del archivo y `parent_rev` de Dropbox para limitar la operación a la versión comprobada y evitar eliminar carpetas. Después retira el registro del catálogo. Los tickets previos quedan sin documento disponible. Si Dropbox falla, no se elimina el registro de la base. Si Dropbox ya eliminó el archivo pero falla la limpieza de la base, repetir la operación completa la limpieza sin borrar otro archivo. No se pueden retirar copias ya descargadas.

El endpoint `/status` anuncia `features.deleteDocuments=true`; la papelera se habilita después de detectarlo. Requiere desplegar el archivo completo `server/retailhub-api.ts` y refrescar la página. No requiere SQL ni cambios en los secretos de Dropbox. Se comprobaron 68 casos con servicios simulados, además de tipos y compilación. Probar después del despliegue con archivos desechables; no se han eliminado archivos reales desde el desarrollo.

## Dashboard editable por tienda · store-dashboard-1

1. En el proyecto existente, ejecutar `database/003-dashboard.sql` en SQL Editor (después de `002-tiendas.sql`). No volver a ejecutar la creación del primer administrador.
2. Reemplazar el archivo completo `index.ts` de la Edge Function `retailhub-api` con `server/retailhub-api.ts` y desplegar. Conservar las conexiones y secretos actuales.
3. Recargar GitHub Pages con Ctrl+F5. `GET /status` debe mostrar `build: store-dashboard-1` y `features.storeDashboard: true`.
4. Abrir **Dashboard**, elegir tienda y pulsar **Iniciar con machote** o **Empezar en blanco**. Iniciar es una acción explícita: ver el dashboard no crea datos. El machote incluye las 8 etapas y 64 actividades de `MachoteChecklist_Diseno_Tienda.xlsx`; cada tienda recibe sus propias copias con IDs nuevos y estados pendientes.

Administradores: crear, renombrar, mover entre etapas, ordenar, eliminar con confirmación y añadir subtareas (hasta 6 niveles / 500 elementos / solicitud máxima 256 KiB). Editar responsable, fecha objetivo y notas; estados Pendiente, En proceso, En revisión, Terminado, Bloqueado y No aplica. Lectores: consultar únicamente las tiendas autorizadas; ninguna escritura, ni mediante solicitudes directas.

Los datos se guardan en `rh_dashboards`, una fila privada por tienda, con RLS y sin acceso directo para anon/authenticated. El servidor revalida usuario y tienda en cada solicitud. No se guardan en el Excel, Dropbox ni en localStorage. La eliminación lógica de la tienda impide acceder a su dashboard. Renombrar la tienda conserva el seguimiento mediante su UUID. El dashboard no modifica ni elimina archivos de la biblioteca.

El avance cuenta **solo actividades finales** (elementos sin hijos), con el mismo peso cada una. `No aplica` se excluye del denominador; no mide horas o dificultad. Sin actividades aplicables se muestra «—». Estados de etapas se calculan con sus descendientes: todo terminado → Terminado; todo no aplicable → No aplica; cualquier bloqueo → Bloqueado; actividad en proceso o parcialmente terminada → En proceso; después En revisión y Pendiente. Al convertir una actividad en contenedor su estado guardado vuelve a Pendiente para que quitar sus hijos no restaure un Terminado antiguo.

El guardado usa una revisión entera y actualización condicional. Dos administradores no pueden sobrescribirse silenciosamente: el segundo recibe 409 y debe Actualizar y reaplicar su cambio. La inicialización concurrente ignora conflictos sin reemplazar un dashboard existente. El lector actualiza con el botón Actualizar; no hay sincronización en tiempo real.

Validación local: TypeScript, build de Vite, `server/test-api.mjs` (servicios simulados) y `server/test-dashboard.mjs` (cálculos, jerarquía y orden). La activación y persistencia reales requieren aplicar SQL y función en Supabase.

## Machotes guardados · dashboard-templates-1

Activación: ejecutar `database/004-dashboard-machotes.sql` después de `003-dashboard.sql`, reemplazar la Edge Function con `server/retailhub-api.ts` y recargar el portal. El estado público anuncia `dashboardTemplates: true`.

Desde un dashboard ya personalizado, el administrador pulsa **Guardar como machote**, asigna un nombre y guarda. Se toma la versión guardada del servidor; si cambió mientras tanto, se pide actualizar. Se conserva una copia independiente con todos los nombres, etapas, actividades, subtareas y su orden; todas las actividades pasan a Pendiente, incluyendo las que estaban en No aplica. Responsables, fechas y notas quedan vacíos. El dashboard de origen no se modifica. Los filtros de pantalla no afectan al contenido guardado.

En la tienda de destino, **Usar machote guardado** permite elegir uno de los machotes. Se puede inicializar un dashboard nuevo o reemplazar uno existente; en este último caso se exige marcar una confirmación explícita. La revisión del destino impide sobrescribir cambios concurrentes. Cada aplicación genera IDs nuevos y vuelve a limpiar estados, responsables, fechas y notas en el servidor. Después se edita de forma independiente: cambiar la tienda de origen, el destino o guardar otro machote no modifica las copias anteriores.

Los machotes se guardan en `rh_dashboard_templates`, protegida con RLS, sin permisos directos de anon/authenticated. Solo administradores activos pueden listar, guardar y aplicar; la tienda origen/destino debe estar activa. Son machotes compartidos entre los administradores del portal, no entre los lectores. La lista se pagina por UUID y solo devuelve nombre, fecha y cantidad de elementos; las estructuras permanecen en el servidor hasta su aplicación. Guardar repetidamente crea copias separadas, nunca sobrescribe un machote por coincidencia del nombre. El selector distingue copias por fecha y hora.

No se copian documentos, usuarios ni permisos de tienda. No se crean enlaces públicos ni archivos en Dropbox. Validación adicional: pruebas de snapshots inmutables, limpieza de campos, independencia de IDs/jerarquía, lectura protegida, confirmación de reemplazo y revisión del destino. Las pruebas usan servicios simulados; la persistencia real requiere activar tabla y función.

## Cotizaciones y autorizaciones · quotes-1

Activación en el proyecto existente:

1. Ejecutar `database/005-cotizaciones.sql` en SQL Editor. Crea tablas privadas y la función transaccional de autorización; no modifica bibliotecas, usuarios ni dashboards existentes.
2. Reemplazar el archivo completo de la Edge Function con `server/retailhub-api.ts` y desplegar. Conservar secretos y configuración JWT existentes. `/status` anuncia `build: quotes-1` y `features.quotes: true`.
3. Recargar GitHub Pages. Abrir **Cotizaciones**, elegir tienda y crear un comparativo. **Importar expediente** admite un JSON privado con `format: retailhub-quotes-1`, `store_hint` opcional y `data` conforme a `src/quotes-core.ts`. El expediente se entrega de forma privada; no se incluye información real de proveedores en este repositorio.
4. Guardar borrador y revisar solicitud, proveedores, importes y equivalencias. Publicar al cliente cuando corresponda. Cada edición vuelve a borrador e incrementa la revisión. Las autorizaciones previas se conservan, pero no aprueban automáticamente la versión nueva.
5. En Usuarios, editar al lector autorizado, asignar sus tiendas y activar **Puede autorizar cotizaciones de sus tiendas asignadas**. Los demás lectores solo consultan. Los administradores también pueden autorizar.

### Importación y comparación

XLSX (primera hoja), CSV, TSV/TXT delimitado y PDF con texto seleccionable, hasta 20 MB; PDF hasta 50 páginas. El XLSX se lee en el navegador con un límite de 40 MB descomprimidos. PDF.js se empaqueta con la aplicación y no envía el documento a un servicio de IA. El usuario selecciona encabezados y columnas y revisa la vista previa. PDF escaneado o imagen necesita captura/transcripción; no hay OCR ni equivalencias semánticas automáticas en esta versión. Las tablas de PDF pueden necesitar correcciones manuales.

Las coincidencias se proponen por nombres normalizados y descripciones previamente confirmadas dentro del mismo comparativo. Se requiere revisar; la importación nunca confirma equivalencias automáticamente. Cada renglón se puede relacionar con un concepto común, dejar como adicional o marcar por aclarar. Se preservan nombres, especificaciones, cantidad solicitada/cotizada y notas. No se puede relacionar dos renglones del mismo proveedor con un concepto sin consolidarlos antes. Un concepto sin precio no se cuenta como cero. El precio unitario se muestra solo cuando coinciden cantidades; las diferencias requieren aclaración explícita.

Moneda: MXN. Importes enteros en centavos, cantidades numéricas, IVA en puntos base. Los importes importados son **totales de renglón antes de IVA**. Se compara el subtotal calculado contra el declarado por el proveedor; una diferencia de más de un centavo impide autorizar. El envío se captura como importe final con impuestos y no se vuelve a gravar; si está vacío, se muestra Por confirmar y no se considera gratuito. Las unidades de medidas deben confirmarse antes de autorizar; en Solicitud original se pueden asignar centímetros, milímetros o metros a todos los conceptos con una sola selección, o editar cada uno por separado. El plazo requiere días y condición de inicio (hábiles/naturales, anticipo, aprobación de artes, etc.). No se convierte un plazo desconocido en cero ni se calcula una fecha de entrega inventada.

El menor importe se marca solo entre dos o más renglones revisados sin diferencias de cantidad, material o medidas. No se declara un proveedor ganador por un total que cubra menos conceptos. La comparación tiene búsqueda, filtro por grupo y paginación de 25 conceptos. Máximo 300 conceptos solicitados y 10 proveedores con hasta 400 renglones cada uno, dentro del límite de 2 MiB por solicitud.

### Autorización e historial

Solo usuarios activos con acceso a la tienda y rol admin o `app_metadata.quote_approval: true` pueden autorizar. El servidor vuelve a consultar Auth en cada solicitud. El botón requiere versión publicada/guardada, plazo y envío confirmados, importes válidos y revisiones resueltas. Si faltan conceptos, el usuario debe aceptar expresamente el alcance parcial y ve la lista excluida. Autorizar registra una decisión dentro del portal; no envía pedidos ni realiza pagos.

`rh_approve_quote` bloquea la fila durante la operación, comprueba revisión/publicación, usuario y tienda, y registra una sola autorización por versión con usuario, fecha, proveedor y copia de los datos aprobados. Una edición simultánea no puede cambiar silenciosamente la versión autorizada. **Ver lo autorizado** muestra la copia guardada, no los precios actuales. Las tablas y RPC tienen RLS/permisos restringidos a service_role; anon/authenticated no acceden directamente.

### Respaldos privados

La extracción de datos y la conservación del original son acciones separadas. Después de guardar, **Adjuntar respaldo** sube PDF, XLSX, PNG o JPG (máximo 20 MB) en bloques de 8 MiB a Dropbox: `Retail Hub/Portal/<tienda>/cotizaciones/<UUID>_<archivo>`. La biblioteca de planogramas/listados no sincroniza esta carpeta ni cambia sus formatos permitidos. Los archivos se sirven como descarga, nunca como HTML ejecutable. No hay acción de eliminación de respaldos en esta versión.

Los enlaces expiran a los 15 minutos. Solo se almacena el hash del ticket; cada descarga revalida usuario, publicación, tienda, ubicación del archivo y su revisión de Dropbox. Si un original cambia externamente, el enlace deja de servirlo como si fuese el original guardado. El historial incluye los identificadores y revisiones de respaldos existentes al autorizar. Una repetición de finish después de fallo de catálogo reutiliza el archivo ya subido. Como los PDF de biblioteca, estas transferencias consumen egress de Supabase aunque los archivos residan en Dropbox.

### Verificación

TypeScript y Vite; `server/test-api.mjs` con servicios simulados (permisos, publicación, versiones, importes, faltantes, autorización, historial, respaldo y revocaciones); `server/test-quotes.mjs` para cálculos, formatos numéricos, encabezados, equivalencias y validación; pruebas de pantalla con un API local simulado, XLSX original y PDF de prueba con texto. No equivalen a una autorización o transferencia real en las cuentas del usuario. La persistencia real requiere ejecutar SQL, desplegar función y hacer la primera importación desde una sesión del administrador.
