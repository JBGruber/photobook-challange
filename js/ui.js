/**
 * UIManager - Handles all DOM interactions and user interface
 */
class UIManager {
    constructor() {
        this.currentScreen = 'setup';
        this.keyboardEnabled = true;

        this.cacheElements();
        this.bindEvents();
    }

    cacheElements() {
        // Screens
        this.screens = {
            setup: document.getElementById('setup-screen'),
            tournament: document.getElementById('tournament-screen'),
            results: document.getElementById('results-screen')
        };

        // Setup elements
        this.imageInput = document.getElementById('image-input');
        this.csvInput = document.getElementById('csv-input');
        this.imageCount = document.getElementById('image-count');
        this.targetCount = document.getElementById('target-count');
        this.initialLives = document.getElementById('initial-lives');
        this.startBtn = document.getElementById('start-tournament');
        this.resumeSection = document.getElementById('resume-section');
        this.resumeInfo = document.getElementById('resume-info');
        this.resumeBtn = document.getElementById('resume-btn');
        this.clearSessionBtn = document.getElementById('clear-session-btn');

        // Tournament elements
        this.progressFill = document.getElementById('progress-fill');
        this.phaseLabel = document.getElementById('phase-label');
        this.progressStats = document.getElementById('progress-stats');
        this.imageA = document.getElementById('image-a');
        this.imageB = document.getElementById('image-b');
        this.remainingCount = document.getElementById('remaining-count');
        this.eliminatedCount = document.getElementById('eliminated-count');
        this.roundCount = document.getElementById('round-count');
        this.pauseBtn = document.getElementById('pause-btn');
        this.exportBtn = document.getElementById('export-btn');
        this.comparisonButtons = document.querySelectorAll('.comparison-button');

        // Results elements
        this.resultsSummary = document.getElementById('results-summary');
        this.resultsGrid = document.getElementById('results-grid');
        this.exportResultsBtn = document.getElementById('export-results-btn');
        this.copyFilenamesBtn = document.getElementById('copy-filenames-btn');
        this.newTournamentBtn = document.getElementById('new-tournament-btn');

        // Modal elements
        this.modal = document.getElementById('zoom-modal');
        this.modalBackdrop = this.modal.querySelector('.modal-backdrop');
        this.modalClose = this.modal.querySelector('.modal-close');
        this.zoomedImage = document.getElementById('zoomed-image');
    }

    bindEvents() {
        // File inputs
        this.imageInput.addEventListener('change', (e) => this.onImagesSelected?.(e.target.files));
        this.csvInput.addEventListener('change', (e) => this.onCSVImport?.(e.target.files[0]));

        // Setup buttons
        this.startBtn.addEventListener('click', () => {
            const settings = {
                targetCount: parseInt(this.targetCount.value) || 20,
                initialLives: parseInt(this.initialLives.value) || 3
            };
            this.onStartTournament?.(settings);
        });

        this.resumeBtn?.addEventListener('click', () => this.onResume?.());
        this.clearSessionBtn?.addEventListener('click', () => this.onClearSession?.());

        // Comparison buttons
        this.comparisonButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                if (!btn.disabled) {
                    const result = btn.dataset.result;
                    btn.classList.add('pressed');
                    setTimeout(() => btn.classList.remove('pressed'), 150);
                    this.onComparison?.(result);
                }
            });
        });

        // Tournament controls
        this.pauseBtn.addEventListener('click', () => this.onPause?.());
        this.exportBtn.addEventListener('click', () => this.onExport?.());

        // Results controls
        this.exportResultsBtn.addEventListener('click', () => this.onExportResults?.());
        this.copyFilenamesBtn.addEventListener('click', () => this.onCopyFilenames?.());
        this.newTournamentBtn.addEventListener('click', () => this.onNewTournament?.());

        // Image zoom
        this.imageA.addEventListener('click', () => this.showZoom(this.imageA.src));
        this.imageB.addEventListener('click', () => this.showZoom(this.imageB.src));
        this.modalBackdrop.addEventListener('click', () => this.hideZoom());
        this.modalClose.addEventListener('click', () => this.hideZoom());

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeydown(e));
    }

    handleKeydown(e) {
        // Escape always closes modal
        if (e.key === 'Escape') {
            this.hideZoom();
            return;
        }

        // Number keys only work in tournament screen
        if (this.currentScreen !== 'tournament' || !this.keyboardEnabled) return;

        const keyMap = { '1': 'A_wins', '2': 'A_ko', '3': 'B_ko', '4': 'B_wins' };
        const result = keyMap[e.key];

        if (result) {
            e.preventDefault();
            this.onComparison?.(result);
        }
    }

    // Screen management
    showScreen(name) {
        Object.entries(this.screens).forEach(([key, el]) => {
            el.classList.toggle('active', key === name);
        });
        this.currentScreen = name;
    }

    // Setup screen
    updateImageCount(count) {
        this.imageCount.textContent = count > 0
            ? `${count} images selected`
            : 'No images selected';
        this.startBtn.disabled = count === 0;
    }

    showResumeOption(info) {
        this.resumeSection.style.display = 'block';
        this.resumeInfo.textContent = info;
    }

    hideResumeOption() {
        this.resumeSection.style.display = 'none';
    }

    getSettings() {
        return {
            targetCount: parseInt(this.targetCount.value) || 20,
            initialLives: parseInt(this.initialLives.value) || 3
        };
    }

    // Tournament screen
    showComparison(imgA, imgB) {
        this.loadImage(this.imageA, imgA);
        this.loadImage(this.imageB, imgB);
        this.enableButtons();
    }

    loadImage(imgEl, imageData) {
        // Revoke previous object URL if exists
        if (imgEl._objectUrl) {
            URL.revokeObjectURL(imgEl._objectUrl);
            imgEl._objectUrl = null;
        }

        if (imageData.blob) {
            const url = URL.createObjectURL(imageData.blob);
            imgEl._objectUrl = url;
            imgEl.src = url;
        } else {
            imgEl.src = '';
        }
        imgEl.alt = imageData.filename;
    }

    updateProgress(progress) {
        this.progressFill.style.width = `${progress.percent}%`;

        const phaseText = progress.phase === 'knockout'
            ? `Phase 1: Knockout (Round ${progress.round})`
            : 'Phase 2: Final Ranking';
        this.phaseLabel.textContent = phaseText;

        this.progressStats.textContent =
            `${progress.completedComparisons} / ~${progress.estimatedTotal}`;

        this.remainingCount.textContent = progress.activeImages;
        this.eliminatedCount.textContent = progress.eliminatedImages;
        this.roundCount.textContent = progress.round;
    }

    enableButtons() {
        this.comparisonButtons.forEach(btn => btn.disabled = false);
        this.keyboardEnabled = true;
    }

    disableButtons() {
        this.comparisonButtons.forEach(btn => btn.disabled = true);
        this.keyboardEnabled = false;
    }

    // Results screen
    showResults(rankings, totalComparisons) {
        this.resultsSummary.textContent =
            `Top ${rankings.length} images ranked with ${totalComparisons} comparisons`;

        this.resultsGrid.innerHTML = '';

        rankings.forEach((img, idx) => {
            const item = document.createElement('div');
            item.className = 'result-item';

            const imgEl = document.createElement('img');
            imgEl.className = 'result-image';
            if (img.blob) {
                imgEl.src = URL.createObjectURL(img.blob);
            }
            imgEl.alt = img.filename;

            imgEl.addEventListener('click', () => this.showZoom(imgEl.src));

            const info = document.createElement('div');
            info.className = 'result-info';
            info.innerHTML = `
                <div class="result-rank">#${idx + 1}</div>
                <div class="result-filename">${img.filename}</div>
                <div class="result-rating">Rating: ${Math.round(img.rating)}</div>
            `;

            item.appendChild(imgEl);
            item.appendChild(info);
            this.resultsGrid.appendChild(item);
        });
    }

    // Modal
    showZoom(src) {
        if (!src) return;
        this.zoomedImage.src = src;
        this.modal.classList.add('active');
    }

    hideZoom() {
        this.modal.classList.remove('active');
    }

    // Notifications
    showNotification(message, type = 'info') {
        const colors = {
            info: '#3498db',
            success: '#27ae60',
            error: '#e74c3c'
        };

        const div = document.createElement('div');
        div.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${colors[type]};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            z-index: 2000;
            max-width: 300px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            animation: slideIn 0.3s ease;
        `;
        div.textContent = message;

        // Add animation keyframes if not present
        if (!document.getElementById('notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(div);
        setTimeout(() => div.remove(), 3000);
    }

    // Reset
    reset() {
        this.imageInput.value = '';
        this.csvInput.value = '';
        this.updateImageCount(0);
        this.targetCount.value = '20';
        this.initialLives.value = '3';
        this.hideResumeOption();
        this.progressFill.style.width = '0%';
        this.resultsGrid.innerHTML = '';
    }
}
