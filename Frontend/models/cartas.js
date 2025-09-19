// cartas.js
// Modelo de carta + servicio para cargarlas desde /board + utilidades de UI
// No aplica CSS aquí (solo estructura y lógica).

/** ---------------------------
 *  MODELO
 *  ---------------------------
 */
class Carta {
    /**
     * @param {Object} data
     * @param {number} data.id
     * @param {string} data.descripcion
     * @param {"chance"|"community_chest"} data.tipo
     * @param {{money?: number}} data.accion
     */
    constructor({ id, descripcion, tipo, accion = {} }) {
      this.id = id;
      this.descripcion = descripcion;
      this.tipo = tipo;
      this.accion = accion;
    }
  
    static desdeJSON(obj) {
      return new Carta({
        id: obj.id,
        descripcion: obj.description,
        tipo: obj.type, // "chance" | "community_chest"
        accion: obj.action || {},
      });
    }
  
    get esPositiva() {
      const m = Number(this.accion?.money ?? 0);
      return m > 0;
    }
  
    get valor() {
      return Number(this.accion?.money ?? 0);
    }
  
    /**
     * Aplica el efecto de la carta a un "jugador" simple (objeto con {dinero})
     * Devuelve un pequeño log de lo que pasó, por si quieres registrar.
     */
    aplicarA(jugador) {
      const delta = this.valor;
      if (typeof jugador?.dinero === "number") {
        jugador.dinero += delta;
      }
      return {
        cartaId: this.id,
        tipo: this.tipo,
        descripcion: this.descripcion,
        deltaDinero: delta,
        dineroFinal: jugador?.dinero,
      };
    }
  
    /**
     * Crea un elemento DOM representando la tarjeta Monopoly.
     * (Sin estilos inline de color; todo lo maneja el CSS externo.)
     */
    render() {
        const root = document.createElement("article");
        root.className = `card-monopoly ${this.tipo}`;
        root.setAttribute("data-id", String(this.id)); // para el número de serie

        // Banda MONOPOLY
        const band = document.createElement("div");
        band.className = "band-logo";
        band.textContent = "MONOPOLY";
        root.appendChild(band);

        // Encabezado
        const header = document.createElement("header");
        header.className = "card-header";
        header.setAttribute("data-id", String(this.id));
        header.innerHTML = `
          <div class="chip-tipo">
            ${this.tipo === "chance" ? "Sorpresa" : "Caja de Comunidad"}
          </div>
          <div class="icono">
            ${this.tipo === "chance"
                ? `
                <!-- Icono Sorpresa: signo de interrogación -->
                <svg viewBox="0 0 64 64" aria-hidden="true" class="icono-sorpresa">
                  <path d="M32 8c-9.9 0-18 6.4-18 16h8c0-5 4.5-8 10-8s10 3 10 8c0 3.5-2.2 6-5.4 7.9-2.1 1.2-3.6 2.2-4.4 3.1-.8.9-1.2 2-.2 6h8c-.2-1.7-.2-2.5.2-3 .6-.8 1.6-1.6 3.6-2.8C48.6 32.3 52 28.1 52 24c0-9.6-8.1-16-20-16z"/>
                  <circle cx="32" cy="52" r="4"/>
                </svg>
              `
                : `
                <!-- Icono Comunidad: cofre -->
                <svg viewBox="0 0 64 64" aria-hidden="true" class="icono-cofre">
                  <path d="M8 26v22c0 2.2 1.8 4 4 4h40c2.2 0 4-1.8 4-4V26H8zM56 20H8l6-8h36l6 8z"/>
                  <rect x="28" y="30" width="8" height="10" rx="1" ry="1"/>
                </svg>
              `
            }
          </div>
        `;
        root.appendChild(header);

        // Cuerpo
        const body = document.createElement("div");
        body.className = "card-body";
        body.innerHTML = `
          <p class="descripcion">${this.descripcion}</p>
          <div class="valor ${this.esPositiva ? "positivo" : "negativo"}">
            ${this.esPositiva ? "+$" : "-$"}${Math.abs(this.valor)}
          </div>
        `;
        root.appendChild(body);

        // Pie con botón y sello legal
        const footer = document.createElement("footer");
        footer.className = "card-footer";

        const sello = document.createElement("div");
        sello.className = "sello";
        sello.textContent = "© Parker Brothers / Hasbro — Uso académico";
        footer.appendChild(sello);

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn-aplicar";
        btn.textContent = "Aplicar efecto a Jugador Demo";
        btn.addEventListener("click", () => {
            const dineroEl = document.querySelector("#dinero-demo");
            const dinero = Number(dineroEl?.textContent ?? "1500");
            const jugadorDemo = { dinero };
            const log = this.aplicarA(jugadorDemo);
            if (dineroEl) dineroEl.textContent = String(jugadorDemo.dinero);

            const logEl = document.querySelector("#log");
            if (logEl) {
                const li = document.createElement("li");
                li.textContent = `[${this.tipo}] ${this.descripcion} (Δ $${this.valor > 0 ? "+" : ""}${this.valor}) → Dinero: $${jugadorDemo.dinero}`;
                logEl.prepend(li);
            }
            console.debug("LOG-CARTA", log);
        });
        footer.appendChild(btn);

        root.appendChild(footer);
        return root;
    }
  }
  
  /** ---------------------------
   *  SERVICIO
   *  ---------------------------
   */
  class ServicioCartas {
    static URL = "http://127.0.0.1:5000/board"; // backend Flask (CORS activo)
  
    /**
     * Carga ambas pilas desde /board y devuelve {sorpresa: Carta[], comunidad: Carta[]}
     */
    static async cargar() {
      const res = await fetch(this.URL);
      if (!res.ok) throw new Error("No se pudo cargar el tablero");
      const data = await res.json();
  
      // En tu JSON del backend vienen así:
      //  - "chance": [ { id, description, type: "chance", action:{ money } }, ... ]
      //  - "community_chest": [ { id, description, type:"community_chest", action:{ money } }, ... ]
      const sorpresa = (data?.chance ?? []).map(Carta.desdeJSON);
      const comunidad = (data?.community_chest ?? []).map(Carta.desdeJSON);
  
      return { sorpresa, comunidad };
    }
  
    /**
     * Toma una carta aleatoria de la lista indicada.
     * @param {"chance"|"community_chest"} tipo
     * @param {{sorpresa:Carta[], comunidad:Carta[]}} pilas
     */
    static tomarAleatoria(tipo, pilas) {
      const lista =
        tipo === "chance" ? pilas.sorpresa : pilas.comunidad;
      if (!lista?.length) return null;
      const i = Math.floor(Math.random() * lista.length);
      return lista[i];
    }
  }
  
  /** ---------------------------
   *  DEMO / CONTROLADOR UI
   *  ---------------------------
   */
  (async function demoCartas() {
    // Elementos UI
    const $contenedor = document.getElementById("contenedor-carta");
    const $tipo = document.getElementById("select-tipo");
    const $btn = document.getElementById("btn-tomar");
  
    if (!$contenedor || !$tipo || !$btn) return;
  
    // Carga pilas desde backend
    let pilas = { sorpresa: [], comunidad: [] };
    try {
      pilas = await ServicioCartas.cargar();
    } catch (err) {
      console.error(err);
      $contenedor.textContent =
        "Error cargando las cartas. ¿Levantaste el backend en http://127.0.0.1:5000/?";
      return;
    }
  
    // Evento: tomar carta
    $btn.addEventListener("click", () => {
      $contenedor.innerHTML = "";
      const carta = ServicioCartas.tomarAleatoria($tipo.value, pilas);
      if (carta) $contenedor.appendChild(carta.render());
    });
  
    // Auto-tomar una al cargar para que veas algo
    $btn.click();
  })();
  