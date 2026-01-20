# 🔧 Solución Inmediata: DNS Apunta a IPs Incorrectas

## ⚠️ Problema Actual
Tu dominio resuelve a:
- ❌ `13.248.243.5` (IP incorrecta - probablemente AWS)
- ❌ `76.223.105.230` (IP incorrecta - probablemente AWS)

**Debe apuntar a:**
- ✅ `72.60.145.210` (IP de tu servidor Dokploy)

---

## 📋 Pasos Inmediatos en GoDaddy

### Paso 1: Acceder a DNS
1. Ve a: https://dcc.godaddy.com
2. Inicia sesión
3. Clic en **"Mis Productos"**
4. Busca tu dominio y haz clic
5. Busca **"DNS"** o **"Zona DNS"** → Clic en **"Administrar"**

### Paso 2: Identificar Registros Problemáticos

Busca en la lista TODOS los registros que tengan estas IPs:
- `13.248.243.5`
- `76.223.105.230`

**También busca:**
- Cualquier registro CNAME que pueda estar causando el problema
- Múltiples registros A para el mismo nombre

### Paso 3: ELIMINAR Registros Incorrectos

Para cada registro que encuentres con IPs incorrectas:

1. **Haz clic en el ícono de eliminar** (🗑️ o "Eliminar")
2. **Confirma la eliminación**
3. **Repite para todos los registros incorrectos**

### Paso 4: Crear/Editar Registros Correctos

#### Para el dominio raíz (@):

**Si YA EXISTE un registro A para @:**
1. Haz clic en **"Editar"** (✏️)
2. Cambia el **"Valor"** o **"Points to"** a: `72.60.145.210`
3. Guarda

**Si NO EXISTE:**
1. Haz clic en **"Agregar"** o **"Añadir registro"**
2. Completa:
   - **Tipo**: `A`
   - **Nombre**: `@` (o deja en blanco)
   - **Valor**: `72.60.145.210`
   - **TTL**: `600` (o por defecto)
3. Guarda

#### Para www:

**Si YA EXISTE un registro A para www:**
1. Haz clic en **"Editar"** (✏️)
2. Cambia el **"Valor"** o **"Points to"** a: `72.60.145.210`
3. Guarda

**Si NO EXISTE:**
1. Haz clic en **"Agregar"** o **"Añadir registro"**
2. Completa:
   - **Tipo**: `A`
   - **Nombre**: `www`
   - **Valor**: `72.60.145.210`
   - **TTL**: `600` (o por defecto)
3. Guarda

---

## ✅ Configuración Final Esperada

Después de los cambios, tu zona DNS debería tener:

```
Tipo    Nombre    Valor            TTL
----    ------    -----            ---
A       @         72.60.145.210    600
A       www       72.60.145.210    600
```

**NO debe haber:**
- ❌ Registros A con `13.248.243.5`
- ❌ Registros A con `76.223.105.230`
- ❌ CNAME en la raíz (@)
- ❌ Múltiples registros A para el mismo nombre

---

## 🔍 Verificación Inmediata

### Opción 1: Herramienta Online (Recomendado)
1. Ve a: https://www.whatsmydns.net
2. Ingresa tu dominio
3. Selecciona tipo **"A"**
4. Verifica que todas las ubicaciones muestren `72.60.145.210`

### Opción 2: Desde Terminal
```bash
# Verificar dominio raíz
dig tudominio.com A +short
# Debe mostrar: 72.60.145.210

# Verificar www
dig www.tudominio.com A +short
# Debe mostrar: 72.60.145.210
```

### Opción 3: Navegador
1. Abre una ventana de incógnito
2. Ve a: `http://tudominio.com`
3. Debería cargar tu aplicación de Dokploy

---

## ⏱️ Tiempo de Propagación

- **Mínimo**: 15-30 minutos
- **Promedio**: 1-2 horas
- **Máximo**: 48 horas (raro)

**Mientras esperas:**
- Los cambios ya están guardados en GoDaddy
- La propagación es gradual (algunos lugares verán el cambio antes que otros)
- Puedes verificar periódicamente en whatsmydns.net

---

## 🚨 Problemas Comunes

### "Sigo viendo las IPs incorrectas después de 1 hora"

**Solución:**
1. Verifica que los cambios se guardaron en GoDaddy (vuelve a la gestión DNS)
2. Limpia la caché DNS local:
   ```bash
   # macOS
   sudo dscacheutil -flushcache
   
   # Windows
   ipconfig /flushdns
   ```
3. Prueba desde tu móvil con datos (no WiFi)
4. Usa whatsmydns.net para ver el estado global

### "Hay múltiples registros A para @"

**Solución:**
- Elimina TODOS los registros A para @
- Crea UN SOLO registro A apuntando a `72.60.145.210`

### "GoDaddy dice que no puedo eliminar un registro"

**Solución:**
- Algunos registros pueden estar bloqueados
- Intenta editarlos en lugar de eliminarlos
- Cambia el valor a `72.60.145.210`

### "El dominio funciona pero www no (o viceversa)"

**Solución:**
- Verifica que ambos registros (@ y www) existan
- Ambos deben apuntar a `72.60.145.210`
- Si solo quieres uno, configura redirección en Dokploy

---

## 📝 Checklist Final

Antes de cerrar GoDaddy, verifica:

- [ ] No hay registros A con `13.248.243.5`
- [ ] No hay registros A con `76.223.105.230`
- [ ] Existe registro A para `@` apuntando a `72.60.145.210`
- [ ] Existe registro A para `www` apuntando a `72.60.145.210`
- [ ] No hay CNAME conflictivos en la raíz
- [ ] Los cambios están guardados

---

## 🎯 Siguiente Paso

Una vez que el DNS se propague (verificado en whatsmydns.net):

1. **En Dokploy:**
   - Ve a la configuración de dominios
   - Agrega tu dominio si no está agregado
   - Habilita SSL/HTTPS (Let's Encrypt)

2. **Actualiza variables de entorno:**
   ```
   VITE_APP_URL=https://tudominio.com
   ```
   ⚠️ **Importante**: Después de cambiar variables `VITE_*`, reconstruye la aplicación en Dokploy

3. **Verifica que todo funcione:**
   - El sitio carga correctamente
   - HTTPS funciona
   - Las conexiones a Supabase funcionan

---

## 💡 Nota Importante

Las IPs `13.248.243.5` y `76.223.105.230` son IPs de AWS. Esto podría significar que:
- GoDaddy tenía algún servicio de hosting/proxy configurado
- Había registros DNS antiguos de otro servicio
- Alguien configuró esos registros anteriormente

Al eliminarlos y configurar la IP correcta de Dokploy, el dominio debería funcionar correctamente.
