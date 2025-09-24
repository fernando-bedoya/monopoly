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

    /**
     * Genera datos de prueba para el tablero
     * @param {number} totalCasillas - Número total de casillas
     * @param {string} language - Idioma ('es' o 'en')
     * @returns {Object} Datos del tablero con estructura {bottom, left, top, right, community_chest, chance}
     */
    static generateTestBoardData(totalCasillas = 40, language = 'es') {
        if (!this.isValidCasillaCount(totalCasillas)) {
            throw new Error(`Número de casillas inválido: ${totalCasillas}`);
        }

        const distribution = this.calculateSectionDistribution(totalCasillas);
        const corners = this.calculateCornerPositions(totalCasillas);
        const colors = this.generatePropertyColors(Math.floor(totalCasillas * 0.6)); // 60% propiedades aprox

        // Nombres base según idioma
        const names = language === 'es' ? {
            go: 'Salida',
            jail: 'Cárcel',
            freeParking: 'Estacionamiento Gratuito', 
            goToJail: 'Ir a la Cárcel',
            chance: 'Suerte',
            communityChest: 'Caja de Comunidad',
            property: 'Propiedad',
            railroad: 'Ferrocarril',
            utility: 'Servicio Público',
            tax: 'Impuesto'
        } : {
            go: 'GO',
            jail: 'Jail',
            freeParking: 'Free Parking',
            goToJail: 'Go to Jail',
            chance: 'Chance',
            communityChest: 'Community Chest',
            property: 'Property',
            railroad: 'Railroad',
            utility: 'Utility',
            tax: 'Tax'
        };

        const boardData = {
            bottom: [],
            left: [],
            top: [],
            right: [],
            community_chest: this.generateCommunityChestCards(language),
            chance: this.generateChanceCards(language)
        };

        // Generar casillas por sección
        const sections = ['bottom', 'left', 'top', 'right'];
        let position = 0;
        let colorIndex = 0;

        sections.forEach((section, sectionIndex) => {
            const casillasInSection = distribution[section];
            
            for (let i = 0; i < casillasInSection; i++) {
                const isCorner = corners.includes(position);
                let casilla;

                if (isCorner) {
                    // Casillas especiales en las esquinas
                    if (position === 0) {
                        casilla = this.createSpecialCasilla(position, names.go, 'go', language);
                    } else if (position === corners[1]) {
                        casilla = this.createSpecialCasilla(position, names.jail, 'jail', language);
                    } else if (position === corners[2]) {
                        casilla = this.createSpecialCasilla(position, names.freeParking, 'free_parking', language);
                    } else if (position === corners[3]) {
                        casilla = this.createSpecialCasilla(position, names.goToJail, 'go_to_jail', language);
                    }
                } else {
                    // Casillas regulares - mix de propiedades y especiales
                    const rand = Math.random();
                    if (rand < 0.65) { // 65% propiedades
                        casilla = this.createPropertyCasilla(position, `${names.property} ${position}`, colors[colorIndex % colors.length], language);
                        colorIndex++;
                    } else if (rand < 0.75) { // 10% chance/community chest
                        casilla = this.createSpecialCasilla(position, Math.random() < 0.5 ? names.chance : names.communityChest, 
                                                         Math.random() < 0.5 ? 'chance' : 'community_chest', language);
                    } else if (rand < 0.85) { // 10% ferrocarriles
                        casilla = this.createRailroadCasilla(position, `${names.railroad} ${Math.floor(position/10) + 1}`, language);
                    } else if (rand < 0.95) { // 10% servicios públicos
                        casilla = this.createUtilityCasilla(position, `${names.utility} ${Math.floor(position/20) + 1}`, language);
                    } else { // 5% impuestos
                        casilla = this.createTaxCasilla(position, `${names.tax} ${Math.floor(position/10) + 1}`, language);
                    }
                }

                boardData[section].push(casilla);
                position++;
            }
        });

        return boardData;
    }

    /**
     * Crea una casilla especial (GO, Jail, etc.)
     */
    static createSpecialCasilla(position, name, type, language) {
        return {
            id: `special_${position}`,
            name: name,
            type: type,
            position: position,
            description: language === 'es' ? `Casilla especial: ${name}` : `Special square: ${name}`,
            action: type
        };
    }

    /**
     * Crea una casilla de propiedad
     */
    static createPropertyCasilla(position, name, color, language) {
        const basePrice = 100 + (position * 5);
        return {
            id: `property_${position}`,
            name: name,
            type: 'property',
            position: position,
            color: color,
            price: basePrice,
            rent: Math.floor(basePrice * 0.1),
            house_cost: Math.floor(basePrice * 0.5),
            hotel_cost: Math.floor(basePrice * 0.5),
            mortgage_value: Math.floor(basePrice * 0.5),
            houses: 0,
            hotels: 0,
            owner: null,
            mortgaged: false,
            description: language === 'es' ? `Propiedad en venta por $${basePrice}` : `Property for sale for $${basePrice}`
        };
    }

    /**
     * Crea una casilla de ferrocarril
     */
    static createRailroadCasilla(position, name, language) {
        return {
            id: `railroad_${position}`,
            name: name,
            type: 'railroad',
            position: position,
            price: 200,
            rent: [25, 50, 100, 200],
            mortgage_value: 100,
            owner: null,
            mortgaged: false,
            description: language === 'es' ? 'Estación de ferrocarril' : 'Railroad station'
        };
    }

    /**
     * Crea una casilla de servicio público
     */
    static createUtilityCasilla(position, name, language) {
        return {
            id: `utility_${position}`,
            name: name,
            type: 'utility',
            position: position,
            price: 150,
            mortgage_value: 75,
            owner: null,
            mortgaged: false,
            description: language === 'es' ? 'Empresa de servicios públicos' : 'Utility company'
        };
    }

    /**
     * Crea una casilla de impuesto
     */
    static createTaxCasilla(position, name, language) {
        return {
            id: `tax_${position}`,
            name: name,
            type: 'tax',
            position: position,
            amount: 100 + (position * 2),
            description: language === 'es' ? 'Pagar impuesto' : 'Pay tax'
        };
    }

    /**
     * Genera cartas de Caja de Comunidad
     */
    static generateCommunityChestCards(language = 'es') {
        const cards = language === 'es' ? [
            { text: 'Avanza hasta la Salida. Cobra $200', action: 'move_to', destination: 0, money: 200 },
            { text: 'Recibe $50', action: 'receive_money', amount: 50 },
            { text: 'Paga $100 de multa', action: 'pay_money', amount: 100 },
            { text: 'Ve a la cárcel directamente', action: 'go_to_jail' },
            { text: 'Sal de la cárcel gratis', action: 'get_out_of_jail_free' }
        ] : [
            { text: 'Advance to GO. Collect $200', action: 'move_to', destination: 0, money: 200 },
            { text: 'Bank pays you $50', action: 'receive_money', amount: 50 },
            { text: 'Pay $100 fine', action: 'pay_money', amount: 100 },
            { text: 'Go to Jail directly', action: 'go_to_jail' },
            { text: 'Get out of Jail free', action: 'get_out_of_jail_free' }
        ];
        return cards;
    }

    /**
     * Genera cartas de Suerte
     */
    static generateChanceCards(language = 'es') {
        const cards = language === 'es' ? [
            { text: 'Avanza hasta la Salida. Cobra $200', action: 'move_to', destination: 0, money: 200 },
            { text: 'Avanza 3 espacios', action: 'move_spaces', spaces: 3 },
            { text: 'Retrocede 3 espacios', action: 'move_spaces', spaces: -3 },
            { text: 'Paga $50', action: 'pay_money', amount: 50 },
            { text: 'Recibe $100', action: 'receive_money', amount: 100 }
        ] : [
            { text: 'Advance to GO. Collect $200', action: 'move_to', destination: 0, money: 200 },
            { text: 'Move forward 3 spaces', action: 'move_spaces', spaces: 3 },
            { text: 'Move back 3 spaces', action: 'move_spaces', spaces: -3 },
            { text: 'Pay $50', action: 'pay_money', amount: 50 },
            { text: 'Bank pays you $100', action: 'receive_money', amount: 100 }
        ];
        return cards;
    }
}

// Exportar para uso global
window.BoardUtils = BoardUtils;