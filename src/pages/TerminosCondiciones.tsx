import { useNavigate } from 'react-router-dom'
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
        <p className="text-sm text-gray-500 mb-10">Última actualización: junio de 2026</p>

        <div className="space-y-8 text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Definiciones</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Plataforma:</strong> el software SaaS Axiostock, accesible en línea, que incluye
                el panel de administración, la tienda pública y todas sus funcionalidades.
              </li>
              <li>
                <strong>Cliente u Organización:</strong> la persona física o jurídica que contrata el
                servicio y es responsable del uso de la Plataforma dentro de su organización.
              </li>
              <li>
                <strong>Usuario:</strong> cualquier persona habilitada por el Cliente para acceder a la
                Plataforma (administradores, empleados, operadores de caja, etc.).
              </li>
              <li>
                <strong>Datos:</strong> toda la información ingresada, generada o almacenada en la
                Plataforma por el Cliente o sus Usuarios, incluyendo productos, inventario, clientes,
                órdenes y configuraciones.
              </li>
              <li>
                <strong>Plan:</strong> el nivel de suscripción contratado (Starter, Profesional u otros
                disponibles), que determina las funcionalidades y límites del servicio.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Objeto</h2>
            <p>
              Estos Términos y Condiciones regulan el acceso y uso de la Plataforma Axiostock en modalidad
              de suscripción mensual. Al registrarse o utilizar la Plataforma, el Cliente acepta estos
              términos en su totalidad. Si no estás de acuerdo con alguna de las condiciones aquí
              establecidas, no debés continuar utilizando el servicio.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Registro y cuenta</h2>
            <p className="mb-3">Para acceder a la Plataforma, el Cliente debe:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Registrarse con una dirección de correo electrónico válida y una contraseña segura.</li>
              <li>
                Proporcionar información veraz, completa y actualizada sobre su empresa u organización.
              </li>
              <li>
                Mantener la confidencialidad de sus credenciales de acceso. Axiostock no se responsabiliza
                por el acceso no autorizado derivado de la divulgación de credenciales por parte del Cliente.
              </li>
            </ul>
            <p className="mt-3">
              El Cliente es responsable de todas las acciones realizadas desde su cuenta y las cuentas de
              sus Usuarios.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Planes y pagos</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                El servicio se presta mediante <strong>suscripción mensual</strong> según el Plan
                seleccionado al momento del registro o actualización.
              </li>
              <li>
                Los precios vigentes son los publicados en la Plataforma en el momento de la contratación.
                Axiostock se reserva el derecho de modificar los precios con un preaviso mínimo de{' '}
                <strong>30 días</strong> mediante notificación al correo electrónico registrado.
              </li>
              <li>
                La suscripción se renueva automáticamente al inicio de cada período, salvo que el Cliente
                la cancele con anterioridad según lo indicado en la sección de Rescisión.
              </li>
              <li>
                No se realizan reembolsos por períodos ya facturados, salvo en los casos en que la
                legislación uruguaya lo requiera expresamente.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Obligaciones del Cliente</h2>
            <p className="mb-3">El Cliente se compromete a:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                Utilizar la Plataforma exclusivamente para fines lícitos y conforme a la legislación
                uruguaya vigente.
              </li>
              <li>
                No ceder, sublicenciar ni transferir el acceso a la Plataforma a terceros no autorizados
                por Axiostock.
              </li>
              <li>
                Ser el único responsable ante sus compradores y clientes finales por los datos personales
                que recolecta y trata a través de la Plataforma, de acuerdo con la Ley N.º 18.331.
              </li>
              <li>
                No intentar acceder a sistemas, datos o cuentas de otros Clientes, ni realizar acciones
                que comprometan la seguridad o estabilidad de la Plataforma.
              </li>
              <li>
                Mantener actualizada la información de su organización, incluyendo los datos de facturación
                necesarios para la emisión de CFE.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Obligaciones de Axiostock</h2>
            <p className="mb-3">Axiostock se compromete a:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                Mantener la Plataforma disponible y operativa con el mayor esfuerzo razonable
                (<em>best effort</em>), sin garantizar un tiempo de actividad específico.
              </li>
              <li>
                Informar al Cliente con anticipación razonable sobre mantenimientos programados que
                puedan afectar la disponibilidad del servicio.
              </li>
              <li>
                Mantener la confidencialidad de los Datos del Cliente y no acceder a ellos salvo para
                la prestación del servicio o cuando sea requerido por la ley.
              </li>
              <li>
                Brindar soporte técnico a través de los canales habilitados para resolver incidencias
                dentro de los plazos razonables según la criticidad del caso.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Propiedad intelectual</h2>
            <p>
              Todos los derechos de propiedad intelectual sobre la Plataforma, su código fuente, diseño,
              marcas, logotipos y documentación son propiedad exclusiva de Axiostock. El Cliente no adquiere
              ningún derecho de propiedad sobre la Plataforma por el hecho de contratarla.
            </p>
            <p className="mt-3">
              Los Datos ingresados por el Cliente son y permanecen siendo propiedad del Cliente. Axiostock
              no reclamará titularidad sobre dichos Datos y los tratará únicamente como encargado del
              tratamiento según lo indicado en la Política de Privacidad.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Limitación de responsabilidad</h2>
            <p className="mb-3">
              Axiostock no será responsable por:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                Pérdidas indirectas, lucro cesante, pérdida de datos o daños consecuentes derivados del
                uso o imposibilidad de uso de la Plataforma.
              </li>
              <li>
                Interrupciones del servicio causadas por fuerza mayor, fallas de terceros proveedores
                de infraestructura, o eventos fuera del control razonable de Axiostock.
              </li>
              <li>
                Decisiones comerciales del Cliente basadas en información generada por la Plataforma.
              </li>
            </ul>
            <p className="mt-3">
              En cualquier caso, la responsabilidad máxima de Axiostock frente al Cliente no podrá exceder
              el importe abonado por la suscripción en los últimos 3 meses.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Rescisión</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                El Cliente puede cancelar su suscripción en cualquier momento desde el panel de
                administración o comunicándose con Axiostock. La cancelación tendrá efecto al final del
                período de facturación en curso.
              </li>
              <li>
                Axiostock puede suspender o cancelar el acceso del Cliente sin previo aviso en caso de:
                incumplimiento de estos Términos, falta de pago por más de 15 días, uso fraudulento o
                actos que pongan en riesgo la seguridad de la Plataforma o de otros Clientes.
              </li>
              <li>
                Tras la rescisión, los Datos del Cliente serán conservados por un período razonable antes
                de su eliminación definitiva, de acuerdo con lo establecido en la Política de Privacidad.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Ley aplicable y jurisdicción</h2>
            <p>
              Estos Términos y Condiciones se rigen por las leyes de la{' '}
              <strong>República Oriental del Uruguay</strong>. Para cualquier controversia derivada de la
              interpretación o cumplimiento de estos Términos, las partes se someten a la jurisdicción de
              los <strong>Juzgados de la ciudad de Montevideo</strong>, con renuncia expresa a cualquier
              otro fuero que pudiera corresponder.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Contacto</h2>
            <p>
              Para consultas sobre estos Términos y Condiciones, podés escribirnos a{' '}
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
