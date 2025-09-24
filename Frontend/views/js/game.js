// game.js - Lógica principal del juego Monopoly

// Variables globales
let board = null;
let renderer = null;
let currentLanguage = 'es';
let playerCounter = 0;
let currentPlayer = null;
const playerColors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4'];

// Inicialización cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', async function() {
    await initializeGame();
    setupEventListeners();
});

/**
 * Inicializa el juego
 */
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
 */
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
 */
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
 */
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
 */
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
 */
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
 */
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
 */
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
 */
function updateBoardInfo(totalSquares) {
    document.getElementById('totalSquares').textContent = totalSquares;
}

/**
 * Actualiza el contador de jugadores
 */
function updatePlayerCount() {
    document.getElementById('playerCount').textContent = playerCounter;
}

/**
 * Actualiza la información del jugador actual
 */
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
 */
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
});