# Copie estas asignaciones en una sesion temporal de PowerShell.
# Obtenga las dos claves exclusivamente de `npx supabase status` local.
$env:NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321'
$env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = '<LOCAL_ANON_OR_PUBLISHABLE_KEY>'
$env:SUPABASE_SERVICE_ROLE_KEY = '<LOCAL_SERVICE_ROLE_KEY>'
$env:LIBRETRANSLATE_URL = 'http://127.0.0.1:5000'
$env:TRANSLATION_LOCAL_QUEUE_ENABLED = 'true'
$env:PLAYWRIGHT_BROWSERS_PATH = "$env:LOCALAPPDATA\ms-playwright"

npm run e2e:local:guard
