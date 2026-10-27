# Activar el nuevo archivo de cotizaciones

Proyecto: **Biblioteca Retail Hub** (`xgwfknypmzdbuhcpmmuz`).

1. En Supabase → SQL Editor → New query, ejecutar completo `database/008-cotizaciones-independientes.sql`. Debe terminar sin errores. Se puede volver a ejecutar: conserva los registros existentes.
2. En Supabase → Edge Functions → `retailhub-api` → Code, reemplazar el archivo de la función por el contenido completo de `server/retailhub-api.ts` y desplegar. Conservar los secretos y la configuración actual del gateway (Verify JWT OFF: la función ya valida Auth y permisos en cada petición).
3. Abrir la página de Retail Hub y actualizar con Ctrl + F5. Cotizaciones debe mostrar **Nueva cotización**, **Nueva solicitud** y **Comparar cotizaciones**. El build del servidor es `quote-records-1` y `status.features.quoteRecords` debe ser `true`.

No se necesita un proyecto nuevo, otro secreto ni otra cuenta de Dropbox. Los comparativos existentes siguen en **Comparativos guardados**; no se convierten ni se borran automáticamente.

## Uso

- **Nueva cotización:** importar XLSX/CSV/TSV o PDF con texto, o pegar celdas de Excel. Elegir fila de encabezados, identificar descripción/cantidad/precio unitario/importe total y conservar otras columnas con su nombre. Desmarcar notas y subtotales. Revisar el proveedor en esa misma captura y guardar.
- Un proveedor nuevo se registra al guardar la cotización. Si ya existe, se puede seleccionar y recuperar sus condiciones habituales. Los ajustes afectan esa cotización; la casilla de condiciones habituales actualiza las futuras. Las anteriores conservan su copia.
- Se pueden guardar capturas sin precios, plazos, cantidades o unidades todavía. Los datos pendientes siguen pendientes; no se sustituyen por cero ni por una cantidad inventada. Para autorizar, se mantienen las comprobaciones de alcance, cantidades, revisión, importes, envío y plazo.
- El archivo importado se adjunta por defecto al guardar. También se pueden adjuntar originales aparte. Si falla el respaldo después de guardar los datos, se informa y **Guardar** reintenta los archivos pendientes.
- **Comparar cotizaciones:** seleccionar de 1 a 10 cotizaciones, de uno o varios proveedores, y opcionalmente una solicitud o cotización como referencia. Las monedas deben coincidir. Relacionar y confirmar renglones; aclarar diferencias. Lo no relacionado se conserva como adicional con su importe, nunca como cero.
- **Guardar comparativo** genera una copia independiente con los respaldos y la versión de sus fuentes. Editar o retirar una cotización no altera comparativos anteriores. Publicar y autorizar siguen siendo acciones separadas y con los mismos permisos por tienda.
- **Machotes:** guardar columnas, conceptos, cantidades y condiciones sin precios ni respaldos. Se pueden editar, eliminar o usar como nueva captura. Guardar coincidencias como machote conserva las descripciones por posición de cotización; al aplicarlo se vuelven a confirmar los conceptos. Los machotes pertenecen a la tienda seleccionada.

## Verificación realizada

Comprobación TypeScript, build de producción, pruebas del modelo e importación, escenarios nuevos de API con servicios simulados y regresión de seguridad del portal. La prueba visual en navegador quedó bloqueada por la revisión automática del entorno. La migración se entrega para ejecutarla en el proyecto indicado; no se ha aplicado a la base de producción desde este entorno.
