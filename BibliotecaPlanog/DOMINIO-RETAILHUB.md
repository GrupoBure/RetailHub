# Dominio retailhub.mx

La página pública se conserva en la raíz y el portal en `/BibliotecaPlanog/`.

## Preparación publicada

- Vite usa rutas relativas; el portal funciona tanto bajo `/RetailHub/BibliotecaPlanog/` como bajo `/BibliotecaPlanog/`.
- La API acepta exclusivamente los orígenes HTTPS `grupobure.github.io`, `retailhub.mx` y `www.retailhub.mx`. Las respuestas CORS se calculan por petición, también para errores y archivos.
- La autorización de Dropbox vuelve al mismo dominio autorizado que inició la conexión. Las conexiones iniciadas previamente conservan el retorno de GitHub.
- Los documentos siguen en Dropbox. No hay cambios SQL ni en las políticas de usuarios.

## Activación pendiente

1. Actualizar y desplegar `server/retailhub-api.ts` en la Edge Function `retailhub-api` del proyecto Supabase Biblioteca Retail Hub. Conservar los secretos actuales y Verify JWT OFF; la función verifica la sesión internamente. El endpoint `/status` debe indicar build `quote-records-2-domain-1`.
2. Después de verificar la API, configurar `retailhub.mx` en Settings > Pages > Custom domain del repositorio GrupoBure/RetailHub. Con publicación desde rama, conservar el archivo CNAME en la raíz del repositorio. No se activa aún en este cambio para evitar redirigir a los usuarios antes de preparar la API.
3. Namecheap > Advanced DNS: cambiar CNAME `www` de parkingpage.namecheap.com a grupobure.github.io; quitar el URL Redirect Record de `@`; añadir los cuatro A de `@`: 185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153. Mantener TTL Automatic y no modificar Mail Settings > Private Email ni registros de correo.
4. Cuando GitHub confirme DNS y certificado, activar Enforce HTTPS y probar inicio de sesión, permisos, Dropbox y documentos en el dominio nuevo. La sesión puede requerir un nuevo inicio porque el almacenamiento del navegador se separa por dominio.

La preparación del código no constituye una verificación de DNS, certificado o despliegue de la función.

Documentación: https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site
Namecheap: https://www.namecheap.com/support/knowledgebase/article.aspx/9645/2208/how-do-i-link-my-domain-to-github-pages/
