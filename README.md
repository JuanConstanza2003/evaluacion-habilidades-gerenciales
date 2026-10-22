# Evaluación interactiva: Habilidades Gerenciales

Aplicación estática (HTML/CSS/JavaScript) con backend Supabase. El dashboard administrativo queda pendiente para la última fase.

## Estado del backend

- Proyecto Supabase: `evaluacion-habilidades-gerenciales`.
- Edge Function `student-api` desplegada; utiliza token de sesión aleatorio, guarda solo su hash y calcula resultados en el servidor.
- La base de datos contiene 5 secciones, 10 preguntas, 40 opciones y 10 claves de respuesta.
- RLS está habilitado en las tablas de `public`; el acceso directo de `anon` y `authenticated` está revocado. Las operaciones de estudiantes pasan por la Edge Function.
- Los códigos de acceso se almacenan como hashes SHA-256, no como texto plano.
- La página ya llama al backend y ya no carga el catálogo de respuestas correctas en el navegador.

## Probar localmente

1. Descomprime el proyecto.
2. Abre una terminal en la carpeta del proyecto.
3. Ejecuta un servidor estático, por ejemplo `python -m http.server 8000`.
4. Abre `http://localhost:8000` en el navegador.
5. Registra un carné de prueba nuevo y completa el flujo.

No se recomienda abrir `index.html` directamente como `file://`; usa un servidor local.

## Seguridad antes de producción

- `assets/js/supabase-config.js` contiene únicamente la URL y la publishable key pública. Nunca pongas `service_role` ni una secret key en archivos del navegador.
- La función usa `ALLOWED_ORIGIN` si está configurado; durante desarrollo el valor predeterminado es `*`. Antes de publicar, configura `ALLOWED_ORIGIN` al origen exacto de GitHub Pages.
- No publiques los códigos de acceso en un repositorio público. Compártelos únicamente con los expositores correspondientes y rótalos después de las pruebas.
- El registro por carné es único; para recuperar acceso tras perder el token de navegador se necesitará un procedimiento administrativo seguro, que aún debe construirse.
- El dashboard, autenticación administrativa, recuperación de sesión y pruebas de carga quedan pendientes.

## Migraciones

Los archivos de `supabase/migrations/` documentan el esquema, las preguntas, la seguridad, los códigos y los índices. El proyecto conectado ya tiene las migraciones aplicadas. Si se reproduce en otro proyecto, aplica las migraciones en orden y configura los secretos/variables de entorno antes de desplegar la función.


### Códigos de acceso
Los cinco códigos vigentes se entregan por separado al responsable y a cada expositor. No se incluyen en este repositorio para evitar que queden publicados accidentalmente. El backend acepta mayúsculas y minúsculas y almacena únicamente hashes SHA-256.

Los códigos aceptan mayúsculas y minúsculas. Cambia estos códigos antes de una evaluación real si se han compartido fuera del grupo previsto.

## Seguridad del repositorio público

Esta copia pública omite deliberadamente las filas SQL que contienen la clave de respuestas y los hashes de los códigos de acceso. El backend de producción ya provisionado mantiene esos datos en Supabase. No uses esta copia pública como una restauración completa de una base de datos nueva sin cargar la clave de respuestas y configurar códigos de acceso por un canal privado y seguro.

Nunca publiques `SUPABASE_SERVICE_ROLE_KEY`, claves secretas, tokens de sesión ni códigos de acceso en texto plano. La clave `sb_publishable_...` del frontend está diseñada para ser pública; la seguridad debe descansar en RLS y en el backend.
