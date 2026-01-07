/**
 * Admin Logic - Story Recorder
 */

let currentPassword = localStorage.getItem('admin_password') || '';
let stories = [];
let activeFilter = 'all';

// DOM Elements
const authOverlay = document.getElementById('auth-overlay');
const passwordInput = document.getElementById('admin-password');
const loginBtn = document.getElementById('btn-login');
const authError = document.getElementById('auth-error');
const logoutBtn = document.getElementById('btn-logout');
const storyList = document.getElementById('story-list');
const storyCount = document.getElementById('story-count');
const filterRadios = document.querySelectorAll('input[name="admin-filter"]');

// Initialization
function init() {
    if (currentPassword) {
        checkAuthAndLoad();
    }
    updateFilterUI();

    loginBtn.addEventListener('click', () => {
        currentPassword = passwordInput.value;
        checkAuthAndLoad();
    });

    passwordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            currentPassword = passwordInput.value;
            checkAuthAndLoad();
        }
    });

    logoutBtn.addEventListener('click', () => {
        currentPassword = '';
        localStorage.removeItem('admin_password');
        window.location.href = '/'; // Redirect to homepage
    });

    filterRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            activeFilter = e.target.value;
            updateFilterUI();
            renderStories();
        });
    });
}

function updateFilterUI() {
    filterRadios.forEach(radio => {
        const label = document.querySelector(`label[for="${radio.id}"]`);
        if (label) {
            if (radio.checked) {
                label.classList.add('active');
            } else {
                label.classList.remove('active');
            }
        }
    });
}

async function checkAuthAndLoad() {
    try {
        const response = await fetch('/api/admin/stories', {
            headers: { 'Authorization': currentPassword }
        });

        if (response.ok) {
            localStorage.setItem('admin_password', currentPassword);
            authOverlay.classList.add('hidden');
            stories = await response.json();
            renderStories();
        } else {
            authError.style.display = 'block';
            currentPassword = '';
            localStorage.removeItem('admin_password');
        }
    } catch (e) {
        console.error('Auth error:', e);
        authError.textContent = 'Verbindungsfehler';
        authError.style.display = 'block';
    }
}

function formatDuration(seconds) {
    if (seconds < 60) {
        return `${Math.round(seconds)}s`;
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')} min`;
}

function formatDate(isoString) {
    const d = new Date(isoString);
    return d.toLocaleString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function renderStories() {
    const filtered = stories.filter(s => activeFilter === 'all' || s.recorded_by === activeFilter);
    storyCount.textContent = `${filtered.length} Stories gefunden`;

    if (filtered.length === 0) {
        storyList.innerHTML = '<p style="text-align: center; padding: 40px; color: var(--color-text-secondary);">Keine Stories gefunden.</p>';
        return;
    }

    // Sort by timestamp desc
    filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    storyList.innerHTML = filtered.map(story => `
        <div class="story-item" data-id="${story.id}">
            <div class="story-header">
                <div>
                    <span class="tag tag-${story.recorded_by}">${story.recorded_by}</span>
                    <strong style="font-size: 16px;padding-left: 5px;">${story.author || 'Unbekannt'}</strong>
                    <div class="story-meta" style="padding-top:5px">
                        ${formatDate(story.timestamp)} &bull; ${formatDuration(story.duration)}
                    </div>
                </div>
                <div style="font-size: 11px; font-weight: bold; color: #CBD5E0;">ID: ${story.id}</div>
            </div>
            
            <audio controls preload="none">
                <source src="/${story.audio_path}" type="audio/webm">
                Dein Browser unterstützt kein Audio.
            </audio>

            <div class="story-actions">
                <button class="btn btn-sm btn-like ${story.liked ? 'active' : ''}" onclick="toggleLike('${story.id}')">
                    <svg class="admin-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                    ${story.liked ? 'geliked' : 'liken'}
                </button>
                <button class="btn btn-sm btn-delete" onclick="deleteStory('${story.id}')">
                    <img src="../assets/icon-trash.svg" class="admin-icon" alt="Löschen">
                    Löschen
                </button>
            </div>
        </div>
    `).join('');
}

window.toggleLike = async (id) => {
    try {
        const response = await fetch(`/api/admin/stories/${id}/like`, {
            method: 'POST',
            headers: { 'Authorization': currentPassword }
        });
        if (response.ok) {
            const data = await response.json();
            const index = stories.findIndex(s => s.id === id);
            if (index !== -1) {
                stories[index].liked = data.liked;
                renderStories();
            }
        }
    } catch (e) {
        console.error('Like error:', e);
    }
};

window.deleteStory = async (id) => {
    if (!confirm('Bist du sicher, dass du diese Story löschen möchtest?')) return;

    try {
        const response = await fetch(`/api/admin/stories/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': currentPassword }
        });
        if (response.ok) {
            stories = stories.filter(s => s.id !== id);
            renderStories();
        }
    } catch (e) {
        console.error('Delete error:', e);
    }
};

init();
