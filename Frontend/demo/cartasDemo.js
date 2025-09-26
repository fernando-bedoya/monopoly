// src/demo/cartasDemo.js
import { ServicioCartas } from "../controllers/ServicioCartas.js";

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

  // Auto-tomar una carta al cargar
  $btn.click();
})();
