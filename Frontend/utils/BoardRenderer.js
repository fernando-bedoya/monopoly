/**
 * BoardRenderer - Módulo para renderizar el tablero de Monopoly
 * Maneja la creación y actualización visual del tablero dinámico
 */
class BoardRenderer {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            throw new Error(`Contenedor con ID '${containerId}' no encontrado`);
        }

        // Configuración del renderer
        this.config = {
            responsive: options.responsive ?? true,
            showDebugInfo: options.showDebugInfo ?? false,
            animateMovement: options.animateMovement ?? true,
            casillaPadding: options.casillaPadding ?? 5,
            cornerSize: options.cornerSize ?? 120,
            ...options
        };

        // Estado del tablero renderizado
        this.boardElement = null;
        this.casillaElements = new Map();
        this.playerTokens = new Map();
        this.totalCasillas = 0;
        this.boardDimensions = null;
        
        // Inicializar estilos CSS
        this.injectStyles();
    }

    /**
     * Renderiza el tablero completo
     * @param {Object} boardData - Datos del tablero desde el backend
     * @param {number} totalCasillas - Número total de casillas
     */
    async renderBoard(boardData, totalCasillas = null) {
        try {
            // Validar datos del tablero
            if (!BoardUtils.validateBoardData(boardData)) {
                throw new Error('Datos del tablero inválidos');
            }

            // Calcular total de casillas si no se proporciona
            if (!totalCasillas) {
                totalCasillas = ['bottom', 'left', 'top', 'right']
                    .reduce((total, section) => total + (boardData[section]?.length || 0), 0);
            }

            this.totalCasillas = totalCasillas;

            // Validar que el número de casillas sea válido
            if (!BoardUtils.isValidCasillaCount(totalCasillas)) {
                throw new Error(`Número de casillas inválido: ${totalCasillas}`);
            }

            // Calcular dimensiones del tablero
            this.boardDimensions = BoardUtils.calculateBoardDimensions(totalCasillas);

            // Limpiar contenedor anterior
            this.clearBoard();

            // Crear estructura del tablero
            this.createBoardStructure();

            // Renderizar casillas por sección
            await this.renderBoardSections(boardData);

            // Aplicar responsive si está habilitado
            if (this.config.responsive) {
                this.makeResponsive();
            }

            // Mostrar información de debug si está habilitada
            if (this.config.showDebugInfo) {
                this.renderDebugInfo();
            }

            console.log(`Tablero renderizado: ${totalCasillas} casillas`);

        } catch (error) {
            console.error('Error renderizando tablero:', error);
            this.showError(error.message);
        }
    }

    /**
     * Crea la estructura HTML base del tablero
     */
    createBoardStructure() {
        this.boardElement = document.createElement('div');
        this.boardElement.className = 'monopoly-board';
        this.boardElement.style.cssText = `
            width: ${this.boardDimensions.width}px;
            height: ${this.boardDimensions.height}px;
            position: relative;
            margin: 0 auto;
            background: #c8e6c9;
            border: 3px solid #2e7d32;
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        `;

        // Crear secciones del tablero
        const sections = ['bottom', 'left', 'top', 'right'];
        sections.forEach(section => {
            const sectionElement = document.createElement('div');
            sectionElement.className = `board-section board-${section}`;
            sectionElement.id = `section-${section}`;
            this.setBoardSectionStyles(sectionElement, section);
            this.boardElement.appendChild(sectionElement);
        });

        // Crear área central del tablero
        this.createCenterArea();

        this.container.appendChild(this.boardElement);
    }

    /**
     * Establece los estilos para una sección del tablero
     * @param {HTMLElement} element - Elemento de la sección
     * @param {string} section - Nombre de la sección
     */
    setBoardSectionStyles(element, section) {
        const casillaSize = {
            width: this.boardDimensions.casillaWidth,
            height: this.boardDimensions.casillaHeight
        };

        let styles = {
            position: 'absolute',
            display: 'flex',
            zIndex: 2
        };

        switch (section) {
            case 'bottom':
                styles = {
                    ...styles,
                    bottom: '0',
                    left: '0',
                    right: '0',
                    height: `${casillaSize.height}px`,
                    flexDirection: 'row'
                };
                break;
            case 'left':
                styles = {
                    ...styles,
                    left: '0',
                    bottom: `${casillaSize.height}px`,
                    top: `${casillaSize.height}px`,
                    width: `${casillaSize.width}px`,
                    flexDirection: 'column-reverse'
                };
                break;
            case 'top':
                styles = {
                    ...styles,
                    top: '0',
                    left: '0',
                    right: '0',
                    height: `${casillaSize.height}px`,
                    flexDirection: 'row-reverse'
                };
                break;
            case 'right':
                styles = {
                    ...styles,
                    right: '0',
                    bottom: `${casillaSize.height}px`,
                    top: `${casillaSize.height}px`,
                    width: `${casillaSize.width}px`,
                    flexDirection: 'column'
                };
                break;
        }

        Object.assign(element.style, styles);
    }

    /**
     * Crea el área central del tablero
     */
    createCenterArea() {
        const centerArea = document.createElement('div');
        centerArea.className = 'board-center';
        centerArea.innerHTML = `
            <div class="game-logo">
                <h1>MONOPOLY</h1>
                <div class="game-info" id="game-info">
                    <p>Casillas: ${this.totalCasillas}</p>
                </div>
            </div>
        `;

        const casillaSize = this.boardDimensions.casillaHeight;
        centerArea.style.cssText = `
            position: absolute;
            top: ${casillaSize}px;
            left: ${casillaSize}px;
            right: ${casillaSize}px;
            bottom: ${casillaSize}px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #e8f5e8 0%, #c8e6c9 100%);
            border: 2px solid #4caf50;
            z-index: 1;
        `;

        this.boardElement.appendChild(centerArea);
    }

    /**
     * Renderiza todas las secciones del tablero
     * @param {Object} boardData - Datos del tablero
     */
    async renderBoardSections(boardData) {
        const sections = ['bottom', 'left', 'top', 'right'];
        let globalPosition = 0;

        for (const section of sections) {
            const sectionData = boardData[section] || [];
            await this.renderSection(section, sectionData, globalPosition);
            globalPosition += sectionData.length;
        }
    }

    /**
     * Renderiza una sección específica del tablero
     * @param {string} sectionName - Nombre de la sección
     * @param {Array} casillasData - Datos de las casillas de la sección
     * @param {number} startPosition - Posición inicial global
     */
    async renderSection(sectionName, casillasData, startPosition) {
        const sectionElement = document.getElementById(`section-${sectionName}`);
        if (!sectionElement) return;

        casillasData.forEach((casillaData, index) => {
            const globalPosition = startPosition + index;
            const casillaElement = this.createCasillaElement(casillaData, sectionName, globalPosition);
            sectionElement.appendChild(casillaElement);
        });
    }

    /**
     * Crea un elemento HTML para una casilla
     * @param {Object} casillaData - Datos de la casilla
     * @param {string} section - Sección del tablero
     * @param {number} position - Posición global
     * @returns {HTMLElement}
     */
    createCasillaElement(casillaData, section, position) {
        // Sanitizar datos de la casilla
        const sanitizedData = BoardUtils.sanitizeCasillaData(casillaData, position);

        const casillaElement = document.createElement('div');
        casillaElement.className = `casilla casilla-${sanitizedData.type}`;
        casillaElement.id = `casilla-${sanitizedData.id}`;
        casillaElement.dataset.position = position;
        casillaElement.dataset.type = sanitizedData.type;
        casillaElement.dataset.casillaId = sanitizedData.id;

        // Estilos base de la casilla
        this.setCasillaBaseStyles(casillaElement, section);

        // Crear contenido de la casilla
        this.setCasillaContent(casillaElement, sanitizedData);

        // Guardar referencia
        this.casillaElements.set(sanitizedData.id, casillaElement);

        return casillaElement;
    }

    /**
     * Establece los estilos base de una casilla
     * @param {HTMLElement} element - Elemento de la casilla
     * @param {string} section - Sección del tablero
     */
    setCasillaBaseStyles(element, section) {
        const isCorner = ['bottom', 'top'].includes(section);
        const size = isCorner ? 
            { width: this.config.cornerSize, height: this.config.cornerSize } :
            { width: this.boardDimensions.casillaWidth, height: this.boardDimensions.casillaHeight };

        element.style.cssText = `
            width: ${size.width}px;
            height: ${size.height}px;
            border: 2px solid #333;
            background: white;
            display: flex;
            flex-direction: column;
            position: relative;
            box-sizing: border-box;
            overflow: hidden;
            cursor: pointer;
            transition: all 0.3s ease;
        `;
    }

    /**
     * Establece el contenido de una casilla
     * @param {HTMLElement} element - Elemento de la casilla
     * @param {Object} casillaData - Datos sanitizados de la casilla
     */
    setCasillaContent(element, casillaData) {
        let content = '';

        // Barra de color para propiedades
        if (casillaData.color && casillaData.type === 'property') {
            content += `<div class="color-bar" style="background: ${casillaData.color}; height: 20px;"></div>`;
        }

        // Contenido principal
        content += `
            <div class="casilla-content">
                <div class="casilla-name">${casillaData.name}</div>
                ${this.getCasillaSpecificContent(casillaData)}
                <div class="casilla-status" id="status-${casillaData.id}">Disponible</div>
                <div class="players-on-casilla" id="players-${casillaData.id}"></div>
            </div>
        `;

        element.innerHTML = content;
    }

    /**
     * Obtiene contenido específico según el tipo de casilla
     * @param {Object} casillaData - Datos de la casilla
     * @returns {string}
     */
    getCasillaSpecificContent(casillaData) {
        switch (casillaData.type) {
            case 'property':
                return `<div class="casilla-price">$${casillaData.price}</div>`;
            case 'railroad':
                return `
                    <div class="railroad-icon">🚂</div>
                    <div class="casilla-price">$${casillaData.price}</div>
                `;
            case 'tax':
                return `
                    <div class="tax-icon">💸</div>
                    <div class="tax-amount">$${casillaData.action?.amount || 0}</div>
                `;
            case 'go':
                return `<div class="go-text">GO<br>Collect $200</div>`;
            case 'jail':
                return `<div class="jail-text">🔒<br>JAIL</div>`;
            case 'free_parking':
                return `<div class="parking-text">🅿️<br>Free Parking</div>`;
            case 'go_to_jail':
                return `<div class="go-to-jail-text">👮<br>Go to Jail</div>`;
            case 'community_chest':
                return `<div class="card-text">📋<br>Community<br>Chest</div>`;
            case 'chance':
                return `<div class="card-text">❓<br>Chance</div>`;
            default:
                return '';
        }
    }

    /**
     * Actualiza el estado de una casilla
     * @param {number} casillaId - ID de la casilla
     * @param {Object} newState - Nuevo estado de la casilla
     */
    updateCasillaState(casillaId, newState) {
        const casillaElement = this.casillaElements.get(casillaId);
        if (!casillaElement) return;

        const statusElement = document.getElementById(`status-${casillaId}`);
        if (statusElement && newState.status) {
            statusElement.textContent = newState.status;
            statusElement.style.color = newState.statusColor || 'black';
        }

        // Actualizar indicadores de construcción
        if (newState.hasBuildings) {
            this.updateBuildingIndicators(casillaElement, newState);
        }

        // Actualizar indicador de hipoteca
        if (newState.isMortgaged) {
            casillaElement.classList.add('mortgaged');
        } else {
            casillaElement.classList.remove('mortgaged');
        }
    }

    /**
     * Actualiza los indicadores de construcción en una casilla
     * @param {HTMLElement} casillaElement - Elemento de la casilla
     * @param {Object} state - Estado de la casilla
     */
    updateBuildingIndicators(casillaElement, state) {
        let buildingIndicator = casillaElement.querySelector('.building-indicator');
        
        if (!buildingIndicator) {
            buildingIndicator = document.createElement('div');
            buildingIndicator.className = 'building-indicator';
            casillaElement.appendChild(buildingIndicator);
        }

        let indicatorContent = '';
        if (state.hotel) {
            indicatorContent = '🏨';
        } else if (state.houses > 0) {
            indicatorContent = '🏠'.repeat(state.houses);
        }

        buildingIndicator.innerHTML = indicatorContent;
    }

    /**
     * Mueve un jugador de una casilla a otra con animación
     * @param {string} playerId - ID del jugador
     * @param {number} fromCasillaId - ID de la casilla origen
     * @param {number} toCasillaId - ID de la casilla destino
     * @param {string} playerColor - Color del jugador
     */
    async movePlayer(playerId, fromCasillaId, toCasillaId, playerColor) {
        // Remover jugador de la casilla anterior
        if (fromCasillaId !== null) {
            this.removePlayerFromCasilla(playerId, fromCasillaId);
        }

        // Agregar jugador a la nueva casilla
        await this.addPlayerToCasilla(playerId, toCasillaId, playerColor);
    }

    /**
     * Agrega un jugador a una casilla
     * @param {string} playerId - ID del jugador
     * @param {number} casillaId - ID de la casilla
     * @param {string} playerColor - Color del jugador
     */
    async addPlayerToCasilla(playerId, casillaId, playerColor) {
        const playersContainer = document.getElementById(`players-${casillaId}`);
        if (!playersContainer) return;

        // Crear token del jugador si no existe
        if (!this.playerTokens.has(playerId)) {
            const token = document.createElement('div');
            token.className = 'player-token';
            token.id = `token-${playerId}`;
            token.style.cssText = `
                width: 15px;
                height: 15px;
                border-radius: 50%;
                background: ${playerColor};
                border: 2px solid #333;
                margin: 1px;
                display: inline-block;
                animation: ${this.config.animateMovement ? 'tokenBounce 0.5s ease' : 'none'};
            `;
            token.textContent = playerId.toString().charAt(0).toUpperCase();
            this.playerTokens.set(playerId, token);
        }

        const token = this.playerTokens.get(playerId);
        playersContainer.appendChild(token);
    }

    /**
     * Remueve un jugador de una casilla
     * @param {string} playerId - ID del jugador
     * @param {number} casillaId - ID de la casilla
     */
    removePlayerFromCasilla(playerId, casillaId) {
        const token = this.playerTokens.get(playerId);
        if (token && token.parentNode) {
            token.parentNode.removeChild(token);
        }
    }

    /**
     * Hace el tablero responsive
     */
    makeResponsive() {
        const mediaQueries = `
            @media (max-width: 768px) {
                .monopoly-board {
                    transform: scale(0.7);
                    transform-origin: top center;
                }
                .casilla-name {
                    font-size: 10px !important;
                }
            }
            @media (max-width: 480px) {
                .monopoly-board {
                    transform: scale(0.5);
                }
                .casilla-name {
                    font-size: 8px !important;
                }
            }
        `;

        const styleSheet = document.createElement('style');
        styleSheet.textContent = mediaQueries;
        document.head.appendChild(styleSheet);
    }

    /**
     * Renderiza información de debug
     */
    renderDebugInfo() {
        const debugInfo = BoardUtils.getDebugInfo(this.totalCasillas);
        const debugElement = document.createElement('div');
        debugElement.className = 'debug-info';
        debugElement.innerHTML = `
            <h3>Debug Info</h3>
            <pre>${JSON.stringify(debugInfo, null, 2)}</pre>
        `;
        debugElement.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 10px;
            border-radius: 5px;
            font-size: 12px;
            max-width: 300px;
            overflow: auto;
            z-index: 1000;
        `;
        document.body.appendChild(debugElement);
    }

    /**
     * Muestra un error en el contenedor
     * @param {string} message - Mensaje de error
     */
    showError(message) {
        this.container.innerHTML = `
            <div class="board-error">
                <h3>Error al cargar el tablero</h3>
                <p>${message}</p>
                <button onclick="location.reload()">Reintentar</button>
            </div>
        `;
    }

    /**
     * Limpia el tablero actual
     */
    clearBoard() {
        if (this.boardElement) {
            this.container.removeChild(this.boardElement);
        }
        this.casillaElements.clear();
        this.playerTokens.clear();
    }

    /**
     * Obtiene el elemento de una casilla
     * @param {number} casillaId - ID de la casilla
     * @returns {HTMLElement|null}
     */
    getCasillaElement(casillaId) {
        return this.casillaElements.get(casillaId) || null;
    }

    /**
     * Inyecta los estilos CSS necesarios
     */
    injectStyles() {
        const styles = `
            .monopoly-board {
                font-family: 'Arial', sans-serif;
                user-select: none;
            }
            .casilla {
                transition: transform 0.2s ease;
            }
            .casilla:hover {
                transform: scale(1.05);
                z-index: 10;
            }
            .casilla-content {
                padding: 2px;
                text-align: center;
                height: 100%;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
            }
            .casilla-name {
                font-weight: bold;
                font-size: 12px;
                line-height: 1.2;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .casilla-price {
                font-size: 10px;
                color: #2e7d32;
                font-weight: bold;
            }
            .casilla-status {
                font-size: 9px;
                padding: 2px;
                background: rgba(255,255,255,0.8);
                border-radius: 3px;
            }
            .players-on-casilla {
                min-height: 20px;
                display: flex;
                flex-wrap: wrap;
                justify-content: center;
                align-items: center;
            }
            .player-token {
                font-size: 8px;
                color: white;
                text-align: center;
                line-height: 11px;
                font-weight: bold;
            }
            .mortgaged {
                opacity: 0.6;
                background: repeating-linear-gradient(
                    45deg,
                    #f0f0f0,
                    #f0f0f0 10px,
                    #ddd 10px,
                    #ddd 20px
                );
            }
            .building-indicator {
                position: absolute;
                top: 22px;
                right: 2px;
                font-size: 12px;
                line-height: 1;
            }
            .game-logo h1 {
                font-size: 24px;
                color: #2e7d32;
                margin: 0;
                text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
            }
            .board-error {
                text-align: center;
                padding: 50px;
                color: #d32f2f;
            }
            @keyframes tokenBounce {
                0%, 20%, 60%, 100% { transform: translateY(0); }
                40% { transform: translateY(-10px); }
                80% { transform: translateY(-5px); }
            }
        `;

        const styleSheet = document.createElement('style');
        styleSheet.textContent = styles;
        document.head.appendChild(styleSheet);
    }

    /**
     * Destructor para limpiar recursos
     */
    destroy() {
        this.clearBoard();
        this.playerTokens.clear();
        this.casillaElements.clear();
    }
}