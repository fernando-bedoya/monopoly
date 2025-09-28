// Módulo de cartas (Suerte y Caja de Comunidad)
// Uso: import { applyCards } from './gameParts/cards.js'; applyCards(Game);

export function applyCards(Game){
  if(!Game || typeof Game !== 'function') return;
  if(Game.__cardsApplied) return; Game.__cardsApplied = true;

  // Fallback local previa (se mantiene como respaldo si backend no provee cartas)
  const cartasSuerteFallback = [
    { id: 9001, texto: 'Avanza hasta la casilla GO y cobra $200', accion: { tipo: 'mover', destino: 0, cobrar: 200 } },
    { id: 9002, texto: 'Retrocede 3 casillas', accion: { tipo: 'moverRelativo', pasos: -3 } },
    { id: 9003, texto: 'Paga una multa de $50', accion: { tipo: 'pagar', cantidad: 50 } },
    { id: 9004, texto: 'Ve a la cárcel directamente', accion: { tipo: 'carcel' } },
  ];
  const cartasComunidadFallback = [
    { id: 9101, texto: 'Recibe herencia de $100', accion: { tipo: 'cobrar', cantidad: 100 } },
    { id: 9102, texto: 'Paga $40 por médico', accion: { tipo: 'pagar', cantidad: 40 } },
    { id: 9103, texto: 'Ve a la cárcel', accion: { tipo: 'carcel' } },
    { id: 9104, texto: 'Avanza 2 casillas', accion: { tipo: 'moverRelativo', pasos: 2 } },
  ];

  /**
   * Mapea una carta cruda del backend al formato interno { id, texto, accion }
   * Formatos esperados backend (ejemplos):
   *  { id, description, type:'chance', action:{ money: 150 } }
   *  { id, description, type:'community_chest', action:{ money: -75 } }
   *  { id, description, action:{ goTo: 'jail' } }
   *  { id, description, action:{ moveTo: 0, reward:200 } }
   */
  function mapBackendCard(raw){
    if(!raw || typeof raw !== 'object') return null;
    const id = raw.id ?? crypto.randomUUID?.() ?? Math.floor(Math.random()*1e9);
    const texto = raw.description || raw.text || raw.texto || 'Carta';
    const act = raw.action || raw.accion || {};
    let accion = null;
    // Dinero directo
    if(typeof act.money === 'number'){
      accion = { tipo: act.money >=0 ? 'cobrar' : 'pagar', cantidad: Math.abs(act.money) };
    }
    // Ir a cárcel
    else if(/jail|carcel/i.test(act.goTo || act.goto || '')){
      accion = { tipo:'carcel' };
    }
    // Mover a posición absoluta
    else if(typeof act.moveTo === 'number'){
      accion = { tipo:'mover', destino: act.moveTo, cobrar: act.reward||0 };
    }
    // Pasos relativos
    else if(typeof act.steps === 'number'){
      accion = { tipo:'moverRelativo', pasos: act.steps };
    }
    // Si hay reward sin move (solo cobrar)
    else if(typeof act.reward === 'number'){
      accion = { tipo: act.reward>=0?'cobrar':'pagar', cantidad: Math.abs(act.reward) };
    }
    // Fallback: sin acción (solo mostrar carta)
    if(!accion){
      accion = { tipo:'ninguna' }; // se ignorará en procesarAccionCarta
    }
    return { id, texto, accion, _raw: raw };
  }

  function obtenerDesdeBackendColeccion(boardArray, tipo){
    if(!Array.isArray(boardArray) || !boardArray.length) return null;
    const mapped = boardArray.map(c=> mapBackendCard(c)).filter(Boolean);
    if(!mapped.length) return null;
    console.log(`🃏 Cartas mapeadas (${tipo}):`, mapped.length);
    return mapped;
  }

  Game.prototype.obtenerCartasSuerte = function(){
    if(!this._cartasSuerte){
      // Intentar backend
      const backend = this.board?.chanceCards; // crudo
      const mapped = obtenerDesdeBackendColeccion(backend,'chance');
      this._cartasSuerte = mapped || [...cartasSuerteFallback];
    }
    return this._cartasSuerte;
  };

  Game.prototype.obtenerCartasComunidad = function(){
    if(!this._cartasComunidad){
      const backend = this.board?.communityCards; // crudo
      const mapped = obtenerDesdeBackendColeccion(backend,'community');
      this._cartasComunidad = mapped || [...cartasComunidadFallback];
    }
    return this._cartasComunidad;
  };

  Game.prototype.manejarSuerte = async function(player){
    const cartas = this.obtenerCartasSuerte();
    if(!cartas.length){ this.notifyWarn('Suerte','No hay cartas disponibles'); return; }
    const carta = cartas[Math.floor(Math.random()*cartas.length)];
    await this.mostrarCartaBonita('Suerte', carta.texto, '#9b59b6');
    await this.procesarAccionCarta(player, carta.accion);
  };

  Game.prototype.manejarCajaComunidad = async function(player){
    const cartas = this.obtenerCartasComunidad();
    if(!cartas.length){ this.notifyWarn('Caja de Comunidad','No hay cartas disponibles'); return; }
    const carta = cartas[Math.floor(Math.random()*cartas.length)];
    await this.mostrarCartaBonita('Caja de Comunidad', carta.texto, '#27ae60');
    await this.procesarAccionCarta(player, carta.accion);
  };

  Game.prototype.mostrarCartaBonita = async function(titulo, texto, color='#34495e'){
    // Reutilizable: crea modal simple emergente
    let overlay = document.getElementById('cartaOverlay');
    if(!overlay){
      overlay = document.createElement('div');
      overlay.id = 'cartaOverlay';
      overlay.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55);z-index:12000;font-family:system-ui,sans-serif;';
      document.body.appendChild(overlay);
    }
    overlay.innerHTML = '';

    const card = document.createElement('div');
    card.style.cssText = `width:min(90%,420px);background:#fff;border-radius:18px;padding:28px 26px;box-shadow:0 12px 38px -8px rgba(0,0,0,.32);position:relative;overflow:hidden;animation:cardPop .4s cubic-bezier(.16,.8,.33,1);`;
    card.innerHTML = `
      <div style="font-size:14px;letter-spacing:.5px;font-weight:600;color:${color};text-transform:uppercase;margin-bottom:4px;">${titulo}</div>
      <h3 style="margin:0 0 14px;font-size:22px;line-height:1.15;color:#222;">${texto}</h3>
      <div style="display:flex;gap:12px;justify-content:flex-end;">
        <button id="btnCerrarCarta" style="background:${color};border:none;color:#fff;padding:10px 18px;border-radius:10px;font-size:14px;cursor:pointer;box-shadow:0 4px 12px -2px ${color}99;">Continuar</button>
      </div>`;
    overlay.appendChild(card);

    if(!document.getElementById('cardPopStyles')){
      const st = document.createElement('style');
      st.id = 'cardPopStyles';
      st.textContent = `@keyframes cardPop { from {opacity:0; transform:translateY(18px) scale(.95);} to {opacity:1; transform:translateY(0) scale(1);} }`;
      document.head.appendChild(st);
    }

    return new Promise(res=>{
      const btn = card.querySelector('#btnCerrarCarta');
      btn?.addEventListener('click', ()=>{ overlay.remove(); res(); });
    });
  };

  Game.prototype.procesarAccionCarta = async function(player, accion){
    if(!accion || accion.tipo==='ninguna') return; // carta puramente informativa
    const totalSquares = this.board?.squaresByPosition?.length || 40;
    switch(accion.tipo){
      case 'mover': {
        const destino = (typeof accion.destino === 'number') ? accion.destino % totalSquares : player.position;
        const oldPos = player.position;
        let steps = destino - oldPos;
        if(steps < 0) steps += totalSquares; // avanzar hacia adelante hasta destino
        if(accion.cobrar) player.dinero += accion.cobrar;
        this.movePlayerToken(player, steps);
        break; }
      case 'moverRelativo': {
        let pasos = accion.pasos || 0;
        // Si es negativo, pasamos directamente esos pasos (movePlayerToken maneja wrap)
        this.movePlayerToken(player, pasos);
        break; }
      case 'pagar':
        player.dinero -= accion.cantidad || 0; break;
      case 'cobrar':
        player.dinero += accion.cantidad || 0; break;
      case 'carcel': {
        const jailIndex = this.board?.squaresByPosition?.findIndex(s=> s.type==='special' && /c[aá]rcel|jail/i.test(s.name || '')) ?? -1;
        if(typeof player.goToJail === 'function') player.goToJail();
        if(jailIndex >= 0){
          const oldPos = player.position;
            let steps = jailIndex - oldPos;
            if(steps < 0) steps += totalSquares;
            this.movePlayerToken(player, steps);
        }
        break; }
      default:
        console.warn('Acción de carta no reconocida', accion);
    }
    this.updatePlayerStatsPanel && this.updatePlayerStatsPanel();
  };
}

export default applyCards;
