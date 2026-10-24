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
8. Crear dentro de la carpeta Dropbox de la aplicación la ruta `Retail Hub/Portal`. Cada carpeta directamente dentro de Portal representa una tienda. Sus subcarpetas son categorías. Solo se catalogan archivos `.pdf` dentro de una tienda. El nombre de la carpeta de la app puede aparecer traducido en Dropbox.
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
3. Dentro de la carpeta de Dropbox de la aplicación usar `Retail Hub/Portal/NOMBRE DE TIENDA/`. Los PDF pueden ir directamente dentro de la tienda o en categorías como `Planogramas` y `Manuales`. Las carpetas que antes eran categorías directamente bajo Portal serán interpretadas como tiendas si se sincronizan sin reorganizar.
4. Para el PDF de prueba que estaba en `Portal/Planogramas`, crear una carpeta con el nombre de una tienda y mover allí esa carpeta Planogramas. El resultado será `Portal/Tienda de prueba/Planogramas/archivo.pdf`. La aplicación no mueve ni reorganiza los archivos existentes por su cuenta.
5. Actualizar GitHub Pages con Ctrl+F5 y pulsar Sincronizar Dropbox. También se pueden crear tiendas desde la página con **Crear tienda**. Los documentos anteriores sin tienda quedan inaccesibles hasta reorganizar y sincronizar. Los usuarios existentes quedan sin tiendas por defecto; los administradores conservan acceso a todas.
6. En Usuarios → Editar, marcar las **Tiendas autorizadas** de cada lector y guardar. Seleccionar rol Administrador da acceso global; no usarlo para alguien que solo debe ver algunas tiendas.
7. Probar con dos tiendas y dos lectores: cada lector solo ve la suya; no puede listar/abrir/descargar documentos de otra. Quitar una asignación y comprobar que un ticket anterior deja de funcionar. Verificar también editar/eliminar usuarios y cambiar contraseñas.

Los tickets del visor son enlaces de acceso temporal de 15 minutos vinculados al usuario que los generó: quien posea el enlace puede usarlo durante su vigencia mientras ese usuario siga autorizado. Revocar el permiso, ocultar el documento o desactivar la cuenta bloquea solicitudes nuevas. No es posible retirar un PDF que ya fue descargado.

Se comprobaron 37 casos de autorización e integración con servicios simulados, además de compilación y tipos del frontend/servidor. La ejecución del SQL y la prueba con las cuentas reales se hacen durante la activación. La transmisión de PDF sigue consumiendo transferencia de Supabase; dividir por tiendas no cambia esa cuota.
