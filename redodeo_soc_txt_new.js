/**
 * ioBroker Skript zur dynamischen Berechnung des SOC (State of Charge)
 * einer Redodo LiFePO4 Batterie basierend auf der Spannung.
 *
 * Das Skript verwendet eine Standard-Spannungs-SOC-Kurve und verschiebt diese
 * automatisch, basierend auf einem vom Benutzer gesetzten Referenzpunkt (z.B.
 * Spannung und SOC aus der Redodo App).
 *
 * INPUT:
 * 1. 0_userdata.0.solar.redodeo_single_volt - Die aktuelle Batteriespannung
 * 2. 0_userdata.0.solar.redodo_app_ref_soc - SOC-Referenzwert (z.B. 99) aus der App
 * 3. 0_userdata.0.solar.redodo_app_ref_voltage - Spannungs-Referenzwert (z.B. 13.5) beim Setzen der App-SOC
 *
 * OUTPUT:
 * 1. 0_userdata.0.solar.redodo_soc_calc - Der berechnete, kalibrierte SOC in Prozent
 * 2. 0_userdata.0.solar.Redodeo.soc_schwelwert.soc_text - Textstatus (Voll, Hoch, etc.)
 * 3. 0_userdata.0.solar.redodo_voltage_offset - Der aktuell berechnete Spannungs-Offset (Debug)
 */

// Intervall in Millisekunden (5 Minuten)
const interval = 5 * 60 * 1000;

// Datenpunkte
const VOLTAGE_INPUT_DP = '0_userdata.0.solar.redodeo_single_volt';
const SOC_OUTPUT_DP = '0_userdata.0.solar.redodo_soc_calc';
const SOC_TEXT_DP = '0_userdata.0.solar.Redodeo.soc_schwelwert.soc_text';
const REF_SOC_DP = '0_userdata.0.solar.redodo_app_ref_soc';       // Manuell setzen: SOC aus App
const REF_VOLTAGE_DP = '0_userdata.0.solar.redodo_app_ref_voltage'; // Manuell setzen: Spannung bei SOC-Messung
const VOLTAGE_OFFSET_DP = '0_userdata.0.solar.redodo_voltage_offset'; // Berechneter Offset

// LiFePO4 Spannung-SOC Kurve (12V Batterie, Ruhespannung)
// DIESE KURVE DEFINIERT NUR DIE ENTLADEFORM (DEN RELATIVEN ABFALL/STEIGUNG).
// Die absolute Position der Kurve wird durch die Referenzpunkte dynamisch verschoben/kalibriert.
// ACHTUNG: Die Kurve muss absteigend sortiert sein (Spannung von Hoch zu Tief)
const socCurve = [
    { voltage: 14.6, soc: 100 },
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
    { voltage: 12.0, soc: 0 }
];

/* * DYNAMISCHE ANPASSUNGSERKLÄRUNG (Beispiel: 13.5V = 99%):
 * 1. Das Skript fragt: Welche Spannung IST 99% auf der STANDARD-Kurve? 
 * Antwort: ca. 14.58V (berechnet durch Interpolation zwischen 14.6V/100% und 14.2V/95%).
 * * 2. Berechne den OFFSET:
 * Tatsächliche Ref. Spannung (13.5V) - Standard Spannung (ca. 14.58V) = ca. -1.08V
 * Der VOLTAGE_OFFSET_DP wird auf -1.08V gesetzt.
 *
 * 3. Bei jeder neuen Messung (z.B. 13.0V) wird der Offset abgezogen:
 * Neue Spannung (13.0V) - Offset (-1.08V) = ANGEPASSTE Spannung (14.08V)
 *
 * 4. Die angepasste Spannung (14.08V) wird auf die STANDARD-Kurve angewendet.
 * 14.08V auf der Standard-Kurve liegt bei ca. 90% SOC.
 *
 * ERGEBNIS: Die gesamte Kurve wird um ca. 1.08V nach unten verschoben, 
 * sodass der SOC ab sofort synchron zur App läuft.
*/

/**
 * --------------------------------------------------------------------------------
 * HELPER FUNKTIONEN
 * --------------------------------------------------------------------------------
 */

/**
 * Interpoliert den SOC basierend auf einer gegebenen Spannung (Standard-Kurve).
 * @param {number} voltage - Aktuelle Spannung.
 * @returns {number} Berechneter SOC (0 bis 100).
 */
function interpolateSOC(voltage) {
    // Randbedingungen
    if (voltage >= socCurve[0].voltage) return 100;
    if (voltage <= socCurve[socCurve.length - 1].voltage) return 0;

    for (let i = 0; i < socCurve.length - 1; i++) {
        const high = socCurve[i];
        const low = socCurve[i + 1];
        if (voltage <= high.voltage && voltage >= low.voltage) {
            // Lineare Interpolation des SOC zwischen zwei Punkten
            const soc = low.soc + (high.soc - low.soc) * (voltage - low.voltage) / (high.voltage - low.voltage);
            return Math.round(soc);
        }
    }
    return 0; // Sollte nicht erreicht werden
}

/**
 * Inverse Interpolation: Findet die Spannung, die auf der Standardkurve
 * einem bestimmten SOC entspricht.
 * @param {number} soc - Der gewünschte SOC (0 bis 100).
 * @returns {number} Die zugehörige Spannung auf der Standard-Kurve.
 */
function voltageForSOC(soc) {
    // Randbedingungen
    if (soc >= socCurve[0].soc) return socCurve[0].voltage;
    if (soc <= socCurve[socCurve.length - 1].soc) return socCurve[socCurve.length - 1].voltage;

    for (let i = 0; i < socCurve.length - 1; i++) {
        const high = socCurve[i];
        const low = socCurve[i + 1];
        if (soc <= high.soc && soc >= low.soc) {
            // Lineare Interpolation der Spannung zwischen zwei SOC-Punkten
            const voltage = low.voltage + (high.voltage - low.voltage) * (soc - low.soc) / (high.soc - low.soc);
            // Wir runden hier nicht, um den Offset präziser zu halten
            return voltage;
        }
    }
    return 0; // Sollte nicht erreicht werden
}

/**
 * Erzeugt einen Textstatus basierend auf dem SOC.
 * @param {number} soc - Der SOC in Prozent.
 * @returns {string} Textstatus.
 */
function socToText(soc) {
    if (soc >= 95) return "Voll";
    if (soc >= 75) return "Hoch";
    if (soc >= 40) return "Mittel";
    if (soc >= 20) return "Niedrig";
    return "Leer";
}


/**
 * --------------------------------------------------------------------------------
 * DATENPUNKT INITIALISIERUNG
 * --------------------------------------------------------------------------------
 */

// Funktion zum Prüfen und Anlegen der Datenpunkte
function checkAndCreateStates() {
    // SOC-Berechnung (Ausgabe)
    if (!existsState(SOC_OUTPUT_DP)) {
        createState(SOC_OUTPUT_DP, 0, { type: 'number', name: 'SOC Redodo Batterie (Kalibriert)', unit: '%', read: true, write: false, role: 'level.battery.soc' });
        log("Datenpunkt " + SOC_OUTPUT_DP + " angelegt.", 'info');
    }

    // SOC Textstatus (Ausgabe)
    if (!existsState(SOC_TEXT_DP)) {
        createState(SOC_TEXT_DP, "Unbekannt", { type: 'string', name: 'SOC Textstatus', read: true, write: false, role: 'state' });
        log("Datenpunkt " + SOC_TEXT_DP + " angelegt.", 'info');
    }

    // SOC Referenz (Eingabe durch Benutzer)
    // Startwert 99, passend zur Nutzeranforderung
    if (!existsState(REF_SOC_DP)) {
        createState(REF_SOC_DP, 99, { type: 'number', name: 'Redodo App SOC Referenz (z.B. 99)', unit: '%', read: true, write: true, role: 'value' });
        log("Datenpunkt " + REF_SOC_DP + " angelegt. BITTE ANPASSEN!", 'warn');
    }

    // Spannungs Referenz (Eingabe durch Benutzer)
    // Startwert 13.5, passend zur Nutzeranforderung
    if (!existsState(REF_VOLTAGE_DP)) {
        createState(REF_VOLTAGE_DP, 13.5, { type: 'number', name: 'Redodo App Spannungs Referenz (z.B. 13.5V)', unit: 'V', read: true, write: true, role: 'value' });
        log("Datenpunkt " + REF_VOLTAGE_DP + " angelegt. BITTE ANPASSEN!", 'warn');
    }

    // Spannungs Offset (Debug/Anzeige)
    if (!existsState(VOLTAGE_OFFSET_DP)) {
        createState(VOLTAGE_OFFSET_DP, 0.0, { type: 'number', name: 'Dynamischer Spannungs-Offset', unit: 'V', read: true, write: false, role: 'value' });
        log("Datenpunkt " + VOLTAGE_OFFSET_DP + " angelegt.", 'info');
    }
}
checkAndCreateStates();


// Globale Variable, um den vorherigen Textwert zu speichern (für optimiertes Schreiben)
let lastSocText = getState(SOC_TEXT_DP) ? getState(SOC_TEXT_DP).val : "Unbekannt";

/**
 * --------------------------------------------------------------------------------
 * HAUPT LOGIK
 * --------------------------------------------------------------------------------
 */

/**
 * Berechnet den Spannungs-Offset basierend auf den Referenzwerten.
 * @param {number} refSoc - SOC-Referenz.
 * @param {number} refVoltage - Spannungs-Referenz.
 * @returns {number} Der zu verwendende Spannungs-Offset.
 */
function calculateOffset(refSoc, refVoltage) {
    if (refSoc < 0 || refSoc > 100 || refVoltage <= 0) {
        log("Ungültige Referenzwerte: SOC=" + refSoc + "%, Volt=" + refVoltage + "V. Verwende Offset = 0.0V.", 'warn');
        return 0.0;
    }

    // 1. Finde die Spannung, die diesem SOC auf der STANDARD-Kurve entspricht.
    const standardVoltageForRefSoc = voltageForSOC(refSoc);

    // 2. Berechne den Offset (Differenz zwischen tatsächlicher und Standard-Spannung)
    const offset = refVoltage - standardVoltageForRefSoc;
    
    // Schreibe den berechneten Offset für Debug-Zwecke
    setState(VOLTAGE_OFFSET_DP, parseFloat(offset.toFixed(3)), true);

    log("Offset-Berechnung: Ref. SOC=" + refSoc + "%, Ref. Volt=" + refVoltage.toFixed(2) + "V, Standard-Volt=" + standardVoltageForRefSoc.toFixed(2) + "V. Offset=" + offset.toFixed(3) + "V", 'debug');
    
    return offset;
}


/**
 * Hauptfunktion zur Berechnung und Aktualisierung des SOC.
 */
function updateSOC() {
    log("Starte SOC-Aktualisierung...", 'debug');

    // 1. Lese Eingabe-Spannung und Referenzen
    const voltageState = getState(VOLTAGE_INPUT_DP);
    const refSocState = getState(REF_SOC_DP);
    const refVoltageState = getState(REF_VOLTAGE_DP);

    let socText = "Unbekannt";
    let calculatedSoc = 0; // WICHTIG: Deklariert im Funktionsbereich, um am Ende zugänglich zu sein

    // Prüfe auf gültige Zustände
    if (!voltageState || voltageState.val === null || voltageState.val === undefined) {
        log("Fehler: Datenpunkt für aktuelle Spannung (" + VOLTAGE_INPUT_DP + ") ist ungültig.", 'error');
        return;
    }
    if (!refSocState || refSocState.val === null || refSocState.val === undefined || !refVoltageState || refVoltageState.val === null || refVoltageState.val === undefined) {
        log("Fehler: Referenz-Datenpunkte sind ungültig. Stelle sicher, dass " + REF_SOC_DP + " und " + REF_VOLTAGE_DP + " existieren und Werte haben.", 'error');
        return;
    }

    // Wandle Werte in Zahlen um
    const currentVoltage = parseFloat(voltageState.val);
    const refSoc = parseFloat(refSocState.val);
    const refVoltage = parseFloat(refVoltageState.val);

    if (isNaN(currentVoltage) || isNaN(refSoc) || isNaN(refVoltage)) {
         log("Fehler: Einer der gelesenen Werte ist keine Zahl. Aktuelle Spannung: " + voltageState.val + ", Ref SOC: " + refSocState.val + ", Ref Volt: " + refVoltageState.val, 'error');
         return;
    }

    try {
        // 2. Berechne den dynamischen Spannungs-Offset
        const voltageOffset = calculateOffset(refSoc, refVoltage);

        // 3. Wende den Offset auf die aktuelle Spannung an, um die "kalibrierte" Spannung zu erhalten
        // Dadurch verschiebt sich die Messung auf die Position der Standard-Kurve
        const adjustedVoltage = currentVoltage - voltageOffset;
        
        log("Aktuelle Spannung: " + currentVoltage.toFixed(2) + "V. Angepasste Spannung: " + adjustedVoltage.toFixed(2) + "V.", 'debug');

        // 4. Interpoliere den SOC mit der angepassten Spannung auf der Standard-Kurve
        calculatedSoc = interpolateSOC(adjustedVoltage); // Zuweisung zur bereits deklarierten Variable

        // 5. Speichere den berechneten SOC
        setState(SOC_OUTPUT_DP, calculatedSoc, true); // Mit 'true' wird der Wert als bestätigt markiert
        
        // 6. Erzeuge Textstatus
        socText = socToText(calculatedSoc);

    } catch (e) {
        log("Fehler in der SOC-Berechnungslogik: " + e.message, 'error');
        // Setze Text auf Fehler, aber ändere SOC nicht
        socText = "FEHLER"; 
    }

    // 7. Speichere Textstatus, aber nur wenn er sich geändert hat (Performance-Optimierung)
    if (socText !== lastSocText) {
        setState(SOC_TEXT_DP, socText, true);
        lastSocText = socText;
        log("SOC Textstatus auf '" + socText + "' aktualisiert.", 'info');
    }
    
    // Dieser Aufruf funktioniert jetzt, da calculatedSoc im Funktions-Scope deklariert ist.
    log("SOC-Aktualisierung beendet. Berechneter SOC: " + calculatedSoc + "%", 'debug');
}

/**
 * --------------------------------------------------------------------------------
 * SCHEDULING
 * --------------------------------------------------------------------------------
 */

// Initialer Aufruf beim Start des Skripts
updateSOC();

// Timer setzen, alle 5 Minuten erneut ausführen
const timerId = setInterval(updateSOC, interval);

// Lösche Timer beim Beenden des Skripts (Best Practice)
onStop(function () {
    if (timerId) {
        clearInterval(timerId);
    }
}, 1000);

// Aktiviere Logging für das Skript
// setLogLevel('debug');
