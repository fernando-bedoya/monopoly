/**
 * Renderizador dinámico del tablero de Monopoly
 * Maneja la creación visual del tablero con soporte para múltiples idiomas y tamaños variables
 */
class BoardRenderer {
    constructor(containerSelector, board, options = {}) {
        this.container = document.querySelector(containerSelector);
        this.board = board;
        this.options = {
            totalSquares: options.totalSquares || 40,
            language: options.language || 'es',
            boardSize: options.boardSize || 800,
            cornerSize: options.cornerSize || 120,
            sideSquareWidth: options.sideSquareWidth || 80,
            sideSquareHeight: options.sideSquareHeight || 120,
            ...options
        };
        
        this.translations = new Map();
        this.players = new Map(); // Para trackear posiciones de jugadores
        this.boardElement = null;
        
        // Inicializar traducciones por defecto
        this.initializeDefaultTranslations();
    }

    /**
     * Inicializa las traducciones por defecto
     */
    initializeDefaultTranslations() {
        this.translations.set('es', {
            available: 'Disponible',
            owned: 'Propiedad de',
            mortgaged: 'Hipotecada',
            houses: 'Casas',
            hotel: 'Hotel',
            price: 'Precio',
            rent: 'Renta',
            go: 'Salida',
            jail: 'Cárcel',
            parking: 'Parking Gratuito',
            goToJail: 'Ve a la Cárcel',
            chance: 'Sorpresa',
            communityChest: 'Caja de Comunidad',
            tax: 'Impuesto'
        });

        this.translations.set('en', {
            available: 'Available',
            owned: 'Owned by',
            mortgaged: 'Mortgaged',
            houses: 'Houses',
            hotel: 'Hotel',
            price: 'Price',
            rent: 'Rent',
            go: 'Go',
            jail: 'Jail',
            parking: 'Free Parking',
            goToJail: 'Go to Jail',
            chance: 'Chance',
            communityChest: 'Community Chest',
            tax: 'Tax'
        });
    }

    /**
     * Carga traducciones desde una API externa
     */
    async loadTranslations(apiUrl, language) {
        try {
            const response = await fetch(`${apiUrl}/${language}`);
            const translations = await response.json();
            this.translations.set(language, translations);
            this.options.language = language;
            return true;
        } catch (error) {
            console.warn('Error loading translations:', error);
            return false;
        }
    }

    /**
     * Obtiene una traducción para el idioma actual
     */
    t(key, fallback = key) {
        const currentTranslations = this.translations.get(this.options.language);
        return currentTranslations ? currentTranslations[key] || fallback : fallback;
    }

    /**
     * Calcula las dimensiones del tablero dinámicamente
     */
    calculateDimensions() {
        const { totalSquares, cornerSize, sideSquareWidth, sideSquareHeight } = this.options;
        
        // Calcular cuántas casillas van en cada lado (excluyendo esquinas)
        const squaresPerSide = Math.floor((totalSquares - 4) / 4);
        const remainingSquares = (totalSquares - 4) % 4;
        
        const sides = {
            bottom: squaresPerSide + (remainingSquares > 0 ? 1 : 0),
            left: squaresPerSide + (remainingSquares > 1 ? 1 : 0),
            top: squaresPerSide + (remainingSquares > 2 ? 1 : 0),
            right: squaresPerSide
        };

        const maxSideSquares = Math.max(...Object.values(sides));
        const boardWidth = cornerSize * 2 + maxSideSquares * sideSquareWidth;
        const boardHeight = boardWidth; // Tablero cuadrado

        return {
            boardWidth,
            boardHeight,
            sides,
            squaresPerSide: maxSideSquares
        };
    }

    /**
     * Crea la estructura HTML base del tablero
     */
    createBoardStructure() {
        const dimensions = this.calculateDimensions();
        
        this.container.innerHTML = '';
        this.container.className = 'monopoly-board-container';
        
        this.boardElement = document.createElement('div');
        this.boardElement.className = 'monopoly-board';
        this.boardElement.style.cssText = `
            width: ${dimensions.boardWidth}px;
            height: ${dimensions.boardHeight}px;
            position: relative;
            background: #c8e6c9;
            border: 3px solid #2e7d32;
            box-sizing: border-box;
        `;

        // Crear el área central del tablero
        const centerArea = document.createElement('div');
        centerArea.className = 'board-center';
        centerArea.style.cssText = `
            position: absolute;
            top: ${this.options.cornerSize}px;
            left: ${this.options.cornerSize}px;
            width: ${dimensions.boardWidth - this.options.cornerSize * 2}px;
            height: ${dimensions.boardHeight - this.options.cornerSize * 2}px;
            background: linear-gradient(135deg, #f1f8e9, #dcedc1);
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: 'Arial', sans-serif;
            font-size: 24px;
            font-weight: bold;
            color: #2e7d32;
            text-align: center;
            box-shadow: inset 0 0 20px rgba(0,0,0,0.1);
        `;
        centerArea.innerHTML = `
            <div>
                <div style="font-size: 32px; margin-bottom: 10px;">MONOPOLY</div>
                <div style="font-size: 16px; opacity: 0.8;">Dynamic Board</div>
                <div style="font-size: 14px; margin-top: 5px;">${this.options.totalSquares} ${this.t('squares', 'squares')}</div>
            </div>
        `;

        this.boardElement.appendChild(centerArea);
        this.container.appendChild(this.boardElement);

        return dimensions;
    }

    /**
     * Crea una casilla individual
     */
    createSquare(square, position, side, index, dimensions) {
        const squareElement = document.createElement('div');
        squareElement.className = `square square-${side} square-${square.type}`;
        squareElement.setAttribute('data-square-id', square.id);
        squareElement.setAttribute('data-position', position);

        // Calcular posición y tamaño según el lado
        const pos = this.calculateSquarePosition(side, index, dimensions);
        
        squareElement.style.cssText = `
            position: absolute;
            left: ${pos.x}px;
            top: ${pos.y}px;
            width: ${pos.width}px;
            height: ${pos.height}px;
            background: white;
            border: 2px solid #333;
            box-sizing: border-box;
            cursor: pointer;
            transition: all 0.3s ease;
            display: flex;
            flex-direction: column;
            font-family: 'Arial', sans-serif;
            font-size: ${pos.fontSize}px;
        `;

        // Agregar contenido de la casilla
        this.populateSquareContent(squareElement, square, pos);

        // Agregar eventos
        squareElement.addEventListener('click', () => this.onSquareClick(square, position));
        squareElement.addEventListener('mouseenter', () => this.onSquareHover(square, squareElement));
        squareElement.addEventListener('mouseleave', () => this.onSquareLeave(square, squareElement));

        return squareElement;
    }

    /**
     * Calcula la posición de una casilla según su lado e índice
     */
    calculateSquarePosition(side, index, dimensions) {
        const { cornerSize, sideSquareWidth, sideSquareHeight } = this.options;
        const { boardWidth, boardHeight } = dimensions;

        let x, y, width, height, fontSize = 10;

        switch (side) {
            case 'bottom':
                if (index === 0) { // Esquina inferior derecha
                    x = boardWidth - cornerSize;
                    y = boardHeight - cornerSize;
                    width = cornerSize;
                    height = cornerSize;
                    fontSize = 12;
                } else {
                    x = boardWidth - cornerSize - (index * sideSquareWidth);
                    y = boardHeight - sideSquareHeight;
                    width = sideSquareWidth;
                    height = sideSquareHeight;
                }
                break;
                
            case 'left':
                if (index === 0) { // Esquina inferior izquierda
                    x = 0;
                    y = boardHeight - cornerSize;
                    width = cornerSize;
                    height = cornerSize;
                    fontSize = 12;
                } else {
                    x = 0;
                    y = boardHeight - cornerSize - (index * sideSquareWidth);
                    width = sideSquareHeight;
                    height = sideSquareWidth;
                }
                break;
                
            case 'top':
                if (index === 0) { // Esquina superior izquierda
                    x = 0;
                    y = 0;
                    width = cornerSize;
                    height = cornerSize;
                    fontSize = 12;
                } else {
                    x = cornerSize + ((index - 1) * sideSquareWidth);
                    y = 0;
                    width = sideSquareWidth;
                    height = sideSquareHeight;
                }
                break;
                
            case 'right':
                if (index === 0) { // Esquina superior derecha
                    x = boardWidth - cornerSize;
                    y = 0;
                    width = cornerSize;
                    height = cornerSize;
                    fontSize = 12;
                } else {
                    x = boardWidth - sideSquareHeight;
                    y = cornerSize + ((index - 1) * sideSquareWidth);
                    width = sideSquareHeight;
                    height = sideSquareWidth;
                }
                break;
        }

        return { x, y, width, height, fontSize };
    }

    /**
     * Llena el contenido de una casilla
     */
    populateSquareContent(element, square, position) {
        element.innerHTML = '';

        // Header con color para propiedades
        if (square.isProperty() && square.color) {
            const colorHeader = document.createElement('div');
            colorHeader.className = 'property-color';
            colorHeader.style.cssText = `
                background: ${square.color};
                height: 25%;
                width: 100%;
                border-bottom: 1px solid #333;
            `;
            element.appendChild(colorHeader);
        }

        // Contenido principal
        const content = document.createElement('div');
        content.className = 'square-content';
        content.style.cssText = `
            padding: 4px;
            flex: 1;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            text-align: center;
            overflow: hidden;
        `;

        // Nombre de la casilla
        const name = document.createElement('div');
        name.className = 'square-name';
        name.style.cssText = `
            font-weight: bold;
            font-size: ${Math.min(position.fontSize, 11)}px;
            line-height: 1.1;
            margin-bottom: 2px;
            word-wrap: break-word;
        `;
        name.textContent = square.name;
        content.appendChild(name);

        // Información adicional según el tipo
        if (square.isProperty() || square.isRailroad()) {
            // Precio
            if (square.price) {
                const price = document.createElement('div');
                price.className = 'square-price';
                price.style.cssText = `
                    font-size: ${Math.min(position.fontSize - 1, 9)}px;
                    color: #666;
                    margin: 1px 0;
                `;
                price.textContent = `$${square.price}`;
                content.appendChild(price);
            }

            // Estado de propiedad
            const status = document.createElement('div');
            status.className = 'property-status';
            status.style.cssText = `
                font-size: ${Math.min(position.fontSize - 2, 8)}px;
                padding: 2px;
                border-radius: 3px;
                margin-top: auto;
            `;
            this.updatePropertyStatus(status, square);
            content.appendChild(status);
        }

        element.appendChild(content);

        // Área para fichas de jugadores
        const playersArea = document.createElement('div');
        playersArea.className = 'players-area';
        playersArea.style.cssText = `
            position: absolute;
            bottom: 2px;
            right: 2px;
            display: flex;
            flex-wrap: wrap;
            gap: 2px;
        `;
        element.appendChild(playersArea);
    }

    /**
     * Actualiza el estado visual de una propiedad
     */
    updatePropertyStatus(statusElement, square) {
        let statusText = this.t('available');
        let statusColor = '#e8f5e8';
        let textColor = '#666';

        if (square.owner) {
            statusText = this.t('owned');
            statusColor = '#ffecb3';
            textColor = '#f57c00';
        }

        if (square.isMortgaged) {
            statusText = this.t('mortgaged');
            statusColor = '#ffcdd2';
            textColor = '#d32f2f';
        }

        statusElement.textContent = statusText;
        statusElement.style.background = statusColor;
        statusElement.style.color = textColor;
    }

    /**
     * Renderiza el tablero completo
     */
    async render() {
        const dimensions = this.createBoardStructure();
        
        if (!this.board || !this.board.squaresByPosition) {
            console.error('Board data not available');
            return;
        }

        const { sides } = dimensions;
        let position = 0;
        
        // Renderizar cada lado del tablero
        const sideNames = ['bottom', 'left', 'top', 'right'];
        
        sideNames.forEach(sideName => {
            const squareCount = sides[sideName];
            
            for (let i = 0; i < squareCount && position < this.board.squaresByPosition.length; i++) {
                const square = this.board.squaresByPosition[position];
                if (square) {
                    const squareElement = this.createSquare(square, position, sideName, i, dimensions);
                    this.boardElement.appendChild(squareElement);
                }
                position++;
            }
        });

        // Agregar estilos CSS dinámicos
        this.injectDynamicStyles();
    }

    /**
     * Inyecta estilos CSS dinámicos
     */
    injectDynamicStyles() {
        const styleId = 'monopoly-dynamic-styles';
        let styleElement = document.getElementById(styleId);
        
        if (!styleElement) {
            styleElement = document.createElement('style');
            styleElement.id = styleId;
            document.head.appendChild(styleElement);
        }

        styleElement.textContent = `
            .monopoly-board-container {
                display: flex;
                justify-content: center;
                align-items: center;
                margin: 20px auto;
                background: #f5f5f5;
                border-radius: 10px;
                padding: 20px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            }

            .square:hover {
                transform: scale(1.05);
                z-index: 10;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            }

            .square-special {
                background: linear-gradient(135deg, #fff3e0, #ffe0b2) !important;
            }

            .square-property {
                background: linear-gradient(135deg, #ffffff, #f8f9fa) !important;
            }

            .square-railroad {
                background: linear-gradient(135deg, #e3f2fd, #bbdefb) !important;
            }

            .square-chance, .square-community_chest {
                background: linear-gradient(135deg, #fce4ec, #f8bbd9) !important;
            }

            .square-tax {
                background: linear-gradient(135deg, #fff8e1, #ffecb3) !important;
            }

            .player-piece {
                width: 12px;
                height: 12px;
                border-radius: 50%;
                border: 1px solid #333;
                display: inline-block;
            }

            .property-buildings {
                position: absolute;
                top: 2px;
                left: 2px;
                display: flex;
                gap: 1px;
            }

            .house {
                width: 6px;
                height: 6px;
                background: #4caf50;
                border-radius: 1px;
            }

            .hotel {
                width: 8px;
                height: 6px;
                background: #f44336;
                border-radius: 1px;
            }

            @media (max-width: 768px) {
                .monopoly-board-container {
                    padding: 10px;
                    margin: 10px;
                }
                
                .board-center {
                    font-size: 18px !important;
                }
            }
        `;
    }

    /**
     * Actualiza el idioma del tablero
     */
    async updateLanguage(language, translationApiUrl = null) {
        if (translationApiUrl) {
            await this.loadTranslations(translationApiUrl, language);
        } else {
            this.options.language = language;
        }
        
        // Re-renderizar el tablero con el nuevo idioma
        await this.render();
    }

    /**
     * Actualiza el tamaño del tablero
     */
    async updateBoardSize(totalSquares) {
        this.options.totalSquares = totalSquares;
        await this.render();
    }

    /**
     * Agrega un jugador al tablero
     */
    addPlayer(playerId, playerData) {
        this.players.set(playerId, {
            ...playerData,
            position: 0
        });
    }

    /**
     * Mueve un jugador a una posición
     */
    movePlayer(playerId, newPosition) {
        const player = this.players.get(playerId);
        if (!player) return;

        // Remover ficha de posición anterior
        this.removePlayerPieceFromPosition(playerId, player.position);
        
        // Actualizar posición
        player.position = newPosition % this.options.totalSquares;
        this.players.set(playerId, player);

        // Agregar ficha en nueva posición
        this.addPlayerPieceToPosition(playerId, player.position, player.color);
    }

    /**
     * Remueve la ficha de un jugador de una posición
     */
    removePlayerPieceFromPosition(playerId, position) {
        const square = document.querySelector(`[data-position="${position}"] .players-area`);
        if (square) {
            const piece = square.querySelector(`[data-player-id="${playerId}"]`);
            if (piece) {
                piece.remove();
            }
        }
    }

    /**
     * Agrega la ficha de un jugador a una posición
     */
    addPlayerPieceToPosition(playerId, position, color) {
        const square = document.querySelector(`[data-position="${position}"] .players-area`);
        if (square) {
            const piece = document.createElement('div');
            piece.className = 'player-piece';
            piece.setAttribute('data-player-id', playerId);
            piece.style.background = color;
            piece.title = `Player ${playerId}`;
            square.appendChild(piece);
        }
    }

    /**
     * Actualiza el estado de una casilla
     */
    updateSquare(squareId, newState) {
        const square = this.board.getSquare(squareId);
        if (!square) return;

        // Actualizar datos del square
        Object.assign(square, newState);

        // Actualizar visualmente
        const squareElement = document.querySelector(`[data-square-id="${squareId}"]`);
        if (squareElement) {
            const statusElement = squareElement.querySelector('.property-status');
            if (statusElement) {
                this.updatePropertyStatus(statusElement, square);
            }

            // Actualizar construcciones
            this.updateSquareBuildings(squareElement, square);
        }
    }

    /**
     * Actualiza las construcciones en una casilla
     */
    updateSquareBuildings(squareElement, square) {
        // Remover construcciones existentes
        const existingBuildings = squareElement.querySelector('.property-buildings');
        if (existingBuildings) {
            existingBuildings.remove();
        }

        if (square.houses > 0 || square.hasHotel) {
            const buildings = document.createElement('div');
            buildings.className = 'property-buildings';
            buildings.style.cssText = `
                position: absolute;
                top: 2px;
                left: 2px;
                display: flex;
                gap: 1px;
                z-index: 5;
            `;

            if (square.hasHotel) {
                const hotel = document.createElement('div');
                hotel.className = 'hotel';
                buildings.appendChild(hotel);
            } else {
                for (let i = 0; i < square.houses; i++) {
                    const house = document.createElement('div');
                    house.className = 'house';
                    buildings.appendChild(house);
                }
            }

            squareElement.appendChild(buildings);
        }
    }

    /**
     * Eventos de interacción con casillas
     */
    onSquareClick(square, position) {
        console.log('Square clicked:', square.name, 'Position:', position);
        // Emitir evento personalizado
        const event = new CustomEvent('squareClick', {
            detail: { square, position }
        });
        this.container.dispatchEvent(event);
    }

    onSquareHover(square, element) {
        // Mostrar información adicional en hover
        const tooltip = this.createTooltip(square);
        document.body.appendChild(tooltip);
        
        element.addEventListener('mousemove', (e) => {
            tooltip.style.left = (e.clientX + 10) + 'px';
            tooltip.style.top = (e.clientY + 10) + 'px';
        });
    }

    onSquareLeave(square, element) {
        // Remover tooltip
        const tooltip = document.querySelector('.square-tooltip');
        if (tooltip) {
            tooltip.remove();
        }
    }

    /**
     * Crea un tooltip informativo para una casilla
     */
    createTooltip(square) {
        const tooltip = document.createElement('div');
        tooltip.className = 'square-tooltip';
        tooltip.style.cssText = `
            position: absolute;
            background: rgba(0,0,0,0.9);
            color: white;
            padding: 10px;
            border-radius: 5px;
            font-size: 12px;
            max-width: 200px;
            z-index: 1000;
            pointer-events: none;
        `;

        let content = `<strong>${square.name}</strong><br>`;
        
        if (square.isProperty() || square.isRailroad()) {
            content += `${this.t('price')}: $${square.price}<br>`;
            if (square.owner) {
                content += `${this.t('owned')} ${square.owner}<br>`;
            }
            if (square.isMortgaged) {
                content += `<span style="color: #ff5252">${this.t('mortgaged')}</span><br>`;
            }
        }

        tooltip.innerHTML = content;
        return tooltip;
    }

    /**
     * Destruye el renderizador y limpia eventos
     */
    destroy() {
        if (this.container) {
            this.container.innerHTML = '';
        }
        
        const styleElement = document.getElementById('monopoly-dynamic-styles');
        if (styleElement) {
            styleElement.remove();
        }
    }
}

// Exportar para uso en otros archivos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BoardRenderer };
} else if (typeof window !== 'undefined') {
    window.MonopolyBoardRenderer = { BoardRenderer };
}