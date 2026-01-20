# Solución: Dominio resuelve a IPs incorrectas

## Problema
Tu dominio está resolviendo a:
- `13.248.243.5`
- `76.223.105.230`

Pero debería apuntar a:
- `72.60.145.210` (IP de tu servidor Dokploy)

## Solución Paso a Paso

### Paso 1: Acceder a la Gestión DNS en GoDaddy

1. Ve a [dcc.godaddy.com](https://dcc.godaddy.com)
2. Inicia sesión con tu cuenta
3. Busca **"Mis Productos"** o **"Mis Dominios"**
4. Haz clic en tu dominio
5. Busca la sección **"DNS"** o **"Zona DNS"** y haz clic en **"Administrar"**

### Paso 2: Eliminar Registros Incorrectos

1. **Busca TODOS los registros A y CNAME** que apunten a IPs incorrectas:
   - Busca registros que tengan `13.248.243.5` o `76.223.105.230`
   - Busca registros CNAME que puedan estar causando el problema

2. **Elimina los registros incorrectos:**
   - Haz clic en el ícono de eliminar (🗑️) junto a cada registro incorrecto
   - Confirma la eliminación

### Paso 3: Verificar Registros Existentes

Revisa si ya existen registros A para:
- `@` (raíz del dominio)
- `www`

**Si existen pero apuntan a IPs incorrectas:**
- Edítalos para que apunten a `72.60.145.210`

**Si no existen:**
- Crea nuevos registros (ver Paso 4)

### Paso 4: Crear/Editar Registros A Correctos

#### Registro A para el dominio raíz (@)

1. Busca un registro A con nombre `@` o en blanco
2. Si existe, **edítalo**. Si no existe, **agrégalo**:
   - **Tipo**: `A`
   - **Nombre/Host**: `@` (o deja en blanco si GoDaddy lo requiere)
   - **Valor/Points to**: `72.60.145.210`
   - **TTL**: `600` (o el valor por defecto)
3. Guarda los cambios

#### Registro A para www

1. Busca un registro A con nombre `www`
2. Si existe, **edítalo**. Si no existe, **agrégalo**:
   - **Tipo**: `A`
   - **Nombre/Host**: `www`
   - **Valor/Points to**: `72.60.145.210`
   - **TTL**: `600`
3. Guarda los cambios

### Paso 5: Eliminar Registros CNAME Conflictivos (Si existen)

**IMPORTANTE**: No puedes tener un registro CNAME y un registro A para el mismo nombre.

1. Si existe un registro CNAME para `@` o `www`:
   - **ELIMÍNALO** (los CNAME no funcionan bien en la raíz)
   - Usa solo registros A

2. Si tienes un CNAME que apunta a otro dominio:
   - Elimínalo o cámbialo por un registro A

### Paso 6: Verificar la Configuración Final

Tu configuración DNS debería verse así:

```
Tipo    Nombre    Valor              TTL
----    ------    -----              ---
A       @         72.60.145.210      600
A       www       72.60.145.210      600
```

**NO deberías tener:**
- ❌ Registros A apuntando a `13.248.243.5` o `76.223.105.230`
- ❌ Registros CNAME en la raíz (@)
- ❌ Múltiples registros A para el mismo nombre con IPs diferentes

### Paso 7: Esperar la Propagación DNS

1. **Tiempo de propagación**: 15 minutos a 48 horas (generalmente 1-2 horas)
2. **Verificar propagación**:
   - Usa [whatsmydns.net](https://www.whatsmydns.net)
   - Ingresa tu dominio
   - Verifica que todas las ubicaciones muestren `72.60.145.210`

3. **Desde terminal (opcional)**:
   ```bash
   dig tudominio.com A
   # O
   nslookup tudominio.com
   ```

### Paso 8: Verificar en Dokploy

1. En Dokploy, ve a la configuración de dominios
2. Verifica que el dominio esté configurado correctamente
3. Dokploy debería poder verificar que el dominio apunta a la IP correcta

## Troubleshooting

### El dominio sigue resolviendo a IPs incorrectas después de 2 horas

1. **Limpia la caché DNS local**:
   ```bash
   # macOS
   sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder
   
   # Windows
   ipconfig /flushdns
   
   # Linux
   sudo systemd-resolve --flush-caches
   ```

2. **Verifica desde diferentes ubicaciones**:
   - Usa [whatsmydns.net](https://www.whatsmydns.net) para ver el estado global
   - Prueba desde tu móvil con datos (no WiFi)

3. **Verifica que los cambios se guardaron en GoDaddy**:
   - Vuelve a la gestión DNS
   - Confirma que los registros muestran `72.60.145.210`

### Hay múltiples registros A para el mismo nombre

**Solución**: Elimina todos excepto uno que apunte a `72.60.145.210`

### GoDaddy muestra "Registro duplicado"

1. Elimina todos los registros duplicados
2. Crea un solo registro A con la IP correcta

### El dominio funciona pero www no (o viceversa)

1. Verifica que ambos registros (`@` y `www`) apunten a `72.60.145.210`
2. Si solo quieres uno, configura una redirección en Dokploy o GoDaddy

## Verificación Final

Después de hacer los cambios, verifica:

1. ✅ Solo hay registros A apuntando a `72.60.145.210`
2. ✅ No hay registros apuntando a `13.248.243.5` o `76.223.105.230`
3. ✅ El dominio resuelve correctamente en [whatsmydns.net](https://www.whatsmydns.net)
4. ✅ El sitio carga correctamente en el navegador
5. ✅ SSL/HTTPS funciona en Dokploy

## Notas Importantes

- ⚠️ **No elimines otros registros importantes** como MX (email), TXT (verificaciones), etc.
- ⏱️ **Paciencia**: Los cambios DNS pueden tardar hasta 48 horas en propagarse completamente
- 🔄 **Verifica periódicamente**: Usa herramientas de verificación DNS para monitorear la propagación
- 📝 **Documenta**: Anota los cambios que haces por si necesitas revertirlos

## Comandos Útiles para Verificar

```bash
# Verificar resolución DNS
dig tudominio.com A +short
# Debería mostrar: 72.60.145.210

# Verificar www
dig www.tudominio.com A +short
# Debería mostrar: 72.60.145.210

# Ver todos los registros
dig tudominio.com ANY
```
