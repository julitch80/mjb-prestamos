// Configuración global de la app.

// MODO PRUEBA: el login valida el PIN localmente sin llamar al backend
// (PIN fijo por usuario en maestros.ts). Cambiar a false cuando la hoja
// `Usuarios` del Apps Script esté poblada y se quiera login real con PIN
// individual. Al desactivarlo se activa también el cambio de PIN real.
export const MODO_LOCAL = true;
