const API_URL = "http://127.0.0.1:5000";

export async function getCountries() {
  return fetch(`${API_URL}/countries`).then(res => res.json());
}

export async function getBoard() {
  return fetch(`${API_URL}/board`).then(res => res.json());
}

import { getRanking } from './api.mjs';

document.addEventListener("DOMContentLoaded", function () {
    let btnCargar = document.getElementById("cargarRanking");
    let tablaRanking = document.getElementById("tablaRanking");

    btnCargar.addEventListener("click", cargarRanking);

    async function cargarRanking() {
        const ranking = await getRanking();
        tablaRanking.innerHTML = ""; // Limpiar contenido previo
        ranking.forEach(jugador => {
            tablaRanking.innerHTML += `
                <tr id="jugador-${jugador.id}">
                    <td>${jugador.nick_name}</td>
                    <td>${jugador.score}</td>
                    <td>${jugador.country_code}</td>
                </tr>
            `;
        });
    }
});

export async function sendScore(nick, score, country_code) {
  return fetch(`${API_URL}/score-recorder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nick_name: nick, score, country_code }),
  }).then(res => res.json());
}
