/**
 * Admin Logic - Story Recorder
 */

let currentPassword = localStorage.getItem('admin_password') || '';
let stories = [];

// Filter State
let activeFilterFor = 'all'; // Für wen
let activeFilterBy = []; // Von wem (Multi-select)
let activeFilterLiked = false; // Only show liked stories

let tempFilterFor = 'all';
let tempFilterBy = [];
let tempFilterLiked = false; // Temporary state for liked filter
let lastFocusedElement = null;

// DOM Elements
const authOverlay = document.getElementById('auth-overlay');
const passwordInput = document.getElementById('admin-password');
const loginBtn = document.getElementById('btn-login');
const authError = document.getElementById('auth-error');
const logoutBtn = document.getElementById('btn-logout');
const storyList = document.getElementById('story-list');
const storyCount = document.getElementById('story-count');
const filterOverlay = document.getElementById('filter-overlay');
const senderList = document.getElementById('sender-list');
const btnOpenFilter = document.getElementById('btn-open-filter');

// Initialization
function init() {
    if (currentPassword) {
        checkAuthAndLoad();
    } else {
        // Initial focus for better UX/Best Practice
        if (passwordInput) passwordInput.focus();
    }

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
        window.location.href = '/';
    });

    if (btnOpenFilter) {
        btnOpenFilter.addEventListener('click', openFilter);
    }

    // Initial setup for the global listener
    document.addEventListener('change', (e) => {
        const target = e.target;
        if (target.name === 'temp-for') {
            tempFilterFor = target.value;
            renderSenderList();
            updateUI();
        } else if (target.name === 'temp-by') {
            const val = target.value;
            if (target.checked) {
                if (!tempFilterBy.includes(val)) {
                    tempFilterBy.push(val);
                }
            } else {
                tempFilterBy = tempFilterBy.filter(v => v !== val);
            }
            updateUI();
        }
    });

    // Keyboard listeners
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !filterOverlay.classList.contains('hidden')) {
            closeFilter();
        }

        // Focus trapping
        if (e.key === 'Tab' && !filterOverlay.classList.contains('hidden')) {
            const trapElements = filterOverlay.querySelectorAll('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])');
            const focusables = Array.from(trapElements).filter(el => el.offsetParent !== null);
            if (focusables.length === 0) return;

            const first = focusables[0];
            const last = focusables[focusables.length - 1];

            if (e.shiftKey) {
                if (document.activeElement === first) {
                    last.focus();
                    e.preventDefault();
                }
            } else {
                if (document.activeElement === last) {
                    first.focus();
                    e.preventDefault();
                }
            }
        }
    });
}

// Modal Toggle
window.openFilter = () => {
    lastFocusedElement = document.activeElement;
    tempFilterFor = activeFilterFor;
    tempFilterBy = [...activeFilterBy];
    tempFilterLiked = activeFilterLiked;
    filterOverlay.classList.remove('hidden');
    showMainScreen();
    renderSenderList();
    updateUI();

    // Set focus to the first meaningful element (back or close button)
    setTimeout(() => {
        const closeBtn = filterOverlay.querySelector('.btn-close-filter');
        if (closeBtn) closeBtn.focus();
    }, 50);
};

window.closeFilter = () => {
    filterOverlay.classList.add('hidden');
    if (lastFocusedElement) {
        lastFocusedElement.focus();
    }
};

// Navigation
window.showMainScreen = () => {
    document.querySelectorAll('.filter-screen').forEach(s => s.classList.add('hidden'));
    document.getElementById('filter-screen-main').classList.remove('hidden');
};

window.showSubScreen = (id) => {
    document.querySelectorAll('.filter-screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(`filter-screen-${id}`).classList.remove('hidden');
};

window.toggleTempLiked = () => {
    tempFilterLiked = !tempFilterLiked;
    updateUI();
};

// Logic
function renderSenderList() {
    const relevantStories = stories.filter(s => {
        const matchFor = tempFilterFor === 'all' || s.recorded_by === tempFilterFor;
        const matchLiked = !tempFilterLiked || s.liked;
        return matchFor && matchLiked;
    });

    const counts = {};
    relevantStories.forEach(s => {
        const name = s.author || 'Unbekannt';
        counts[name] = (counts[name] || 0) + 1;
    });

    const authors = Object.keys(counts).sort();

    if (authors.length === 0) {
        senderList.innerHTML = '<p style="text-align: center; padding: 20px; color: var(--color-text-secondary); font-size: 14px;">Keine Absender für diese Auswahl.</p>';
        return;
    }

    senderList.innerHTML = authors.map(author => `
        <label class="option-item">
            <span>${author}</span>
            <span class="count">${counts[author]}</span>
            <input type="checkbox" name="temp-by" value="${author}" ${tempFilterBy.includes(author) ? 'checked' : ''}>
            <div class="check-indicator"></div>
        </label>
    `).join('');
}

function updateUI() {
    const valForWhom = document.getElementById('val-for-whom');
    if (valForWhom) {
        valForWhom.textContent = tempFilterFor === 'all' ? 'Alle' : tempFilterFor.charAt(0).toUpperCase() + tempFilterFor.slice(1);
    }

    // Calculate counts for "Für wen" options
    // These should respect tempFilterBy and tempFilterLiked
    const categories = ['nina', 'dani', 'beide'];
    categories.forEach(cat => {
        const countEl = document.getElementById(`count-for-${cat}`);
        if (countEl) {
            const count = stories.filter(s => {
                const matchFor = s.recorded_by === cat;
                const matchBy = tempFilterBy.length === 0 || tempFilterBy.includes(s.author || 'Unbekannt');
                const matchLiked = !tempFilterLiked || s.liked;
                return matchFor && matchBy && matchLiked;
            }).length;
            countEl.textContent = count;
        }
    });

    const activeSelectedBy = tempFilterBy.filter(author => {
        return stories.some(s =>
            (tempFilterFor === 'all' || s.recorded_by === tempFilterFor) &&
            (!tempFilterLiked || s.liked) &&
            (s.author || 'Unbekannt') === author
        );
    });

    const valByWhom = document.getElementById('val-by-whom');
    if (valByWhom) {
        valByWhom.textContent = activeSelectedBy.length === 0 ? 'Alle' :
            activeSelectedBy.length === 1 ? activeSelectedBy[0] : `${activeSelectedBy.length} ausgewählt`;
    }

    const likedCheckbox = document.getElementById('temp-liked');
    const likedIndicator = document.getElementById('liked-indicator');
    if (likedCheckbox && likedIndicator) {
        likedCheckbox.checked = tempFilterLiked;
        if (tempFilterLiked) {
            likedIndicator.classList.add('checked');
        } else {
            likedIndicator.classList.remove('checked');
        }
    }

    const filteredCount = getFilteredCount(tempFilterFor, tempFilterBy, tempFilterLiked);
    document.querySelectorAll('.btn-apply').forEach(btn => {
        btn.textContent = `${filteredCount} Stories anzeigen`;
    });

    document.querySelectorAll('input[name="temp-for"]').forEach(input => {
        input.checked = (input.value === tempFilterFor);
    });
}

function getFilteredCount(forWhom, byWhom, onlyLiked) {
    return stories.filter(s => {
        const matchFor = forWhom === 'all' || s.recorded_by === forWhom;
        const matchBy = byWhom.length === 0 || byWhom.includes(s.author || 'Unbekannt');
        const matchLiked = !onlyLiked || s.liked;
        return matchFor && matchBy && matchLiked;
    }).length;
}

window.clearAllFilters = () => {
    tempFilterFor = 'all';
    tempFilterBy = [];
    tempFilterLiked = false;
    renderSenderList();
    updateUI();
};

window.clearForFilter = () => {
    tempFilterFor = 'all';
    renderSenderList();
    updateUI();
};

window.clearByFilter = () => {
    tempFilterBy = [];
    renderSenderList();
    updateUI();
};

window.applyFilters = () => {
    activeFilterFor = tempFilterFor;
    activeFilterBy = [...tempFilterBy];
    activeFilterLiked = tempFilterLiked;
    closeFilter();
    renderStories();
};

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
            if (authError) authError.style.display = 'block';
            currentPassword = '';
            localStorage.removeItem('admin_password');
        }
    } catch (e) {
        console.error('Auth error:', e);
        if (authError) {
            authError.textContent = 'Verbindungsfehler';
            authError.style.display = 'block';
        }
    }
}

function formatDuration(seconds) {
    if (seconds < 60) return `${Math.round(seconds)}s`;
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
    const filtered = stories.filter(s => {
        const matchFor = activeFilterFor === 'all' || s.recorded_by === activeFilterFor;
        const matchBy = activeFilterBy.length === 0 || activeFilterBy.includes(s.author || 'Unbekannt');
        const matchLiked = !activeFilterLiked || s.liked;
        return matchFor && matchBy && matchLiked;
    });

    // Sort by timestamp desc
    filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const activeFiltersDisplay = document.getElementById('active-filters');
    if (activeFiltersDisplay) {
        let forText = activeFilterFor === 'all' ? '' : `Für ${activeFilterFor.charAt(0).toUpperCase() + activeFilterFor.slice(1)}`;
        let byText = '';
        if (activeFilterBy.length > 0) {
            if (activeFilterBy.length <= 2) {
                byText = `von ${activeFilterBy.join(', ')}`;
            } else {
                byText = `von ${activeFilterBy.slice(0, 2).join(', ')} + ${activeFilterBy.length - 2} mehr`;
            }
        }
        let likedText = activeFilterLiked ? 'Favoriten' : '';
        let parts = [forText, byText, likedText].filter(p => p !== '');
        activeFiltersDisplay.textContent = parts.length > 0 ? parts.join(', ') : '';
    }

    if (storyCount) {
        storyCount.textContent = `${filtered.length} Ergebnis${filtered.length === 1 ? '' : 'se'}`;
    }

    if (filtered.length === 0) {
        storyList.innerHTML = '<p class="no-stories" style="text-align: center; padding: 40px; color: var(--color-text-secondary);">Keine Stories gefunden.</p>';
        return;
    }

    storyList.innerHTML = filtered.map(story => `
        <div class="story-item" data-id="${story.id}">
            <div class="story-header">
                <div>
                    <span class="tag tag-${story.recorded_by}">${story.recorded_by}</span>
                    <strong style="font-size: 16px; padding-left: 5px;">${story.author || 'Unbekannt'}</strong>
                    <div class="story-meta">
                        ${formatDate(story.timestamp)} &bull; ${formatDuration(story.duration)}
                    </div>
                </div>
                <div style="font-size: 11px; font-weight: bold; color: #CBD5E0;">ID: ${story.id}</div>
            </div>
            
            <audio controls preload="none" aria-label="Audio Wiedergabe">
                <source src="/${story.audio_path}" type="audio/webm">
                Dein Browser unterstützt kein Audio.
            </audio>

            <div class="story-actions">
                <button class="btn btn-sm btn-like ${story.liked ? 'active' : ''}" onclick="toggleLike('${story.id}')" aria-label="${story.liked ? 'Favorit entfernen' : 'Favorit hinzufügen'}">
                    <svg class="admin-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l8.84-8.84 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                    ${story.liked ? 'geliked' : 'liken'}
                </button>
                <button class="btn btn-sm btn-delete" onclick="deleteStory('${story.id}')" aria-label="Story löschen">
                    <img src="../assets/icon-trash.svg" class="admin-icon" alt="" aria-hidden="true">
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
            const updated = await response.json();
            stories = stories.map(s => s.id === id ? { ...s, liked: updated.liked } : s);
            renderStories();
        }
    } catch (e) {
        console.error('Like error:', e);
    }
};

window.deleteStory = async (id) => {
    if (!confirm('Bist du sicher, dass du diese Story löschen willst?')) return;
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

document.addEventListener('DOMContentLoaded', init);
