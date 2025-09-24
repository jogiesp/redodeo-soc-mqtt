# Redodeo SOC Script

Dieses Projekt berechnet den State of Charge (SOC) einer Redodeo 12V LiFePO4 Batterie basierend auf der Spannung, die über den Datenpunkt `0_userdata.0.solar.redodeo_single_volt` ausgelesen wird. Der berechnete SOC wird dann in `0_userdata.0.solar.redodeo_soc` gespeichert.

## Status

**Alpha-Phase:** Dieses Projekt befindet sich noch in der frühen Entwicklungsphase. Fehler und unerwartetes Verhalten sind möglich.

## Funktionsweise

Das Script führt alle 30 Sekunden folgende Schritte aus:

1. Liest die aktuelle Batteriespannung aus.
2. Interpoliert den SOC anhand einer vordefinierten Spannung-SOC-Kurve.
3. Speichert den SOC-Wert im entsprechenden Datenpunkt.

### Spannung-SOC-Kurve (Beispiel)

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

### Grafische Darstellung der Ladecharakteristik

```text
100% ┤■■■■■■■■
 90% ┤■■■■■■
 80% ┤■■■■
 70% ┤■■■
 60% ┤■■
 50% ┤■
 40% ┤
 30% ┤
 20% ┤
 10% ┤
  0% ┤
    11.8 12.0 12.2 12.4 12.6 12.8 13.0 13.2 13.4 13.6 13.8 14.1 V
```

## Installation

1. Script in ioBroker als JavaScript anlegen.
2. Datenpunkte `0_userdata.0.solar.redodeo_single_volt` und `0_userdata.0.solar.redodeo_soc` sicherstellen.
3. Script starten.

## Hinweise

* Die Spannung-SOC-Kurve basiert auf Erfahrungswerten und sollte ggf. an die eigenen Batteriedaten angepasst werden.
* In der Alpha-Phase kann es zu Abweichungen zwischen angezeigtem SOC und tatsächlicher Batteriekapazität kommen.
