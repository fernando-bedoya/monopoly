import Board from './Board.js';
import Square from './Square.js'; // no lo usamos directo, pero queda listo
import BoardRenderer from '../utils/BoardRenderer.js';
import BoardUtils from '../utils/BoardUtils.js';

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

        } catch (error) {
            console.error('❌ Error inicializando el juego:', error);
        }
    }

    // ========== SISTEMA DE JUGADORES Y FICHAS ==========
    
    /**
     * Carga los jugadores desde localStorage (datos del modal de configuración)
     */
    loadPlayersFromStorage() {
        const jugadoresData = localStorage.getItem('jugadores');
        const numJugadores = localStorage.getItem('numJugadores');
        
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
                        pais: jugadorData.pais || 'XX',
                        position: 0, // Todos empiezan en casilla 0 (SALIDA)
                        dinero: 1500,
                        propiedades: [],
                        estaEnCarcel: false
                    };
                    
                    this.players.push(player);
                });
                
                this.gameStarted = true;
                this.currentPlayerIndex = 0;
                
                console.log(`✅ ${this.players.length} jugadores cargados exitosamente`);
                
                // Esperar un poco para asegurar que el DOM esté completamente renderizado
                setTimeout(() => {
                    this.renderPlayerTokens();
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
            this.players.push(player);
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
        const square = this.board.squares[position];
        if (!square) return;

        console.log(`🎯 ${player.nickname} cayó en: ${square.name} (${square.type})`);

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
                await this.manejarCarcel(player);
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
     */
    async manejarPropiedad(player, square) {
        const propiedad = player.propiedades?.find(p => p.id === square.id);
        const propietario = this.players.find(p => p.propiedades?.some(prop => prop.id === square.id));

        if (!propietario) {
            // Propiedad libre - Opción de comprar
            await this.ofrecerCompraPropiedad(player, square);
        } else if (propietario.id === player.id) {
            // Propiedad propia - Opción de construir
            await this.ofrecerConstruccion(player, square);
        } else {
            // Propiedad de otro jugador - Pagar renta
            await this.pagarRenta(player, propietario, square);
        }
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
                hipotecada: false
            });

            this.mostrarMensaje(player, '🏠 Propiedad Comprada', 
                `¡Felicidades! Ahora eres dueño de ${square.name}. Dinero restante: $${player.dinero}`);
            
            // Actualizar visualmente la propiedad
            this.marcarPropiedadComoComprada(square.id, player);
            
            // Guardar estado del juego
            this.guardarEstadoJuego();
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

        this.mostrarMensaje(player, '💸 Renta Pagada', 
            `Pagaste $${renta} a ${propietario.nickname} por ${square.name}. Tu dinero: $${player.dinero}`);
    }

    /**
     * Calcula la renta de una propiedad según casas/hoteles
     */
    calcularRenta(propiedad, square) {
        const rentaBase = square.rent || 10;
        
        if (propiedad.hotel) {
            return rentaBase * 5; // Hotel multiplica x5
        } else if (propiedad.casas > 0) {
            return rentaBase * (1 + propiedad.casas); // Cada casa multiplica la renta
        }
        
        return rentaBase;
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
                this.mostrarMensaje(player, '🏠 Casa Construida', 
                    `¡Casa construida en ${square.name}! Casas: ${propiedad.casas}/4. Dinero: $${player.dinero}`);
            } else {
                propiedad.casas = 0;
                propiedad.hotel = true;
                this.mostrarMensaje(player, '🏨 Hotel Construido', 
                    `¡Hotel construido en ${square.name}! Dinero: $${player.dinero}`);
            }

            // Actualizar visualmente
            this.actualizarVisualizacionPropiedad(square.id, propiedad);
            
            // Guardar estado del juego
            this.guardarEstadoJuego();
        }
    }

    /**
     * Verifica si el jugador puede construir (debe tener todas las propiedades del color)
     */
    puedeConstructor(player, square) {
        const propiedadesDelColor = this.board.squares.filter(s => 
            s.type === 'property' && s.color === square.color
        );
        
        const propiedadesDelJugador = player.propiedades.filter(p => 
            propiedadesDelColor.some(pc => pc.id === p.id)
        );

        return propiedadesDelJugador.length === propiedadesDelColor.length;
    }

    /**
     * Maneja cartas de Caja de Comunidad
     */
    async manejarCajaComunidad(player) {
        const cartas = [
            { texto: 'Recibe $200 por servicios médicos.', dinero: 200 },
            { texto: 'Paga $100 por multa de estacionamiento.', dinero: -100 },
            { texto: 'Recibe $50 por la venta de acciones.', dinero: 50 },
            { texto: 'Paga $75 por reparaciones escolares.', dinero: -75 },
            { texto: 'Recibe $100 por tu cumpleaños.', dinero: 100 },
            { texto: 'Paga $50 por consulta médica.', dinero: -50 },
            { texto: 'Recibe $25 por reembolso de impuestos.', dinero: 25 }
        ];

        const carta = cartas[Math.floor(Math.random() * cartas.length)];
        player.dinero += carta.dinero;

        this.mostrarMensaje(player, '📦 Caja de Comunidad', 
            `${carta.texto} Tu dinero: $${player.dinero}`);
    }

    /**
     * Maneja cartas de Suerte
     */
    async manejarSuerte(player) {
        const cartas = [
            { texto: 'Avanza hasta la SALIDA y recibe $200.', dinero: 200, mover: 0 },
            { texto: 'Recibe $150 por ganar un concurso de belleza.', dinero: 150 },
            { texto: 'Paga $15 por exceso de velocidad.', dinero: -15 },
            { texto: 'Ve a la Cárcel directamente.', carcel: true },
            { texto: 'Recibe $50 por dividendos de tus acciones.', dinero: 50 },
            { texto: 'Paga $100 por reparaciones generales.', dinero: -100 },
            { texto: 'Retrocede 3 casillas.', mover: -3 }
        ];

        const carta = cartas[Math.floor(Math.random() * cartas.length)];
        
        if (carta.dinero) {
            player.dinero += carta.dinero;
        }
        
        if (carta.carcel) {
            await this.enviarACarcel(player);
            return;
        }
        
        if (carta.mover !== undefined) {
            if (carta.mover === 0) {
                // Ir a SALIDA
                this.movePlayerToken(player, 40 - player.position);
            } else {
                // Moverse hacia atrás
                const newPos = Math.max(0, player.position + carta.mover);
                this.movePlayerToken(player, carta.mover);
            }
        }

        this.mostrarMensaje(player, '🃏 Suerte', 
            `${carta.texto}${carta.dinero ? ` Tu dinero: $${player.dinero}` : ''}`);
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
    }

    /**
     * Envía un jugador a la cárcel
     */
    async enviarACarcel(player) {
        player.position = 10; // Posición de la cárcel
        player.estaEnCarcel = true;
        player.turnosEnCarcel = 0;

        // Mover ficha visualmente a la cárcel
        const tokenElement = document.querySelector(`[data-player-id="${player.id}"]`);
        const jailSquare = document.querySelector('[data-square-id="10"]');
        
        if (tokenElement && jailSquare) {
            const tokensContainer = jailSquare.querySelector('.player-tokens') || jailSquare;
            tokensContainer.appendChild(tokenElement);
            tokenElement.setAttribute('data-position', '10');
        }

        this.mostrarMensaje(player, '🚔 ¡A la Cárcel!', 
            'Has sido enviado a la cárcel. Pierdes turnos o puedes pagar para salir.');
    }

    /**
     * Maneja las acciones en la cárcel
     */
    async manejarCarcel(player) {
        if (player.estaEnCarcel) {
            player.turnosEnCarcel++;
            
            if (player.turnosEnCarcel >= 3) {
                // Salir automáticamente después de 3 turnos
                player.estaEnCarcel = false;
                player.turnosEnCarcel = 0;
                this.mostrarMensaje(player, '🔓 Libertad', 
                    'Has cumplido tu condena. ¡Eres libre!');
            } else {
                // Opción de pagar para salir
                const pagar = await this.mostrarConfirmacion(
                    '🔐 Cárcel',
                    `¿Pagar $50 para salir de la cárcel? (Turno ${player.turnosEnCarcel}/3)`,
                    player
                );

                if (pagar && player.dinero >= 50) {
                    player.dinero -= 50;
                    player.estaEnCarcel = false;
                    player.turnosEnCarcel = 0;
                    this.mostrarMensaje(player, '💰 Libertad Pagada', 
                        `Pagaste $50 para salir de la cárcel. Tu dinero: $${player.dinero}`);
                } else {
                    this.mostrarMensaje(player, '🔒 Sigues en la Cárcel', 
                        `Permaneces en la cárcel. Turno ${player.turnosEnCarcel}/3`);
                }
            }
        }
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
        return new Promise((resolve) => {
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
                    alert('⚠️ Primero debes configurar jugadores desde el menú principal (index.html)');
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
                if (currentPlayer) {
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
                if (currentPlayer) {
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
        
        // Actualizar estado inicial de los botones
        this.actualizarEstadoBotones();
    }

    /**
     * Actualiza el estado (habilitado/deshabilitado) de los botones según el contexto
     */
    actualizarEstadoBotones() {
        console.log('🔄 actualizarEstadoBotones() llamado - Estado:', {
            gameStarted: this.gameStarted,
            jugadores: this.players.length,
            turnoActual: this.currentPlayerIndex
        });
        
        if (!this.players.length || !this.gameStarted) {
            console.log('❌ No hay jugadores o juego no iniciado, deshabilitando todos los botones');
            this.deshabilitarTodosBotones();
            return;
        }

        const currentPlayer = this.players[this.currentPlayerIndex];
        if (!currentPlayer) return;

        const position = currentPlayer.position || 0;
        const square = this.board.squares[position];
        if (!square) return;

        // Resetear todos los botones primero
        this.deshabilitarTodosBotones();

        // Habilitar botón de dados si no está en cárcel o ya lanzó
        const btnLanzarDados = document.getElementById('btnLanzarDados');
        if (btnLanzarDados) {
            btnLanzarDados.disabled = currentPlayer.estaEnCarcel && currentPlayer.turnosEnCarcel <= 0;
        }

        // Comprobar si el jugador es dueño de la propiedad actual
        const propiedad = currentPlayer.propiedades?.find(p => p.id === square.id);
        const esPropiedad = ['property', 'railroad', 'utility'].includes(square.type);
        const propiedadDisponible = esPropiedad && !this.players.some(p => p.propiedades?.some(prop => prop.id === square.id));
        const hayPropietario = esPropiedad && this.players.find(p => p.propiedades?.some(prop => prop.id === square.id));

        // Botón Comprar Propiedad
        const btnComprarPropiedad = document.getElementById('btnComprarPropiedad');
        if (btnComprarPropiedad) {
            btnComprarPropiedad.disabled = !propiedadDisponible || currentPlayer.dinero < (square.price || 100);
        }

        // Botón Pagar Renta - Solo si hay propietario que no sea el jugador actual y la propiedad NO está hipotecada
        const btnPagarRenta = document.getElementById('btnPagarRenta');
        if (btnPagarRenta) {
            const propietario = hayPropietario;
            const propiedadHipotecada = propietario && propietario.propiedades?.find(p => p.id === square.id)?.hipotecada;
            btnPagarRenta.disabled = !hayPropietario || hayPropietario.id === currentPlayer.id || propiedadHipotecada;
        }

        // Botones de construcción - No se puede construir en propiedades hipotecadas
        const btnConstruirCasa = document.getElementById('btnConstruirCasa');
        const btnConstruirHotel = document.getElementById('btnConstruirHotel');
        if (btnConstruirCasa && btnConstruirHotel) {
            const puedeContruirCasa = propiedad && propiedad.casas < 4 && !propiedad.hotel && !propiedad.hipotecada;
            const puedeContruirHotel = propiedad && propiedad.casas === 4 && !propiedad.hotel && !propiedad.hipotecada;
            
            btnConstruirCasa.disabled = !puedeContruirCasa;
            btnConstruirHotel.disabled = !puedeContruirHotel;
        }

        // Botones de hipoteca
        const btnHipotecar = document.getElementById('btnHipotecar');
        const btnDeshipotecar = document.getElementById('btnDeshipotecar');
        if (btnHipotecar && btnDeshipotecar) {
            const valorHipoteca = square.mortgage || Math.floor(square.price / 2);
            const costoDeshipoteca = Math.floor(valorHipoteca * 1.1);
            
            // Puede hipotecar si: es su propiedad, no está hipotecada y no tiene construcciones
            btnHipotecar.disabled = !propiedad || propiedad.hipotecada || (propiedad.casas > 0 || propiedad.hotel);
            
            // Puede deshipotecar si: es su propiedad, está hipotecada y tiene dinero suficiente  
            btnDeshipotecar.disabled = !propiedad || !propiedad.hipotecada || currentPlayer.dinero < costoDeshipoteca;
        }

        // Botones de cartas
        const btnCartaSorpresa = document.getElementById('btnCartaSorpresa');
        const btnCajaComunidad = document.getElementById('btnCajaComunidad');
        if (btnCartaSorpresa) {
            btnCartaSorpresa.disabled = square.type !== 'chance';
        }
        if (btnCajaComunidad) {
            btnCajaComunidad.disabled = square.type !== 'community_chest';
        }

        // Botón de impuestos
        const btnPagarImpuesto = document.getElementById('btnPagarImpuesto');
        if (btnPagarImpuesto) {
            btnPagarImpuesto.disabled = square.type !== 'tax';
        }

        // Botón de cárcel
        const btnIrCarcel = document.getElementById('btnIrCarcel');
        if (btnIrCarcel) {
            if (currentPlayer.estaEnCarcel) {
                btnIrCarcel.textContent = '🔓 Pagar Salida ($50)';
                btnIrCarcel.disabled = currentPlayer.dinero < 50;
            } else {
                btnIrCarcel.textContent = '👮 Ir a Cárcel (Debug)';
                btnIrCarcel.disabled = false;
            }
        }
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
            if (btn) btn.disabled = true;
        });
    }

    /**
     * Ejecuta la acción de comprar propiedad en la casilla actual
     */
    ejecutarAccionComprar() {
        const currentPlayer = this.players[this.currentPlayerIndex];
        if (!currentPlayer) {
            alert('⚠️ No hay jugador activo');
            return;
        }

        const position = currentPlayer.position || 0;
        const square = this.board.squares[position];
        
        if (!square) {
            alert('⚠️ No se puede determinar la casilla actual');
            return;
        }

        if (['property', 'railroad', 'utility'].includes(square.type)) {
            this.ofrecerCompraPropiedad(currentPlayer, square);
        } else {
            alert('⚠️ No puedes comprar esta casilla');
        }
    }

    /**
     * Ejecuta el pago de renta en la casilla actual
     */
    ejecutarAccionRenta() {
        const currentPlayer = this.players[this.currentPlayerIndex];
        if (!currentPlayer) {
            alert('⚠️ No hay jugador activo');
            return;
        }

        const position = currentPlayer.position || 0;
        const square = this.board.squares[position];
        const propietario = this.players.find(p => p.propiedades?.some(prop => prop.id === square.id));

        if (propietario && propietario.id !== currentPlayer.id) {
            this.pagarRenta(currentPlayer, propietario, square);
        } else {
            alert('⚠️ Esta propiedad no requiere pago de renta');
        }
    }

    /**
     * Ejecuta la construcción de una casa
     */
    ejecutarAccionConstruirCasa() {
        const currentPlayer = this.players[this.currentPlayerIndex];
        if (!currentPlayer) {
            alert('⚠️ No hay jugador activo');
            return;
        }

        const position = currentPlayer.position || 0;
        const square = this.board.squares[position];
        const propiedad = currentPlayer.propiedades?.find(p => p.id === square.id);

        if (propiedad && propiedad.casas < 4 && !propiedad.hotel) {
            this.ofrecerConstruccion(currentPlayer, square);
        } else {
            alert('⚠️ No puedes construir casas en esta propiedad');
        }
    }

    /**
     * Ejecuta la construcción de un hotel
     */
    ejecutarAccionConstruirHotel() {
        const currentPlayer = this.players[this.currentPlayerIndex];
        if (!currentPlayer) {
            alert('⚠️ No hay jugador activo');
            return;
        }

        const position = currentPlayer.position || 0;
        const square = this.board.squares[position];
        const propiedad = currentPlayer.propiedades?.find(p => p.id === square.id);

        if (propiedad && propiedad.casas === 4 && !propiedad.hotel) {
            this.ofrecerConstruccion(currentPlayer, square);
        } else {
            alert('⚠️ No puedes construir hotel en esta propiedad (necesitas 4 casas)');
        }
    }

    /**
     * Ejecuta la acción de hipotecar
     */
    ejecutarAccionHipotecar() {
        const currentPlayer = this.players[this.currentPlayerIndex];
        if (!currentPlayer) {
            alert('⚠️ No hay jugador activo');
            return;
        }

        const position = currentPlayer.position || 0;
        const square = this.board.squares[position];
        const propiedad = currentPlayer.propiedades?.find(p => p.id === square.id);

        if (propiedad && !propiedad.hipotecada) {
            // Verificar que no tenga construcciones
            if (propiedad.casas > 0 || propiedad.hotel) {
                alert('⚠️ No puedes hipotecar una propiedad con construcciones. Primero debes venderlas.');
                return;
            }
            this.hipotecarPropiedad(currentPlayer, propiedad, square);
        } else if (!propiedad) {
            alert('⚠️ Esta propiedad no te pertenece');
        } else {
            alert('⚠️ Esta propiedad ya está hipotecada');
        }
    }

    /**
     * Ejecuta la acción de deshipotecar
     */
    ejecutarAccionDeshipotecar() {
        const currentPlayer = this.players[this.currentPlayerIndex];
        if (!currentPlayer) {
            alert('⚠️ No hay jugador activo');
            return;
        }

        const position = currentPlayer.position || 0;
        const square = this.board.squares[position];
        const propiedad = currentPlayer.propiedades?.find(p => p.id === square.id);

        if (propiedad && propiedad.hipotecada) {
            const valorHipoteca = square.mortgage || Math.floor(square.price / 2);
            const costoDeshipoteca = Math.floor(valorHipoteca * 1.1);
            
            if (currentPlayer.dinero < costoDeshipoteca) {
                alert(`⚠️ No tienes suficiente dinero. Necesitas $${costoDeshipoteca} para deshipotecar esta propiedad.`);
                return;
            }
            this.deshipotecarPropiedad(currentPlayer, propiedad, square);
        } else if (!propiedad) {
            alert('⚠️ Esta propiedad no te pertenece');
        } else {
            alert('⚠️ Esta propiedad no está hipotecada');
        }
    }

    /**
     * Ejecuta el pago de impuestos
     */
    ejecutarAccionImpuesto() {
        const currentPlayer = this.players[this.currentPlayerIndex];
        if (!currentPlayer) {
            alert('⚠️ No hay jugador activo');
            return;
        }

        const position = currentPlayer.position || 0;
        const square = this.board.squares[position];

        if (square.type === 'tax') {
            this.manejarImpuesto(currentPlayer, square);
        } else {
            alert('⚠️ No hay impuestos que pagar en esta casilla');
        }
    }

    /**
     * Ejecuta acciones de cárcel
     */
    ejecutarAccionCarcel() {
        const currentPlayer = this.players[this.currentPlayerIndex];
        if (!currentPlayer) {
            alert('⚠️ No hay jugador activo');
            return;
        }

        if (currentPlayer.estaEnCarcel) {
            this.manejarCarcel(currentPlayer);
        } else {
            // Enviar a la cárcel manualmente (para pruebas)
            this.enviarACarcel(currentPlayer);
        }
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
            
            // Actualizar localStorage
            this.guardarEstadoJuego();
            
            console.log(`🔓 ${player.nickname} deshipotecó ${square.name} por $${costoDeshipoteca}`);
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

            alert(mensaje);
            
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
            alert('Error al finalizar el juego. Los datos se guardaron localmente.');
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
                    country_code: resultado.jugador.country_code || "co" // Por defecto Colombia
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
                    country_code: r.jugador.country_code || "co"
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
                    Ingresa los valores de los dados (1-6):
                </div>
            </div>
            
            <div style="display: flex; justify-content: center; align-items: center; gap: 10px; margin-bottom: 20px;">
                <input type="number" id="dado1Input" min="1" max="6" value="1" style="
                    width: 60px;
                    height: 40px;
                    text-align: center;
                    border: 2px solid ${this.colorToCSS(currentPlayer.color)};
                    border-radius: 8px;
                    font-size: 16px;
                    font-weight: bold;
                ">
                <span style="font-size: 20px; font-weight: bold;">+</span>
                <input type="number" id="dado2Input" min="1" max="6" value="1" style="
                    width: 60px;
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
            const dado1 = parseInt(document.getElementById('dado1Input').value);
            const dado2 = parseInt(document.getElementById('dado2Input').value);
            if (dado1 >= 1 && dado1 <= 6 && dado2 >= 1 && dado2 <= 6) {
                this.procesarLanzamiento(dado1, dado2, dado1 + dado2);
            } else {
                document.getElementById('resultadoDados').innerHTML = '<div style="color:red; font-weight:bold; margin:10px 0;">❌ Valores inválidos. Deben ser entre 1 y 6.</div>';
            }
        });
        
        document.getElementById('btnVolver').addEventListener('click', () => this.showDiceBox());
    }

    /**
     * Procesa el lanzamiento de dados y maneja el sistema de turnos
     */
    procesarLanzamiento(dado1, dado2, total) {
        const currentPlayer = this.players[this.currentPlayerIndex];
        
        console.log(`🎲 ${currentPlayer.nickname} lanzó: ${dado1} + ${dado2} = ${total}`);
        
        // Mostrar resultado con animación
        this.mostrarResultadoMejorado(dado1, dado2, total);
        
        // Mover el jugador
        this.movePlayerToken(currentPlayer, total);
        
        // Verificar dobles para turnos adicionales
        const esDoble = dado1 === dado2;
        
        setTimeout(() => {
            if (esDoble) {
                this.manejarDobles(currentPlayer, total);
            } else {
                this.siguienteTurno();
            }
        }, 2000); // Esperar 2 segundos antes del siguiente turno
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

/*

// Inicialización cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', async function() {
    await initializeGame();
    setupEventListeners();
});

/**
 * Inicializa el juego
 
async function initializeGame() {
    try {
        // Verificar que las clases necesarias estén disponibles
        if (typeof MonopolyBoard === 'undefined') {
            throw new Error('MonopolyBoard no está definido. Problema al cargar Board.js');
        }
        if (typeof BoardUtils === 'undefined') {
            throw new Error('BoardUtils no está definido. Problema al cargar BoardUtils.js');
        }
        if (typeof BoardRenderer === 'undefined') {
            throw new Error('BoardRenderer no está definido. Problema al cargar BoardRenderer.js');
        }
        
        log('Todas las clases cargadas correctamente');
        
        // Crear instancia del tablero con datos de prueba
        board = new MonopolyBoard.Board();
        
        // Generar datos de prueba inicialmente con 40 casillas
        await generateTestBoard(40);
        
        // Cargar jugadores del localStorage si existen
        const jugadoresData = localStorage.getItem('jugadores');
        const numJugadores = localStorage.getItem('numJugadores');
        
        if (jugadoresData && numJugadores) {
            const jugadores = JSON.parse(jugadoresData);
            log(`Cargando ${numJugadores} jugadores del menú inicial`);
            
            // Agregar cada jugador al tablero
            for (let i = 0; i < jugadores.length; i++) {
                const jugador = jugadores[i];
                addPlayerWithData(jugador.nickname, jugador.color, jugador.ficha, jugador.pais);
                log(`Jugador agregado: ${jugador.nickname} (${jugador.pais})`);
            }
            
            // Limpiar localStorage después de cargar
            localStorage.removeItem('jugadores');
            localStorage.removeItem('numJugadores');
        } else {
            log('No se encontraron datos de jugadores. Use el botón "Agregar Jugador" para comenzar.');
        }
        
        log('Juego inicializado correctamente');
    } catch (error) {
        console.error('Error al inicializar:', error);
        log('Error al inicializar el juego: ' + error.message);
    }
}

/**
 * Genera un tablero de prueba
 
async function generateTestBoard(totalSquares) {
    try {
        // Generar datos de prueba
        const testData = BoardUtils.generateTestBoardData(totalSquares, currentLanguage);
        
        // Validar datos
        const validation = BoardUtils.validateBoardData(testData);
        if (!validation.valid) {
            throw new Error(validation.error);
        }

        // Cargar datos en el tablero
        await board.initializeBoard(testData);

        // Limpiar renderer anterior si existe
        if (renderer) {
            renderer.destroy();
        }

        renderer = new BoardRenderer('boardContainer', {
            totalSquares: totalSquares,
            language: currentLanguage,
            boardSize: Math.min(800, window.innerWidth - 40),
            cornerSize: 100,
            sideSquareWidth: 70,
            sideSquareHeight: 100
        });

        // Renderizar el tablero con los datos del board
        const boardData = board.getBoardDisplayData();
        await renderer.renderBoard(boardData, totalSquares);

        // Actualizar info
        updateBoardInfo(totalSquares);
        
        log(`Tablero generado: ${totalSquares} casillas`);

    } catch (error) {
        console.error('Error generando tablero:', error);
        log('Error: ' + error.message);
    }
}

/**
 * Configura los event listeners
 
function setupEventListeners() {
    // Botones de generación
    document.getElementById('btnGenerate40').addEventListener('click', () => generateTestBoard(40));
    document.getElementById('btnGenerate28').addEventListener('click', () => generateTestBoard(28));
    document.getElementById('btnGenerate16').addEventListener('click', () => generateTestBoard(16));
    
    // Cambio de idioma
    document.getElementById('btnChangeLanguage').addEventListener('click', toggleLanguage);
    
    // Jugadores
    document.getElementById('btnAddPlayer').addEventListener('click', addPlayer);
    document.getElementById('btnReset').addEventListener('click', resetGame);
    
    // Dados
    document.getElementById('btnLanzarDados').addEventListener('click', lanzarDados);
    
    // Acciones de propiedades
    document.getElementById('btnComprarPropiedad').addEventListener('click', buyProperty);
    document.getElementById('btnPagarRenta').addEventListener('click', pagarRenta);
    document.getElementById('btnConstruirCasa').addEventListener('click', buildHouse);
    document.getElementById('btnConstruirHotel').addEventListener('click', construirHotel);
    document.getElementById('btnHipotecar').addEventListener('click', mortgageProperty);
    document.getElementById('btnDeshipotecar').addEventListener('click', deshipotecar);
    
    // Cartas
    document.getElementById('btnCartaSorpresa').addEventListener('click', cartaSorpresa);
    document.getElementById('btnCajaComunidad').addEventListener('click', cajaComunidad);
    
    // Otras acciones
    document.getElementById('btnPagarImpuesto').addEventListener('click', pagarImpuesto);
    document.getElementById('btnIrCarcel').addEventListener('click', irCarcel);
    
    // Controles del juego
    document.getElementById('btnRankingSidebar').addEventListener('click', verRanking);
    document.getElementById('btnFinalizarJuego').addEventListener('click', finalizarJuego);

    // Eventos del tablero
    document.getElementById('boardContainer').addEventListener('squareClick', handleSquareClick);
}

/**
 * Cambia el idioma del juego
 
function changeLanguage() {
    currentLanguage = currentLanguage === 'es' ? 'en' : 'es';
    const langButton = document.getElementById('btnChangeLanguage');
    langButton.textContent = currentLanguage === 'es' ? 'Cambiar Idioma (EN)' : 'Change Language (ES)';
    
    document.getElementById('currentLanguage').textContent = currentLanguage === 'es' ? 'Español' : 'English';
    
    // Regenerar tablero con nuevo idioma
    const currentTotal = parseInt(document.getElementById('totalSquares').textContent) || 40;
    generateTestBoard(currentTotal);
    
    log(`Idioma cambiado a: ${currentLanguage === 'es' ? 'Español' : 'English'}`);
}

/**
 * Agrega un jugador genérico
 
function addPlayer() {
    playerCounter++;
    const playerId = `player${playerCounter}`;
    const color = playerColors[(playerCounter - 1) % playerColors.length];
    
    const playerData = {
        id: playerId,
        name: `Jugador ${playerCounter}`,
        color: color,
        money: 1500,
        position: 0
    };

    if (renderer) {
        renderer.addPlayer(playerId, playerData);
        renderer.movePlayer(playerId, 0); // Empezar en GO
    }

    currentPlayer = playerId;
    updatePlayerCount();
    updatePlayerInfo(playerData);
    log(`${playerData.name} agregado al juego`);
}

/**
 * Agrega un jugador con datos específicos
 
function addPlayerWithData(nickname, color, ficha, pais) {
    playerCounter++;
    const playerId = `player${playerCounter}`;
    
    const playerData = {
        id: playerId,
        name: nickname,
        color: color,
        ficha: ficha,
        pais: pais,
        money: 1500,
        position: 0
    };

    if (renderer) {
        renderer.addPlayer(playerId, playerData);
        renderer.movePlayer(playerId, 0); // Empezar en GO
    }

    if (playerCounter === 1) {
        currentPlayer = playerId;
        updatePlayerInfo(playerData);
    }
    
    updatePlayerCount();
    return playerId;
}

/**
 * Resetea el juego
 
function resetGame() {
    if (renderer) {
        renderer.players.clear();
    }
    
    playerCounter = 0;
    currentPlayer = null;
    updatePlayerCount();
    updatePlayerInfo(null);
    
    // Regenerar tablero
    const currentTotal = parseInt(document.getElementById('totalSquares').textContent) || 40;
    generateTestBoard(currentTotal);
    
    log('Juego reseteado');
}

/**
 * Maneja clics en casillas del tablero
 
function handleSquareClick(event) {
    const { square, position } = event.detail;
    log(`Clic en: ${square.name} (Posición ${position})`);
    
    // Si hay jugador activo, mostrar información
    if (currentPlayer) {
        const player = renderer.players.get(currentPlayer);
        log(`${player.name} está en posición ${player.position}, clic en ${position}`);
    }
}

/**
 * Actualiza la información del tablero
 
function updateBoardInfo(totalSquares) {
    document.getElementById('totalSquares').textContent = totalSquares;
}

/**
 * Actualiza el contador de jugadores
 
function updatePlayerCount() {
    document.getElementById('playerCount').textContent = playerCounter;
}

/**
 * Actualiza la información del jugador actual
 
function updatePlayerInfo(playerData) {
    const playerInfoContainer = document.getElementById('playerInfo');
    if (!playerInfoContainer) return;
    
    if (playerData) {
        playerInfoContainer.innerHTML = `
            <h4>🎮 ${playerData.name}</h4>
            <div class="player-stats">
                <div class="stat-item">
                    <span class="stat-label">💰 Dinero:</span>
                    <span class="stat-value">$${playerData.money}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">📍 Posición:</span>
                    <span class="stat-value">${playerData.position}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">🎨 Color:</span>
                    <span class="stat-value">${playerData.color}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">🎲 Ficha:</span>
                    <span class="stat-value">${playerData.ficha || 'Estándar'}</span>
                </div>
            </div>
        `;
    } else {
        playerInfoContainer.innerHTML = `
            <h4>👤 Sin jugador activo</h4>
            <p>Agrega jugadores para comenzar</p>
        `;
    }
}

/**
 * Agrega un mensaje al log del juego
 
function log(message) {
    const gameLog = document.getElementById('gameLog');
    const timestamp = new Date().toLocaleTimeString();
    gameLog.innerHTML += `<p><span class="timestamp">[${timestamp}]</span> ${message}</p>`;
    gameLog.scrollTop = gameLog.scrollHeight;
}

// ===============================
// FUNCIONES DE ACCIONES DEL JUEGO
// ===============================

function lanzarDados() {
    const dado1 = Math.floor(Math.random() * 6) + 1;
    const dado2 = Math.floor(Math.random() * 6) + 1;
    const total = dado1 + dado2;
    
    document.getElementById('dados-resultado').textContent = `🎲${dado1} 🎲${dado2}`;
    log(`Dados lanzados: ${dado1} + ${dado2} = ${total}`);
    
    if (currentPlayer && renderer) {
        const player = renderer.players.get(currentPlayer);
        const newPosition = (player.position + total) % parseInt(document.getElementById('totalSquares').textContent);
        renderer.movePlayer(currentPlayer, newPosition);
        
        // Actualizar información del jugador
        player.position = newPosition;
        updatePlayerInfo(player);
        
        log(`${player.name} se mueve a la posición ${newPosition}`);
    }
}

function comprarPropiedad() {
    log('Función: Comprar Propiedad');
}

function pagarRenta() {
    log('Función: Pagar Renta');
}

function construirCasa() {
    log('Función: Construir Casa');
}

function construirHotel() {
    log('Función: Construir Hotel');
}

function hipotecarPropiedad() {
    log('Función: Hipotecar Propiedad');
}

function deshipotecarPropiedad() {
    log('Función: Deshipotecar Propiedad');
}

function tomarCartaSorpresa() {
    log('Función: Tomar Carta de Sorpresa');
}

function tomarCartaComunidad() {
    log('Función: Tomar Carta de Caja de Comunidad');
}

function pagarImpuesto() {
    log('Función: Pagar Impuesto');
}

function irCarcel() {
    log('Función: Ir a Cárcel / Pagar Salida');
}

function finalizarJuego() {
    if (confirm('¿Estás seguro de que quieres finalizar el juego?')) {
        log('Juego finalizado por el usuario');
        window.location.href = '../index.html';
    }
}

function verRanking() {
    log('Función: Ver Ranking Global');
}

// Nuevas funciones para los botones adicionales
function lanzarDados() {
    if (!currentPlayer || !renderer) {
        log('No hay jugador seleccionado');
        return;
    }

    // Simular tirada de dados (1-6 cada dado)
    const dado1 = Math.floor(Math.random() * 6) + 1;
    const dado2 = Math.floor(Math.random() * 6) + 1;
    const total = dado1 + dado2;
    
    // Actualizar UI de dados
    document.getElementById('dados-resultado').textContent = `🎲${dado1} 🎲${dado2}`;
    
    const player = renderer.players.get(currentPlayer);
    const newPosition = (player.position + total) % (parseInt(document.getElementById('totalSquares').textContent) || 40);
    
    renderer.movePlayer(currentPlayer, newPosition);
    log(`${player.name} tiró ${dado1} + ${dado2} = ${total} y se movió a la posición ${newPosition}`);
}

function pagarRenta() {
    if (!currentPlayer || !board) {
        log('No hay jugador seleccionado');
        return;
    }
    log('Función pagar renta - En desarrollo');
}

function construirHotel() {
    if (!currentPlayer || !board) {
        log('No hay jugador seleccionado');
        return;
    }
    log('Función construir hotel - En desarrollo');
}

function deshipotecar() {
    if (!currentPlayer || !board) {
        log('No hay jugador seleccionado');
        return;
    }
    log('Función deshipotecar - En desarrollo');
}

function cartaSorpresa() {
    if (!currentPlayer) {
        log('No hay jugador seleccionado');
        return;
    }
    
    const cartas = [
        'Avanza hasta "Salida"',
        'Ve a la cárcel directamente',
        'Cobra $200 por ser tu cumpleaños',
        'Paga $50 de multa por exceso de velocidad',
        'Avanza hasta la propiedad más cercana'
    ];
    
    const cartaAleatoria = cartas[Math.floor(Math.random() * cartas.length)];
    log(`Carta Sorpresa: ${cartaAleatoria}`);
}

function cajaComunidad() {
    if (!currentPlayer) {
        log('No hay jugador seleccionado');
        return;
    }
    
    const cartas = [
        'Error bancario a tu favor. Cobra $200',
        'Gastos médicos. Paga $50',
        'Multa por embriaguez. Paga $20',
        'Cobra tu herencia de $100',
        'Impuesto de lujo. Paga $75'
    ];
    
    const cartaAleatoria = cartas[Math.floor(Math.random() * cartas.length)];
    log(`Caja de Comunidad: ${cartaAleatoria}`);
}

function pagarImpuesto() {
    if (!currentPlayer) {
        log('No hay jugador seleccionado');
        return;
    }
    
    const player = renderer.players.get(currentPlayer);
    log(`${player.name} pagó impuestos de $100`);
}

function irCarcel() {
    if (!currentPlayer || !renderer) {
        log('No hay jugador seleccionado');
        return;
    }
    
    const player = renderer.players.get(currentPlayer);
    const carcelPosition = 10; // Posición típica de la cárcel en Monopoly
    
    renderer.movePlayer(currentPlayer, carcelPosition);
    log(`${player.name} fue enviado a la cárcel`);
}

function verRanking() {
    // Redirigir a la página de ranking
    window.location.href = 'ranking.html';
}

function finalizarJuego() {
    if (confirm('¿Estás seguro de que quieres finalizar el juego?')) {
        // Limpiar datos y redirigir al menú principal
        localStorage.clear();
        window.location.href = '../index.html';
    }
}

// Responsive design
window.addEventListener('resize', () => {
    if (renderer) {
        const currentTotal = parseInt(document.getElementById('totalSquares').textContent) || 40;
        generateTestBoard(currentTotal);
    }
});*/