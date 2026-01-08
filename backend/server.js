const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const util = require('util');
const { exec } = require('child_process');
const execPromise = util.promisify(exec);

const compression = require('compression');
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static').path;

const app = express();
const PORT = process.env.PORT || 3000;

// Paths
const STORIES_DIR = path.join(__dirname, '..', 'stories');
const AUDIOS_DIR = path.join(STORIES_DIR, 'audios');
const METADATA_DIR = path.join(STORIES_DIR, 'metadata'); // Legacy
const COUNTER_FILE = path.join(STORIES_DIR, 'counter.json');
const CENTRAL_METADATA_FILE = path.join(STORIES_DIR, 'metadata.json');

const ADMIN_PASSWORD = 'admin'; // Change this to a secure password

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

    // Initialize counter file if it doesn't exist
    if (!fs.existsSync(COUNTER_FILE)) {
        fs.writeFileSync(COUNTER_FILE, JSON.stringify({ nextId: 1 }));
    }

    // Initialize central metadata if it doesn't exist
    if (!fs.existsSync(CENTRAL_METADATA_FILE)) {
        initCentralMetadata();
    }
}

// Migrate existing metadata to central JSON
function initCentralMetadata() {
    const stories = [];
    if (fs.existsSync(METADATA_DIR)) {
        const files = fs.readdirSync(METADATA_DIR);
        files.forEach(file => {
            if (file.endsWith('.json')) {
                try {
                    const content = JSON.parse(fs.readFileSync(path.join(METADATA_DIR, file), 'utf8'));
                    // Map legacy structure to new central schema
                    stories.push({
                        id: content.id,
                        recorded_by: content.category || 'beide',
                        timestamp: content.timestamp,
                        duration: content.duration || 0,
                        liked: content.liked || false,
                        audio_path: `audios/${content.id}_${content.category || 'beide'}.webm`,
                        author: content.author // Keep for backward compat
                    });
                } catch (e) {
                    console.error('Error parsing legacy metadata file:', file, e);
                }
            }
        });
    }
    fs.writeFileSync(CENTRAL_METADATA_FILE, JSON.stringify(stories, null, 2));
    console.log(`[${new Date().toISOString()}] Central metadata initialized with ${stories.length} stories.`);
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

// Security Headers
app.use((req, res, next) => {
    // Content Security Policy
    res.setHeader('Content-Security-Policy',
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline'; " + // unsafe-inline needed for some of our bootstrap/deferred logic
        "style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: blob:; " + // blob needed for recordings
        "media-src 'self' blob:; " +
        "connect-src 'self'; " +
        "font-src 'self'; " +
        "frame-ancestors 'none'; " +
        "object-src 'none';"
    );

    // Strict-Transport-Security (1 year)
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

    // Cross-Origin-Opener-Policy
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');

    // Cross-Origin-Embedder-Policy
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp'); // Needed for some advanced features or security

    // Prevent Clickjacking
    res.setHeader('X-Frame-Options', 'DENY');

    // No Sniff
    res.setHeader('X-Content-Type-Options', 'nosniff');

    next();
});

app.use(compression());
app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Serve audio files statically
app.use('/audios', express.static(AUDIOS_DIR));

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

/**
 * Fixes WebM duration metadata using FFmpeg and extracts actual duration.
 * @param {string} inputPath Path to the uploaded WebM file
 * @returns {Promise<number|null>} Actual duration in seconds or null on error
 */
async function processAudioWithFFmpeg(inputPath) {
    const tempOutputPath = inputPath + '.fixed.webm';
    try {
        // 1. Remux to fix metadata/duration (no re-encoding)
        console.log(`[FFmpeg] Processing: ${inputPath}`);
        await execPromise(`"${ffmpegPath}" -i "${inputPath}" -c copy -y "${tempOutputPath}"`);

        // 2. Extract duration using ffprobe
        const { stdout } = await execPromise(`"${ffprobePath}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${tempOutputPath}"`);
        const actualDuration = parseFloat(stdout.trim());

        // 3. Replace original with fixed file
        if (fs.existsSync(inputPath)) {
            fs.unlinkSync(inputPath);
        }
        fs.renameSync(tempOutputPath, inputPath);

        console.log(`[FFmpeg] Success. Fixed duration: ${actualDuration}s`);
        return actualDuration;
    } catch (error) {
        console.error('[FFmpeg] Error processing audio:', error.message);
        // Clean up temp file if it exists
        if (fs.existsSync(tempOutputPath)) {
            try { fs.unlinkSync(tempOutputPath); } catch (e) { }
        }
        return null;
    }
}

// Upload endpoint
app.post('/api/upload', upload.single('audio'), async (req, res) => {
    try {
        const { category, author, duration } = req.body;
        let storyDuration = parseFloat(duration) || 0;

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
        const audioFilename = `${formattedId}_${category}.webm`;
        const audioPath = path.join(AUDIOS_DIR, audioFilename);

        // Helper to move file with retry and copy fallback
        const moveFile = (source, target, retries = 3) => {
            try {
                fs.renameSync(source, target);
            } catch (err) {
                if (retries > 0 && (err.code === 'EBUSY' || err.code === 'EPERM')) {
                    const wait = Date.now() + 100;
                    while (Date.now() < wait);
                    return moveFile(source, target, retries - 1);
                }
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

        // FFmpeg processing to fix duration and extract accurate value
        const accurateDuration = await processAudioWithFFmpeg(audioPath);
        if (accurateDuration !== null) {
            storyDuration = accurateDuration;
        }

        // Save metadata to central file
        const metadata = {
            id: formattedId,
            recorded_by: category,
            timestamp: new Date().toISOString(),
            duration: storyDuration,
            liked: false,
            audio_path: `audios/${audioFilename}`,
            author: author // keeping for detail
        };

        let stories = [];
        if (fs.existsSync(CENTRAL_METADATA_FILE)) {
            stories = JSON.parse(fs.readFileSync(CENTRAL_METADATA_FILE, 'utf8'));
        }
        stories.push(metadata);
        fs.writeFileSync(CENTRAL_METADATA_FILE, JSON.stringify(stories, null, 2));

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

// --- ADMIN API ---

// Simple password check middleware
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (authHeader === ADMIN_PASSWORD) {
        next();
    } else {
        res.status(401).json({ error: 'Nicht autorisiert' });
    }
};

// Get all stories
app.get('/api/admin/stories', authMiddleware, (req, res) => {
    try {
        const stories = JSON.parse(fs.readFileSync(CENTRAL_METADATA_FILE, 'utf8'));
        res.json(stories);
    } catch (e) {
        res.status(500).json({ error: 'Fehler beim Lesen der Stories' });
    }
});

// Toggle like state
app.post('/api/admin/stories/:id/like', authMiddleware, (req, res) => {
    try {
        const { id } = req.params;
        const stories = JSON.parse(fs.readFileSync(CENTRAL_METADATA_FILE, 'utf8'));
        const index = stories.findIndex(s => s.id === id);

        if (index === -1) return res.status(404).json({ error: 'Story nicht gefunden' });

        stories[index].liked = !stories[index].liked;
        fs.writeFileSync(CENTRAL_METADATA_FILE, JSON.stringify(stories, null, 2));

        res.json({ success: true, liked: stories[index].liked });
    } catch (e) {
        res.status(500).json({ error: 'Fehler beim Aktialisieren der Story' });
    }
});

// Delete story
app.delete('/api/admin/stories/:id', authMiddleware, (req, res) => {
    try {
        const { id } = req.params;
        let stories = JSON.parse(fs.readFileSync(CENTRAL_METADATA_FILE, 'utf8'));
        const storyToDelete = stories.find(s => s.id === id);

        if (!storyToDelete) return res.status(404).json({ error: 'Story nicht gefunden' });

        // Delete audio file
        const audioPath = path.join(STORIES_DIR, storyToDelete.audio_path);
        if (fs.existsSync(audioPath)) {
            fs.unlinkSync(audioPath);
        }

        // Remove from metadata
        stories = stories.filter(s => s.id !== id);
        fs.writeFileSync(CENTRAL_METADATA_FILE, JSON.stringify(stories, null, 2));

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Fehler beim Löschen der Story' });
    }
});

// Admin static page
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'admin', 'index.html'));
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
  Admin: http://localhost:${PORT}/admin
  
  Ordnerstruktur:
  - Audios: ${AUDIOS_DIR}
  - Zentrales Metadata: ${CENTRAL_METADATA_FILE}
====================================
`);
});
