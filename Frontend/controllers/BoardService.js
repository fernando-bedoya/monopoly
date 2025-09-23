/**
 * BoardService - Servicio para manejar las llamadas a la API del tablero de Monopoly
 * Gestiona la comunicación con el backend y el manejo de errores
 */
class BoardService {
    constructor(baseUrl = 'http://127.0.0.1:5000') {
        this.baseUrl = baseUrl;
        this.boardEndpoint = '/board';
        this.cache = new Map();
        this.requestTimeout = 10000; // 10 segundos
        this.retryAttempts = 3;
        this.retryDelay = 1000; // 1 segundo
    }

    /**
     * Obtiene los datos del tablero desde el backend
     * @param {boolean} useCache - Si debe usar caché o forzar nueva petición
     * @returns {Promise<Object>} Datos del tablero
     */
    async getBoardData(useCache = true) {
        const cacheKey = 'boardData';
        
        // Verificar caché si está habilitado
        if (useCache && this.cache.has(cacheKey)) {
            const cachedData = this.cache.get(cacheKey);
            if (this.isCacheValid(cachedData)) {
                console.log('Usando datos del tablero desde caché');
                return cachedData.data;
            }
        }

        try {
            console.log('Obteniendo datos del tablero desde API...');
            const boardData = await this.makeRequest(this.boardEndpoint);
            
            // Validar estructura de datos
            this.validateBoardData(boardData);
            
            // Guardar en caché
            this.cache.set(cacheKey, {
                data: boardData,
                timestamp: Date.now()
            });

            console.log('Datos del tablero obtenidos exitosamente');
            return boardData;

        } catch (error) {
            console.error('Error obteniendo datos del tablero:', error);
            throw new BoardServiceError('No se pudieron cargar los datos del tablero', error);
        }
    }

    /**
     * Realiza una petición HTTP con reintentos automáticos
     * @param {string} endpoint - Endpoint a consultar
     * @param {Object} options - Opciones de la petición
     * @returns {Promise<Object>} Respuesta de la API
     */
    async makeRequest(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const requestOptions = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                ...options.headers
            },
            signal: this.createTimeoutSignal(),
            ...options
        };

        let lastError = null;

        for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
            try {
                console.log(`Intento ${attempt}/${this.retryAttempts}: ${url}`);
                
                const response = await fetch(url, requestOptions);
                
                if (!response.ok) {
                    throw new NetworkError(
                        `HTTP ${response.status}: ${response.statusText}`,
                        response.status
                    );
                }

                const contentType = response.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                    throw new DataError('La respuesta no es JSON válido');
                }

                const data = await response.json();
                return data;

            } catch (error) {
                lastError = error;
                
                if (error.name === 'AbortError') {
                    throw new TimeoutError('La petición excedió el tiempo límite');
                }
                
                if (error instanceof NetworkError && error.status >= 400 && error.status < 500) {
                    // No reintentar errores de cliente (4xx)
                    throw error;
                }

                if (attempt < this.retryAttempts) {
                    console.warn(`Intento ${attempt} falló, reintentando en ${this.retryDelay}ms:`, error.message);
                    await this.delay(this.retryDelay * attempt); // Backoff exponencial
                }
            }
        }

        throw new BoardServiceError(`Falló después de ${this.retryAttempts} intentos`, lastError);
    }

    /**
     * Crea un signal para timeout de peticiones
     * @returns {AbortSignal}
     */
    createTimeoutSignal() {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), this.requestTimeout);
        return controller.signal;
    }

    /**
     * Valida la estructura de los datos del tablero
     * @param {Object} boardData - Datos a validar
     * @throws {DataError} Si los datos son inválidos
     */
    validateBoardData(boardData) {
        if (!boardData || typeof boardData !== 'object') {
            throw new DataError('Los datos del tablero no son un objeto válido');
        }

        const requiredSections = ['bottom', 'left', 'top', 'right'];
        const missingSections = [];

        for (const section of requiredSections) {
            if (!Array.isArray(boardData[section])) {
                missingSections.push(section);
            }
        }

        if (missingSections.length > 0) {
            throw new DataError(`Secciones faltantes o inválidas: ${missingSections.join(', ')}`);
        }

        // Validar que hay casillas en cada sección
        const emptySections = requiredSections.filter(section => 
            boardData[section].length === 0
        );

        if (emptySections.length > 0) {
            console.warn(`Secciones vacías detectadas: ${emptySections.join(', ')}`);
        }

        // Validar total de casillas
        const totalCasillas = requiredSections.reduce((total, section) => 
            total + boardData[section].length, 0);

        if (totalCasillas < 20) {
            throw new DataError(`Muy pocas casillas: ${totalCasillas}. Se requieren al menos 20`);
        }

        if (totalCasillas % 4 !== 0) {
            console.warn(`Número de casillas no es múltiplo de 4: ${totalCasillas}`);
        }

        // Validar estructura básica de cada casilla
        this.validateCasillasStructure(boardData);
    }

    /**
     * Valida la estructura básica de las casillas
     * @param {Object} boardData - Datos del tablero
     */
    validateCasillasStructure(boardData) {
        const requiredSections = ['bottom', 'left', 'top', 'right'];
        const invalidCasillas = [];

        for (const section of requiredSections) {
            boardData[section].forEach((casilla, index) => {
                if (!casilla || typeof casilla !== 'object') {
                    invalidCasillas.push(`${section}[${index}]: no es un objeto`);
                    return;
                }

                if (!casilla.hasOwnProperty('id')) {
                    invalidCasillas.push(`${section}[${index}]: falta 'id'`);
                }

                if (!casilla.name || typeof casilla.name !== 'string') {
                    invalidCasillas.push(`${section}[${index}]: 'name' inválido`);
                }

                if (!casilla.type || typeof casilla.type !== 'string') {
                    invalidCasillas.push(`${section}[${index}]: 'type' inválido`);
                }
            });
        }

        if (invalidCasillas.length > 0) {
            console.error('Casillas con estructura inválida:', invalidCasillas);
            throw new DataError(`Estructura de casillas inválida: ${invalidCasillas.slice(0, 5).join(', ')}`);
        }
    }

    /**
     * Verifica si los datos en caché siguen siendo válidos
     * @param {Object} cachedData - Datos en caché
     * @returns {boolean}
     */
    isCacheValid(cachedData) {
        if (!cachedData || !cachedData.timestamp) return false;
        
        const cacheAge = Date.now() - cachedData.timestamp;
        const maxAge = 5 * 60 * 1000; // 5 minutos
        
        return cacheAge < maxAge;
    }

    /**
     * Limpia la caché
     */
    clearCache() {
        this.cache.clear();
        console.log('Caché del BoardService limpiada');
    }

    /**
     * Obtiene estadísticas de la caché
     * @returns {Object}
     */
    getCacheStats() {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys()),
            lastUpdate: this.cache.has('boardData') ? 
                new Date(this.cache.get('boardData').timestamp).toISOString() : null
        };
    }

    /**
     * Verifica la conectividad con el backend
     * @returns {Promise<boolean>}
     */
    async checkConnectivity() {
        try {
            const response = await fetch(`${this.baseUrl}/health`, {
                method: 'GET',
                signal: this.createTimeoutSignal()
            });
            return response.ok;
        } catch (error) {
            console.warn('Backend no disponible:', error.message);
            return false;
        }
    }

    /**
     * Reinicia el servicio con nueva configuración
     * @param {Object} config - Nueva configuración
     */
    configure(config) {
        if (config.baseUrl) this.baseUrl = config.baseUrl;
        if (config.timeout) this.requestTimeout = config.timeout;
        if (config.retryAttempts) this.retryAttempts = config.retryAttempts;
        if (config.retryDelay) this.retryDelay = config.retryDelay;
        
        console.log('BoardService reconfigurado:', config);
    }

    /**
     * Función helper para delay
     * @param {number} ms - Milisegundos a esperar
     * @returns {Promise}
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Obtiene información de diagnóstico del servicio
     * @returns {Object}
     */
    getDiagnosticInfo() {
        return {
            baseUrl: this.baseUrl,
            boardEndpoint: this.boardEndpoint,
            requestTimeout: this.requestTimeout,
            retryAttempts: this.retryAttempts,
            retryDelay: this.retryDelay,
            cacheStats: this.getCacheStats()
        };
    }
}

/**
 * Clase base para errores del BoardService
 */
class BoardServiceError extends Error {
    constructor(message, originalError = null) {
        super(message);
        this.name = 'BoardServiceError';
        this.originalError = originalError;
        this.timestamp = new Date().toISOString();
    }
}

/**
 * Error de red o comunicación
 */
class NetworkError extends BoardServiceError {
    constructor(message, statusCode = null) {
        super(message);
        this.name = 'NetworkError';
        this.status = statusCode;
    }
}

/**
 * Error de datos/formato
 */
class DataError extends BoardServiceError {
    constructor(message) {
        super(message);
        this.name = 'DataError';
    }
}

/**
 * Error de timeout
 */
class TimeoutError extends BoardServiceError {
    constructor(message) {
        super(message);
        this.name = 'TimeoutError';
    }
}

// Exportar para uso en módulos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        BoardService, 
        BoardServiceError, 
        NetworkError, 
        DataError, 
        TimeoutError 
    };
}

// Crear instancia global para uso directo
window.boardService = window.boardService || new BoardService();