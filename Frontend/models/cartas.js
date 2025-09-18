// ModalCartas.js
class ModalCartas {
    /**
     * @param {Object} opts
     * @param {HTMLElement} [opts.container=document.body] Dónde insertar el modal
     * @param {string} [opts.endpoint='/board'] Endpoint que retorna el JSON del tablero
     * @param {boolean} [opts.autoFetch=true] Si true, carga cartas desde el backend
     * @param {Object} [opts.cartas] Inyecta cartas manualmente { chance:[], community_chest:[] }
     */
    constructor({ container = document.body, endpoint = '/board', autoFetch = true, cartas = null } = {}) {
      this.container = container;
      this.endpoint = endpoint;
  
      this.mazos = {
        chance: [],
        community_chest: []
      };
      this.descartes = {
        chance: [],
        community_chest: []
      };
  
      this._listeners = new Map(); // eventos personalizados
      this._tipoAbierto = null;    // 'chance' | 'community_chest'
      this._ultimaCarta = null;
  
      // Crear DOM del modal (sin estilos)
      this.$overlay = document.createElement('div');
      this.$overlay.setAttribute('role', 'dialog');
      this.$overlay.setAttribute('aria-modal', 'true');
      this.$overlay.style.display = 'none'; // sin CSS, oculto/visible con display
      this.$overlay.tabIndex = -1;
  
      // Contenido básico
      this.$content = document.createElement('div');
      this.$titulo = document.createElement('h3');
      this.$descripcion = document.createElement('p');
  
      this.$acciones = document.createElement('div');
      this.$btnTomar = document.createElement('button');
      this.$btnCerrar = document.createElement('button');
  
      this.$btnTomar.textContent = 'Tomar carta';
      this.$btnCerrar.textContent = 'Cerrar';
  
      this.$acciones.appendChild(this.$btnTomar);
      this.$acciones.appendChild(this.$btnCerrar);
  
      this.$content.appendChild(this.$titulo);
      this.$content.appendChild(this.$descripcion);
      this.$content.appendChild(this.$acciones);
      this.$overlay.appendChild(this.$content);
      this.container.appendChild(this.$overlay);
  
      // Eventos UI
      this.$btnCerrar.addEventListener('click', () => this.cerrar());
      this.$btnTomar.addEventListener('click', () => {
        if (!this._tipoAbierto) return;
        const carta = this.tomar(this._tipoAbierto);
        this._ultimaCarta = carta || null;
        this.renderCarta(carta);
        this._emit('carta-tomada', { tipo: this._tipoAbierto, carta });
      });
  
      // Cerrar con tecla ESC
      this._onKeydown = (e) => {
        if (e.key === 'Escape') this.cerrar();
      };
  
      // Carga inicial
      if (cartas && (Array.isArray(cartas.chance) || Array.isArray(cartas.community_chest))) {
        this.setCartas(cartas);
      } else if (autoFetch) {
        this.cargarDesdeBackend().catch((err) => {
          console.error('Error cargando cartas:', err);
        });
      }
    }
  
    // --- Eventos personalizados ---
    on(evento, handler) {
      if (!this._listeners.has(evento)) this._listeners.set(evento, new Set());
      this._listeners.get(evento).add(handler);
      return () => this.off(evento, handler);
    }
  
    off(evento, handler) {
      if (this._listeners.has(evento)) {
        this._listeners.get(evento).delete(handler);
      }
    }
  
    _emit(evento, payload) {
      if (!this._listeners.has(evento)) return;
      for (const fn of this._listeners.get(evento)) {
        try { fn(payload); } catch (e) { console.error(e); }
      }
    }
  
    // --- Datos ---
    async cargarDesdeBackend() {
      const res = await fetch(this.endpoint);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
  
      // El backend expone arrays 'chance' y 'community_chest' dentro del board JSON
      // (ver app.py y board.json) :contentReference[oaicite:2]{index=2} :contentReference[oaicite:3]{index=3}
      const chance = Array.isArray(data.chance) ? data.chance : [];
      const community = Array.isArray(data.community_chest) ? data.community_chest : [];
  
      this.setCartas({ chance, community_chest: community });
    }
  
    setCartas({ chance = [], community_chest = [] }) {
      this.mazos.chance = this._barajar([...chance]);
      this.mazos.community_chest = this._barajar([...community_chest]);
      this.descartes.chance = [];
      this.descartes.community_chest = [];
      this._emit('cartas-cargadas', { chance: this.mazos.chance.length, community_chest: this.mazos.community_chest.length });
    }
  
    _barajar(arr) {
      // Fisher–Yates
      for (let i = arr.length - 1; i > 0; i--) {
        const j = (Math.random() * (i + 1)) | 0;
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }
  
    // --- Lógica de cartas ---
    /**
     * Toma la carta superior del mazo. Si el mazo se acaba, rebaraja descartes.
     * @param {'chance'|'community_chest'} tipo
     * @returns {Object|null} carta
     */
    tomar(tipo) {
      this._asegurarTipo(tipo);
      if (this.mazos[tipo].length === 0) {
        // rebarajar descartes
        if (this.descartes[tipo].length === 0) return null;
        this.mazos[tipo] = this._barajar(this.descartes[tipo]);
        this.descartes[tipo] = [];
        this._emit('mazo-rebarajado', { tipo });
      }
      const carta = this.mazos[tipo].shift();
      if (carta) this.descartes[tipo].push(carta);
      return carta || null;
    }
  
    /**
     * Aplica la acción monetaria de la carta al jugador (mutando jugador.dinero).
     * @param {Object} jugador - Debe tener propiedad 'dinero' (number)
     * @param {Object} carta   - Debe tener action.money (number)
     * @returns {number} delta aplicado (puede ser negativo)
     */
    aplicarAccionAJugador(jugador, carta) {
      if (!jugador || typeof jugador.dinero !== 'number' || !carta) return 0;
      const delta = (carta.action && typeof carta.action.money === 'number') ? carta.action.money : 0;
      jugador.dinero += delta;
      this._emit('accion-aplicada', { jugador, carta, delta });
      return delta;
    }
  
    // --- UI ---
    abrir(tipo) {
      this._asegurarTipo(tipo);
      this._tipoAbierto = tipo;
      this.$titulo.textContent = (tipo === 'chance') ? 'Sorpresa' : 'Caja de Comunidad';
      this.$descripcion.textContent = 'Haz clic en “Tomar carta” para revelar.';
      this.$overlay.style.display = 'block';
      document.addEventListener('keydown', this._onKeydown);
      this._emit('modal-abierto', { tipo });
      // foco accesible
      this.$overlay.focus();
    }
  
    cerrar() {
      this.$overlay.style.display = 'none';
      document.removeEventListener('keydown', this._onKeydown);
      const tipo = this._tipoAbierto;
      this._tipoAbierto = null;
      this._emit('modal-cerrado', { tipo, ultimaCarta: this._ultimaCarta });
      this._ultimaCarta = null;
    }
  
    renderCarta(carta) {
      if (!carta) {
        this.$descripcion.textContent = 'No hay cartas disponibles ahora mismo.';
        return;
      }
      // Las cartas del backend tienen: id, description, type, action.money (±) :contentReference[oaicite:4]{index=4}
      this.$descripcion.textContent = carta.description || '(Carta sin descripción)';
    }
  
    // --- Util ---
    _asegurarTipo(tipo) {
      const ok = (tipo === 'chance' || tipo === 'community_chest');
      if (!ok) throw new Error('Tipo de carta inválido. Usa "chance" o "community_chest".');
    }
  }
  
  // -------------------------
  // Ejemplo de uso (integración):
  // -------------------------
  // const modalCartas = new ModalCartas({
  //   endpoint: 'http://127.0.0.1:5000/board', // tu API Flask expone /board :contentReference[oaicite:5]{index=5}
  //   autoFetch: true
  // });
  //
  // // Cuando el jugador cae en Sorpresa:
  // // modalCartas.abrir('chance');
  // // Cuando cae en Caja de Comunidad:
  // // modalCartas.abrir('community_chest');
  //
  // modalCartas.on('carta-tomada', ({ tipo, carta }) => {
  //   // Aplica efecto al jugador actual (ejemplo):
  //   // const delta = modalCartas.aplicarAccionAJugador(jugadorActual, carta);
  //   // log(`Carta ${tipo}: ${carta.description}  (Δ$ ${delta})`);
  // });
  //
  // modalCartas.on('modal-cerrado', ({ tipo, ultimaCarta }) => {
  //   // Continuar flujo del turno…
  /* });
  */
  