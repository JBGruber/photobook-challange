class PhotobookChallengeApp {
    constructor() {
        this.tournament = null;
        this.images = [];
        this.currentImages = [];
        this.storage = new StorageManager();
        this.ui = new UIManager();
        this.autosaveInterval = null;
        
        this.initializeApp();
    }

    initializeApp() {
        this.setupEventHandlers();
        this.loadPreviousSession();
    }

    setupEventHandlers() {
        this.ui.setImagesSelectedHandler((files) => this.handleImageSelection(files));
        this.ui.setStartTournamentHandler((settings) => this.startTournament(settings));
        this.ui.setCSVImportHandler((file) => this.importCSV(file));
        this.ui.setComparisonHandler((result) => this.processComparison(result));
        this.ui.setPauseHandler(() => this.pauseTournament());
        this.ui.setExportCSVHandler(() => this.exportCSV());
        this.ui.setExportResultsHandler(() => this.exportResults());
        this.ui.setNewTournamentHandler(() => this.newTournament());
        this.ui.setBeforeUnloadHandler(() => this.saveSession());
    }

    loadPreviousSession() {
        const sessionData = this.storage.loadSession();
        if (sessionData && this.storage.validateSessionData(sessionData)) {
            try {
                this.tournament = Tournament.fromSessionData(sessionData);
                this.images = sessionData.images;
                this.currentImages = this.images.filter(img => img.blob);
                
                if (this.currentImages.length > 0) {
                    this.resumeTournament();
                }
            } catch (error) {
                console.error('Error loading session:', error);
                this.storage.clearSession();
            }
        }
    }

    async handleImageSelection(files) {
        try {
            this.ui.showLoading('Processing images...');
            
            this.images = await this.processImageFiles(files);
            this.currentImages = [...this.images];
            
            this.ui.hideLoading();
            
            if (this.images.length === 0) {
                this.ui.showError('No valid image files found');
                return;
            }
            
            this.ui.showSuccess(`Loaded ${this.images.length} images`);
            
        } catch (error) {
            this.ui.hideLoading();
            this.ui.showError('Error processing images: ' + error.message);
        }
    }

    async processImageFiles(files) {
        const images = [];
        const maxSize = 50 * 1024 * 1024;
        
        for (const file of files) {
            if (!file.type.startsWith('image/')) continue;
            
            try {
                const processedImage = await this.processImageFile(file, maxSize);
                if (processedImage) {
                    images.push(processedImage);
                }
            } catch (error) {
                console.warn(`Error processing ${file.name}:`, error);
            }
        }
        
        return images;
    }

    processImageFile(file, maxSize) {
        return new Promise((resolve, reject) => {
            if (file.size > maxSize) {
                console.warn(`Skipping ${file.name}: file too large (${(file.size / (1024 * 1024)).toFixed(1)}MB > ${maxSize / (1024 * 1024)}MB)`);
                resolve(null);
                return;
            }
            
            const image = {
                filename: file.name,
                path: file.webkitRelativePath || file.name,
                blob: file,
                rating: 1000,
                eliminated: false,
                lives: 3,
                comparisons: 0
            };
            
            resolve(image);
        });
    }

    startTournament(settings) {
        if (this.currentImages.length < 2) {
            this.ui.showError('Need at least 2 images to start tournament');
            return;
        }
        
        try {
            this.tournament = new Tournament(this.currentImages, settings);
            this.ui.showTournamentScreen();
            this.startAutosave();
            this.nextComparison();
            
        } catch (error) {
            this.ui.showError('Error starting tournament: ' + error.message);
        }
    }

    resumeTournament() {
        if (!this.tournament) return;
        
        this.ui.showTournamentScreen();
        this.startAutosave();
        this.updateProgress();
        this.nextComparison();
    }

    nextComparison() {
        if (!this.tournament) return;
        
        if (this.tournament.isComplete()) {
            this.completeTournament();
            return;
        }
        
        const pair = this.tournament.getNextPair();
        if (!pair) {
            this.completeTournament();
            return;
        }
        
        this.ui.displayComparison(pair[0], pair[1]);
        this.updateProgress();
    }

    processComparison(result) {
        if (!this.tournament) return;
        
        try {
            this.tournament.processComparison(result);
            this.saveSession();
            
            setTimeout(() => {
                this.nextComparison();
            }, 300);
            
        } catch (error) {
            this.ui.showError('Error processing comparison: ' + error.message);
            this.ui.enableComparisonButtons();
        }
    }

    updateProgress() {
        if (!this.tournament) return;
        
        const progress = this.tournament.getProgress();
        this.ui.updateProgress(progress);
    }

    completeTournament() {
        if (!this.tournament) return;
        
        this.stopAutosave();
        const results = this.tournament.getFinalRankings();
        this.ui.showResults(results, this.images.length);
        
        this.storage.clearSession();
    }

    pauseTournament() {
        this.stopAutosave();
        this.saveSession();
    }

    async importCSV(file) {
        try {
            this.ui.showLoading('Importing CSV data...');
            
            const comparisons = await this.storage.importFromCSV(file);
            
            if (comparisons.length === 0) {
                this.ui.hideLoading();
                this.ui.showError('No valid comparison data found in CSV');
                return;
            }
            
            const imageFilenames = new Set();
            comparisons.forEach(comp => {
                imageFilenames.add(comp.imageA);
                imageFilenames.add(comp.imageB);
            });
            
            if (this.currentImages.length === 0) {
                this.ui.hideLoading();
                this.ui.showError('Please choose local images first before importing CSV');
                return;
            }
            
            const availableImages = new Set(this.currentImages.map(img => img.filename));
            const missingImages = [...imageFilenames].filter(name => !availableImages.has(name));
            
            if (missingImages.length > 0) {
                this.ui.hideLoading();
                this.ui.showError(`Missing images: ${missingImages.slice(0, 3).join(', ')}${missingImages.length > 3 ? '...' : ''}`);
                return;
            }
            
            this.reconstructTournamentFromCSV(comparisons);
            
            this.ui.hideLoading();
            this.ui.showSuccess(`Imported ${comparisons.length} comparisons`);
            
        } catch (error) {
            this.ui.hideLoading();
            this.ui.showError('Error importing CSV: ' + error.message);
        }
    }

    reconstructTournamentFromCSV(comparisons) {
        const settings = this.storage.loadSettings();
        
        const imageMap = new Map();
        this.currentImages.forEach(img => {
            imageMap.set(img.filename, {
                ...img,
                rating: 1000,
                eliminated: false,
                lives: settings.initial_lives,
                comparisons: 0
            });
        });
        
        let currentPhase = 'knockout';
        let currentRound = 1;
        
        comparisons.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        comparisons.forEach(comp => {
            const imageA = imageMap.get(comp.imageA);
            const imageB = imageMap.get(comp.imageB);
            
            if (!imageA || !imageB) return;
            
            if (comp.phase) currentPhase = comp.phase;
            if (comp.round) currentRound = Math.max(currentRound, comp.round);
            
            imageA.comparisons++;
            imageB.comparisons++;
            
            this.applyComparisonResult(imageA, imageB, comp.result, settings);
        });
        
        const images = Array.from(imageMap.values());
        this.tournament = new Tournament(images, settings);
        this.tournament.phase = currentPhase;
        this.tournament.round = currentRound;
        this.tournament.comparisons = comparisons;
        
        this.saveSession();
    }

    applyComparisonResult(imageA, imageB, result, settings) {
        const kFactor = 1.0;
        
        switch (result) {
            case 'A_wins':
                this.updateEloRatings(imageA, imageB, 1, settings.rating_change_slight * kFactor);
                break;
            case 'A_ko':
                imageA.rating += settings.rating_change_ko * kFactor;
                imageB.eliminated = true;
                break;
            case 'B_wins':
                this.updateEloRatings(imageB, imageA, 1, settings.rating_change_slight * kFactor);
                break;
            case 'B_ko':
                imageB.rating += settings.rating_change_ko * kFactor;
                imageA.eliminated = true;
                break;
        }
        
        if (!imageA.eliminated && imageA.rating < settings.elimination_threshold && imageA.lives > 0) {
            imageA.lives--;
        }
        if (!imageB.eliminated && imageB.rating < settings.elimination_threshold && imageB.lives > 0) {
            imageB.lives--;
        }
        
        if (!imageA.eliminated && imageA.rating < settings.elimination_threshold && imageA.lives <= 0) {
            imageA.eliminated = true;
        }
        if (!imageB.eliminated && imageB.rating < settings.elimination_threshold && imageB.lives <= 0) {
            imageB.eliminated = true;
        }
    }

    updateEloRatings(winner, loser, result, kFactor) {
        const expectedA = 1 / (1 + Math.pow(10, (loser.rating - winner.rating) / 400));
        const expectedB = 1 - expectedA;
        
        winner.rating += kFactor * (result - expectedA);
        loser.rating += kFactor * ((1 - result) - expectedB);
    }

    exportCSV() {
        if (!this.tournament) {
            this.ui.showError('No tournament data to export');
            return;
        }
        
        try {
            const timestamp = new Date().toISOString().split('T')[0];
            const filename = `tournament_${timestamp}.csv`;
            
            this.storage.exportToCSV(this.tournament.comparisons, filename);
            this.ui.showSuccess('CSV exported successfully');
            
        } catch (error) {
            this.ui.showError('Error exporting CSV: ' + error.message);
        }
    }

    exportResults() {
        if (!this.tournament) {
            this.ui.showError('No tournament results to export');
            return;
        }
        
        try {
            const results = this.tournament.getFinalRankings();
            const timestamp = new Date().toISOString().split('T')[0];
            const filename = `results_${timestamp}.csv`;
            
            this.storage.exportResults(results, filename);
            this.ui.showSuccess('Results exported successfully');
            
        } catch (error) {
            this.ui.showError('Error exporting results: ' + error.message);
        }
    }

    newTournament() {
        this.stopAutosave();
        this.tournament = null;
        this.images = [];
        this.currentImages = [];
        this.storage.clearSession();
    }

    saveSession() {
        if (!this.tournament) return;
        
        try {
            const sessionData = this.storage.createSessionData(
                this.images,
                {
                    phase: this.tournament.phase,
                    round: this.tournament.round,
                    target_final_count: this.tournament.settings.target_final_count,
                    total_estimated_comparisons: this.tournament.getProgress().total_estimated_comparisons
                },
                this.tournament.comparisons
            );
            
            this.storage.saveSession(sessionData);
            
        } catch (error) {
            console.error('Error saving session:', error);
        }
    }

    startAutosave() {
        this.stopAutosave();
        this.autosaveInterval = setInterval(() => {
            this.saveSession();
        }, 30000);
    }

    stopAutosave() {
        if (this.autosaveInterval) {
            clearInterval(this.autosaveInterval);
            this.autosaveInterval = null;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.photobookChallengeApp = new PhotobookChallengeApp();
});