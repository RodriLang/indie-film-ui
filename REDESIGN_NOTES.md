# Primary stage refresh

- Primary stage keeps a 3:4 presentation ratio.
- On mobile it uses the full page content width (390px viewport -> 358px card with the 16px page gutter, ~92% of the screen).
- The stage now has exactly the same left/right gutter as `Destacados`.
- No neighboring card is visible. Each slide owns 100% of the stage viewport.
- Horizontal navigation is indicated only by the custom dot/capsule indicator below the card.
- Title, creator and play remain over the artwork.
- Featured 3:4 and vertical 9:16 rails are unchanged.

## 2026-09-06 · Vertical only + moderation

- Eliminados `ProductionFormat`, `VideoFormat`, `primaryFormat` y selectores de formato.
- Player y experiencia de watch simplificados a 9:16 vertical.
- Studio adaptado a `NOT_SUBMITTED`, `PENDING`, `APPROVED`, `REJECTED`.
- Publicación reemplazada por envío a revisión, aprobación/rechazo y restauración de obras ocultas.
- Cola de moderación y detalle administrativo agregados bajo `/moderation`.
- Acceso administrativo limitado en frontend a roles `MODERATOR` y `ADMIN`.

## 2026-09-07 · Roles, administración y cierre de moderación

- Incorporado `CREATOR` al modelo de auth del frontend.
- `USER` deja de consultar `/api/productions/me`; Studio sólo se carga para `CREATOR+`.
- Anónimos usan un icono de login en lugar de un avatar con inicial artificial.
- Preservado el stage 3:4 con `gap: 12px`, slides al 100% y `scroll-snap-align: start`.
- El detalle de producción es 3:4 en mobile y 16:9 en desktop (`width: min(100%, 1180px)`).
- Preservado `[imageUrl]="creator.avatarUrl || null"` en el perfil.
- Autoplay de trailer silencioso y en loop sólo para el slide activo; se omite con `prefers-reduced-motion`.
- Completado el mapeo de todos los `CreditRole` para evitar enums crudos como `SOUND_DESIGNER`.
- Moderación incorpora tabs Pendientes/Aprobadas/Rechazadas e historial por producción.
- Agregada Administración de usuarios con búsqueda, filtros, paginación y cambio de rol.

## Cuenta y navegación por rol
- El antiguo acceso de perfil de la esquina superior derecha se reemplazó por un menú de cuenta.
- Anónimo: Iniciar sesión / Crear cuenta, sin avatar con inicial ficticia.
- USER: Mi perfil / Cerrar sesión.
- CREATOR+: agrega Studio.
- MODERATOR+: agrega Moderación.
- ADMIN: agrega Usuarios.
- Moderación y Usuarios dejan de ocupar navegación principal permanente; siguen protegidos por sus guards.

## Like dentro del reproductor
- El corazón aparece abajo a la derecha junto con los controles superpuestos del reproductor.
- Representa el like de la producción, no un like independiente del capítulo.
- Cambio optimista con rollback si falla la API.
- Si el visitante es anónimo, abre login conservando returnUrl al reproductor.
