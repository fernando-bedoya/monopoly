const API_URL = "http://localhost:5000";

// Obtener ranking
export async function getRanking() {
  try {
    const response = await fetch(`${API_URL}/ranking`);
    return await response.json();
  } catch (error) {
    console.error("Error obteniendo ranking:", error);
  }
}

// Obtener tablero
export async function getBoard() {
  try {
    const response = await fetch(`${API_URL}/board`);
    return await response.json();
  } catch (error) {
    console.error("Error obteniendo board:", error);
  }
}

// Obtener países
export async function getCountries() {
  try {
    const response = await fetch(`${API_URL}/countries`);
    return await response.json();
  } catch (error) {
    console.error("Error obteniendo países:", error);
  }
}

// Enviar puntaje
export async function sendScore(nick, score, country_code) {
  try {
    const response = await fetch(`${API_URL}/score-recorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nick_name: nick, score, country_code }),
    });
    return await response.json();
  } catch (error) {
    console.error("Error enviando score:", error);
  }
}
