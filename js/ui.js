class UIManager {
    constructor() {
        this.currentScreen = 'setup';
        this.zoomModal = null;
        this.keyboardEnabled = true;
        
        this.initializeElements();
        this.attachEventListeners();
        this.setupKeyboardShortcuts();
    }

    initializeElements() {
        this.screens = {
            setup: document.getElementById('setup-screen'),
            tournament: document.getElementById('tournament-screen'),
            results: document.getElementById('results-screen')
        };

        this.setupElements = {
            imageInput: document.getElementById('image-input'),
            csvInput: document.getElementById('csv-input'),
            imageCount: document.getElementById('image-count'),
            targetCount: document.getElementById('target-count'),
            initialLives: document.getElementById('initial-lives'),
            startButton: document.getElementById('start-tournament')
        };

        this.tournamentElements = {
            progressFill: document.getElementById('progress-fill'),
            progressLabel: document.getElementById('progress-label'),
            progressStats: document.getElementById('progress-stats'),
            imageA: document.getElementById('image-a'),
            imageB: document.getElementById('image-b'),
            remainingImages: document.getElementById('remaining-images'),
            eliminatedImages: document.getElementById('eliminated-images'),
            currentRound: document.getElementById('current-round'),
            pauseButton: document.getElementById('pause-tournament'),
            exportButton: document.getElementById('export-csv')
        };

        this.comparisonButtons = {
            aSlight: document.getElementById('a-slight'),
            aKnockout: document.getElementById('a-knockout'),
            bKnockout: document.getElementById('b-knockout'),
            bSlight: document.getElementById('b-slight')
        };

        this.resultsElements = {
            finalCount: document.getElementById('final-count'),
            totalProcessed: document.getElementById('total-processed'),
            resultsGrid: document.getElementById('results-grid'),
            exportResults: document.getElementById('export-results'),
            newTournament: document.getElementById('new-tournament')
        };

        this.zoomModal = document.getElementById('zoom-modal');
        this.zoomedImage = document.getElementById('zoomed-image');
    }

    attachEventListeners() {
        this.setupElements.imageInput.addEventListener('change', (e) => this.handleImageSelection(e));
        this.setupElements.csvInput.addEventListener('change', (e) => this.handleCSVImport(e));
        this.setupElements.startButton.addEventListener('click', () => this.startTournament());

        Object.values(this.comparisonButtons).forEach((button, index) => {
            const results = ['A_wins', 'A_ko', 'B_ko', 'B_wins'];
            button.addEventListener('click', () => this.handleComparison(results[index]));
        });

        this.tournamentElements.pauseButton.addEventListener('click', () => this.pauseTournament());
        this.tournamentElements.exportButton.addEventListener('click', () => this.exportCSV());

        this.resultsElements.exportResults.addEventListener('click', () => this.exportResults());
        this.resultsElements.newTournament.addEventListener('click', () => this.newTournament());

        this.tournamentElements.imageA.addEventListener('click', () => this.showZoomedImage(this.tournamentElements.imageA.src));
        this.tournamentElements.imageB.addEventListener('click', () => this.showZoomedImage(this.tournamentElements.imageB.src));

        this.zoomModal.addEventListener('click', (e) => {
            if (e.target === this.zoomModal) {
                this.closeZoomModal();
            }
        });

        document.querySelector('.close').addEventListener('click', () => this.closeZoomModal());

        window.addEventListener('beforeunload', (e) => {
            if (this.currentScreen === 'tournament' && this.onBeforeUnload) {
                this.onBeforeUnload();
                e.preventDefault();
                e.returnValue = '';
            }
        });
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (!this.keyboardEnabled || this.currentScreen !== 'tournament') return;

            const keyMap = {
                '1': 'A_wins',
                '2': 'A_ko',
                '3': 'B_ko',
                '4': 'B_wins',
                'Escape': 'close_zoom'
            };

            if (keyMap[e.key]) {
                e.preventDefault();
                
                if (e.key === 'Escape') {
                    this.closeZoomModal();
                } else {
                    this.handleComparison(keyMap[e.key]);
                }
            }
        });
    }

    showScreen(screenName) {
        Object.values(this.screens).forEach(screen => screen.classList.remove('active'));
        if (this.screens[screenName]) {
            this.screens[screenName].classList.add('active');
            this.currentScreen = screenName;
        }
    }

    handleImageSelection(event) {
        const files = Array.from(event.target.files);
        const imageFiles = files.filter(file => file.type.startsWith('image/'));
        
        this.updateImageCount(imageFiles.length);
        this.setupElements.startButton.disabled = imageFiles.length === 0;
        
        if (this.onImagesSelected) {
            this.onImagesSelected(imageFiles);
        }
    }

    updateImageCount(count) {
        if (count === 0) {
            this.setupElements.imageCount.textContent = 'No images selected';
        } else {
            this.setupElements.imageCount.textContent = `${count} images selected`;
        }
    }

    handleCSVImport(event) {
        const file = event.target.files[0];
        if (file && this.onCSVImport) {
            this.onCSVImport(file);
        }
    }

    startTournament() {
        const settings = {
            target_final_count: parseInt(this.setupElements.targetCount.value),
            initial_lives: parseInt(this.setupElements.initialLives.value)
        };
        
        if (this.onStartTournament) {
            this.onStartTournament(settings);
        }
    }

    showTournamentScreen() {
        this.showScreen('tournament');
    }

    updateProgress(progress) {
        this.tournamentElements.progressFill.style.width = `${progress.progress_percentage}%`;
        
        const phaseLabel = progress.phase === 'knockout' ? 'Knockout Tournament' : 'Final Ranking';
        this.tournamentElements.progressLabel.textContent = `Phase ${progress.phase === 'knockout' ? '1' : '2'}: ${phaseLabel}`;
        
        this.tournamentElements.progressStats.textContent = 
            `${progress.completed_comparisons} / ${progress.total_estimated_comparisons} comparisons`;
        
        this.tournamentElements.remainingImages.textContent = progress.remaining_images;
        this.tournamentElements.eliminatedImages.textContent = progress.eliminated_images;
        this.tournamentElements.currentRound.textContent = progress.round;
    }

    displayComparison(imageA, imageB) {
        this.displayImage(this.tournamentElements.imageA, imageA);
        this.displayImage(this.tournamentElements.imageB, imageB);
        
        this.enableComparisonButtons();
    }

    displayImage(imgElement, imageData) {
        if (imageData.blob) {
            const url = URL.createObjectURL(imageData.blob);
            imgElement.src = url;
            imgElement.alt = imageData.filename;
            
            imgElement.onload = () => {
                if (imgElement.previousObjectURL) {
                    URL.revokeObjectURL(imgElement.previousObjectURL);
                }
                imgElement.previousObjectURL = url;
            };
        } else {
            imgElement.src = imageData.path || '';
            imgElement.alt = imageData.filename;
        }
    }

    handleComparison(result) {
        if (this.onComparison) {
            this.disableComparisonButtons();
            this.onComparison(result);
        }
    }

    enableComparisonButtons() {
        Object.values(this.comparisonButtons).forEach(button => {
            button.disabled = false;
        });
        this.keyboardEnabled = true;
    }

    disableComparisonButtons() {
        Object.values(this.comparisonButtons).forEach(button => {
            button.disabled = true;
        });
        this.keyboardEnabled = false;
    }

    showZoomedImage(src) {
        this.zoomedImage.src = src;
        this.zoomModal.classList.add('active');
    }

    closeZoomModal() {
        this.zoomModal.classList.remove('active');
    }

    pauseTournament() {
        if (this.onPause) {
            this.onPause();
        }
        this.showScreen('setup');
    }

    exportCSV() {
        if (this.onExportCSV) {
            this.onExportCSV();
        }
    }

    showResults(results, totalImages) {
        this.showScreen('results');
        
        this.resultsElements.finalCount.textContent = results.length;
        this.resultsElements.totalProcessed.textContent = totalImages;
        
        this.displayResults(results);
    }

    displayResults(results) {
        const grid = this.resultsElements.resultsGrid;
        grid.innerHTML = '';
        
        results.forEach((image, index) => {
            const resultItem = document.createElement('div');
            resultItem.className = 'result-item';
            
            const img = document.createElement('img');
            img.className = 'result-image';
            this.displayImage(img, image);
            
            const info = document.createElement('div');
            info.className = 'result-info';
            
            const rank = document.createElement('div');
            rank.className = 'result-rank';
            rank.textContent = `#${index + 1}`;
            
            const filename = document.createElement('div');
            filename.className = 'result-filename';
            filename.textContent = image.filename;
            
            const rating = document.createElement('div');
            rating.className = 'result-rating';
            rating.textContent = `Rating: ${Math.round(image.rating)}`;
            
            info.appendChild(rank);
            info.appendChild(filename);
            info.appendChild(rating);
            
            resultItem.appendChild(img);
            resultItem.appendChild(info);
            
            grid.appendChild(resultItem);
        });
    }

    exportResults() {
        if (this.onExportResults) {
            this.onExportResults();
        }
    }

    newTournament() {
        if (this.onNewTournament) {
            this.onNewTournament();
        }
        this.showScreen('setup');
        this.resetUI();
    }

    resetUI() {
        this.setupElements.imageInput.value = '';
        this.setupElements.csvInput.value = '';
        this.updateImageCount(0);
        this.setupElements.startButton.disabled = true;
        this.setupElements.targetCount.value = '20';
        this.setupElements.initialLives.value = '3';
        
        this.tournamentElements.progressFill.style.width = '0%';
        this.tournamentElements.imageA.src = '';
        this.tournamentElements.imageB.src = '';
        
        this.resultsElements.resultsGrid.innerHTML = '';
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #e74c3c;
            color: white;
            padding: 1rem;
            border-radius: 8px;
            z-index: 1000;
            max-width: 300px;
        `;
        errorDiv.textContent = message;
        
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 5000);
    }

    showSuccess(message) {
        const successDiv = document.createElement('div');
        successDiv.className = 'success-message';
        successDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #27ae60;
            color: white;
            padding: 1rem;
            border-radius: 8px;
            z-index: 1000;
            max-width: 300px;
        `;
        successDiv.textContent = message;
        
        document.body.appendChild(successDiv);
        
        setTimeout(() => {
            if (successDiv.parentNode) {
                successDiv.parentNode.removeChild(successDiv);
            }
        }, 3000);
    }

    showLoading(message = 'Loading...') {
        const loadingDiv = document.createElement('div');
        loadingDiv.id = 'loading-overlay';
        loadingDiv.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 2000;
            color: white;
            font-size: 1.2rem;
        `;
        
        const content = document.createElement('div');
        content.style.textAlign = 'center';
        content.innerHTML = `
            <div class="spinner"></div>
            <div style="margin-top: 1rem;">${message}</div>
        `;
        
        loadingDiv.appendChild(content);
        document.body.appendChild(loadingDiv);
    }

    hideLoading() {
        const loadingDiv = document.getElementById('loading-overlay');
        if (loadingDiv) {
            loadingDiv.remove();
        }
    }

    setComparisonHandler(handler) {
        this.onComparison = handler;
    }

    setImagesSelectedHandler(handler) {
        this.onImagesSelected = handler;
    }

    setStartTournamentHandler(handler) {
        this.onStartTournament = handler;
    }

    setCSVImportHandler(handler) {
        this.onCSVImport = handler;
    }

    setPauseHandler(handler) {
        this.onPause = handler;
    }

    setExportCSVHandler(handler) {
        this.onExportCSV = handler;
    }

    setExportResultsHandler(handler) {
        this.onExportResults = handler;
    }

    setNewTournamentHandler(handler) {
        this.onNewTournament = handler;
    }

    setBeforeUnloadHandler(handler) {
        this.onBeforeUnload = handler;
    }
}