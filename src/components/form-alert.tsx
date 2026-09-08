"use client";

import { useEffect, useRef, useState } from "react";

import { Banner, type BannerTone } from "@/components/banner";

/**
 * Cuánto queda puesto el aviso antes de irse solo, en milisegundos.
 *
 * Quince segundos: alcanza para leer un mensaje largo —los del guardado
 * pueden traer una aclaración del plan detrás— sin que el cartel se quede
 * ocupando la pantalla toda la sesión.
 */
export const FORM_ALERT_MS = 15_000;

/**
 * El aviso de un formulario: cómo salió el envío (TR-040).
 *
 * Es el `Banner` del sitio con lo que un formulario necesita encima: se va
 * solo a los {@link FORM_ALERT_MS}, se puede cerrar antes con la cruz, y
 * vuelve a aparecer entero en cada envío nuevo.
 *
 * Va pegado al encabezado, y por eso se monta **primero** en la página, antes
 * del título — igual que los demás `Banner` (ver `banner.tsx`). Como el
 * encabezado del sitio es `sticky top-0`, este también lo es, justo debajo:
 * un aviso que se fuera con el scroll se perdería en un formulario largo, que
 * es exactamente donde hay que leerlo.
 */
export function FormAlert({
  message,
  tone = "success",
  /**
   * Cambia para volver a mostrar un aviso ya cerrado.
   *
   * Sin esto, dos envíos seguidos con el mismo texto —guardar, cambiar algo,
   * guardar de nuevo— no darían señal: el mensaje sería idéntico, el efecto
   * no se volvería a ejecutar y el segundo guardado parecería no haber pasado.
   * Quien la usa le pasa algo que cambie en cada respuesta del servidor.
   */
  resetKey,
  onDismiss,
  className = "",
}: {
  /** El texto del aviso. Sin mensaje no se dibuja nada. */
  message?: string;
  tone?: BannerTone;
  resetKey?: unknown;
  /** Se llama al cerrarse, por la cruz o por el tiempo. */
  onDismiss?: () => void;
  /**
   * Clases del contenedor. Para los negativos con los que un formulario
   * metido en un bloque con padding devuelve la banda a los bordes.
   */
  className?: string;
}) {
  /*
   * Qué aviso es éste. Cambia cuando llega uno nuevo, y es lo que distingue
   * dos mensajes de igual texto —guardar dos veces seguidas— para que el
   * segundo se vea aunque el primero se hubiera cerrado.
   *
   * Se compara por identidad y no por texto: lo que se pasa suele ser el
   * objeto de estado de `useActionState`, que viene nuevo en cada respuesta
   * del servidor aunque el mensaje sea palabra por palabra el mismo.
   * Convertirlo a cadena los volvería a todos `"[object Object]"` y sería
   * justo el caso que esto viene a resolver.
   */
  const id = resetKey === undefined ? message : resetKey;

  const [shown, setShown] = useState<unknown>(id);
  const [hidden, setHidden] = useState(false);
  /** Cuántos avisos pasaron. Sólo para darle una `key` nueva a cada uno. */
  const [count, setCount] = useState(0);

  /*
   * El aviso nuevo se destapa durante el render y no desde un efecto: es
   * estado derivado de otro, que es la forma que React recomienda, y evita
   * el render intermedio en el que el cartel viejo seguiría puesto.
   */
  if (shown !== id) {
    setShown(id);
    setHidden(false);
    setCount((n) => n + 1);
  }

  /*
   * La última `onDismiss` recibida, para que el temporizador no dependa de
   * ella. Es una función que quien monta esto suele escribir en línea, así
   * que cambia de identidad en cada render: tenerla como dependencia
   * reiniciaría la cuenta en cada uno y el aviso no se iría nunca.
   */
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  });

  /*
   * El temporizador se rearma con cada aviso nuevo: si llega otro mientras el
   * anterior corría, el segundo se lleva sus quince segundos enteros y no lo
   * que le quedaba al primero.
   */
  useEffect(() => {
    if (!message) return;

    const timer = setTimeout(() => {
      setHidden(true);
      onDismissRef.current?.();
    }, FORM_ALERT_MS);

    return () => clearTimeout(timer);
  }, [message, id]);

  if (!message || hidden) return null;

  return (
    /*
     * `sticky` sobre un `z` por debajo del encabezado (50) y por encima del
     * contenido: el aviso se apoya bajo la barra del sitio y ni la tapa ni
     * queda tapado por las tarjetas del formulario.
     */
    <div className={`sticky top-[60px] z-40 ${className}`}>
      {/*
        `key`: monta un `Banner` nuevo por cada aviso en vez de reusar el que
        estaba. Es lo que borra su `dismissed` interno, que si no dejaría
        mudo al siguiente aviso después de cerrar uno a mano. Va por índice
        porque la identidad del estado no sirve de `key`.
      */}
      <Banner
        key={count}
        tone={tone}
        onDismiss={() => {
          setHidden(true);
          onDismiss?.();
        }}
      >
        {message}
      </Banner>
    </div>
  );
}
