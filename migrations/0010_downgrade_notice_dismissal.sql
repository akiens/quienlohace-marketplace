-- ---------------------------------------------------------------------------
-- El aviso de baja de plan, una vez cerrado, se calla
-- ---------------------------------------------------------------------------

/*
 * El aviso de que el plan va a bajar es útil la primera vez y molesto la
 * décima: quien ya lo leyó vuelve al panel a trabajar en su perfil, no a que
 * le repitan algo que decidió él mismo.
 *
 * Se guarda en el perfil y no en el navegador: "ya lo vi" es una decisión de
 * la persona, no del aparato, y con `localStorage` el aviso volvía a aparecer
 * en el teléfono después de haberlo cerrado en la computadora.
 *
 * Dos columnas y no una:
 *
 *   - `downgrade_notice_dismissed_at`: cuándo se cerró el aviso normal. NULL
 *     mientras no se cerró.
 *   - `downgrade_notice_reminded_at`: cuándo se cerró **el recordatorio**, el
 *     que vuelve a aparecer 3 días antes de que la baja tenga efecto. NULL
 *     mientras ese segundo aviso no se cerró.
 *
 * Con una sola columna no se puede distinguir "cerró el aviso" de "cerró
 * también el recordatorio": o el recordatorio no aparecería nunca, o cerrarlo
 * antes de tiempo lo silenciaría para siempre. Son dos avisos distintos y
 * cada uno se cierra por su cuenta.
 *
 * Las dos se limpian al agendar una baja nueva, al cancelarla y al aplicarla:
 * cada baja es un aviso nuevo y arranca sin leer.
 */

ALTER TABLE profiles ADD COLUMN downgrade_notice_dismissed_at TEXT;
ALTER TABLE profiles ADD COLUMN downgrade_notice_reminded_at  TEXT;
