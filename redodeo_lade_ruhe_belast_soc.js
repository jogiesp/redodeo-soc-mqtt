// Intervall in Millisekunden (1 Minute)
const interval = 1 * 60 * 1000;

// Datenpunkte
const socDP = '0_userdata.0.solar.redodeo_soc';
const voltageDP = '0_userdata.0.solar.redodeo_single_volt';
const powerDP = '0_userdata.0.solar.grafana_redodo_discharging'; // Neuer Datenpunkt für Leistung in Watt
const lastUpdateDP = '0_userdata.0.solar.redodeo_last_update';

// Batteriekonfiguration
const batteryCapacityAh = 100; // Batterie Kapazität in Ah (anpassen!)

// SOC-Kurve für Ruhespannung (kein Strom) - Angepasst für LiFePO4
const restingVoltageCurve = [
    { voltage: 14.4, soc: 100 },
    { voltage: 13.5, soc: 99 },
    { voltage: 13.4, soc: 90 },
    { voltage: 13.3, soc: 70 },
    { voltage: 13.2, soc: 50 },
    { voltage: 13.1, soc: 30 },
    { voltage: 13.0, soc: 20 },
    { voltage: 12.8, soc: 10 },
    { voltage: 12.0, soc: 0 }
];

// SOC-Kurve während des Ladens (positive Ströme) - Angepasst für LiFePO4
const chargingVoltageCurve = [
    { voltage: 14.6, soc: 110 },
    { voltage: 14.4, soc: 100 },
    { voltage: 14.2, soc: 85 },
    { voltage: 14.0, soc: 88 },
    { voltage: 13.9, soc: 80 },
    { voltage: 13.8, soc: 65 },
    { voltage: 13.6, soc: 55 },
    { voltage: 13.4, soc: 45 },
    { voltage: 13.2, soc: 35 },
    { voltage: 13.0, soc: 25 },
    { voltage: 12.8, soc: 15 },
    { voltage: 12.5, soc: 5 },
    { voltage: 12.0, soc: 0 }
];

// SOC-Kurve während der Entladung (negative Ströme) - Angepasst für LiFePO4
const dischargingVoltageCurve = [
    { voltage: 14.0, soc: 100 },
    { voltage: 13.6, soc: 90 },
    { voltage: 13.4, soc: 65 },
    { voltage: 13.2, soc: 40 },
    { voltage: 12.8, soc: 20 },
    { voltage: 12.5, soc: 10 },
    { voltage: 12.0, soc: 0 }
];

// Interpolationsfunktion
function interpolateSOC(voltage, curve) {
    for (let i = 0; i < curve.length - 1; i++) {
        const high = curve[i];
        const low = curve[i + 1];
        if (voltage >= low.voltage && voltage <= high.voltage) {
            const soc = low.soc + (high.soc - low.soc) * (voltage - low.voltage) / (high.voltage - low.voltage);
            return Math.max(0, Math.min(100, Math.round(soc)));
        }
    }
    if (voltage > curve[0].voltage) return 100;
    if (voltage < curve[curve.length - 1].voltage) return 0;
    return null;
}

// Coulomb Counting (Ampere-Stunden Integration)
function updateSOCWithCoulombCounting(currentSOC, current, deltaTimeHours) {
    if (Math.abs(current) < 0.1) return currentSOC; // Rauschen ignorieren
    
    const deltaAh = current * deltaTimeHours;
    const deltaSOC = (deltaAh / batteryCapacityAh) * 100;
    
    return Math.max(0, Math.min(100, currentSOC + deltaSOC));
}

// Bestimme Betriebszustand
function getBatteryState(current) {
    if (current > 0.1) {
        return 'LADEN';
    } else if (current < -0.1) {
        return 'ENTLADEN';
    } else {
        return 'RUHE';
    }
}

// Bestimme passende Spannungskurve
function getVoltageCurve(current) {
    const state = getBatteryState(current);
    switch (state) {
        case 'LADEN': return chargingVoltageCurve;
        case 'ENTLADEN': return dischargingVoltageCurve;
        default: return restingVoltageCurve;
    }
}

// Prüfen und anlegen der Datenpunkte
function initializeStates() {
    if (!existsState(socDP)) {
        createState(socDP, 50, { type: 'number', name: 'SOC Redodo Batterie', unit: '%', read: true, write: true });
    }
    if (!existsState(lastUpdateDP)) {
        createState(lastUpdateDP, Date.now(), { type: 'number', name: 'Letzte SOC Update Zeit', read: true, write: true });
    }
}

// Hauptfunktion
function updateSOC() {
    try {
        const voltageState = getState(voltageDP);
        const powerState = getState(powerDP);
        const lastSOCState = getState(socDP);
        const lastUpdateState = getState(lastUpdateDP);
        
        if (!voltageState || voltageState.val === null) return;
        if (!powerState || powerState.val === null) return;
        
        const voltage = parseFloat(voltageState.val);
        const power = parseFloat(powerState.val);
        if (isNaN(voltage) || isNaN(power)) return;
        
        const current = power / voltage; // I = P / U
        const currentSOC = lastSOCState ? parseFloat(lastSOCState.val) : 50;
        const lastUpdate = lastUpdateState ? lastUpdateState.val : Date.now();
        
        const now = Date.now();
        const deltaTimeHours = (now - lastUpdate) / (1000 * 60 * 60);
        
        const batteryState = getBatteryState(current);
        let newSOC;
        
        if (batteryState === 'RUHE') {
            const curve = getVoltageCurve(current);
            newSOC = interpolateSOC(voltage, curve);
        } else {
            let socFromCoulomb = updateSOCWithCoulombCounting(currentSOC, current, deltaTimeHours);
            const curve = getVoltageCurve(current);
            let socFromVoltage = interpolateSOC(voltage, curve);
            
            if (batteryState === 'LADEN') {
                newSOC = socFromVoltage !== null
                    ? Math.round(socFromCoulomb * 0.7 + socFromVoltage * 0.3)
                    : Math.round(socFromCoulomb);
            } else {
                newSOC = socFromVoltage !== null
                    ? Math.round(socFromCoulomb * 0.6 + socFromVoltage * 0.4)
                    : Math.round(socFromCoulomb);
            }
        }
        
        if (newSOC !== null) {
            newSOC = Math.max(0, Math.min(100, newSOC));
            setState(socDP, newSOC);
            setState(lastUpdateDP, now);
            console.log(`SOC Update: ${newSOC}% (${batteryState}, Spannung: ${voltage}V, Strom: ${current.toFixed(2)}A)`);
        }
        
    } catch (error) {
        console.error('Fehler bei SOC Update:', error);
    }
}

// Initialisierung
initializeStates();

// Initialer Aufruf
updateSOC();

// Alle 60 Sekunden Update starten
setInterval(updateSOC, interval);

console.log('SOC-Überwachung startet mit 1-Minuten-Intervall');
