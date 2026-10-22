# Guía de puesta en marcha del backend

## 1. Crear proyecto
En https://supabase.com/dashboard crea un proyecto dedicado a la evaluación. Guarda la contraseña de base de datos en un gestor seguro; no la subas a GitHub.

## 2. Crear tablas y preguntas
En SQL Editor ejecuta, en este orden:
1. `migrations/001_initial_schema.sql`
2. `migrations/002_backend_security_and_seed.sql`

La segunda migración carga las 10 preguntas, las 40 opciones y la clave privada de respuestas a partir del catálogo revisado del proyecto.

## 3. Configurar códigos
Abre `setup/configure_access_codes.sql`, reemplaza los cinco marcadores por códigos diferentes y ejecuta el script. No uses el código temporal `DEMO2026`.

## 4. Desplegar Edge Function
Instala Supabase CLI y ejecuta desde la carpeta del proyecto:

```bash
supabase login
supabase link --project-ref TU_PROJECT_REF
supabase functions deploy student-api --no-verify-jwt
supabase secrets set ALLOWED_ORIGIN=https://TU_USUARIO.github.io
```

Si el sitio se publica en un repositorio de proyecto, el origen puede ser `https://TU_USUARIO.github.io`; si se usa un dominio personalizado, configura ese origen. No incluyas una ruta como `/repositorio` en `ALLOWED_ORIGIN`.

## 5. Valores públicos del frontend
La URL del proyecto y la publishable key (o anon key heredada) son valores diseñados para uso público. Se configurarán en `assets/js/supabase-config.js` cuando conectemos el frontend. No copies la `service_role` key en HTML, JavaScript, GitHub, mensajes ni capturas.

## 6. Pruebas obligatorias antes de estudiantes reales
- Registrar un carné nuevo y confirmar que se genera un token.
- Registrar el mismo carné de nuevo: debe rechazarse.
- Enviar código incorrecto y comprobar el límite de intentos.
- Intentar desbloquear una sección fuera de orden.
- Enviar respuestas incompletas, duplicadas o de otra sección.
- Intentar volver a enviar una sección ya guardada.
- Finalizar sin completar las cinco secciones.
- Finalizar correctamente y comprobar que la nota se calcula en el servidor.
- Verificar que el endpoint público de preguntas nunca incluye `answer_key_private` ni `correct_option_id` antes de finalizar.
