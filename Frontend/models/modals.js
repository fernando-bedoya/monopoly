/**
 * Script para manejar los modales del juego
 */
document.addEventListener('DOMContentLoaded', function() {
  // Referencias a elementos del DOM
  const modalJugadores = new bootstrap.Modal(document.getElementById('modalJugadores'), {
    backdrop: 'static',
    keyboard: false
  });
  
  const modalDatosJugadores = new bootstrap.Modal(document.getElementById('modalDatosJugadores'), {
    backdrop: 'static',
    keyboard: false
  });
  
  const numJugadoresSelect = document.getElementById('numJugadores');
  const btnIniciar = document.getElementById('btnIniciar');
  const btnConfirmarJugadores = document.getElementById('btnConfirmarJugadores');
  const formDatosJugadores = document.getElementById('formDatosJugadores');
  
  // Mostrar modal de selección de número de jugadores al inicio
  setTimeout(() => {
    modalJugadores.show();
  }, 500);
  
  // Evento para el botón de iniciar juego
  btnIniciar.addEventListener('click', function() {
    const numJugadores = parseInt(numJugadoresSelect.value);
    
    // Validar que se haya seleccionado un número de jugadores
    if (isNaN(numJugadores) || numJugadores < 2 || numJugadores > 4) {
      alert('Por favor seleccione un número válido de jugadores.');
      return;
    }
    
    // Ocultar modal actual
    modalJugadores.hide();
    
    // Cargar países desde la API
    cargarPaises().then(paises => {
      // Generar campos para datos de jugadores con países
      generarCamposDatosJugadores(numJugadores, paises);
      
      // Mostrar modal de datos de jugadores
      modalDatosJugadores.show();
    }).catch(error => {
      console.error('Error al cargar países:', error);
      
      // Si falla, mostrar sin países
      generarCamposDatosJugadores(numJugadores, []);
      modalDatosJugadores.show();
    });
  });
  
  /**
   * Carga la lista de países desde la API
   * @returns {Promise} Promesa con la lista de países
   */
  function cargarPaises() {
    return fetch('http://127.0.0.1:5000/countries')
      .then(response => {
        if (!response.ok) {
          throw new Error(`Error HTTP: ${response.status}`);
        }
        return response.json();
      });
  }
  
  /**
   * Genera los campos de datos para cada jugador
   * @param {number} numJugadores - Número de jugadores
   * @param {Array} paises - Lista de países
   */
  function generarCamposDatosJugadores(numJugadores, paises) {
    formDatosJugadores.innerHTML = '';
    
    // Colores predefinidos para los jugadores
    const colores = ['#FF0000', '#0000FF', '#008000', '#FFA500'];
    
    // Fichas predefinidas para los jugadores
    const fichas = ['🚗', '🚢', '🛩️', '🚂', '🏍️', '🐶', '🐱', '👑'];
    
    for (let i = 1; i <= numJugadores; i++) {
      const jugadorRow = document.createElement('div');
      jugadorRow.classList.add('row', 'mb-3');
      
      // HTML para los campos de jugador
      let paisesHTML = '';
      
      if (paises && paises.length > 0) {
        paisesHTML = `
          <div class="col-md-3">
            <label for="pais${i}" class="form-label">País:</label>
            <select class="form-select" id="pais${i}" name="pais${i}" required>
              <option value="" selected disabled>Selecciona...</option>
              ${paises.map(pais => `<option value="${pais.code}">${pais.name}</option>`).join('')}
            </select>
          </div>
        `;
      }
      
      jugadorRow.innerHTML = `
        <h5>Jugador ${i}</h5>
        <div class="col-md-${paises && paises.length > 0 ? '3' : '6'}">
          <label for="nombre${i}" class="form-label">Nombre:</label>
          <input type="text" class="form-control" id="nombre${i}" name="nombre${i}" required>
        </div>
        ${paisesHTML}
        <div class="col-md-3">
          <label for="ficha${i}" class="form-label">Ficha:</label>
          <select class="form-select" id="ficha${i}" name="ficha${i}" required>
            ${fichas.map(ficha => `<option value="${ficha}">${ficha}</option>`).join('')}
          </select>
        </div>
        <div class="col-md-3">
          <label for="color${i}" class="form-label">Color:</label>
          <input type="color" class="form-control" id="color${i}" name="color${i}" value="${colores[i-1] || '#000000'}" required>
        </div>
      `;
      
      formDatosJugadores.appendChild(jugadorRow);
    }
  }
  
  // Evento para el botón de confirmar jugadores
  btnConfirmarJugadores.addEventListener('click', function() {
    // Verificar que todos los campos estén llenos
    const inputs = formDatosJugadores.querySelectorAll('input[required], select[required]');
    let formValido = true;
    
    inputs.forEach(input => {
      if (!input.value) {
        input.classList.add('is-invalid');
        formValido = false;
      } else {
        input.classList.remove('is-invalid');
      }
    });
    
    if (!formValido) {
      alert('Por favor complete todos los campos.');
      return;
    }
    
    // Recopilar datos de jugadores
    const datosJugadores = [];
    const numJugadores = parseInt(numJugadoresSelect.value);
    
    for (let i = 1; i <= numJugadores; i++) {
      datosJugadores.push({
        nombre: document.getElementById(`nombre${i}`).value,
        ficha: document.getElementById(`ficha${i}`).value,
        color: document.getElementById(`color${i}`).value,
        pais: document.getElementById(`pais${i}`)?.value || 'XX'
      });
    }
    
    // Ocultar modal
    modalDatosJugadores.hide();
    
    // Crear evento personalizado con los datos de los jugadores
    const eventoJugadores = new CustomEvent('jugadoresConfirmados', {
      detail: { jugadores: datosJugadores }
    });
    
    // Disparar evento
    document.dispatchEvent(eventoJugadores);
    
    console.log('Jugadores confirmados:', datosJugadores);
  });
  
  // Botón de ranking
  const btnRanking = document.getElementById('btnRanking');
  if (btnRanking) {
    btnRanking.addEventListener('click', function() {
      // Importar dinámicamente el módulo API
      import('./api.mjs').then(module => {
        const { getRanking } = module;
        
        // Obtener y mostrar ranking
        getRanking().then(ranking => {
          mostrarRanking(ranking);
        }).catch(error => {
          console.error('Error al obtener ranking:', error);
          alert('No se pudo cargar el ranking de jugadores.');
        });
      }).catch(error => {
        console.error('Error al importar módulo API:', error);
        alert('Error en el sistema de ranking.');
      });
    });
  }
  
  /**
   * Muestra el ranking en un modal
   * @param {Array} ranking - Datos del ranking
   */
  function mostrarRanking(ranking) {
    // Crear HTML para el ranking
    let rankingHTML = '';
    
    if (ranking && ranking.length > 0) {
      rankingHTML = `
        <table class="table table-striped">
          <thead>
            <tr>
              <th>#</th>
              <th>Jugador</th>
              <th>País</th>
              <th>Puntuación</th>
            </tr>
          </thead>
          <tbody>
            ${ranking.map((item, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${item.nick_name}</td>
                <td>${item.country_code ? `<img src="https://flagcdn.com/16x12/${item.country_code.toLowerCase()}.png" alt="${item.country_code}">` : ''}</td>
                <td>${item.score}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else {
      rankingHTML = '<p class="text-center">No hay datos de ranking disponibles.</p>';
    }
    
    // Crear modal para mostrar ranking
    const modalRankingHTML = `
      <div class="modal fade" id="modalRanking" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header bg-primary text-white">
              <h5 class="modal-title">Ranking Global</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              ${rankingHTML}
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Añadir modal al DOM
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalRankingHTML;
    document.body.appendChild(modalContainer);
    
    // Mostrar modal
    const modalRanking = new bootstrap.Modal(document.getElementById('modalRanking'));
    modalRanking.show();
    
    // Eliminar modal del DOM cuando se cierre
    document.getElementById('modalRanking').addEventListener('hidden.bs.modal', function () {
      document.body.removeChild(modalContainer);
    });
  }
});
