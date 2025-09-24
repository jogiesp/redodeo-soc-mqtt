// --- Konfiguration ---
// Datenpunkt für die Batteriespannung
const voltageDP = '0_userdata.0.solar.redodeo_single_volt';

// LiFePO4 Spannung-SOC Kurve für den Ladevorgang
// Diese Werte sind optimierte Schätzungen für eine 12V-Batterie (4S).
// Die Ladespannung steigt schnell an und verweilt lange im oberen Bereich.
const socCurve = [
    { voltage: 14.6, soc: 100 },
    { voltage: 14.4, soc: 98 },
    { voltage: 14.2, soc: 95 },
    { voltage: 14.0, soc: 90 },
    { voltage: 13.8, soc: 85 },
    { voltage: 13.6, soc: 75 },
    { voltage: 13.4, soc: 60 },
    { voltage: 13.2, soc: 40 },
    { voltage: 13.0, soc: 20 },
    { voltage: 12.8, soc: 10 },
    { voltage: 12.5, soc: 5 },
    { voltage: 10.0, soc: 0 }
];

// --- Funktionen ---

/**
 * Führt eine lineare Interpolation basierend auf der Spannung-SOC-Kurve durch.
 * @param {number} voltage Die gemessene Batteriespannung.
 * @returns {number|null} Der berechnete SOC in Prozent oder null bei ungültiger Spannung.
 */
function interpolateSOC(voltage) {
    // Ungültige Eingabe prüfen
    if (typeof voltage !== 'number' || isNaN(voltage)) {
        log(`Fehler: Ungültiger Spannungswert: '${voltage}'`, 'error');
        return null;
    }

    // Behandlung von Grenzfällen
    if (voltage >= socCurve[0].voltage) {
        return 100;
    }
    if (voltage <= socCurve[socCurve.length - 1].voltage) {
        return 0;
    }

    // Lineare Interpolation zwischen den Datenpunkten
    for (let i = 0; i < socCurve.length - 1; i++) {
        const point1 = socCurve[i];
        const point2 = socCurve[i + 1];

        // Finde das passende Intervall
        if (voltage <= point1.voltage && voltage >= point2.voltage) {
            const rangeVoltage = point1.voltage - point2.voltage;
            const rangeSOC = point1.soc - point2.soc;

            // Vermeide Division durch Null
            if (rangeVoltage === 0) {
                return point1.soc;
            }

            const soc = point2.soc + (rangeSOC * (voltage - point2.voltage) / rangeVoltage);
            return Math.round(soc);
        }
    }

    return null;
}

// --- Hauptlogik (event-basiert) ---
// Lauscht auf Änderungen des Spannungsdatenpunkts
on({ id: voltageDP, change: 'any' }, (obj) => {
    // Ruft den Wert aus dem geänderten Zustand ab
    const voltage = parseFloat(obj.state.val);
    
    // Berechnet den SOC im RAM
    const newSOC = interpolateSOC(voltage);

    // Wenn der SOC-Wert gültig ist, gib ihn in der Konsole aus.
    // Es werden keine Datenpunkte geschrieben.
    if (newSOC !== null) {
        log(`Neuer SOC (im RAM): ${newSOC}% bei ${voltage.toFixed(2)}V`);
    }
});
