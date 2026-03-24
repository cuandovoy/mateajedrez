# Configuración PWA - Axios Stock

## ✅ Estado Actual

Tu app ya está configurada como PWA con:
- ✅ `manifest.webmanifest` con metadatos
- ✅ Service Worker para offline support
- ✅ Meta tags PWA en `index.html`
- ✅ Variables de entorno parametrizables

## 📱 Instalación en celular

### iPhone (iOS 15+)
1. Abre la app en Safari
2. Toca el botón "Compartir" (arriba a la derecha)
3. Selecciona "Agregar a pantalla de inicio"

### Android (Chrome)
1. Abre la app en Chrome
2. Toca el botón de 3 puntos (arriba a la derecha)
3. Selecciona "Instalar app" (si aparece)

## 🎨 Personalización por negocio

Para crear una rama con diferente branding, modifica `.env`:

```env
# Mismo archivo .env pero con variables diferentes

# Nombre y descripción
VITE_APP_NAME=Mi Tienda
VITE_APP_SHORT_NAME=MiTienda
VITE_APP_DESCRIPTION=Mi negocio específico

# Colores (edita manifest.webmanifest con estos valores)
VITE_PWA_THEME_COLOR=#FF5722
VITE_PWA_BACKGROUND_COLOR=#ffffff

# Logos (coloca tus logos en /public)
VITE_PWA_ICON_PATH=/mi-logo.png
VITE_PWA_MASKABLE_ICON_PATH=/mi-logo-maskable.png
```

Luego actualiza `public/manifest.webmanifest` con tus logos.

## 🖼️ Iconos PWA

Se recomienda crear estos tamaños:

- **192x192px** - Icono estándar (cualquier dispositivo)
- **512x512px** - Icono grande (splashscreen)
- **Maskable** - Icono adaptable con máscara (Android 12+)

### Generar iconos desde logo.svg

```bash
# Si tienes ImageMagick instalado
convert -background none logo.svg -resize 192x192 favicon-192.png
convert -background none logo.svg -resize 512x512 favicon-512.png

# O usa herramientas online:
# https://realfavicongenerator.net/
```

## 📊 Verificar PWA

Abre el DevTools en Chrome:
1. `Application` → `Manifest`
2. Verifica que todos los datos sean correctos
3. `Application` → `Service Workers`
4. Confirma que el SW esté registrado

## 🚀 Deploy

### Vercel / Netlify
Automáticamente sirven los `headers` correctos para PWA.

### Servidor propio (nginx)
Agrega estos headers:

```nginx
server {
  location /manifest.webmanifest {
    add_header Content-Type "application/manifest+json";
  }
  
  location /sw.js {
    add_header Service-Worker-Allowed "/";
    add_header Cache-Control "max-age=0, no-cache, no-store, must-revalidate";
  }
}
```

## 📋 Checklist para cada negocio

- [ ] Cambiar `VITE_APP_NAME` en `.env`
- [ ] Cambiar `VITE_PWA_THEME_COLOR` (color del header)
- [ ] Cambiar logos en `/public` (logo2.png, logo3.png)
- [ ] Actualizar `manifest.webmanifest` con nuevos logos
- [ ] Actualizar `index.html` meta tags si es necesario
- [ ] Testear en iOS y Android
- [ ] Verificar en DevTools → Application

## 🔧 Troubleshooting

**La app no se instala:**
- Verifica que `manifest.webmanifest` sea válido (devtools)
- Asegúrate de que el sitio esté en HTTPS
- Revisa la consola por errores del Service Worker

**Los colores no cambian:**
- Actualiza `theme_color` en `manifest.webmanifest`
- Limpia el cache del navegador
- Desinstala y reinstala la app

**Los iconos se ven mal:**
- Genera maskable icons correctamente
- Usa PNG en lugar de SVG (mejor compatibilidad)
- Verifica tamaños (192x192, 512x512)
