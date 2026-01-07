# 🎙️ Story Recorder

Eine leichtgewichtige Web-App zum Aufnehmen von Audio-Stories bei einer Geburtstagsfeier.

## 🚀 Schnellstart

### Voraussetzungen

1. **Node.js** (v18 oder höher)
   - Download: https://nodejs.org/

2. **Python** (3.8 oder höher)
   - Download: https://www.python.org/downloads/

3. **Browser** (Chrome, Firefox, Safari oder Edge)

### Installation & Start

```bash
# 1. In das Projektverzeichnis wechseln
cd story-teller

# 2. Server starten (installiert automatisch Abhängigkeiten)
.\start.bat
```

Die App ist dann erreichbar unter: **http://localhost:3000**

## 📱 Nutzung

1. QR-Code scannen oder URL öffnen
2. "Aufnahme starten" drücken
3. Story erzählen
4. "Stop" drücken
5. Aufnahme anhören
6. Kategorie wählen (Nina / Dani / Beide)
7. "Hochladen" drücken
8. Fertig! ✨

## 🐳 Deployment mit Docker

Für ein einfaches und persistentes Deployment kann Docker verwendet werden:

### 1. Container starten
```bash
docker-compose up -d
```

### 2. Container stoppen
```bash
docker-compose down
```

**Hinweis:** Die Aufnahmen und Metadaten werden im lokalen Ordner `stories/` gespeichert und bleiben auch beim Neustart des Containers erhalten. FFmpeg ist bereits im Docker-Image enthalten.



## 📁 Ordnerstruktur

```
story-teller/
├── backend/
│   ├── server.js           # Express Server
│   └── package.json
├── frontend/
│   ├── index.html          # Single-Page App
│   ├── styles.css          # Styling
│   └── app.js              # Logik
├── stories/                # Gespeicherte Stories
│   ├── audios/
│   │   ├── nina/
│   │   ├── dani/
│   │   └── beide/
│   ├── metadata/
│   │   ├── nina/
│   │   ├── dani/
│   │   └── beide/
│   └── counter.json        # ID-Zähler
├── README.md
└── start.bat               # Startet Server
```

## 🔧 Konfiguration

Der Server läuft standardmäßig auf Port 3000.
Für einen anderen Port:

```bash
PORT=8080 npm start --prefix backend
```

## 📋 Technische Details

- **Frontend**: Vanilla HTML/CSS/JS (kein Framework)
- **Backend**: Node.js + Express
- **Audio-Format**: WebM (Browser-nativ)
- **Audio-Verarbeitung**: Automatisches Fixen von Metadaten und Dauer via FFmpeg (statische Binaries im Projekt enthalten)

## 🎯 Features

- ✅ Mobile-optimiert
- ✅ Automatischer ID-Vergabe
- ✅ Einfache Bedienung

Keine bekannten Probleme.
