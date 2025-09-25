// Intervall in Millisekunden (1 Minute für genauere Überwachung)
// const interval = 1 * 60 * 1000;

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
    { voltage: 14.6, soc: 100 },
    { voltage: 14.4, soc: 95 },
    { voltage: 14.2, soc: 85 },
    { voltage: 14.0, soc: 75 },
    { voltage: 13.8, soc: 65 },
    { voltage: 13.6, soc: 55 },
    { voltage: 13.4, soc: 45 },
    { voltage: 13.2, soc: 35 },
    { voltage: 13.0, soc: 25 },
    { voltage: 12.8, soc: 15 },
    { voltage: 12.5, soc: 5 },
    { voltage: 12.0, soc: 0 }
];

// SOC-Kurve während der Entladung (negative Ströme) - Angepasst für LiFePO4, basierend auf Nutzerfeedback
const dischargingVoltageCurve = [
    { voltage: 13.6, soc: 100 },
    { voltage: 13.4, soc: 65 }, // Wert basierend auf Ihrem Feedback
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
    // Ignoriere sehr kleine Ströme, die Rauschen sein könnten
    if (Math.abs(current) < 0.1) return currentSOC;
    
    const deltaAh = current * deltaTimeHours;
    const deltaSOC = (deltaAh / batteryCapacityAh) * 100;
    
    return Math.max(0, Math.min(100, currentSOC + deltaSOC));
}

// Bestimme Betriebszustand basierend auf Strom
function getBatteryState(current) {
    if (current > 0.1) {
        return 'LADEN'; // Positiver Strom = Laden
    } else if (current < -0.1) {
        return 'ENTLADEN'; // Negativer Strom = Entladen
    } else {
        return 'RUHE'; // Kein oder sehr geringer Strom
    }
}

// Bestimme welche SOC-Kurve verwendet werden soll
function getVoltageCurve(current) {
    const state = getBatteryState(current);
    
    switch(state) {
        case 'LADEN':
            return chargingVoltageCurve; // Positiver Strom (Laden)
        case 'ENTLADEN':
            return dischargingVoltageCurve; // Negativer Strom (Entladen)
        case 'RUHE':
        default:
            return restingVoltageCurve; // Ruhespannung
    }
}

// Prüfen und anlegen der Datenpunkte
function initializeStates() {
    if (!existsState(socDP)) {
        createState(socDP, 50, { 
            type: 'number', 
            name: 'SOC Redodo Batterie', 
            unit: '%', 
            read: true, 
            write: true 
        });
    }
    
    if (!existsState(lastUpdateDP)) {
        createState(lastUpdateDP, Date.now(), { 
            type: 'number', 
            name: 'Letzte SOC Update Zeit', 
            read: true, 
            write: true 
        });
    }
}

// Hauptfunktion
function updateSOC() {
    try {
        // Daten lesen
        const voltageState = getState(voltageDP);
        const powerState = getState(powerDP); // Neuen Datenpunkt lesen
        const lastSOCState = getState(socDP);
        const lastUpdateState = getState(lastUpdateDP);
        
        // Validierung
        if (!voltageState || voltageState.val === null || voltageState.val === undefined) {
            console.log('SOC Update: Keine Spannungsdaten verfügbar');
            return;
        }
        
        if (!powerState || powerState.val === null || powerState.val === undefined) {
            console.log('SOC Update: Keine Leistungsdaten verfügbar');
            return;
        }
        
        const voltage = parseFloat(voltageState.val);
        const power = parseFloat(powerState.val);
        
        if (isNaN(voltage) || isNaN(power)) {
            console.log('SOC Update: Ungültige Spannungs- oder Leistungsdaten');
            return;
        }
        
        // Leistung in Strom (Ampere) umrechnen: I = P / U
        const current = power / voltage;
        
        const currentSOC = lastSOCState ? parseFloat(lastSOCState.val) : 50;
        const lastUpdate = lastUpdateState ? lastUpdateState.val : Date.now();
        
        // Zeit seit letztem Update berechnen
        const now = Date.now();
        const deltaTimeHours = (now - lastUpdate) / (1000 * 60 * 60);
        
        // Bestimme Betriebszustand
        const batteryState = getBatteryState(current);
        
        // SOC berechnen basierend auf Betriebszustand
        let newSOC;
        
        if (batteryState === 'RUHE') {
            // Ruhespannung - verwende primär spannungsbasierte Berechnung
            const curve = getVoltageCurve(current);
            newSOC = interpolateSOC(voltage, curve);
            console.log(`SOC Update: ${batteryState} - Spannung: ${voltage}V, SOC: ${newSOC}%`);
            
        } else if (batteryState === 'LADEN') {
            // Laden (positiver Strom) - kombiniere beide Methoden
            let socFromCoulomb = updateSOCWithCoulombCounting(currentSOC, current, deltaTimeHours);
            const curve = getVoltageCurve(current);
            let socFromVoltage = interpolateSOC(voltage, curve);
            
            if (socFromVoltage !== null) {
                // Beim Laden mehr Gewicht auf Coulomb Counting
                newSOC = Math.round(socFromCoulomb * 0.7 + socFromVoltage * 0.3);
            } else {
                newSOC = Math.round(socFromCoulomb);
            }
            
            console.log(`SOC Update: ${batteryState} (+${current.toFixed(2)}A) - Spannung: ${voltage}V, SOC: ${newSOC}% (Coulomb: ${Math.round(socFromCoulomb)}%, Spannung: ${socFromVoltage}%)`);
            
        } else if (batteryState === 'ENTLADEN') {
            // Entladen (negativer Strom) - kombiniere beide Methoden
            let socFromCoulomb = updateSOCWithCoulombCounting(currentSOC, current, deltaTimeHours);
            const curve = getVoltageCurve(current);
            let socFromVoltage = interpolateSOC(voltage, curve);
            
            if (socFromVoltage !== null) {
                // Beim Entladen ausgeglichene Gewichtung
                newSOC = Math.round(socFromCoulomb * 0.6 + socFromVoltage * 0.4);
            } else {
                newSOC = Math.round(socFromCoulomb);
            }
            
            console.log(`SOC Update: ${batteryState} (${current.toFixed(2)}A) - Spannung: ${voltage}V, SOC: ${newSOC}% (Coulomb: ${Math.round(socFromCoulomb)}%, Spannung: ${socFromVoltage}%)`);
        }
        
        // SOC begrenzen und speichern
        if (newSOC !== null) {
            newSOC = Math.max(0, Math.min(100, newSOC));
            setState(socDP, newSOC);
            setState(lastUpdateDP, now);
        }
        
    } catch (error) {
        console.error('Fehler bei SOC Update:', error);
    }
}

// Initialisierung
initializeStates();

// Initialer Aufruf
updateSOC();

// Besserer Ansatz: Auf Änderungen der relevanten Datenpunkte reagieren
on({ id: voltageDP, change: 'any' }, updateSOC);
on({ id: powerDP, change: 'any' }, updateSOC);

console.log('Verbessertes SOC-Überwachungsskript für Victron System gestartet');
console.log('Datenpunkte: Spannung=' + voltageDP + ', Leistung=' + powerDP);
