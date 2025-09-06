const API_URL = "http://127.0.0.1:5000";

export async function getCountries() {
  return fetch(`${API_URL}/countries`).then(res => res.json());
}

export async function getBoard() {
  return fetch(`${API_URL}/board`).then(res => res.json());
}

export async function getRanking() {
  return fetch(`${API_URL}/ranking`).then(res => res.json());
}

export async function sendScore(nick, score, country_code) {
  return fetch(`${API_URL}/score-recorder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nick_name: nick, score, country_code }),
  }).then(res => res.json());
}
