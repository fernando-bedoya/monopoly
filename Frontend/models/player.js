import { 
    getRanking, 
    getBoard, 
    getCountries, 
    sendScore,
    getSurpriseCard,
    getCommunityCard,
    initializeAPI,
    formatPlayerData,
    validateScoreData,
    getFlagUrl
} from '../controllers/api.js';

// ========== CLASE PLAYER (con integración API) ==========
class Player {
    constructor(nickname, countryCode, color) {
        if (!nickname || nickname.trim() === "") {
            throw new Error("El nickname es requerido");
        }
        if (!countryCode || countryCode.length !== 2) {
            throw new Error("El código de país debe tener 2 caracteres");
        }
        if (!color || color.trim() === "") {
            throw new Error("El color es requerido");
        }

        this.nickname = nickname.trim();
        this.countryCode = countryCode.toUpperCase();
        this.color = color.toLowerCase();
        this.dinero = 1500;
        this.posicion = 0;
        this.propiedades = [];
        this.propiedadesHipotecadas = [];
        this.casas = 0;
        this.hoteles = 0;
        this.estaEnCarcel = false;
        this.turnosCarcel = 0;
    }

    // Método estático para validar código de país con la API
    static async validateCountryCode(countryCode) {
        try {
            const countries = await getCountries();
            const validCountry = countries.find(country => 
                country.code === countryCode.toUpperCase()
            );
            return {
                isValid: !!validCountry,
                country: validCountry || null
            };
        } catch (error) {
            console.error('Error validando código de país:', error);
            return {
                isValid: false,
                country: null,
                error: error.message
            };
        }
    }

    // Método estático para crear un jugador con validación de país
    static async create(nickname, countryCode, color) {
        try {
            // Validar código de país usando la API
            const countryValidation = await Player.validateCountryCode(countryCode);
            
            if (!countryValidation.isValid) {
                throw new Error(`Código de país inválido: ${countryCode}. ${countryValidation.error || 'País no encontrado en la API'}`);
            }

            // Crear el jugador si la validación es exitosa
            const player = new Player(nickname, countryCode, color);
            player.countryInfo = countryValidation.country; // Guardar info adicional del país
            
            return {
                success: true,
                player: player,
                countryInfo: countryValidation.country
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Método para obtener información del país del jugador
    async getCountryInfo() {
        if (this.countryInfo) {
            return this.countryInfo;
        }
        
        try {
            const countries = await getCountries();
            this.countryInfo = countries.find(country => 
                country.code === this.countryCode
            );
            return this.countryInfo;
        } catch (error) {
            console.error('Error obteniendo información del país:', error);
            return null;
        }
    }

    // Método para enviar puntaje usando la API
    async submitScore() {
        try {
            const scoreData = formatPlayerData(this);
            const validation = validateScoreData(scoreData.nick_name, scoreData.score, scoreData.country_code);
            
            if (!validation.isValid) {
                throw new Error(`Datos inválidos: ${validation.errors.join(', ')}`);
            }
            
            const result = await sendScore(scoreData.nick_name, scoreData.score, scoreData.country_code);
            return { success: true, data: result };
        } catch (error) {
            console.error('Error enviando puntaje:', error);
            return { success: false, error: error.message };
        }
    }

    // Método para obtener bandera del jugador
    getFlagUrl(size = 32) {
        return getFlagUrl(this.countryCode, size);
    }

    // Resto de métodos de la clase Player...
    move(steps) {
        this.posicion = (this.posicion + steps) % 40;
        if (this.posicion < steps && steps > 0) {
            this.receiveMoney(200);
        }
    }

    receiveMoney(amount) {
        this.dinero += amount;
    }

    payMoney(amount) {
        if (this.dinero >= amount) {
            this.dinero -= amount;
            return true;
        }
        return false;
    }

    buyProperty(property) {
        if (this.dinero >= property.price) {
            this.payMoney(property.price);
            this.propiedades.push(property);
            property.owner = this.nickname;
            return true;
        }
        return false;
    }

    calculateNetWorth() {
        let netWorth = this.dinero;
        
        this.propiedades.forEach(property => {
            if (!property.isMortgaged) {
                netWorth += property.price;
                netWorth += (property.houses * 100);
                netWorth += (property.hotels * 200);
            }
        });

        this.propiedadesHipotecadas.forEach(property => {
            netWorth -= property.mortgage;
        });

        return netWorth;
    }

    getPlayerInfo() {
        return {
            nickname: this.nickname,
            countryCode: this.countryCode,
            color: this.color,
            money: this.dinero,
            position: this.posicion,
            properties: this.propiedades.length,
            mortgagedProperties: this.propiedadesHipotecadas.length,
            isInJail: this.estaEnCarcel,
            jailTurns: this.turnosCarcel,
            netWorth: this.calculateNetWorth(),
            flagUrl: this.getFlagUrl(),
            countryInfo: this.countryInfo
        };
    }
}

export { Player };