import { Mail, Shield, Code, FileText, Lock } from 'lucide-react';
import { version } from '../../package.json';

export function HelpInfo() {
  const signatureSrc = import.meta.env.DEV ? '/images/Oscar(1).png' : './images/Oscar(1).png';
  const platform = navigator.userAgent.includes('Electron')
    ? 'Aplicación de escritorio (Windows)'
    : 'Web';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center py-8">
        <h1 className="text-3xl font-bold text-slate-800">Ayuda e Información</h1>
        <p className="text-slate-500 mt-2">FincaControl · Sistema de Gestión Ganadera</p>
      </div>

      {/* Creator signature */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 p-8 text-center">
          <img
            src={signatureSrc}
            alt="Firma del creador"
            className="mx-auto h-32 object-contain mb-4"
          />
          <h2 className="text-xl font-bold text-white">Oscar David Vega Daza</h2>
          <p className="text-slate-400 text-sm mt-1">Creador y Desarrollador del Software</p>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 flex-shrink-0">
              <Shield size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">Licencia de Uso</h3>
              <p className="text-sm text-slate-600 mt-1">
                Este software es propiedad de <strong>Oscar David Vega Daza</strong>. Usted esta
                utilizando este sistema bajo licencia. La propiedad intelectual y del codigo fuente
                le pertenecen en su totalidad al creador.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 flex-shrink-0">
              <Code size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">Propiedad Intelectual</h3>
              <p className="text-sm text-slate-600 mt-1">
                Todo el código fuente, diseño, estructura y funcionalidades de este sistema son
                propiedad intelectual de <strong>Oscar David Vega Daza</strong>. Esta prohibida
                la copia, modificación, distribución o uso no autorizado del código sin el
                consentimiento expreso del creador.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 flex-shrink-0">
              <Lock size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">Restricciones</h3>
              <p className="text-sm text-slate-600 mt-1">
                La licencia otorgada es para uso exclusivo en la finca autorizada. No se permite
                la transferencia, venta o cesión de esta licencia a terceros sin autorización
                previa del creador.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Support contact */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Mail size={20} className="text-emerald-600" />
          Soporte Técnico
        </h3>
        <p className="text-sm text-slate-600 mb-4">
          Para cualquier consulta, reporte de errores, solicitud de nuevas funcionalidades o
          soporte técnico, comuníquese al siguiente correo electrónico:
        </p>
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
          <div className="flex items-center gap-3">
            <Mail size={18} className="text-slate-500" />
            <div>
              <p className="text-sm font-medium text-slate-800">Correo de soporte:</p>
              <a
                href="mailto:enterprisesystemsvegadaza@gmail.com?subject=Sistema Ganaderia"
                className="text-emerald-600 hover:text-emerald-700 font-medium text-sm"
              >
                enterprisesystemsvegadaza@gmail.com
              </a>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-200">
            <p className="text-xs text-slate-500">
              <strong>Importante:</strong> En el asunto del correo debe indicar{' '}
              <span className="font-semibold text-slate-700">"Sistema Ganaderia"</span> para que
              su solicitud sea atendida correctamente.
            </p>
          </div>
        </div>
      </div>

      {/* System info */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <FileText size={20} className="text-slate-500" />
          Información del Sistema
        </h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Sistema:</span>
              <span className="font-medium text-slate-800">FincaControl - Gestión Ganadera</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Versión:</span>
              <span className="font-medium text-slate-800">{version}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Plataforma:</span>
              <span className="font-medium text-slate-800">{platform}</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Desarrollador:</span>
              <span className="font-medium text-slate-800">Oscar David Vega Daza</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Licencia:</span>
              <span className="font-medium text-slate-800">Activa</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Soporte:</span>
              <a
                href="mailto:enterprisesystemsvegadaza@gmail.com?subject=Sistema%20Ganaderia"
                className="font-medium text-emerald-700 hover:text-emerald-800"
              >
                enterprisesystemsvegadaza@gmail.com
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-6">
        <p className="text-xs text-slate-400">
          Derechos reservados (c) Oscar David Vega Daza. Todos los derechos de propiedad
          intelectual reservados.
        </p>
      </div>
    </div>
  );
}
