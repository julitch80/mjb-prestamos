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
  NOMBRE_IE:    'I.E. Manuel J. Betancur',
};

// ID del Google Doc "Avisos vigentes MJB" embebido en el Google Site
const DOC_AVISOS_ID = '1Z4ZPgkm5ognsKMwc8fizRTxIS2YWVyQFyzbkQ6QKEUk';

// Esquemas de las hojas (se crean solas si no existen)
const RESERVAS_HEADERS    = ['id','recurso','fecha','bloque','solicitante','proposito','equipos','estado','motivo','timestamp'];
const NOTIF_HEADERS       = ['id','destinatario','tipo','mensaje','leida','timestamp'];
const SUGERENCIAS_HEADERS = ['id','autor','texto','timestamp'];

// ── PUNTO DE ENTRADA (JSONP por GET) ─────────────────────────
function doGet(e)  { return manejar(e); }
function doPost(e) { return manejar(e); }

function manejar(e) {
  const p = (e && e.parameter) ? e.parameter : {};
  const callback = p.callback;
  let resultado;
  try {
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
      case 'crearSugerencia':    resultado = crearSugerencia(p);    break;
      default:
        resultado = { ok: false, error: 'Acción desconocida: ' + p.action };
    }
  } catch (err) {
    resultado = { ok: false, error: String(err.message || err) };
  }
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

function crearReserva(p) {
  const sheet = getSheet('Reservas', RESERVAS_HEADERS);
  const id = 'RES-' + new Date().getTime();
  const ts = new Date().toISOString();
  sheet.appendRow([
    id, p.recurso || '', p.fecha || '', Number(p.bloque || 0),
    p.solicitante || '', p.proposito || '', p.equipos || '',
    'pendiente', '', ts
  ]);
  // Aviso in-app para ambos coordinadores (sin jornada en el payload)
  var msg = 'Nueva solicitud de ' + (p.solicitante || '') + ': ' +
            (p.recurso || '') + ' · ' + (p.fecha || '') + ' · ' + (p.proposito || '');
  crearNotificacion('coord_manana', 'coordinador', msg);
  crearNotificacion('coord_tarde', 'coordinador', msg);
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

// ── PUBLICACIÓN WEB (Google Doc embebido en el Site) ─────────
function publicarAviso(p) {
  try {
    const ss = getSS();
    var sheet = ss.getSheetByName('Avisos');
    if (!sheet) { sheet = ss.insertSheet('Avisos'); sheet.appendRow(['id','creado','fecha_aviso','jornada','tipo','autor','titulo','html','estado']); }
    const id = 'av_' + new Date().getTime() + '_' + Math.random().toString(36).slice(2, 6);
    sheet.appendRow([id, new Date().toISOString(), p.fecha||'', p.jornada||'', p.tipo||'', p.autor||'', p.titulo||'', p.html||'', 'publicado']);

    const doc = DocumentApp.openById(DOC_AVISOS_ID);
    const body = doc.getBody();
    body.clear();
    body.appendParagraph(p.titulo || 'Aviso').setHeading(DocumentApp.ParagraphHeading.HEADING1);
    body.appendParagraph('Publicado ' + new Date().toLocaleString('es-CO')).setItalic(true).setForegroundColor('#6b7280');
    body.appendParagraph('');
    const texto = String(p.html || '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<table[\s\S]*?<\/table>/gi, function(t){ return t.replace(/<\/tr>/gi,'\n').replace(/<\/(th|td)>/gi,' | ').replace(/<[^>]+>/g,'').replace(/\s+\|/g,' |').trim(); })
      .replace(/<br\s*\/?>/gi,'\n').replace(/<\/p>/gi,'\n\n').replace(/<\/h[1-6]>/gi,'\n\n')
      .replace(/<[^>]+>/g,'').replace(/\n{3,}/g,'\n\n').trim();
    body.appendParagraph(texto);
    doc.saveAndClose();
    return { ok: true, id: id, url: 'https://docs.google.com/document/d/' + DOC_AVISOS_ID };
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
}

// ── Sugerencias ──────────────────────────────────────────────

function crearSugerencia(p) {
  const sheet = getSheet('Sugerencias', SUGERENCIAS_HEADERS);
  const id = 'SUG-' + new Date().getTime();
  const ts = new Date().toISOString();
  sheet.appendRow([id, p.autor || 'anónimo', p.texto || '', ts]);
  return { ok: true, id: id };
}
