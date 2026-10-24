# Biblioteca de documentos Retail Hub

Frontend: https://grupobure.github.io/RetailHub/BibliotecaPlanog/

GitHub Pages aloja la interfaz pública. Los PDF permanecen en Dropbox, dentro de la carpeta de la aplicación. Supabase Auth valida usuarios y el servidor consulta el catálogo privado. No hay PDF ni credenciales en este repositorio.

## Estado

El servidor y la interfaz están preparados y sus controles fueron probados con servicios simulados. La activación real sigue pendiente del despliegue, los secretos de Dropbox y una prueba completa. `config.js` mantiene `apiBase` vacío hasta entonces. Los ejemplos de diseño no dan acceso a documentos reales.

## Activación en Supabase

1. Ejecutar `database/setup.sql` en un proyecto dedicado. Las tablas usan RLS sin políticas públicas; solo el servidor accede con permisos de servicio.
2. Crear el primer administrador según las instrucciones del SQL. Desactivar el registro público en Authentication → Sign In / Providers. El inicio de sesión usa un nombre de usuario; los correos internos `.invalid` no sirven para recuperar contraseña por email. Un administrador reasigna contraseñas.
3. Crear una Edge Function llamada exactamente `retailhub-api`. Reemplazar todo el contenido de su `index.ts` con `server/retailhub-api.ts` y desplegar. Es un archivo independiente sin imports de Next.js, Cloudflare ni librerías externas.
4. En los ajustes de esa función, desactivar **Verify JWT** del gateway. Esto permite el login y el callback de Dropbox. Las rutas privadas siguen verificando cada sesión contra Supabase Auth y comprobando `rh_portal`, `disabled` y el rol. El archivo `server/config.toml` contiene el ajuste equivalente para CLI.
5. Supabase inyecta sus propias claves al servidor. El código admite las claves legacy y los diccionarios de claves nuevos. No copiar claves de servicio en `config.js`, GitHub o el navegador.
6. En Edge Functions → Secrets guardar `DROPBOX_APP_KEY` y `DROPBOX_APP_SECRET`. Opcional: `RH_ENCRYPTION_SECRET`, secreto aleatorio de al menos 32 caracteres. Si se omite, se deriva el cifrado de la clave privada inyectada de Supabase. Rotar esa clave requiere volver a autorizar Dropbox; los tickets previos dejan de funcionar.
7. La aplicación Dropbox debe usar Scoped API / App folder y permisos `files.metadata.read`, `files.content.read`, `files.content.write`. Añadir como OAuth redirect URI: `https://TU-PROYECTO.supabase.co/functions/v1/retailhub-api/dropbox/callback`.
8. Crear dentro de la carpeta Dropbox de la aplicación la ruta `Retail Hub/Portal`. Sus subcarpetas son categorías. Solo se catalogan archivos `.pdf` dentro de esta ruta. El nombre de la carpeta de la app puede aparecer traducido en Dropbox.
9. Comprobar la URL `https://TU-PROYECTO.supabase.co/functions/v1/retailhub-api/status`; debe devolver `auth:true`. Configurar `window.RH_CONFIG = { apiBase: "https://TU-PROYECTO.supabase.co/functions/v1/retailhub-api" };` en `config.js`. Publicar el cambio en GitHub y comprobar CORS desde la página real.
10. Iniciar sesión con el administrador, abrir Conexiones → Conectar Dropbox, autorizar y sincronizar. Probar subir un PDF, consultarlo, imprimirlo y descargarlo. Crear un lector de prueba y comprobar que no puede administrar, ver PDF ocultos ni acceder después de ser desactivado. No considerar la activación terminada antes de esta prueba real.

## Sesiones y archivos

El navegador conserva la sesión de usuario en `sessionStorage` para esa pestaña. No usa cookies de terceros. La clave de servicio y los secretos de Dropbox permanecen en el servidor. La autorización de Dropbox usa un estado cifrado, con vencimiento y consumo único. El refresh token de Dropbox se guarda cifrado en `rh_settings`.

El visor y las descargas usan tickets aleatorios de 15 minutos; se guarda únicamente su hash. Cada acceso vuelve a comprobar el usuario y la publicación del documento. Quien posea el enlace puede abrirlo durante su vigencia; una vez descargado el archivo, la copia queda bajo responsabilidad del usuario. El servidor transmite el archivo desde Dropbox y admite rangos de bytes sin cargar el PDF completo en memoria.

**Almacenamiento y transferencia son cuotas diferentes.** Guardar PDF en Dropbox evita ocupar Supabase Storage, pero este servidor transmite los PDF mediante Edge Functions: sus descargas/consultas consumen la transferencia de Supabase, además de las invocaciones. Tener 1 TB disponible en Dropbox no equivale a tener 1 TB de transferencia gratuita en Supabase. Revisar el tráfico esperado y el plan vigente antes de abrir la biblioteca a todo el equipo. Si excede el plan, trasladar la transmisión de archivos a otro servidor y conservar Supabase para usuarios/catálogo.

Subidas en bloques de 8 MiB mediante sesiones de Dropbox. La subida no comprime PDF automáticamente: optimizar antes de subir. Un archivo con el mismo nombre se añade con otro nombre para evitar sobrescrituras accidentales. Para reemplazar conservando la entrada del catálogo, reemplazar el archivo en Dropbox y sincronizar. La sincronización añade y actualiza; no elimina automáticamente del catálogo los archivos borrados de Dropbox. Ocultar en el portal antes de borrar para evitar entradas sin archivo. La interfaz actual consulta hasta el límite de filas configurado en la API Supabase, con un máximo solicitado de 5000; revisar paginación si crece el catálogo.

## Código y comprobaciones

`index.html`, `config.js` y `assets/`: publicación compilada. `source/`: React/Vite editable. `server/`: función y comprobaciones. Para compilar el frontend: instalar dependencias en `source/` y ejecutar `npm run build`. Copiar su `dist/` a la carpeta publicada, conservando la configuración real del servidor.

Desde `source/`, con TypeScript instalado: `node ../server/test-api.mjs`. Las comprobaciones usan dobles de Supabase y Dropbox; no prueban credenciales ni conectividad reales. Cubren acceso anónimo/inhabilitado, privilegios, publicación, tickets vencidos, streaming parcial, OAuth de un solo uso, cifrado del token y ambas clases de claves Supabase.
