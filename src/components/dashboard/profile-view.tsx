"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { ProfileForm } from "@/components/dashboard/profile-form";
import { PublishToggle } from "@/components/dashboard/publish-toggle";
import { ServiceCardsManager } from "@/components/dashboard/service-cards-manager";
import { ServiceOfferCard } from "@/components/service-offer-card";
import { Icon, SECONDARY_SURFACE } from "@/components/ui";
import { getSpecialty, sectorOfSpecialty } from "@/data/taxonomy";
import { locationLabelById } from "@/data/locations";
import { allowsFeature } from "@/domain/plans";
import {
  PAYMENT_METHOD_LABELS,
  SERVICE_MODE_LABELS,
  type PaymentMethod,
  type PlanLimits,
  type Profile,
  type ProfileImage,
  type ServiceCard,
} from "@/types";

/**
 * El perfil ya creado: se mira, se publica y se edita.
 *
 * Separado del asistente a propósito. El alta es un recorrido de una vez; a
 * partir de ahí lo que se quiere es ver cómo quedó el perfil y corregir algo
 * puntual, no volver a caminar ocho pasos para llegar a un campo.
 *
 * Leer y editar son la misma página y no dos rutas: el cambio es de modo, no
 * de lugar, y navegar perdería el punto de la pantalla en el que se estaba.
 */
export function ProfileView({
  profile,
  plan,
  images,
  serviceCards,
}: {
  profile: Profile;
  plan: PlanLimits;
  images: ProfileImage[];
  serviceCards: ServiceCard[];
}) {
  /*
   * El modo edición vive en la URL (`?editar=1`) y no en un estado local.
   *
   * «Mi perfil» del encabezado apunta a `/dashboard`: con el modo en estado
   * local, tocarlo navegaba a la misma dirección, React no desmontaba nada y
   * el formulario seguía abierto — el botón parecía no hacer nada. Con el
   * modo en la URL, esa navegación deja la dirección sin el parámetro y el
   * perfil vuelve solo a lectura.
   *
   * De paso, el modo sobrevive a una recarga y se puede volver atrás con el
   * botón del navegador, que es lo que se espera de algo que cambia lo que
   * se ve en pantalla.
   */
  const router = useRouter();
  const params = useSearchParams();
  const editing = params.get("editar") === "1";

  const setEditing = (on: boolean) => {
    // `replace` y no `push`: entrar y salir de edición no son pasos del
    // historial que valga la pena recorrer con el botón de atrás.
    router.replace(on ? "/dashboard?editar=1" : "/dashboard");
  };

  /*
   * Los rubros del perfil (`service_sectors`). No se eligen: se derivan de las
   * especialidades (BR-010), y por eso no había fila que mostrarlos — la
   * sección se llamaba "Rubro" y era la única sin ninguno.
   *
   * Se deduplican: dos especialidades del mismo rubro son un rubro solo.
   *
   * Se muestra `short` y no `name`, que es lo que usa el resto del sitio —el
   * menú, la portada, las categorías y el asistente—: el mismo rubro tiene que
   * llamarse igual en todos lados. Con `name` acá decía "Hogar, Construcción y
   * Mantenimiento" y en el menú "Hogar y mantenimiento".
   */
  const sectors = [
    ...new Map(
      profile.specialtyIds
        .map((id) => sectorOfSpecialty(id))
        .filter((sector) => sector !== undefined)
        .map((sector) => [sector.id, sector.short] as const),
    ).values(),
  ];

  const avatar = images.find((image) => image.kind === "avatar") ?? null;
  const cover = images.find((image) => image.kind === "cover") ?? null;
  const gallery = images.filter((image) => image.kind === "gallery");

  if (editing) {
    return (
      /*
        El aviso de "estás editando" no está acá sino en la página, que lo
        monta antes del título: los avisos van pegados al encabezado del sitio
        y desde este punto del árbol no se puede subir hasta ahí.
      */
      <div className="flex min-w-0 flex-col gap-4 px-1 sm:px-0">
        <div className="min-w-0 rounded-card border border-line bg-white shadow-panel">
          <ServiceCardsManager
            cards={serviceCards}
            specialtyIds={profile.specialtyIds.slice(0, plan.maxSpecialties ?? undefined)}
            limit={plan.maxServiceCards}
            profilePublished={profile.profileStatus === "active"}
            embedded
          />
          {/*
            El mismo formulario del alta, abierto de una vez. Comparten campos,
            validación y acción: una sola definición de qué es un perfil válido,
            en vez de dos que se desincronizan.
          */}
          <ProfileForm
            profile={profile}
            plan={plan}
            images={images}
            mode="edicion"
            embedded
            onCancel={() => setEditing(false)}
          />
        </div>
      </div>
    );
  }

  const published = profile.profileStatus === "active";

  return (
    // El padding lateral va acá y no en la página: en edición el aviso tiene
    // que poder salirse de él.
    <div className="flex flex-col gap-5 px-1 sm:px-0">
      {/* Estado y acciones: publicar, editar y ver cómo se ve por fuera. */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-card border border-line bg-white p-4">
        <span
          className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-bold ${
            published
              ? "bg-[#E8F6EF] text-[#1E8C56]"
              : "bg-surface-sunken text-ink-soft"
          }`}
        >
          <Icon
            name={published ? "visibility" : "visibility_off"}
            filled
            className="text-[16px]"
          />
          {published ? "Publicado" : "Sin publicar"}
        </span>

        <span className="text-[13.5px] text-ink-soft">
          {published
            ? "Tu perfil aparece en las búsquedas."
            : "Sólo vos podés verlo."}
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-2.5">
          <Link
            href={`/profesionales/${profile.slug}`}
            className={`flex h-10 items-center gap-1.5 rounded-input px-4 text-[14px] font-semibold ${SECONDARY_SURFACE}`}
          >
            <Icon name="open_in_new" className="text-[17px] text-brand-800" />
            Ver perfil
          </Link>

          <button
            type="button"
            onClick={() => setEditing(true)}
            className={`flex h-10 items-center gap-1.5 rounded-input px-4 text-[14px] font-semibold ${SECONDARY_SURFACE}`}
          >
            <Icon name="edit" className="text-[17px] text-brand-800" />
            Editar
          </button>

          <PublishToggle status={profile.profileStatus ?? "draft"} />
        </div>
      </div>

      {/* Lo cargado, para revisarlo de un vistazo sin entrar a editar. */}
      <div className="flex flex-col rounded-card border border-line bg-white">
        <Section title="Cartas de servicio">
          {serviceCards.length > 0 ? (
            <>
              {!published ? (
                <p className="flex items-start gap-2 rounded-input bg-brand-100 px-3 py-2.5 text-[13px] text-brand-800">
                  <Icon name="visibility_off" className="mt-0.5 text-[16px]" />
                  Estas cartas permanecerán privadas hasta que publiques el perfil.
                </p>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {serviceCards.map((card) => (
                  <div key={card.id} className="relative min-w-0">
                    <ServiceOfferCard card={card} interactive={false} />
                    {(!card.isPublished || !card.isActive) ? (
                      <span className="absolute right-2.5 top-2.5 z-10 rounded-full bg-white/95 px-2.5 py-1 text-[10.5px] font-bold text-ink-soft shadow-card">
                        {!card.isActive ? "Oculta por el plan" : "Borrador"}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
              <p className="text-[12.5px] text-ink-faint">
                Para agregar, modificar o eliminar cartas, entrá en modo edición.
              </p>
            </>
          ) : (
            <p className="text-[14px] text-ink-faint">
              Todavía no creaste cartas de servicio. Podés agregarlas desde el modo edición.
            </p>
          )}
        </Section>

        <Section title="Imágenes">
          <div className="flex flex-wrap items-center gap-4">
            <Thumb image={avatar} label="Foto de perfil" round />
            <Thumb image={cover} label="Portada" />
          </div>

          {allowsFeature(plan, "gallery") && gallery.length > 0 ? (
            <Gallery images={gallery} />
          ) : null}
        </Section>

        <Section title="Identidad">
          <Row label="Nombre">{profile.name}</Row>
          <Row label="Tipo">
            {profile.type === "business"
              ? "Empresa / equipo"
              : "Profesional independiente"}
          </Row>
          <Row label="Descripción">{profile.description}</Row>
        </Section>

        <Section title="Rubro">
          {/* Los rubros se derivan de las especialidades (BR-010). */}
          <Row label="Rubros">
            {sectors.length > 0 ? <Chips values={sectors} /> : <Empty />}
          </Row>
          {/*
            Cada especialidad con su rubro debajo, igual que en el asistente:
            hay homónimas en rubros distintos ("Veterinaria" está en Mascotas y
            en Servicios rurales) y el nombre solo no las distingue.
          */}
          <Row label="Especialidades">
            {profile.specialtyIds.length > 0 ? (
              <Chips
                values={profile.specialtyIds.map((id) => ({
                  label: subcategoryLabel(id),
                  context: sectorOfSpecialty(id)?.short,
                }))}
              />
            ) : (
              <Empty />
            )}
          </Row>
          {/* Sólo el nombre: el servicio se guarda como texto libre (TR-022). */}
          <Row label="Servicios">
            {profile.services.length > 0 ? (
              <Chips values={profile.services.map((item) => item.name)} />
            ) : (
              <Empty />
            )}
          </Row>
        </Section>

        <Section title="Ubicación">
          {/*
            El local es opcional: quien trabaja a domicilio o a distancia no
            tiene uno, y el perfil se publica igual (BR-015).

            Sin local no se dice "Sin completar": no falta nada: es que la
            pregunta no aplica. Ese texto hacía creer que el paso de ubicación
            había quedado a medias y mandaba a completar algo que el perfil no
            necesita. Se dice en cambio por qué no hay una dirección.
          */}
          <Row label="Dónde estás">
            {profile.locations.length > 0 ? (
              /*
                La dirección va con la localidad: ahora es obligatoria (BR-015)
                y es el dato que sirve para llegar. Mostrar sólo "Las Piedras"
                escondía justo la parte que se acababa de pedir.
              */
              <Chips
                values={profile.locations.map((item) => ({
                  label: item.address ?? locationLabelById(item.locationId),
                  context: item.address
                    ? locationLabelById(item.locationId)
                    : undefined,
                }))}
              />
            ) : (
              <span className="text-[14px] text-ink-soft">
                No atendés en un local
              </span>
            )}
          </Row>
          <Row label="Dónde trabajás">
            {profile.serviceAreaIds.length > 0 ? (
              <Chips values={profile.serviceAreaIds.map(locationLabelById)} />
            ) : (
              <Empty />
            )}
          </Row>
          {/* BR-017: con más de una, la atención es híbrida. */}
          {profile.serviceModes.length > 0 ? (
            <Row label="Cómo atendés">
              {profile.serviceModes
                .map((mode) => SERVICE_MODE_LABELS[mode])
                .join(" · ")}
            </Row>
          ) : null}
        </Section>

        <Section title="Contacto">
          <Row label="Teléfono">{profile.phone || <Empty />}</Row>
          <Row label="WhatsApp">
            {profile.whatsappEnabled ? "Sí, este número recibe WhatsApp" : "No"}
          </Row>
          <Row label="Correo de contacto">
            {profile.contactEmail || <Empty />}
          </Row>
          <Row label="Horarios">
            {profile.scheduleEntries.length > 0 ? (
              <Chips values={profile.scheduleEntries.map((e) => e.text)} />
            ) : (
              <Empty />
            )}
          </Row>
          <Row label="Formas de pago">
            {profile.paymentMethods.length > 0 ? (
              <Chips
                values={profile.paymentMethods.map(
                  (method: PaymentMethod) => PAYMENT_METHOD_LABELS[method],
                )}
              />
            ) : (
              <Empty />
            )}
          </Row>
        </Section>

        {allowsFeature(plan, "social") ? (
          <Section title="Redes">
            {profile.socialLinks && profile.socialLinks.length > 0 ? (
              profile.socialLinks.map((link) => (
                <Row key={link.platform} label={link.platform}>
                  {link.url}
                </Row>
              ))
            ) : (
              <Empty />
            )}
          </Section>
        ) : null}

      </div>
    </div>
  );
}

/** Nombre legible de una especialidad; su id si no se encuentra. */
function subcategoryLabel(id: string): string {
  return getSpecialty(id)?.name ?? id;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col border-b border-line-soft last:border-b-0">
      <h2 className="relative z-10 -ml-1 rounded-r-sm bg-header-gradient px-5 py-3 text-[15px] font-bold tracking-[-.2px] text-white shadow-[0_2px_6px_rgba(16,24,40,.18)] [text-shadow:0_1px_1px_rgba(0,0,0,.45)] after:absolute after:left-0 after:top-full after:h-1 after:w-1 after:bg-brand-950 after:[clip-path:polygon(0_0,100%_0,100%_100%)] sm:-ml-3 sm:after:h-3 sm:after:w-3">
        {title}
      </h2>
      <div className="flex flex-col gap-3 p-5">{children}</div>
    </section>
  );
}

/** Etiqueta y valor, en dos columnas en pantallas anchas. */
function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[180px_1fr] sm:gap-4">
      <dt className="text-[13.5px] font-semibold text-ink-muted">{label}</dt>
      <dd className="text-[14.5px] leading-relaxed text-ink">{children}</dd>
    </div>
  );
}

/** Una etiqueta con su procedencia debajo, cuando corresponde mostrarla. */
type ChipValue = { label: string; context?: string };

/**
 * Etiquetas de lo cargado. Con `context` la etiqueta lleva dos líneas —arriba
 * lo elegido, abajo en letra chica de dónde sale—, igual que en el asistente.
 */
function Chips({ values }: { values: (string | ChipValue)[] }) {
  const chips = values.map((value) =>
    typeof value === "string" ? { label: value } : value,
  );

  return (
    <span className="flex flex-wrap gap-1.5">
      {chips.map((chip) => (
        <span
          key={chip.context ? `${chip.context}|${chip.label}` : chip.label}
          className={`bg-brand-100 text-[13px] font-semibold text-brand-800 ${
            chip.context
              ? "flex flex-col rounded-card px-3 py-1 leading-tight"
              : "rounded-full px-3 py-1"
          }`}
        >
          {chip.label}
          {chip.context ? (
            // Acompaña al nombre, no compite con él.
            <span className="text-[11px] font-medium text-brand-800/70">
              {chip.context}
            </span>
          ) : null}
        </span>
      ))}
    </span>
  );
}

/** Lo que todavía no se cargó: se dice, no se deja el hueco en blanco. */
function Empty() {
  return <span className="text-[14px] text-ink-faint">Sin completar</span>;
}

function Thumb({
  image,
  label,
  round = false,
}: {
  image: ProfileImage | null;
  label: string;
  round?: boolean;
}) {
  return (
    <span className="flex items-center gap-2">
      <span
        className={`flex h-14 w-14 items-center justify-center overflow-hidden border border-line bg-surface-muted ${
          round ? "rounded-full" : "rounded-card"
        }`}
      >
        {image ? (
          // La sirve `/media` desde R2: no pasa por el optimizador.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image.url} alt="" className="h-full w-full object-cover" />
        ) : (
          <Icon name="image" className="text-[20px] text-ink-faint" />
        )}
      </span>
      <span className="text-[13.5px] text-ink-soft">{label}</span>
    </span>
  );
}

/**
 * La galería arranca resumida para que la sección siga siendo escaneable:
 * cuatro fotos en móvil (dos filas) y cinco en pantallas amplias (una fila).
 */
function Gallery({ images }: { images: ProfileImage[] }) {
  const [expanded, setExpanded] = useState(false);
  const hasMoreOnMobile = images.length > 4;
  const hasMoreOnDesktop = images.length > 5;

  return (
    <div className="flex flex-col items-start gap-3">
      <h3 className="text-[13.5px] font-semibold text-ink-muted">Galería</h3>

      <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-5">
        {images.map((image, index) => {
          const collapsedVisibility =
            index >= 5 ? "hidden" : index === 4 ? "hidden sm:block" : "";

          return (
            <div
              key={image.id}
              className={`relative aspect-square overflow-hidden rounded-card border border-line bg-surface-muted ${
                expanded ? "" : collapsedVisibility
              }`}
            >
              {/* La sirve `/media` desde R2: no pasa por el optimizador. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.url}
                alt={image.alt || "Foto de la galería"}
                className="h-full w-full object-cover"
              />

              {!image.isActive ? (
                <span className="absolute inset-0 flex items-center justify-center bg-surface-muted/75 px-3 text-center text-[12px] font-semibold leading-snug text-ink">
                  {image.hiddenReason === "plan"
                    ? "Oculta por tu plan"
                    : "Oculta en tu perfil público"}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      {hasMoreOnMobile ? (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
          className={`flex h-10 items-center gap-1.5 rounded-input px-4 text-[14px] font-semibold ${SECONDARY_SURFACE} ${
            hasMoreOnDesktop ? "" : "sm:hidden"
          }`}
        >
          {expanded ? "Mostrar menos" : "Mostrar más"}
          <Icon
            name={expanded ? "expand_less" : "expand_more"}
            className="text-[18px] text-brand-800"
          />
        </button>
      ) : null}
    </div>
  );
}
