# Activar Exhibidores en Retail Hub

La página incluye el editor y la consulta de exhibidores. Para habilitar su conexión con Dropbox, actualiza la función existente del proyecto de Supabase que ya usa Retail Hub.

## 1. Actualizar la función

1. Abre el proyecto correcto de Retail Hub en Supabase.
2. En **Edge Functions**, abre **retailhub-api** y su editor de código.
3. Abre [el código completo actualizado](server/retailhub-api.ts), pulsa **Raw** y copia todo su contenido.
4. Sustituye el contenido completo de `index.ts` en esa función y pulsa **Deploy updates**.

Conserva los secretos, la configuración de JWT y la conexión de Dropbox existentes. La función de correo `retailhub-mail` no necesita cambios. Esta actualización no requiere ejecutar SQL ni crear un bucket de Supabase Storage.

## 2. Cargar el primer exhibidor

1. Abre [el portal](https://retailhub.mx/BibliotecaPlanog/) como administrador y actualiza con **Ctrl + F5**.
2. Entra en **Exhibidores** y selecciona la tienda correspondiente.
3. Pulsa **Cargar paquete** y selecciona el archivo preparado `BRYKA_Luminarios.rhexhibit.json`. El paquete ya incluye la foto de referencia, el plano, los productos y las imágenes; no hay que escribir código ni editar el archivo.
4. Espera a que termine la carga. Revisa el listado y las zonas propuestas, y pulsa **Guardar exhibidor**. Se guarda como borrador privado para administradores.
5. Para cambiar una posición, selecciona el artículo y pulsa **Dibujar / cambiar zona**; arrastra el recuadro sobre la foto. También puedes ajustar sus porcentajes.
6. Revisa el plano, las medidas y las discrepancias indicadas antes de fabricar. Las posiciones del paquete son una propuesta conceptual siguiendo el orden del listado; la foto muestra un mueble anterior.
7. Cuando esté revisado, abre **Datos y archivos del exhibidor**, activa **Visible para proveedores autorizados** y guarda.

La carga sube las imágenes primero. Si se interrumpe antes de guardar, el registro no queda creado. Las imágenes subidas se conservan en Dropbox; no se publican en GitHub.

## 3. Elegir quién puede consultarlo

En **Usuarios**, crea o edita el usuario y marca las tiendas en **Exhibidores por tienda**. Guarda sus permisos. Este acceso es independiente del acceso a Biblioteca y Cotizaciones. Los administradores pueden gestionar los exhibidores; los lectores solo consultan los publicados de sus tiendas autorizadas.

## Dónde se guarda

Dentro de la carpeta de Dropbox de cada tienda, el portal crea al subir o guardar:

- `exhibidores/registros`: información de cada exhibidor y sus posiciones.
- `exhibidores/imagenes`: fotos, planos y detalles de los productos.

Supabase continúa gestionando usuarios, sesiones y permisos. Los archivos e información de exhibidores se almacenan en Dropbox, y pasan por la función autenticada para consultarse; esto sí genera solicitudes y transferencia de datos. No se crean enlaces públicos de Dropbox.

Las fotografías y fichas son copias guardadas: cambiar un artículo en Truper no actualiza automáticamente sus datos. El administrador puede editar el producto y sustituir sus imágenes. Al eliminar un exhibidor se retira su registro, conservando las imágenes en Dropbox.

## Comprobar la activación

La respuesta de estado de `retailhub-api/status` debe mostrar `build: "exhibitors-2"` y `features.exhibitors: true`, además de `features.exhibitTruper: true`. Si sigue apareciendo la pantalla de activación, revisa que se haya actualizado y desplegado la función del proyecto correcto y vuelve a cargar el portal.

Validación previa: compilación de producción; pruebas de permisos por tienda, borradores, lectura de imágenes, conflicto entre versiones, restricción de escritura y eliminación; regresiones de sesión y cotizaciones. Las pruebas automatizadas usan servicios simulados. Tras desplegar la función, comprueba una carga y su lectura real desde Dropbox antes de dar acceso al proveedor.

## Consultar un código nuevo en Truper

Esta función también requiere desplegar el código actualizado de `retailhub-api` (versión `exhibitors-2`). Los secretos y la conexión de Dropbox existentes se conservan.

1. Carga el paquete o abre un exhibidor y pulsa **Editar exhibidor**.
2. Selecciona un artículo en el listado o en la fotografía.
3. Edita **Código del artículo**. Al cambiarlo se vacían los datos técnicos y las imágenes anteriores para evitar asociarlos al código equivocado; la ubicación se conserva.
4. Pulsa **Traer datos de Truper**. La consulta es del código exacto; las medidas y características solo se toman de la ficha oficial. Si tienes el enlace HTML, puedes pegarlo en el campo de ficha oficial antes de consultar.
5. Revisa la vista previa y pulsa **Usar estos datos**. Las fotos encontradas se incorporan a Dropbox. Si falta alguna medida o imagen, se indica expresamente; los cortes nunca se deducen de las dimensiones exteriores.
6. Pulsa **Guardar exhibidor** para conservar los cambios. También puedes capturar o corregir los datos manualmente.

La consulta depende de que Truper permita el acceso a su sitio. Ante un bloqueo, una ficha incompleta o un código distinto, no se aplican los datos. No se importan automáticamente los PDF; usa el enlace HTML de la ficha. Las tablas e ilustraciones pueden tener diferencias: revisa ambas antes de fabricar.
