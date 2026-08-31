# LibreTranslate local para el CMS

LibreTranslate se usa únicamente al editar contenido desde el proyecto local. Las traducciones revisadas se guardan en Supabase y el sitio desplegado las lee desde `site_content`; los visitantes nunca llaman al traductor.

## 1. Comprobar Python

En PowerShell:

```powershell
python --version
```

LibreTranslate requiere Python 3.8 o posterior. Si `python` no existe, instala Python para Windows y habilita la opción para agregarlo al `PATH`.

## 2. Instalar LibreTranslate

```powershell
python -m pip install --upgrade pip
python -m pip install libretranslate
```

La instalación es independiente de las dependencias Node.js de Tradagora.

## 3. Iniciar los idiomas del CMS

```powershell
libretranslate --load-only es,en,pt,fr --host 127.0.0.1 --port 5000
```

La primera ejecución descarga los modelos necesarios y puede tardar varios minutos. Mantén esta ventana de PowerShell abierta mientras traduces contenido.

Si PowerShell no encuentra el ejecutable `libretranslate`, abre una terminal nueva después de instalarlo. Como alternativa oficial en Windows puede utilizarse Docker, pero no es necesario para este flujo local.

## 4. Comprobar el servidor

Abre:

<http://127.0.0.1:5000/languages>

O ejecuta:

```powershell
Invoke-RestMethod -Uri 'http://127.0.0.1:5000/languages' -Method GET
```

La respuesta debe incluir `es`, `en`, `pt` y `fr`.

## 5. Configurar Tradagora

Agrega a `.env.local`:

```env
TRANSLATION_PROVIDER=libretranslate
LIBRETRANSLATE_URL=http://127.0.0.1:5000
```

Una instancia futura protegida también puede utilizar:

```env
LIBRETRANSLATE_API_KEY=tu_clave
```

Reinicia Next.js:

```powershell
npm run dev
```

En `/admin/content/[page]` debe aparecer `LibreTranslate disponible`. Selecciona un idioma de destino y usa `Traducir sección` o `Traducir página desde Español`. Revisa los inputs y pulsa `Guardar página` para persistirlos.

## Producción y Vercel

No configures una URL `127.0.0.1` como servicio remoto esperando que Vercel llegue a tu PC. En producción, una URL loopback se bloquea expresamente y el CMS muestra que la traducción automática está disponible desde el entorno local. La edición manual, el selector público y todas las traducciones ya guardadas continúan funcionando sin LibreTranslate.
