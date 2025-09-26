/**
 * Modelo de Casilla del Tablero de Monopoly
 */
import Square from '../models/Square.js';
/**
 * Modelo del Tablero de Monopoly
 */
class Board {
     constructor() {
        this.squares = new Map();           // Mapa de casillas por ID
        this.squaresByPosition = [];        // Array ordenado de casillas por posición
        this.propertiesByColor = new Map(); // Agrupación por color
        this.railroads = [];                // Lista de ferrocarriles
        this.specialSquares = new Map();    // Casillas especiales
        this.cardSquares = [];              // Casillas de cartas
        this.taxSquares = [];               // Casillas de impuestos
    }

    /**
     * Inicializa el tablero con los datos del backend
     */
    async initialize() {
        try {
            const response = await fetch('http://127.0.0.1:5000/board');
            const boardData = await response.json();
            
            this.loadSquares(boardData);   // 🔹 Carga instancias de Square
            this.organizeSquares();        // 🔹 Las clasifica por tipo
            
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
        const sides = ['bottom', 'left', 'top', 'right'];
        let position = 0;

        sides.forEach(side => {
            if (boardData[side]) {
                boardData[side].forEach(squareData => {
                    // 🔹 Crear instancia de Square
                    const square = new Square(squareData);

                    // Guardar en estructuras
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
            if (square.isProperty() && square.color) {
                if (!this.propertiesByColor.has(square.color)) {
                    this.propertiesByColor.set(square.color, []);
                }
                this.propertiesByColor.get(square.color).push(square);
            }

            if (square.isRailroad()) {
                this.railroads.push(square);
            }

            if (square.isSpecial()) {
                this.specialSquares.set(square.name.toLowerCase(), square);
            }

            if (square.isCard()) {
                this.cardSquares.push(square);
            }

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
export default Board;
