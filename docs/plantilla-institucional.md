# Plantilla institucional para documentos impresos

Todo lo que la aplicación saque **en papel o en PDF** debe verse igual: con el
membrete del colegio, el mismo de los documentos oficiales (escudo, resolución,
NIT arriba; marca de agua al centro; franja de contacto abajo).

- Componente: `src/components/DocumentoInstitucional.tsx`
- Membrete: `public/membrete-mjb.jpg` (extraído del docx «política de tareas 2026»)
- Ejemplo real de uso: `src/components/acompanamientos/AcompanamientosImprimible.tsx`

## Cómo se usa

```tsx
const [imprimiendo, setImprimiendo] = useState(false);

<button onClick={() => setImprimiendo(true)}>Exportar para imprimir</button>

{imprimiendo && (
  <DocumentoInstitucional
    titulo="Informe de asistencia"
    subtitulo="Grupo 10.2 · Tercer periodo"
    pie="Generado por Janneth Ocampo"
    onCerrar={() => setImprimiendo(false)}
  >
    <p className="doc-inst-parrafo">Texto normal del documento.</p>
    <table className="doc-inst-tabla">…</table>
  </DocumentoInstitucional>
)}
```

El usuario ve la hoja en pantalla y decide: **Imprimir / Guardar PDF** abre el
diálogo del navegador (ahí elige «Guardar como PDF»), **Cerrar** vuelve.

## Reglas

- **Vertical por defecto.** `orientacion="horizontal"` es para tablas que no
  caben en vertical; en apaisada el membrete de fondo no va (la imagen es
  vertical) y en su lugar sale el nombre del colegio con la línea roja.
- **Clases listas:** `doc-inst-tabla` (bordes y encabezado verde claro),
  `doc-inst-col-titulo` (primera columna), `doc-inst-parrafo` (texto
  justificado). Se puede traer HTML propio: se imprime tal cual.
- **Negro sobre blanco.** El documento no usa los tokens del tema: una hoja
  impresa en modo oscuro es papel gastado.
- **No tocar el `@media print` del componente.** El overlay fijo pasa a
  estático (si no, Chrome recorta la impresión a una página) y `print-color-adjust:
  exact` es lo que hace que el navegador imprima el membrete en vez de dejarlo
  en blanco.
- **Una sola fuente del membrete.** Si el colegio cambia el papelería, se
  reemplaza `public/membrete-mjb.jpg` y cambian todos los documentos.

## Qué falta por migrar

Estas pantallas imprimen con su propio formato, anterior a esta plantilla:

- `src/components/AgendaImprimible.tsx` (agenda semanal)
- `src/components/HistorialCaso.tsx` → `VistaImprimibleHistorial`
- `src/components/InformeContencion.tsx`
- `src/asistencia/MosaicoGrupo.tsx`

Migrarlas es cambiar su envoltorio por `DocumentoInstitucional` y renombrar las
clases de sus tablas. No se hizo todo de una vez a propósito: cada una imprime
datos sensibles o de otro módulo y conviene verificarlas una por una.
