import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export function PoliticaPrivacidad() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-white py-12 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-8 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </button>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">Política de Privacidad</h1>
        <p className="text-sm text-gray-500 mb-10">Última actualización: [COMPLETAR FECHA DE PUBLICACIÓN]</p>

        <div className="space-y-8 text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Responsable del tratamiento</h2>
            <p>
              Mates Ajedrez (<a href="https://www.instagram.com/matesajedrez/" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">@matesajedrez</a>) es una
              tienda online operada por <strong>[NOMBRE COMPLETO DEL TITULAR]</strong>, con domicilio en{' '}
              <strong>Avenida España 1471, Paysandú, Uruguay</strong>, responsable del tratamiento de los datos personales
              recolectados a través de este sitio. Podés contactarnos por correo electrónico a{' '}
              <a href="mailto:[EMAIL DE CONTACTO]" className="text-primary-600 hover:underline">
                [EMAIL DE CONTACTO]
              </a>{' '}
              o por WhatsApp{' '}
              <a href="https://wa.link/bdxmao" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
                escribinos acá
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Datos que recolectamos</h2>
            <p className="mb-3">Cuando comprás o navegás en nuestra tienda recolectamos:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Datos de contacto y pedido:</strong> nombre completo, correo electrónico y número de
                teléfono que nos brindás al finalizar una compra, necesarios para procesar el pedido y
                coordinar la entrega.
              </li>
              <li>
                <strong>Datos de coordinación de entrega:</strong> si nos escribís por WhatsApp o redes
                sociales para coordinar el envío o retiro de tu pedido, los datos que nos compartas en esa
                conversación (por ejemplo, dirección de entrega).
              </li>
              <li>
                <strong>Datos de cuenta:</strong> si creás una cuenta en el sitio, tu nombre y correo
                electrónico (la contraseña se almacena siempre cifrada).
              </li>
              <li>
                <strong>Datos de navegación:</strong> información técnica básica de tu visita (páginas
                vistas, dispositivo) a través de cookies estrictamente necesarias para el funcionamiento del
                sitio.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Base legal</h2>
            <p>
              El tratamiento de tus datos personales se rige por la{' '}
              <strong>Ley N.º 18.331 de Protección de Datos Personales</strong> de la República Oriental
              del Uruguay y su Decreto Reglamentario N.º 414/009. El tratamiento se realiza con base en:
            </p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li>Tu consentimiento al momento de registrarte o realizar una compra.</li>
              <li>La necesidad de procesar y entregar el pedido que realizaste.</li>
              <li>Nuestro interés legítimo en brindarte atención al cliente y responder tus consultas.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Finalidad del tratamiento</h2>
            <p>Usamos tus datos para:</p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li>Procesar tu pedido, coordinar el envío o retiro y mantenerte informado sobre su estado.</li>
              <li>Responder tus consultas por correo electrónico, WhatsApp o redes sociales.</li>
              <li>Gestionar tu cuenta, si elegiste crear una.</li>
              <li>Cumplir con obligaciones legales aplicables a la venta de productos a consumidores.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Compartición de datos con terceros</h2>
            <p className="mb-3">
              No vendemos ni cedemos tus datos personales a terceros con fines comerciales. Tus datos pueden
              ser compartidos únicamente con los proveedores estrictamente necesarios para operar la tienda:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Supabase:</strong> proveedor de infraestructura de base de datos y autenticación en
                la nube donde se almacena la información de la tienda.
              </li>
              <li>
                <strong>Procesador de pagos:</strong> si elegís pagar con un medio de pago electrónico
                (por ejemplo, Mercado Pago), los datos de esa transacción son procesados directamente por el
                proveedor de pago correspondiente — nosotros no accedemos ni almacenamos los datos de tu
                tarjeta.
              </li>
              <li>
                <strong>[COMPLETAR SI CORRESPONDE]:</strong> empresa de envíos o mensajería utilizada para
                la entrega de tu pedido, cuando aplique.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Retención de datos</h2>
            <p>
              Conservamos tus datos personales durante el tiempo necesario para procesar tu pedido y atender
              eventuales reclamos o consultas posteriores, y por un plazo adicional de{' '}
              <strong>[COMPLETAR PLAZO, ej. 2 años]</strong> por razones administrativas. Podés solicitar la
              eliminación de tus datos antes de ese plazo escribiéndonos por los medios de contacto
              indicados en la sección 1.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Tus derechos</h2>
            <p className="mb-3">
              De conformidad con la Ley N.º 18.331, tenés derecho a:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Acceso:</strong> conocer qué datos personales tuyos estamos tratando.</li>
              <li><strong>Rectificación:</strong> corregir datos inexactos o incompletos.</li>
              <li>
                <strong>Cancelación:</strong> solicitar la eliminación de tus datos cuando ya no sean
                necesarios para la finalidad para la que fueron recolectados.
              </li>
              <li>
                <strong>Oposición:</strong> oponerte al tratamiento de tus datos en determinadas
                circunstancias.
              </li>
            </ul>
            <p className="mt-3">
              Para ejercer cualquiera de estos derechos (derechos ARCO), podés escribirnos a{' '}
              <a href="mailto:[EMAIL DE CONTACTO]" className="text-primary-600 hover:underline">
                [EMAIL DE CONTACTO]
              </a>
              . Vamos a responder tu solicitud dentro de los plazos establecidos por la legislación vigente.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Cookies</h2>
            <p>
              Este sitio utiliza únicamente <strong>cookies técnicas</strong> necesarias para el
              funcionamiento del carrito de compras y, si iniciás sesión, de tu autenticación. No utilizamos
              cookies de seguimiento publicitario ni analítica de terceros.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Cambios a esta política</h2>
            <p>
              Podemos actualizar esta Política de Privacidad cuando sea necesario. Si hacemos cambios
              significativos, lo vamos a indicar en esta misma página junto con la fecha de última
              actualización.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Contacto</h2>
            <p>
              Para cualquier consulta sobre el tratamiento de tus datos personales, escribinos a{' '}
              <a href="mailto:[EMAIL DE CONTACTO]" className="text-primary-600 hover:underline">
                [EMAIL DE CONTACTO]
              </a>
              .
            </p>
          </section>

          <section>
            <p className="text-sm text-gray-500">
              Ver también nuestros{' '}
              <Link to="/legal/terminos" className="text-primary-600 hover:underline">
                Términos y Condiciones
              </Link>
              .
            </p>
          </section>

        </div>
      </div>
    </div>
  )
}
