// Intervall in Millisekunden (30 Sekunden)
const interval = 30 * 1000;

// Datenpunkt für SOC
const socDP = '0_userdata.0.solar.redodeo_soc';

// Angepasste Spannung-SOC Kurve für Ladespannung (Redodo 12V LiFePO4)
// Wichtig: Diese Werte sind nur ein Beispiel und müssen für deine spezifische
// Batterie und Laderkalibriert werden!
const socCurve = [
    { voltage: 14.4, soc: 100 },
    { voltage: 14.2, soc: 95 },
    { voltage: 14.0, soc: 90 },
    { voltage: 13.8, soc: 80 },
    { voltage: 13.6, soc: 70 },
    { voltage: 13.4, soc: 60 },
    { voltage: 13.2, soc: 50 },
    { voltage: 13.0, soc: 40 },
    { voltage: 12.8, soc: 30 },
    { voltage: 12.6, soc: 20 },
    { voltage: 12.4, soc: 10 },
    { voltage: 12.0, soc: 5 },
    { voltage: 10.0, soc: 0 }
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
