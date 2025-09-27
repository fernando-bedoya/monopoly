/**
 * Prueba para verificar que las cartas automáticas funcionan
 * Abrir la consola del navegador para ver los logs
 */

// Test simple para verificar cargas de cartas
console.log("🧪 INICIANDO PRUEBA DE CARTAS AUTOMÁTICAS");

document.addEventListener('DOMContentLoaded', () => {
    // Esperar a que el juego se inicialice
    setTimeout(() => {
        // Verificar si existe un juego global
        if (window.game && window.game.board) {
            console.log("🎮 Juego detectado!");
            console.log("🃏 Cartas de Suerte:", window.game.board.chanceCards?.length || 0);
            console.log("📦 Cartas de Comunidad:", window.game.board.communityCards?.length || 0);
            
            if (window.game.board.chanceCards?.length > 0) {
                console.log("✅ Cartas de Suerte cargadas correctamente:");
                window.game.board.chanceCards.forEach((carta, i) => {
                    console.log(`  ${i + 1}: ${carta.description} (${carta.action?.money ? '$' + carta.action.money : 'Sin acción dinero'})`);
                });
            }
            
            if (window.game.board.communityCards?.length > 0) {
                console.log("✅ Cartas de Comunidad cargadas correctamente:");
                window.game.board.communityCards.forEach((carta, i) => {
                    console.log(`  ${i + 1}: ${carta.description} (${carta.action?.money ? '$' + carta.action.money : 'Sin acción dinero'})`);
                });
            }
        } else {
            console.log("❌ No se detectó el juego. Verificar inicialización.");
        }
    }, 2000);
});