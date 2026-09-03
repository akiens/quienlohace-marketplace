/**
 * Verifica las reglas de cambio de plan: qué plan rige hoy, cuándo hay una
 * baja agendada, cuándo corresponde consolidarla y la ventana de retención.
 *
 * Se ejecuta con: npx tsx scripts/check-plan-changes.ts
 */
import {
  EXCESS_RETENTION_DAYS,
  downgradeIsDue,
  effectivePlanId,
  hasScheduledDowngrade,
  nextPeriodEnd,
  planChangeKind,
  purgeDeadline,
} from "../src/domain/plan-changes";
import type { PlanLimits } from "../src/types";

let failures = 0;

function check(label: string, condition: boolean, detail = "") {
  if (condition) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const plan = (id: "cobre" | "gold" | "platinum", rank: number) =>
  ({ id, rank }) as PlanLimits;

const cobre = plan("cobre", 1);
const oro = plan("gold", 2);
const platino = plan("platinum", 3);

const AYER = "2026-09-01T00:00:00.000Z";
const MANANA = "2026-12-01T00:00:00.000Z";
const HOY = new Date("2026-09-02T12:00:00.000Z");

console.log("\nQué clase de cambio es");
check("Cobre -> Oro es subir", planChangeKind(cobre, oro) === "upgrade");
check("Cobre -> Platino es subir", planChangeKind(cobre, platino) === "upgrade");
check("Platino -> Oro es bajar", planChangeKind(platino, oro) === "downgrade");
check("Platino -> Cobre es bajar", planChangeKind(platino, cobre) === "downgrade");
check("Oro -> Cobre es bajar", planChangeKind(oro, cobre) === "downgrade");
check("el mismo plan no es cambio", planChangeKind(oro, oro) === "same");

console.log("\nQué plan rige hoy");
check(
  "sin baja agendada manda el suyo",
  effectivePlanId({ planId: "gold" }, HOY) === "gold",
);
check(
  "baja agendada con período corriendo -> sigue el contratado",
  effectivePlanId(
    { planId: "platinum", downgradePlanId: "gold", planExpiresAt: MANANA },
    HOY,
  ) === "platinum",
);
check(
  "baja agendada ya vencida -> rige el menor",
  effectivePlanId(
    { planId: "platinum", downgradePlanId: "gold", planExpiresAt: AYER },
    HOY,
  ) === "gold",
);
check(
  "baja a Cobre vencida -> rige Cobre",
  effectivePlanId(
    { planId: "platinum", downgradePlanId: "cobre", planExpiresAt: AYER },
    HOY,
  ) === "cobre",
);

/*
 * El caso que se escapó una vez: un plan pago sin fecha de vencimiento. No
 * saber cuándo termina el período no es lo mismo que saber que terminó, así
 * que sigue mandando el plan contratado. Antes devolvía el menor, y la baja
 * se aplicaba al instante y sin aviso.
 */
check(
  "baja sin fecha de vencimiento -> sigue el plan contratado",
  effectivePlanId({ planId: "gold", downgradePlanId: "cobre" }, HOY) === "gold",
);
check(
  "y se avisa que está agendada",
  hasScheduledDowngrade({ planId: "gold", downgradePlanId: "cobre" }, HOY),
);
check(
  "lo mismo bajando de Platino",
  effectivePlanId({ planId: "platinum", downgradePlanId: "cobre" }, HOY) ===
    "platinum",
);
check(
  "una fecha corrupta no cambia nada",
  effectivePlanId(
    { planId: "platinum", downgradePlanId: "cobre", planExpiresAt: "basura" },
    HOY,
  ) === "platinum",
);
check(
  "baja al mismo plan se ignora",
  effectivePlanId(
    { planId: "gold", downgradePlanId: "gold", planExpiresAt: AYER },
    HOY,
  ) === "gold",
);

console.log("\nEl borde exacto del vencimiento");
const JUSTO = "2026-09-02T12:00:00.000Z";
check(
  "al instante exacto ya rige el menor",
  effectivePlanId(
    { planId: "platinum", downgradePlanId: "gold", planExpiresAt: JUSTO },
    HOY,
  ) === "gold",
);
check(
  "un segundo antes todavía manda el contratado",
  effectivePlanId(
    {
      planId: "platinum",
      downgradePlanId: "gold",
      planExpiresAt: "2026-09-02T12:00:01.000Z",
    },
    HOY,
  ) === "platinum",
);

console.log("\nHay baja agendada pendiente (se avisa en el perfil)");
check(
  "con período corriendo sí",
  hasScheduledDowngrade(
    { planId: "platinum", downgradePlanId: "gold", planExpiresAt: MANANA },
    HOY,
  ),
);
check(
  "ya vencida no (dejó de estar pendiente)",
  !hasScheduledDowngrade(
    { planId: "platinum", downgradePlanId: "gold", planExpiresAt: AYER },
    HOY,
  ),
);
check("sin baja no", !hasScheduledDowngrade({ planId: "gold" }, HOY));

console.log("\nBaja vencida: corresponde consolidarla en la fila");
check(
  "vencida -> sí",
  downgradeIsDue(
    { planId: "platinum", downgradePlanId: "gold", planExpiresAt: AYER },
    HOY,
  ),
);
check(
  "todavía corriendo -> no",
  !downgradeIsDue(
    { planId: "platinum", downgradePlanId: "gold", planExpiresAt: MANANA },
    HOY,
  ),
);
check("sin baja -> no", !downgradeIsDue({ planId: "gold" }, HOY));
check(
  "sin fecha -> no (no se sabe si venció)",
  !downgradeIsDue({ planId: "gold", downgradePlanId: "cobre" }, HOY),
);

console.log("\nPeríodo nuevo al subir de plan");
const desdeSubida = new Date("2026-09-02T00:00:00.000Z");
const fin = new Date(nextPeriodEnd(desdeSubida));
check("el vencimiento se corre un mes", fin.getMonth() === 9, `dio mes ${fin.getMonth()}`);
check("y queda en el futuro", fin > desdeSubida);

console.log("\nVentana de retención");
const desde = new Date("2026-09-02T00:00:00.000Z");
const limite = new Date(purgeDeadline(desde));
const dias = Math.round(
  (limite.getTime() - desde.getTime()) / (1000 * 60 * 60 * 24),
);
check(`son ${EXCESS_RETENTION_DAYS} días`, dias === EXCESS_RETENTION_DAYS, `dio ${dias}`);
check("la fecha límite es futura", limite > desde);

console.log(
  failures === 0
    ? "\nTodo en orden.\n"
    : `\n${failures} verificacion(es) fallaron.\n`,
);
process.exit(failures === 0 ? 0 : 1);
