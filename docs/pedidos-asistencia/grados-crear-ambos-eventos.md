# Pedido para la sesión de asistencia — Grados: poder crear el ensayo Y el evento real (26-nov-2026)

Error en la entrega 43 (ya publicada). En `src/asistencia/Grados.tsx`, `CrearEventos` solo se
muestra cuando NO existe ningún evento (`if (!evento)`). Si coordinación crea primero «el
ensayo», desaparece el botón «Crear Grados 2026» y ya no hay forma de crear el evento real
(y al revés).

Pedido: en la pestaña «Preparar» (superusuario/coordinación), ofrecer el botón del evento que
falte —«Crear el ensayo (3 invitaciones de prueba)» o «Crear Grados 2026»— aunque el otro ya
exista. Al crear, dejar seleccionado el evento recién creado.

Hecho cuando: con solo el ensayo creado, en Preparar aparece «Crear Grados 2026»; al crearlo,
el selector de evento muestra los dos.

Entregar a mjb-prestamos para publicar (Julián imprime el viernes 27).

## 2. El superusuario no llega a Grados (26-nov, captura de Julián)
`src/asistencia/index.tsx` ~l.1012: `if (rol === 'superusuario') return …` muestra su panel propio
(Importar, Centros de interés, Consultar ficha, Diagnóstico) y NUNCA llega a `<Pestanas>`, así que
no ve la sección «Grados» aunque `useVerGrados` le dé true y Grados.tsx lo trate como coordinación.
Pedido: en ese panel del superusuario, un acceso «Grados» que abra la misma pantalla (Lector,
Graduandos, Aforo, Preparar). Hecho cuando: entrando como superusuario a Asistencia aparece «Grados»
y desde ahí se crean el ensayo y el evento real.
