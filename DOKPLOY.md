# Configuración de Dokploy para Flormaria Soria González

Esta guía te ayudará a desplegar la aplicación e-commerce en Dokploy.

## Requisitos Previos

1. Tener una instancia de Dokploy configurada
2. Tener acceso a tu proyecto de Supabase
3. Tener las credenciales de Supabase listas

## Pasos para el Deployment

### 1. Configurar el Proyecto en Dokploy

1. En tu panel de Dokploy, crea un nuevo proyecto
2. Conecta tu repositorio Git (GitHub, GitLab, etc.)
3. Selecciona la rama que deseas desplegar (generalmente `main` o `master`)

### 2. Configuración del Build

En la configuración del proyecto en Dokploy:

- **Build Command**: No es necesario (se hace en el Dockerfile)
- **Dockerfile Path**: `Dockerfile` (debe estar en la raíz del proyecto)
- **Docker Context**: `.` (directorio raíz)

### 3. Variables de Entorno

Configura las siguientes variables de entorno en Dokploy:

```
VITE_SUPABASE_URL=tu_url_de_supabase
VITE_SUPABASE_ANON_KEY=tu_anon_key_de_supabase
VITE_APP_NAME=Flormaria Soria González
VITE_APP_URL=https://tu-dominio.com
```

**Nota**: Las variables de entorno que comienzan con `VITE_` se inyectan en el build de Vite. Asegúrate de configurarlas antes de hacer el build.

### 4. Configuración del Puerto

- **Puerto**: `80` (nginx escucha en el puerto 80)
- Dokploy manejará automáticamente el enrutamiento

### 5. Configuración de Dominio

1. En Dokploy, configura tu dominio personalizado
2. Asegúrate de que los registros DNS apunten correctamente
3. Dokploy puede configurar SSL automáticamente con Let's Encrypt

## Estructura de Archivos

Los siguientes archivos son necesarios para el deployment:

- `Dockerfile`: Define cómo construir y ejecutar el contenedor
- `nginx.conf`: Configuración de nginx para servir la SPA
- `.dockerignore`: Archivos a excluir del build
- `package.json`: Dependencias del proyecto
- `yarn.lock`: Lock file de dependencias

## Troubleshooting

### Error: "yarn install --frozen-lockfile" failed

Si encuentras este error:

1. Verifica que `yarn.lock` esté presente en el repositorio
2. Asegúrate de que el archivo no esté corrupto
3. Si el problema persiste, puedes modificar el Dockerfile para usar `yarn install` sin `--frozen-lockfile` (aunque no es recomendado)

### Error: Variables de entorno no disponibles

Las variables de entorno `VITE_*` deben estar configuradas **antes** del build. Si las agregas después, necesitarás reconstruir la imagen.

### Error: "No such container"

Este error generalmente ocurre cuando:
- El contenedor se detuvo inesperadamente
- Hay un problema con el build
- Intenta reconstruir el proyecto desde Dokploy

## Verificación Post-Deployment

Después del deployment, verifica:

1. ✅ La aplicación carga correctamente
2. ✅ Las conexiones a Supabase funcionan
3. ✅ El routing de React Router funciona (prueba navegar a diferentes páginas)
4. ✅ Las imágenes se cargan correctamente
5. ✅ El carrito funciona (tanto para usuarios logueados como invitados)

## Actualizaciones

Para actualizar la aplicación:

1. Haz push de tus cambios al repositorio
2. Dokploy detectará los cambios automáticamente (si tienes webhooks configurados)
3. O inicia manualmente un nuevo build desde el panel de Dokploy

## Notas Importantes

- El build de producción se hace en el contenedor Docker
- Las variables de entorno se inyectan en tiempo de build (no en runtime)
- Si cambias variables de entorno, necesitas reconstruir la imagen
- El contenedor usa nginx para servir los archivos estáticos
- La aplicación es una SPA (Single Page Application), por lo que todas las rutas se redirigen a `index.html`
