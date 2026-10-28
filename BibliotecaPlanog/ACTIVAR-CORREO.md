# Correo de Retail Hub

El apartado Correo integra los buzones de Namecheap Private Email con el acceso existente del portal. Los buzones se crean primero en Namecheap. El administrador los conecta y asigna a usuarios ya registrados en Retail Hub. Cada usuario ve solo su buzón, incluso si es administrador.

## Estado y alcance

- Código de interfaz y función independiente `retailhub-mail` preparados. La publicación de la página no despliega la función ni ejecuta SQL.
- Recibidos, Enviados, Borradores, Papelera y las demás carpetas existentes; lectura, responder, reenviar, adjuntos, marcar no leído, mover a Papelera y restaurar a Recibidos.
- Una cuenta asignada por usuario. El administrador puede retirar o cambiar la asignación con confirmación. Esto no elimina el buzón en Namecheap.
- Firma propia con nombre, puesto, teléfono, sitio web, texto adicional y logotipo opcional de Retail Hub. Se agrega automáticamente a los envíos hechos desde el portal; no cambia la firma configurada en aplicaciones externas.
- Los mensajes, borradores y archivos adjuntos permanecen en Namecheap. Supabase guarda la asignación, contraseña de aplicación cifrada, firma y metadatos mínimos del control de envío. No guarda cuerpos ni adjuntos. Dropbox no interviene en el correo.

## 1. Preparar la base

En el proyecto Supabase **Biblioteca Retail Hub**, ejecuta completo `database/009-correo.sql` en SQL Editor. El script comprueba que existan las tablas de la biblioteca para evitar ejecutarlo en otro proyecto. No cambia tablas de documentos, usuarios o cotizaciones.

Las tablas nuevas tienen RLS y no permiten acceso directo desde las claves públicas ni desde usuarios autenticados. Solo la función del servidor puede utilizarlas.

## 2. Preparar el cifrado

En Supabase > Edge Functions > Secrets, crea **RH_MAIL_ENCRYPTION_SECRET** con una cadena aleatoria de al menos 32 caracteres. Genera y guarda ese valor en tu administrador de contraseñas; no lo publiques en GitHub ni lo pegues en el chat.

Si ya existe `RH_ENCRYPTION_SECRET` con al menos 32 caracteres, la función puede utilizarlo como alternativa. Es preferible mantener una clave específica para correo. **Conserva la clave elegida:** cambiarla sin volver a conectar las contraseñas impedirá descifrarlas. Retirar accesos sigue siendo posible aunque la clave deje de estar disponible.

La función reutiliza las variables de Supabase que el proyecto proporciona: SUPABASE_URL y las claves públicas/de servicio. No copies claves privadas a config.js ni a la página.

## 3. Crear la función separada

1. Supabase > Edge Functions > Deploy a new function > editor.
2. Nombre: **retailhub-mail**.
3. Archivo principal: `index.ts`. Reemplaza su contenido por **todo** `server/retailhub-mail.ts`.
4. Despliega. En Details/Settings deja **Verify JWT / Enforce JWT verification desactivado** en la puerta de entrada, igual que para retailhub-api. La función valida internamente el JWT de Supabase y los permisos actuales en cada petición.
5. Conserva la función existente `retailhub-api`; no la reemplaces por el archivo de correo.

Las dependencias están fijadas en los imports npm del archivo y las resuelve Supabase durante el despliegue. No es necesario pegar archivos npm ni ejecutar SQL adicional. `server/package.json` se utiliza únicamente para las pruebas locales.

### Conexión que se debe verificar en el proyecto real

Namecheap documenta IMAP TLS en **mail.privateemail.com:993** y SMTP TLS en **mail.privateemail.com:465**. La implementación utiliza esas conexiones cifradas con validación de certificado, sin degradarlas a conexiones sin cifrado. No usa los puertos 25 ni 587, restringidos por Supabase.

La compatibilidad del runtime de Supabase, sus conexiones salientes y las credenciales de Namecheap deben comprobarse al desplegar: las pruebas locales simulan los servicios remotos. Si la plataforma no permite la conexión o alguna dependencia, **no se considera activado el correo**. Conserva la biblioteca funcionando y revisa el error antes de cambiar la arquitectura o contratar otro servicio.

## 4. Conectar cada buzón

1. En Namecheap Private Email abre el buzón correspondiente.
2. En su configuración busca **Security Center > App passwords > Create new password** y crea una contraseña de aplicación para Retail Hub.
3. Guarda ese valor en tu administrador de contraseñas. No lo envíes por chat.
4. En el portal, con tu usuario administrador: **Correo > Administrar correos > Conectar buzón**.
5. Escribe la dirección completa, elige el usuario de Retail Hub y pega la contraseña de aplicación en el campo protegido. Marca Habilitar y guarda.
6. La función prueba IMAP y SMTP (sin enviar mensajes) antes de guardar la cuenta habilitada. Si falla, no anuncia una conexión exitosa.
7. Repite para el segundo buzón, seleccionando el otro usuario. Un usuario sin buzón asignado no obtiene acceso por ser lector de una tienda.

La contraseña del portal no se reutiliza como contraseña del correo. Una vez conectado, el usuario entra con su acceso habitual al portal y no necesita escribir la contraseña de Namecheap en cada visita. La contraseña de aplicación se cifra con AES-GCM y queda vinculada a la dirección del buzón. La API nunca la devuelve al navegador después de guardar.

## 5. Firmas y prueba real

Cada usuario entra a **Correo > Mi firma**, edita sus datos y revisa la vista previa. Nombre y puesto no se inventan: los campos son editables; solo se propone el nombre del perfil cuando aún no hay una firma guardada.

Realiza desde el portal un envío entre tus dos cuentas y una respuesta. Comprueba Recibidos, Enviados, firma, CCO y un adjunto pequeño. Verifica después con un lector sin buzón asignado que no pueda abrir mensajes. Esta prueba real queda pendiente hasta completar la activación.

## Comportamiento de la primera versión

- Botón Actualizar para consultar nuevos correos; no hay notificaciones en tiempo real ni sondeo permanente en segundo plano.
- Lista de 30 mensajes por página. El filtro busca en la página visible, no promete buscar todo el historial.
- Hasta 8 adjuntos que juntos pesen 8 MB al redactar. Apertura desde el portal de mensajes completos de hasta 12 MB; los mayores pueden consultarse en Private Email.
- Reenviar y editar una copia de borrador conservan texto y destinatarios. Si necesitas los adjuntos originales, descárgalos y agrégalos a la nueva composición.
- Guardar en Borradores crea una copia en Namecheap. No elimina borradores anteriores automáticamente. Mover a Papelera conserva los mensajes; no existe borrado definitivo desde el portal.
- Los mensajes HTML se muestran en un iframe aislado, sin scripts, formularios ni imágenes remotas. Los enlaces seguros se abren aparte por acción del usuario.
- El borrador de redacción se conserva al cambiar entre apartados del portal. Actualizar/cerrar la página con cambios pendientes muestra el aviso del navegador; cierra o guarda el borrador antes de salir de la sesión.
- Cada envío tiene un identificador único, con comprobación atómica y límites de 10 intentos por minuto / 60 por hora por buzón. Un error de red no provoca reenvíos automáticos. Si el resultado es incierto, consulta Enviados y al destinatario antes de autorizar un intento nuevo.
- Si SMTP acepta el mensaje pero falla guardar la copia en Enviados, el portal informa que el correo fue enviado y no propone repetirlo como si hubiera fallado.
- La firma del portal usa el logotipo público de Retail Hub por URL. El cliente del destinatario decide si carga imágenes externas.

## Validación técnica

Comprobaciones de TypeScript, compilación Vite y pruebas de cifrado, permisos, aislamiento HTML, MIME, CCO, adjuntos, borradores y control de reintentos. Las funciones SQL también se ejecutaron en Postgres local (PGlite), comprobando migración, privilegios, asignaciones, revisiones, idempotencia y límites. Las pruebas de red usan servicios simulados: no envían correos reales ni certifican la conectividad desde Supabase. No se obtuvo verificación visual en navegador de pruebas por la restricción de acceso existente.

Pruebas locales, después de instalar las dependencias de la fuente:

```sh
npm install --prefix server
node server/test-mail.mjs
node server/test-mail-database.mjs
```

Referencias oficiales:
- https://www.namecheap.com/support/knowledgebase/article.aspx/1179/2175/general-private-email-configuration-for-mail-clients-and-mobile-devices/
- https://www.namecheap.com/support/knowledgebase/article.aspx/10816/2178/how-to-use-app-passwords-for-private-email/
- https://supabase.com/docs/guides/functions/limits
- https://imapflow.com/docs/api/imapflow-client/
- https://nodemailer.com/message/custom-source
- https://postal-mime.postalsys.com/docs/api/postal-mime/
