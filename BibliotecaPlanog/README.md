# Biblioteca de documentos Retail Hub

Dirección prevista: https://grupobure.github.io/RetailHub/BibliotecaPlanog/

La página está preparada para GitHub Pages. `index.html`, `config.js` y `assets/` contienen la versión compilada. `source/` contiene el proyecto editable. Para recompilar: entrar a source, ejecutar npm install y npm run build. Copiar el contenido de source/dist a BibliotecaPlanog sin borrar source. Se requieren react, react-dom, lucide-react, vite y @vitejs/plugin-react. El proyecto usa JSX automático.

Esta publicación solo ofrece la revisión del diseño: no contiene archivos PDF, contraseñas ni credenciales de servicios. La conexión del servidor con Dropbox y Supabase está pendiente. `config.js` conserva `apiBase` vacío y la pantalla muestra ejemplos identificados como tales; no existe un acceso alternativo a documentos reales.

Antes de activar documentos reales se debe implementar y probar la comunicación entre el dominio de GitHub Pages y el servidor. GitHub Pages solo aloja el frontend. El servidor protegerá documentos y secretos y deberá resolver sesiones entre dominios, autorización, descargas, visor, CORS y la devolución de OAuth de Dropbox. No basta con poner una dirección en config.js para considerar terminada la integración.

El acceso a Dropbox se conserva como App folder, para limitarlo a la carpeta de la aplicación. La URL de redirección OAuth deberá corresponder al servidor definitivo y sustituir la anterior de chatgpt.site. Los visitantes no deberán necesitar una cuenta de ChatGPT.
