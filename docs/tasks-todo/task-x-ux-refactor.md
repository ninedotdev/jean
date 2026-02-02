# UX Refactor: Panel Derecho con Tabs + Mejoras UI

## Objetivo
Replicar UX similar a Claude Code/Cursor con panel derecho funcional.

---

## Fase 1: Panel Derecho con Tabs (CRÍTICO)

### 1.1 Store y Persistencia
**Archivos:**
- `src/store/ui-store.ts` - Agregar: `rightSidebarSize`, `activeRightPanelTab`
- `src/types/ui-state.ts` - Agregar campos snake_case
- `src-tauri/src/lib.rs` - Agregar a struct UIState
- `src/hooks/useUIStatePersistence.ts` - Sincronizar nuevos campos

### 1.2 Layout con Resize
**Archivo:** `src/components/layout/MainWindow.tsx`
- Agregar resize handle para panel derecho (patrón existente del izquierdo)
- Min: 200px, Max: 600px, Default: 280px

### 1.3 Componente RightSideBar
**Archivo:** `src/components/layout/RightSideBar.tsx` (reescribir)
```
┌─────────────────────────────┐
│ [All Files] [Changes] [✓]  │ ← Tabs
├─────────────────────────────┤
│                             │
│   Tab Content               │
│                             │
└─────────────────────────────┘
```

### 1.4 Sub-componentes (crear)
```
src/components/right-panel/
├── index.ts
├── FileTreePanel.tsx    # Árbol de archivos (usar useWorktreeFiles)
├── GitChangesPanel.tsx  # Staged/Unstaged (usar useGitStatus)
└── CIChecksPanel.tsx    # GitHub Actions + GitLab CI
```

---

## Fase 2: Breadcrumb en ChatWindow

**Crear:** `src/components/chat/ChatBreadcrumb.tsx`
**Modificar:** `src/components/chat/ChatWindow.tsx`

Mostrar: `Project > Worktree > Session` + contexto activo ("Reading file.ts...")

---

## Fase 3: Mejoras Sidebar Izquierdo

**Archivo:** `src/components/projects/WorktreeItem.tsx`
- Agregar timestamps relativos ("2d ago")
- Mejorar indicadores de estado (glow effect)

---

## Fase 4: Backend (si es necesario)

**Git Changes detallado:**
- Extender `src-tauri/src/git_status.rs` para lista de archivos modificados

**CI Checks:**
- Usar sistema existente de PR status
- Extender para GitHub Actions y GitLab CI

---

## Archivos Críticos

| Archivo | Cambio |
|---------|--------|
| `src/store/ui-store.ts` | Agregar estado panel derecho |
| `src/components/layout/MainWindow.tsx` | Integrar resize + panel |
| `src/components/layout/RightSideBar.tsx` | Reescribir con tabs |
| `src/types/ui-state.ts` | Agregar tipos persistencia |
| `src-tauri/src/lib.rs` | Agregar campos UIState |
| `src/components/chat/ChatBreadcrumb.tsx` | Crear nuevo |
| `src/components/right-panel/*.tsx` | Crear nuevos |

---

## Verificación

1. `npm run check:all` - Pasar todos los checks
2. Panel derecho redimensionable y colapsable
3. Tabs funcionan correctamente
4. Estado persiste entre sesiones
5. Performance OK con proyectos grandes

---

## Notas

- Usar `@tanstack/react-virtual` para FileTreePanel si hay muchos archivos
- Seguir patrón de resize existente (DOM directo, commit a Zustand en mouseup)
- GitLab CI: extender polling existente de PR status
