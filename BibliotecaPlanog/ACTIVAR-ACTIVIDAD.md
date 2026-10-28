# Actividad de usuarios

## Activación

1. En Supabase **Biblioteca Retail Hub**, ejecuta completo `database/010-actividad.sql`.
2. Reemplaza el código de la función existente **retailhub-api** por el contenido completo de `server/retailhub-api.ts` y despliega. Conserva sus secretos y Verify JWT OFF: la función valida las sesiones internamente. No reemplaces `retailhub-mail`.
3. Actualiza el portal con Ctrl + F5. El administrador verá **Actividad de usuarios**.
4. Prueba con un usuario lector: iniciar sesión, interactuar, cerrar sesión explícitamente. En el panel del administrador actualiza y comprueba las horas. Un lector no debe poder consultar el historial.

No se crean claves nuevas. Esta publicación no ejecuta SQL ni despliega automáticamente la función de Supabase. El build de retailhub-api debe indicar `activity-1`.

## Qué se registra

Una fila por sesión de Supabase, identificada por el `session_id` del token validado por Auth. Se guarda usuario, nombre/usuario de ingreso, detección de la sesión, ingreso confirmado si se observó, última señal y cierre explícito confirmado. No se guardan contraseñas, tokens, teclas, contenido de mensajes ni documentos consultados.

- Ingreso: el servidor registra una autenticación exitosa en el portal.
- Salida: solo después de confirmar la operación de cierre de sesión.
- Si una sesión ya estaba abierta antes de activar el registro, el primer pulso registra la detección con ingreso desconocido; no inventa una fecha de ingreso histórica.
- La señal de actividad se limita a una por minuto. Solo se envía si la pestaña está visible, tiene el foco y hubo una interacción reciente. Se observan eventos de interacción para actualizar un reloj local; no se transmiten teclas ni campos.
- «Actividad reciente» significa una señal en los últimos 3 minutos. «Inactiva» significa que ya no se cumple ese umbral. Ninguna es una prueba de presencia frente a la pantalla ni una salida exacta.
- Cerrar una pestaña, cortar internet, suspender el equipo o dejar vencer un token no fabrican un cierre de sesión. El panel es de actividad del portal, no un registro de asistencia laboral.
- Los cambios de foco no reemplazan la identidad, reinician pantallas ni descartan borradores. No se deduce un nuevo ingreso por volver de otra aplicación.
- Si falla la escritura del registro, no se impide iniciar sesión. Una sesión puede aparecer después como detectada con ingreso desconocido. El historial no promete capturar eventos durante interrupciones del registro.

## Panel

Acceso exclusivo de administrador, comprobado en servidor y SQL con permisos actuales. Los lectores no pueden consultar ni escribir directamente las tablas/RPCs. El pulso solo registra la sesión y el usuario del token validado; no acepta identificadores enviados en el cuerpo.

Filtros por usuario y fecha de primera detección de la sesión, de hasta un año por consulta. Historial paginado de 100 sesiones, con totales del periodo filtrado. Las sesiones abiertas en fechas anteriores se encuentran ampliando el periodo. «Actualizar» consulta el estado al momento del servidor; no es un monitor en tiempo real.

Horarios mostrados y exportados en **America/Mexico_City**, formato de 24 horas. Se conservan timestamps UTC en la base. Las sesiones anteriores a la activación no se reconstruyen. Los nombres de sesiones históricas se conservan aunque se retire el usuario.

Exporta a Excel **XLSX** hasta 10,000 sesiones del periodo filtrado. Las celdas son texto y no ejecutan fórmulas introducidas en nombres. El archivo se genera en el navegador; no se copia a Dropbox ni a Supabase Storage.

## Verificación

TypeScript y Vite; pruebas de sesión y 120 comprobaciones existentes de API. Pruebas adicionales ejecutan la migración en Postgres local (PGlite), validando privilegios, cierre confirmado, sesiones retomadas sin ingreso inventado, rechazo de usuarios desactivados, identificación por token y lectura exclusiva de administradores. El XLSX se verifica como ZIP/XML y con valores de prueba que no se convierten en fórmulas.

Pendientes tras publicación: aplicar SQL, desplegar la función y comprobar los ingresos/cierres reales en el proyecto. No se obtuvo QA visual en el navegador de pruebas por la restricción de acceso existente.
