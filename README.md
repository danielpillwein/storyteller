# 🎙️ Storyteller

Storyteller ist eine schlanke Web-Anwendung zur Aufnahme von kurzen Audio-Geschichten, optimiert für den Einsatz auf Events (z. B. Geburtstagsfeiern). Gäste können direkt über ihr Smartphone Sprachnachrichten aufnehmen, diese einer Kategorie zuordnen und hochladen. Ein integrierter Admin-Bereich ermöglicht die Verwaltung, Filterung und Wiedergabe der Beiträge.

## ✨ Features

- **Audio-Recording:** Webbasiertes Recording über die MediaRecorder API (WebM).
- **Kategorisierung:** Zuordnung der Aufnahmen zu Empfängern (z. B. Nina, Dani, Beide).
- **Metadaten:** Pflichtangabe des Absendernamens für jede Aufnahme.
- **FFmpeg-Korrektur:** Automatische Reparatur von WebM-Metadaten (Dauer/Seekable-Status) nach dem Upload.
- **Admin-Dashboard:** Passwortgeschützte Übersicht mit Filteroptionen für Empfänger, Absender und Favoriten.
- **Mobile First:** Responsives Soft-UI-Design für reibungslose Bedienung auf Smartphones.
- **Local-First Storage:** Speicherung von Audio-Dateien und Metadaten im Dateisystem (keine externe Datenbank nötig).

## 🛠️ Technologie-Stack

- **Frontend:** HTML5, Vanilla JavaScript (ES6+), CSS3 (Modern Soft-UI).
- **Backend:** Node.js, Express.
- **Processing:** FFmpeg (Remuxing zur Korrektur von WebM-Containern).
- **Speicherung:** JSON-basierte Metadaten-Zentralverwaltung, Flat-File Audio-Storage.

## 📐 Architektur & Konzept

Das Projekt folgt einem klassischen Client-Server-Modell mit Fokus auf Einfachheit und Robustheit:

1. **Upload-Flow:** Der Client sendet WebM-Blobs und Metadaten via Multi-part POST an den Server.
2. **Persistence:** Der Server generiert eine eindeutige ID, speichert die Datei flach im System und aktualisiert eine zentrale `metadata.json`.
3. **Processing:** Unmittelbar nach dem Speichern korrigiert FFmpeg den Audio-Stream, um sicherzustellen, dass die Zeitdauer (`duration`) korrekt im Header hinterlegt ist.
4. **Admin-Backend:** Eine zustandslose Filter-Logik im Frontend erlaubt granulare Suchen auf den geladenen JSON-Metadaten.

## 📂 Projektstruktur

```text
├── backend/
│   ├── server.js          # Express-App & API-Endpunkte
│   └── package.json       # Backend-Abhängigkeiten (FFmpeg-Wrapper, etc.)
├── frontend/
│   ├── index.html         # Haupt-Recording-UI
│   ├── app.js             # Client-seitige Recording-Logik
│   ├── styles.css         # Globales Styling
│   └── admin/
│       ├── index.html     # Admin-Interface
│       └── admin.js       # Admin-Logik & Filter-Management
├── stories/               # Datenverzeichnis (automatisch generiert)
│   ├── audios/            # Gespeicherte WebM-Dateien
│   └── metadata.json      # Zentrales Register aller Aufnahmen
├── Dockerfile             # Container-Definition
└── start.bat              # Zentrales Start-Skript für Windows
```

## 📋 Voraussetzungen

- **Node.js:** Version 16.x oder höher.
- **FFmpeg:** Wird primär über `ffmpeg-static` bezogen, sollte aber für manuelle Tests im Pfad verfügbar sein.

## ⚙️ Installation

1. Repository klonen:
   ```bash
   git clone <repository-url>
   cd story-teller
   ```

2. Abhängigkeiten im Backend installieren (wird beim ersten Start via `start.bat` automatisch geprüft):
   ```bash
   cd backend
   npm install
   ```

## 🚀 Starten der Anwendung

Am einfachsten lässt sich die Anwendung unter Windows über die mitgelieferte Batch-Datei starten. Diese prüft automatisch die Abhängigkeiten und startet den Server.

1. **Zentraler Start:**
   Doppelklick auf die `start.bat` im Hauptverzeichnis oder via Terminal:
   ```powershell
   .\start.bat
   ```

2. **Manueller Start (Alternative):**
   ```bash
   cd backend
   npm start
   ```

3. **Zugriff über den Browser:**
   - **Frontend:** `http://localhost:3000` 📱
   - **Admin:** `http://localhost:3000/admin` 🔐

## 📖 Verwendung

- **Gäste:** Rufen die URL auf, geben ihren Namen ein, wählen einen Empfänger und halten den Record-Button zum Sprechen gedrückt.
- **Upload:** Nach Abschluss der Aufnahme wird die Datei automatisch übertragen. Eine Bestätigungsseite erscheint nach erfolgreichem Upload.
- **Speicherung:** Jede Aufnahme erhält eine ID (`001`, `002`, ...) und wird im Ordner `stories/audios/` abgelegt.

## 🛡️ Admin-Bereich

Der Admin-Bereich unter `/admin` (Standard-Passwort: `admin`) bietet folgende Funktionen:
- **Wiedergabe:** Integrierter Audio-Player für alle Beiträge.
- **Filterung:**
  - *Für wen:* Auswahl nach Zielperson.
  - *Von wem:* Dynamische Liste aller Absender mit Beitragszähler.
  - *Favoriten:* Anzeige markierter "Highlights".
- **Management:** Liken (Favorisieren) und Löschen von Beiträgen.

## 🎬 FFmpeg & WebM-Hinweis

Da Browser WebM-Daten oft als Stream ohne vollständige Header aufzeichnen, fehlt beim direkten Abspielen häufig die Zeitangabe. Der Server nutzt FFmpeg, um die Metadaten per `copy`-Codec zu reparieren:

```bash
ffmpeg -i input.webm -c copy output.webm
```

Falls FFmpeg manuell auf Windows installiert werden soll:
```powershell
winget install ffmpeg
```

## ⚙️ Konfiguration

Konfigurationen können direkt in der `backend/server.js` angepasst werden:
- `PORT`: Standardmäßig `3000`.
- `ADMIN_PASSWORD`: Das Passwort für den Zugriff auf `/admin`.
- `STORIES_DIR`: Pfad zum Speichern der Daten.

## 🧩 Erweiterbarkeit

- **Backend-Validierung:** Zusätzliche Checks für Audio-Länge oder Dateitypen.
- **Auth:** Umstellung des Admin-Passworts auf Umgebungsvariablen (`process.env`).
- **Storage:** Migration der `metadata.json` zu einer SQLite-Datenbank bei hohem Datenaufkommen.

## ⚠️ Bekannte Einschränkungen

- **Audio-Format:** Derzeit auf WebM (Codec: Opus) beschränkt, da dies der Standard der MediaRecorder API in den meisten mobilen Browsern ist.
- **Single-Server:** Für den Betrieb in einer Multi-Instance-Umgebung (z. B. K8s) muss ein Shared-Storage für den `stories/`-Ordner konfiguriert werden.

## 📄 Lizenz

Das Projekt ist für den privaten Gebrauch konzipiert. Alle Rechte vorbehalten.
