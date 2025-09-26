// CartaService.js  (SERVICIO + DEMO UI)
import Carta from "../models/Carta.js";

export class ServicioCartas {
  static URL = "http://127.0.0.1:5000/board";

  /** Devuelve {sorpresa: Carta[], comunidad: Carta[]} */
  static async cargar() {
    const res = await fetch(this.URL);
    if (!res.ok) throw new Error("No se pudo cargar el tablero");
    const data = await res.json();

    const sorpresa = (data?.chance ?? []).map(Carta.desdeJSON);
    const comunidad = (data?.community_chest ?? []).map(Carta.desdeJSON);
    return { sorpresa, comunidad };
  }

  /** Toma carta aleatoria por tipo */
  static tomarAleatoria(tipo, pilas) {
    const lista = tipo === "chance" ? pilas.sorpresa : pilas.comunidad;
    if (!lista?.length) return null;
    const i = Math.floor(Math.random() * lista.length);
    return lista[i];
  }
}

/* ------- DEMO UI (usa el mismo HTML de tu caratas.html) ------- */
(async function demoCartas() {
  const $contenedor = document.getElementById("contenedor-carta");
  const $tipo = document.getElementById("select-tipo");
  const $btn = document.getElementById("btn-tomar");
  if (!$contenedor || !$tipo || !$btn) return;

  let pilas = { sorpresa: [], comunidad: [] };
  try {
    pilas = await ServicioCartas.cargar();
  } catch (err) {
    console.error(err);
    $contenedor.textContent =
      "Error cargando las cartas. ¿Levantaste el backend en http://127.0.0.1:5000/?";
    return;
  }

  $btn.addEventListener("click", () => {
    $contenedor.innerHTML = "";
    const carta = ServicioCartas.tomarAleatoria($tipo.value, pilas);
    if (carta) $contenedor.appendChild(carta.render());
  });

  // pinta una de entrada
  $btn.click();
})();
