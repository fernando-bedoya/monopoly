/**
 * Modelo de Casilla del Tablero de Monopoly
 */
class Square {
    constructor(data) {
        this.id = data.id;
        this.name = data.name;
        this.type = data.type;
        this.color = data.color || null;
        this.price = data.price || 0;
        this.mortgage = data.mortgage || 0;
        this.rent = data.rent || null;
        this.action = data.action || null;
        
        // Estados dinámicos de la casilla
        this.owner = null;
        this.houses = 0;
        this.hasHotel = false;
        this.isMortgaged = false;
    }

    /**
     * Verifica si la casilla es una propiedad
     */
    isProperty() {
        return this.type === 'property';
    }

    /**
     * Verifica si la casilla es un ferrocarril
     */
    isRailroad() {
        return this.type === 'railroad';
    }

    /**
     * Verifica si la casilla es una utilidad (aunque no aparece en el JSON actual)
     */
    isUtility() {
        return this.type === 'utility';
    }

    /**
     * Verifica si la casilla es especial (Salida, Cárcel, etc.)
     */
    isSpecial() {
        return this.type === 'special';
    }

    /**
     * Verifica si la casilla es de cartas (Sorpresa o Caja de Comunidad)
     */
    isCard() {
        return this.type === 'chance' || this.type === 'community_chest';
    }

    /**
     * Verifica si la casilla es de impuestos
     */
    isTax() {
        return this.type === 'tax';
    }

    /**
     * Obtiene la renta actual de la propiedad según su estado
     */
    getCurrentRent() {
        if (!this.isProperty() && !this.isRailroad()) return 0;
        if (this.isMortgaged) return 0;

        if (this.isProperty()) {
            if (this.hasHotel) {
                return this.rent.withHotel;
            } else if (this.houses > 0) {
                return this.rent.withHouse[this.houses - 1];
            } else {
                return this.rent.base;
            }
        }

        if (this.isRailroad()) {
            // La renta del ferrocarril depende de cuántos ferrocarriles tenga el dueño
            // Esto se calculará en la lógica del juego
            return this.rent;
        }

        return 0;
    }

    /**
     * Verifica si se puede construir en esta propiedad
     */
    canBuild() {
        return this.isProperty() && 
               this.owner !== null && 
               !this.isMortgaged && 
               !this.hasHotel && 
               this.houses < 4;
    }

    /**
     * Verifica si se puede construir un hotel
     */
    canBuildHotel() {
        return this.isProperty() && 
               this.owner !== null && 
               !this.isMortgaged && 
               this.houses === 4 && 
               !this.hasHotel;
    }

    /**
     * Agrega una casa a la propiedad
     */
    addHouse() {
        if (this.canBuild()) {
            this.houses++;
            return true;
        }
        return false;
    }

    /**
     * Construye un hotel (reemplaza las 4 casas)
     */
    buildHotel() {
        if (this.canBuildHotel()) {
            this.houses = 0;
            this.hasHotel = true;
            return true;
        }
        return false;
    }

    /**
     * Hipoteca la propiedad
     */
    mortgageProperty() {
        if ((this.isProperty() || this.isRailroad()) && 
            this.owner !== null && 
            !this.isMortgaged &&
            this.houses === 0 && 
            !this.hasHotel) {
            this.isMortgaged = true;
            return this.mortgage;
        }
        return 0;
    }

    /**
     * Deshipoteca la propiedad (incluye el 10% de interés)
     */
    unmortgageProperty() {
        if (this.isMortgaged) {
            this.isMortgaged = false;
            return Math.floor(this.mortgage * 1.1); // 10% de interés
        }
        return 0;
    }

    /**
     * Obtiene el valor total de la propiedad (para cálculo final)
     */
    getTotalValue() {
        if (!this.isProperty() && !this.isRailroad()) return 0;
        if (this.isMortgaged) return -this.mortgage; // Deuda por hipoteca

        let value = this.price;
        
        if (this.isProperty()) {
            value += this.houses * 100; // Cada casa vale 100
            if (this.hasHotel) {
                value += 200; // Hotel vale 200 adicionales (según PDF)
            }
        }

        return value;
    }

    /**
     * Resetea la casilla a su estado inicial
     */
    reset() {
        this.owner = null;
        this.houses = 0;
        this.hasHotel = false;
        this.isMortgaged = false;
    }
}

/**
 * Modelo del Tablero de Monopoly
 */
class Board {
    constructor() {
        this.squares = new Map(); // Mapa de casillas por ID
        this.squaresByPosition = []; // Array ordenado de casillas por posición
        this.propertiesByColor = new Map(); // Agrupación por color
        this.railroads = []; // Lista de ferrocarriles
        this.specialSquares = new Map(); // Casillas especiales
        this.cardSquares = []; // Casillas de cartas
        this.taxSquares = []; // Casillas de impuestos
    }

    /**
     * Inicializa el tablero con los datos del backend
     */
    async initialize() {
        try {
            const response = await fetch('http://127.0.0.1:5000/board');
            const boardData = await response.json();
            
            this.loadSquares(boardData);
            this.organizeSquares();
            
            return true;
        } catch (error) {
            console.error('Error al cargar el tablero:', error);
            return false;
        }
    }

    /**
     * Carga todas las casillas desde los datos del backend
     */
    loadSquares(boardData) {
        // Cargar casillas de cada lado del tablero
        const sides = ['bottom', 'left', 'top', 'right'];
        let position = 0;

        sides.forEach(side => {
            if (boardData[side]) {
                boardData[side].forEach(squareData => {
                    const square = new Square(squareData);
                    this.squares.set(square.id, square);
                    this.squaresByPosition[position] = square;
                    position++;
                });
            }
        });
    }

    /**
     * Organiza las casillas por tipo para acceso rápido
     */
    organizeSquares() {
        this.squares.forEach(square => {
            // Agrupar propiedades por color
            if (square.isProperty() && square.color) {
                if (!this.propertiesByColor.has(square.color)) {
                    this.propertiesByColor.set(square.color, []);
                }
                this.propertiesByColor.get(square.color).push(square);
            }

            // Agrupar ferrocarriles
            if (square.isRailroad()) {
                this.railroads.push(square);
            }

            // Casillas especiales
            if (square.isSpecial()) {
                this.specialSquares.set(square.name.toLowerCase(), square);
            }

            // Casillas de cartas
            if (square.isCard()) {
                this.cardSquares.push(square);
            }

            // Casillas de impuestos
            if (square.isTax()) {
                this.taxSquares.push(square);
            }
        });
    }

    /**
     * Obtiene una casilla por su ID
     */
    getSquare(id) {
        return this.squares.get(id);
    }

    /**
     * Obtiene una casilla por su posición en el tablero
     */
    getSquareByPosition(position) {
        return this.squaresByPosition[position % this.getTotalSquares()];
    }

    /**
     * Obtiene el número total de casillas
     */
    getTotalSquares() {
        return this.squaresByPosition.length;
    }

    /**
     * Obtiene todas las propiedades de un color específico
     */
    getPropertiesByColor(color) {
        return this.propertiesByColor.get(color) || [];
    }

    /**
     * Verifica si un jugador tiene el monopolio de un color
     */
    hasMonopoly(playerId, color) {
        const properties = this.getPropertiesByColor(color);
        return properties.length > 0 && 
               properties.every(property => property.owner === playerId);
    }

    /**
     * Obtiene todos los ferrocarriles de un jugador
     */
    getPlayerRailroads(playerId) {
        return this.railroads.filter(railroad => railroad.owner === playerId);
    }

    /**
     * Obtiene la renta de un ferrocarril según cuántos tenga el dueño
     */
    getRailroadRent(railroadId, playerId) {
        const railroad = this.getSquare(railroadId);
        if (!railroad || !railroad.isRailroad() || railroad.owner !== playerId) {
            return 0;
        }

        const playerRailroads = this.getPlayerRailroads(playerId);
        const count = playerRailroads.length;
        
        return railroad.rent[count.toString()] || 0;
    }

    /**
     * Calcula el valor total de las propiedades de un jugador
     */
    getPlayerTotalValue(playerId) {
        let total = 0;
        
        this.squares.forEach(square => {
            if (square.owner === playerId) {
                total += square.getTotalValue();
            }
        });

        return total;
    }

    /**
     * Obtiene todas las propiedades de un jugador
     */
    getPlayerProperties(playerId) {
        const properties = [];
        
        this.squares.forEach(square => {
            if (square.owner === playerId && 
                (square.isProperty() || square.isRailroad())) {
                properties.push(square);
            }
        });

        return properties;
    }

    /**
     * Verifica si una propiedad puede ser construida (tiene monopolio)
     */
    canBuildOnProperty(propertyId, playerId) {
        const property = this.getSquare(propertyId);
        if (!property || !property.isProperty() || property.owner !== playerId) {
            return false;
        }

        return this.hasMonopoly(playerId, property.color) && property.canBuild();
    }

    /**
     * Resetea el tablero a su estado inicial
     */
    reset() {
        this.squares.forEach(square => square.reset());
    }

    /**
     * Obtiene información del tablero para renderizado
     */
    getBoardLayout() {
        return {
            totalSquares: this.getTotalSquares(),
            squares: Array.from(this.squares.values()),
            squaresByPosition: this.squaresByPosition,
            propertiesByColor: Object.fromEntries(this.propertiesByColor),
            railroads: this.railroads,
            specialSquares: Object.fromEntries(this.specialSquares)
        };
    }
}

// Exportar las clases para uso en otros archivos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Square, Board };
} else if (typeof window !== 'undefined') {
    window.MonopolyBoard = { Square, Board };
}