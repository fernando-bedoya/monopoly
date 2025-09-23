/**
 * Clase Board - Maneja el tablero completo del Monopoly
 * Gestiona las casillas, cartas y operaciones generales del tablero
 */
class Board {
    constructor() {
        this.casillas = new Map(); // Map para acceso O(1) por ID
        this.casillasList = []; // Array ordenado para navegación secuencial
        this.totalCasillas = 0;
        
        // Cartas del juego
        this.communityChestCards = [];
        this.chanceCards = [];
        
        // Índices para barajear cartas
        this.communityChestIndex = 0;
        this.chanceIndex = 0;
        
        // Configuración del tablero
        this.boardLayout = {
            bottom: [],
            left: [],
            top: [],
            right: []
        };
        
        // Grupos de propiedades por color para verificar monopolios
        this.colorGroups = new Map();
        
        // Estadísticas del juego
        this.gameStats = {
            totalTransactions: 0,
            totalRentPaid: 0,
            propertiesSold: 0,
            housesBuilt: 0,
            hotelsBuilt: 0
        };
    }

    /**
     * Inicializa el tablero con datos del backend
     * @param {Object} boardData - Datos del endpoint /board
     */
    async initializeBoard(boardData) {
        try {
            // Limpiar datos anteriores
            this.reset();
            
            // Procesar casillas por sección del tablero
            this.processBoardSection('bottom', boardData.bottom || []);
            this.processBoardSection('left', boardData.left || []);
            this.processBoardSection('top', boardData.top || []);
            this.processBoardSection('right', boardData.right || []);
            
            // Crear lista ordenada de casillas
            this.createOrderedList();
            
            // Procesar cartas
            this.communityChestCards = boardData.community_chest || [];
            this.chanceCards = boardData.chance || [];
            
            // Barajear cartas
            this.shuffleCards();
            
            // Crear grupos de colores
            this.createColorGroups();
            
            console.log(`Tablero inicializado: ${this.totalCasillas} casillas`);
            
        } catch (error) {
            console.error('Error inicializando tablero:', error);
            throw new Error('No se pudo inicializar el tablero');
        }
    }

    /**
     * Procesa una sección del tablero (bottom, left, top, right)
     * @param {string} section - Nombre de la sección
     * @param {Array} casillasData - Datos de casillas de la sección
     */
    processBoardSection(section, casillasData) {
        this.boardLayout[section] = [];
        
        casillasData.forEach(casillaData => {
            const casilla = new Casilla(casillaData);
            this.casillas.set(casilla.id, casilla);
            this.boardLayout[section].push(casilla.id);
            this.totalCasillas++;
        });
    }

    /**
     * Crea la lista ordenada de casillas para navegación secuencial
     */
    createOrderedList() {
        this.casillasList = [
            ...this.boardLayout.bottom,
            ...this.boardLayout.left,
            ...this.boardLayout.top,
            ...this.boardLayout.right.reverse() // Right va en orden inverso
        ];
    }

    /**
     * Crea grupos de propiedades por color
     */
    createColorGroups() {
        this.colorGroups.clear();
        
        this.casillas.forEach(casilla => {
            if (casilla.type === 'property' && casilla.color) {
                if (!this.colorGroups.has(casilla.color)) {
                    this.colorGroups.set(casilla.color, []);
                }
                this.colorGroups.get(casilla.color).push(casilla.id);
            }
        });
    }

    /**
     * Baraja las cartas de comunidad y sorpresa
     */
    shuffleCards() {
        this.communityChestCards = this.shuffleArray([...this.communityChestCards]);
        this.chanceCards = this.shuffleArray([...this.chanceCards]);
        this.communityChestIndex = 0;
        this.chanceIndex = 0;
    }

    /**
     * Algoritmo Fisher-Yates para barajear arrays
     * @param {Array} array - Array a barajear
     * @returns {Array} - Array barajeado
     */
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    /**
     * Obtiene una casilla por ID
     * @param {number} id - ID de la casilla
     * @returns {Casilla|null}
     */
    getCasilla(id) {
        return this.casillas.get(id) || null;
    }

    /**
     * Calcula la nueva posición después de avanzar
     * @param {number} currentPosition - Posición actual
     * @param {number} steps - Pasos a avanzar
     * @returns {Object} - {newPosition, passedGo}
     */
    calculateNewPosition(currentPosition, steps) {
        const currentIndex = this.casillasList.indexOf(currentPosition);
        if (currentIndex === -1) {
            throw new Error(`Posición actual inválida: ${currentPosition}`);
        }
        
        const newIndex = (currentIndex + steps) % this.totalCasillas;
        const newPosition = this.casillasList[newIndex];
        const passedGo = (currentIndex + steps) >= this.totalCasillas;
        
        return { newPosition, passedGo };
    }

    /**
     * Mueve un jugador en el tablero
     * @param {string|number} playerId - ID del jugador
     * @param {number} fromPosition - Posición actual
     * @param {number} toPosition - Nueva posición
     */
    movePlayer(playerId, fromPosition, toPosition) {
        // Remover jugador de la posición anterior
        if (fromPosition !== null) {
            const fromCasilla = this.getCasilla(fromPosition);
            if (fromCasilla) {
                fromCasilla.removePlayer(playerId);
            }
        }
        
        // Agregar jugador a la nueva posición
        const toCasilla = this.getCasilla(toPosition);
        if (toCasilla) {
            toCasilla.addPlayer(playerId);
        }
    }

    /**
     * Verifica si un jugador tiene monopolio de un color
     * @param {string|number} playerId - ID del jugador
     * @param {string} color - Color a verificar
     * @returns {boolean}
     */
    hasMonopoly(playerId, color) {
        const colorGroup = this.colorGroups.get(color);
        if (!colorGroup) return false;
        
        return colorGroup.every(casillaId => {
            const casilla = this.getCasilla(casillaId);
            return casilla && casilla.owner === playerId;
        });
    }

    /**
     * Cuenta cuántos ferrocarriles posee un jugador
     * @param {string|number} playerId - ID del jugador
     * @returns {number}
     */
    countPlayerRailroads(playerId) {
        let count = 0;
        this.casillas.forEach(casilla => {
            if (casilla.type === 'railroad' && casilla.owner === playerId) {
                count++;
            }
        });
        return count;
    }

    /**
     * Obtiene las propiedades de un jugador
     * @param {string|number} playerId - ID del jugador
     * @returns {Array<Casilla>}
     */
    getPlayerProperties(playerId) {
        const properties = [];
        this.casillas.forEach(casilla => {
            if ((casilla.type === 'property' || casilla.type === 'railroad') && 
                casilla.owner === playerId) {
                properties.push(casilla);
            }
        });
        return properties;
    }

    /**
     * Verifica si un jugador puede construir en una propiedad
     * @param {string|number} playerId - ID del jugador
     * @param {number} casillaId - ID de la casilla
     * @returns {boolean}
     */
    canPlayerBuild(playerId, casillaId) {
        const casilla = this.getCasilla(casillaId);
        if (!casilla || casilla.owner !== playerId) return false;
        
        // Solo se puede construir en propiedades
        if (casilla.type !== 'property') return false;
        
        // Debe tener monopolio del color
        if (!this.hasMonopoly(playerId, casilla.color)) return false;
        
        return casilla.canBuild() || casilla.canBuildHotel();
    }

    /**
     * Obtiene una carta de comunidad
     * @returns {Object|null}
     */
    drawCommunityChestCard() {
        if (this.communityChestCards.length === 0) return null;
        
        const card = this.communityChestCards[this.communityChestIndex];
        this.communityChestIndex = (this.communityChestIndex + 1) % this.communityChestCards.length;
        
        return card;
    }

    /**
     * Obtiene una carta de sorpresa
     * @returns {Object|null}
     */
    drawChanceCard() {
        if (this.chanceCards.length === 0) return null;
        
        const card = this.chanceCards[this.chanceIndex];
        this.chanceIndex = (this.chanceIndex + 1) % this.chanceCards.length;
        
        return card;
    }

    /**
     * Calcula el patrimonio total de un jugador
     * @param {string|number} playerId - ID del jugador
     * @param {number} playerMoney - Dinero del jugador
     * @returns {number}
     */
    calculatePlayerNetWorth(playerId, playerMoney) {
        let netWorth = playerMoney;
        
        this.casillas.forEach(casilla => {
            if (casilla.owner === playerId) {
                netWorth += casilla.getTotalValue();
            }
        });
        
        return netWorth;
    }

    /**
     * Obtiene estadísticas del juego
     * @returns {Object}
     */
    getGameStats() {
        let ownedProperties = 0;
        let mortgagedProperties = 0;
        let totalHouses = 0;
        let totalHotels = 0;
        
        this.casillas.forEach(casilla => {
            if (casilla.owner) {
                ownedProperties++;
                if (casilla.mortgaged) mortgagedProperties++;
                if (casilla.type === 'property') {
                    totalHouses += casilla.houses;
                    if (casilla.hotel) totalHotels++;
                }
            }
        });
        
        return {
            ...this.gameStats,
            ownedProperties,
            mortgagedProperties,
            totalHouses,
            totalHotels,
            availableProperties: this.totalCasillas - ownedProperties
        };
    }

    /**
     * Obtiene información para renderizar el tablero
     * @returns {Object}
     */
    getBoardDisplayData() {
        const displayData = {
            bottom: [],
            left: [],
            top: [],
            right: []
        };
        
        Object.keys(this.boardLayout).forEach(section => {
            displayData[section] = this.boardLayout[section].map(casillaId => {
                const casilla = this.getCasilla(casillaId);
                return casilla ? casilla.getDisplayInfo() : null;
            }).filter(info => info !== null);
        });
        
        return displayData;
    }

    /**
     * Actualiza estadísticas del juego
     * @param {string} stat - Tipo de estadística
     * @param {number} value - Valor a sumar (opcional)
     */
    updateStats(stat, value = 1) {
        if (this.gameStats.hasOwnProperty(stat)) {
            this.gameStats[stat] += value;
        }
    }

    /**
     * Resetea el tablero para una nueva partida
     */
    reset() {
        this.casillas.clear();
        this.casillasList = [];
        this.totalCasillas = 0;
        this.boardLayout = { bottom: [], left: [], top: [], right: [] };
        this.colorGroups.clear();
        this.communityChestCards = [];
        this.chanceCards = [];
        this.communityChestIndex = 0;
        this.chanceIndex = 0;
        this.gameStats = {
            totalTransactions: 0,
            totalRentPaid: 0,
            propertiesSold: 0,
            housesBuilt: 0,
            hotelsBuilt: 0
        };
    }

    /**
     * Obtiene información completa del tablero (para debugging)
     * @returns {Object}
     */
    getFullBoardInfo() {
        return {
            totalCasillas: this.totalCasillas,
            colorGroups: Object.fromEntries(this.colorGroups),
            communityChestCardsCount: this.communityChestCards.length,
            chanceCardsCount: this.chanceCards.length,
            stats: this.getGameStats(),
            casillas: Array.from(this.casillas.values()).map(c => c.getFullInfo())
        };
    }

    /**
     * Valida la integridad del tablero
     * @returns {boolean}
     */
    validateBoard() {
        // Verificar que todas las casillas estén conectadas
        if (this.casillasList.length !== this.totalCasillas) return false;
        
        // Verificar que no haya IDs duplicados
        const ids = new Set(this.casillasList);
        if (ids.size !== this.totalCasillas) return false;
        
        // Verificar que todas las casillas existan
        return this.casillasList.every(id => this.casillas.has(id));
    }
}