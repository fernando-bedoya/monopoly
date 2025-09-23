/**
 * Clase Casilla - Representa una casilla individual del tablero de Monopoly
 * Maneja todos los tipos de casillas: propiedades, especiales, impuestos, ferrocarriles, etc.
 */
class Casilla {
    constructor(data) {
        // Propiedades básicas de toda casilla
        this.id = data.id;
        this.name = data.name;
        this.type = data.type;
        
        // Propiedades específicas según el tipo
        this.initializeCasillaType(data);
        
        // Estado de la casilla durante el juego
        this.owner = null; // ID del jugador propietario
        this.houses = 0; // Número de casas (0-4)
        this.hotel = false; // Si tiene hotel
        this.mortgaged = false; // Si está hipotecada
        this.playersOnSquare = []; // Jugadores actualmente en esta casilla
    }

    /**
     * Inicializa las propiedades específicas según el tipo de casilla
     * @param {Object} data - Datos de la casilla del JSON
     */
    initializeCasillaType(data) {
        switch (this.type) {
            case 'property':
                this.color = data.color;
                this.price = data.price;
                this.mortgage = data.mortgage;
                this.rent = { ...data.rent }; // Copia del objeto rent
                break;
                
            case 'railroad':
                this.price = data.price;
                this.mortgage = data.mortgage;
                this.rent = { ...data.rent };
                break;
                
            case 'tax':
                this.action = { ...data.action };
                break;
                
            case 'special':
                if (data.action) {
                    this.action = { ...data.action };
                }
                break;
                
            case 'community_chest':
            case 'chance':
                // Estas casillas no necesitan propiedades adicionales
                // Las cartas se manejarán en el Board
                break;
        }
    }

    /**
     * Verifica si la casilla es comprable
     * @returns {boolean}
     */
    isComprable() {
        return (this.type === 'property' || this.type === 'railroad') && !this.owner;
    }

    /**
     * Verifica si la casilla genera renta
     * @returns {boolean}
     */
    generatesRent() {
        return (this.type === 'property' || this.type === 'railroad') && 
               this.owner && !this.mortgaged;
    }

    /**
     * Calcula la renta actual de la casilla
     * @param {number} railroadCount - Número de ferrocarriles que posee el propietario (solo para railroads)
     * @param {boolean} hasMonopoly - Si el propietario tiene monopolio del color (solo para properties)
     * @returns {number}
     */
    calculateRent(railroadCount = 0, hasMonopoly = false) {
        if (!this.generatesRent()) return 0;

        if (this.type === 'railroad') {
            return this.rent[railroadCount.toString()] || 0;
        }

        if (this.type === 'property') {
            if (this.hotel) {
                return this.rent.withHotel;
            }
            
            if (this.houses > 0) {
                return this.rent.withHouse[this.houses - 1] || 0;
            }
            
            // Si tiene monopolio y no hay construcciones, la renta base se duplica
            return hasMonopoly ? this.rent.base * 2 : this.rent.base;
        }

        return 0;
    }

    /**
     * Verifica si se puede construir en la casilla
     * @returns {boolean}
     */
    canBuild() {
        return this.type === 'property' && 
               this.owner && 
               !this.mortgaged && 
               !this.hotel && 
               this.houses < 4;
    }

    /**
     * Verifica si se puede construir un hotel
     * @returns {boolean}
     */
    canBuildHotel() {
        return this.type === 'property' && 
               this.owner && 
               !this.mortgaged && 
               !this.hotel && 
               this.houses === 4;
    }

    /**
     * Construye una casa en la propiedad
     * @returns {boolean} - true si se pudo construir
     */
    buildHouse() {
        if (this.canBuild()) {
            this.houses++;
            return true;
        }
        return false;
    }

    /**
     * Construye un hotel en la propiedad
     * @returns {boolean} - true si se pudo construir
     */
    buildHotel() {
        if (this.canBuildHotel()) {
            this.houses = 0; // Las casas se reemplazan por el hotel
            this.hotel = true;
            return true;
        }
        return false;
    }

    /**
     * Establece el propietario de la casilla
     * @param {string|number} playerId - ID del jugador
     */
    setOwner(playerId) {
        if (this.isComprable()) {
            this.owner = playerId;
        }
    }

    /**
     * Hipoteca la propiedad
     * @returns {number} - Dinero recibido por la hipoteca
     */
    mortgageProperty() {
        if ((this.type === 'property' || this.type === 'railroad') && 
            this.owner && !this.mortgaged && this.houses === 0 && !this.hotel) {
            this.mortgaged = true;
            return this.mortgage;
        }
        return 0;
    }

    /**
     * Deshipoteca la propiedad
     * @returns {number} - Costo de deshipotecar (mortgage + 10%)
     */
    unmortgageProperty() {
        if (this.mortgaged) {
            this.mortgaged = false;
            return Math.round(this.mortgage * 1.1); // Mortgage + 10%
        }
        return 0;
    }

    /**
     * Agrega un jugador a la casilla
     * @param {string|number} playerId - ID del jugador
     */
    addPlayer(playerId) {
        if (!this.playersOnSquare.includes(playerId)) {
            this.playersOnSquare.push(playerId);
        }
    }

    /**
     * Remueve un jugador de la casilla
     * @param {string|number} playerId - ID del jugador
     */
    removePlayer(playerId) {
        this.playersOnSquare = this.playersOnSquare.filter(id => id !== playerId);
    }

    /**
     * Obtiene el valor total de la propiedad (para cálculo de patrimonio)
     * @returns {number}
     */
    getTotalValue() {
        if (this.type !== 'property' && this.type !== 'railroad') return 0;
        if (this.mortgaged) return -this.mortgage; // Se resta del patrimonio
        
        let value = this.price;
        
        if (this.type === 'property') {
            value += this.houses * 100; // Cada casa vale 100
            if (this.hotel) {
                value += 250; // El hotel vale 250
            }
        }
        
        return value;
    }

    /**
     * Obtiene el estado actual de la casilla para mostrar en el tablero
     * @returns {Object}
     */
    getDisplayInfo() {
        let status = 'Disponible';
        let statusColor = 'white';

        if (this.owner) {
            status = `Jugador ${this.owner}`;
            statusColor = 'player-color'; // Se definirá en CSS según el jugador
            
            if (this.mortgaged) {
                status += ' (Hipotecada)';
            } else if (this.hotel) {
                status += ' + Hotel';
            } else if (this.houses > 0) {
                status += ` + ${this.houses} casa${this.houses > 1 ? 's' : ''}`;
            }
        }

        return {
            name: this.name,
            type: this.type,
            color: this.color || null,
            status,
            statusColor,
            playersOnSquare: [...this.playersOnSquare],
            isOwned: !!this.owner,
            isMortgaged: this.mortgaged,
            hasBuildings: this.houses > 0 || this.hotel
        };
    }

    /**
     * Resetea el estado de la casilla (útil para nuevas partidas)
     */
    reset() {
        this.owner = null;
        this.houses = 0;
        this.hotel = false;
        this.mortgaged = false;
        this.playersOnSquare = [];
    }

    /**
     * Obtiene información completa de la casilla (para debugging)
     * @returns {Object}
     */
    getFullInfo() {
        return {
            id: this.id,
            name: this.name,
            type: this.type,
            color: this.color || null,
            price: this.price || null,
            mortgage: this.mortgage || null,
            rent: this.rent || null,
            action: this.action || null,
            owner: this.owner,
            houses: this.houses,
            hotel: this.hotel,
            mortgaged: this.mortgaged,
            playersOnSquare: [...this.playersOnSquare]
        };
    }
}