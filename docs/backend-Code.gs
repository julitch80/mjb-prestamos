// ============================================================
// I.E. Manuel J. Betancur — Backend (Google Apps Script)
// VERSIÓN ALINEADA CON EL FRONTEND NUEVO (React/Vite)
// ============================================================
// Reemplaza TODO el contenido de tu Code.gs por este archivo.
// Después: Implementar → Administrar implementaciones → editar →
// Versión nueva → Implementar. (La URL /exec no cambia.)
// ============================================================

// ── CONFIGURACIÓN ────────────────────────────────────────────
const CONFIG = {
  SHEET_ID: '1fg73CZ0mdM6lQD7TXXxxxi3zbCyT4RbVJxg4KjagTsg',
  COORD_MANANA: 'janneth.ocampo@iemanueljbetancur.edu.co',
  COORD_TARDE:  'juan.salazar@iemanueljbetancur.edu.co',
  RECTORA:      'mjb@iemanueljbetancur.edu.co',
  PSICOORIENTADOR: 'alexander.sanchez@iemanueljbetancur.edu.co',
  NOMBRE_IE:    'I.E. Manuel J. Betancur',
  // Etapa 2 (Firebase): API Key del proyecto Firebase (pestaña Configuración
  // del proyecto en la consola). Solo se usa si el frontend envía `idToken`
  // (modo VITE_AUTH_MODE=google). Reemplazar por la clave real cuando se
  // active ese modo; con el placeholder, cualquier idToken recibido fallará
  // la validación (fail-closed), pero mientras el frontend no lo envíe
  // (modo pin, por defecto) esto no se usa.
  FIREBASE_API_KEY: 'AIzaSyD4JUcD3MOnKmGQv0xHBxqBCfwwCm5MreQ',
  FIREBASE_DOMAIN:  'iemanueljbetancur.edu.co',
};

// ── Visibilidad del gestor de casos (docs/plan-gestor-casos.md, sección 3) ──
// Apps Script no puede leer src/data/maestros.ts (vive en el frontend), así
// que estos mapas son una copia derivada a mano de DIRECTORES_MANANA /
// DIRECTORES_TARDE / USUARIOS. Si esos datos cambian en maestros.ts hay que
// actualizar esto también.
//
// grado → correo del director de grupo (mañana usa notación con punto,
// tarde usa notación con ordinal — igual que en el resto del sistema).
const DIRECTORES_CORREO = {
  '11.1': 'johana.cano@iemanueljbetancur.edu.co',
  '11.2': 'julian.medina@iemanueljbetancur.edu.co',
  '11.3': 'claudia.henao@iemanueljbetancur.edu.co',
  '10.1': 'carlos.cardenas@iemanueljbetancur.edu.co',
  '10.2': 'beatriz.montoya@iemanueljbetancur.edu.co',
  '10.3': 'ledis.quintana@iemanueljbetancur.edu.co',
  '10.4': 'adolfo.arango@iemanueljbetancur.edu.co',
  '9.1':  'gloria.alvarez@iemanueljbetancur.edu.co',
  '9.2':  'martha.usuga@iemanueljbetancur.edu.co',
  '9.3':  'uriel.lopez@iemanueljbetancur.edu.co',
  '6º1':  'luis.quiceno@iemanueljbetancur.edu.co',
  '6º2':  'john.garcia@iemanueljbetancur.edu.co',
  '6º3':  'carolina.medina@iemanueljbetancur.edu.co',
  '7º1':  'yanet.moscote@iemanueljbetancur.edu.co',
  '7º2':  'luis.rojas@iemanueljbetancur.edu.co',
  '7º3':  'harol.gomez@iemanueljbetancur.edu.co',
  '8º1':  'edgar.perez@iemanueljbetancur.edu.co',
  '8º2':  'hugo.yepes@iemanueljbetancur.edu.co',
  '8º3':  'monica.rave@iemanueljbetancur.edu.co',
  '8º4':  'juan.bettin@iemanueljbetancur.edu.co',
};

// correo (minúsculas) → id de docente, copiado de USUARIOS en maestros.ts.
// Se usa para que un docente cualquiera (que no es coordinador, rectora,
// psicoorientador ni director) solo vea los casos que él mismo generó.
const CORREO_A_DOCENTE_ID = {
  'mjb@iemanueljbetancur.edu.co': 'rectora',
  'janneth.ocampo@iemanueljbetancur.edu.co': 'coord_manana',
  'juan.salazar@iemanueljbetancur.edu.co': 'coord_tarde',
  'johana.cano@iemanueljbetancur.edu.co': 'johana',
  'beatriz.montoya@iemanueljbetancur.edu.co': 'beatriz',
  'adolfo.arango@iemanueljbetancur.edu.co': 'adolfo',
  'gloria.alvarez@iemanueljbetancur.edu.co': 'gloria_a',
  'doris.castrillon@iemanueljbetancur.edu.co': 'doris',
  'martha.usuga@iemanueljbetancur.edu.co': 'marta',
  'julian.medina@iemanueljbetancur.edu.co': 'julian',
  'carlos.cardenas@iemanueljbetancur.edu.co': 'carlos',
  'juancarlosbv@iemanueljbetancur.edu.co': 'yoguis',
  'jorge.acevedo@iemanueljbetancur.edu.co': 'jorge',
  'ledis.quintana@iemanueljbetancur.edu.co': 'ledis',
  'uriel.lopez@iemanueljbetancur.edu.co': 'uriel',
  'claudia.henao@iemanueljbetancur.edu.co': 'claudia',
  'margarita.montoya@iemanueljbetancur.edu.co': 'margara',
  'monica.cordoba@iemanueljbetancur.edu.co': 'monica_c',
  'edgar.perez@iemanueljbetancur.edu.co': 'edgar',
  'carolina.medina@iemanueljbetancur.edu.co': 'carolina',
  'monica.rave@iemanueljbetancur.edu.co': 'monica_rave',
  'fredy.gutierrez@iemanueljbetancur.edu.co': 'fredy_g',
  'john.garcia@iemanueljbetancur.edu.co': 'fredy_garcia',
  'luis.rojas@iemanueljbetancur.edu.co': 'luis_javier',
  'luz.zapata@iemanueljbetancur.edu.co': 'marina',
  'luis.quiceno@iemanueljbetancur.edu.co': 'luis_angel',
  'juan.bettin@iemanueljbetancur.edu.co': 'juan_pablo',
  'hugo.yepes@iemanueljbetancur.edu.co': 'hugo',
  'felipe.piedrahita@iemanueljbetancur.edu.co': 'felipe',
  'valentina.jaramillo@iemanueljbetancur.edu.co': 'valentina',
  'yanet.moscote@iemanueljbetancur.edu.co': 'yanet',
  'harol.gomez@iemanueljbetancur.edu.co': 'harol',
  'yuri.gomez@iemanueljbetancur.edu.co': 'yuri',
  'alexander.sanchez@iemanueljbetancur.edu.co': 'alexander',
  'leidy.atehortua@iemanueljbetancur.edu.co': 'gri_leidy_a',
  'maria.henao@iemanueljbetancur.edu.co': 'gri_maria_v',
  'lourdes.uparela@iemanueljbetancur.edu.co': 'gri_lourdes',
  'edison.sanches@iemanueljbetancur.edu.co': 'gri_edison',
  'jaqueline.arevalo@iemanueljbetancur.edu.co': 'gri_jaqueline',
  'sandra.garcia@iemanueljbetancur.edu.co': 'gri_sandra',
  'johana.rivera@iemanueljbetancur.edu.co': 'gri_johana_r',
  'edwin.toro@iemanueljbetancur.edu.co': 'gri_edwin',
  'leonardo.acevedo@iemanueljbetancur.edu.co': 'gri_leonardo',
  'diego.mejia@iemanueljbetancur.edu.co': 'gri_diego',
  'beatriz.zapata@iemanueljbetancur.edu.co': 'gri_beatriz_z',
  'dolly.gutierrez@iemanueljbetancur.edu.co': 'gri_dolly',
};

// Esquemas de las hojas (se crean solas si no existen)
const RESERVAS_HEADERS    = ['id','recurso','fecha','bloque','solicitante','proposito','equipos','estado','motivo','timestamp'];
const NOTIF_HEADERS       = ['id','destinatario','tipo','mensaje','leida','timestamp'];
const SUGERENCIAS_HEADERS = ['id','autor','texto','timestamp','estado','clasificacion','nota','vinculo','relacionadas','resueltoPor','resueltoEn','avisadoEn'];
const INFORMES_CONTENCION_HEADERS = ['id','fecha','docenteId','docenteNombre','sede','jornada','grado','estudianteNombre','estudianteDocumento','estudianteTelefonos','acudienteNombre','acudienteParentesco','director','directorCorreo','descripcion','rutaTipo','rutaDetalle','timestamp','estado','proximaRevision','cerradoPor','cerradoEn','avisadoEn'];
const REMISIONES_SEGURO_HEADERS   = ['id','fecha','docenteId','docenteNombre','sede','jornada','grado','estudianteNombre','estudianteDocumento','fotoUrl','timestamp','estado','proximaRevision','cerradoPor','cerradoEn','avisadoEn'];
// Hoja de seguimientos de casos (contención emocional y remisión al seguro
// comparten el mismo mecanismo — sección 1-2 de docs/plan-gestor-casos.md).
const SEGUIMIENTOS_HEADERS = ['id','casoId','casoTipo','fecha','autorId','autorNombre','texto','decision','proximaFecha','timestamp'];
// Las tres ultimas columnas se agregaron en agosto de 2026 (descripcion y
// adjunto). Van AL FINAL a proposito: asegurarEncabezados_ solo anade lo que
// falta, asi que las filas viejas siguen leyendose sin tocar la hoja a mano.
const TAREAS_HEADERS      = ['id','grupo','asignaturaId','docenteId','titulo','momentos','fechaAsignacion','fechaEntrega','estado','timestamp','descripcion','adjuntoUrl','adjuntoNombre'];
const CESIONES_HEADERS    = ['id','grupo','periodo','asignaturaOrigenId','asignaturaDestinoId','docenteOrigenId','momentos','timestamp'];
const SOLICITUDES_HEADERS = ['id','grupo','periodo','asignaturaCedenteId','asignaturaDestinoId','docenteCedenteId','docenteSolicitanteId','momentos','estado','timestamp'];
const CUPOS_HEADERS       = ['nivel','asignaturaId','momentos','timestamp'];
const EDITOR_SYNC_HEADERS = ['id','tipo','fecha','jornada','estado','json','timestamp'];

// ── PUNTO DE ENTRADA (JSONP por GET) ─────────────────────────
function doGet(e) {
  if (e && e.parameter && e.parameter.vista === 'avisoPublico') {
    return servirAvisoPublico();
  }
  return manejar(e);
}
function doPost(e) { return manejar(e); }

// Etapa 2 (Firebase, opcional): valida un idToken de Firebase Auth contra el
// endpoint público de Identity Toolkit (sin necesidad de librerías extra en
// Apps Script). Devuelve el correo (en minúsculas) si es válido, verificado
// y del dominio institucional; null en cualquier otro caso. NO se llama a
// menos que el parámetro `idToken` venga en la petición — comportamiento
// actual sin idToken queda intacto.
function verifyFirebaseIdToken_(idToken) {
  try {
    const url = 'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + CONFIG.FIREBASE_API_KEY;
    const res = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ idToken: idToken }),
      muteHttpExceptions: true,
    });
    if (res.getResponseCode() !== 200) return null;
    const data = JSON.parse(res.getContentText());
    const user = data.users && data.users[0];
    if (!user) return null;
    const email = String(user.email || '').toLowerCase();
    if (user.emailVerified !== true) return null;
    if (!email.endsWith('@' + CONFIG.FIREBASE_DOMAIN)) return null;
    return email;
  } catch (err) {
    return null;
  }
}

// Acciones que exponen datos sensibles (salud mental de menores, remisiones
// al seguro estudiantil) o escriben sobre ellos. Antes se autorizaban solo
// SI el cliente mandaba idToken (opcional) — cualquiera podía llamar la URL
// /exec pública sin ninguno y el backend respondía igual. Ahora, si la acción
// está en esta lista, el idToken es obligatorio y se valida contra Identity
// Toolkit; sin uno válido no se ejecuta la acción (docs/plan-gestor-casos.md
// sección 0).
const ACCIONES_PROTEGIDAS = [
  'guardarInformeContencion', 'listarInformesContencion',
  'guardarRemisionSeguro', 'listarRemisionesSeguro',
  'guardarSeguimiento', 'listarSeguimientos',
];

function manejar(e) {
  const p = (e && e.parameter) ? e.parameter : {};
  const callback = p.callback;
  let resultado;
  try {
    // El correo que devuelve verifyFirebaseIdToken_ es la identidad de
    // confianza para todo lo que sigue: nunca se usa un correo/rol que
    // mande el cliente por parámetro para decidir qué puede ver o hacer.
    let correoAutenticado = null;
    if (p.idToken) {
      correoAutenticado = verifyFirebaseIdToken_(p.idToken);
      if (!correoAutenticado) {
        resultado = { ok: false, error: 'no-autorizado' };
        return responder_(resultado, callback);
      }
    }
    if (ACCIONES_PROTEGIDAS.indexOf(p.action) >= 0 && !correoAutenticado) {
      resultado = { ok: false, error: 'no-autorizado' };
      return responder_(resultado, callback);
    }
    switch (p.action) {
      case 'login':              resultado = login(p);              break;
      case 'recuperarPin':       resultado = recuperarPin(p);       break;
      case 'cambiarPin':         resultado = cambiarPin(p);         break;
      case 'getReservas':        resultado = getReservas();         break;
      case 'crearReserva':       resultado = crearReserva(p);       break;
      case 'actualizarReserva':  resultado = actualizarReserva(p);  break;
      case 'getNotificaciones':  resultado = getNotificaciones(p);  break;
      case 'marcarLeida':        resultado = marcarLeida(p);        break;
      case 'marcarTodasLeidas':  resultado = marcarTodasLeidas(p);  break;
      case 'enviarCorreo':       resultado = enviarCorreoAccion(p); break;
      case 'enviarCorreoMasivo': resultado = enviarCorreoMasivo(p); break;
      case 'publicarAviso':      resultado = publicarAviso(p);      break;
      case 'retirarAviso':       resultado = retirarAviso(p);       break;
      case 'crearSugerencia':    resultado = crearSugerencia(p);    break;
      // ⚠ CAMBIO: requiere redespliegue
      case 'getSugerencias':     resultado = getSugerencias();      break;
      // ⚠ CAMBIO: requiere redespliegue
      case 'actualizarSugerencia': resultado = actualizarSugerencia(p); break;
      case 'getDatosTareas':     resultado = getDatosTareas(p);     break;
      case 'crearTarea':         resultado = crearTarea(p);         break;
      case 'cancelarTarea':      resultado = cancelarTarea(p);      break;
      case 'crearCesion':        resultado = crearCesion(p);        break;
      case 'crearSolicitudCesion':   resultado = crearSolicitudCesion(p);   break;
      case 'responderSolicitudCesion': resultado = responderSolicitudCesion(p); break;
      case 'guardarCupos':       resultado = guardarCupos(p);       break;
      // ⚠ CAMBIO: requiere redespliegue (junto con la reserva de rectora)
      case 'guardarSyncEditor':  resultado = guardarSyncEditor(p);  break;
      case 'borrarSyncEditor':   resultado = borrarSyncEditor(p);   break;
      case 'getSyncEditor':      resultado = getSyncEditor();       break;
      // ⚠ CAMBIO: requiere redespliegue
      case 'crearNotificacionesLote': resultado = crearNotificacionesLote(p); break;
      // ⚠ CAMBIO: requiere redespliegue
      case 'guardarInformeContencion': resultado = guardarInformeContencion(p, correoAutenticado); break;
      case 'listarInformesContencion': resultado = listarInformesContencion(p, correoAutenticado); break;
      case 'guardarRemisionSeguro':    resultado = guardarRemisionSeguro(p, correoAutenticado);    break;
      case 'listarRemisionesSeguro':   resultado = listarRemisionesSeguro(p, correoAutenticado);   break;
      case 'guardarSeguimiento':       resultado = guardarSeguimiento(p, correoAutenticado);       break;
      case 'listarSeguimientos':       resultado = listarSeguimientos(p, correoAutenticado);       break;
      default:
        resultado = { ok: false, error: 'Acción desconocida: ' + p.action };
    }
  } catch (err) {
    resultado = { ok: false, error: String(err.message || err) };
  }
  return responder_(resultado, callback);
}

function responder_(resultado, callback) {
  const json = JSON.stringify(resultado);
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + json + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

// ── UTILIDADES DE HOJAS ──────────────────────────────────────
function getSS() { return SpreadsheetApp.openById(CONFIG.SHEET_ID); }

function getSheet(nombre, headers) {
  const ss = getSS();
  let sheet = ss.getSheetByName(nombre);
  if (!sheet) {
    sheet = ss.insertSheet(nombre);
    sheet.appendRow(headers);
  }
  return sheet;
}

function hojaAObjetos(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1).map(function(row) {
    const obj = {};
    headers.forEach(function(h, i) { obj[h] = row[i]; });
    return obj;
  });
}

function actualizarFila(sheet, campoId, valorId, updates) {
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idx = headers.indexOf(campoId);
  if (idx < 0) return false;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idx]) === String(valorId)) {
      Object.keys(updates).forEach(function(k) {
        const col = headers.indexOf(k);
        if (col >= 0) sheet.getRange(i + 1, col + 1).setValue(updates[k]);
      });
      return true;
    }
  }
  return false;
}

// Normaliza una fecha a 'YYYY-MM-DD' aunque Sheets la haya convertido a Date.
function normalizarFecha(v) {
  if (v instanceof Date) {
    return Utilities.formatDate(v, 'America/Bogota', 'yyyy-MM-dd');
  }
  const s = String(v);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : s;
}

// ── RESERVAS ─────────────────────────────────────────────────
function getReservas() {
  const sheet = getSheet('Reservas', RESERVAS_HEADERS);
  const filas = hojaAObjetos(sheet);
  const reservas = filas.map(function(r) {
    return {
      id: String(r.id),
      recurso: String(r.recurso),
      fecha: normalizarFecha(r.fecha),
      bloque: Number(r.bloque),
      solicitante: String(r.solicitante),
      proposito: String(r.proposito),
      equipos: r.equipos ? String(r.equipos) : '',
      estado: String(r.estado),
      motivo: r.motivo ? String(r.motivo) : '',
      timestamp: String(r.timestamp),
    };
  });
  return { ok: true, reservas: reservas };
}

// ⚠ CAMBIO 2026-07-17 (reserva jerárquica de rectora): este archivo NO se
// despliega solo. Después de pegar estos cambios en el editor de Apps
// Script hay que hacer Implementar → Administrar implementaciones → editar
// (lápiz) → Versión: Nueva → Implementar, para que el frontend vea el
// comportamiento nuevo (la URL /exec no cambia).
//
// Reserva jerárquica de la rectora (feat: asignación inmediata). Si el
// frontend envía p.estado === 'aprobada' (solo lo hace cuando rol==='rectora',
// ver src/components/DisponibilidadGrid.tsx y PopupRectora.tsx), la fila se
// crea directamente 'aprobada' y se notifica a coordinadores con mensaje
// 'Rectoría asignó...'. Sin ese parámetro el comportamiento es el de siempre
// (docentes/coordinadores quedan 'pendiente' de aprobación) — NO se rompe
// nada existente.
function crearReserva(p) {
  const sheet = getSheet('Reservas', RESERVAS_HEADERS);
  const id = 'RES-' + new Date().getTime();
  const ts = new Date().toISOString();
  const esAsignacionRectora = p.estado === 'aprobada';
  const estadoFinal = esAsignacionRectora ? 'aprobada' : 'pendiente';
  sheet.appendRow([
    id, p.recurso || '', p.fecha || '', Number(p.bloque || 0),
    p.solicitante || '', p.proposito || '', p.equipos || '',
    estadoFinal, p.motivo || '', ts
  ]);
  // Aviso in-app para ambos coordinadores (sin jornada en el payload)
  var msg = esAsignacionRectora
    ? 'Rectoría asignó ' + (p.recurso || '') + ' el ' + (p.fecha || '') +
      ', bloque ' + (p.bloque || '') + '. Motivo: ' + (p.motivo || p.proposito || '')
    : 'Nueva solicitud de ' + (p.solicitante || '') + ': ' +
      (p.recurso || '') + ' · ' + (p.fecha || '') + ' · ' + (p.proposito || '');
  var tipoNotif = esAsignacionRectora ? 'rectoria' : 'coordinador';
  crearNotificacion('coord_manana', tipoNotif, msg);
  crearNotificacion('coord_tarde', tipoNotif, msg);
  return { ok: true, id: id };
}

function actualizarReserva(p) {
  const sheet = getSheet('Reservas', RESERVAS_HEADERS);
  const updates = { estado: p.estado };
  if (p.motivo) updates.motivo = p.motivo;
  const ok = actualizarFila(sheet, 'id', p.id, updates);
  if (!ok) return { ok: false, error: 'Reserva no encontrada' };

  // Avisar al solicitante
  const reserva = hojaAObjetos(sheet).filter(function(r){ return String(r.id) === String(p.id); })[0];
  if (reserva) {
    var tipo = p.estado === 'aprobada' ? 'aprobada'
             : p.estado === 'rechazada' ? 'rechazada' : 'cancelada';
    var msg = 'Tu reserva de ' + reserva.recurso + ' (' + normalizarFecha(reserva.fecha) + ') fue ' + p.estado +
              (p.motivo ? '. Motivo: ' + p.motivo : '.');
    crearNotificacion(String(reserva.solicitante), tipo, msg);
  }
  return { ok: true };
}

// ── NOTIFICACIONES ───────────────────────────────────────────
function crearNotificacion(destinatario, tipo, mensaje) {
  const sheet = getSheet('Notificaciones', NOTIF_HEADERS);
  const id = 'NOT-' + new Date().getTime() + '-' + Math.random().toString(36).slice(2, 6);
  sheet.appendRow([id, destinatario, tipo, mensaje, false, new Date().toISOString()]);
  return id;
}

function crearNotificacionesLote(p) {
  try {
    var items = JSON.parse(p.items || '[]'); // [{destinatario, tipo, mensaje}, ...]
    items.forEach(function(it) {
      crearNotificacion(it.destinatario, it.tipo, it.mensaje);
    });
    return { ok: true, creadas: items.length };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
}

function getNotificaciones(p) {
  const sheet = getSheet('Notificaciones', NOTIF_HEADERS);
  const filas = hojaAObjetos(sheet).filter(function(n) {
    return String(n.destinatario) === String(p.userId);
  });
  const notificaciones = filas.map(function(n) {
    return {
      id: String(n.id),
      tipo: String(n.tipo),
      mensaje: String(n.mensaje),
      leida: (n.leida === true || String(n.leida).toLowerCase() === 'true'),
      timestamp: String(n.timestamp),
    };
  }).sort(function(a, b) { return b.timestamp.localeCompare(a.timestamp); });
  return { ok: true, notificaciones: notificaciones };
}

function marcarLeida(p) {
  const sheet = getSheet('Notificaciones', NOTIF_HEADERS);
  actualizarFila(sheet, 'id', p.notifId, { leida: true });
  return { ok: true };
}

function marcarTodasLeidas(p) {
  const sheet = getSheet('Notificaciones', NOTIF_HEADERS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idxDest = headers.indexOf('destinatario');
  const idxLeida = headers.indexOf('leida');
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idxDest]) === String(p.userId)) {
      sheet.getRange(i + 1, idxLeida + 1).setValue(true);
    }
  }
  return { ok: true };
}

// ── LOGIN / PIN (placeholder — el frontend usa MODO_LOCAL) ────
function login(p) {
  // El frontend valida el PIN localmente (MODO_LOCAL=true). Este endpoint
  // queda listo por si se desactiva ese modo y se usa la hoja Usuarios.
  return { ok: false, error: 'Login local activo en la app' };
}

function recuperarPin(p) {
  // Busca por correo en la hoja Usuarios (si existe y está poblada).
  const ss = getSS();
  const sheet = ss.getSheetByName('Usuarios');
  if (!sheet) return { ok: false, error: 'No hay hoja de usuarios configurada' };
  const usuarios = hojaAObjetos(sheet);
  const u = usuarios.filter(function(x) {
    return String(x.correo).toLowerCase() === String(p.correo || '').toLowerCase();
  })[0];
  if (!u) return { ok: false, error: 'Correo no encontrado' };
  const pinTemporal = String(Math.floor(100000 + Math.random() * 900000));
  actualizarFila(sheet, 'correo', u.correo, { pinTemporal: pinTemporal });
  enviarHtml(u.correo, '[MJB] PIN temporal de acceso',
    '<h2 style="color:#1a4a9a">PIN temporal</h2><p>Tu PIN temporal es:</p>' +
    '<div style="font-size:28px;font-weight:bold;letter-spacing:.2em;color:#1a4a9a">' + pinTemporal + '</div>' +
    '<p style="font-size:12px;color:#666">Úsalo una vez y cámbialo al entrar.</p>');
  return { ok: true };
}

// Cambia el PIN de un usuario en la hoja Usuarios. Valida el PIN actual
// contra el PIN guardado o el pinTemporal (recuperación). Limpia el
// pinTemporal al confirmar.
function cambiarPin(p) {
  const userId    = String(p.userId || '');
  const pinActual = String(p.pinActual || '');
  const pinNuevo  = String(p.pinNuevo || '');
  if (!userId)              return { ok: false, error: 'Falta el usuario' };
  if (!/^\d{4,6}$/.test(pinNuevo)) return { ok: false, error: 'El PIN nuevo debe tener de 4 a 6 dígitos' };

  const ss = getSS();
  const sheet = ss.getSheetByName('Usuarios');
  if (!sheet) return { ok: false, error: 'No hay hoja de usuarios configurada' };

  const usuarios = hojaAObjetos(sheet);
  const u = usuarios.filter(function(x) { return String(x.id) === userId; })[0];
  if (!u) return { ok: false, error: 'Usuario no encontrado' };

  const pinGuardado  = String(u.pin || '');
  const pinTemporal  = String(u.pinTemporal || '');
  const coincide = (pinActual && pinActual === pinGuardado) ||
                   (pinTemporal && pinActual === pinTemporal);
  if (pinGuardado && !coincide) {
    return { ok: false, error: 'El PIN actual no es correcto' };
  }

  actualizarFila(sheet, 'id', userId, { pin: pinNuevo, pinTemporal: '' });
  return { ok: true };
}

// ── CORREO ───────────────────────────────────────────────────
function enviarHtml(para, asunto, html, cc) {
  const opciones = {
    htmlBody:
      '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f8f9fa;padding:20px">' +
      '<div style="background:white;border-radius:8px;padding:24px;border:1px solid #e0e0e0">' +
      '<div style="border-bottom:2px solid #1a4a9a;padding-bottom:12px;margin-bottom:20px">' +
      '<strong style="color:#1a4a9a;font-size:16px">' + CONFIG.NOMBRE_IE + '</strong>' +
      '<span style="color:#666;font-size:13px;margin-left:8px">Sistema de préstamo de recursos</span>' +
      '</div>' + html + '</div>' +
      '<p style="text-align:center;color:#aaa;font-size:11px;margin-top:12px">' +
      'Mensaje automático — no responder.</p></div>',
    name: CONFIG.NOMBRE_IE,
  };
  if (cc) opciones.cc = cc;
  GmailApp.sendEmail(para, asunto, '', opciones);
}

function enviarCorreoAccion(p) {
  try {
    const destinatarios = String(p.destinatarios || '').split(',').map(function(s){return s.trim();}).filter(Boolean);
    if (destinatarios.length === 0) return { ok: false, error: 'Sin destinatarios' };
    enviarHtml(destinatarios.join(','), p.asunto || '', p.htmlBody || p.html || '');
    return { ok: true };
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
}

function enviarCorreoMasivo(p) {
  try {
    const destinatarios = String(p.destinatarios || '').split(',').map(function(s){return s.trim();}).filter(Boolean);
    const cc = String(p.cc || '').split(',').map(function(s){return s.trim();}).filter(Boolean).join(',');
    if (destinatarios.length === 0) return { ok: false, error: 'Sin destinatarios' };
    const enviados = [];
    const fallidos = [];
    destinatarios.forEach(function(d) {
      try { enviarHtml(d, p.asunto || '', p.html || '', cc || undefined); enviados.push(d); }
      catch (err) { fallidos.push({ correo: d, error: String(err.message || err) }); }
    });
    return { ok: true, enviados: enviados.length, total: destinatarios.length, fallidos: fallidos };
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
}

// ── PUBLICACIÓN WEB (página HTML propia embebida en el Google Site) ──
function publicarAviso(p) {
  try {
    const ss = getSS();
    var sheet = ss.getSheetByName('Avisos');
    if (!sheet) { sheet = ss.insertSheet('Avisos'); sheet.appendRow(['id','creado','fecha_aviso','jornada','tipo','autor','titulo','html','estado']); }
    const id = 'av_' + new Date().getTime() + '_' + Math.random().toString(36).slice(2, 6);
    sheet.appendRow([id, new Date().toISOString(), p.fecha||'', p.jornada||'', p.tipo||'', p.autor||'', p.titulo||'', p.html||'', 'publicado']);
    return { ok: true, id: id, url: ScriptApp.getService().getUrl() + '?vista=avisoPublico' };
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
}

// Marca un aviso previamente publicado como 'retirado' (no se borra la fila,
// queda como historial). No afecta filas con otro estado.
function retirarAviso(p) {
  try {
    const sheet = getSheet('Avisos', ['id','creado','fecha_aviso','jornada','tipo','autor','titulo','html','estado']);
    const ok = actualizarFila(sheet, 'id', p.id, { estado: 'retirado' });
    if (!ok) return { ok: false, error: 'No se encontró el aviso con id ' + p.id };
    return { ok: true };
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
}

// Sirve el último aviso publicado (estado === 'publicado') como página HTML
// para que el Google Site lo incruste en un iframe. El html ya viene bien
// formado desde el frontend (generarResumenDifusion / publicacion.ts) — no
// se toca aquí.
function servirAvisoPublico() {
  const sheet = getSheet('Avisos', ['id','creado','fecha_aviso','jornada','tipo','autor','titulo','html','estado']);
  const avisos = hojaAObjetos(sheet)
    .filter(function(a) { return a.estado === 'publicado'; })
    .sort(function(a, b) { return String(a.creado).localeCompare(String(b.creado)); });
  const ultimo = avisos.length ? avisos[avisos.length - 1] : null;

  const contenido = ultimo
    ? String(ultimo.html || '')
    : '<p style="font-family:sans-serif;color:#374151;padding:24px;text-align:center;">No hay avisos de horario vigentes en este momento.</p>';

  const htmlCompleto = '<!DOCTYPE html><html lang="es"><head>' +
    '<meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>Avisos MJB</title>' +
    '</head><body style="margin:0;padding:0;">' + contenido + '</body></html>';

  return HtmlService.createHtmlOutput(htmlCompleto)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ── TAREAS (módulo de momentos) ──────────────────────────────
// Las reglas (topes, cupos, ventana) se validan en el frontend con el
// motor de agenda; aquí solo se persiste y se listan los datos.

function getDatosTareas(p) {
  const tareas = hojaAObjetos(getSheet('Tareas', TAREAS_HEADERS))
    .filter(function(t) { return !p.grupo || String(t.grupo) === String(p.grupo); })
    .map(function(t) {
      return {
        id: String(t.id),
        grupo: String(t.grupo),
        asignaturaId: String(t.asignaturaId),
        docenteId: String(t.docenteId),
        titulo: String(t.titulo),
        momentos: Number(t.momentos) || 1,
        fechaAsignacion: normalizarFecha(t.fechaAsignacion),
        fechaEntrega: normalizarFecha(t.fechaEntrega),
        estado: String(t.estado),
      };
    });
  const cesiones = hojaAObjetos(getSheet('Cesiones', CESIONES_HEADERS))
    .filter(function(c) { return !p.grupo || String(c.grupo) === String(p.grupo); })
    .map(function(c) {
      return {
        id: String(c.id),
        grupo: String(c.grupo),
        periodo: normalizarFecha(c.periodo),
        asignaturaOrigenId: String(c.asignaturaOrigenId),
        asignaturaDestinoId: String(c.asignaturaDestinoId),
        docenteOrigenId: String(c.docenteOrigenId),
        momentos: Number(c.momentos) || 1,
      };
    });
  var solicitudes = hojaAObjetos(getSheet('SolicitudesCesion', SOLICITUDES_HEADERS))
    .filter(function(s) { return String(s.estado) === 'pendiente'; })
    .map(function(s) {
      return {
        id: String(s.id),
        grupo: String(s.grupo),
        periodo: normalizarFecha(s.periodo),
        asignaturaCedenteId: String(s.asignaturaCedenteId),
        asignaturaDestinoId: String(s.asignaturaDestinoId),
        docenteCedenteId: String(s.docenteCedenteId),
        docenteSolicitanteId: String(s.docenteSolicitanteId),
        momentos: Number(s.momentos) || 1,
        estado: String(s.estado),
      };
    });
  var cupos = hojaAObjetos(getSheet('CuposTareas', CUPOS_HEADERS))
    .map(function(c) {
      return { nivel: String(c.nivel), asignaturaId: String(c.asignaturaId), momentos: Number(c.momentos) || 0 };
    });
  return { ok: true, tareas: tareas, cesiones: cesiones, solicitudes: solicitudes, cupos: cupos };
}

// Guarda la asignación de momentos por (nivel, asignatura). Reemplaza todo.
function guardarCupos(p) {
  var lista;
  try { lista = JSON.parse(p.cupos || '[]'); } catch (e) { return { ok: false, error: 'Datos inválidos' }; }
  var sheet = getSheet('CuposTareas', CUPOS_HEADERS);
  var last = sheet.getLastRow();
  if (last > 1) sheet.deleteRows(2, last - 1);
  var ts = new Date().toISOString();
  lista.forEach(function(c) {
    sheet.appendRow([String(c.nivel), String(c.asignaturaId), Number(c.momentos) || 0, ts]);
  });
  return { ok: true, n: lista.length };
}

// ── SINCRONIZACIÓN DEL EDITOR DE HORARIO (⚠ CAMBIO: requiere redespliegue) ──
// Hoja 'EditorSync': fuente de verdad compartida para que todos los docentes
// vean las modificaciones de horario y jornadas acortadas publicadas por el
// coordinador, sin depender del localStorage de su navegador.
function guardarSyncEditor(p) {
  const sheet = getSheet('EditorSync', EDITOR_SYNC_HEADERS);
  const ts = new Date().toISOString();
  const updates = {
    tipo: String(p.tipo || ''),
    fecha: String(p.fecha || ''),
    jornada: String(p.jornada || ''),
    estado: String(p.estado || ''),
    json: String(p.json || ''),
    timestamp: ts,
  };
  const actualizado = actualizarFila(sheet, 'id', p.id, updates);
  if (!actualizado) {
    sheet.appendRow([String(p.id), updates.tipo, updates.fecha, updates.jornada, updates.estado, updates.json, updates.timestamp]);
  }
  return { ok: true };
}

function borrarSyncEditor(p) {
  const sheet = getSheet('EditorSync', EDITOR_SYNC_HEADERS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idx = headers.indexOf('id');
  if (idx < 0) return { ok: true };
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idx]) === String(p.id)) {
      sheet.deleteRow(i + 1);
      break;
    }
  }
  return { ok: true };
}

function getSyncEditor() {
  const sheet = getSheet('EditorSync', EDITOR_SYNC_HEADERS);
  const filas = hojaAObjetos(sheet);
  const items = filas.map(function(r) {
    return {
      id: String(r.id),
      tipo: String(r.tipo),
      fecha: normalizarFecha(r.fecha),
      jornada: String(r.jornada),
      estado: String(r.estado),
      json: String(r.json),
      timestamp: String(r.timestamp),
    };
  });
  return { ok: true, items: items };
}

// Sheets convierte textos como '9.1' en fechas/números al escribirlos.
// Esta función fija la celda de grupo como TEXTO después del appendRow.
function fijarGrupoComoTexto(sheet, colGrupo, valor) {
  const fila = sheet.getLastRow();
  sheet.getRange(fila, colGrupo).setNumberFormat('@').setValue(valor);
}

function crearTarea(p) {
  if (!p.grupo || !p.asignaturaId || !p.docenteId || !p.titulo || !p.fechaEntrega) {
    return { ok: false, error: 'Faltan datos de la tarea' };
  }
  const sheet = getSheet('Tareas', TAREAS_HEADERS);
  asegurarEncabezados_(sheet, TAREAS_HEADERS);
  const id = 'TAR-' + new Date().getTime();
  sheet.appendRow([
    id, p.grupo, p.asignaturaId, p.docenteId, p.titulo,
    Number(p.momentos) || 1, p.fechaAsignacion || '', p.fechaEntrega,
    'activa', new Date().toISOString(),
    p.descripcion || '', p.adjuntoUrl || '', p.adjuntoNombre || '',
  ]);
  fijarGrupoComoTexto(sheet, 2, p.grupo);
  return { ok: true, id: id };
}

function cancelarTarea(p) {
  const sheet = getSheet('Tareas', TAREAS_HEADERS);
  // Solo el docente que la creó puede cancelarla (o un directivo desde el panel)
  const tareas = hojaAObjetos(sheet);
  const tarea = tareas.find(function(t) { return String(t.id) === String(p.id); });
  if (!tarea) return { ok: false, error: 'Tarea no encontrada' };
  if (p.docenteId && String(tarea.docenteId) !== String(p.docenteId) && p.esDirectivo !== '1') {
    return { ok: false, error: 'Solo el docente que asignó la tarea puede cancelarla' };
  }
  actualizarFila(sheet, 'id', p.id, { estado: 'cancelada' });
  return { ok: true };
}

function crearCesion(p) {
  if (!p.grupo || !p.periodo || !p.asignaturaOrigenId || !p.asignaturaDestinoId) {
    return { ok: false, error: 'Faltan datos de la cesión' };
  }
  const sheet = getSheet('Cesiones', CESIONES_HEADERS);
  const id = 'CES-' + new Date().getTime();
  sheet.appendRow([
    id, p.grupo, p.periodo, p.asignaturaOrigenId, p.asignaturaDestinoId,
    p.docenteOrigenId || '', Number(p.momentos) || 1, new Date().toISOString(),
  ]);
  fijarGrupoComoTexto(sheet, 2, p.grupo);
  return { ok: true, id: id };
}

// Un docente pide a otro que le ceda momentos: crea la solicitud (pendiente)
// y notifica al cedente para que la conceda o la rechace.
function crearSolicitudCesion(p) {
  if (!p.grupo || !p.periodo || !p.asignaturaCedenteId || !p.asignaturaDestinoId ||
      !p.docenteCedenteId || !p.docenteSolicitanteId) {
    return { ok: false, error: 'Faltan datos de la solicitud' };
  }
  const sheet = getSheet('SolicitudesCesion', SOLICITUDES_HEADERS);
  const id = 'SOL-' + new Date().getTime();
  sheet.appendRow([
    id, p.grupo, p.periodo, p.asignaturaCedenteId, p.asignaturaDestinoId,
    p.docenteCedenteId, p.docenteSolicitanteId, Number(p.momentos) || 1,
    'pendiente', new Date().toISOString(),
  ]);
  fijarGrupoComoTexto(sheet, 2, p.grupo);
  crearNotificacion(p.docenteCedenteId, 'intercambio',
    p.mensaje || 'Tienes una solicitud de cesión de momentos por responder.');
  return { ok: true, id: id };
}

// El cedente responde: al aceptar se crea la Cesión y se avisa al solicitante.
function responderSolicitudCesion(p) {
  const sheet = getSheet('SolicitudesCesion', SOLICITUDES_HEADERS);
  const sol = hojaAObjetos(sheet).find(function(s) { return String(s.id) === String(p.id); });
  if (!sol) return { ok: false, error: 'Solicitud no encontrada' };
  if (String(sol.estado) !== 'pendiente') return { ok: false, error: 'La solicitud ya fue respondida' };

  if (p.respuesta === 'aceptar') {
    const ces = getSheet('Cesiones', CESIONES_HEADERS);
    const cid = 'CES-' + new Date().getTime();
    ces.appendRow([
      cid, sol.grupo, normalizarFecha(sol.periodo), sol.asignaturaCedenteId,
      sol.asignaturaDestinoId, sol.docenteCedenteId, Number(sol.momentos) || 1,
      new Date().toISOString(),
    ]);
    fijarGrupoComoTexto(ces, 2, sol.grupo);
    actualizarFila(sheet, 'id', p.id, { estado: 'aceptada' });
    crearNotificacion(String(sol.docenteSolicitanteId), 'intercambio',
      p.mensaje || 'Tu solicitud de cesión de momentos fue aceptada.');
  } else {
    actualizarFila(sheet, 'id', p.id, { estado: 'rechazada' });
    crearNotificacion(String(sol.docenteSolicitanteId), 'intercambio',
      p.mensaje || 'Tu solicitud de cesión de momentos fue rechazada.');
  }
  return { ok: true };
}

// ── Sugerencias ──────────────────────────────────────────────
// Fase 1 del módulo (docs/modulo-sugerencias.md): leer y clasificar.
// La hoja 'Sugerencias' ya existe en producción con datos y solo 4
// columnas ('id','autor','texto','timestamp'). asegurarEncabezados_
// amplía la fila 1 con las columnas nuevas SIN reescribirla ni
// reordenarla, para no perder ni desalinear lo que ya hay.

function asegurarEncabezados_(sheet, headersEsperados) {
  const actuales = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  const faltantes = headersEsperados.filter(function(h) { return actuales.indexOf(h) < 0; });
  if (faltantes.length > 0) {
    sheet.getRange(1, actuales.length + 1, 1, faltantes.length).setValues([faltantes]);
  }
}

function crearSugerencia(p) {
  const sheet = getSheet('Sugerencias', SUGERENCIAS_HEADERS);
  asegurarEncabezados_(sheet, SUGERENCIAS_HEADERS);
  const id = 'SUG-' + new Date().getTime();
  const ts = new Date().toISOString();
  // Las columnas nuevas quedan vacías: solo se llenan al clasificar/actualizar.
  sheet.appendRow([id, p.autor || 'anónimo', p.texto || '', ts]);
  return { ok: true, id: id };
}

// ⚠ CAMBIO: requiere redespliegue
function getSugerencias() {
  const sheet = getSheet('Sugerencias', SUGERENCIAS_HEADERS);
  asegurarEncabezados_(sheet, SUGERENCIAS_HEADERS);
  const filas = hojaAObjetos(sheet);
  const items = filas.map(function(s) {
    return {
      id: String(s.id),
      autor: String(s.autor || ''),
      texto: String(s.texto || ''),
      timestamp: String(s.timestamp || ''),
      // Fila sin estado (creada antes de esta fase, o recién llegada) = 'nueva'.
      estado: s.estado ? String(s.estado) : 'nueva',
      clasificacion: s.clasificacion ? String(s.clasificacion) : '',
      nota: s.nota ? String(s.nota) : '',
      vinculo: s.vinculo ? String(s.vinculo) : '',
      relacionadas: s.relacionadas ? String(s.relacionadas) : '',
      resueltoPor: s.resueltoPor ? String(s.resueltoPor) : '',
      resueltoEn: s.resueltoEn ? String(s.resueltoEn) : '',
      avisadoEn: s.avisadoEn ? String(s.avisadoEn) : '',
    };
  }).sort(function(a, b) { return b.timestamp.localeCompare(a.timestamp); });
  return { ok: true, items: items };
}

// ⚠ CAMBIO: requiere redespliegue
// Actualiza solo los campos que vengan en los parámetros. 'resueltoEn' se
// rellena solo automáticamente cuando el estado pasa a 'resuelta' o
// 'descartada' (y no venía ya explícito en la petición).
function actualizarSugerencia(p) {
  if (!p.id) return { ok: false, error: 'Falta el id de la sugerencia' };
  const sheet = getSheet('Sugerencias', SUGERENCIAS_HEADERS);
  asegurarEncabezados_(sheet, SUGERENCIAS_HEADERS);

  const CAMPOS = ['estado', 'clasificacion', 'nota', 'vinculo', 'relacionadas', 'resueltoPor', 'avisadoEn'];
  const updates = {};
  CAMPOS.forEach(function(c) {
    if (Object.prototype.hasOwnProperty.call(p, c)) updates[c] = p[c];
  });

  if (updates.estado === 'resuelta' || updates.estado === 'descartada') {
    if (!p.resueltoEn) updates.resueltoEn = new Date().toISOString();
  }

  const ok = actualizarFila(sheet, 'id', p.id, updates);
  if (!ok) return { ok: false, error: 'Sugerencia no encontrada' };
  return { ok: true };
}

// ── INFORME DE CONTENCIÓN EMOCIONAL ───────────────────────────
// Guarda el informe y, en el mismo paso, envía el correo automático a
// coordinación (según jornada del estudiante) y a psicoorientación.
// El envío es best-effort: si el correo falla, el informe igual queda
// guardado (nunca se pierde el registro por un problema de envío).
function guardarInformeContencion(p, correoAutenticado) {
  try {
    const sheet = getSheet('InformesContencion', INFORMES_CONTENCION_HEADERS);
    asegurarEncabezados_(sheet, INFORMES_CONTENCION_HEADERS);
    const id = 'ic_' + new Date().getTime() + '_' + Math.random().toString(36).slice(2, 6);
    // OJO: asegurarEncabezados_ agrega las columnas que faltan AL FINAL de la hoja
    // física, no en la posición que tengan en INFORMES_CONTENCION_HEADERS (que las
    // tiene intercaladas por legibilidad). Escribir con ese orden de la constante
    // desalinea todo desde la primera columna nueva. Por eso la fila se arma según
    // el orden REAL de encabezados que ya está en la hoja, columna por columna.
    const headersReales = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const fila = headersReales.map(function(h) {
      if (h === 'id') return id;
      if (h === 'timestamp') return new Date().toISOString();
      if (h === 'estado') return 'abierto'; // todo caso nuevo arranca abierto (sección 2)
      return p[h] || '';
    });
    sheet.appendRow(fila);
    // "11.2" (notación de grado de mañana) se lee como 11 de febrero y Sheets la
    // vuelve fecha sola al escribirla. Se reescribe forzando texto plano en esa
    // columna, en la fila recién agregada.
    forzarColumnaTexto_(sheet, headersReales, 'grado', p.grado || '');

    const coordCorreo = p.jornada === 'tarde' ? CONFIG.COORD_TARDE : CONFIG.COORD_MANANA;
    // Siempre a coordinador + psicoorientador + director de grupo. El director puede
    // faltar (grado sin director conocido en el sistema); no se bloquea el envío por eso.
    const destinatarios = [coordCorreo, CONFIG.PSICOORIENTADOR, p.directorCorreo].filter(Boolean).join(',');
    const RUTA_LABEL_ = {
      psicoorientador: 'Psicoorientador del colegio',
      uai: 'Remisión a la UAI',
      medellin_me_cuida: 'Remisión a Medellín Te Quiere Saludable',
      directo: 'Se atendió directamente, sin remisión',
      linea_naranja: 'Se atendió con Línea Naranja',
      linea_dorada: 'Se atendió con Línea Dorada u otra línea de emergencia externa',
      externa: 'Se orienta a ayuda externa al colegio',
    };
    const rutaTexto = p.rutaDetalle ? (RUTA_LABEL_[p.rutaDetalle] || p.rutaDetalle) : 'Sin especificar';
    const html = '<p><b>Informe de contención emocional</b></p>' +
      '<p><b>Estudiante:</b> ' + (p.estudianteNombre || '') + ' (' + (p.estudianteDocumento || 'sin documento') + ')</p>' +
      '<p><b>Grado:</b> ' + (p.grado || '') + ' &middot; <b>Director de grupo:</b> ' + (p.director || '') + '</p>' +
      '<p><b>Acudiente:</b> ' + (p.acudienteNombre || 'sin registrar') + (p.acudienteParentesco ? ' (' + p.acudienteParentesco + ')' : '') + '</p>' +
      '<p><b>Generado por:</b> ' + (p.docenteNombre || '') + ' &middot; <b>Fecha:</b> ' + (p.fecha || '') + '</p>' +
      '<p><b>Descripción del informe:</b><br>' + String(p.descripcion || '').replace(/\n/g, '<br>') + '</p>' +
      '<p><b>Ruta de atención:</b> ' + rutaTexto + '</p>';
    try {
      if (destinatarios) enviarHtml(destinatarios, 'Informe de contención emocional — ' + (p.estudianteNombre || ''), html);
    } catch (mailErr) {
      return { ok: true, id: id, correoEnviado: false, errorCorreo: String(mailErr.message || mailErr) };
    }
    return { ok: true, id: id, correoEnviado: true };
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
}

// Historial para la pestaña "Casos"/"Informes". El filtro por rol ahora se
// aplica AQUÍ, en el backend (docs/plan-gestor-casos.md sección 3) — no basta
// con filtrar en pantalla porque el dato ya salió del servidor si no se filtra
// antes de responder.
function listarInformesContencion(p, correoAutenticado) {
  try {
    const sheet = getSheet('InformesContencion', INFORMES_CONTENCION_HEADERS);
    asegurarEncabezados_(sheet, INFORMES_CONTENCION_HEADERS);
    const acceso = resolverAcceso_(correoAutenticado);
    return { ok: true, informes: filtrarCasosPorAcceso_(hojaAObjetos(sheet), acceso) };
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
}

// ── REMISIÓN AL SEGURO ESTUDIANTIL (banco de fotos) ───────────
// La foto llega en base64 por POST (por eso esta acción solo funciona vía
// callApiPost, nunca por JSONP/GET: una imagen no cabe en una URL). Se
// guarda en una carpeta de Drive dedicada y solo el enlace va a la hoja.
function guardarRemisionSeguro(p, correoAutenticado) {
  try {
    if (!p.fotoBase64) return { ok: false, error: 'Falta la fotografía' };
    const carpeta = obtenerCarpetaRemisionesSeguro_();
    const bytes = Utilities.base64Decode(p.fotoBase64.replace(/^data:image\/\w+;base64,/, ''));
    const nombreArchivo = 'remision_' + (p.grado || 'grado') + '_' + new Date().getTime() + '.jpg';
    const blob = Utilities.newBlob(bytes, 'image/jpeg', nombreArchivo);
    const archivo = carpeta.createFile(blob);
    archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    const sheet = getSheet('RemisionesSeguro', REMISIONES_SEGURO_HEADERS);
    asegurarEncabezados_(sheet, REMISIONES_SEGURO_HEADERS);
    const id = 'rs_' + new Date().getTime() + '_' + Math.random().toString(36).slice(2, 6);
    // Mismo motivo que en guardarInformeContencion: orden real de la hoja, no el de
    // la constante, para que una columna nueva agregada al final no desalinee todo.
    const headersReales = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const fila = headersReales.map(function(h) {
      if (h === 'id') return id;
      if (h === 'fotoUrl') return archivo.getUrl();
      if (h === 'timestamp') return new Date().toISOString();
      if (h === 'estado') return 'abierto'; // todo caso nuevo arranca abierto (sección 2)
      return p[h] || '';
    });
    sheet.appendRow(fila);
    forzarColumnaTexto_(sheet, headersReales, 'grado', p.grado || '');
    return { ok: true, id: id, fotoUrl: archivo.getUrl() };
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
}

// "11.2" (grado de mañana) se lee como fecha (11 de febrero) y Sheets la convierte
// sola al escribirla — sea por appendRow o por edición manual. Se reescribe la
// celda de esa columna, en la última fila, forzando formato de texto plano.
function forzarColumnaTexto_(sheet, headersReales, nombreColumna, valorTexto) {
  const idx = headersReales.indexOf(nombreColumna);
  if (idx < 0) return;
  const fila = sheet.getLastRow();
  sheet.getRange(fila, idx + 1).setNumberFormat('@').setValue(valorTexto);
}

function listarRemisionesSeguro(p, correoAutenticado) {
  try {
    const sheet = getSheet('RemisionesSeguro', REMISIONES_SEGURO_HEADERS);
    asegurarEncabezados_(sheet, REMISIONES_SEGURO_HEADERS);
    const acceso = resolverAcceso_(correoAutenticado);
    return { ok: true, remisiones: filtrarCasosPorAcceso_(hojaAObjetos(sheet), acceso) };
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
}

function obtenerCarpetaRemisionesSeguro_() {
  const NOMBRE = 'MJB - Remisiones Seguro Estudiantil';
  const iter = DriveApp.getFoldersByName(NOMBRE);
  if (iter.hasNext()) return iter.next();
  return DriveApp.createFolder(NOMBRE);
}

// ── Visibilidad por rol (docs/plan-gestor-casos.md sección 3) ────────────
// Resuelve, a partir del correo autenticado, qué subconjunto de casos puede
// ver quien pregunta. Nunca se recibe el rol como parámetro del cliente.
function resolverAcceso_(correoAutenticado) {
  const correo = String(correoAutenticado || '').toLowerCase();
  if (correo === String(CONFIG.RECTORA).toLowerCase()) return { tipo: 'todos' };
  if (correo === String(CONFIG.PSICOORIENTADOR).toLowerCase()) return { tipo: 'todos' };
  if (correo === String(CONFIG.COORD_MANANA).toLowerCase()) return { tipo: 'jornada', jornada: 'manana' };
  if (correo === String(CONFIG.COORD_TARDE).toLowerCase()) return { tipo: 'jornada', jornada: 'tarde' };
  const grados = Object.keys(DIRECTORES_CORREO).filter(function(g) {
    return String(DIRECTORES_CORREO[g]).toLowerCase() === correo;
  });
  if (grados.length > 0) return { tipo: 'grados', grados: grados };
  // Cualquier otro correo institucional: solo ve lo que él mismo generó.
  return { tipo: 'propio', docenteId: CORREO_A_DOCENTE_ID[correo] || null };
}

// Conjunto de ids de caso que este acceso puede ver, mirando las DOS hojas de
// casos. Es la pieza que impide que un seguimiento sea una puerta trasera: un
// docente autenticado podría pedir cualquier casoId y leer las notas de un caso
// ajeno si solo se validara la sesión y no la pertenencia del caso.
function casosVisiblesIds_(acceso) {
  const informes = hojaAObjetos(getSheet('InformesContencion', INFORMES_CONTENCION_HEADERS));
  const remisiones = hojaAObjetos(getSheet('RemisionesSeguro', REMISIONES_SEGURO_HEADERS));
  const visibles = filtrarCasosPorAcceso_(informes, acceso)
    .concat(filtrarCasosPorAcceso_(remisiones, acceso));
  const ids = {};
  visibles.forEach(function(c) { ids[String(c.id)] = true; });
  return ids;
}

function filtrarCasosPorAcceso_(items, acceso) {
  if (acceso.tipo === 'todos') return items;
  if (acceso.tipo === 'jornada') {
    return items.filter(function(c) { return String(c.jornada) === acceso.jornada; });
  }
  if (acceso.tipo === 'grados') {
    return items.filter(function(c) { return acceso.grados.indexOf(String(c.grado)) >= 0; });
  }
  // 'propio' — si no se pudo resolver el id de docente (correo no está en
  // CORREO_A_DOCENTE_ID), no se muestra nada: no hay forma segura de saber
  // qué le pertenece.
  return items.filter(function(c) {
    return acceso.docenteId && String(c.docenteId) === acceso.docenteId;
  });
}

// ── SEGUIMIENTOS DE CASOS (contención + remisión al seguro) ──────────────
// docs/plan-gestor-casos.md secciones 1 y 2: escribe el seguimiento Y avanza
// el estado del caso (InformesContencion o RemisionesSeguro) en el mismo paso.
function guardarSeguimiento(p, correoAutenticado) {
  try {
    if (!p.casoId || !p.casoTipo || !p.texto || !p.decision) {
      return { ok: false, error: 'Faltan datos del seguimiento' };
    }
    if (p.casoTipo !== 'contencion' && p.casoTipo !== 'seguro') {
      return { ok: false, error: 'casoTipo inválido' };
    }
    if (p.decision !== 'programar' && p.decision !== 'cerrar') {
      return { ok: false, error: 'decision inválida' };
    }
    // No basta con estar autenticado: hay que poder ver ESE caso para dejarle
    // seguimiento o cerrarlo. Si no, cualquier docente podría cerrar el caso de
    // un estudiante que no le corresponde.
    const accesoEscritura = resolverAcceso_(correoAutenticado);
    if (accesoEscritura.tipo !== 'todos'
        && casosVisiblesIds_(accesoEscritura)[String(p.casoId)] !== true) {
      return { ok: false, error: 'no-autorizado' };
    }

    const sheet = getSheet('SeguimientosCasos', SEGUIMIENTOS_HEADERS);
    asegurarEncabezados_(sheet, SEGUIMIENTOS_HEADERS);
    const id = 'seg_' + new Date().getTime() + '_' + Math.random().toString(36).slice(2, 6);
    const ts = new Date().toISOString();
    // autorId viene de la identidad verificada por Firebase, no de lo que
    // mande el cliente — mismo principio que el resto del Lote 1.
    const registro = {
      id: id,
      casoId: String(p.casoId),
      casoTipo: String(p.casoTipo),
      fecha: p.fecha || Utilities.formatDate(new Date(), 'America/Bogota', 'yyyy-MM-dd'),
      autorId: correoAutenticado || '',
      autorNombre: p.autorNombre || '',
      texto: p.texto,
      decision: p.decision,
      proximaFecha: p.decision === 'programar' ? (p.proximaFecha || '') : '',
      timestamp: ts,
    };
    const headersReales = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const fila = headersReales.map(function(h) {
      return Object.prototype.hasOwnProperty.call(registro, h) ? registro[h] : '';
    });
    sheet.appendRow(fila);

    // Actualiza el caso: en_seguimiento + próxima revisión, o cerrado + quién/cuándo.
    const nombreHoja = p.casoTipo === 'seguro' ? 'RemisionesSeguro' : 'InformesContencion';
    const headersCaso = p.casoTipo === 'seguro' ? REMISIONES_SEGURO_HEADERS : INFORMES_CONTENCION_HEADERS;
    const sheetCaso = getSheet(nombreHoja, headersCaso);
    asegurarEncabezados_(sheetCaso, headersCaso);
    const updates = (p.decision === 'cerrar')
      ? { estado: 'cerrado', cerradoPor: correoAutenticado || '', cerradoEn: ts }
      : { estado: 'en_seguimiento', proximaRevision: p.proximaFecha || '' };
    const ok = actualizarFila(sheetCaso, 'id', p.casoId, updates);
    if (!ok) return { ok: false, error: 'Caso no encontrado' };

    return { ok: true, id: id };
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
}

function listarSeguimientos(p, correoAutenticado) {
  try {
    const sheet = getSheet('SeguimientosCasos', SEGUIMIENTOS_HEADERS);
    asegurarEncabezados_(sheet, SEGUIMIENTOS_HEADERS);
    var items = hojaAObjetos(sheet);
    if (p.casoId) {
      items = items.filter(function(s) { return String(s.casoId) === String(p.casoId); });
    }
    // Las notas de seguimiento son tan sensibles como el caso al que pertenecen
    // (describen la situación emocional de un menor), así que se filtran por la
    // misma regla de acceso. Sin esto, autenticarse bastaría para leerlas todas.
    const acceso = resolverAcceso_(correoAutenticado);
    if (acceso.tipo !== 'todos') {
      const permitidos = casosVisiblesIds_(acceso);
      items = items.filter(function(s) { return permitidos[String(s.casoId)] === true; });
    }
    items.sort(function(a, b) { return String(a.timestamp).localeCompare(String(b.timestamp)); });
    return { ok: true, seguimientos: items };
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
}

// ── ALERTA DE CASOS VENCIDOS (docs/plan-gestor-casos.md sección 4) ───────
// ⚠ Esta función NO se activa sola. Julián debe instalarla a mano UNA VEZ
// desde el editor de Apps Script: Activadores (icono de reloj) → Añadir
// activador → función "revisarCasosVencidos" → origen del evento "Basado en
// tiempo" → temporizador diario → guardar. No se instala por código porque
// ScriptApp.newTrigger requiere el consentimiento interactivo del propietario
// del proyecto (no se puede autorizar desde una petición HTTP del backend).
//
// Recorre InformesContencion y RemisionesSeguro; para cada caso no cerrado
// con ≥ 8 días desde su último seguimiento (o desde su creación si no tiene
// ninguno), envía un correo a coordinación de la jornada + psicoorientador +
// director de grupo. 'avisadoEn' evita repetir el aviso el mismo día, mismo
// patrón que ya usa la hoja Sugerencias con actualizarSugerencia.
function revisarCasosVencidos() {
  const hoy = new Date();
  const hoyStr = Utilities.formatDate(hoy, 'America/Bogota', 'yyyy-MM-dd');

  const seguimientos = hojaAObjetos(getSheet('SeguimientosCasos', SEGUIMIENTOS_HEADERS));
  // Último seguimiento por caso: el timestamp ISO más grande en orden de texto
  // ya ordena cronológicamente (formato yyyy-MM-ddTHH:mm:ss...).
  const ultimoPorCaso = {};
  seguimientos.forEach(function(s) {
    const caso = String(s.casoId);
    const ts = String(s.timestamp || '');
    if (!ts) return;
    if (!ultimoPorCaso[caso] || ts > ultimoPorCaso[caso]) ultimoPorCaso[caso] = ts;
  });

  [
    { hoja: 'InformesContencion', headers: INFORMES_CONTENCION_HEADERS, etiqueta: 'Informe de contención emocional' },
    { hoja: 'RemisionesSeguro',   headers: REMISIONES_SEGURO_HEADERS,   etiqueta: 'Remisión al seguro estudiantil' },
  ].forEach(function(cfg) {
    const sheet = getSheet(cfg.hoja, cfg.headers);
    asegurarEncabezados_(sheet, cfg.headers);
    const casos = hojaAObjetos(sheet);
    casos.forEach(function(c) {
      if (!c.id) return;
      if (String(c.estado) === 'cerrado') return;
      if (String(c.avisadoEn || '').slice(0, 10) === hoyStr) return; // ya avisado hoy

      const referencia = ultimoPorCaso[String(c.id)] || String(c.timestamp || '');
      if (!referencia) return;
      const fechaRef = new Date(referencia);
      if (isNaN(fechaRef.getTime())) return;
      const dias = Math.floor((hoy.getTime() - fechaRef.getTime()) / 86400000);
      if (dias < 8) return;

      const coordCorreo = String(c.jornada) === 'tarde' ? CONFIG.COORD_TARDE : CONFIG.COORD_MANANA;
      const directorCorreo = DIRECTORES_CORREO[String(c.grado)] || '';
      const destinatarios = [coordCorreo, CONFIG.PSICOORIENTADOR, directorCorreo].filter(Boolean).join(',');
      if (!destinatarios) return;

      const html = '<p><b>Caso sin seguimiento hace ' + dias + ' días</b></p>' +
        '<p><b>Tipo:</b> ' + cfg.etiqueta + '</p>' +
        '<p><b>Estudiante:</b> ' + (c.estudianteNombre || '') + '</p>' +
        '<p><b>Grado:</b> ' + (c.grado || '') + '</p>' +
        '<p style="font-size:12px;color:#666">Revisa el caso en la pestaña "Casos" de la app.</p>';
      try {
        enviarHtml(destinatarios, '[MJB] Caso sin seguimiento (' + dias + ' días) — ' + (c.estudianteNombre || ''), html);
        actualizarFila(sheet, 'id', c.id, { avisadoEn: new Date().toISOString() });
      } catch (mailErr) {
        // best-effort: si el correo falla no se marca avisado, para reintentar
        // en la siguiente corrida diaria (mismo criterio que Sugerencias).
      }
    });
  });
}
