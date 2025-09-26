/**
 * Script principal para la página de inicio del Monopoly
 * Maneja los modales de configuración del juego y la inicialización
 */

// Cargar los modales y configurar los eventos cuando se carga la página
document.addEventListener('DOMContentLoaded', function() {
  // Cargar el HTML de los modales
  fetch('views/modals.html')
    .then(res => res.text())
    .then(html => {
      document.getElementById('modales-container').innerHTML = html;
      inicializarEventos();
    })
    .catch(error => {
      console.error('Error al cargar los modales:', error);
    });
});

/**
 * Inicializa todos los eventos de los modales y botones
 */
function inicializarEventos() {
  // Mostrar el primer modal al hacer clic en NUEVO JUEGO
  document.getElementById('btnNuevoJuego').addEventListener('click', () => {
    const modalJugadores = new bootstrap.Modal(document.getElementById('modalJugadores'));
    modalJugadores.show();
  });

  // Al hacer clic en "Siguiente", mostrar el segundo modal y generar los campos
  document.getElementById('btnSiguiente').addEventListener('click', () => {
    const num = document.getElementById('numJugadores').value;
    generarCamposNicknames(num);

    const modalJugadores = bootstrap.Modal.getInstance(document.getElementById('modalJugadores'));
    modalJugadores.hide();

    const modalDatos = new bootstrap.Modal(document.getElementById('modalDatosJugadores'));
    modalDatos.show();
  });

  // Manejar el botón "Iniciar Juego" del segundo modal
  document.getElementById('btnIniciar').addEventListener('click', () => {
    // Recoger los datos de los jugadores
    const numJugadores = document.getElementById('numJugadores').value;
    const jugadores = [];
    
    for (let i = 1; i <= numJugadores; i++) {
      const jugador = {
        nickname: document.getElementById(`nickname${i}`).value || `Jugador ${i}`,
        pais: document.getElementById(`pais${i}`).value,
        color: document.getElementById(`color${i}`).value,
        ficha: document.getElementById(`ficha${i}`).value
      };
      jugadores.push(jugador);
    }
    
    // Guardar los datos en localStorage para usarlos en el juego
    localStorage.setItem('jugadores', JSON.stringify(jugadores));
    localStorage.setItem('numJugadores', numJugadores);
    
    // Cerrar el modal
    const modalDatos = bootstrap.Modal.getInstance(document.getElementById('modalDatosJugadores'));
    modalDatos.hide();
    
    // Redirigir al tablero del juego
    window.location.href = 'views/game.html';
  });
}

/**
 * Función para generar campos de nickname, país, color y ficha
 * @param {number} num - Número de jugadores
 */
function generarCamposNicknames(num) {
  const container = document.getElementById('nicknamesContainer');
  container.innerHTML = '';
  
  const colores = ['Rojo', 'Azul', 'Verde', 'Amarillo'];
  const fichas = ['Auto', 'Sombrero', 'Barco', 'Perro'];
  const paises = [
    {codigo: 'CO', nombre: 'Colombia', bandera: '🇨🇴'},
    {codigo: 'MX', nombre: 'México', bandera: '🇲🇽'},
    {codigo: 'ES', nombre: 'España', bandera: '🇪🇸'},
    {codigo: 'AR', nombre: 'Argentina', bandera: '🇦🇷'}
  ];
  
  for (let i = 1; i <= num; i++) {
    container.innerHTML += `
      <div class="mb-2 border rounded p-2">
        <label for="nickname${i}" class="form-label">Nickname Jugador ${i}</label>
        <input type="text" class="form-control mb-2" id="nickname${i}" placeholder="Jugador ${i}" required>
        <label for="pais${i}" class="form-label">País</label>
        <select class="form-select mb-2" id="pais${i}">
          ${paises.map(p => `<option value="${p.codigo}">${p.bandera} ${p.nombre}</option>`).join('')}
        </select>
        <label for="color${i}" class="form-label">Color de ficha</label>
        <select class="form-select mb-2" id="color${i}">
          ${colores.map(c => `<option value="${c}">${c}</option>`).join('')}
        </select>
        <label for="ficha${i}" class="form-label">Tipo de ficha</label>
        <select class="form-select" id="ficha${i}">
          ${fichas.map(f => `<option value="${f}">${f}</option>`).join('')}
        </select>
      </div>
    `;
  }
}