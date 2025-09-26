/**
 * Script principal para la página de inicio del Monopoly
 * Maneja los modales de configuración del juego y la inicialización
 */

// Importar funciones de la API
import { sendScore, getCountries } from '../controllers/api.js';

// Variables globales
let paisesDisponibles = [];

// Función para cargar países desde el backend
async function cargarPaises() {
  try {
    console.log('Intentando cargar países del backend...');
    const paisesRaw = await getCountries();
    console.log('Datos raw del backend:', paisesRaw);
    console.log('Tipo de datos:', typeof paisesRaw);
    console.log('Es array:', Array.isArray(paisesRaw));
    console.log('Longitud:', paisesRaw?.length);
    
    // Verificar que los datos sean válidos
    if (!paisesRaw || !Array.isArray(paisesRaw) || paisesRaw.length === 0) {
      console.log('❌ Datos inválidos detectados:');
      console.log('  - paisesRaw existe:', !!paisesRaw);
      console.log('  - es array:', Array.isArray(paisesRaw));
      console.log('  - longitud:', paisesRaw?.length);
      
      if (Array.isArray(paisesRaw) && paisesRaw.length === 0) {
        throw new Error('El backend está funcionando pero devolvió un array vacío. Verifica que el backend se ejecute desde su directorio: cd Backend && python3 app.py');
      } else {
        throw new Error(`El backend devolvió datos inválidos: ${JSON.stringify(paisesRaw)}`);
      }
    }
    
    // Convertir la estructura del backend a la estructura que necesitamos
    // Backend: [{"ad": "Andorra"}, {"ae": "Emiratos Árabes Unidos"}]
    // Frontend necesita: [{code: "AD", name: "Andorra"}, {code: "AE", name: "Emiratos Árabes Unidos"}]
    paisesDisponibles = paisesRaw.map(paisObj => {
      const codigo = Object.keys(paisObj)[0]; // Obtener la clave (ej: "ad")
      const nombre = paisObj[codigo]; // Obtener el valor (ej: "Andorra")
      return {
        code: codigo.toUpperCase(), // Convertir a mayúsculas para FlagsAPI
        name: nombre
      };
    });
    
    console.log(`✅ Países cargados del backend: ${paisesDisponibles.length} países`);
  } catch (error) {
    console.error('❌ Error al cargar países del backend:', error);
    paisesDisponibles = []; // Asegurar que esté vacío si hay error
    throw error; // Re-lanzar el error para que se maneje apropiadamente
  }
}

// Cargar los modales y configurar los eventos cuando se carga la página
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 Iniciando aplicación...');
    
    try {
        // Primero cargar los países del backend (con fallback incorporado)
        await cargarPaises();
        
        // Luego cargar los modales
        await cargarModales();
        
        console.log('✅ Aplicación iniciada correctamente');
    } catch (error) {
        console.error('❌ Error en la inicialización:', error);
        // Continuar con la aplicación incluso si hay errores
        try {
            await cargarModales();
            console.log('✅ Modales cargados a pesar del error anterior');
        } catch (modalError) {
            console.error('❌ Error crítico cargando modales:', modalError);
        }
    }
});

// Función para cargar los modales
async function cargarModales() {
    try {
        const response = await fetch('./views/modals.html');
        const html = await response.text();
        
        // Insertar los modales en el body
        document.body.insertAdjacentHTML('beforeend', html);
        
        // Configurar eventos después de cargar los modales
        inicializarEventos();
        
        console.log('Modales cargados correctamente');
    } catch (error) {
        console.error('Error al cargar los modales:', error);
    }
}

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
      const countryCode = document.getElementById(`pais${i}`).value;
      const jugador = {
        nickname: document.getElementById(`nickname${i}`).value || `Jugador ${i}`,
        pais: document.getElementById(`pais${i}`).value,
        country_code: countryCode.toLowerCase(), // Agregar código de país para el backend
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
 * usando datos del backend y FlagsAPI para las banderas
 * @param {number} num - Número de jugadores
 */
function generarCamposNicknames(num) {
  console.log(`🎮 Generando campos para ${num} jugadores`);
  console.log(`📍 Países disponibles: ${paisesDisponibles.length}`);
  
  const container = document.getElementById('nicknamesContainer');
  container.innerHTML = '';
  
  const colores = ['Rojo', 'Azul', 'Verde', 'Amarillo'];
  const fichas = ['Auto', 'Sombrero', 'Barco', 'Perro'];
  
  // Verificar que los países estén cargados
  if (!paisesDisponibles || paisesDisponibles.length === 0) {
    console.error('❌ No hay países disponibles del backend');
    container.innerHTML = `
      <div class="alert alert-danger">
        <h6>❌ Error: Backend devuelve datos vacíos</h6>
        <p>El backend está funcionando pero no encuentra los países.</p>
        <p><strong>Solución:</strong></p>
        <ol>
          <li>Detén el backend actual (Ctrl+C)</li>
          <li>Ejecuta desde el directorio Backend:</li>
          <code>cd Backend && python3 app.py</code>
          <li>O desde la raíz del proyecto:</li>
          <code>python3 Backend/app.py</code>
        </ol>
        <p><small>El backend necesita ejecutarse desde el directorio correcto para encontrar <code>database/countries.json</code></small></p>
        <button class="btn btn-primary btn-sm" onclick="window.location.reload()">
          🔄 Recargar página
        </button>
      </div>
    `;
    return;
  }
  
  for (let i = 1; i <= num; i++) {
    const jugadorDiv = document.createElement('div');
    jugadorDiv.className = 'mb-2 border rounded p-2';
    
    jugadorDiv.innerHTML = `
      <label for="nickname${i}" class="form-label">Nickname Jugador ${i}</label>
      <input type="text" class="form-control mb-2" id="nickname${i}" placeholder="Jugador ${i}" required>
      
      <label for="pais${i}" class="form-label">País</label>
      <div class="input-group mb-2">
        <span class="input-group-text p-0" style="width: 50px; height: 38px; display: flex; align-items: center; justify-content: center;">
          <img id="flag${i}" src="" alt="Bandera" 
               style="width: 32px; height: 24px; object-fit: cover; border-radius: 3px; display: none;">
          <span id="flagPlaceholder${i}" style="font-size: 12px; color: #999;">🏳️</span>
        </span>
        <select class="form-select" id="pais${i}" required>
          <option value="">Selecciona país</option>
          ${paisesDisponibles.map(p => 
            `<option value="${p.code}">${p.name}</option>`
          ).join('')}
        </select>
      </div>
      
      <label for="color${i}" class="form-label">Color de ficha</label>
      <select class="form-select mb-2" id="color${i}">
        ${colores.map(c => `<option value="${c}">${c}</option>`).join('')}
      </select>
      
      <label for="ficha${i}" class="form-label">Tipo de ficha</label>
      <select class="form-select" id="ficha${i}">
        ${fichas.map(f => `<option value="${f}">${f}</option>`).join('')}
      </select>
    `;
    
    container.appendChild(jugadorDiv);
  }
  
  // Agregar event listeners para las banderas después de crear los elementos
  for (let i = 1; i <= num; i++) {
    const paisSelect = document.getElementById(`pais${i}`);
    if (paisSelect) {
      paisSelect.addEventListener('change', function() {
        actualizarBandera(i);
      });
    }
  }
  
  console.log(`✅ Campos generados exitosamente para ${num} jugadores`);
}

// Función para actualizar la bandera usando FlagsAPI
function actualizarBandera(jugadorNum) {
  const paisSelect = document.getElementById(`pais${jugadorNum}`);
  const flagImg = document.getElementById(`flag${jugadorNum}`);
  const flagPlaceholder = document.getElementById(`flagPlaceholder${jugadorNum}`);
  
  if (!paisSelect || !flagImg) {
    console.error(`❌ No se encontraron elementos para jugador ${jugadorNum}`);
    return;
  }
  
  const codigoPais = paisSelect.value;
  
  if (codigoPais) {
    // Ocultar placeholder
    if (flagPlaceholder) flagPlaceholder.style.display = 'none';
    
    // Usar FlagsAPI para obtener la bandera
    const flagUrl = `https://flagsapi.com/${codigoPais}/flat/64.png`;
    flagImg.src = flagUrl;
    flagImg.style.display = 'block';
    
    // Manejar errores de carga de imagen
    flagImg.onerror = function() {
      console.warn(`⚠️ No se pudo cargar la bandera para: ${codigoPais}`);
      this.style.display = 'none';
      if (flagPlaceholder) {
        flagPlaceholder.style.display = 'block';
        flagPlaceholder.textContent = '❌';
      }
    };
  } else {
    // No hay país seleccionado
    flagImg.style.display = 'none';
    if (flagPlaceholder) {
      flagPlaceholder.style.display = 'block';
      flagPlaceholder.textContent = '🏳️';
    }
  }
}