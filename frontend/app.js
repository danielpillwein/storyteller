/**
 * Story Recorder - Main Application
 * 
 * A lightweight audio recording app for capturing birthday stories.
 * Uses MediaRecorder API for audio capture and sends to backend for storage.
 */

// ========================================
// State
// ========================================
let mediaRecorder = null;
let audioChunks = [];
let recordingStartTime = null;
let timerInterval = null;
let audioBlob = null;
let selectedCategory = null;
let retryAction = null;
let initialized = false;

// ========================================
// DOM Elements (Populated in init)
// ========================================
let screens = {};
let elements = {};

// ========================================
// Initialization
// ========================================
export function init() {
    if (initialized) return;

    if (window.umami) {
      umami.track('app_loaded');
    }
    
    // Populate elements
    screens = {
        welcome: document.getElementById('screen-welcome'),
        recording: document.getElementById('screen-recording'),
        preview: document.getElementById('screen-preview'),
        uploading: document.getElementById('screen-uploading'),
        success: document.getElementById('screen-success')
    };

    elements = {
        btnStart: document.getElementById('btn-start'),
        btnStop: document.getElementById('btn-stop'),
        btnUpload: document.getElementById('btn-upload'),
        btnDiscard: document.getElementById('btn-discard'),
        btnAnother: document.getElementById('btn-another'),
        btnRetry: document.getElementById('btn-retry'),
        btnCancel: document.getElementById('btn-cancel'),
        timer: document.getElementById('timer'),
        audioPreview: document.getElementById('audio-preview'),
        errorOverlay: document.getElementById('error-overlay'),
        errorMessage: document.getElementById('error-message'),
        categoryInputs: document.querySelectorAll('input[name="category"]')
    };

    // Check for required APIs
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showError('Dein Browser unterstützt keine Audioaufnahme. Bitte verwende einen modernen Browser wie Chrome, Firefox oder Safari.');
        return;
    }

    if (!window.MediaRecorder) {
        showError('Dein Browser unterstützt MediaRecorder nicht. Bitte verwende Chrome, Firefox oder Safari.');
        return;
    }

    initEventListeners();
    initialized = true;
    console.log('Story Recorder initialized');
}

// Exported for immediate start from bootloader
export async function startRecordingFlow() {
    await startRecording();
}

// ... Rest of the functions (flattened from IIFE) ...

const API_URL = '/api/upload';
const MAX_RECORDING_TIME = 5 * 60 * 1000; // 5 minutes max

function showScreen(screenName) {
    Object.values(screens).forEach(screen => {
        screen.classList.remove('active');
    });

    if (screens[screenName]) {
        screens[screenName].classList.add('active');
    }
}

function showError(message, retryFn = null) {
    elements.errorMessage.textContent = message;
    elements.errorOverlay.classList.add('active');
    retryAction = retryFn;
}

function hideError() {
    elements.errorOverlay.classList.remove('active');
    retryAction = null;
}

function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function startTimer() {
    recordingStartTime = Date.now();
    elements.timer.textContent = '00:00';

    timerInterval = setInterval(() => {
        const elapsed = Date.now() - recordingStartTime;
        elements.timer.textContent = formatTime(elapsed);

        // Auto-stop after max time
        if (elapsed >= MAX_RECORDING_TIME) {
            stopRecording();
        }
    }, 100);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function getSupportedMimeType() {
    const types = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
        'audio/wav'
    ];

    for (const type of types) {
        if (MediaRecorder.isTypeSupported(type)) {
            return type;
        }
    }
    return '';
}

async function startRecording() {
    if (window.umami) {
      umami.track('recording_started');
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                sampleRate: 44100,
                channelCount: 1
            }
        });

        // Reset state
        audioChunks = [];
        audioBlob = null;
        selectedCategory = null;
        elements.btnUpload.disabled = true;
        elements.categoryInputs.forEach(input => input.checked = false);
        document.getElementById('input-author').value = '';

        const mimeType = getSupportedMimeType();
        const options = {
            audioBitsPerSecond: 128000
        };

        if (mimeType) {
            options.mimeType = mimeType;
        }

        mediaRecorder = new MediaRecorder(stream, options);

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = () => {
            if (window.umami) {
              umami.track('recording_finished', {
                duration: Math.round((Date.now() - recordingStartTime) / 1000)
              });
            }
            
            stream.getTracks().forEach(track => track.stop());
            const blobType = mediaRecorder.mimeType || 'audio/webm';
            audioBlob = new Blob(audioChunks, { type: blobType });
            const audioUrl = URL.createObjectURL(audioBlob);
            elements.audioPreview.src = audioUrl;
            elements.audioPreview.load();
            showScreen('preview');
        };

        mediaRecorder.onerror = (event) => {
            console.error('MediaRecorder error:', event.error);
        };

        mediaRecorder.start(500);
        startTimer();
        showScreen('recording');

    } catch (error) {
        console.error('Error starting recording:', error);
        let message = 'Mikrofon konnte nicht gestartet werden.';
        if (error.name === 'NotAllowedError') {
            message = 'Bitte erlaube den Zugriff auf dein Mikrofon.';
        } else if (error.name === 'NotFoundError') {
            message = 'Kein Mikrofon gefunden. Bitte verbinde ein Mikrofon.';
        }
        showError(message, startRecording);
    }
}

function stopRecording() {
    stopTimer();
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }
}

async function uploadRecording() {
    const authorInput = document.getElementById('input-author');
    const authorName = authorInput.value.trim();

    if (window.umami) {
      umami.track('upload_started');
    }

    if (!authorName) {
        showError('Bitte gib deinen Namen ein.', () => {
            authorInput.focus();
        });
        return;
    }

    if (!audioBlob || !selectedCategory) {
        showError('Bitte wähle eine Kategorie aus.');
        return;
    }

    if (elements.audioPreview) {
        elements.audioPreview.pause();
        elements.audioPreview.currentTime = 0;
    }

    showScreen('uploading');

    try {
        let extension = 'webm';
        if (audioBlob.type.includes('ogg')) {
            extension = 'ogg';
        } else if (audioBlob.type.includes('mp4')) {
            extension = 'mp4';
        } else if (audioBlob.type.includes('wav')) {
            extension = 'wav';
        }

        const durationInSeconds = Math.round((Date.now() - recordingStartTime) / 1000);

        const formData = new FormData();
        formData.append('audio', audioBlob, `recording.${extension}`);
        formData.append('category', selectedCategory);
        formData.append('author', authorName);
        formData.append('duration', durationInSeconds);

        const response = await fetch(API_URL, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Upload fehlgeschlagen');
        }

        if (window.umami) {
          umami.track('upload_success', {
            category: selectedCategory
          });
        }

        showScreen('success');

    } catch (error) {
        if (window.umami) {
          umami.track('upload_failed');
        }
        
        console.error('Upload error:', error);
        showError(
            error.message || 'Verbindung zum Server fehlgeschlagen. Bitte versuche es erneut.',
            uploadRecording
        );
        showScreen('preview');
    }
}

function resetToStart() {
    stopTimer();
    if (elements.audioPreview.src) {
        URL.revokeObjectURL(elements.audioPreview.src);
        elements.audioPreview.src = '';
    }
    audioBlob = null;
    audioChunks = [];
    selectedCategory = null;
    elements.categoryInputs.forEach(input => input.checked = false);
    elements.btnUpload.disabled = true;
    elements.btnStart.disabled = false;
    elements.btnStart.textContent = 'Aufnahme starten';
    showScreen('welcome');
}

function initEventListeners() {
    // Start recording - already handled by bootloader for first click, but needed for subsequent
    // Actually, we can just leave it here. It's fine if we add another listener, or we can handle it.
    // However, the bootloader handles the FIRST click.
    // To avoid double start, we should check state or make startRecording idempotent? 
    // Or simpler: bootloader invokes init(), then invokes startRecordingFlow().
    // init() adds listener.
    // If we call startRecordingFlow(), it starts.
    // If the user clicks later, the listener added here works.
    // There is a risk that the `click` that triggered bootloader *also* triggers this listener if we are not careful?
    // No, `init` is called *after* import. The event loop has likely finished the click propagation phase? 
    // Actually, if we `await import` inside the click handler, the event bubbling is done.

    // BUT wait: we are REPLACING the button clone or something? No.
    // Just ensuring we don't bind twice if we don't need to.

    // Let's bind it.
    elements.btnStart.addEventListener('click', startRecording);

    elements.btnStop.addEventListener('click', stopRecording);

    function updateUploadButtonState() {
        const authorName = document.getElementById('input-author').value.trim();
        elements.btnUpload.disabled = !(authorName && selectedCategory);
    }

    elements.categoryInputs.forEach(input => {
        input.addEventListener('change', (e) => {
            selectedCategory = e.target.value;
            updateUploadButtonState();
        });
    });

    document.getElementById('input-author').addEventListener('input', updateUploadButtonState);

    elements.btnUpload.addEventListener('click', uploadRecording);

    elements.btnDiscard.addEventListener('click', () => {
        if (elements.audioPreview.src) {
            URL.revokeObjectURL(elements.audioPreview.src);
        }
        audioBlob = null;
        startRecording();
    });

    elements.btnAnother.addEventListener('click', resetToStart);

    elements.btnRetry.addEventListener('click', () => {
        hideError();
        if (retryAction) {
            retryAction();
        }
    });

    elements.btnCancel.addEventListener('click', () => {
        hideError();
        resetToStart();
    });

    document.addEventListener('visibilitychange', () => {
        if (document.hidden && mediaRecorder?.state === 'recording') {
            console.log('Page hidden, recording continues...');
        }
    });

    window.addEventListener('beforeunload', (e) => {
        if (mediaRecorder?.state === 'recording' || audioBlob) {
            e.preventDefault();
            e.returnValue = 'Du hast eine Aufnahme, die noch nicht hochgeladen wurde. Wirklich verlassen?';
            return e.returnValue;
        }
    });
}
