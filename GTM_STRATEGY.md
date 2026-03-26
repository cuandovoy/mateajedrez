# Axiostock — Plan Estratégico Go-To-Market

> Análisis y hoja de ruta para salir al mercado con tracción real.
> Basado en el estado actual de producto, landing y modelo de negocio.

---

## 1. Diagnóstico del Producto

### Lo que ya está construido ✅

| Módulo | Estado |
|--------|--------|
| Tienda online pública (catálogo, carrito, checkout) | ✅ Listo |
| Gestión de productos con variantes, imágenes, códigos de barras | ✅ Listo |
| Inventario multi-sucursal con transferencias | ✅ Listo |
| Caja registradora y sesiones de caja | ✅ Listo |
| Gestión de clientes | ✅ Listo |
| Roles, permisos y auditoría | ✅ Listo |
| Reportes financieros y de ventas | ✅ Listo |
| Gestión de compras, egresos y proveedores | ✅ Listo |
| Motor de descuentos | ✅ Listo |
| Multi-tenant (múltiples organizaciones) | ✅ Listo |
| UX mobile-friendly (en progreso) | 🔄 En curso |

### Gaps que frenan la conversión ⚠️

| Problema | Impacto |
|----------|---------|
| **Landing sin screenshots reales** — `imagePlaceholder: true` en 5 de 6 módulos | Muy alto — sin prueba visual el visitante no entiende el producto |
| **Sin self-serve signup** — el CTA principal va a WhatsApp | Muy alto — frena escala y genera fricción |
| **Sin demo interactivo o sandbox** | Alto — el usuario no puede evaluar antes de comprometerse |
| **Pricing solo en UYU** — cierra la puerta a Argentina, Paraguay, Bolivia | Medio — limita expansión regional |
| **Sin testimonios con nombre/empresa real** | Medio — sin prueba social es difícil convencer |
| **Sin blog ni contenido SEO** | Medio — tráfico orgánico 0 hoy |
| **Sin integración con MercadoPago o MercadoLibre** | Medio — expectativa básica en LATAM |

---

## 2. Audiencia Objetivo

### Segmento primario (ahora)
**PyMEs y emprendimientos en Uruguay** con operación física + online:
- Tiendas de ropa, calzado, accesorios
- Ferreterías y distribuidoras
- Bazares, jugueterías, electrónica
- Negocios con 1–5 sucursales que hoy usan Excel u hojas sueltas

**Perfil de decisor**: Dueño/fundador o encargado de operaciones, 28–50 años, sin equipo IT propio. El dolor principal es el **descontrol operativo**: no sabe cuánto stock tiene, no puede ver ventas en tiempo real, depende de planillas.

### Segmento secundario (6–12 meses)
- Negocios en **Argentina, Paraguay y Bolivia** (mismo perfil, misma lengua, mismo dolor)
- **Contadores y asesores comerciales** como canal indirecto (refieren a sus clientes)

---

## 3. Propuesta de Valor — Cómo Comunicarla

### Mensaje actual (landing)
> "Tu negocio completo, en un solo lugar"

### Propuesta más afilada (recomendada)
> "El sistema que reemplaza tus planillas de Excel — stock, ventas, caja y tienda online en una sola herramienta"

**Por qué funciona mejor**: ataca el dolor concreto (Excel), no solo el beneficio abstracto ("en un solo lugar").

### Mensajes por canal
| Canal | Mensaje clave |
|-------|--------------|
| Google Ads | "Control de inventario para tiendas — desde $1.700/mes" |
| Instagram/TikTok | "¿Cuánto stock tenés hoy? ¿Sabés sin buscar?" |
| WhatsApp/referidos | "Mis clientes ya usan esto en lugar de Excel" |
| LinkedIn | "Gestión de inventario multi-sucursal para PyMEs en Uruguay" |

---

## 4. Plan Estratégico por Prioridad

---

### FASE 1 — Fundamentos (0–60 días)
> *Sin estos pasos, el resto del marketing no convierte.*

#### 4.1 Agregar screenshots reales a la landing 🔴 CRÍTICO

**Problema**: 5 de 6 módulos muestran un placeholder gris con texto "Imagen de pantalla".
Un visitante que llega a tu landing no ve el producto → no confía → no convierte.

**Acción**:
1. Tomar capturas del panel real (dashboard, inventario, caja, órdenes)
2. Reemplazar los `imagePlaceholder: true` en `Landing.tsx` por URLs reales
3. Opcional: grabá un video de 90 segundos recorriendo el flujo completo y ponélo en el hero

**Outcome**: +40–60% en tiempo en página y tasa de contacto.

---

#### 4.2 Self-Serve Signup (registro sin pasar por WhatsApp) 🔴 CRÍTICO

**Problema**: El CTA principal (`"Probar 14 días gratis"`) abre un chat de WhatsApp. Esto no escala.
El usuario espera poder registrarse solo, en cualquier momento, sin hablar con nadie.

**Acción**:
1. Crear flujo de registro público: email + contraseña → crea organización con plan `starter` en trial
2. El trial dura 14 días → al vencer, pide plan o contacta por WhatsApp
3. Trigger automático de onboarding (ver 4.3)

**Outcome**: Convierte tráfico en usuarios activos sin intervención manual.

---

#### 4.3 Onboarding Guiado (primeras 48 horas) 🔴 CRÍTICO

**Problema**: Un usuario que se registra solo y encuentra el panel vacío abandona en menos de 5 minutos.

**Acción** (checklist de bienvenida en el dashboard):
- [ ] Cargá tu primer producto
- [ ] Creá tu primera categoría
- [ ] Configurá tu sucursal
- [ ] Hacé tu primera venta de prueba
- [ ] Mirá tu primer reporte

**Milestone**: Si el usuario completa los primeros 3 pasos → activación. Medir esto como métrica principal.

---

#### 4.4 Testimonios con nombre y empresa real 🟠 ALTO

**Problema**: La sección "Testimonios" de la landing existe en la nav pero probablemente está vacía o con placeholders.

**Acción**:
1. Identificar 3–5 clientes actuales satisfechos
2. Pedir 2–3 oraciones de feedback + permiso para usar nombre y empresa
3. Foto de perfil real o logo de empresa
4. Incluir el dolor específico que resolvió Axiostock ("antes tenía Excel...")

---

### FASE 2 — Primeras Adquisiciones (30–90 días)
> *Conseguir los primeros 20–50 clientes de pago con estrategias de bajo costo.*

#### 4.5 WhatsApp como canal de ventas estructurado 🟠 ALTO

El WhatsApp ya está en el CTA. Convertirlo en un canal real:

1. **Script de conversación**: Secuencia de 3 mensajes para calificar al interesado (rubro, cantidad de sucursales, herramienta actual)
2. **Demo personalizada**: 20 minutos en Google Meet mostrando el módulo relevante para su rubro
3. **Seguimiento a los 3 días**: mensaje corto si no respondió

---

#### 4.6 Contenido en Instagram/TikTok (founder-led) 🟠 ALTO

**Por qué ahora**: No requiere presupuesto. El fundador es el mejor vendedor.

**Formato que funciona para SaaS B2B local**:
- "Así controlo el inventario de una tienda de ropa con 3 sucursales" (demo real)
- "5 cosas que no podés hacer con Excel pero sí con Axiostock"
- "Antes vs después de usar un sistema de gestión"
- Responder en comentarios de cuentas de emprendedores uruguayos

**Frecuencia mínima**: 3 posts/semana durante 60 días.

---

#### 4.7 Comunidades y grupos de WhatsApp/Facebook 🟡 MEDIO

Uruguay tiene grupos activos de emprendedores en:
- Facebook: "Emprendedores Uruguay", "Pymes Uruguay"
- WhatsApp: grupos de cámaras empresariales, gremios
- LinkedIn: grupos de comercio minorista

**Acción**: Participar con valor (responder dudas sobre gestión, no spam) → mencionar la herramienta cuando sea relevante.

---

#### 4.8 Google Ads con palabras clave de alta intención 🟡 MEDIO

**Presupuesto mínimo**: $150–300 USD/mes

**Keywords prioritarias**:
- "sistema de gestión de stock uruguay"
- "software inventario tienda pequeña"
- "control de stock para negocios"
- "reemplazar excel inventario"
- "sistema punto de venta uruguay"

**Landing específica**: No mandar al home. Crear `/inventario` o `/punto-de-venta` con copy enfocado en esa keyword.

---

### FASE 3 — Crecimiento Orgánico (60–180 días)
> *Construir activos que generen tráfico sin pagar por cada clic.*

#### 4.9 SEO: Páginas de problema/solución 🟡 MEDIO

**Oportunidad**: Las keywords de intención media tienen poca competencia en Uruguay.

**Páginas a crear** (una por tema):
1. `/blog/como-controlar-inventario-sin-excel` — búsqueda directa del dolor
2. `/blog/sistema-punto-de-venta-para-tiendas-uruguay`
3. `/blog/como-gestionar-stock-multiples-sucursales`
4. `/alternativa-a-[competidor]` — comparación directa (ver 4.11)

**Volumen bajo, conversión alta**: quien busca "cómo controlar inventario sin Excel" ya tiene el problema.

---

#### 4.10 Herramienta gratuita: Calculadora de pérdida por descontrol de stock 🟡 MEDIO

**Concepto**: Una calculadora en `/calcular-perdida-stock` que pregunta:
- Cantidad de productos
- % de productos con stock incorrecto en tu sistema
- Precio promedio

Devuelve: "Estás perdiendo ~$X USD/mes por descontrol de inventario"

**Por qué funciona**: Convierte el dolor abstracto en número concreto → CTA para probar Axiostock.
Además genera backlinks y puede viralizarse en grupos de emprendedores.

---

#### 4.11 Páginas de comparación vs competidores 🟡 MEDIO

**Competidores a mapear**:
- Excel / Google Sheets
- Tiendanube (solo e-commerce, sin gestión de stock real)
- Alegra, Contabilium (más orientados a facturación)
- Bsale (Chile, más caro)

**Formato**: `/axiostock-vs-excel`, `/axiostock-vs-tiendanube`
**Posicionamiento**: Axiostock es el único que une tienda online + inventario + caja en una sola herramienta asequible para Uruguay.

---

#### 4.12 Programa de referidos entre clientes 🟡 MEDIO

**Mecánica simple**:
- Cliente A refiere a Cliente B
- Ambos obtienen 1 mes gratis al activarse

**Implementación mínima**: Un link de referido único por cliente, rastreado en la base de datos.
Comunicarlo en el onboarding y en el panel.

---

### FASE 4 — Escala y Retención (90–360 días)

#### 4.13 Integración con MercadoPago 🔴 CRÍTICO para expansión

**Problema actual**: No hay integración visible con el gateway de pagos más usado en LATAM.

**Impacto**: Sin MercadoPago, la tienda pública solo puede capturar pedidos, no cobrar online. Esto limita severamente el valor del módulo "Tienda Online".

**Acción**: Integrar MercadoPago Checkout como método de pago en el flujo de checkout público.

---

#### 4.14 Programa de Partners: Contadores y Asesores 🟡 MEDIO

**Oportunidad**: Los contadores y asesores comerciales trabajan con decenas de PyMEs. Si recomiendan Axiostock, cada uno puede traer 5–20 clientes.

**Propuesta al partner**:
- Comisión del 15–20% recurrente por cliente referido
- Panel de partner para ver el estado de sus clientes
- Material de ventas listo para usar

---

#### 4.15 Webinar mensual para prospectos 🟡 MEDIO

**Formato**: "Cómo digitalizarte en 30 días — Demo en vivo de Axiostock"
- 45 minutos, Zoom/Google Meet
- Demostración del flujo completo
- Q&A al final
- Grabación disponible en YouTube

**Distribución**: WhatsApp grupos, Instagram stories, email lista.

---

#### 4.16 Expansión regional (Argentina, Paraguay) 📌 FUTURO

**Cuándo**: Con 30+ clientes activos en Uruguay y producto estable.

**Qué ajustar**:
- Mostrar precios en USD (más estable que ARS)
- Adaptar validaciones de RUT/CUIT por país
- Keywords SEO para "Argentina" y "Paraguay"

---

## 5. Métricas Clave a Medir

| Métrica | Qué mide | Objetivo 90 días |
|---------|----------|-----------------|
| Tasa de registro self-serve | Conversión landing → cuenta | >5% visitantes |
| Tasa de activación | Usuarios que completan onboarding | >40% registros |
| MRR (Monthly Recurring Revenue) | Salud del negocio | $UY 50.000+ |
| Churn mensual | Retención | <5% |
| CAC (Costo por cliente) | Eficiencia de adquisición | <$UY 5.000 |
| NPS (Net Promoter Score) | Satisfacción | >40 |
| Tiempo hasta primer valor | Onboarding | <20 min |

---

## 6. Quick Wins — Próximas 2 Semanas

Ordenados por impacto vs esfuerzo:

1. **[ ] Screenshots reales en la landing** — 2–3 horas de trabajo, impacto inmediato en conversión
2. **[ ] Testimonios reales x3** — 1 hora de contactar clientes actuales
3. **[ ] Flujo de registro self-serve básico** — desarrollo, pero es el desbloqueador principal
4. **[ ] Primer reel/TikTok mostrando el panel** — 1 hora, sin costo
5. **[ ] Calcular precios en USD además de UYU** — 30 minutos, abre mercado regional

---

## 7. Resumen Ejecutivo

Axiostock tiene **un producto sólido y completo** para su mercado objetivo. El problema no es el producto — es que la infraestructura de crecimiento no está lista:

- No hay forma de registrarse solo → frena escala
- No hay prueba visual del producto → frena confianza
- No hay contenido que lleve tráfico orgánico → dependencia total de referidos/WhatsApp
- No hay integración de pagos → limita el valor de la tienda online

**La prioridad #1 es desbloquear el self-serve signup.** Con eso en lugar, todo el resto del marketing tiene adónde llevar la gente.

El camino más eficiente para los primeros 50 clientes:
```
Screenshots reales + Self-serve signup + Onboarding guiado
→ Contenido orgánico (Instagram/TikTok founder-led)
→ WhatsApp estructurado como canal de ventas
→ SEO con páginas de problema/solución
→ Google Ads una vez validado el mensaje
```

---

*Documento generado el 25/03/2026 — Revisitar en 60 días con métricas reales.*
