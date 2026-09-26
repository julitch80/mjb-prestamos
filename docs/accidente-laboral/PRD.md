# PRD — Accidente laboral (pestaña Gestión del Riesgo)

Estado: APROBADO por Julián el 26-sep-2026.

## Problema
Cuando un docente o administrativo se accidenta en el colegio, nadie tiene a la mano qué
hacer, a quién llamar ni el plazo del reporte (FURAT, máximo 48 horas, lo firma la
rectora). El reporte se vence o la rectora se entera tarde, y el COPASST no tiene registro
de dónde ni por qué pasan los accidentes para prevenirlos.

## Quiénes (decisión de Julián, 26-sep-2026)
- **Docentes y directivos docentes** — FOMAG (Decreto 1655 de 2015): FURAT ≤ 48 h,
  firmado por la **rectora**, radicado en el canal vigente del FOMAG.
- **Administrativos y contratistas en el colegio (secretaría, biblioteca, restaurante
  escolar, tienda)** — NO van por HORUS: los reporta su empleador o contratista ante su
  propia ARL. Aquí: ruta inmediata + registro interno para el COPASST, sin seguimiento de
  FURAT (decisión de Julián, 26-sep-2026).
- Estudiantes NO: siguen por la Remisión al seguro que ya existe.

## COPASST del MJB
Presidenta: la rectora (responsable directa y quien firma). Coordinadores: Janneth y
Juan Diego. Representantes docentes: Gloria Gallego, Luis Javier, Julián Medina, Dolly.

## Qué hace
1. **Ruta inmediata (sin sesión, para el momento del accidente):** primero la persona
   (primeros auxilios, enlace a la guía existente, cuándo llamar al 123), luego
   «¿Quién se accidentó?» → docente / administrativo / contratista, y a cada uno SU ruta:
   a dónde ir, a quién avisar, qué plazo corre, qué evidencia guardar (fotos del sitio,
   testigos, hora exacta).
2. **Registro interno (con sesión, cualquier docente o directivo):** quién, cuándo,
   dónde en el colegio, qué pasó, lesión aparente, testigos, si fue atendido y dónde.
   Al guardar: correo automático a la rectora y a coordinación con la hora límite del
   FURAT, y notificación en el celular sin nombre ni lesión («Hay un accidente laboral
   por atender»).
3. **Borrador del FURAT** con los datos ya llenados, para copiar al canal oficial.
4. **Seguimiento (rectora, coordinadores, representantes del COPASST):**
   reportado internamente → FURAT radicado (con número y fecha) → en investigación →
   cerrado. Alertas: FURAT a las 24 y 40 horas si no está radicado; investigación a los
   15 días. Registro de la investigación: causas y acciones correctivas con responsable.
5. **Ficha de contactos y canales editable** por la rectora y los coordinadores (IPS
   vigente, canal de radicación del FURAT, líneas del FOMAG, ARL del municipio), con la
   fecha de su última verificación visible. Nada de esto va fijo en el código: el
   operador del FOMAG en Antioquia cambió en 2026 y puede volver a cambiar.
6. **Etapa 2 — Prevención:** reporte de condiciones inseguras y casi-accidentes (piso
   mojado, cable suelto, baranda floja) y un tablero de dónde y de qué tipo, para que el
   COPASST priorice.

## Qué NO hace
- No radica el FURAT ni reemplaza el canal oficial del FOMAG o la ARL.
- No decide si un accidente «es laboral»: eso lo califica el FOMAG o la ARL.
- No muestra datos de salud a quien no corresponde: el detalle lo ven la rectora, los
  coordinadores y los representantes del COPASST; la persona accidentada ve su propio
  caso. Nadie más (datos sensibles, Ley 1581 de 2012).
- No pone nombres ni lesiones en notificaciones del celular.
- No aplica a estudiantes.

## Criterios de aceptación (observables)
- A1. Desde Gestión del Riesgo, sin iniciar sesión, se llega a la ruta de un docente, de
  un administrativo y de un contratista, cada una con su canal y su plazo.
- A2. Un docente registra un accidente ficticio de prueba: a la rectora y a coordinación
  les llega el correo con la hora límite del FURAT.
- A3. El caso aparece en el seguimiento con la cuenta regresiva de 48 horas; al registrar
  el número de radicado pasa a «FURAT radicado».
- A4. Un docente que no es del COPASST no ve los casos de otros.
- A5. La rectora cambia la IPS vigente en la ficha de contactos y la ruta inmediata
  muestra la nueva, con la fecha de verificación.

## Esfuerzo
Etapa 1 (puntos 1–5): unos 2 días. Etapa 2 (punto 6): alrededor de 1 día.

## Canal de radicación del FURAT (confirmado por Julián, 26-sep-2026)
- Único canal: **Módulo SST / FURAT de la plataforma SUIM-HORUS del FOMAG**
  (https://www.fomag.gov.co/horus/). El reporte físico quedó obsoleto.
- Ingresa la rectora, un coordinador o el encargado autorizado, con sus credenciales.
- Se busca al docente o directivo docente afectado por su **cédula**, se diligencian modo,
  tiempo y lugar, y se envía. El sistema genera un **comprobante descargable con fecha y
  hora**, que es el soporte legal de la radicación ante la Secretaría y el FOMAG.
- Soporte técnico si no se puede ingresar o el usuario no está habilitado por la
  Secretaría: **Línea de soporte técnico SUIM HORUS, solo WhatsApp, 316 247 4797**
  (coincide con la publicada en fomag.gov.co/sg-sst). Va en la ficha de contactos y en la
  ruta inmediata, junto al enlace de HORUS.

Consecuencias para la app:
- El borrador del FURAT sigue el orden de ese formulario (modo, tiempo, lugar) para
  copiar y pegar. La **cédula NO se guarda en la app**: la persona que radica la digita en
  HORUS (dato que no necesitamos custodiar).
- Pasar a «FURAT radicado» exige registrar la **fecha y hora del comprobante** (y su
  número si lo trae). El comprobante como archivo NO se sube a la app: se conserva donde
  la rectoría guarda sus soportes.
- La ruta inmediata incluye el enlace directo al módulo HORUS.

## Pendiente
Ninguno: P2 resuelto (administrativos por la ARL de su empleador, no por HORUS).
