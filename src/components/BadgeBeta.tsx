// Etiqueta «Beta» para funciones a prueba (p. ej. recordatorios de Tareas).
export default function BadgeBeta() {
  return (
    <span
      title="Función a prueba: funciona, pero puede cambiar o retirarse"
      className="ml-1.5 inline-block align-middle rounded-full border border-warning bg-warning-soft text-warning-soft-fg px-1.5 py-px text-[10px] font-bold uppercase tracking-wider leading-tight"
    >
      Beta
    </span>
  );
}
