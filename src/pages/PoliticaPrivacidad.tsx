import { useNavigate } from 'react-router-dom'
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
        <p className="text-sm text-gray-500 mb-10">Última actualización: junio de 2026</p>

        <div className="space-y-8 text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Responsable del tratamiento</h2>
            <p>
              Axiostock es una plataforma SaaS de gestión de ventas e inventario para pequeñas y medianas
              empresas uruguayas. El responsable del tratamiento de los datos personales recolectados a través
              de esta plataforma es el titular del servicio, contactable a través de{' '}
              <a href="mailto:ciceridev@gmail.com" className="text-primary-600 hover:underline">
                ciceridev@gmail.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Datos que recolectamos</h2>
            <p className="mb-3">Recolectamos los siguientes tipos de datos:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Datos de cuenta:</strong> nombre completo, dirección de correo electrónico y
                contraseña (almacenada de forma cifrada) de los usuarios que se registran en la plataforma.
              </li>
              <li>
                <strong>Datos de la organización:</strong> nombre comercial, RUT de la empresa, dirección,
                configuración de la tienda y preferencias del sistema.
              </li>
              <li>
                <strong>Datos de uso:</strong> registros de actividad dentro de la plataforma, acciones
                realizadas en el panel de administración y datos de sesión.
              </li>
              <li>
                <strong>Datos de clientes finales:</strong> en tanto que las organizaciones clientas utilizan
                Axiostock para gestionar su tienda online, se procesan datos de los compradores finales,
                incluyendo nombre completo, correo electrónico, número de teléfono, dirección de envío y,
                cuando se emite factura electrónica (CFE), el RUT del comprador.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Base legal</h2>
            <p>
              El tratamiento de datos personales se rige por la{' '}
              <strong>Ley N.º 18.331 de Protección de Datos Personales</strong> de la República Oriental
              del Uruguay y su Decreto Reglamentario N.º 414/009. El tratamiento se realiza con base en:
            </p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li>El consentimiento del titular al momento de registrarse o realizar una compra.</li>
              <li>La ejecución del contrato de prestación del servicio SaaS con las organizaciones clientes.</li>
              <li>
                El cumplimiento de obligaciones legales, particularmente las relativas a la facturación
                electrónica ante la Dirección General Impositiva (DGI).
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Finalidad del tratamiento</h2>
            <p>Los datos son utilizados para:</p>
            <ul className="list-disc pl-6 mt-3 space-y-2">
              <li>Gestionar el acceso y la cuenta de los usuarios en la plataforma.</li>
              <li>Prestar el servicio de gestión de inventario, ventas, pedidos y tienda online.</li>
              <li>
                Procesar y emitir Comprobantes Fiscales Electrónicos (CFE) ante la DGI en nombre de las
                organizaciones clientes.
              </li>
              <li>Enviar comunicaciones relacionadas con el estado del servicio, actualizaciones y soporte.</li>
              <li>Cumplir con obligaciones legales y fiscales aplicables.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Compartición de datos con terceros</h2>
            <p className="mb-3">
              Axiostock no vende ni cede datos personales a terceros con fines comerciales. Los datos pueden
              ser compartidos exclusivamente con los siguientes proveedores de servicios necesarios para la
              operación de la plataforma:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Supabase:</strong> proveedor de infraestructura de base de datos y autenticación en
                la nube. Los datos se almacenan en servidores bajo los estándares de seguridad de Supabase.
              </li>
              <li>
                <strong>Biller v2:</strong> procesador de Comprobantes Fiscales Electrónicos (CFE) integrado
                con la DGI de Uruguay. Únicamente recibe los datos estrictamente necesarios para la emisión
                de facturas electrónicas.
              </li>
              <li>
                <strong>Proveedores de pago:</strong> cuando se procesan pagos a través de la tienda online,
                los datos de la transacción son procesados por el proveedor de pago seleccionado por la
                organización cliente (por ejemplo, Mercado Pago).
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Retención de datos</h2>
            <p>
              Los datos personales se conservan durante el tiempo que el contrato de suscripción esté
              vigente. Una vez rescindido el contrato, los datos se eliminan o anonimizán en un plazo
              razonable, salvo los que deban conservarse por obligaciones fiscales o legales, los cuales
              se retienen por un período de <strong>5 (cinco) años</strong> conforme a la normativa
              tributaria uruguaya.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Derechos del titular</h2>
            <p className="mb-3">
              De conformidad con la Ley N.º 18.331, los titulares de datos personales tienen derecho a:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Acceso:</strong> conocer qué datos personales propios están siendo tratados.</li>
              <li><strong>Rectificación:</strong> corregir datos inexactos o incompletos.</li>
              <li>
                <strong>Cancelación:</strong> solicitar la eliminación de datos cuando ya no sean necesarios
                para la finalidad para la que fueron recolectados.
              </li>
              <li>
                <strong>Oposición:</strong> oponerse al tratamiento de sus datos en determinadas
                circunstancias.
              </li>
            </ul>
            <p className="mt-3">
              Para ejercer cualquiera de estos derechos (derechos ARCO), podés comunicarte por correo
              electrónico a:{' '}
              <a href="mailto:ciceridev@gmail.com" className="text-primary-600 hover:underline">
                ciceridev@gmail.com
              </a>
              . Responderemos tu solicitud dentro de los plazos establecidos por la legislación vigente.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Cookies</h2>
            <p>
              Axiostock utiliza únicamente <strong>cookies técnicas de sesión</strong> necesarias para el
              funcionamiento del sistema de autenticación. No utilizamos cookies de seguimiento, publicidad
              ni analítica de terceros. No hay instalación de scripts de terceros que recopilen datos de
              navegación.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">
              9. Axiostock como encargado del tratamiento
            </h2>
            <p>
              Respecto a los datos de los compradores finales de las tiendas de nuestros clientes,
              Axiostock actúa como <strong>encargado del tratamiento</strong> en nombre de cada
              organización cliente, quien es la responsable del tratamiento frente a sus propios
              compradores. Las organizaciones clientes son responsables de cumplir con las obligaciones
              de información y consentimiento exigidas por la Ley N.º 18.331 respecto a sus compradores.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Cambios a esta política</h2>
            <p>
              Nos reservamos el derecho de actualizar esta Política de Privacidad cuando sea necesario.
              En caso de cambios significativos, notificaremos a los usuarios registrados por correo
              electrónico con al menos 15 días de anticipación.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Contacto</h2>
            <p>
              Para consultas relacionadas con el tratamiento de tus datos personales, podés escribirnos a{' '}
              <a href="mailto:ciceridev@gmail.com" className="text-primary-600 hover:underline">
                ciceridev@gmail.com
              </a>
              .
            </p>
          </section>

        </div>
      </div>
    </div>
  )
}
