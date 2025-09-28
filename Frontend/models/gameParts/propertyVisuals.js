// Mixin de visualización y gestión de hipotecas / construcciones de propiedades
// Separa la lógica puramente de UI y (des)hipoteca del núcleo del juego.

export function applyPropertyVisuals(Game){
    if(Game.__propertyVisualsApplied) return; // guard idempotencia
    Game.__propertyVisualsApplied = true;

    Object.assign(Game.prototype, {
        /** Helper genérico para emitir eventos del juego */
        emitGameEvent(nombre, detail = {}){
            try {
                window.dispatchEvent(new CustomEvent(nombre, { detail }));
            } catch (e) {
                console.warn('[emitGameEvent] No se pudo emitir', nombre, e);
            }
        },
        /** Marca una propiedad como comprada visualmente */
        marcarPropiedadComoComprada(squareId, player){
            const squareElement = document.querySelector(`[data-square-id="${squareId}"]`);
            if (squareElement) {
                let indicator = squareElement.querySelector('.property-indicator');
                if (!indicator) {
                    indicator = document.createElement('div');
                    indicator.className = 'property-indicator';
                    indicator.style.cssText = `
                        position: absolute;
                        top: 2px;
                        right: 2px;
                        width: 12px;
                        height: 12px;
                        border-radius: 50%;
                        background: ${this.colorToCSS?.(player.color)};
                        border: 1px solid white;
                        z-index: 5;
                    `;
                    squareElement.appendChild(indicator);
                } else if(player?.color){
                    indicator.style.background = this.colorToCSS?.(player.color);
                }
            }
            // Evento de compra / reasignación visual
            this.emitGameEvent('property:visual-updated', { squareId, type: 'indicator', action: 'purchased', playerId: player?.id, player: player?.nickname });
        },

        /** Actualiza la visualización (casas / hotel) de una propiedad */
        actualizarVisualizacionPropiedad(squareId, propiedad){
            const squareElement = document.querySelector(`[data-square-id="${squareId}"]`);
            if (!squareElement) return;
            // limpiar previos
            squareElement.querySelectorAll('.building-indicator').forEach(el=>el.remove());
            if(propiedad.hotel){
                const hotel = document.createElement('div');
                hotel.className = 'building-indicator';
                hotel.style.cssText = `
                    position: absolute;
                    top: 15px;
                    left: 50%;
                    transform: translateX(-50%);
                    font-size: 16px;
                    z-index: 6;
                `;
                hotel.textContent = '🏨';
                squareElement.appendChild(hotel);
            } else if(propiedad.casas > 0){
                for(let i=0;i<propiedad.casas;i++){
                    const casa = document.createElement('div');
                    casa.className = 'building-indicator';
                    casa.style.cssText = `
                        position: absolute;
                        top: 15px;
                        left: ${20 + (i*15)}px;
                        font-size: 10px;
                        z-index: 6;
                    `;
                    casa.textContent = '🏠';
                    squareElement.appendChild(casa);
                }
            }
            this.emitGameEvent('property:visual-updated', { squareId, type: 'buildings', casas: propiedad.casas, hotel: !!propiedad.hotel });
        },

        /** Marca una propiedad como hipotecada visualmente */
        marcarPropiedadComoHipotecada(squareId){
            const squareElement = document.querySelector(`[data-square-id="${squareId}"]`);
            if (squareElement) {
                let indicator = squareElement.querySelector('.property-indicator');
                if (indicator) {
                    indicator.style.background = '#999';
                    indicator.style.opacity = '0.5';
                }
                let hipotecaIndicator = squareElement.querySelector('.hipoteca-indicator');
                if(!hipotecaIndicator){
                    hipotecaIndicator = document.createElement('div');
                    hipotecaIndicator.className = 'hipoteca-indicator';
                    hipotecaIndicator.style.cssText = `
                        position: absolute;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        font-size: 20px;
                        z-index: 10;
                    `;
                    hipotecaIndicator.textContent = '🏦';
                    squareElement.appendChild(hipotecaIndicator);
                }
            }
            this.updatePlayerStatsPanel?.();
            this.emitGameEvent('property:visual-updated', { squareId, type: 'mortgage' });
        },

        /** Maneja ferrocarril (wrapper a manejarPropiedad) */
        async manejarFerrocarril(player, square){
            await this.manejarPropiedad?.(player, square);
        },

        /** Maneja servicio público (wrapper a manejarPropiedad) */
        async manejarServicio(player, square){
            await this.manejarPropiedad?.(player, square);
        },

        /** Hipotecar propiedad (opciones: { skipConfirm }) */
        async hipotecarPropiedad(player, propiedad, square, options = {}){
            if(!player || !propiedad || !square) return;
            if(propiedad.hipotecada) return; // ya hipotecada
            const { skipConfirm = false } = options;
            const valorHipoteca = square.mortgage || Math.floor(square.price/2);
            let confirmado = true;
            if(!skipConfirm){
                confirmado = await this.mostrarConfirmacion?.(
                    '🏦 Hipotecar Propiedad',
                    `¿Hipotecar ${square.name} por $${valorHipoteca}?\n\n`+
                    `⚠️ Mientras esté hipotecada:\n`+
                    `• No podrás cobrar renta\n`+
                    `• Para recuperarla pagarás $${Math.floor(valorHipoteca*1.1)} (valor + 10% interés)`,
                    player
                );
            }
            if(!confirmado) return;
            propiedad.hipotecada = true;
            propiedad.fechaHipoteca = new Date().toISOString();
            player.dinero += valorHipoteca;
            this.mostrarMensaje?.(player,'🏦 Propiedad Hipotecada',
                `${square.name} hipotecada por $${valorHipoteca}.\n`+
                `💰 Tu dinero: $${player.dinero}\n\n`+
                `⚠️ IMPORTANTE: No cobrarás renta mientras esté hipotecada.`);
            this.marcarPropiedadComoHipotecada(square.id);
            this.guardarEstadoJuego?.();
            this.actualizarEstadoBotones?.();
            this.updatePlayerStatsPanel?.();
            console.log(`🏦 ${player.nickname} hipotecó ${square.name} por $${valorHipoteca}`);
            this.emitGameEvent('property:mortgaged', {
                playerId: player.id,
                player: player.nickname,
                squareId: square.id,
                name: square.name,
                amount: valorHipoteca
            });
            this.emitGameEvent('player:stats-updated', { playerId: player.id });
        },

        /** Deshipotecar propiedad (opciones: { skipConfirm }) */
        async deshipotecarPropiedad(player, propiedad, square, options = {}){
            if(!player || !propiedad || !square) return;
            if(!propiedad.hipotecada) return; // no hipotecada
            const { skipConfirm = false } = options;
            const valorHipoteca = square.mortgage || Math.floor(square.price/2);
            const costoDeshipoteca = Math.floor(valorHipoteca * 1.1);
            if(player.dinero < costoDeshipoteca){
                this.mostrarMensaje?.(player,'💸 Sin dinero suficiente',
                    `Necesitas $${costoDeshipoteca} para deshipotecar ${square.name}\n`+
                    `(Valor hipoteca: $${valorHipoteca} + 10% interés: $${costoDeshipoteca - valorHipoteca})\n\n`+
                    `💰 Tu dinero actual: $${player.dinero}`);
                return;
            }
            let confirmado = true;
            if(!skipConfirm){
                confirmado = await this.mostrarConfirmacion?.(
                    '🔓 Deshipotecar Propiedad',
                    `¿Deshipotecar ${square.name}?\n\n`+
                    `💰 Costo: $${costoDeshipoteca}\n`+
                    `(Valor original: $${valorHipoteca} + 10% interés: $${costoDeshipoteca - valorHipoteca})\n\n`+
                    `💵 Tu dinero después: $${player.dinero - costoDeshipoteca}`,
                    player
                );
            }
            if(!confirmado) return;
            propiedad.hipotecada = false;
            delete propiedad.fechaHipoteca;
            player.dinero -= costoDeshipoteca;
            this.mostrarMensaje?.(player,'🏠 Propiedad Deshipotecada',
                `${square.name} deshipotecada exitosamente.\n\n`+
                `💸 Pagaste: $${costoDeshipoteca}\n`+
                `💰 Tu dinero: $${player.dinero}\n\n`+
                `✅ Ya puedes cobrar renta normalmente.`);
            // restaurar indicador
            this.marcarPropiedadComoComprada(square.id, player);
            const squareElement = document.querySelector(`[data-square-id="${square.id}"]`);
            if(squareElement){
                const hipotecaIndicator = squareElement.querySelector('.hipoteca-indicator');
                if(hipotecaIndicator) hipotecaIndicator.remove();
                const indicator = squareElement.querySelector('.property-indicator');
                if(indicator && player?.color){
                    indicator.style.background = this.colorToCSS?.(player.color);
                    indicator.style.opacity = '1';
                }
            }
            this.guardarEstadoJuego?.();
            this.actualizarEstadoBotones?.();
            this.updatePlayerStatsPanel?.();
            console.log(`🔓 ${player.nickname} deshipotecó ${square.name} por $${costoDeshipoteca}`);
            this.emitGameEvent('property:unmortgaged', {
                playerId: player.id,
                player: player.nickname,
                squareId: square.id,
                name: square.name,
                cost: costoDeshipoteca
            });
            this.emitGameEvent('property:visual-updated', { squareId: square.id, type: 'unmortgage' });
            this.emitGameEvent('player:stats-updated', { playerId: player.id });
        }
    });
}
