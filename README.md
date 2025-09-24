# Redodo SOC Script

Dieses Projekt enthält ein JavaScript für **ioBroker**, das den Ladezustand (SOC) einer **Redodo 12V LiFePO4 Batterie** anhand der Batteriespannung berechnet.

## Funktionsweise

* Das Skript liest regelmäßig (alle 30 Sekunden) die Batteriespannung aus.
* Mithilfe einer definierten Spannung-SOC-Kurve wird der **State of Charge (SOC)** interpoliert.
* Der berechnete SOC wird in einem eigenen Datenpunkt gespeichert.

## Datenpunkte

* **Eingang**: `0_userdata.0.solar.redodeo_single_volt`
  Erwartet die aktuelle Batteriespannung (z. B. vom Wechselrichter oder Batteriemonitor).

* **Ausgang**: `0_userdata.0.solar.redodeo_soc`
  Enthält den berechneten SOC in Prozent.

## Anpassungen

Die Spannung-SOC-Kurve ist auf Redodo LiFePO4-Batterien abgestimmt. Beispielwerte:

| Spannung (V) | SOC (%) |
| ------------ | ------- |
| 14.1         | 100     |
| 13.8         | 95      |
| 13.6         | 90      |
| 13.4         | 80      |
| 13.2         | 30      |
| 13.0         | 20      |
| 12.8         | 15      |
| 12.6         | 10      |
| 12.4         | 5       |
| 12.2         | 2       |
| 12.0         | 1       |
| 11.8         | 0       |

Die Kurve kann bei Bedarf an die eigenen Messwerte oder Herstellerangaben angepasst werden.

## Installation

1. Öffne im ioBroker-Admin die Skripte-Verwaltung.
2. Erstelle ein neues **JavaScript**-Skript.
3. Kopiere den Inhalt der Datei `Redodo_SOC.js` hinein.
4. Passe ggf. die Datenpunkt-Namen an deine Umgebung an.

## Hinweise

* Die Berechnung erfolgt **nur anhand der Spannung**, was bei LiFePO4-Batterien nicht immer 100% genau ist. Für präzisere Ergebnisse empfiehlt sich ein Batteriemonitor mit Shunt.
* Das Skript interpoliert Werte linear zwischen den definierten Stützpunkten.

## Lizenz

Dieses Projekt steht unter der **MIT-Lizenz**.
