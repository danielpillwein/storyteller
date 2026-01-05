const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 3000;

// Paths
const STORIES_DIR = path.join(__dirname, '..', 'stories');
const AUDIOS_DIR = path.join(STORIES_DIR, 'audios');
const METADATA_DIR = path.join(STORIES_DIR, 'metadata');
const COUNTER_FILE = path.join(STORIES_DIR, 'counter.json');

// Categories
const CATEGORIES = ['nina', 'dani', 'beide'];

// Ensure directories exist
function ensureDirectories() {
    // Create main directories
    if (!fs.existsSync(STORIES_DIR)) {
        fs.mkdirSync(STORIES_DIR, { recursive: true });
    }

    if (!fs.existsSync(AUDIOS_DIR)) {
        fs.mkdirSync(AUDIOS_DIR, { recursive: true });
    }

    if (!fs.existsSync(METADATA_DIR)) {
        fs.mkdirSync(METADATA_DIR, { recursive: true });
    }

    // Initialize counter file if it doesn't exist
    if (!fs.existsSync(COUNTER_FILE)) {
        fs.writeFileSync(COUNTER_FILE, JSON.stringify({ nextId: 1 }));
    }
}

// Get and increment global ID
function getNextId() {
    const data = JSON.parse(fs.readFileSync(COUNTER_FILE, 'utf8'));
    const currentId = data.nextId;
    data.nextId = currentId + 1;
    fs.writeFileSync(COUNTER_FILE, JSON.stringify(data, null, 2));
    return currentId;
}

// Format ID as 3-digit string
function formatId(id) {
    return String(id).padStart(3, '0');
}

// Initialize directories on startup
ensureDirectories();

// Middleware
app.use(compression()); // Enable Gzip/Brotli compression
app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Store temporarily in stories directory, move later
        const tempDir = path.join(STORIES_DIR, 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        cb(null, tempDir);
    },
    filename: (req, file, cb) => {
        // Temporary filename
        cb(null, `temp_${Date.now()}.webm`);
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB max
    }
});

// Upload endpoint
app.post('/api/upload', upload.single('audio'), async (req, res) => {
    try {
        const { category, author } = req.body;

        // Validate author
        if (!author || author.trim() === '') {
            if (req.file) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(400).json({
                error: 'Bitte gib deinen Namen an.'
            });
        }

        // Validate category
        if (!category || !CATEGORIES.includes(category)) {
            // Clean up uploaded file
            if (req.file) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(400).json({
                error: 'Ungültige Kategorie. Bitte wähle: nina, dani oder beide.'
            });
        }

        if (!req.file) {
            return res.status(400).json({
                error: 'Keine Audiodatei empfangen.'
            });
        }

        // Get next global ID
        const storyId = getNextId();
        const formattedId = formatId(storyId);

        // Define final paths - FLAT STRUCTURE
        // Naming convention: {ID}_{CATEGORY}.webm
        const audioFilename = `${formattedId}_${category}.webm`;
        const audioPath = path.join(AUDIOS_DIR, audioFilename);

        // Helper to move file with retry and copy fallback
        const moveFile = (source, target, retries = 3) => {
            try {
                fs.renameSync(source, target);
            } catch (err) {
                if (retries > 0 && (err.code === 'EBUSY' || err.code === 'EPERM')) {
                    // Wait 100ms and retry
                    const wait = Date.now() + 100;
                    while (Date.now() < wait);
                    return moveFile(source, target, retries - 1);
                }

                // Fallback to copy and delete if rename fails
                if (err.code === 'EXDEV' || err.code === 'EBUSY' || err.code === 'EPERM') {
                    try {
                        fs.copyFileSync(source, target);
                        try {
                            fs.unlinkSync(source);
                        } catch (e) {
                            console.warn('Could not delete temp file after copy:', e.message);
                        }
                    } catch (copyErr) {
                        if (retries > 0) {
                            // Wait 100ms and retry
                            const wait = Date.now() + 100;
                            while (Date.now() < wait);
                            return moveFile(source, target, retries - 1);
                        }
                        throw copyErr;
                    }
                } else {
                    throw err;
                }
            }
        };

        // Move file to final location
        moveFile(req.file.path, audioPath);

        // Save metadata
        const metadata = {
            id: formattedId,
            author: author,
            timestamp: new Date().toISOString(),
            category: category,
            originalFilename: req.file.originalname,
            userAgent: req.get('User-Agent')
        };

        const metadataFilename = `${formattedId}_${category}.json`;
        fs.writeFileSync(
            path.join(METADATA_DIR, metadataFilename),
            JSON.stringify(metadata, null, 2)
        );

        console.log(`[${new Date().toISOString()}] Saved audio: ${audioPath}`);

        // Respond immediately
        res.json({
            success: true,
            message: 'Story erfolgreich gespeichert!',
            storyId: formattedId,
            category
        });

    } catch (error) {
        console.error(`[${new Date().toISOString()}] Upload error:`, error);

        // Clean up uploaded file if it exists
        if (req.file && fs.existsSync(req.file.path)) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (e) {
                console.warn('Failed to cleanup temp file:', e.message);
            }
        }

        res.status(500).json({
            error: 'Fehler beim Speichern der Story. Bitte versuche es erneut.'
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Catch-all: serve index.html for any other route
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`
====================================
  Story Recorder Server gestartet
====================================
  URL: http://localhost:${PORT}
  
  Ordnerstruktur:
  - Audios: ${AUDIOS_DIR}
  - Metadata: ${METADATA_DIR}
====================================
`);
});
