// Intervall in Millisekunden (30 Sekunden)
const interval = 30 * 1000;

// Datenpunkt für SOC
const socDP = '0_userdata.0.solar.redodeo_soc';

// Angepasste Spannung-SOC Kurve (Redodo 12V LiFePO4)
const socCurve = [
    { voltage: 14.1, soc: 100 },
    { voltage: 13.8, soc: 95 },
    { voltage: 13.6, soc: 90 },
    { voltage: 13.5, soc: 36 }, // Neu: 13.5V = 36%
    { voltage: 13.4, soc: 80 },
    { voltage: 13.2, soc: 30 },
    { voltage: 13.0, soc: 20 },
    { voltage: 12.8, soc: 15 },
    { voltage: 12.6, soc: 10 },
    { voltage: 12.4, soc: 5 },
    { voltage: 12.2, soc: 2 },
    { voltage: 12.0, soc: 1 },
    { voltage: 11.8, soc: 0 }
];

// Interpolationsfunktion
function interpolateSOC(voltage) {
    for (let i = 0; i < socCurve.length - 1; i++) {
        const high = socCurve[i];
        const low = socCurve[i + 1];
        if (voltage >= low.voltage && voltage <= high.voltage) {
            const soc = low.soc + (high.soc - low.soc) * (voltage - low.voltage) / (high.voltage - low.voltage);
            return Math.round(soc);
        }
    }
    if (voltage > socCurve[0].voltage) return 100;
    if (voltage < socCurve[socCurve.length - 1].voltage) return 0;
    return null;
}

// Prüfen und anlegen des SOC-Datenpunkts, falls nicht vorhanden
if (!existsState(socDP)) {
    createState(socDP, 0, { type: 'number', name: 'SOC Redodo Batterie', unit: '%', read: true, write: true });
}

// Hauptfunktion
function updateSOC() {
    const voltageState = getState('0_userdata.0.solar.redodeo_single_volt');
    if (!voltageState || voltageState.val === null || voltageState.val === undefined) return;

    const voltage = parseFloat(voltageState.val);
    if (isNaN(voltage)) return;

    const soc = interpolateSOC(voltage);
    if (soc !== null) setState(socDP, soc);
}

// Initialer Aufruf
updateSOC();

// Timer setzen, alle 30 Sekunden erneut ausführen
setInterval(updateSOC, interval);
