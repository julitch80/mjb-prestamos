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

// Esquemas de las hojas (se crean solas si no existen)
const RESERVAS_HEADERS    = ['id','recurso','fecha','bloque','solicitante','proposito','equipos','estado','motivo','timestamp'];
const NOTIF_HEADERS       = ['id','destinatario','tipo','mensaje','leida','timestamp'];
const SUGERENCIAS_HEADERS = ['id','autor','texto','timestamp','estado','clasificacion','nota','vinculo','relacionadas','resueltoPor','resueltoEn','avisadoEn'];
const INFORMES_CONTENCION_HEADERS = ['id','fecha','docenteId','docenteNombre','sede','jornada','grado','estudianteNombre','estudianteDocumento','estudianteTelefonos','director','descripcion','rutaTipo','rutaDetalle','timestamp'];
const REMISIONES_SEGURO_HEADERS   = ['id','fecha','docenteId','docenteNombre','sede','jornada','grado','estudianteNombre','estudianteDocumento','fotoUrl','timestamp'];
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

function manejar(e) {
  const p = (e && e.parameter) ? e.parameter : {};
  const callback = p.callback;
  let resultado;
  try {
    // Si viene idToken, se valida; comportamiento sin idToken no cambia.
    if (p.idToken) {
      const email = verifyFirebaseIdToken_(p.idToken);
      if (!email) {
        resultado = { ok: false, error: 'no-autorizado' };
        return responder_(resultado, callback);
      }
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
      case 'guardarInformeContencion': resultado = guardarInformeContencion(p); break;
      case 'listarInformesContencion': resultado = listarInformesContencion(p); break;
      case 'guardarRemisionSeguro':    resultado = guardarRemisionSeguro(p);    break;
      case 'listarRemisionesSeguro':   resultado = listarRemisionesSeguro(p);   break;
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
function guardarInformeContencion(p) {
  try {
    const sheet = getSheet('InformesContencion', INFORMES_CONTENCION_HEADERS);
    const id = 'ic_' + new Date().getTime() + '_' + Math.random().toString(36).slice(2, 6);
    const fila = INFORMES_CONTENCION_HEADERS.map(function(h) {
      if (h === 'id') return id;
      if (h === 'timestamp') return new Date().toISOString();
      return p[h] || '';
    });
    sheet.appendRow(fila);

    const coordCorreo = p.jornada === 'tarde' ? CONFIG.COORD_TARDE : CONFIG.COORD_MANANA;
    const destinatarios = [coordCorreo, CONFIG.PSICOORIENTADOR].filter(Boolean).join(',');
    const rutaTexto = p.rutaTipo === 'externa'
      ? 'Atención externa al colegio'
      : { psicoorientador: 'Psicoorientador del colegio', uai: 'Remisión a la UAI', medellin_me_cuida: 'Remisión a Medellín Te Quiere Saludable' }[p.rutaDetalle] || p.rutaDetalle;
    const html = '<p><b>Informe de contención emocional</b></p>' +
      '<p><b>Estudiante:</b> ' + (p.estudianteNombre || '') + ' (' + (p.estudianteDocumento || 'sin documento') + ')</p>' +
      '<p><b>Grado:</b> ' + (p.grado || '') + ' &middot; <b>Director de grupo:</b> ' + (p.director || '') + '</p>' +
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

// Historial para la pestaña "Informes" de coordinación. Sin filtro de
// jornada en el backend: cada coordinador ve todo y el frontend decide
// qué mostrar por defecto, igual que el resto del panel.
function listarInformesContencion(p) {
  try {
    const sheet = getSheet('InformesContencion', INFORMES_CONTENCION_HEADERS);
    return { ok: true, informes: hojaAObjetos(sheet) };
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
}

// ── REMISIÓN AL SEGURO ESTUDIANTIL (banco de fotos) ───────────
// La foto llega en base64 por POST (por eso esta acción solo funciona vía
// callApiPost, nunca por JSONP/GET: una imagen no cabe en una URL). Se
// guarda en una carpeta de Drive dedicada y solo el enlace va a la hoja.
function guardarRemisionSeguro(p) {
  try {
    if (!p.fotoBase64) return { ok: false, error: 'Falta la fotografía' };
    const carpeta = obtenerCarpetaRemisionesSeguro_();
    const bytes = Utilities.base64Decode(p.fotoBase64.replace(/^data:image\/\w+;base64,/, ''));
    const nombreArchivo = 'remision_' + (p.grado || 'grado') + '_' + new Date().getTime() + '.jpg';
    const blob = Utilities.newBlob(bytes, 'image/jpeg', nombreArchivo);
    const archivo = carpeta.createFile(blob);
    archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    const sheet = getSheet('RemisionesSeguro', REMISIONES_SEGURO_HEADERS);
    const id = 'rs_' + new Date().getTime() + '_' + Math.random().toString(36).slice(2, 6);
    const fila = REMISIONES_SEGURO_HEADERS.map(function(h) {
      if (h === 'id') return id;
      if (h === 'fotoUrl') return archivo.getUrl();
      if (h === 'timestamp') return new Date().toISOString();
      return p[h] || '';
    });
    sheet.appendRow(fila);
    return { ok: true, id: id, fotoUrl: archivo.getUrl() };
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
}

function listarRemisionesSeguro(p) {
  try {
    const sheet = getSheet('RemisionesSeguro', REMISIONES_SEGURO_HEADERS);
    return { ok: true, remisiones: hojaAObjetos(sheet) };
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
}

function obtenerCarpetaRemisionesSeguro_() {
  const NOMBRE = 'MJB - Remisiones Seguro Estudiantil';
  const iter = DriveApp.getFoldersByName(NOMBRE);
  if (iter.hasNext()) return iter.next();
  return DriveApp.createFolder(NOMBRE);
}
