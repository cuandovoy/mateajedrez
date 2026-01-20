# Configurar Dominio de GoDaddy con Dokploy

Esta guía te ayudará a conectar tu dominio de GoDaddy con tu aplicación desplegada en Dokploy.

## Prerrequisitos

- ✅ Tienes un dominio registrado en GoDaddy
- ✅ Tienes acceso al panel de GoDaddy
- ✅ Tu aplicación está desplegada en Dokploy
- ✅ Tienes acceso al panel de Dokploy

## Paso 1: Obtener la IP o URL de Dokploy

1. En el panel de Dokploy, ve a tu proyecto desplegado
2. Busca la sección de **"Domains"** o **"Networking"**
3. Anota la **IP pública** del servidor de Dokploy o la **URL** que Dokploy te proporciona
   - Ejemplo de IP: `123.45.67.89`
   - Ejemplo de URL: `tu-servidor.dokploy.com`

## Paso 2: Configurar DNS en GoDaddy

### Opción A: Usar Registro A (Recomendado para IP estática)

1. **Inicia sesión en GoDaddy**
   - Ve a [dcc.godaddy.com](https://dcc.godaddy.com)
   - Inicia sesión con tu cuenta

2. **Accede a la gestión de DNS**
   - Busca "Mis Productos" o "Mis Dominios"
   - Haz clic en tu dominio
   - Busca la sección **"DNS"** o **"Zona DNS"**

3. **Agrega o edita el registro A**
   - Busca la sección de registros DNS
   - Si ya existe un registro A para `@` (o raíz), edítalo
   - Si no existe, agrega uno nuevo:
     - **Tipo**: `A`
     - **Nombre/Host**: `@` (o deja en blanco, significa el dominio raíz)
     - **Valor/Points to**: `[IP de tu servidor Dokploy]`
     - **TTL**: `600` (o el valor por defecto)

4. **Agrega registro A para www (opcional)**
   - **Tipo**: `A`
   - **Nombre/Host**: `www`
   - **Valor/Points to**: `[IP de tu servidor Dokploy]` (la misma IP)
   - **TTL**: `600`

### Opción B: Usar CNAME (Si Dokploy te da una URL)

1. **En GoDaddy, accede a la gestión de DNS**

2. **Agrega registro CNAME**
   - **Tipo**: `CNAME`
   - **Nombre/Host**: `@` o `www`
   - **Valor/Points to**: `[URL de Dokploy]` (ej: `tu-servidor.dokploy.com`)
   - **TTL**: `600`

**Nota**: Algunos proveedores DNS no permiten CNAME en la raíz (`@`). En ese caso, usa el registro A.

## Paso 3: Configurar el Dominio en Dokploy

1. **En el panel de Dokploy**
   - Ve a tu proyecto
   - Busca la sección **"Domains"** o **"Custom Domains"**
   - Haz clic en **"Add Domain"** o **"Agregar Dominio"**

2. **Agrega tu dominio**
   - Ingresa tu dominio: `tudominio.com`
   - Si quieres incluir www: `www.tudominio.com`
   - Guarda los cambios

3. **Dokploy te mostrará instrucciones específicas**
   - Sigue las instrucciones que Dokploy te proporcione
   - Puede que necesites verificar la propiedad del dominio

## Paso 4: Configurar SSL/HTTPS (Let's Encrypt)

Dokploy generalmente puede configurar SSL automáticamente con Let's Encrypt:

1. **En la configuración del dominio en Dokploy**
   - Busca la opción **"SSL"** o **"HTTPS"**
   - Habilita **"Let's Encrypt"** o **"Auto SSL"**
   - Dokploy intentará obtener el certificado automáticamente

2. **Verificación**
   - Asegúrate de que los registros DNS estén propagados (puede tardar hasta 48 horas, pero generalmente es más rápido)
   - Dokploy verificará que el dominio apunta correctamente antes de emitir el certificado

## Paso 5: Actualizar Variables de Entorno

Una vez que tengas el dominio configurado, actualiza las variables de entorno en Dokploy:

1. **Ve a la configuración del proyecto en Dokploy**
2. **Variables de Entorno**
   - Actualiza `VITE_APP_URL`:
     ```
     VITE_APP_URL=https://tudominio.com
     ```
   - O si usas www:
     ```
     VITE_APP_URL=https://www.tudominio.com
     ```

3. **Reconstruye la aplicación**
   - Las variables de entorno `VITE_*` se inyectan en tiempo de build
   - Necesitas hacer un nuevo build después de cambiar estas variables
   - En Dokploy, haz clic en **"Rebuild"** o **"Redeploy"**

## Paso 6: Verificar la Propagación DNS

Puedes verificar si los DNS se han propagado usando herramientas online:

1. **Herramientas de verificación DNS**
   - [whatsmydns.net](https://www.whatsmydns.net)
   - [dnschecker.org](https://dnschecker.org)
   - Ingresa tu dominio y verifica que apunte a la IP correcta

2. **Desde la terminal (opcional)**
   ```bash
   # Verificar registro A
   dig tudominio.com A
   
   # O con nslookup
   nslookup tudominio.com
   ```

## Paso 7: Redirección www a no-www (Opcional)

Si quieres que `www.tudominio.com` redirija a `tudominio.com` (o viceversa):

1. **En Dokploy**
   - Configura ambos dominios (con y sin www)
   - Dokploy generalmente maneja esto automáticamente
   - O puedes configurar una redirección en nginx

2. **O en GoDaddy**
   - Ve a la configuración del dominio
   - Busca "Forwarding" o "Redirección"
   - Configura la redirección deseada

## Troubleshooting

### El dominio no carga

1. **Verifica la propagación DNS**
   - Espera al menos 1-2 horas después de hacer los cambios
   - Usa herramientas de verificación DNS

2. **Verifica que la IP sea correcta**
   - Asegúrate de que el registro A apunte a la IP correcta de Dokploy

3. **Verifica el firewall**
   - Asegúrate de que el puerto 80 y 443 estén abiertos en el servidor de Dokploy

### El certificado SSL no se emite

1. **Verifica que el DNS esté propagado**
   - Let's Encrypt necesita verificar que el dominio apunta correctamente

2. **Verifica que el puerto 80 esté accesible**
   - Let's Encrypt necesita acceso al puerto 80 para la verificación HTTP-01

3. **Reintenta la emisión del certificado**
   - En Dokploy, intenta emitir el certificado nuevamente

### Error 502 Bad Gateway

1. **Verifica que la aplicación esté corriendo**
   - En Dokploy, verifica el estado del contenedor

2. **Verifica los logs**
   - Revisa los logs de la aplicación en Dokploy

### Variables de entorno no se aplican

1. **Recuerda reconstruir**
   - Las variables `VITE_*` se inyectan en tiempo de build
   - Debes hacer un rebuild después de cambiar estas variables

## Configuración Final Recomendada

Una vez configurado, tu setup debería verse así:

```
DNS en GoDaddy:
- @ (A) → IP de Dokploy
- www (A) → IP de Dokploy (o CNAME a @)

Dokploy:
- Dominio: tudominio.com
- SSL: Habilitado (Let's Encrypt)
- Puerto: 80 (HTTP) y 443 (HTTPS)

Variables de Entorno:
- VITE_SUPABASE_URL=tu_url_supabase
- VITE_SUPABASE_ANON_KEY=tu_key_supabase
- VITE_APP_URL=https://tudominio.com
```

## Notas Importantes

- ⏱️ **Propagación DNS**: Los cambios DNS pueden tardar entre 15 minutos y 48 horas en propagarse completamente
- 🔒 **SSL**: El certificado SSL se renueva automáticamente con Let's Encrypt
- 🔄 **Rebuild**: Siempre reconstruye la aplicación después de cambiar variables `VITE_*`
- 📝 **Logs**: Revisa los logs en Dokploy si hay problemas

## Soporte Adicional

Si tienes problemas:
1. Revisa los logs en Dokploy
2. Verifica la configuración DNS con herramientas online
3. Consulta la documentación de Dokploy
4. Verifica que tu aplicación esté funcionando correctamente en la URL temporal de Dokploy
