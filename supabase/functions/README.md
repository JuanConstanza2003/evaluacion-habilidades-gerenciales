# Supabase Edge Function: `student-api`

Esta función es la API de estudiantes para el frontend estático de GitHub Pages. No requiere cuenta Supabase Auth para el estudiante; usa un token de sesión aleatorio de 256 bits y guarda únicamente su hash SHA-256 en `participant_sessions`.

## Acciones disponibles

Todas son solicitudes `POST` JSON a `/functions/v1/student-api`:

- `register`: `{ "action":"register", "full_name":"Nombre", "carnet":"AB123" }`
- `progress`: `{ "action":"progress", "token":"TOKEN_DEVUELTO_AL_REGISTRARSE" }`
- `unlock-section`: `{ "action":"unlock-section", "token":"...", "section_id":1, "code":"CODIGO" }`
- `submit-section`: `{ "action":"submit-section", "token":"...", "section_id":1, "answers":[{"question_id":1,"option_id":"1B","option_order":["1D","1B","1A","1C"]},{"question_id":2,"option_id":"2A","option_order":["2C","2A","2D","2B"]}] }`
- `finalize`: `{ "action":"finalize", "token":"..." }`
- `logout`: `{ "action":"logout", "token":"..." }`

El cliente debe enviar `apikey: SUPABASE_PUBLISHABLE_KEY` y `Content-Type: application/json`. La clave publicable/anon se puede usar en el navegador; NUNCA publiques `service_role`.

## Secretos de función

Supabase proporciona `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en el entorno de Edge Functions. Define `ALLOWED_ORIGIN` con el dominio exacto de GitHub Pages antes de producción, por ejemplo `https://TU_USUARIO.github.io` (y el dominio personalizado si aplica).

## Preparación

1. Crea un proyecto Supabase.
2. Ejecuta en orden `migrations/001_initial_schema.sql` y `migrations/002_backend_security_and_seed.sql`.
3. Reemplaza los cinco marcadores de `setup/configure_access_codes.sql` con códigos únicos y ejecuta ese script.
4. Instala Supabase CLI, inicia sesión y vincula el proyecto.
5. Despliega con `supabase functions deploy student-api --no-verify-jwt`.
6. En los secretos de Edge Functions configura `ALLOWED_ORIGIN`.
7. Prueba con carnés de prueba antes de publicar el enlace a estudiantes.

## Decisiones de seguridad

- La clave correcta no se devuelve en la lista pública de preguntas.
- El backend calcula la nota usando la clave privada.
- El carné es único, pero no demuestra identidad. El proceso de recuperación de una sesión perdida requiere asistencia administrativa; no debe basarse solo en conocer el carné.
- El token de sesión debe guardarse en `localStorage` solo para recuperar la sesión en ese navegador. Las notas y el progreso oficiales siempre vienen del servidor.
- Las operaciones de guardado y finalización usan funciones SQL transaccionales.
- El dashboard y sus políticas administrativas quedan fuera de esta etapa.
