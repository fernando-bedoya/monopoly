import Board from './Board.js';
import Square from './SquareBase.js'; // no lo usamos directo, pero queda listo
import BoardRenderer from '../utils/BoardRenderer.js';
import BoardUtils from '../utils/BoardUtils.js';
import GameRules from './GameRules.js';

class Game {
    constructor(containerId = '#boardContainer') {
        this.containerId = containerId;
        this.board = null;
        this.renderer = null;
        this.currentLanguage = 'es';
        
        // Propiedades para el juego
        this.players = [];
        this.currentPlayerIndex = 0;
        this.gameStarted = false;
        this.lastDiceRoll = null;
        this.testMode = false; // Para permitir valores manuales en dados
        this.playerStatsInitialized = false; // Control para panel de estadísticas
        this.eventListenersConfigured = false; // Control para evitar duplicación de event listeners
        this.actionInProgress = false; // Control para evitar múltiples acciones simultáneas
        this.rules = null; // Sistema de reglas
    }

    async initialize(totalSquares = 40) {
        try {
            // Crear el tablero
            this.board = new Board();

            // Generar datos de prueba con BoardUtils
            const testData = BoardUtils.generateTestBoardData(totalSquares, this.currentLanguage);

            // Validar
            const validation = BoardUtils.validateBoardData(testData);
            if (!validation.valid) {
                throw new Error(validation.error);
            }

            // Cargar datos en el tablero
            this.board.loadSquares(testData);
            this.board.organizeSquares();

            // Crear el renderer
            this.renderer = new BoardRenderer(this.containerId, this.board, {
                totalSquares: totalSquares,
                language: this.currentLanguage,
                boardSize: Math.min(800, window.innerWidth - 40),
                cornerSize: 100,
                sideSquareWidth: 70,
                sideSquareHeight: 100
            });

            console.log("🔄 Renderizando tablero con", totalSquares, "casillas...");

            await this.renderer.render();

            console.log("✅ Tablero renderizado correctamente");

            // Cargar jugadores desde localStorage
            this.loadPlayersFromStorage();

            // Inicializar y actualizar panel de estadísticas si existe en el DOM
            this.initPlayerStatsPanel();
            this.updatePlayerStatsPanel();
            
            // Inicializar sistema de reglas simple
            this.rules = new GameRules(this);
            
            // Reconfigurar botones (por si ahora no estaban disabled en el HTML)
            this.configurarEventosBotones();
            // Forzar una primera evaluación de disponibilidad
            this.actualizarEstadoBotones();

            // Ocultar botones de cartas (ya no se usan manualmente)
            ['btnCartaSorpresa','btnCajaComunidad'].forEach(id=>{ const el=document.getElementById(id); if(el) el.style.display='none'; });

        } catch (error) {
            console.error('❌ Error inicializando el juego:', error);
        }
    }

    // ================= SISTEMA DE NOTIFICACIONES (TOAST) =================
    /**
     * Muestra una notificación flotante elegante (auto cierra)
     * @param {Object} opts {title, message, type, timeout}
     * type: success | info | warning | error
     */
    showToast({ title = 'Mensaje', message = '', type = 'info', timeout = 4200 } = {}) {
        let container = document.getElementById('toastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toastContainer';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast-msg toast-${type}`;

        const iconMap = {
            success: '✅',
            info: 'ℹ️',
            warning: '⚠️',
            error: '❌'
        };

        const icon = iconMap[type] || 'ℹ️';
        toast.innerHTML = `
            <div class="toast-icon">${icon}</div>
            <div class="toast-content">
                <h4 class="toast-title">${title}</h4>
                ${message ? `<p class="toast-text">${message}</p>` : ''}
            </div>
            <button class="toast-close" aria-label="Cerrar">×</button>
        `;

        const closeBtn = toast.querySelector('.toast-close');
        const removeToast = () => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 350);
        };
        closeBtn.addEventListener('click', removeToast);

        container.appendChild(toast);

        if (timeout > 0) {
            setTimeout(removeToast, timeout);
        }
    }

    notifyInfo(title, msg) { this.showToast({ title, message: msg, type: 'info'}); }
    notifyOk(title, msg) { this.showToast({ title, message: msg, type: 'success'}); }
    notifyWarn(title, msg) { this.showToast({ title, message: msg, type: 'warning'}); }
    notifyError(title, msg) { this.showToast({ title, message: msg, type: 'error'}); }

    // ========== SISTEMA DE JUGADORES Y FICHAS ==========
    
    /**
     * Carga los jugadores desde localStorage (datos del modal de configuración)
     */
    loadPlayersFromStorage() {
        const jugadoresData = localStorage.getItem('jugadores');
        const numJugadores = localStorage.getItem('numJugadores');
        const ensureJailAPI = (p) => {
            if (typeof p.goToJail === 'function') return p; // ya tiene API
            p.turnosCarcel = p.turnosCarcel ?? p.turnosEnCarcel ?? 0;
            p.goToJail = function(){ this.estaEnCarcel = true; this.turnosCarcel = 0; };
            p.leaveJail = function(){ this.estaEnCarcel = false; this.turnosCarcel = 0; };
            p.incrementJailTurn = function(){ if (this.estaEnCarcel) this.turnosCarcel = (this.turnosCarcel||0)+1; return this.turnosCarcel; };
            p.tryLeaveJail = function({ pay=false, cost=50, dice=null, maxTurns=3 }={}) {
                if (!this.estaEnCarcel) return { freed:true, reason:null };
                if (pay && (this.dinero||0) >= cost){ this.dinero-=cost; this.leaveJail(); return { freed:true, reason:'pay'}; }
                if (dice?.isDouble){ this.leaveJail(); return { freed:true, reason:'double'}; }
                const t = this.incrementJailTurn();
                if (t>=maxTurns && (this.dinero||0) >= cost){ this.dinero-=cost; this.leaveJail(); return { freed:true, reason:'autoPay'}; }
                return { freed:false, reason:null };
            };
            return p;
        };
        
        if (jugadoresData && numJugadores) {
            try {
                const jugadores = JSON.parse(jugadoresData);
                console.log(`🔄 Cargando ${numJugadores} jugadores desde localStorage...`);
                
                // Limpiar jugadores existentes
                this.players = [];
                
                // Agregar cada jugador
                jugadores.forEach((jugadorData, index) => {
                    const player = {
                        id: index + 1,
                        nickname: jugadorData.nickname || `Jugador ${index + 1}`,
                        color: jugadorData.color || 'Rojo',
                        ficha: jugadorData.ficha || '🔴',
                        // Código de país (normalizado a mayúsculas) necesario para el backend y banderas
                        pais: (jugadorData.pais || jugadorData.country_code || 'XX').toUpperCase(),
                        country_code: (jugadorData.country_code || jugadorData.pais || 'XX').toLowerCase(),
                        position: 0, // posición unificada
                        dinero: 1500,
                        propiedades: [],
                        estaEnCarcel: false
                    };
                    
                    this.players.push(ensureJailAPI(player));
                });
                
                this.gameStarted = true;
                this.currentPlayerIndex = 0;
                
                console.log(`✅ ${this.players.length} jugadores cargados exitosamente`);
                
                // Esperar un poco para asegurar que el DOM esté completamente renderizado
                setTimeout(() => {
                    this.renderPlayerTokens();
                    try { this.sincronizarPropiedadesJugadorAlTablero(); } catch(e) { console.warn('Sin tablero aún para sincronizar owners'); }
                }, 500);
                
                // Limpiar localStorage después de cargar
                localStorage.removeItem('jugadores');
                localStorage.removeItem('numJugadores');
                
            } catch (error) {
                console.error('❌ Error cargando jugadores desde localStorage:', error);
                this.createTestPlayers(); // Crear jugadores de prueba como fallback
            }
        } else {
            console.log('ℹ️ No hay jugadores configurados en localStorage, creando jugadores de prueba...');
            this.createTestPlayers();
            try { this.sincronizarPropiedadesJugadorAlTablero(); } catch(e) {}
        }
    }

    /**
     * Método de debug para verificar las casillas disponibles
     */
    debugSquares() {
        const squares = document.querySelectorAll('[data-square-id]');
        console.log(`🔍 Se encontraron ${squares.length} casillas en el tablero:`);
        squares.forEach((square, index) => {
            const id = square.getAttribute('data-square-id');
            console.log(`  Casilla ${index}: ID=${id}, Elemento:`, square);
        });
        
        if (squares.length === 0) {
            console.log('⚠️ No se encontraron casillas. Probando selectores alternativos...');
            const altSquares = document.querySelectorAll('.square');
            console.log(`🔍 Casillas con clase 'square': ${altSquares.length}`);
        }
    }

    /**
     * Crea jugadores de prueba si no hay datos en localStorage
     */
    createTestPlayers() {
        const testPlayers = [
            { 
                nickname: 'Jugador1', 
                color: 'Rojo', 
                ficha: '🔴', 
                pais: 'CO' 
            },
            { 
                nickname: 'Jugador2', 
                color: 'Azul', 
                ficha: '🔵', 
                pais: 'US' 
            }
        ];
        
        this.players = [];
        testPlayers.forEach((playerData, index) => {
            const player = {
                id: index + 1,
                nickname: playerData.nickname,
                color: playerData.color,
                ficha: playerData.ficha,
                pais: playerData.pais,
                position: 0,
                dinero: 1500,
                propiedades: [],
                estaEnCarcel: false
            };
            this.players.push(ensureJailAPI(player));
        });
        
        this.gameStarted = true;
        this.currentPlayerIndex = 0;
        this.renderPlayerTokens();
        
        console.log('🧪 Jugadores de prueba creados:', this.players.map(p => p.nickname));
    }

    /**
     * Renderiza las fichas de los jugadores en el tablero
     */
    /**
     * Renderiza las fichas de los jugadores en el tablero
     */
    renderPlayerTokens() {
        console.log('🎯 Iniciando renderizado de fichas de jugadores...');
        
        // Debug de casillas disponibles
        this.debugSquares();
        
        if (!this.board || this.players.length === 0) {
            console.warn('⚠️ No hay board o jugadores para renderizar');
            return;
        }
        
        // Limpiar fichas existentes
        this.clearPlayerTokens();
        
        // Obtener la casilla de SALIDA (posición 0) - probando múltiples selectores
        console.log('🔍 Buscando casilla de SALIDA...');
        let startSquare = document.querySelector(`[data-square-id="0"]`);
        
        if (!startSquare) {
            console.warn('⚠️ No se encontró casilla con data-square-id="0", probando alternativas...');
            startSquare = document.querySelector(`#square-0`);
            if (!startSquare) {
                startSquare = document.querySelector('.square[data-id="0"]');
            }
            if (!startSquare) {
                startSquare = document.querySelector('.corner:first-child');
            }
            if (!startSquare) {
                startSquare = document.querySelector('.square:first-child');
            }
        }
        
        if (!startSquare) {
            console.error('❌ No se pudo encontrar la casilla de SALIDA con ningún selector');
            return;
        }
        
        console.log('✅ Casilla de SALIDA encontrada:', startSquare);
        this.renderTokensInSquare(startSquare);
        
        console.log(`🎯 ${this.players.length} fichas renderizadas en la casilla de SALIDA`);
    }

    /**
     * Renderiza las fichas en una casilla específica
     */
    renderTokensInSquare(squareElement) {
        // Crear contenedor de fichas si no existe
        let tokensContainer = squareElement.querySelector('.player-tokens');
        if (!tokensContainer) {
            tokensContainer = document.createElement('div');
            tokensContainer.className = 'player-tokens';
            squareElement.appendChild(tokensContainer);
        }
        
        // Limpiar fichas existentes en esta casilla
        tokensContainer.innerHTML = '';
        
        // Agregar cada ficha con estilos mejorados
        this.players.forEach((player, index) => {
            const tokenElement = document.createElement('div');
            tokenElement.className = `player-token player-${player.id}`;
            tokenElement.setAttribute('data-player-id', player.id);
            tokenElement.setAttribute('data-position', player.position || 0);
            
            // Marcar jugador activo
            if (this.currentPlayerIndex === index) {
                tokenElement.classList.add('active');
            }
            
            // Contenido de la ficha (emoji o inicial del nombre)
            tokenElement.innerHTML = player.ficha || player.nickname.charAt(0).toUpperCase();
            
            // Agregar tooltip con información del jugador
            tokenElement.title = `${player.nickname} - $${player.dinero || 1500} - ${player.color}`;
            
            // Evento click para mostrar información del jugador
            tokenElement.addEventListener('click', () => {
                this.showPlayerInfo(player);
            });
            
            tokensContainer.appendChild(tokenElement);
            
            // Animación escalonada de aparición
            setTimeout(() => {
                tokenElement.style.animationDelay = `${index * 0.1}s`;
            }, 50);
        });
    }

    /**
     * Muestra información detallada del jugador
     */
    showPlayerInfo(player) {
        const infoHTML = `
            <div class="player-info-popup">
                <h4>${player.ficha} ${player.nickname}</h4>
                <p><strong>País:</strong> ${player.pais}</p>
                <p><strong>Dinero:</strong> $${player.dinero || 1500}</p>
                <p><strong>Posición:</strong> Casilla ${player.position || 0}</p>
                <p><strong>Propiedades:</strong> ${player.propiedades?.length || 0}</p>
            </div>
        `;
        
        // Crear o actualizar tooltip temporal
        let tooltip = document.getElementById('player-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'player-tooltip';
            tooltip.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: linear-gradient(135deg, rgba(0,0,0,0.95), rgba(33,33,33,0.95));
                color: white;
                padding: 20px;
                border-radius: 12px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                z-index: 10000;
                border: 2px solid ${this.colorToCSS(player.color)};
                min-width: 250px;
                text-align: center;
            `;
            document.body.appendChild(tooltip);
        }
        
        tooltip.innerHTML = infoHTML;
        tooltip.style.borderColor = this.colorToCSS(player.color);
        
        // Auto-cerrar después de 3 segundos
        setTimeout(() => {
            if (tooltip && tooltip.parentNode) {
                tooltip.remove();
            }
        }, 3000);
        
        // Cerrar al hacer click
        tooltip.addEventListener('click', () => {
            tooltip.remove();
        });
    }

    /**
     * Limpia todas las fichas del tablero
     */
    clearPlayerTokens() {
        const existingTokens = document.querySelectorAll('.player-token');
        existingTokens.forEach(token => token.remove());
        
        const tokenContainers = document.querySelectorAll('.player-tokens');
        tokenContainers.forEach(container => {
            if (container.children.length === 0) {
                container.remove();
            }
        });
    }

    /**
     * Convierte nombres de colores a códigos hexadecimales
     */
    getColorHex(colorName) {
        const colorMap = {
            'Rojo': '#FF6B6B',
            'Azul': '#4ECDC4', 
            'Verde': '#45B7D1',
            'Amarillo': '#F9CA24',
            'Morado': '#A55EEA',
            'Naranja': '#FFA726',
            'Rosa': '#FF6B9D',
            'Gris': '#6C757D'
        };
        
        return colorMap[colorName] || '#6C757D';
    }

    /**
     * Alias para getColorHex - convierte nombres de colores a CSS
     */
    colorToCSS(colorName) {
        return this.getColorHex(colorName);
    }

    /**
     * Mueve una ficha de jugador a una nueva posición
     */
    movePlayerToken(playerOrId, steps) {
        // Manejar tanto objetos de jugador como IDs
        let player;
        if (typeof playerOrId === 'object') {
            player = playerOrId;
        } else {
            player = this.players.find(p => p.id === playerOrId);
        }
        
        if (!player) {
            console.error('❌ Jugador no encontrado');
            return;
        }
        
        // Calcular nueva posición
        const oldPosition = player.position || 0;
        const newPosition = (oldPosition + steps) % 40; // Tablero de 40 casillas
        
        console.log(`🚀 ${player.nickname} se mueve de casilla ${oldPosition} a ${newPosition} (${steps} pasos)`);
        
        // Actualizar posición del jugador
        player.position = newPosition;
        
        // Buscar ficha visual del jugador
        const tokenElement = document.querySelector(`[data-player-id="${player.id}"]`);
        if (!tokenElement) {
            console.error(`❌ No se encontró la ficha del jugador ${player.nickname}`);
            return;
        }
        
        // Agregar clase de animación
        tokenElement.classList.add('moving');
        
        // Obtener casilla de destino
        const targetSquare = document.querySelector(`[data-square-id="${newPosition}"]`);
        if (!targetSquare) {
            console.error(`❌ No se encontró la casilla ${newPosition}`);
            return;
        }
        
        // Crear o obtener contenedor de fichas en la casilla de destino
        let tokensContainer = targetSquare.querySelector('.player-tokens');
        if (!tokensContainer) {
            tokensContainer = document.createElement('div');
            tokensContainer.className = 'player-tokens';
            targetSquare.appendChild(tokensContainer);
        }
        
        // Mover la ficha después de un pequeño delay para la animación
        setTimeout(() => {
            tokensContainer.appendChild(tokenElement);
            tokenElement.setAttribute('data-position', newPosition);
            
            console.log(`✅ ${player.nickname} llegó a la casilla ${newPosition}`);
            
            // Remover clase de animación después de que termine
            setTimeout(() => {
                tokenElement.classList.remove('moving');
            }, 600);
        }, 100);
        
        // Verificar si pasó por SALIDA (cobraría $200)
        if (oldPosition > newPosition) {
            console.log(`💰 ${player.nickname} pasó por SALIDA! (+$200)`);
            player.dinero = (player.dinero || 1500) + 200;
        }
        
        // Ejecutar acciones de la casilla después del movimiento
        setTimeout(() => {
            this.ejecutarAccionCasilla(player, newPosition);
            // Actualizar estado de botones después del movimiento
            this.actualizarEstadoBotones();
        }, 1000); // Esperar a que termine la animación de movimiento
    }

    /**
     * Ejecuta la acción correspondiente según el tipo de casilla
     */
    async ejecutarAccionCasilla(player, position) {
        const square = this.board.squaresByPosition[position];
        if (!square) {
            console.error(`❌ No se encontró casilla en posición ${position}`);
            return;
        }

        console.log(`🎯 ${player.nickname} cayó en: ${square.name} (${square.type})`);

        // Detección flexible por nombre/acción para adelantarse
        const nombre = (square.name || '').toLowerCase();
        
        // Verificar casillas de cartas por tipo primero
        if (square.type === 'chance') {
            console.log('🃏 Detectada casilla de Suerte');
            await this.manejarSuerte(player);
            return;
        }
        
        if (square.type === 'community_chest') {
            console.log('📦 Detectada casilla de Caja de Comunidad');  
            await this.manejarCajaComunidad(player);
            return;
        }
        
        if (square.type === 'special') {
            if (square?.action?.goTo === 'jail' || /ve a .*c[áa]rcel/.test(nombre)) {
                await this.sendToJail(player); return; }
            if (/suerte/.test(nombre)) { await this.manejarSuerte(player); return; }
            if (/caja de comunidad|community|comunidad/.test(nombre)) { await this.manejarCajaComunidad(player); return; }
        }

        switch (square.type) {
            case 'property':
                await this.manejarPropiedad(player, square);
                break;
            case 'railroad':
                await this.manejarFerrocarril(player, square);
                break;
            case 'utility':
                await this.manejarServicio(player, square);
                break;
            case 'community_chest':
                await this.manejarCajaComunidad(player);
                break;
            case 'chance':
                await this.manejarSuerte(player);
                break;
            case 'tax':
                await this.manejarImpuesto(player, square);
                break;
            case 'jail':
                // Si el jugador está marcado como en cárcel (venido desde GO_TO_JAIL o carta), NO ofrecer pago inmediato el mismo turno
                if (player.estaEnCarcel) {
                    this.mostrarMensaje(player, '🚔 Cárcel', 'Estás en la cárcel. Podrás intentar salir en tu próximo turno.');
                } else {
                    this.mostrarMensaje(player, '🏰 Solo de visita', 'Estás de visita en la cárcel. No ocurre nada.');
                }
                break;
            case 'go_to_jail':
                await this.enviarACarcel(player);
                break;
            case 'free_parking':
                this.mostrarMensaje(player, '🅿️ Estacionamiento Gratuito', 'Descansa tranquilo, no pasa nada aquí.');
                break;
            case 'go':
                this.mostrarMensaje(player, '🏠 SALIDA', 'Has vuelto al inicio. ¡Recibe $200!');
                break;
            default:
                console.log(`ℹ️ ${player.nickname} en casilla especial: ${square.name}`);
                break;
        }
    }

    /**
     * Maneja las acciones cuando un jugador cae en una propiedad
     * REGLA: Pago automático de renta si no es del jugador
     */
    async manejarPropiedad(player, square) {
        const propietario = this.players.find(p => p.propiedades?.some(prop => prop.id === square.id));

        if (!propietario) {
            // REGLA: Solo se puede comprar si está disponible y tiene dinero
            await this.ofrecerCompraPropiedad(player, square);
        } else if (propietario.id === player.id || propietario.nickname === player.nickname) {
            // Propiedad propia - Mostrar mensaje apropiado según el tipo
            if (square.type === 'railroad') {
                this.mostrarMensaje(player, '🚂 Tu Ferrocarril', 
                    `${square.name} es tuyo. Los ferrocarriles generan más renta con más ferrocarriles.`);
            } else if (square.type === 'utility') {
                this.mostrarMensaje(player, '⚡ Tu Servicio', 
                    `${square.name} es tuyo. Los servicios generan más renta con más servicios.`);
            } else {
                this.mostrarMensaje(player, '🏠 Tu Propiedad', 
                    `${square.name} es tuya. Usa los botones para construir.`);
            }
        } else {
            // REGLA: Pago automático de renta
            await this.pagarRentaAutomatica(player, propietario, square);
        }
    }

    /**
     * Pago automático de renta - Se ejecuta sin intervención del jugador
     */
    async pagarRentaAutomatica(player, propietario, square) {
        const propiedad = propietario.propiedades.find(p => p.id === square.id);
        
        // REGLA: No se paga renta en propiedades hipotecadas
        if (propiedad.hipotecada) {
            this.mostrarMensaje(player, '🏦 Propiedad Hipotecada', 
                `${square.name} está hipotecada. No pagas renta.`);
            return;
        }

        const renta = this.calcularRenta(propiedad, square);
        
        // REGLA: Si no puede pagar, bancarrota
        if (player.dinero < renta) {
            this.mostrarMensaje(player, '💥 BANCARROTA', 
                `No puedes pagar $${renta} de renta. Has perdido el juego.`);
            this.gestionarBancarrota(player);
            return;
        }

        // Ejecutar pago automático
        player.dinero -= renta;
        propietario.dinero += renta;

        const detalleMejoras = propiedad.hotel ? ' (hotel)' : (propiedad.casas > 0 ? ` (${propiedad.casas} casas)` : '');
        this.mostrarMensaje(player, '💸 Renta Pagada Automáticamente', 
            `Pagaste $${renta} a ${propietario.nickname} por ${square.name}${detalleMejoras}. Saldo: $${player.dinero}`);
        
        this.actualizarEstadoBotones();
        this.updatePlayerStatsPanel();
    }

    /**
     * Ofrece la compra de una propiedad libre
     */
    async ofrecerCompraPropiedad(player, square) {
        const precio = square.price || 100;
        
        if (player.dinero < precio) {
            this.mostrarMensaje(player, '💸 Sin dinero suficiente', 
                `No puedes comprar ${square.name} (cuesta $${precio}). Tu dinero: $${player.dinero}`);
            return;
        }

        const comprar = await this.mostrarConfirmacion(
            `💰 Comprar Propiedad`,
            `¿Quieres comprar ${square.name} por $${precio}?`,
            player
        );

        if (comprar) {
            player.dinero -= precio;
            if (!player.propiedades) player.propiedades = [];
            player.propiedades.push({
                id: square.id,
                name: square.name,
                price: precio,
                color: square.color,
                casas: 0,
                hotel: false,
                hipotecada: false,
                rentData: square.rent || null,
                mortgage: square.mortgage || Math.floor(precio/2)
            });

            // Sincronizar dueño en la casilla real para cálculos de monopolio / ferrocarril
            try {
                square.owner = player.id || player.nickname;
            } catch(e){ console.warn('No se pudo asignar owner a la casilla', e); }

            this.mostrarMensaje(player, '🏠 Propiedad Comprada', 
                `¡Felicidades! Ahora eres dueño de ${square.name}. Dinero restante: $${player.dinero}`);
            
            // Actualizar visualmente la propiedad
            this.marcarPropiedadComoComprada(square.id, player);
            
            // Guardar estado del juego
            this.guardarEstadoJuego();
            // Actualizar estado de botones después de la compra
            this.actualizarEstadoBotones();
            // Refresco inmediato de estadísticas
            this.updatePlayerStatsPanel();
        }
    }

    /**
     * Maneja el pago de renta a otro jugador
     */
    async pagarRenta(player, propietario, square) {
        const propiedad = propietario.propiedades.find(p => p.id === square.id);
        
        if (propiedad.hipotecada) {
            this.mostrarMensaje(player, '🏦 Propiedad Hipotecada', 
                `${square.name} está hipotecada. No pagas renta.`);
            return;
        }

        let renta = this.calcularRenta(propiedad, square);
        
        if (player.dinero < renta) {
            this.mostrarMensaje(player, '💸 Bancarrota', 
                `No tienes dinero suficiente para pagar la renta de $${renta} a ${propietario.nickname}.`);
            // TODO: Manejar bancarrota
            return;
        }

        player.dinero -= renta;
        propietario.dinero += renta;

        const detalleMejoras = propiedad.hotel ? ' (hotel)' : (propiedad.casas>0 ? ` (${propiedad.casas} casas)` : '');
        this.mostrarMensaje(player, '💸 Renta Pagada', 
            `Pagaste $${renta} a ${propietario.nickname} por ${square.name}${detalleMejoras}. Saldo: $${player.dinero}`);
    // Actualizar botones tras pagar renta
    this.actualizarEstadoBotones();
    this.updatePlayerStatsPanel();
    }

    /**
     * Calcula la renta de una propiedad según casas/hoteles
     */
    calcularRenta(propiedad, square) {
        // Estructura de rent en boardData puede ser:
        // - Propiedades normales: { base, withHouse: [h1,h2,h3,h4], withHotel }
        // - Ferrocarril: { "1":25, "2":50, "3":100, "4":200 }
        // - Valor simple (fallback legacy)
        const rentData = square.rent;

        // Ferrocarriles
        if (square.type === 'railroad' && rentData && typeof rentData === 'object') {
            // Encontrar propietario real (el que contiene este id en sus propiedades)
            const owner = this.players.find(p => p.propiedades?.some(pr => pr.id === square.id));
            if (!owner) return 0;
            const ownedRailroads = owner.propiedades.filter(pr => {
                const sq = this.board.squares.get(pr.id);
                return sq && sq.type === 'railroad';
            }).length;
            return rentData[String(ownedRailroads)] || 25;
        }

        // Propiedades normales
        if (rentData && typeof rentData === 'object' && 'base' in rentData) {
            // Hotel
            if (propiedad.hotel) return rentData.withHotel || (rentData.base * 5);
            // Casas
            if (propiedad.casas > 0) {
                const idx = propiedad.casas - 1; // 1..4 -> 0..3
                const arr = rentData.withHouse || [];
                return arr[idx] || (rentData.base * (1 + propiedad.casas));
            }
            // Sin casas: verificar monopolio (doble renta)
            const monopolio = square.color && this.tieneMonopolioColor(propiedad, square.color, this.players.find(p=>p.propiedades?.some(pr=>pr.id===square.id)));
            return monopolio ? rentData.base * 2 : rentData.base;
        }

        // Fallback legacy
        const rentaBase = typeof rentData === 'number' ? rentData : (square.rent || 10);
        if (propiedad.hotel) return rentaBase * 5;
        if (propiedad.casas > 0) return rentaBase * (1 + propiedad.casas);
        return rentaBase;
    }

    /**
     * Maneja bancarrota: marca jugador y verifica fin del juego
     */
    gestionarBancarrota(player) {
        if (!player || player.enBancarrota) return;
        player.enBancarrota = true;
        this.notifyError('💥 Bancarrota', `${player.nickname} queda fuera del juego.`);
        const activos = this.players.filter(p => !p.enBancarrota);
        if (activos.length <= 1) {
            this.finalizarJuegoPorVictoria(activos[0]);
        } else {
            this.actualizarEstadoBotones();
        }
    }

    finalizarJuegoPorVictoria(ganador) {
        if (!ganador) return;
        this.notifySuccess('🏁 Fin del juego', `Ganador: ${ganador.nickname}`);
        this.gameStarted = false;
        this.deshabilitarTodosBotones();
    }

    /**
     * Ofrece construcción de casas/hoteles
     */
    async ofrecerConstruccion(player, square) {
        const propiedad = player.propiedades.find(p => p.id === square.id);
        
        // Verificar que la propiedad no esté hipotecada
        if (propiedad.hipotecada) {
            this.mostrarMensaje(player, '🏦 Propiedad Hipotecada', 
                `No puedes construir en ${square.name} mientras esté hipotecada. ` +
                `Deshipotécala primero pagando $${Math.floor((square.mortgage || Math.floor(square.price / 2)) * 1.1)}.`);
            return;
        }
        
        if (!this.puedeConstructor(player, square)) {
            this.mostrarMensaje(player, '🏗️ No puedes construir', 
                'Necesitas todas las propiedades del mismo color para construir.');
            return;
        }

        // Construcción equilibrada: diferencia max-min de casas <=1; no saltar propiedades
        if (square.color) {
            const { estado, min, max } = this.getEstadoGrupoConstruccion(square.color, player);
            const propEstado = estado.find(e => e.id === square.id);
            if (propiedad.hotel) {
                // Nada - será validado abajo
            } else if (propiedad.casas > min && max - min > 0 && propiedad.casas >= max) {
                this.mostrarMensaje(player, '⚖️ Construcción Desbalanceada', `Debes construir primero en las propiedades con menos casas de este color (mínimo actual: ${min}).`);
                return;
            }
        }

        if (propiedad.hotel) {
            this.mostrarMensaje(player, '🏨 Hotel Completo', 
                `${square.name} ya tiene un hotel. No puedes construir más.`);
            return;
        }

        const precioCasa = 100;
        const precioHotel = 250;
        let mensaje = '';
        let precio = 0;

        if (propiedad.casas < 4) {
            mensaje = `¿Construir casa en ${square.name}? (Casa ${propiedad.casas + 1}/4) - $${precioCasa}`;
            precio = precioCasa;
        } else {
            mensaje = `¿Construir hotel en ${square.name}? (Reemplaza 4 casas) - $${precioHotel}`;
            precio = precioHotel;
        }

        if (player.dinero < precio) {
            this.mostrarMensaje(player, '💸 Sin dinero suficiente', 
                `No tienes suficiente dinero para construir. Necesitas $${precio}`);
            return;
        }

        const construir = await this.mostrarConfirmacion('🏗️ Construcción', mensaje, player);

        if (construir) {
            player.dinero -= precio;
            
            if (propiedad.casas < 4) {
                propiedad.casas++;
                let mensajeCasa = `¡Casa construida en ${square.name}! Casas: ${propiedad.casas}/4. Dinero: $${player.dinero}`;
                
                // Mensaje especial cuando llega a 4 casas
                if (propiedad.casas === 4) {
                    mensajeCasa += `\n\n🏨 ¡Tienes 4 casas en ${square.name}! Ahora puedes construir un hotel que las reemplazará y generará más renta.`;
                }
                
                this.mostrarMensaje(player, '🏠 Casa Construida', mensajeCasa);
            } else {
                propiedad.casas = 0;
                propiedad.hotel = true;
                this.mostrarMensaje(player, '🏨 Hotel Construido', 
                    `¡Hotel construido en ${square.name}! Las 4 casas se han convertido en un hotel. Dinero: $${player.dinero}`);
            }

            // Actualizar visualmente
            this.actualizarVisualizacionPropiedad(square.id, propiedad);
            
            // Guardar estado del juego
            this.guardarEstadoJuego();
            // Refrescar botones tras construcción
            this.actualizarEstadoBotones();
            this.updatePlayerStatsPanel();
        }
    }

    /**
     * Verifica si el jugador puede construir (debe tener todas las propiedades del color)
     */
    puedeConstructor(player, square) {
        // Solo se puede construir en propiedades normales, NO en ferrocarriles o servicios
        if (square?.type !== 'property') {
            return false;
        }
        
        if (!square?.color) return false;
        // Usar squaresByPosition (array) porque squares es un Map
        const todas = this.board.squaresByPosition.filter(sq => sq && sq.type === 'property' && sq.color === square.color);
        if (!todas.length) return false;
        const idsColor = new Set(todas.map(sq=>sq.id));
        const jugadorTiene = player.propiedades.filter(p => idsColor.has(p.id));
        return jugadorTiene.length === idsColor.size;
    }

    /**
     * REGLA MONOPOLY: Verifica si un jugador tiene monopolio de un color
     */
    tieneMonopolioColor(propiedadActual, color, player) {
        if (!color || !this.board.propertiesByColor) return false;
        
        const propiedadesDelColor = this.board.propertiesByColor.get(color) || [];
        const propiedadesDelJugador = player.propiedades?.filter(p => p.color === color) || [];
        
        return propiedadesDelColor.length === propiedadesDelJugador.length;
    }

    /**
     * REGLA MONOPOLY: Obtiene estado de construcción de un grupo para validar equilibrio
     */
    getEstadoGrupoConstruccion(color, player) {
        const propiedadesDelJugador = player.propiedades?.filter(p => p.color === color) || [];
        
        const estado = propiedadesDelJugador.map(p => ({
            id: p.id,
            casas: p.casas || 0,
            hotel: p.hotel || false
        }));

        const casasPorPropiedad = estado.map(e => e.hotel ? 5 : e.casas);
        const min = Math.min(...casasPorPropiedad);
        const max = Math.max(...casasPorPropiedad);

        return { estado, min, max };
    }

    /**
     * REGLA MONOPOLY: Validación estricta para cualquier compra
     */
    validarCompraPropiedad(player, square) {
        // Debe ser una propiedad
        if (!['property', 'railroad', 'utility'].includes(square.type)) {
            return { valida: false, razon: 'No es una propiedad comprable' };
        }

        // Debe estar disponible
        const propietario = this.players.find(p => p.propiedades?.some(prop => prop.id === square.id));
        if (propietario) {
            return { valida: false, razon: `Ya pertenece a ${propietario.nickname}` };
        }

        // Debe tener dinero suficiente
        const precio = square.price || 100;
        if (player.dinero < precio) {
            return { valida: false, razon: `Dinero insuficiente. Necesitas $${precio}, tienes $${player.dinero}` };
        }

        // No puede estar en cárcel
        if (player.estaEnCarcel) {
            return { valida: false, razon: 'No puedes comprar mientras estés en la cárcel' };
        }

        return { valida: true, razon: null };
    }

    /**
     * REGLA MONOPOLY: Validación estricta para construcción
     */
    validarConstruccion(player, square, tipo = 'casa') {
        // Debe ser propietario
        const propiedad = player.propiedades?.find(p => p.id === square.id);
        if (!propiedad) {
            return { valida: false, razon: 'No eres propietario de esta propiedad' };
        }

        // No puede estar hipotecada
        if (propiedad.hipotecada) {
            return { valida: false, razon: 'No puedes construir en propiedades hipotecadas' };
        }

        // No puede estar en cárcel
        if (player.estaEnCarcel) {
            return { valida: false, razon: 'No puedes construir mientras estés en la cárcel' };
        }

        // Debe tener monopolio
        const tieneMonopolio = this.tieneMonopolioColor(propiedad, square.color, player);
        if (!tieneMonopolio) {
            return { valida: false, razon: 'Necesitas monopolio del color para construir' };
        }

        // Validaciones específicas por tipo
        if (tipo === 'casa') {
            const costo = 100;
            if (player.dinero < costo) {
                return { valida: false, razon: `Necesitas $${costo} para construir una casa` };
            }

            if (propiedad.hotel) {
                return { valida: false, razon: 'Ya hay un hotel en esta propiedad' };
            }

            if (propiedad.casas >= 4) {
                return { valida: false, razon: 'Máximo 4 casas por propiedad' };
            }

            // Validar construcción equilibrada
            const { min, max } = this.getEstadoGrupoConstruccion(square.color, player);
            if (propiedad.casas > min && (max - min) > 0) {
                return { valida: false, razon: 'Debes construir de manera equilibrada (niveladas)' };
            }

        } else if (tipo === 'hotel') {
            const costo = 250;
            if (player.dinero < costo) {
                return { valida: false, razon: `Necesitas $${costo} para construir un hotel` };
            }

            if (propiedad.hotel) {
                return { valida: false, razon: 'Ya hay un hotel en esta propiedad' };
            }

            if (propiedad.casas < 4) {
                return { valida: false, razon: 'Necesitas exactamente 4 casas para construir hotel' };
            }

            // Todas las propiedades del grupo deben tener 4 casas
            const { estado } = this.getEstadoGrupoConstruccion(square.color, player);
            const faltanCasas = estado.filter(e => e.id !== square.id && !e.hotel && e.casas < 4);
            if (faltanCasas.length > 0) {
                return { valida: false, razon: 'Todas las propiedades del grupo necesitan 4 casas antes del hotel' };
            }
        }

        return { valida: true, razon: null };
    }

    /**
     * REGLA MONOPOLY: Validación estricta para hipotecas
     */
    validarHipoteca(player, square, tipo = 'hipotecar') {
        const propiedad = player.propiedades?.find(p => p.id === square.id);
        if (!propiedad) {
            return { valida: false, razon: 'No eres propietario de esta propiedad' };
        }

        if (player.estaEnCarcel) {
            return { valida: false, razon: 'No puedes manejar hipotecas mientras estés en la cárcel' };
        }

        if (tipo === 'hipotecar') {
            if (propiedad.hipotecada) {
                return { valida: false, razon: 'La propiedad ya está hipotecada' };
            }

            if (propiedad.casas > 0 || propiedad.hotel) {
                return { valida: false, razon: 'Debes vender todas las construcciones antes de hipotecar' };
            }

        } else if (tipo === 'deshipotecar') {
            if (!propiedad.hipotecada) {
                return { valida: false, razon: 'La propiedad no está hipotecada' };
            }

            const valorHipoteca = square.mortgage || Math.floor((square.price || 100) / 2);
            const costo = Math.ceil(valorHipoteca * 1.1);
            
            if (player.dinero < costo) {
                return { valida: false, razon: `Necesitas $${costo} para deshipotecar (incluye 10% interés)` };
            }
        }

        return { valida: true, razon: null };
    }

    /**
     * REGLA MONOPOLY: Validación para salir de la cárcel
     */
    validarSalidaCarcel(player, metodo = 'pagar') {
        if (!player.estaEnCarcel) {
            return { valida: false, razon: 'No estás en la cárcel' };
        }

        if (metodo === 'pagar') {
            const costo = 50;
            if (player.dinero < costo) {
                return { valida: false, razon: `Necesitas $${costo} para salir de la cárcel` };
            }
        } else if (metodo === 'dobles') {
            const turnosEnCarcel = player.turnosEnCarcel || 0;
            if (turnosEnCarcel >= 3) {
                return { valida: false, razon: 'Has alcanzado el máximo de intentos, debes pagar' };
            }
        }

        return { valida: true, razon: null };
    }

    /**
     * REGLA MONOPOLY: Aplicar todas las validaciones antes de cualquier acción
     */
    aplicarReglasEstrictas() {
        console.log('🎯 APLICANDO REGLAS ESTRICTAS DE MONOPOLY');
        
        // Interceptar todas las acciones de botones para validar
        document.addEventListener('click', (e) => {
            const button = e.target.closest('button');
            if (!button || button.disabled) return;

            const currentPlayer = this.players[this.currentPlayerIndex];
            if (!currentPlayer) return;

            const square = this.board.squaresByPosition[currentPlayer.position || 0];
            if (!square) return;

            let validacion = { valida: true, razon: null };

            // Validar según el botón presionado
            switch(button.id) {
                case 'btnComprarPropiedad':
                    validacion = this.validarCompraPropiedad(currentPlayer, square);
                    break;
                case 'btnConstruirCasa':
                    validacion = this.validarConstruccion(currentPlayer, square, 'casa');
                    break;
                case 'btnConstruirHotel':
                    validacion = this.validarConstruccion(currentPlayer, square, 'hotel');
                    break;
                case 'btnHipotecar':
                    validacion = this.validarHipoteca(currentPlayer, square, 'hipotecar');
                    break;
                case 'btnDeshipotecar':
                    validacion = this.validarHipoteca(currentPlayer, square, 'deshipotecar');
                    break;
                case 'btnIrCarcel':
                    if (currentPlayer.estaEnCarcel) {
                        validacion = this.validarSalidaCarcel(currentPlayer, 'pagar');
                    }
                    break;
            }

            // Si no es válida, prevenir acción y mostrar razón
            if (!validacion.valida) {
                e.preventDefault();
                e.stopPropagation();
                console.log(`❌ REGLA VIOLADA: ${validacion.razon}`);
                this.mostrarMensaje(`❌ ${validacion.razon}`, 'error');
                return false;
            }
        }, true); // Captura en fase de captura para interceptar antes

        console.log('✅ Reglas estrictas aplicadas');
    }

    /**
     * REGLA MONOPOLY: Inicializar sistema de validación completo
     */
    inicializarSistemaReglas() {
        console.log('🎯 Inicializando Sistema de Reglas Monopoly');
        
        // Aplicar interceptor de eventos para validaciones
        this.aplicarReglasEstrictas();
        
        // Verificar integridad de datos del juego
        this.verificarIntegridadJuego();
        
        console.log('✅ Sistema de reglas activo');
    }

    /**
     * REGLA MONOPOLY: Verificar integridad de datos del juego
     */
    verificarIntegridadJuego() {
        // Verificar sincronización de propiedades
        this.players.forEach(player => {
            if (player.propiedades) {
                player.propiedades.forEach(prop => {
                    const square = this.board.squares.get(prop.id);
                    if (square && !square.owner) {
                        console.log(`🔧 Sincronizando owner de ${square.name} a ${player.nickname}`);
                        square.owner = player.id;
                    }
                });
            }
        });

        // Verificar posiciones de jugadores
        this.players.forEach(player => {
            if (typeof player.position !== 'number' || player.position < 0 || player.position >= 40) {
                console.log(`🔧 Corrigiendo posición inválida de ${player.nickname}`);
                player.position = 0;
            }
        });
    }

    /**
     * Obtiene estado de construcción del grupo de color para validar construcción equilibrada
     */
    getEstadoGrupoConstruccion(color, player) {
        const grupoSquares = this.board.propertiesByColor?.get(color) || [];
        const estado = grupoSquares.map(sq => {
            const prop = player.propiedades?.find(p => p.id === sq.id);
            return {
                id: sq.id,
                nombre: sq.name,
                casas: prop?.casas || 0,
                hotel: !!prop?.hotel,
                hipotecada: !!prop?.hipotecada
            };
        });
        const casasValores = estado.filter(e=>!e.hotel).map(e=>e.casas);
        const min = casasValores.length ? Math.min(...casasValores) : 0;
        const max = casasValores.length ? Math.max(...casasValores) : 0;
        const todas4 = estado.every(e => e.hotel || e.casas === 4);
        return { estado, min, max, todas4 };
    }

    /** Sincroniza owner en cada casilla según las propiedades guardadas en los jugadores (útil tras cargar storage) */
    sincronizarPropiedadesJugadorAlTablero() {
        if (!this.board?.squaresByPosition?.length) return;
        this.board.squaresByPosition.forEach(sq => { if (sq) delete sq.owner; });
        this.players.forEach(pl => {
            (pl.propiedades||[]).forEach(prop => {
                const sq = this.board.squaresByPosition.find(s=>s && s.id === prop.id);
                if (sq) sq.owner = pl.id || pl.nickname;
            });
        });
    }

    /**
     * Maneja cartas de Caja de Comunidad automáticamente usando las cartas del backend
     */
    async manejarCajaComunidad(player) {
        console.log('📦 Manejando carta de Caja de Comunidad para:', player.nickname);
        
        // Obtener cartas de caja de comunidad del board
        const cartasComunidad = this.board.communityCards || [];
        
        if (!cartasComunidad.length) {
            console.warn('⚠️ No hay cartas de Caja de Comunidad disponibles en el board');
            this.mostrarMensaje(player, '📦 Caja de Comunidad', 'No hay cartas disponibles.');
            return;
        }

        // Seleccionar carta aleatoria
        const cartaIndex = Math.floor(Math.random() * cartasComunidad.length);
        const carta = cartasComunidad[cartaIndex];
        
        console.log('🎯 Carta seleccionada:', carta);

        // Marcar que ya tomó carta en esta casilla
        player.communityDrawn = true;
        
        // Procesar la acción de la carta
        if (carta.action) {
            await this.procesarAccionCarta(player, carta, 'Caja de Comunidad');
        }

        // Mostrar mensaje de la carta con estilo bonito
        this.mostrarCartaBonita('📦 Caja de Comunidad', carta.description || 'Carta procesada', carta.action);
        
        // Actualizar UI
        this.actualizarEstadoBotones();
        this.updatePlayerStatsPanel();
    }

    /**
     * Maneja cartas de Suerte automáticamente usando las cartas del backend
     */
    async manejarSuerte(player) {
        console.log('🃏 === INICIANDO MANEJO DE CARTA DE SUERTE ===');
        console.log('🃏 Jugador:', player.nickname);
        console.log('🃏 Board existe:', !!this.board);
        console.log('🃏 chanceCards existe:', !!this.board?.chanceCards);
        console.log('🃏 Número de cartas:', this.board?.chanceCards?.length || 0);
        
        // Obtener cartas de suerte del board
        const cartasSuerte = this.board?.chanceCards || [];
        
        if (!cartasSuerte.length) {
            console.error('❌ No hay cartas de Suerte disponibles en el board');
            alert('❌ No hay cartas de Suerte disponibles');
            return;
        }

        // Seleccionar carta aleatoria
        const cartaIndex = Math.floor(Math.random() * cartasSuerte.length);
        const carta = cartasSuerte[cartaIndex];
        
        console.log('🎯 Carta seleccionada (índice ' + cartaIndex + '):', carta);

        // Marcar que ya tomó carta en esta casilla
        player.chanceDrawn = true;
        
        // Procesar la acción de la carta
        if (carta.action) {
            console.log('⚡ Procesando acción de carta:', carta.action);
            await this.procesarAccionCarta(player, carta, 'Suerte');
        } else {
            console.warn('⚠️ Carta sin acción:', carta);
        }

        // Mostrar mensaje de la carta con estilo bonito
        const mensaje = carta.description || 'Carta procesada';
        console.log('💬 Mostrando mensaje:', mensaje);
        this.mostrarCartaBonita('🃏 Carta de Suerte', mensaje, carta.action);
        
        // Actualizar UI
        this.actualizarEstadoBotones();
        this.updatePlayerStatsPanel();
        
        console.log('🃏 === MANEJO DE CARTA COMPLETADO ===');
    }

    /**
     * MÉTODO DE DEBUG - Forzar carta de suerte para pruebas
     * Ejecuta desde la consola: game.debugForzarCartaSuerte()
     */
    debugForzarCartaSuerte() {
        console.log('🧪 DEBUG: Forzando carta de suerte...');
        const currentPlayer = this.players[this.currentPlayerIndex];
        if (!currentPlayer) {
            console.error('❌ No hay jugador activo');
            return;
        }
        this.manejarSuerte(currentPlayer);
    }

    /**
     * MÉTODO DE DEBUG - Forzar carta de comunidad para pruebas
     * Ejecuta desde la consola: game.debugForzarCartaComunidad()
     */
    debugForzarCartaComunidad() {
        console.log('🧪 DEBUG: Forzando carta de comunidad...');
        const currentPlayer = this.players[this.currentPlayerIndex];
        if (!currentPlayer) {
            console.error('❌ No hay jugador activo');
            return;
        }
        this.manejarCajaComunidad(currentPlayer);
    }

    /**
     * Muestra una carta con un diseño bonito y animado
     */
    mostrarCartaBonita(titulo, descripcion, accion) {
        // Eliminar modal existente si hay uno
        const existingModal = document.getElementById('cartaModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Determinar colores según el tipo de carta
        const esSuerte = titulo.includes('Suerte');
        const colores = esSuerte 
            ? { bg: 'linear-gradient(135deg, #FF6B6B, #FF8E8E)', icon: '🃏', accent: '#FF4757' }
            : { bg: 'linear-gradient(135deg, #4ECDC4, #45B7AF)', icon: '📦', accent: '#00CEC9' };

        // Determinar el efecto del dinero
        let efectoDinero = '';
        if (accion && accion.money !== undefined) {
            const cantidad = accion.money;
            const esPositivo = cantidad > 0;
            efectoDinero = `
                <div class="dinero-efecto ${esPositivo ? 'positivo' : 'negativo'}">
                    ${esPositivo ? '💰 +' : '💸 -'}$${Math.abs(cantidad)}
                </div>
            `;
        }

        // Crear el modal
        const modal = document.createElement('div');
        modal.id = 'cartaModal';
        modal.innerHTML = `
            <div class="carta-overlay" onclick="this.parentElement.remove()">
                <div class="carta-modal" onclick="event.stopPropagation()">
                    <div class="carta-header" style="background: ${colores.bg}">
                        <span class="carta-icon">${colores.icon}</span>
                        <h2 class="carta-titulo">${titulo}</h2>
                        <button class="carta-cerrar" onclick="this.closest('#cartaModal').remove()">×</button>
                    </div>
                    <div class="carta-body">
                        <div class="carta-descripcion">
                            ${descripcion}
                        </div>
                        ${efectoDinero}
                        <div class="carta-decoracion">
                            <div class="carta-esquina carta-esquina-1"></div>
                            <div class="carta-esquina carta-esquina-2"></div>
                            <div class="carta-esquina carta-esquina-3"></div>
                            <div class="carta-esquina carta-esquina-4"></div>
                        </div>
                    </div>
                    <div class="carta-footer">
                        <button class="carta-btn-ok" onclick="this.closest('#cartaModal').remove()" 
                                style="background: ${colores.accent}">
                            ✨ ¡Entendido!
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Agregar estilos CSS
        const estilos = document.createElement('style');
        estilos.textContent = `
            .carta-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                backdrop-filter: blur(5px);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10000;
                animation: aparecer 0.3s ease-out;
            }

            .carta-modal {
                background: white;
                border-radius: 20px;
                overflow: hidden;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                max-width: 400px;
                width: 90%;
                animation: deslizar 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
                position: relative;
            }

            .carta-header {
                padding: 25px;
                text-align: center;
                color: white;
                position: relative;
                overflow: hidden;
            }

            .carta-header::before {
                content: '';
                position: absolute;
                top: -50%;
                left: -50%;
                width: 200%;
                height: 200%;
                background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="2" fill="rgba(255,255,255,0.1)"/></svg>');
                animation: rotar 20s linear infinite;
            }

            .carta-icon {
                font-size: 48px;
                display: block;
                margin-bottom: 10px;
                animation: rebote 2s ease-in-out infinite;
            }

            .carta-titulo {
                margin: 0;
                font-size: 24px;
                font-weight: bold;
                text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);
                position: relative;
                z-index: 1;
            }

            .carta-cerrar {
                position: absolute;
                top: 15px;
                right: 20px;
                background: rgba(255, 255, 255, 0.2);
                border: none;
                color: white;
                font-size: 24px;
                width: 35px;
                height: 35px;
                border-radius: 50%;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
            }

            .carta-cerrar:hover {
                background: rgba(255, 255, 255, 0.3);
                transform: scale(1.1);
            }

            .carta-body {
                padding: 30px;
                text-align: center;
                position: relative;
                background: linear-gradient(145deg, #f8f9fa, #e9ecef);
            }

            .carta-descripcion {
                font-size: 18px;
                color: #2c3e50;
                line-height: 1.6;
                margin-bottom: 20px;
                font-weight: 500;
            }

            .dinero-efecto {
                font-size: 28px;
                font-weight: bold;
                padding: 15px;
                border-radius: 15px;
                margin: 20px 0;
                animation: pulsar 1.5s ease-in-out infinite;
            }

            .dinero-efecto.positivo {
                background: linear-gradient(135deg, #2ecc71, #27ae60);
                color: white;
                box-shadow: 0 8px 25px rgba(46, 204, 113, 0.4);
            }

            .dinero-efecto.negativo {
                background: linear-gradient(135deg, #e74c3c, #c0392b);
                color: white;
                box-shadow: 0 8px 25px rgba(231, 76, 60, 0.4);
            }

            .carta-decoracion {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                pointer-events: none;
            }

            .carta-esquina {
                position: absolute;
                width: 20px;
                height: 20px;
                border: 3px solid rgba(52, 152, 219, 0.2);
            }

            .carta-esquina-1 { top: 15px; left: 15px; border-right: none; border-bottom: none; }
            .carta-esquina-2 { top: 15px; right: 15px; border-left: none; border-bottom: none; }
            .carta-esquina-3 { bottom: 15px; left: 15px; border-right: none; border-top: none; }
            .carta-esquina-4 { bottom: 15px; right: 15px; border-left: none; border-top: none; }

            .carta-footer {
                padding: 25px;
                text-align: center;
            }

            .carta-btn-ok {
                background: #3498db;
                color: white;
                border: none;
                padding: 12px 30px;
                font-size: 16px;
                font-weight: bold;
                border-radius: 25px;
                cursor: pointer;
                transition: all 0.3s;
                box-shadow: 0 5px 15px rgba(52, 152, 219, 0.3);
            }

            .carta-btn-ok:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 25px rgba(52, 152, 219, 0.4);
            }

            .carta-btn-ok:active {
                transform: translateY(0);
            }

            @keyframes aparecer {
                from { opacity: 0; }
                to { opacity: 1; }
            }

            @keyframes deslizar {
                from {
                    transform: translateY(-50px) scale(0.9);
                    opacity: 0;
                }
                to {
                    transform: translateY(0) scale(1);
                    opacity: 1;
                }
            }

            @keyframes rebote {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-10px); }
            }

            @keyframes pulsar {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.05); }
            }

            @keyframes rotar {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
        `;

        // Agregar modal y estilos al documento
        document.head.appendChild(estilos);
        document.body.appendChild(modal);

        // Auto-cerrar después de 8 segundos
        setTimeout(() => {
            if (document.getElementById('cartaModal')) {
                modal.remove();
            }
        }, 8000);

        // Enfocar el botón para accesibilidad
        setTimeout(() => {
            const btnOk = modal.querySelector('.carta-btn-ok');
            if (btnOk) btnOk.focus();
        }, 100);
    }

    /**
     * Procesa las acciones de las cartas (dinero, movimiento, etc.)
     */
    async procesarAccionCarta(player, carta, tipoCarta) {
        console.log(`🎯 Procesando acción de carta ${tipoCarta}:`, carta.action);
        
        if (!carta.action) return;

        // Procesar dinero (positivo o negativo)
        if (carta.action.money !== undefined) {
            const cantidad = carta.action.money;
            player.dinero += cantidad;
            
            console.log(`💰 ${player.nickname} ${cantidad >= 0 ? 'recibe' : 'paga'} $${Math.abs(cantidad)}`);
            console.log(`💳 Dinero actual: $${player.dinero}`);
        }

        // Procesar movimiento (si implementamos cartas de movimiento en el futuro)
        if (carta.action.goTo !== undefined) {
            const destino = carta.action.goTo;
            if (destino === 'jail') {
                console.log('🏛️ Enviando a la cárcel por carta');
                await this.enviarACarcel(player);
                return; // Salir porque enviarACarcel ya actualiza todo
            }
            // Aquí se pueden agregar más destinos en el futuro
        }

        // Procesar otras acciones futuras aquí
        // if (carta.action.advanceTo) { ... }
        // if (carta.action.payEachPlayer) { ... }
    }

    /**
     * Maneja casillas de impuestos
     */
    async manejarImpuesto(player, square) {
        const impuesto = square.tax || 100;
        
        if (player.dinero < impuesto) {
            this.mostrarMensaje(player, '💸 Sin dinero suficiente', 
                `No puedes pagar el impuesto de $${impuesto}. Tu dinero: $${player.dinero}`);
            // TODO: Manejar bancarrota
            return;
        }

        player.dinero -= impuesto;
        this.mostrarMensaje(player, '💸 Impuesto Pagado', 
            `Pagaste $${impuesto} de impuestos. Tu dinero: $${player.dinero}`);
    this.actualizarEstadoBotones();
    this.updatePlayerStatsPanel();
    }

    /**
     * Envía un jugador a la cárcel
     */
    async enviarACarcel(player) { // compat backward para llamadas existentes
        return this.sendToJail(player);
    }

    async sendToJail(player) {
        if (typeof player.goToJail === 'function') player.goToJail(); else { player.estaEnCarcel = true; player.turnosCarcel = 0; }

        // localizar índice cárcel dinámicamente (id 10 o nombre con cárcel)
        const jailIndex = 10;
    const oldPos = player.position ?? 0;
    player.position = jailIndex;

        const tokenElement = document.querySelector(`[data-player-id="${player.id}"]`);
        const jailSquare = document.querySelector('[data-square-id="10"]');
        if (tokenElement && jailSquare) {
            const tokensContainer = jailSquare.querySelector('.player-tokens') || jailSquare;
            tokensContainer.appendChild(tokenElement);
            tokenElement.setAttribute('data-position', '10');
        }
        this.mostrarMensaje(player, '🚔 ¡A la Cárcel!', 'Has sido enviado a la cárcel.');
        this.actualizarEstadoBotones();
        this.updatePlayerStatsPanel();
    }

    /** Manejo de intento de salida al inicio del turno */
    handleJailTurnStart(player, diceInfo = null) {
        if (!player.estaEnCarcel) return { freed:false };
        if (typeof player.tryLeaveJail === 'function') {
            const res = player.tryLeaveJail({ dice: diceInfo, cost:50, maxTurns:3 });
            if (res.freed) {
                this.mostrarMensaje(player, 'Cárcel', {
                    pay: 'Pagas $50 y sales.',
                    double: 'Sacaste dobles y sales.',
                    autoPay: 'Cumpliste 3 turnos: pagas $50 y sales.',
                    null: 'Sales de la cárcel.'
                }[res.reason ?? 'null']);
                this.actualizarEstadoBotones();
                this.updatePlayerStatsPanel();
                return { freed:true, reason:res.reason };
            }
            // No salió
            this.mostrarMensaje(player, 'Cárcel', 'Permanece en la cárcel.');
            this.actualizarEstadoBotones();
            this.updatePlayerStatsPanel();
            return { freed:false };
        }
        // fallback simple
        player.turnosCarcel = (player.turnosCarcel||0)+1;
        if (diceInfo?.isDouble) {
            player.estaEnCarcel = false; player.turnosCarcel = 0;
            this.mostrarMensaje(player, 'Cárcel', 'Dobles: sales de la cárcel.');
            return { freed:true, reason:'double' };
        }
        if (player.turnosCarcel >=3 && player.dinero >=50){
            player.dinero -=50; player.estaEnCarcel=false; player.turnosCarcel=0;
            this.mostrarMensaje(player, 'Cárcel', 'Pagas $50 y sales.');
            return { freed:true, reason:'autoPay' };
        }
        this.mostrarMensaje(player,'Cárcel',`Sigues en la cárcel (turno ${player.turnosCarcel}/3)`);
        return { freed:false };
    }

    /**
     * Métodos de utilidad para la interfaz de usuario
     */
    
    /**
     * Muestra un mensaje modal al jugador
     */
    mostrarMensaje(player, titulo, mensaje) {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.7);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        
        modal.innerHTML = `
            <div style="
                background: white;
                border-radius: 15px;
                padding: 30px;
                max-width: 400px;
                text-align: center;
                box-shadow: 0 15px 35px rgba(0,0,0,0.3);
                border: 3px solid ${this.colorToCSS(player.color)};
            ">
                <div style="
                    font-size: 24px;
                    color: ${this.colorToCSS(player.color)};
                    margin-bottom: 15px;
                    font-weight: bold;
                ">
                    ${player.ficha} ${titulo}
                </div>
                <div style="
                    font-size: 16px;
                    color: #333;
                    margin-bottom: 20px;
                    line-height: 1.4;
                ">
                    ${mensaje}
                </div>
                <button onclick="this.parentElement.parentElement.remove()" style="
                    background: linear-gradient(135deg, ${this.colorToCSS(player.color)}, ${this.colorToCSS(player.color)}dd);
                    color: white;
                    border: none;
                    padding: 12px 25px;
                    border-radius: 8px;
                    font-size: 16px;
                    font-weight: bold;
                    cursor: pointer;
                ">
                    OK
                </button>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Auto-cerrar después de 8 segundos
        setTimeout(() => {
            if (modal.parentNode) {
                modal.remove();
            }
        }, 8000);
    }

    /**
     * Muestra un diálogo de confirmación
     */
    mostrarConfirmacion(titulo, mensaje, player) {
        // Evitar múltiples modales simultáneos
        const existingModal = document.querySelector('[data-modal-confirmacion]');
        if (existingModal) {
            console.log('⚠️ Modal de confirmación ya existe, omitiendo duplicado');
            return Promise.resolve(false);
        }
        
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.setAttribute('data-modal-confirmacion', 'true');
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.7);
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
            `;
            
            modal.innerHTML = `
                <div style="
                    background: white;
                    border-radius: 15px;
                    padding: 30px;
                    max-width: 400px;
                    text-align: center;
                    box-shadow: 0 15px 35px rgba(0,0,0,0.3);
                    border: 3px solid ${this.colorToCSS(player.color)};
                ">
                    <div style="
                        font-size: 24px;
                        color: ${this.colorToCSS(player.color)};
                        margin-bottom: 15px;
                        font-weight: bold;
                    ">
                        ${player.ficha} ${titulo}
                    </div>
                    <div style="
                        font-size: 16px;
                        color: #333;
                        margin-bottom: 25px;
                        line-height: 1.4;
                    ">
                        ${mensaje}
                    </div>
                    <div style="display: flex; gap: 15px; justify-content: center;">
                        <button id="btnSi" style="
                            background: linear-gradient(135deg, #28a745, #1e7e34);
                            color: white;
                            border: none;
                            padding: 12px 25px;
                            border-radius: 8px;
                            font-size: 16px;
                            font-weight: bold;
                            cursor: pointer;
                        ">
                            Sí
                        </button>
                        <button id="btnNo" style="
                            background: linear-gradient(135deg, #dc3545, #c82333);
                            color: white;
                            border: none;
                            padding: 12px 25px;
                            border-radius: 8px;
                            font-size: 16px;
                            font-weight: bold;
                            cursor: pointer;
                        ">
                            No
                        </button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            modal.querySelector('#btnSi').addEventListener('click', () => {
                modal.remove();
                resolve(true);
            });
            
            modal.querySelector('#btnNo').addEventListener('click', () => {
                modal.remove();
                resolve(false);
            });
            
            // Auto-cerrar como "No" después de 15 segundos
            setTimeout(() => {
                if (modal.parentNode) {
                    modal.remove();
                    resolve(false);
                }
            }, 15000);
        });
    }

    /**
     * Marca una propiedad como comprada visualmente
     */
    marcarPropiedadComoComprada(squareId, player) {
        const squareElement = document.querySelector(`[data-square-id="${squareId}"]`);
        if (squareElement) {
            // Agregar indicador visual de propiedad
            let indicator = squareElement.querySelector('.property-indicator');
            if (!indicator) {
                indicator = document.createElement('div');
                indicator.className = 'property-indicator';
                indicator.style.cssText = `
                    position: absolute;
                    top: 2px;
                    right: 2px;
                    width: 12px;
                    height: 12px;
                    border-radius: 50%;
                    background: ${this.colorToCSS(player.color)};
                    border: 1px solid white;
                    z-index: 5;
                `;
                squareElement.appendChild(indicator);
            }
        }
    }

    /**
     * Actualiza la visualización de una propiedad con casas/hoteles
     */
    actualizarVisualizacionPropiedad(squareId, propiedad) {
        const squareElement = document.querySelector(`[data-square-id="${squareId}"]`);
        if (!squareElement) return;
        
        // Remover indicadores existentes
        const existingBuildings = squareElement.querySelectorAll('.building-indicator');
        existingBuildings.forEach(building => building.remove());
        
        // Agregar indicadores de casas/hotel
        if (propiedad.hotel) {
            const hotel = document.createElement('div');
            hotel.className = 'building-indicator';
            hotel.style.cssText = `
                position: absolute;
                top: 15px;
                left: 50%;
                transform: translateX(-50%);
                font-size: 16px;
                z-index: 6;
            `;
            hotel.textContent = '🏨';
            squareElement.appendChild(hotel);
        } else if (propiedad.casas > 0) {
            for (let i = 0; i < propiedad.casas; i++) {
                const casa = document.createElement('div');
                casa.className = 'building-indicator';
                casa.style.cssText = `
                    position: absolute;
                    top: 15px;
                    left: ${20 + (i * 15)}px;
                    font-size: 10px;
                    z-index: 6;
                `;
                casa.textContent = '🏠';
                squareElement.appendChild(casa);
            }
        }
    }

    /**
     * Maneja ferrocarriles (similar a propiedades)
     */
    async manejarFerrocarril(player, square) {
        // Los ferrocarriles se tratan como propiedades especiales
        await this.manejarPropiedad(player, square);
    }

    /**
     * Maneja servicios públicos (similar a propiedades)
     */
    async manejarServicio(player, square) {
        // Los servicios se tratan como propiedades especiales
        await this.manejarPropiedad(player, square);
    }

    /**
     * Configura todos los eventos de botones del menú lateral
     */
    configurarEventosBotones() {
        // Evitar duplicación de event listeners
        if (this.eventListenersConfigured) {
            console.log('⚠️ Event listeners ya configurados, omitiendo duplicación...');
            return;
        }

        console.log('🔧 Configurando eventos de botones del menú lateral...');
        console.log(`   • Jugadores cargados: ${this.players.length}`);
        console.log(`   • Juego iniciado: ${this.gameStarted}`);

        // Botón principal de dados
        const btnLanzarDados = document.getElementById('btnLanzarDados');
        if (btnLanzarDados) {
            btnLanzarDados.addEventListener('click', () => {
                console.log(`🎲 Click en dados. Jugadores: ${this.players.length}, Iniciado: ${this.gameStarted}`);
                if (this.players.length > 0) {
                    this.gameStarted = true; // Asegurar que esté iniciado
                    this.showDiceBox();
                } else {
                    this.notifyWarn('Configura jugadores', 'Primero debes crear jugadores en el menú principal (index.html).');
                }
            });
            console.log('✅ Event listener agregado a btnLanzarDados');
        } else {
            console.error('❌ No se encontró btnLanzarDados');
        }

        // Botón Comprar Propiedad
        const btnComprarPropiedad = document.getElementById('btnComprarPropiedad');
        if (btnComprarPropiedad) {
            btnComprarPropiedad.addEventListener('click', () => {
                console.log('🏠 Click en Comprar Propiedad');
                this.ejecutarAccionComprar();
            });
            console.log('✅ Event listener agregado a btnComprarPropiedad');
        } else {
            console.error('❌ No se encontró btnComprarPropiedad');
        }

        // Botón Pagar Renta
        const btnPagarRenta = document.getElementById('btnPagarRenta');
        if (btnPagarRenta) {
            btnPagarRenta.addEventListener('click', () => {
                console.log('💰 Click en Pagar Renta');
                this.ejecutarAccionRenta();
            });
            console.log('✅ Event listener agregado a btnPagarRenta');
        } else {
            console.error('❌ No se encontró btnPagarRenta');
        }

        // Botón Construir Casa
        const btnConstruirCasa = document.getElementById('btnConstruirCasa');
        if (btnConstruirCasa) {
            btnConstruirCasa.addEventListener('click', () => {
                console.log('🏘️ Click en Construir Casa');
                this.ejecutarAccionConstruirCasa();
            });
            console.log('✅ Event listener agregado a btnConstruirCasa');
        } else {
            console.error('❌ No se encontró btnConstruirCasa');
        }

        // Botón Construir Hotel
        const btnConstruirHotel = document.getElementById('btnConstruirHotel');
        if (btnConstruirHotel) {
            btnConstruirHotel.addEventListener('click', () => {
                console.log('🏨 Click en Construir Hotel');
                this.ejecutarAccionConstruirHotel();
            });
            console.log('✅ Event listener agregado a btnConstruirHotel');
        } else {
            console.error('❌ No se encontró btnConstruirHotel');
        }

        // Botón Hipotecar
        const btnHipotecar = document.getElementById('btnHipotecar');
        if (btnHipotecar) {
            btnHipotecar.addEventListener('click', () => {
                console.log('🏦 Click en Hipotecar');
                this.ejecutarAccionHipotecar();
            });
            console.log('✅ Event listener agregado a btnHipotecar');
        } else {
            console.error('❌ No se encontró btnHipotecar');
        }

        // Botón Deshipotecar
        const btnDeshipotecar = document.getElementById('btnDeshipotecar');
        if (btnDeshipotecar) {
            btnDeshipotecar.addEventListener('click', () => {
                console.log('🔓 Click en Deshipotecar');
                this.ejecutarAccionDeshipotecar();
            });
            console.log('✅ Event listener agregado a btnDeshipotecar');
        } else {
            console.error('❌ No se encontró btnDeshipotecar');
        }

        // Botón Carta Sorpresa
        const btnCartaSorpresa = document.getElementById('btnCartaSorpresa');
        if (btnCartaSorpresa) {
            btnCartaSorpresa.addEventListener('click', () => {
                console.log('🎯 Click en Carta Sorpresa');
                const currentPlayer = this.players[this.currentPlayerIndex];
                if (!this.gameStarted || !currentPlayer) return;
                const square = this.board.squares[currentPlayer.position];
                if (!square || square.type !== 'chance') {
                    this.notifyWarn('No estás en Suerte', 'Solo puedes tomar carta aquí cuando caes en una casilla Suerte.');
                    return;
                }
                if (currentPlayer) {
                    if (currentPlayer.chanceDrawn) {
                        this.notifyWarn('Carta ya tomada', 'Ya tomaste una carta de Suerte en este aterrizaje.');
                        return;
                    }
                    this.manejarSuerte(currentPlayer);
                }
            });
            console.log('✅ Event listener agregado a btnCartaSorpresa');
        } else {
            console.error('❌ No se encontró btnCartaSorpresa');
        }

        // Botón Caja de Comunidad
        const btnCajaComunidad = document.getElementById('btnCajaComunidad');
        if (btnCajaComunidad) {
            btnCajaComunidad.addEventListener('click', () => {
                console.log('📦 Click en Caja de Comunidad');
                const currentPlayer = this.players[this.currentPlayerIndex];
                if (!this.gameStarted || !currentPlayer) return;
                const square = this.board.squares[currentPlayer.position];
                if (!square || square.type !== 'community_chest') {
                    this.notifyWarn('No estás en Comunidad', 'Solo puedes tomar carta aquí cuando caes en una casilla de Comunidad.');
                    return;
                }
                if (currentPlayer) {
                    if (currentPlayer.communityDrawn) {
                        this.notifyWarn('Carta ya tomada', 'Ya tomaste una carta de Comunidad en este aterrizaje.');
                        return;
                    }
                    this.manejarCajaComunidad(currentPlayer);
                }
            });
            console.log('✅ Event listener agregado a btnCajaComunidad');
        } else {
            console.error('❌ No se encontró btnCajaComunidad');
        }

        // Botón Pagar Impuesto
        const btnPagarImpuesto = document.getElementById('btnPagarImpuesto');
        if (btnPagarImpuesto) {
            btnPagarImpuesto.addEventListener('click', () => {
                console.log('💸 Click en Pagar Impuesto');
                this.ejecutarAccionImpuesto();
            });
            console.log('✅ Event listener agregado a btnPagarImpuesto');
        } else {
            console.error('❌ No se encontró btnPagarImpuesto');
        }

        // Botón Ir a Cárcel / Salir de Cárcel
        const btnIrCarcel = document.getElementById('btnIrCarcel');
        if (btnIrCarcel) {
            btnIrCarcel.addEventListener('click', () => {
                console.log('🚔 Click en Ir Cárcel / Salir');
                this.ejecutarAccionCarcel();
            });
            console.log('✅ Event listener agregado a btnIrCarcel');
        } else {
            console.error('❌ No se encontró btnIrCarcel');
        }

        // Botón Finalizar Juego
        const btnFinalizarJuego = document.getElementById('btnFinalizarJuego');
        if (btnFinalizarJuego) {
            btnFinalizarJuego.addEventListener('click', () => {
                console.log('🏁 Click en Finalizar Juego');
                this.finalizarJuego();
            });
            console.log('✅ Event listener agregado a btnFinalizarJuego');
        } else {
            console.error('❌ No se encontró btnFinalizarJuego');
        }

        // Botón Ver Ranking
        const btnRankingSidebar = document.getElementById('btnRankingSidebar');
        if (btnRankingSidebar) {
            btnRankingSidebar.addEventListener('click', () => {
                console.log('📊 Click en Ver Ranking');
                window.location.href = 'ranking.html';
            });
            console.log('✅ Event listener agregado a btnRankingSidebar');
        } else {
            console.error('❌ No se encontró btnRankingSidebar');
        }

        console.log('✅ Eventos de botones configurados correctamente');
        console.log(`🎮 Estado final - Jugadores: ${this.players.length}, Iniciado: ${this.gameStarted}`);
        
        // Marcar que los event listeners ya han sido configurados
        this.eventListenersConfigured = true;
        
        // Actualizar estado inicial de los botones
        this.actualizarEstadoBotones();
        this.agregarTooltipsAcciones();
    }

    agregarTooltipsAcciones() {
        const container = document.getElementById('acciones-casilla');
        if (!container) return;
        container.querySelectorAll('button').forEach(btn => {
            if (!btn.dataset.tooltipBound) {
                btn.addEventListener('mouseenter', () => {
                    if (btn.disabled) {
                        const reason = btn.dataset.disableReason || 'Acción no disponible ahora';
                        btn.setAttribute('title', reason);
                    } else btn.removeAttribute('title');
                });
                btn.dataset.tooltipBound = '1';
            }
        });
    }

    /**
     * Actualiza el estado de TODOS los botones con REGLAS ESTRICTAS
     */
    actualizarEstadoBotones() {
        console.log('🔄 Actualizando botones con reglas estrictas');
        
        if (!this.players.length || !this.gameStarted) {
            this.deshabilitarTodosBotones();
            return;
        }

        const currentPlayer = this.players[this.currentPlayerIndex];
        if (!currentPlayer) return;

        const position = currentPlayer.position || 0;
        const square = this.board.squaresByPosition[position];
        if (!square) return;

        // Resetear todos los botones
        this.deshabilitarTodosBotones();

        // REGLA: Dados siempre disponibles (incluso en cárcel para intentar salir)
        const btnLanzarDados = document.getElementById('btnLanzarDados');
        if (btnLanzarDados) {
            btnLanzarDados.disabled = false;
        }

        // REGLA CÁRCEL: Si está en cárcel, SOLO puede usar dados o pagar salida
        if (currentPlayer.estaEnCarcel) {
            const btnIrCarcel = document.getElementById('btnIrCarcel');
            if (btnIrCarcel) {
                btnIrCarcel.disabled = currentPlayer.dinero < 50;
                btnIrCarcel.textContent = '🔓 Pagar Salida ($50)';
                if (btnIrCarcel.disabled) {
                    btnIrCarcel.dataset.disableReason = 'Necesitas $50 para salir de la cárcel.';
                } else {
                    delete btnIrCarcel.dataset.disableReason;
                }
            }
            
            // Deshabilitar TODOS los demás botones en cárcel
            this.aplicarRazonGeneral('En cárcel: solo puedes lanzar dados o pagar salida.');
            return;
        }

        // REGLAS NORMALES (fuera de cárcel)
        this.configurarBotonComprar(currentPlayer, square);
        this.configurarBotonesConstruccion(currentPlayer, square);
        this.configurarBotonesHipoteca(currentPlayer, square);
        this.configurarBotonesEspeciales(currentPlayer, square);
        
        // Botón cárcel deshabilitado si no está en cárcel
        const btnIrCarcel = document.getElementById('btnIrCarcel');
        if (btnIrCarcel) {
            btnIrCarcel.disabled = true;
            btnIrCarcel.textContent = 'Pagar Salida de la Cárcel';
            btnIrCarcel.dataset.disableReason = 'Solo disponible cuando estás en la cárcel.';
        }

        this.updatePlayerStatsPanel();
        this.agregarTooltipsAcciones();
    }

    /**
     * REGLA: Configurar botón de compra con validaciones estrictas
     */
    configurarBotonComprar(player, square) {
        const btnComprar = document.getElementById('btnComprarPropiedad');
        if (!btnComprar) return;

        const esPropiedad = ['property', 'railroad', 'utility'].includes(square.type);
        const propietario = this.players.find(p => p.propiedades?.some(prop => prop.id === square.id));
        const precio = square.price || 100;

        // REGLA: Solo se puede comprar si es propiedad libre y tienes dinero
        const puedeComprar = esPropiedad && !propietario && player.dinero >= precio;
        
        btnComprar.disabled = !puedeComprar;
        
        if (!puedeComprar) {
            if (!esPropiedad) {
                btnComprar.dataset.disableReason = 'Esta casilla no es una propiedad comprable.';
            } else if (propietario) {
                btnComprar.dataset.disableReason = `Ya tiene dueño: ${propietario.nickname}.`;
            } else if (player.dinero < precio) {
                btnComprar.dataset.disableReason = `Necesitas $${precio}. Tienes $${player.dinero}.`;
            }
        } else {
            delete btnComprar.dataset.disableReason;
        }
    }

    /**
     * REGLA: Configurar botones de construcción con todas las validaciones
     */
    configurarBotonesConstruccion(player, square) {
        const btnCasa = document.getElementById('btnConstruirCasa');
        const btnHotel = document.getElementById('btnConstruirHotel');
        
        if (!btnCasa || !btnHotel) return;

        const propiedad = player.propiedades?.find(p => p.id === square.id);
        // Usar puedeConstructor que ya tiene toda la lógica de validación
        const tieneMonopolio = this.puedeConstructor(player, square);
        
        // REGLA: Solo se puede construir con monopolio, sin hipotecar, con dinero
        let puedeConstructCasa = propiedad && tieneMonopolio && !propiedad.hipotecada && 
                                propiedad.casas < 4 && !propiedad.hotel && player.dinero >= 100;
        
        let puedeConstructHotel = propiedad && tieneMonopolio && !propiedad.hipotecada && 
                                 propiedad.casas === 4 && !propiedad.hotel && player.dinero >= 250;

        // REGLA: Construcción equilibrada
        if (puedeConstructCasa && square.color) {
            const { min, max } = this.getEstadoGrupoConstruccion(square.color, player);
            if (propiedad.casas > min && max - min > 0) {
                puedeConstructCasa = false;
            }
        }

        // REGLA: Hotel requiere 4 casas en TODAS las propiedades del grupo
        if (puedeConstructHotel && square.color) {
            const { estado } = this.getEstadoGrupoConstruccion(square.color, player);
            const faltanCasas = estado.filter(e => e.id !== square.id && !e.hotel && e.casas < 4);
            if (faltanCasas.length > 0) {
                puedeConstructHotel = false;
            }
        }

        btnCasa.disabled = !puedeConstructCasa;
        btnHotel.disabled = !puedeConstructHotel;

        // Razones específicas
        if (!puedeConstructCasa) {
            if (!propiedad) {
                btnCasa.dataset.disableReason = 'No es tu propiedad.';
            } else if (!tieneMonopolio) {
                btnCasa.dataset.disableReason = 'Necesitas monopolio del color.';
            } else if (propiedad.hipotecada) {
                btnCasa.dataset.disableReason = 'Propiedad hipotecada.';
            } else if (propiedad.hotel) {
                btnCasa.dataset.disableReason = 'Ya hay un hotel.';
            } else if (propiedad.casas >= 4) {
                btnCasa.dataset.disableReason = 'Máximo de casas alcanzado.';
            } else if (player.dinero < 100) {
                btnCasa.dataset.disableReason = 'Necesitas $100 para construir.';
            } else {
                btnCasa.dataset.disableReason = 'Construcción debe ser equilibrada.';
            }
        }

        if (!puedeConstructHotel) {
            if (!propiedad) {
                btnHotel.dataset.disableReason = 'No es tu propiedad.';
            } else if (propiedad.casas < 4) {
                btnHotel.dataset.disableReason = 'Necesitas exactamente 4 casas.';
            } else if (player.dinero < 250) {
                btnHotel.dataset.disableReason = 'Necesitas $250 para construir hotel.';
            } else {
                btnHotel.dataset.disableReason = 'Todas las propiedades del grupo necesitan 4 casas.';
            }
        }
    }

    /**
     * REGLA: Configurar botones de hipoteca con validaciones
     */
    configurarBotonesHipoteca(player, square) {
        const btnHipotecar = document.getElementById('btnHipotecar');
        const btnDeshipotecar = document.getElementById('btnDeshipotecar');
        
        if (!btnHipotecar || !btnDeshipotecar) return;

        const propiedad = player.propiedades?.find(p => p.id === square.id);
        const valorHipoteca = square.mortgage || Math.floor((square.price || 100) / 2);
        const costoDeshipoteca = Math.ceil(valorHipoteca * 1.1);

        // REGLA: Solo se puede hipotecar propiedad propia sin construcciones
        const puedeHipotecar = propiedad && !propiedad.hipotecada && 
                              propiedad.casas === 0 && !propiedad.hotel;

        // REGLA: Solo se puede deshipotecar si está hipotecada y tienes dinero
        const puedeDeshipotecar = propiedad && propiedad.hipotecada && 
                                 player.dinero >= costoDeshipoteca;

        btnHipotecar.disabled = !puedeHipotecar;
        btnDeshipotecar.disabled = !puedeDeshipotecar;

        if (!puedeHipotecar) {
            if (!propiedad) {
                btnHipotecar.dataset.disableReason = 'No es tu propiedad.';
            } else if (propiedad.hipotecada) {
                btnHipotecar.dataset.disableReason = 'Ya está hipotecada.';
            } else if (propiedad.casas > 0 || propiedad.hotel) {
                btnHipotecar.dataset.disableReason = 'Vende construcciones primero.';
            }
        }

        if (!puedeDeshipotecar) {
            if (!propiedad) {
                btnDeshipotecar.dataset.disableReason = 'No es tu propiedad.';
            } else if (!propiedad.hipotecada) {
                btnDeshipotecar.dataset.disableReason = 'No está hipotecada.';
            } else if (player.dinero < costoDeshipoteca) {
                btnDeshipotecar.dataset.disableReason = `Necesitas $${costoDeshipoteca} (incluye 10% interés).`;
            }
        }
    }

    /**
     * REGLA: Configurar botones especiales
     */
    configurarBotonesEspeciales(player, square) {
        // Botones de cartas SIEMPRE deshabilitados (automáticas)
        const btnSuerte = document.getElementById('btnCartaSorpresa');
        const btnComunidad = document.getElementById('btnCajaComunidad');
        
        if (btnSuerte) {
            btnSuerte.disabled = true;
            btnSuerte.dataset.disableReason = 'Las cartas se toman automáticamente.';
        }
        if (btnComunidad) {
            btnComunidad.disabled = true;
            btnComunidad.dataset.disableReason = 'Las cartas se toman automáticamente.';
        }

        // Botón de impuestos solo si es casilla de impuesto
        const btnImpuesto = document.getElementById('btnPagarImpuesto');
        if (btnImpuesto) {
            btnImpuesto.disabled = square.type !== 'tax';
            if (square.type !== 'tax') {
                btnImpuesto.dataset.disableReason = 'Solo en casillas de impuesto.';
            }
        }

        // Botón de pagar renta ELIMINADO (ahora es automático)
        const btnRenta = document.getElementById('btnPagarRenta');
        if (btnRenta) {
            btnRenta.disabled = true;
            btnRenta.dataset.disableReason = 'La renta se paga automáticamente.';
        }
    }

    /**
     * Aplica una razón general a todos los botones deshabilitados
     */
    aplicarRazonGeneral(razon) {
        const botones = [
            'btnComprarPropiedad', 'btnConstruirCasa', 'btnConstruirHotel',
            'btnHipotecar', 'btnDeshipotecar', 'btnCartaSorpresa', 
            'btnCajaComunidad', 'btnPagarImpuesto', 'btnPagarRenta'
        ];

        botones.forEach(id => {
            const btn = document.getElementById(id);
            if (btn && btn.disabled) {
                btn.dataset.disableReason = razon;
            }
        });
    }

    /**
     * Deshabilita todos los botones de acción
     */
    deshabilitarTodosBotones() {
        const botones = [
            'btnComprarPropiedad', 'btnPagarRenta', 'btnConstruirCasa', 'btnConstruirHotel',
            'btnHipotecar', 'btnDeshipotecar', 'btnCartaSorpresa', 'btnCajaComunidad',
            'btnPagarImpuesto', 'btnIrCarcel'
        ];

        botones.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.disabled = true;
                btn.dataset.disableReason = 'Acción no disponible todavía.';
            }
        });
    }

    /**
     * Ejecuta la acción de comprar propiedad en la casilla actual
     */
    ejecutarAccionComprar() {
        const currentPlayer = this.players[this.currentPlayerIndex];
        if (!currentPlayer) {
            this.notifyError('Sin jugador activo', 'Configura o selecciona jugadores antes de realizar acciones.');
            return;
        }

        if (currentPlayer.estaEnCarcel) {
            this.notifyWarn('Acción bloqueada', 'No puedes comprar mientras estás en la cárcel.');
            return;
        }

        const position = currentPlayer.position || 0;
        // IMPORTANTE: acceder siempre mediante el método del Board para evitar undefined
        let square = null;
        try {
            if (this.board && typeof this.board.getSquareByPosition === 'function') {
                square = this.board.getSquareByPosition(position);
            } else if (this.board?.squaresByPosition) {
                square = this.board.squaresByPosition[position];
            }
        } catch (e) {
            console.error('Error obteniendo casilla por posición', position, e);
        }
        
        if (!square) {
            this.notifyError('Casilla desconocida', `No se pudo determinar la casilla actual (pos=${position}). Verifique la inicialización del tablero.`);
            return;
        }

        if (['property', 'railroad', 'utility'].includes(square.type)) {
            const yaTieneDueno = this.players.some(p => p.propiedades?.some(pr => pr.id === square.id));
            if (yaTieneDueno) {
                this.notifyInfo('Propiedad ocupada', 'Esta casilla ya tiene dueño.');
                return;
            }
            if (currentPlayer.dinero < (square.price || 0)) {
                this.notifyWarn('Dinero insuficiente', `Necesitas $${square.price} y tienes $${currentPlayer.dinero}.`);
                return;
            }
            this.ofrecerCompraPropiedad(currentPlayer, square);
        } else {
            this.notifyWarn('Acción no válida', 'Esta casilla no es comprable.');
        }
    }

    /**
     * Ejecuta el pago de renta en la casilla actual
     */
    ejecutarAccionRenta() {
        const currentPlayer = this.players[this.currentPlayerIndex];
        if (!currentPlayer) {
            this.notifyError('Sin jugador activo', 'No hay un jugador seleccionado para pagar renta.');
            return;
        }

        const position = currentPlayer.position || 0;
        const square = this.board.squares[position];
        const propietario = this.players.find(p => p.propiedades?.some(prop => prop.id === square.id));

        if (propietario && propietario.id !== currentPlayer.id) {
            this.pagarRenta(currentPlayer, propietario, square);
        } else {
            this.notifyInfo('Sin renta', 'No debes pagar renta en esta casilla.');
        }
    }

    /**
     * Ejecuta la construcción de una casa
     */
    ejecutarAccionConstruirCasa() {
        // Evitar múltiples ejecuciones simultáneas
        if (this.actionInProgress) {
            console.log('⚠️ Acción ya en progreso, ignorando click duplicado');
            return;
        }
        
        this.actionInProgress = true;
        
        try {
            const currentPlayer = this.players[this.currentPlayerIndex];
            if (!currentPlayer) {
                this.notifyError('Sin jugador activo', 'No puedes construir sin un jugador en turno.');
                return;
            }
            if (currentPlayer.estaEnCarcel) {
                this.notifyWarn('Acción bloqueada', 'No puedes construir en la cárcel.');
                return;
            }
            const position = currentPlayer.position || 0;
            const square = this.board.getSquareByPosition ? this.board.getSquareByPosition(position) : this.board.squares[position];
            const propiedad = currentPlayer.propiedades?.find(p => p.id === square.id);
            if (!square || !propiedad) {
                this.notifyWarn('No es tu propiedad', 'Solo puedes construir en una propiedad tuya.');
                return;
            }
            if (propiedad.hipotecada) {
                this.notifyWarn('Hipotecada', 'No puedes construir sobre una propiedad hipotecada.');
                return;
            }
            if (propiedad.hotel) {
                this.notifyInfo('Hotel existente', 'Ya hay un hotel, no puedes añadir casas.');
                return;
            }
            if (propiedad.casas >= 4) {
                this.notifyInfo('Límite alcanzado', 'Ya tienes 4 casas. Construye un hotel.');
                return;
            }
            // Validar monopolio usando la misma lógica que en configurarBotonesConstruccion
            if (!this.puedeConstructor(currentPlayer, square)) {
                this.notifyWarn('Sin monopolio', 'Necesitas todas las propiedades de este color para construir.');
                return;
            }
            
            // Validar regla de construcción equilibrada
            if (square.color) {
                const { estado, min, max } = this.getEstadoGrupoConstruccion(square.color, currentPlayer);
                const propEstado = estado.find(e => e.id === square.id);
                if (propEstado && propEstado.casas > min && max - min > 0 && propEstado.casas >= max) {
                    this.notifyWarn('Construcción desbalanceada', `Debes construir primero en propiedades con menos casas (mínimo actual: ${min}).`);
                    return;
                }
            }
        this.ofrecerConstruccion(currentPlayer, square);
        } finally {
            // Liberar el lock de acción
            this.actionInProgress = false;
        }
    }

    /**
     * Ejecuta la construcción de un hotel
     */
    ejecutarAccionConstruirHotel() {
        // Evitar múltiples ejecuciones simultáneas
        if (this.actionInProgress) {
            console.log('⚠️ Acción ya en progreso, ignorando click duplicado');
            return;
        }
        
        this.actionInProgress = true;
        
        try {
            const currentPlayer = this.players[this.currentPlayerIndex];
            if (!currentPlayer) {
                this.notifyError('Sin jugador activo', 'No hay jugador para construir hotel.');
                return;
            }
            if (currentPlayer.estaEnCarcel) {
                this.notifyWarn('Acción bloqueada', 'No puedes construir en la cárcel.');
                return;
            }
            const position = currentPlayer.position || 0;
            const square = this.board.getSquareByPosition ? this.board.getSquareByPosition(position) : this.board.squares[position];
            const propiedad = currentPlayer.propiedades?.find(p => p.id === square.id);
            if (!square || !propiedad) {
                this.notifyWarn('No es tu propiedad', 'Solo puedes construir en una propiedad tuya.');
                return;
            }
            if (propiedad.hipotecada) {
                this.notifyWarn('Hipotecada', 'No puedes construir sobre una propiedad hipotecada.');
                return;
            }
            if (propiedad.hotel) {
                this.notifyInfo('Hotel existente', 'Ya existe un hotel.');
                return;
            }
            if (propiedad.casas !== 4) {
                this.notifyWarn('Requisito casas', 'Necesitas exactamente 4 casas antes del hotel.');
                return;
            }
            // Validar monopolio usando la misma lógica consistente
            if (!this.puedeConstructor(currentPlayer, square)) {
                this.notifyWarn('Sin monopolio', 'Necesitas todas las propiedades de este color.');
                return;
            }
            
            // Validar que las demás propiedades del grupo estén también con 4 casas (regla antes de hotel)
            if (square.color) {
                const { estado } = this.getEstadoGrupoConstruccion(square.color, currentPlayer);
                const faltantes = estado.filter(e => e.id !== square.id && !e.hotel && e.casas < 4);
                if (faltantes.length) {
                    this.notifyWarn('Construcción inválida', 'Necesitas 4 casas en cada propiedad del color antes de un hotel.');
                    return;
                }
            }
            this.ofrecerConstruccion(currentPlayer, square);
        } finally {
            // Liberar el lock de acción
            this.actionInProgress = false;
        }
    }

    /**
     * Ejecuta la acción de hipotecar
     */
    ejecutarAccionHipotecar() {
        const currentPlayer = this.players[this.currentPlayerIndex];
        if (!currentPlayer) {
            this.notifyError('Sin jugador activo', 'No hay jugador para hipotecar.');
            return;
        }

        if (currentPlayer.estaEnCarcel) {
            this.notifyWarn('Acción bloqueada', 'No puedes hipotecar en la cárcel.');
            return;
        }

        const position = currentPlayer.position || 0;
        const square = this.board.squares[position];
        const propiedad = currentPlayer.propiedades?.find(p => p.id === square.id);

        if (propiedad && !propiedad.hipotecada) {
            // Verificar que no tenga construcciones
            if (propiedad.casas > 0 || propiedad.hotel) {
                this.notifyWarn('No se puede hipotecar', 'Debes vender las construcciones antes de hipotecar.');
                return;
            }
            this.hipotecarPropiedad(currentPlayer, propiedad, square);
        } else if (!propiedad) {
            this.notifyError('Propiedad ajena', 'Solo puedes hipotecar propiedades propias.');
        } else {
            this.notifyInfo('Ya hipotecada', 'Esta propiedad se encuentra hipotecada.');
        }
    }

    /**
     * Ejecuta la acción de deshipotecar
     */
    ejecutarAccionDeshipotecar() {
        const currentPlayer = this.players[this.currentPlayerIndex];
        if (!currentPlayer) {
            this.notifyError('Sin jugador activo', 'No hay jugador para deshipotecar.');
            return;
        }

        if (currentPlayer.estaEnCarcel) {
            this.notifyWarn('Acción bloqueada', 'No puedes deshipotecar en la cárcel.');
            return;
        }

        const position = currentPlayer.position || 0;
        const square = this.board.squares[position];
        const propiedad = currentPlayer.propiedades?.find(p => p.id === square.id);

        if (propiedad && propiedad.hipotecada) {
            const valorHipoteca = square.mortgage || Math.floor(square.price / 2);
            const costoDeshipoteca = Math.floor(valorHipoteca * 1.1);
            
            if (currentPlayer.dinero < costoDeshipoteca) {
                this.notifyWarn('Dinero insuficiente', `Necesitas $${costoDeshipoteca} para deshipotecar.`);
                return;
            }
            this.deshipotecarPropiedad(currentPlayer, propiedad, square);
        } else if (!propiedad) {
            this.notifyError('Propiedad ajena', 'No es tuya esta propiedad.');
        } else {
            this.notifyInfo('Sin hipoteca', 'La propiedad no está hipotecada.');
        }
    }

    /**
     * Ejecuta el pago de impuestos
     */
    ejecutarAccionImpuesto() {
        const currentPlayer = this.players[this.currentPlayerIndex];
        if (!currentPlayer) {
            this.notifyError('Sin jugador activo', 'No hay jugador para pagar impuestos.');
            return;
        }

        if (currentPlayer.estaEnCarcel) {
            this.notifyWarn('Acción bloqueada', 'No pagas impuestos desde la cárcel (solo al caer en la casilla).');
            return;
        }

        const position = currentPlayer.position || 0;
        const square = this.board.squares[position];

        if (square.type === 'tax') {
            this.manejarImpuesto(currentPlayer, square);
        } else {
            this.notifyInfo('Sin impuestos', 'Esta casilla no genera impuestos.');
        }
    }

    /**
     * Ejecuta acciones de cárcel
     */
    ejecutarAccionCarcel() {
        const currentPlayer = this.players[this.currentPlayerIndex];
        if (!currentPlayer) {
            this.notifyError('Sin jugador activo', 'No hay jugador para acción de cárcel.');
            return;
        }

        // Bloquear si el juego aún no inició formalmente
        if (!this.gameStarted) {
            this.notifyWarn('Juego no iniciado', 'Lanza los dados primero antes de usar acciones de cárcel.');
            return;
        }

        // Evitar que otros jugadores activen acciones fuera de su turno (por seguridad futura)
        if (this.players[this.currentPlayerIndex].id !== currentPlayer.id) {
            this.notifyWarn('Turno inválido', 'Solo el jugador en turno puede usar esta acción.');
            return;
        }

        // Con nueva lógica se permite intentar (pagar) siempre, tryLeaveJail decide

        if (!currentPlayer.estaEnCarcel) {
            this.notifyWarn('No estás en la cárcel', 'Esta acción sólo aplica cuando estás encerrado.');
            return;
        }

        const res = currentPlayer.tryLeaveJail ? currentPlayer.tryLeaveJail({ pay:true, cost:50, maxTurns:3 }) : { freed:false };
        if (res.freed) {
            this.notifyOk('Sales de la cárcel', res.reason === 'pay' ? 'Pagaste $50.' : 'Saliste.');
        } else {
            this.notifyWarn('Sigue en cárcel', 'No has podido salir aún.');
        }
        this.actualizarEstadoBotones();
        this.updatePlayerStatsPanel();
    }

    /**
     * Hipoteca una propiedad
     */
    async hipotecarPropiedad(player, propiedad, square) {
        // Usar el valor de mortgage definido en la casilla
        const valorHipoteca = square.mortgage || Math.floor(square.price / 2);
        
        const confirmar = await this.mostrarConfirmacion(
            '🏦 Hipotecar Propiedad',
            `¿Hipotecar ${square.name} por $${valorHipoteca}?\n\n` +
            `⚠️ Mientras esté hipotecada:\n` +
            `• No podrás cobrar renta\n` +
            `• Para recuperarla pagarás $${Math.floor(valorHipoteca * 1.1)} (valor + 10% interés)`,
            player
        );

        if (confirmar) {
            // Marcar propiedad como hipotecada
            propiedad.hipotecada = true;
            propiedad.fechaHipoteca = new Date().toISOString();
            
            // Agregar dinero al jugador (el banco paga el valor de hipoteca)
            player.dinero += valorHipoteca;
            
            this.mostrarMensaje(player, '🏦 Propiedad Hipotecada', 
                `${square.name} hipotecada por $${valorHipoteca}.\n` +
                `💰 Tu dinero: $${player.dinero}\n\n` +
                `⚠️ IMPORTANTE: No cobrarás renta mientras esté hipotecada.`);
            
            // Marcar visualmente la propiedad como hipotecada
            this.marcarPropiedadComoHipotecada(square.id);
            
            // Actualizar localStorage
            this.guardarEstadoJuego();
            
            console.log(`🏦 ${player.nickname} hipotecó ${square.name} por $${valorHipoteca}`);
            // Actualizar botones tras hipotecar
            this.actualizarEstadoBotones();
            this.updatePlayerStatsPanel();
        }
    }

    /**
     * Deshipoteca una propiedad
     */
    async deshipotecarPropiedad(player, propiedad, square) {
        const valorHipoteca = square.mortgage || Math.floor(square.price / 2);
        const costoDeshipoteca = Math.floor(valorHipoteca * 1.1); // Valor + 10% de interés
        
        if (player.dinero < costoDeshipoteca) {
            this.mostrarMensaje(player, '💸 Sin dinero suficiente', 
                `Necesitas $${costoDeshipoteca} para deshipotecar ${square.name}\n` +
                `(Valor hipoteca: $${valorHipoteca} + 10% interés: $${costoDeshipoteca - valorHipoteca})\n\n` +
                `💰 Tu dinero actual: $${player.dinero}`);
            return;
        }

        const confirmar = await this.mostrarConfirmacion(
            '🔓 Deshipotecar Propiedad',
            `¿Deshipotecar ${square.name}?\n\n` +
            `💰 Costo: $${costoDeshipoteca}\n` +
            `(Valor original: $${valorHipoteca} + 10% interés: $${costoDeshipoteca - valorHipoteca})\n\n` +
            `💵 Tu dinero después: $${player.dinero - costoDeshipoteca}`,
            player
        );

        if (confirmar) {
            // Quitar hipoteca de la propiedad
            propiedad.hipotecada = false;
            delete propiedad.fechaHipoteca;
            
            // Cobrar al jugador el valor + 10% interés
            player.dinero -= costoDeshipoteca;
            
            this.mostrarMensaje(player, '🏠 Propiedad Deshipotecada', 
                `${square.name} deshipotecada exitosamente.\n\n` +
                `💸 Pagaste: $${costoDeshipoteca}\n` +
                `💰 Tu dinero: $${player.dinero}\n\n` +
                `✅ Ya puedes cobrar renta normalmente.`);
            
            // Restaurar apariencia visual de la propiedad
            this.marcarPropiedadComoComprada(square.id, player);
            // Quitar indicador de hipoteca si existe
            const squareElement = document.querySelector(`[data-square-id="${square.id}"]`);
            if (squareElement) {
                const hipotecaIndicator = squareElement.querySelector('.hipoteca-indicator');
                if (hipotecaIndicator) hipotecaIndicator.remove();
                const indicator = squareElement.querySelector('.property-indicator');
                if (indicator) {
                    indicator.style.background = this.colorToCSS(player.color);
                    indicator.style.opacity = '1';
                }
            }
            
            // Actualizar localStorage
            this.guardarEstadoJuego();
            
            console.log(`🔓 ${player.nickname} deshipotecó ${square.name} por $${costoDeshipoteca}`);
            // Actualizar botones tras deshipotecar
            this.actualizarEstadoBotones();
            this.updatePlayerStatsPanel();
        }
    }

    /**
     * Marca una propiedad como hipotecada visualmente
     */
    marcarPropiedadComoHipotecada(squareId) {
        const squareElement = document.querySelector(`[data-square-id="${squareId}"]`);
        if (squareElement) {
            let indicator = squareElement.querySelector('.property-indicator');
            if (indicator) {
                indicator.style.background = '#999';
                indicator.style.opacity = '0.5';
            }
            
            // Agregar indicador de hipoteca
            let hipotecaIndicator = squareElement.querySelector('.hipoteca-indicator');
            if (!hipotecaIndicator) {
                hipotecaIndicator = document.createElement('div');
                hipotecaIndicator.className = 'hipoteca-indicator';
                hipotecaIndicator.style.cssText = `
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    font-size: 20px;
                    z-index: 10;
                `;
                hipotecaIndicator.textContent = '🏦';
                squareElement.appendChild(hipotecaIndicator);
            }
        }
        // Actualizar stats por si cambió número de hipotecadas
        this.updatePlayerStatsPanel();
    }

    /**
     * Finaliza el juego y envía puntajes al backend
     */
    async finalizarJuego() {
        if (!confirm('¿Estás seguro de que quieres finalizar el juego?')) {
            return;
        }

        try {
            // Calcular patrimonios y determinar ganador
            let ganador = this.players[0];
            let resultados = [];
            
            this.players.forEach(player => {
                const patrimonio = this.calcularPatrimonio(player);
                const patrimonioGanador = this.calcularPatrimonio(ganador);
                
                // Contar propiedades hipotecadas para mostrar en el resumen
                const propiedadesHipotecadas = player.propiedades?.filter(p => p.hipotecada).length || 0;
                const valorHipotecas = this.calcularValorHipotecas(player);
                
                resultados.push({
                    jugador: player,
                    patrimonio: patrimonio,
                    propiedadesHipotecadas: propiedadesHipotecadas,
                    valorHipotecas: valorHipotecas
                });
                
                if (patrimonio > patrimonioGanador) {
                    ganador = player;
                }
            });
            
            // Ordenar resultados por patrimonio
            resultados.sort((a, b) => b.patrimonio - a.patrimonio);
            
            // Enviar puntajes al backend
            const envioExitoso = await this.enviarPuntajesAlBackend(resultados);
            
            // Crear mensaje de resultados finales
            let mensaje = `🏆 ¡JUEGO FINALIZADO!\n\n`;
            mensaje += `🥇 GANADOR: ${ganador.ficha} ${ganador.nickname}\n`;
            mensaje += `💰 Patrimonio Neto: $${this.calcularPatrimonio(ganador)}\n\n`;
            mensaje += `📊 RANKING FINAL:\n`;
            
            resultados.forEach((resultado, index) => {
                const emoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '👤';
                mensaje += `${emoji} ${resultado.jugador.nickname}: $${resultado.patrimonio}`;
                if (resultado.valorHipotecas > 0) {
                    mensaje += ` (-$${resultado.valorHipotecas} hipotecas)`;
                }
                mensaje += `\n`;
            });
            
            if (!envioExitoso) {
                mensaje += `\n⚠️ Los puntajes no pudieron enviarse al servidor, pero se guardaron localmente.`;
            } else {
                mensaje += `\n✅ Puntajes enviados al ranking global.`;
            }

            // Mostrar resumen final en secciones (dividir para mejor lectura)
            this.showToast({ title: '🏆 Juego Finalizado', message: `Ganador: ${ganador.ficha} ${ganador.nickname}`, type: 'success', timeout: 6000 });
            this.showToast({ title: '💰 Patrimonio Ganador', message: `$${this.calcularPatrimonio(ganador)} (neto)`, type: 'info', timeout: 6000 });
            // Listado compacto
            const top3 = resultados.slice(0, 5).map((r,i)=>`${i+1}. ${r.jugador.nickname} $${r.patrimonio}`).join('<br>');
            this.showToast({ title: '📊 Ranking Final', message: top3, type: 'info', timeout: 8000 });
            if (!envioExitoso) {
                this.showToast({ title: '⚠️ Aviso', message: 'Puntajes guardados localmente (sin conexión).', type: 'warning', timeout: 7000 });
            } else {
                this.showToast({ title: '✅ Ranking Global', message: 'Puntajes enviados correctamente.', type: 'success', timeout: 5000 });
            }
            
            // Preguntar si quiere ver el ranking
            if (confirm('¿Quieres ver el ranking global de todos los jugadores?')) {
                window.location.href = 'ranking.html';
            } else {
                // Limpiar datos y redirigir al menú principal
                localStorage.clear();
                window.location.href = '../index.html';
            }
            
        } catch (error) {
            console.error('❌ Error al finalizar juego:', error);
            this.notifyError('Error finalizando', 'El juego terminó con errores. Se guardó una copia local.');
            localStorage.clear();
            window.location.href = '../index.html';
        }
    }

    /**
     * Calcula el valor total de las hipotecas de un jugador
     */
    calcularValorHipotecas(player) {
        if (!player.propiedades) return 0;
        
        let valorHipotecas = 0;
        player.propiedades.forEach(prop => {
            if (prop.hipotecada) {
                const square = this.board.squares.find(s => s.id === prop.id);
                const valorHipoteca = square?.mortgage || Math.floor(prop.price / 2);
                valorHipotecas += valorHipoteca;
            }
        });
        
        return valorHipotecas;
    }

    /**
     * Envía los puntajes de todos los jugadores al backend
     */
    async enviarPuntajesAlBackend(resultados) {
        try {
            const promesasEnvio = resultados.map(async (resultado) => {
                const body = {
                    nick_name: resultado.jugador.nickname || resultado.jugador.ficha,
                    score: resultado.patrimonio,
                    // Asegurar que enviamos un código válido (fallback 'co')
                    country_code: (resultado.jugador.country_code || resultado.jugador.pais || 'co').toString().toLowerCase()
                };

                console.log(`📤 Enviando puntaje de ${body.nick_name}: $${body.score}`);
                
                const response = await fetch('http://127.0.0.1:5000/score-recorder', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(body)
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                console.log(`✅ Puntaje enviado exitosamente para ${body.nick_name}:`, data);
                return data;
            });

            // Esperar a que se envíen todos los puntajes
            await Promise.all(promesasEnvio);
            console.log('🎉 Todos los puntajes enviados exitosamente');
            return true;
            
        } catch (error) {
            console.error('❌ Error al enviar puntajes al backend:', error);
            // Guardar localmente como respaldo
            this.guardarPuntajesLocalmente(resultados);
            return false;
        }
    }

    /**
     * Guarda los puntajes localmente como respaldo
     */
    guardarPuntajesLocalmente(resultados) {
        try {
            const puntajesLocales = {
                fecha: new Date().toISOString(),
                resultados: resultados.map(r => ({
                    nickname: r.jugador.nickname,
                    ficha: r.jugador.ficha,
                    patrimonio: r.patrimonio,
                    country_code: (r.jugador.country_code || r.jugador.pais || "co").toString().toLowerCase()
                }))
            };
            
            localStorage.setItem('ultimoJuego', JSON.stringify(puntajesLocales));
            console.log('💾 Puntajes guardados localmente como respaldo');
        } catch (error) {
            console.error('❌ Error al guardar puntajes localmente:', error);
        }
    }

    /**
     * Guarda el estado actual del juego en localStorage
     */
    guardarEstadoJuego() {
        try {
            const estadoJuego = {
                players: this.players,
                currentPlayerIndex: this.currentPlayerIndex,
                gameStarted: this.gameStarted,
                timestamp: new Date().toISOString()
            };
            localStorage.setItem('monopolyGameState', JSON.stringify(estadoJuego));
            console.log('💾 Estado del juego guardado');
        } catch (error) {
            console.error('❌ Error al guardar estado del juego:', error);
        }
    }

    /**
     * Carga el estado del juego desde localStorage
     */
    cargarEstadoJuego() {
        try {
            const estadoGuardado = localStorage.getItem('monopolyGameState');
            if (estadoGuardado) {
                const estado = JSON.parse(estadoGuardado);
                this.players = estado.players || [];
                this.currentPlayerIndex = estado.currentPlayerIndex || 0;
                this.gameStarted = estado.gameStarted || false;
                console.log('📂 Estado del juego cargado');
                return true;
            }
        } catch (error) {
            console.error('❌ Error al cargar estado del juego:', error);
        }
        return false;
    }

    /**
     * Muestra información de hipotecas de un jugador (útil para debugging)
     */
    mostrarEstadoHipotecas(player) {
        if (!player.propiedades || player.propiedades.length === 0) {
            console.log(`📊 ${player.nickname} no tiene propiedades.`);
            return;
        }

        const propiedadesHipotecadas = player.propiedades.filter(p => p.hipotecada);
        const propiedadesLibres = player.propiedades.filter(p => !p.hipotecada);

        console.log(`📊 ESTADO HIPOTECAS - ${player.nickname}:`);
        console.log(`💰 Dinero: $${player.dinero}`);
        console.log(`🏠 Propiedades libres: ${propiedadesLibres.length}`);
        console.log(`🏦 Propiedades hipotecadas: ${propiedadesHipotecadas.length}`);
        
        if (propiedadesHipotecadas.length > 0) {
            console.log(`📋 Hipotecas activas:`);
            propiedadesHipotecadas.forEach(prop => {
                const square = this.board.squares[prop.id];
                const valorHipoteca = square?.mortgage || Math.floor(prop.price / 2);
                const costoDeshipoteca = Math.floor(valorHipoteca * 1.1);
                console.log(`   • ${prop.name}: Costo deshipotecar $${costoDeshipoteca}`);
            });
        }
    }

    /**
     * Calcula el patrimonio total de un jugador
     * IMPORTANTE: Se suma dinero + propiedades + construcciones - valor de hipotecas
     */
    calcularPatrimonio(player) {
        let patrimonio = player.dinero || 0;
        
        if (player.propiedades) {
            player.propiedades.forEach(prop => {
                // Sumar valor de la propiedad
                const valorPropiedad = prop.price || 100;
                patrimonio += valorPropiedad;
                
                // Sumar valor de construcciones
                patrimonio += (prop.casas || 0) * 100; // Casas valen $100
                if (prop.hotel) patrimonio += 200; // Hotel vale $200
                
                // RESTAR valor de hipoteca si está hipotecada
                if (prop.hipotecada) {
                    const square = this.board.squares.find(s => s.id === prop.id);
                    const valorHipoteca = square?.mortgage || Math.floor(valorPropiedad / 2);
                    patrimonio -= valorHipoteca;
                }
            });
        }
        
        return patrimonio;
    }

    lanzarDados() {
        this.showDiceBox();
    }

    /**
     * Lanza dados con valores aleatorios
     */
    lanzarAleatorio() {
        const dado1 = Math.floor(Math.random() * 6) + 1;
        const dado2 = Math.floor(Math.random() * 6) + 1;
        const total = dado1 + dado2;
        this.procesarLanzamiento(dado1, dado2, total);
    }

    /**
     * Permite ingresar valores manualmente para los dados
     */
    lanzarManual() {
        const currentPlayer = this.players[this.currentPlayerIndex];
        const diceContent = document.getElementById('diceContent');
        diceContent.innerHTML = `
            <div style="margin-bottom: 20px;">
                <div style="font-size: 20px; color: ${this.colorToCSS(currentPlayer.color)}; margin-bottom: 10px;">
                    ${currentPlayer.ficha} ${currentPlayer.nickname}
                </div>
                <div style="font-size: 16px; color: #333; margin-bottom: 15px;">
                    Ingresa cualquier número entero (incluso negativos):
                </div>
            </div>
            
            <div style="display: flex; justify-content: center; align-items: center; gap: 10px; margin-bottom: 20px;">
                <input type="number" id="dado1Input" value="1" style="
                    width: 80px;
                    height: 40px;
                    text-align: center;
                    border: 2px solid ${this.colorToCSS(currentPlayer.color)};
                    border-radius: 8px;
                    font-size: 16px;
                    font-weight: bold;
                ">
                <span style="font-size: 20px; font-weight: bold;">+</span>
                <input type="number" id="dado2Input" value="1" style="
                    width: 80px;
                    height: 40px;
                    text-align: center;
                    border: 2px solid ${this.colorToCSS(currentPlayer.color)};
                    border-radius: 8px;
                    font-size: 16px;
                    font-weight: bold;
                ">
            </div>
            
            <div style="display: flex; justify-content: center; gap: 15px; margin-bottom: 20px;">
                <button id="btnConfirmarManual" style="
                    background: linear-gradient(135deg, #28a745, #1e7e34);
                    color: white;
                    border: none;
                    padding: 12px 25px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 16px;
                    font-weight: bold;
                    box-shadow: 0 4px 12px rgba(40,167,69,0.3);
                ">Lanzar</button>
                <button id="btnVolver" style="
                    background: linear-gradient(135deg, #6c757d, #495057);
                    color: white;
                    border: none;
                    padding: 12px 25px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 16px;
                ">Volver</button>
            </div>
            
            <div id="resultadoDados"></div>
        `;
        
        document.getElementById('btnConfirmarManual').addEventListener('click', () => {
            const dado1Input = document.getElementById('dado1Input').value;
            const dado2Input = document.getElementById('dado2Input').value;
            const dado1 = parseInt(dado1Input);
            const dado2 = parseInt(dado2Input);
            
            // Verificar que sean números enteros válidos
            if (!isNaN(dado1) && !isNaN(dado2) && Number.isInteger(dado1) && Number.isInteger(dado2)) {
                this.procesarLanzamiento(dado1, dado2, dado1 + dado2);
            } else {
                document.getElementById('resultadoDados').innerHTML = '<div style="color:red; font-weight:bold; margin:10px 0;">❌ Valores inválidos. Deben ser números enteros válidos.</div>';
            }
        });
        
        document.getElementById('btnVolver').addEventListener('click', () => this.showDiceBox());
    }

    /**
     * Procesa el lanzamiento de dados con REGLAS ESTRICTAS DE CÁRCEL
     */
    procesarLanzamiento(dado1, dado2, total) {
        const currentPlayer = this.players[this.currentPlayerIndex];
        
        console.log(`🎲 ${currentPlayer.nickname} lanzó: ${dado1} + ${dado2} = ${total}`);
        this.mostrarResultadoMejorado(dado1, dado2, total);

        // REGLA CÁRCEL: Manejo completo antes de cualquier movimiento
        if (currentPlayer.estaEnCarcel) {
            const esDoble = dado1 === dado2;
            const resultado = currentPlayer.tryLeaveJail({ 
                dice: { isDouble: esDoble }, 
                cost: 50, 
                maxTurns: 3 
            });
            
            if (resultado.freed) {
                const mensajes = {
                    'double': '¡Sacaste dobles y sales gratis!',
                    'autoPay': '3 intentos cumplidos. Pagas $50 obligatorio y sales.',
                    'pay': 'Pagaste $50 voluntariamente y sales.'
                };
                
                this.notifyOk('🔓 Libre de la Cárcel', mensajes[resultado.reason]);
                
                // Solo se mueve si salió por dobles o pago (no por intento fallido)
                if (resultado.reason === 'double' || resultado.reason === 'autoPay' || resultado.reason === 'pay') {
                    this.movePlayerToken(currentPlayer, total);
                } else {
                    // Pasa turno sin moverse
                    setTimeout(() => this.siguienteTurno(), 1000);
                    return;
                }
            } else {
                this.notifyWarn('🔒 Sigues en la Cárcel', 
                    `Intento ${currentPlayer.turnosCarcel}/3. ${esDoble ? 'No sacaste dobles.' : 'Necesitas dobles o pagar $50.'}`);
                // No se mueve, pasa turno automáticamente
                setTimeout(() => this.siguienteTurno(), 1500);
                return;
            }
        } else {
            // Movimiento normal
            this.movePlayerToken(currentPlayer, total);
        }
        
        // Verificar dobles para turno adicional
        const esDoble = dado1 === dado2;
        setTimeout(() => {
            if (esDoble && !currentPlayer.estaEnCarcel) {
                this.manejarDobles(currentPlayer, total);
            } else {
                this.siguienteTurno();
            }
        }, 2000);
    }

    /**
     * Muestra el resultado de los dados con mejor diseño
     */
    mostrarResultadoMejorado(dado1, dado2, total) {
        const currentPlayer = this.players[this.currentPlayerIndex];
        const resultado = document.getElementById('resultadoDados');
        if (resultado) {
            resultado.innerHTML = `
                <div style="
                    text-align: center;
                    padding: 20px;
                    background: linear-gradient(135deg, ${this.colorToCSS(currentPlayer.color)}, ${this.colorToCSS(currentPlayer.color)}dd);
                    color: white;
                    border-radius: 12px;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.3);
                    margin: 15px 0;
                ">
                    <div style="font-size: 24px; margin-bottom: 10px;">
                        🎲 ${dado1} + ${dado2} = <strong>${total}</strong>
                    </div>
                    <div style="font-size: 16px; opacity: 0.9;">
                        ${currentPlayer.ficha} ${currentPlayer.nickname} avanza ${total} casillas
                    </div>
                    ${dado1 === dado2 ? '<div style="font-size: 14px; margin-top: 8px; animation: pulse 2s infinite;">✨ ¡DOBLES! Juegas otra vez</div>' : ''}
                </div>
            `;
        }
        
        // También actualizar el elemento de resultado de dados si existe
        const dadosResultado = document.getElementById('dados-resultado');
        if (dadosResultado) {
            dadosResultado.textContent = `🎲 ${dado1} + ${dado2} = ${total}`;
        }
    }

    /**
     * Maneja el caso de tirar dobles
     */
    manejarDobles(player, total) {
        console.log(`🎯 ${player.nickname} sacó dobles! Juega de nuevo.`);
        
        // Mostrar mensaje de dobles
        const resultado = document.getElementById('resultadoDados');
        if (resultado) {
            resultado.innerHTML += `
                <div style="
                    text-align: center;
                    padding: 15px;
                    background: linear-gradient(135deg, #FFD700, #FFA500);
                    color: #333;
                    border-radius: 12px;
                    margin: 10px 0;
                    font-weight: bold;
                    box-shadow: 0 4px 12px rgba(255, 215, 0, 0.4);
                ">
                    ✨ ¡DOBLES! ${player.nickname} juega otra vez ✨
                </div>
            `;
        }
        
        // Después de 2 segundos, mostrar de nuevo la caja de dados
        setTimeout(() => {
            this.showDiceBox();
        }, 2000);
    }

    /**
     * Pasa al siguiente jugador
     */
    siguienteTurno() {
        // Remover clase 'active' del jugador actual
        const currentTokens = document.querySelectorAll(`.player-token[data-player-id="${this.players[this.currentPlayerIndex].id}"]`);
        currentTokens.forEach(token => token.classList.remove('active'));
        
        // Cambiar al siguiente jugador
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
        const nextPlayer = this.players[this.currentPlayerIndex];
        
        // Agregar clase 'active' al nuevo jugador
        const nextTokens = document.querySelectorAll(`.player-token[data-player-id="${nextPlayer.id}"]`);
        nextTokens.forEach(token => token.classList.add('active'));
        
        console.log(`🔄 Turno de: ${nextPlayer.nickname} (${nextPlayer.color})`);
        
        // Cerrar la caja de dados y mostrar notificación de turno
        const diceBox = document.getElementById('diceBox');
        if (diceBox) {
            diceBox.style.display = 'none';
        }
        
        // Mostrar notificación del nuevo turno
        this.mostrarNotificacionTurno(nextPlayer);
        
        // Actualizar estado de botones para el nuevo jugador
        this.actualizarEstadoBotones();
    }

    /**
     * Muestra una notificación del turno actual
     */
    mostrarNotificacionTurno(player) {
        const notificacion = document.createElement('div');
        notificacion.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, ${this.colorToCSS(player.color)}, ${this.colorToCSS(player.color)}dd);
            color: white;
            padding: 20px 25px;
            border-radius: 12px;
            box-shadow: 0 8px 25px rgba(0,0,0,0.3);
            z-index: 9999;
            font-size: 16px;
            font-weight: bold;
            text-align: center;
            min-width: 200px;
            animation: slideInRight 0.5s ease-out;
        `;
        
        notificacion.innerHTML = `
            <div style="font-size: 18px; margin-bottom: 5px;">
                ${player.ficha} Turno de ${player.nickname}
            </div>
            <div style="font-size: 14px; opacity: 0.9;">
                Haz click aquí para lanzar dados
            </div>
        `;
        
        // Click para abrir dados
        notificacion.addEventListener('click', () => {
            this.showDiceBox();
            notificacion.remove();
        });
        
        document.body.appendChild(notificacion);
        
        // Auto-remover después de 5 segundos
        setTimeout(() => {
            if (notificacion.parentNode) {
                notificacion.style.animation = 'slideOutRight 0.5s ease-out';
                setTimeout(() => notificacion.remove(), 500);
            }
        }, 5000);
        
        // Agregar estilos de animación si no existen
        if (!document.getElementById('turnAnimations')) {
            const styles = document.createElement('style');
            styles.id = 'turnAnimations';
            styles.textContent = `
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOutRight {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.7; }
                }
            `;
            document.head.appendChild(styles);
        }
    }

    /**
     * MÉTODO LEGACY - mantener compatibilidad
     */
    mostrarResultado(dado1, dado2, total) {
        this.mostrarResultadoMejorado(dado1, dado2, total);
        this.moveCurrentPlayer(total);
    }

    /**
     * Mueve el jugador actual según el resultado de los dados
     */
    /**
     * Mueve la ficha del jugador actual (método de compatibilidad)
     */
    moveCurrentPlayer(steps) {
        if (this.players.length === 0) {
            console.log('⚠️ No hay jugadores en el juego');
            return;
        }
        
        const currentPlayer = this.players[this.currentPlayerIndex];
        this.movePlayerToken(currentPlayer, steps);
    }

    /**
     * Avanza al siguiente jugador
     */
    nextPlayer() {
        if (this.players.length > 0) {
            this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
        }
    }

    /**
     * Muestra la caja de dados con información del turno actual
     */
    showDiceBox() {
        const currentPlayer = this.players[this.currentPlayerIndex];
        
        let diceBox = document.getElementById('diceBox');
        if (!diceBox) {
            diceBox = document.createElement('div');
            diceBox.id = 'diceBox';
            diceBox.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: linear-gradient(135deg, #fff 0%, #f8f9fa 100%);
                border: 3px solid ${this.colorToCSS(currentPlayer.color)};
                border-radius: 20px;
                padding: 30px;
                box-shadow: 0 15px 35px rgba(0,0,0,0.2);
                z-index: 10000;
                min-width: 350px;
                text-align: center;
            `;
            diceBox.innerHTML = `<div id="diceContent"></div>`;
            document.body.appendChild(diceBox);
        }
        
        // Actualizar el borde con el color del jugador actual
        diceBox.style.borderColor = this.colorToCSS(currentPlayer.color);
        
        const diceContent = diceBox.querySelector('#diceContent');
        diceContent.innerHTML = `
            <div style="margin-bottom: 20px;">
                <div style="font-size: 24px; color: ${this.colorToCSS(currentPlayer.color)}; margin-bottom: 10px;">
                    ${currentPlayer.ficha} ${currentPlayer.nickname}
                </div>
                <div style="font-size: 16px; color: #666; margin-bottom: 15px;">
                    Es tu turno • Dinero: $${currentPlayer.dinero || 1500}
                </div>
                <div style="font-size: 18px; color: #333; margin-bottom: 20px;">
                    ¿Cómo quieres lanzar los dados?
                </div>
            </div>
            
            <div style="display: flex; justify-content: center; gap: 15px; margin-bottom: 20px;">
                <button id="btnAleatorio" style="
                    background: linear-gradient(135deg, #007bff, #0056b3);
                    color: white;
                    border: none;
                    padding: 15px 25px;
                    border-radius: 12px;
                    cursor: pointer;
                    font-size: 16px;
                    font-weight: bold;
                    box-shadow: 0 4px 12px rgba(0,123,255,0.3);
                    transition: all 0.3s ease;
                " onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
                    🎲 Aleatorio
                </button>
                <button id="btnManual" style="
                    background: linear-gradient(135deg, #28a745, #1e7e34);
                    color: white;
                    border: none;
                    padding: 15px 25px;
                    border-radius: 12px;
                    cursor: pointer;
                    font-size: 16px;
                    font-weight: bold;
                    box-shadow: 0 4px 12px rgba(40,167,69,0.3);
                    transition: all 0.3s ease;
                " onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
                    📝 Manual
                </button>
            </div>
            
            <div id="resultadoDados" style="margin: 20px 0;"></div>
            
            <button id="btnCerrarDados" style="
                background: linear-gradient(135deg, #6c757d, #495057);
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 8px;
                cursor: pointer;
                font-size: 14px;
            ">
                ❌ Cerrar
            </button>
        `;
        
        diceBox.style.display = 'block';

        // Event listeners
        document.getElementById('btnAleatorio').addEventListener('click', () => this.lanzarAleatorio());
        document.getElementById('btnManual').addEventListener('click', () => this.lanzarManual());
        document.getElementById('btnCerrarDados').addEventListener('click', () => { 
            diceBox.style.display = 'none'; 
        });
    }

    /** Inicializa el panel de estadísticas (estilos básicos) */
    initPlayerStatsPanel() {
        if (this.playerStatsInitialized) return;
        const panel = document.getElementById('playerStatsPanel');
        if (!panel) return;
        if (!document.getElementById('playerStatsStyles')) {
            const style = document.createElement('style');
            style.id = 'playerStatsStyles';
            style.textContent = `
                .player-stats-panel { display:flex; gap:25px; background:#f8f9fa; padding:15px 20px; border-radius:12px; box-shadow:0 4px 12px rgba(0,0,0,0.08); margin-top:15px; flex-wrap:wrap; }
                .player-stats-panel h4, .player-stats-panel h5 { margin:0 0 8px 0; font-weight:600; }
                .player-stats-panel p { margin:2px 0; font-size:14px; }
                .player-current { min-width:200px; }
                .players-summary { flex:1; min-width:220px; }
                .players-summary ul { list-style:none; padding:0; margin:0; max-height:140px; overflow:auto; }
                .players-summary li { font-size:13px; margin:2px 0; display:flex; gap:6px; align-items:center; }
                .ps-token { width:16px; height:16px; border-radius:50%; display:inline-block; border:2px solid #fff; box-shadow:0 0 0 2px rgba(0,0,0,0.15); }
                .ps-active { font-weight:bold; color:#0d6efd; }
            `;
            document.head.appendChild(style);
        }
        this.playerStatsInitialized = true;
    }

    /** Actualiza el contenido del panel de estadísticas */
    updatePlayerStatsPanel() {
        const panel = document.getElementById('playerStatsPanel');
        if (!panel || !this.players.length) return;
        const current = this.players[this.currentPlayerIndex];
        const get = id => document.getElementById(id);
        if (current) {
            if (get('ps-nombre')) get('ps-nombre').textContent = `${current.ficha || ''} ${current.nickname}`;
            if (get('ps-pais')) get('ps-pais').textContent = current.pais || current.country_code || '-';
            if (get('ps-dinero')) get('ps-dinero').textContent = current.dinero ?? 0;
            if (get('ps-posicion')) get('ps-posicion').textContent = current.position ?? 0;
            const props = current.propiedades || [];
            if (get('ps-propiedades')) get('ps-propiedades').textContent = props.length;
            const hipotecadas = props.filter(p => p.hipotecada).length;
            if (get('ps-hipotecadas')) get('ps-hipotecadas').textContent = hipotecadas;
            if (get('ps-carcel')) get('ps-carcel').textContent = current.estaEnCarcel ? 'Sí' : 'No';
            // Añadir badge de turnos en cárcel si aplica
            if (current.estaEnCarcel) {
                if (!get('ps-carcel').dataset.originalLabel) get('ps-carcel').dataset.originalLabel = get('ps-carcel').textContent;
                get('ps-carcel').textContent = `Sí (${current.turnosCarcel || 0}/3)`;
            }
        }
        const resumen = document.getElementById('ps-resumen');
        if (resumen) {
            resumen.innerHTML = '';
            this.players.forEach((p, idx) => {
                const li = document.createElement('li');
                const patrimonio = this.calcularPatrimonio(p);
                li.innerHTML = `
                    <span class="ps-token" style="background:${this.colorToCSS(p.color)}"></span>
                    <span class="${idx === this.currentPlayerIndex ? 'ps-active' : ''}">${p.nickname}</span>
                    <span style="margin-left:auto;">$${p.dinero}</span>
                    <span title="Propiedades">🏠${p.propiedades?.length || 0}</span>
                    <span title="Patrimonio total">📊${patrimonio}</span>
                `;
                resumen.appendChild(li);
            });
        }
    }
}

// Inicialización automática al cargar la página
document.addEventListener('DOMContentLoaded', async () => {
    const game = new Game('#boardContainer');
    await game.initialize(40); // por defecto 40 casillas
    window.game = game; // para inspeccionar desde consola
    
    // Configurar eventos de botones del menú lateral
    game.configurarEventosBotones();
});



export default Game;