# Guía de migración — MJB Préstamos a Claude Code

## Prerrequisitos

1. **Claude Code** instalado y funcionando (Node.js 18+)
2. **Git** configurado con tu usuario `julitch80`
3. **GitHub CLI** o acceso SSH a GitHub
4. Cuenta de **Anthropic** con API key o plan Max/Team

---

## Paso 1 — Preparar el repositorio en GitHub

### 1.1 Clonar el repositorio actual

```bash
git clone https://github.com/julitch80/mjb-prestamos.git
cd mjb-prestamos
```

### 1.2 Inicializar el proyecto React

```bash
npm create vite@latest . -- --template react-ts
npm install zustand
npm install -D tailwindcss @tailwindcss/vite
```

### 1.3 Copiar el CLAUDE.md a la raíz

Copia el archivo `CLAUDE.md` generado a la raíz del proyecto. Claude Code lo leerá automáticamente al abrir el proyecto.

### 1.4 Configurar GitHub Actions para build automático

Crear el archivo `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
      - uses: actions/deploy-pages@v4
```

Luego en GitHub → Settings → Pages → Source: GitHub Actions.

Con esto, cada `git push` despliega automáticamente. No más copiar/pegar HTML.

---

## Paso 2 — Instalar skills y plugins en Claude Code

### 2.1 Plugins esenciales

Ejecutar en Claude Code:

```
/plugin marketplace add superpowers
/plugin marketplace add frontend-design
```

### 2.2 Skills personalizadas del proyecto

Crear la carpeta de skills del proyecto:

```bash
mkdir -p .claude/skills/mjb-editor
mkdir -p .claude/skills/mjb-horario
mkdir -p .claude/skills/mjb-theme
```

### 2.3 Crear CLAUDE.md del proyecto

Ya está creado. Copiar a la raíz del repositorio.

---

## Paso 3 — Reconstruir el código fuente

### CRÍTICO: El código fuente no existe en GitHub

Solo el HTML compilado está en el repositorio. El código fuente (los archivos .tsx) debe reconstruirse. El archivo `CLAUDE.md` contiene toda la especificación necesaria.

### Instrucción para Claude Code

Al abrir Claude Code en el directorio del proyecto, decirle:

> Lee el CLAUDE.md completo. Este proyecto necesita ser reconstruido desde cero como una app React + TypeScript + Tailwind + Zustand. El HTML compilado actual está desplegado en GitHub Pages y funciona. Necesito que reconstruyas el código fuente manteniendo toda la funcionalidad documentada y las funcionalidades incompletas marcadas con ⚠. Empieza por la estructura del proyecto y los datos (horarioBase, maestros, store), luego los componentes en orden de dependencia.

### Orden de reconstrucción sugerido

1. `package.json` + `vite.config.ts` + `tsconfig.json` + `tailwind.config.ts`
2. `src/data/maestros.ts` — usuarios, recursos, bloques, propósitos
3. `src/data/horarioBase.ts` — las 600 entradas del horario (300 mañana + 300 tarde)
4. `src/data/store.ts` — Zustand store con todos los estados
5. `src/data/api.ts` — comunicación con Apps Script
6. `src/hooks/useDevice.ts` + `src/hooks/useTheme.ts`
7. `src/components/LoginScreen.tsx`
8. `src/components/DisponibilidadGrid.tsx`
9. `src/components/PanelConfirmacion.tsx`
10. `src/components/MiHistorial.tsx`
11. `src/components/BannerNotificaciones.tsx`
12. `src/components/VistaHorario.tsx` — el más complejo
13. `src/components/EditorHorario.tsx` — incompleto, documentado en CLAUDE.md
14. `src/components/AsistenteAusencia.tsx` — incompleto
15. `src/components/PanelRectora.tsx` + `src/components/PopupRectora.tsx`
16. `src/components/PanelAdmin.tsx`
17. `src/App.tsx`

### Fuentes de verdad para los datos

- **Horario mañana:** archivo Word `HORARIO_JM_2026__2_.docx` — procesado y verificado con correcciones: Elizabeth→Marta, Liliana→Carlos, Yoguis=Juan C. Blandón
- **Horario tarde:** archivo Excel `HORARIO_DE_CLASES_TARDE_JUNIO_2026_vf.xls` — 300 bloques verificados completos
- **Usuarios:** definidos en `maestros.ts` con IDs, correos, roles, jornadas, PINes

---

## Paso 4 — Completar funcionalidades pendientes

Una vez reconstruido el código fuente, completar en este orden:

### 4.1 Editor de horario temporal (prioridad alta)

El editor debe mostrar SOLO los grupos afectados por las ausencias declaradas, no todas las aulas. Los bloques del docente ausente deben verse "apagados" (fondo muy tenue, letra roja, borde discreto) y NO exigir reubicación. Ver sección "⚠ Editor de horario temporal" en CLAUDE.md.

### 4.2 Asistente de ausencia avanzado (prioridad alta)

Completar las propuestas inteligentes de reorganización. Ver sección "⚠ Asistente de ausencia avanzado" en CLAUDE.md.

### 4.3 Tema claro (prioridad media)

Rediseñar completamente la ambientación gráfica para tema claro. No es un simple cambio de fondo — todos los elementos deben tener buena legibilidad en fondo blanco/gris claro.

### 4.4 Correos automáticos (prioridad media)

Los cambios de horario deben generar correos automáticos via Apps Script a los docentes afectados y a los administradores de la web (Blandón + Uriel).

---

## Paso 5 — Verificación post-migración

### Checklist funcional

- [ ] Login con escudo MJB funciona
- [ ] Recuperación de PIN envía correo
- [ ] Disponibilidad muestra cuadrícula correcta
- [ ] Reservas se pueden crear y aprobar
- [ ] Horario del J — vista aulas mañana muestra solo profes mañana
- [ ] Horario del J — vista aulas tarde muestra solo profes tarde
- [ ] Horario del J — vista docente con banners Opción B
- [ ] Horario del J — vista grupo con Director·Grupo en selector
- [ ] Horario del J — CI en dorado martes B6
- [ ] Horario del J — docentes mixtos con columna tarde en dorado
- [ ] Coordinadores: editan solo su jornada
- [ ] Rectora: popup directo sin pendientes
- [ ] Notificaciones: banner expandible para docentes
- [ ] Tema oscuro/claro: toggle funcional
- [ ] Casita cierra sesión correctamente
- [ ] No hay reset automático después de 2+ minutos
- [ ] Paleta de colores por aula y grado funcional
- [ ] Apps Script responde sin error CORS

---

## Notas para Claude Code

### Lo que NO debe cambiar

- La paleta de colores de cada docente — ya está definida y aprobada
- Los horarios base — verificados bloque por bloque con el usuario
- La lógica de docentes mixtos (MIXTOS_TARDE) — confirmada con datos reales
- La notación de grados (punto vs ordinal) — es intencional para distinguir jornadas
- El estilo de banners Opción B en las vistas por día
- Los directores de grupo de mañana — confirmados por el usuario

### Lo que SÍ puede mejorar

- Rendimiento del build (Vite ya es rápido, pero el bundle de 500KB podría optimizarse)
- Accesibilidad (contraste, lectores de pantalla)
- Responsividad en móvil (ya funciona pero puede mejorar)
- Estructura del código (separar constantes en archivos dedicados)
- Testing (no hay tests actualmente)
