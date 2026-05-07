# Product Marketing Context — Axiostock
*Last updated: mayo 2025*

---

## Product Overview

**One-liner:** El sistema de gestión de ventas e inventario para negocios uruguayos que quieren crecer sin perder el control.

**What it does:** Axiostock es una plataforma SaaS multi-tenant que centraliza el punto de venta, el inventario en tiempo real (multi-sucursal), la gestión de pedidos, los reportes financieros con insights de IA, una tienda online integrada y la facturación electrónica DGI (e-Factura / CFE vía Biller v2).

**Product category:** Software de gestión comercial / ERP liviano para PyMEs

**Product type:** SaaS web (con roadmap hacia PWA/móvil)

**Business model:** Suscripción mensual por organización (multi-tenancy); potencial canal indirecto a través de contadores

---

## Target Audience

**Target companies:** PyMEs uruguayas — comercios, almacenes, tiendas de ropa/calzado, ferreterías, minimercados, distribuidoras — con 1 a 5 sucursales y entre 1 y 15 empleados.

**Decision-makers:**
- Dueño/a del negocio (principal)
- Contador/a externo que asesora al cliente (canal indirecto clave)
- Encargado/a de administración en negocios más estructurados

**Primary use case:** Controlar las ventas, la caja y el stock desde un solo lugar — especialmente en negocios que hoy usan planillas de Excel, cuadernos o sistemas desconectados.

**Jobs to be done:**
- Saber exactamente cuánto stock hay en cada sucursal, en tiempo real
- Cerrar la caja al final del día y detectar diferencias antes de que se vayan de las manos
- Emitir facturas electrónicas (e-Factura/e-Ticket) sin salir del sistema
- Tener reportes claros sin depender de que alguien los arme a mano
- Vender también online sin montar una infraestructura aparte

**Use cases:**
- Punto de venta (POS) con control de caja por operador
- Gestión de inventario multi-sucursal en tiempo real
- Facturación electrónica DGI integrada (CFE)
- Reportes financieros y operativos con IA
- Tienda online integrada al mismo inventario
- Gestión de pedidos y proveedores

---

## Personas

| Persona | Cares about | Challenge | Value we promise |
|---------|-------------|-----------|------------------|
| **El dueño pragmático** (40–60 años, negocio físico con 2–4 empleados) | Que no le roben, que el stock no falle, cerrar el mes con números claros | No tiene tiempo para aprender sistemas complejos; desconfía de la tecnología | Control total del negocio desde el celular, sin complicarse |
| **El emprendedor en crecimiento** (25–40 años, abriendo segunda sucursal) | Escalar sin perder el control; profesionalizar la operación | Coordinar dos puntos de venta con WhatsApp y Excel ya no alcanza | Multi-sucursal real, en tiempo real, desde el día uno |
| **El contador asesor** (profesional que gestiona 5–20 clientes PyME) | Que sus clientes cumplan con DGI, que los números cuadren | Cada cliente usa un sistema diferente (o ninguno); perder tiempo en "arreglar" datos | Un sistema que ya viene listo para DGI y le simplifica la vida a él también |
| **El encargado/administrador** (empleado que opera el día a día) | Que el sistema sea rápido y no lo complique en hora pico | Sistemas lentos, poco intuitivos, que fallan cuando más los necesita | POS ágil, auditoría de caja clara, sin margen para errores |

---

## Problems & Pain Points

**Core problem:** Los comercios uruguayos no tienen visibilidad real de lo que pasa en su negocio. El stock se maneja de memoria o en Excel, la caja se cierra con diferencias que nadie explica, y la facturación electrónica es un trámite aparte que da miedo.

**Why alternatives fall short:**
- **Excel/cuadernos:** No escalan, no dan tiempo real, no integran DGI, no detectan errores hasta que es tarde
- **Sistemas legacy locales (System32, etc.):** Instalación complicada, sin acceso remoto, sin multi-sucursal real, interfaz anticuada
- **Bsale / iPos / Dragonfish / Tivendo:** Soluciones más completas pero con curva de aprendizaje alta, precios elevados, o sin diferencial fuerte en DGI + multi-sucursal simultáneo

**What it costs them:**
- Pérdidas por robo interno no detectado (caja, stock)
- Tiempo perdido armando reportes manualmente
- Multas o complicaciones con DGI por facturas mal emitidas
- Decisiones de compra basadas en intuición, no en datos
- Fricción al escalar: abrir una sucursal nueva es un caos operativo

**Emotional tension:** "Sé que debería tener esto más ordenado, pero tampoco quiero meterme en un sistema que me complique más la vida."

---

## Competitive Landscape

**Direct:**
- **Bsale** — solución más conocida en la región, pero percibida como costosa y con soporte lejano para Uruguay
- **iPos** — foco en gastronomía, no cubre bien retail/inventario general
- **Dragonfish** — presente en Uruguay, pero interfaz legacy y poca innovación
- **Tivendo** — alternativa local, pero sin diferenciación clara en DGI + multi-sucursal
- **System32** — sistema instalado local, sin acceso remoto, sin cloud

**Secondary:**
- **Excel + facturación manual DGI** — la "no-solución" más usada; el benchmark real contra el que competimos

**Indirect:**
- **Mercado Libre / tiendas online independientes** — negocios que digitalizaron solo el canal de ventas pero no el backoffice

---

## Differentiation

**Key differentiators:**
- Facturación electrónica DGI (CFE) integrada nativamente — no es un add-on, es parte del flujo de venta
- Inventario multi-sucursal en tiempo real — stock actualizado en todas las sucursales al instante
- Tienda online integrada al mismo inventario — no hay doble carga de datos
- Auditoría de caja por operador — cada peso que falta queda registrado, con quién, cuándo y cuánto
- Insights de IA sobre datos del propio negocio — no métricas genéricas, sino alertas y tendencias propias
- Hecho para Uruguay — no adaptado, pensado desde acá

**How we do it differently:** Todo en una sola plataforma, sin integraciones frágiles entre sistemas distintos. La venta siempre se registra primero; la factura DGI es una consecuencia, nunca un bloqueante.

**Why that's better:** Menos fricción en la operación diaria, menos puntos de falla, menos tiempo pegando sistemas que no hablan entre sí.

**Why customers choose us:** Porque es el único sistema que les da control real del inventario, la caja y la DGI en un solo lugar — y que realmente entiende cómo funciona un negocio uruguayo.

---

## Objections

| Objection | Response |
|-----------|----------|
| "Ya usamos Excel y nos arreglamos" | Excel no te avisa cuando el stock se acaba, no detecta diferencias de caja, y no emite facturas electrónicas. Cuando querés crecer, Excel te frena. |
| "Es complicado de implementar" | Onboarding guiado, catálogo de productos pre-cargado, y el sistema operativo en el primer día. Sin instalar nada. |
| "No sé si lo voy a usar" | Diseñado para que cualquier empleado lo use sin capacitación. Si sabés operar un celular, podés usar Axiostock. |
| "¿Y si el sistema falla en medio de una venta?" | La venta siempre se guarda primero. La factura DGI se emite como paso secundario — nunca bloquea una venta. |
| "Ya tengo un sistema" | Si tu sistema actual no tiene multi-sucursal en tiempo real, factura DGI integrada y auditoría de caja por operador, no tenés control real. |
| "Es muy caro" | ¿Cuánto te cuesta no saber cuánto falta en la caja cada día? El costo del descontrol siempre es mayor. |

**Anti-persona:** Grandes empresas con departamento de IT propio, necesidades de ERP completo (contabilidad, RRHH, nómina), o negocios que solo venden online sin stock físico.

---

## Switching Dynamics

**Push (por qué se van de lo que tienen):**
- Excel ya no alcanza para coordinar dos sucursales
- Les cayó una multa o problema con DGI
- Descubrieron diferencias de caja que no podían explicar
- El negocio creció y el sistema anterior se quedó chico

**Pull (por qué eligen Axiostock):**
- DGI integrado sin complicaciones extra
- Control de caja con auditoría por operador
- Stock en tiempo real en todas las sucursales
- Recomendación del contador

**Habit (lo que tienen que dejar):**
- El Excel de stock que actualiza el encargado
- La planilla de caja a mano al cierre
- El portal de DGI aparte para facturar

**Anxiety (lo que les da miedo del cambio):**
- Perder datos al migrar
- Que los empleados no aprendan a usarlo
- Que falle en el momento de más venta
- Costo del sistema sin ver retorno claro

---

## Customer Language

**How they describe the problem:**
- "Siempre hay plata que falta y nunca sé de dónde"
- "El stock nunca cuadra cuando lo revisamos"
- "Tengo que llamar a la sucursal para saber si hay mercadería"
- "La factura electrónica es un quilombo"
- "No tengo tiempo de armar informes, y cuando los armo ya son viejos"

**How they describe us:**
- "El sistema que te dice exactamente qué pasa en tu negocio"
- "Como tener un encargado que no te falla"

**Words to use:**
- Control, visibilidad, tiempo real, sin complicaciones, tu negocio, Uruguay, DGI, sucursal, caja, stock, pérdidas, diferencias, datos propios

**Words to avoid:**
- "Solución integral", "ecosistema", "suite", "end-to-end", "empoderamiento", "disruptivo", "innovación" (sin contexto concreto)
- Tecnicismos que suenen a startup tech extranjera

**Glossary:**

| Term | Meaning en contexto Axiostock |
|------|-------------------------------|
| CFE | Comprobante Fiscal Electrónico — la factura electrónica DGI |
| e-Factura / e-Ticket | Tipos de CFE más comunes en comercio minorista uruguayo |
| Biller v2 | Proveedor de integración DGI que usa Axiostock |
| Sucursal | Punto físico de venta; Axiostock soporta múltiples en tiempo real |
| Sesión de caja | Apertura y cierre de caja por operador, con auditoría de diferencias |
| PyME | Pequeña y mediana empresa — público objetivo principal |

---

## Brand Voice

**Tone:** Directo, concreto, sin rodeos. Habla de igual a igual con el dueño del negocio. No es corporativo ni vendedor. Es como el amigo que sabe de sistemas y te explica sin hacerte sentir tonto.

**Style:** Rioplatense uruguayo — "vos", "sabés", "quilombo", "arreglamos". Frases cortas. Preguntas que incomodan un poco (las que el dueño ya se hace). Datos concretos, no abstracciones.

**Personality:**
- Confiable pero no aburrido
- Técnico pero accesible
- Audaz sin ser agresivo
- Uruguayo sin folklore innecesario

**Visual identity:**
- Fondo: navy profundo `#1c1d33`
- Acento: rojo `#fd2525`
- Tipografía: BricolageGrotesque (titulares), WorkSans (cuerpo), GeistMono / IBMPlexMono (datos/código)
- Estética: terminal/datos — tablas, logs, monospace — que transmiten precisión y control

---

## Proof Points

**Metrics:** *(a completar con datos reales en cuanto haya usuarios activos)*
- Control de diferencias de caja por operador, en tiempo real
- Stock multi-sucursal actualizado al instante
- CFE emitida sin salir del flujo de venta

**Customers:** *(en construcción — early adopters en Uruguay)*

**Testimonials:** *(pendiente)*

**Value themes:**

| Theme | Proof |
|-------|-------|
| Control de caja | Auditoría por operador: cada peso que falta queda registrado — con quién, cuándo y cuánto |
| Stock sin sorpresas | Inventario multi-sucursal en tiempo real — sin llamar, sin esperar |
| DGI sin drama | CFE integrada al flujo de venta — la factura es una consecuencia, no un trámite aparte |
| Datos que sirven | Insights de IA sobre los propios datos del negocio — no métricas genéricas |
| Hecho para Uruguay | Pensado desde acá, no adaptado de otro mercado |

---

## Goals

**Business goal:** Capturar PyMEs uruguayas como clientes recurrentes de suscripción mensual; establecer canal indirecto a través de contadores como multiplicador de crecimiento.

**Conversion action:**
- Principal: Registro en prueba gratuita / demo en stock.bookit.digital
- Secundaria: Contacto directo vía Instagram @axiostock o formulario de la landing

**Current metrics:** *(en etapa temprana — métricas de adquisición orgánica vía Instagram y referidos)*
