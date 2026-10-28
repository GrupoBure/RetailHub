# Conexión y actividad por separado
1. En Biblioteca Retail Hub, ejecutar database/011-presencia.sql después de 010. Conserva historial y permisos.
2. Actualizar la función existente retailhub-api con server/retailhub-api.ts completo. Build activity-2. Verify JWT OFF, mismos secretos. No modificar retailhub-mail.
3. Ctrl+F5 en todos los navegadores del portal: las pestañas con código anterior deben actualizarse.

El portal envía presencia cada 30 segundos aun sin interacción y en segundo plano mientras el navegador permita ejecutar su temporizador. No mantiene viva una computadora suspendida ni garantiza ejecución en una pestaña congelada. Tras 3 minutos sin señal muestra Sin conexión reciente, nunca una salida inventada. Al reanudar vuelve a enviar señales sin cerrar el trabajo.

last_seen es conexión detectada; last_activity solo interacción reciente en una pestaña visible y enfocada, o ingreso confirmado. El historial previo mantiene last_activity desconocido. Las señales no guardan teclas ni contenidos. El periodo incluye sesiones que se solapan con sus fechas (aunque hayan iniciado antes). El contador cuenta sesiones, no personas únicas. Panel automático cada 30 segundos cuando está visible, con filtros conservados. Permisos de administrador y RLS sin cambios. Excel incluye ambas fechas.
