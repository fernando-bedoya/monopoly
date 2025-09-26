/**
 * Servicio para manejo del ranking de jugadores
 * Incluye funciones para obtener y mostrar el ranking desde el backend
 */

class RankingService {
    constructor() {
        this.baseUrl = 'http://127.0.0.1:5000';
    }

    /**
     * Obtiene el ranking desde el backend
     * @returns {Promise<Array>} Lista de jugadores ordenada por puntaje
     */
    async obtenerRanking() {
        try {
            const response = await fetch(`${this.baseUrl}/ranking`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return Array.isArray(data) ? data : [];
        } catch (error) {
            console.error('❌ Error al obtener ranking:', error);
            throw error;
        }
    }

    /**
     * Envía un puntaje al backend
     * @param {string} nickname - Nombre del jugador
     * @param {number} score - Puntaje obtenido
     * @param {string} countryCode - Código del país (ej: 'co', 'us', 'es')
     * @returns {Promise<Object>} Respuesta del servidor
     */
    async enviarPuntaje(nickname, score, countryCode = 'co') {
        try {
            const body = {
                nick_name: nickname,
                score: score,
                country_code: countryCode.toLowerCase()
            };

            console.log(`📤 Enviando puntaje: ${nickname} - $${score} (${countryCode})`);

            const response = await fetch(`${this.baseUrl}/score-recorder`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log(`✅ Puntaje enviado exitosamente para ${nickname}:`, data);
            return data;
        } catch (error) {
            console.error('❌ Error al enviar puntaje:', error);
            throw error;
        }
    }

    /**
     * Envía múltiples puntajes al backend
     * @param {Array} jugadores - Array de objetos con {nickname, score, countryCode}
     * @returns {Promise<boolean>} true si todos se enviaron correctamente
     */
    async enviarMultiplesPuntajes(jugadores) {
        try {
            const promesas = jugadores.map(jugador => 
                this.enviarPuntaje(jugador.nickname, jugador.score, jugador.countryCode)
            );

            await Promise.all(promesas);
            console.log('🎉 Todos los puntajes enviados exitosamente');
            return true;
        } catch (error) {
            console.error('❌ Error al enviar múltiples puntajes:', error);
            return false;
        }
    }

    /**
     * Obtiene la URL de la bandera de un país
     * @param {string} countryCode - Código del país
     * @param {string} size - Tamaño de la bandera ('flat' por defecto)
     * @param {number} resolution - Resolución (32, 64, etc.)
     * @returns {string} URL de la bandera
     */
    obtenerUrlBandera(countryCode, size = 'flat', resolution = 32) {
        return `https://flagsapi.com/${countryCode.toUpperCase()}/${size}/${resolution}.png`;
    }

    /**
     * Formatea un puntaje con separadores de miles
     * @param {number} score - Puntaje a formatear
     * @returns {string} Puntaje formateado
     */
    formatearPuntaje(score) {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(score);
    }

    /**
     * Guarda puntajes localmente como respaldo
     * @param {Array} jugadores - Array de jugadores con puntajes
     */
    guardarRankingLocal(jugadores) {
        try {
            const rankingLocal = {
                fecha: new Date().toISOString(),
                jugadores: jugadores
            };
            localStorage.setItem('rankingBackup', JSON.stringify(rankingLocal));
            console.log('💾 Ranking guardado localmente como respaldo');
        } catch (error) {
            console.error('❌ Error al guardar ranking local:', error);
        }
    }

    /**
     * Obtiene el ranking local guardado
     * @returns {Array} Ranking local o array vacío
     */
    obtenerRankingLocal() {
        try {
            const ranking = localStorage.getItem('rankingBackup');
            if (ranking) {
                const data = JSON.parse(ranking);
                return data.jugadores || [];
            }
        } catch (error) {
            console.error('❌ Error al obtener ranking local:', error);
        }
        return [];
    }

    /**
     * Verifica si el backend está disponible
     * @returns {Promise<boolean>} true si el backend responde
     */
    async verificarConexionBackend() {
        try {
            const response = await fetch(`${this.baseUrl}/ranking`, {
                method: 'GET',
                timeout: 5000
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }
}

// Crear instancia global del servicio
const rankingService = new RankingService();

// Exportar para uso en módulos ES6
export default rankingService;

// También hacer disponible globalmente para scripts no-module
window.rankingService = rankingService;
