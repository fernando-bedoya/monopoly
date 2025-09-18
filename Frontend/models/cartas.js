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
  
      // Encabezado
      const header = document.createElement("header");
      header.className = "card-header";
      header.innerHTML = `
        <div class="chip-tipo">
          ${this.tipo === "chance" ? "Sorpresa" : "Caja de Comunidad"}
        </div>
        <div class="icono">
          <!-- SVG simple estilo Monopoly: sombrero -->
          <svg viewBox="0 0 64 64" aria-hidden="true" class="icono-hat">
            <path d="M10 40c0 6 10 10 22 10s22-4 22-10v-4H10v4z" />
            <rect x="16" y="22" width="32" height="14" rx="3" ry="3"/>
            <ellipse cx="32" cy="22" rx="18" ry="4"/>
          </svg>
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
  
      // Pie con botones de acción (opcional para demo)
      const footer = document.createElement("footer");
      footer.className = "card-footer";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn-aplicar";
      btn.textContent = "Aplicar efecto a Jugador Demo";
      btn.addEventListener("click", () => {
        // Jugador demo en la UI
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
  