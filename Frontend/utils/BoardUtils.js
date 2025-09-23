/**
 * BoardUtils - Utilidades para el manejo y generación del tablero de Monopoly
 * Funciones auxiliares que se pueden reutilizar en diferentes partes del juego
 */
class BoardUtils {
    /**
     * Configuración por defecto del tablero
     */
    static DEFAULT_CONFIG = {
        minCasillas: 20,
        maxCasillas: 40,
        defaultCasillas: 40,
        sectionsOrder: ['bottom', 'left', 'top', 'right'],
        cornerPositions: [0, 10, 20, 30], // Para tablero de 40 casillas
        playerColors: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4'],
        boardDimensions: {
            width: 800,
            height: 800,
            casillaWidth: 80,
            casillaHeight: 100
        }
    };

    /**
     * Valida si el número de casillas es válido para generar un tablero
     * @param {number} totalCasillas - Número total de casillas
     * @returns {boolean}
     */
    static isValidCasillaCount(totalCasillas) {
        return Number.isInteger(totalCasillas) && 
               totalCasillas >= this.DEFAULT_CONFIG.minCasillas &&
               totalCasillas <= this.DEFAULT_CONFIG.maxCasillas &&
               totalCasillas % 4 === 0; // Debe ser divisible por 4 para 4 lados
    }

    /**
     * Calcula la distribución de casillas por sección del tablero
     * @param {number} totalCasillas - Número total de casillas
     * @returns {Object} Distribución por sección
     */
    static calculateSectionDistribution(totalCasillas) {
        if (!this.isValidCasillaCount(totalCasillas)) {
            throw new Error(`Número de casillas inválido: ${totalCasillas}. Debe ser múltiplo de 4 entre ${this.DEFAULT_CONFIG.minCasillas} y ${this.DEFAULT_CONFIG.maxCasillas}`);
        }

        const casillasPerSide = totalCasillas / 4;
        
        return {
            bottom: casillasPerSide,
            left: casillasPerSide,
            top: casillasPerSide,
            right: casillasPerSide,
            total: totalCasillas
        };
    }

    /**
     * Genera las posiciones de las esquinas basado en el total de casillas
     * @param {number} totalCasillas - Número total de casillas
     * @returns {Array<number>} Array con las posiciones de las esquinas
     */
    static calculateCornerPositions(totalCasillas) {
        const casillasPerSide = totalCasillas / 4;
        return [
            0,                          // Esquina inferior derecha (GO)
            casillasPerSide,           // Esquina inferior izquierda
            casillasPerSide * 2,       // Esquina superior izquierda
            casillasPerSide * 3        // Esquina superior derecha
        ];
    }

    /**
     * Determina el tipo de casilla especial basado en su posición
     * @param {number} position - Posición en el tablero (0-based)
     * @param {number} totalCasillas - Total de casillas del tablero
     * @returns {string|null} Tipo de casilla especial o null si es propiedad normal
     */
    static getSpecialCasillaType(position, totalCasillas) {
        const corners = this.calculateCornerPositions(totalCasillas);
        const casillasPerSide = totalCasillas / 4;
        
        // Esquinas especiales
        if (corners.includes(position)) {
            switch (position) {
                case 0: return 'go';
                case casillasPerSide: return 'jail';
                case casillasPerSide * 2: return 'free_parking';
                case casillasPerSide * 3: return 'go_to_jail';
            }
        }
        
        // Otras casillas especiales basadas en posición relativa
        const relativePosition = position % casillasPerSide;
        
        // Community Chest cada 7 casillas aproximadamente
        if (relativePosition === Math.floor(casillasPerSide * 0.2) || 
            relativePosition === Math.floor(casillasPerSide * 0.8)) {
            return 'community_chest';
        }
        
        // Chance cada 6 casillas aproximadamente
        if (relativePosition === Math.floor(casillasPerSide * 0.4) || 
            relativePosition === Math.floor(casillasPerSide * 0.6)) {
            return 'chance';
        }
        
        // Impuestos
        if (relativePosition === Math.floor(casillasPerSide * 0.1)) {
            return 'tax';
        }
        
        // Ferrocarriles
        if (relativePosition === Math.floor(casillasPerSide * 0.5)) {
            return 'railroad';
        }
        
        // Servicios públicos
        if (relativePosition === Math.floor(casillasPerSide * 0.3) || 
            relativePosition === Math.floor(casillasPerSide * 0.7)) {
            return 'utility';
        }
        
        return 'property'; // Propiedad normal por defecto
    }

    /**
     * Genera colores para grupos de propiedades
     * @param {number} totalProperties - Número total de propiedades normales
     * @returns {Array<string>} Array de colores
     */
    static generatePropertyColors(totalProperties) {
        const baseColors = [
            '#8B4513', '#87CEEB', '#FF1493', '#FFA500', 
            '#FF0000', '#FFFF00', '#00FF00', '#0000FF',
            '#4B0082', '#800080'
        ];
        
        const colorsNeeded = Math.ceil(totalProperties / 3); // 3 propiedades por color típicamente
        const colors = [];
        
        for (let i = 0; i < colorsNeeded; i++) {
            colors.push(baseColors[i % baseColors.length]);
        }
        
        return colors;
    }

    /**
     * Calcula la sección del tablero donde debe ir una casilla
     * @param {number} position - Posición de la casilla (0-based)
     * @param {number} totalCasillas - Total de casillas
     * @returns {string} Nombre de la sección ('bottom', 'left', 'top', 'right')
     */
    static getSectionForPosition(position, totalCasillas) {
        const casillasPerSide = totalCasillas / 4;
        
        if (position < casillasPerSide) return 'bottom';
        if (position < casillasPerSide * 2) return 'left';
        if (position < casillasPerSide * 3) return 'top';
        return 'right';
    }

    /**
     * Calcula las dimensiones del tablero basado en el número de casillas
     * @param {number} totalCasillas - Número total de casillas
     * @returns {Object} Dimensiones calculadas
     */
    static calculateBoardDimensions(totalCasillas) {
        const casillasPerSide = totalCasillas / 4;
        const baseSize = this.DEFAULT_CONFIG.boardDimensions;
        
        // Ajustar tamaño según número de casillas
        const scaleFactor = Math.max(0.6, Math.min(1.2, casillasPerSide / 10));
        
        return {
            width: baseSize.width * scaleFactor,
            height: baseSize.height * scaleFactor,
            casillaWidth: Math.max(60, baseSize.casillaWidth * (10 / casillasPerSide)),
            casillaHeight: Math.max(80, baseSize.casillaHeight * (10 / casillasPerSide))
        };
    }

    /**
     * Valida la estructura de datos del tablero recibida del backend
     * @param {Object} boardData - Datos del tablero
     * @returns {boolean}
     */
    static validateBoardData(boardData) {
        if (!boardData || typeof boardData !== 'object') return false;
        
        const requiredSections = ['bottom', 'left', 'top', 'right'];
        
        // Verificar que todas las secciones existen
        for (const section of requiredSections) {
            if (!Array.isArray(boardData[section])) return false;
        }
        
        // Verificar que hay al menos una casilla en cada sección
        const totalCasillas = requiredSections.reduce((total, section) => 
            total + boardData[section].length, 0);
            
        return totalCasillas >= this.DEFAULT_CONFIG.minCasillas;
    }

    /**
     * Sanitiza y normaliza los datos de una casilla
     * @param {Object} casillaData - Datos raw de la casilla
     * @param {number} position - Posición en el tablero
     * @returns {Object} Datos normalizados
     */
    static sanitizeCasillaData(casillaData, position) {
        const sanitized = {
            id: casillaData.id || position,
            name: casillaData.name || `Casilla ${position}`,
            type: casillaData.type || 'property',
            position: position
        };

        // Sanitizar propiedades específicas según el tipo
        switch (sanitized.type) {
            case 'property':
                sanitized.color = casillaData.color || '#CCCCCC';
                sanitized.price = Math.max(0, casillaData.price || 100);
                sanitized.mortgage = Math.max(0, casillaData.mortgage || sanitized.price / 2);
                sanitized.rent = this.sanitizeRentData(casillaData.rent);
                break;
                
            case 'railroad':
                sanitized.price = Math.max(0, casillaData.price || 200);
                sanitized.mortgage = Math.max(0, casillaData.mortgage || sanitized.price / 2);
                sanitized.rent = this.sanitizeRailroadRent(casillaData.rent);
                break;
                
            case 'tax':
                sanitized.action = {
                    type: 'pay',
                    amount: Math.max(0, casillaData.action?.amount || 100)
                };
                break;
        }

        return sanitized;
    }

    /**
     * Sanitiza los datos de renta para propiedades
     * @param {Object} rentData - Datos de renta
     * @returns {Object} Datos de renta sanitizados
     */
    static sanitizeRentData(rentData) {
        if (!rentData || typeof rentData !== 'object') {
            return {
                base: 10,
                withHouse: [50, 150, 450, 625],
                withHotel: 750
            };
        }

        return {
            base: Math.max(0, rentData.base || 10),
            withHouse: Array.isArray(rentData.withHouse) ? 
                rentData.withHouse.map(rent => Math.max(0, rent)) :
                [50, 150, 450, 625],
            withHotel: Math.max(0, rentData.withHotel || 750)
        };
    }

    /**
     * Sanitiza los datos de renta para ferrocarriles
     * @param {Object} rentData - Datos de renta
     * @returns {Object} Datos de renta sanitizados
     */
    static sanitizeRailroadRent(rentData) {
        if (!rentData || typeof rentData !== 'object') {
            return { '1': 25, '2': 50, '3': 100, '4': 200 };
        }

        return {
            '1': Math.max(0, rentData['1'] || 25),
            '2': Math.max(0, rentData['2'] || 50),
            '3': Math.max(0, rentData['3'] || 100),
            '4': Math.max(0, rentData['4'] || 200)
        };
    }

    /**
     * Genera un ID único para una casilla
     * @param {string} section - Sección del tablero
     * @param {number} index - Índice dentro de la sección
     * @param {number} position - Posición global
     * @returns {string}
     */
    static generateCasillaId(section, index, position) {
        return `casilla_${section}_${index}_${position}`;
    }

    /**
     * Convierte una posición global a coordenadas de sección
     * @param {number} position - Posición global (0-based)
     * @param {number} totalCasillas - Total de casillas
     * @returns {Object} {section, index}
     */
    static positionToSectionCoords(position, totalCasillas) {
        const casillasPerSide = totalCasillas / 4;
        
        if (position < casillasPerSide) {
            return { section: 'bottom', index: position };
        } else if (position < casillasPerSide * 2) {
            return { section: 'left', index: position - casillasPerSide };
        } else if (position < casillasPerSide * 3) {
            return { section: 'top', index: position - (casillasPerSide * 2) };
        } else {
            return { section: 'right', index: position - (casillasPerSide * 3) };
        }
    }

    /**
     * Convierte coordenadas de sección a posición global
     * @param {string} section - Sección del tablero
     * @param {number} index - Índice dentro de la sección
     * @param {number} totalCasillas - Total de casillas
     * @returns {number} Posición global
     */
    static sectionCoordsToPosition(section, index, totalCasillas) {
        const casillasPerSide = totalCasillas / 4;
        
        switch (section) {
            case 'bottom': return index;
            case 'left': return casillasPerSide + index;
            case 'top': return casillasPerSide * 2 + index;
            case 'right': return casillasPerSide * 3 + index;
            default: throw new Error(`Sección inválida: ${section}`);
        }
    }

    /**
     * Genera un color de jugador aleatorio que no esté en uso
     * @param {Array<string>} usedColors - Colores ya utilizados
     * @returns {string} Color hexadecimal
     */
    static generatePlayerColor(usedColors = []) {
        const availableColors = this.DEFAULT_CONFIG.playerColors.filter(
            color => !usedColors.includes(color)
        );
        
        if (availableColors.length === 0) {
            // Generar color aleatorio si no hay disponibles
            return '#' + Math.floor(Math.random()*16777215).toString(16);
        }
        
        return availableColors[0];
    }

    /**
     * Calcula la distancia entre dos posiciones en el tablero
     * @param {number} from - Posición inicial
     * @param {number} to - Posición final
     * @param {number} totalCasillas - Total de casillas
     * @returns {number} Distancia (puede ser negativa si va hacia atrás)
     */
    static calculateDistance(from, to, totalCasillas) {
        if (to >= from) {
            return to - from;
        } else {
            // El jugador pasó por GO
            return (totalCasillas - from) + to;
        }
    }

    /**
     * Verifica si una posición es una esquina del tablero
     * @param {number} position - Posición a verificar
     * @param {number} totalCasillas - Total de casillas
     * @returns {boolean}
     */
    static isCornerPosition(position, totalCasillas) {
        const corners = this.calculateCornerPositions(totalCasillas);
        return corners.includes(position);
    }

    /**
     * Obtiene información de debug para el tablero
     * @param {number} totalCasillas - Total de casillas
     * @returns {Object}
     */
    static getDebugInfo(totalCasillas) {
        return {
            isValidCount: this.isValidCasillaCount(totalCasillas),
            distribution: this.calculateSectionDistribution(totalCasillas),
            corners: this.calculateCornerPositions(totalCasillas),
            dimensions: this.calculateBoardDimensions(totalCasillas),
            specialPositions: {
                corners: this.calculateCornerPositions(totalCasillas),
                communityChest: [],
                chance: [],
                tax: [],
                railroads: [],
                utilities: []
            }
        };
    }
}