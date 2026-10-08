import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export function TerminosCondiciones() {
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

        <h1 className="text-3xl font-bold text-gray-900 mb-2">Términos y Condiciones</h1>
        <p className="text-sm text-gray-500 mb-10">Última actualización: [COMPLETAR FECHA DE PUBLICACIÓN]</p>

        <div className="space-y-8 text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Aceptación de estos términos</h2>
            <p>
              Al navegar y realizar una compra en Mates Ajedrez (
              <a href="https://www.instagram.com/matesajedrez/" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
                @matesajedrez
              </a>
              ) aceptás los presentes Términos y Condiciones. Si no estás de acuerdo con alguno de sus
              puntos, te pedimos que no utilices este sitio para realizar compras.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Identificación del vendedor</h2>
            <p>
              Esta tienda es operada por <strong>[NOMBRE COMPLETO DEL TITULAR]</strong>, con domicilio en{' '}
              <strong>Avenida España 1471, Paysandú, Uruguay</strong>. Podés contactarnos por correo electrónico a{' '}
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
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Productos, precios y disponibilidad</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Los precios publicados están expresados en pesos uruguayos ($UY) e incluyen los impuestos aplicables.</li>
              <li>
                La disponibilidad de los productos está sujeta al stock real al momento de confirmarse el
                pedido. Si un producto quedara sin stock luego de realizada la compra, te vamos a contactar
                para coordinar un cambio, reembolso o el tiempo de espera hasta reposición.
              </li>
              <li>Las fotografías de los productos son ilustrativas; pueden existir variaciones menores de color por pantalla o iluminación.</li>
              <li>[COMPLETAR: indicar si se emite algún comprobante de venta y bajo qué modalidad.]</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Medios de pago</h2>
            <p>
              Los medios de pago habilitados se muestran al finalizar la compra, en el paso de checkout.
              Al elegir un medio de pago electrónico, la transacción es procesada directamente por el
              proveedor correspondiente (por ejemplo, Mercado Pago) bajo sus propios términos y condiciones.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Envío y entrega</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>[COMPLETAR: zonas de envío disponibles.]</li>
              <li>[COMPLETAR: costo de envío y condiciones para envío gratis, si aplica.]</li>
              <li>[COMPLETAR: plazo estimado de entrega y modalidad — envío a domicilio, agencia, retiro en punto de entrega, etc.]</li>
              <li>Una vez coordinada la entrega, te vamos a mantener informado sobre el estado de tu pedido por el medio de contacto que nos hayas dado.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Cambios y devoluciones</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>[COMPLETAR: plazo para solicitar un cambio o devolución, ej. 5 días corridos desde recibido el producto.]</li>
              <li>[COMPLETAR: condiciones del producto para aceptar el cambio/devolución, ej. sin uso, con etiquetas.]</li>
              <li>[COMPLETAR: quién cubre el costo de envío en caso de cambio o devolución.]</li>
              <li>
                Esto es independiente de la garantía legal por defectos de fabricación descrita en la
                sección 7, que aplica siempre.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Garantías del comprador</h2>
            <p>
              Conforme a la <strong>Ley N.º 17.250 de Relaciones de Consumo</strong> de la República
              Oriental del Uruguay, tenés derecho a recibir un producto que coincida con lo publicado y en
              buen estado. Si el producto llega con un defecto de fabricación o no corresponde con lo
              comprado, contactanos por los medios indicados en la sección 2 para coordinar su cambio o
              reembolso.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Propiedad intelectual</h2>
            <p>
              Las imágenes, textos, logo y demás contenido de este sitio son propiedad de Mates Ajedrez o de sus
              proveedores y no pueden reproducirse ni utilizarse sin autorización previa.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Modificaciones de estos términos</h2>
            <p>
              Podemos actualizar estos Términos y Condiciones cuando sea necesario. Los cambios entran en
              vigencia desde su publicación en esta página, junto con la fecha de última actualización.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Ley aplicable</h2>
            <p>
              Estos Términos y Condiciones se rigen por las leyes de la República Oriental del Uruguay.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Contacto</h2>
            <p>
              Para cualquier consulta sobre estos Términos y Condiciones, escribinos a{' '}
              <a href="mailto:[EMAIL DE CONTACTO]" className="text-primary-600 hover:underline">
                [EMAIL DE CONTACTO]
              </a>
              .
            </p>
          </section>

          <section>
            <p className="text-sm text-gray-500">
              Ver también nuestra{' '}
              <Link to="/legal/privacidad" className="text-primary-600 hover:underline">
                Política de Privacidad
              </Link>
              .
            </p>
          </section>

        </div>
      </div>
    </div>
  )
}
