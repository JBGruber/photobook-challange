/**
 * ImageRankerApp - Main application orchestrator
 */
class ImageRankerApp {
    constructor() {
        this.storage = new StorageManager();
        this.ui = new UIManager();
        this.tournament = null;
        this.imageFiles = [];

        this.bindHandlers();
        this.checkSavedSession();
    }

    bindHandlers() {
        // Setup handlers
        this.ui.onImagesSelected = (files) => this.handleImageSelection(files);
        this.ui.onCSVImport = (file) => this.handleCSVImport(file);
        this.ui.onStartTournament = (settings) => this.startTournament(settings);
        this.ui.onResume = () => this.resumeTournament();
        this.ui.onClearSession = () => this.clearSession();

        // Tournament handlers
        this.ui.onComparison = (result) => this.processComparison(result);
        this.ui.onPause = () => this.pauseTournament();
        this.ui.onExport = () => this.exportProgress();

        // Results handlers
        this.ui.onExportResults = () => this.exportResults();
        this.ui.onCopyFilenames = () => this.copyFilenames();
        this.ui.onNewTournament = () => this.newTournament();
    }

    checkSavedSession() {
        const session = this.storage.loadSession();
        if (session && session.images && session.comparisons) {
            const count = session.images.length;
            const comparisons = session.comparisons.length;
            this.ui.showResumeOption(
                `${count} images, ${comparisons} comparisons (${session.phase})`
            );
        }
    }

    handleImageSelection(files) {
        const imageFiles = Array.from(files).filter(f =>
            f.type.startsWith('image/')
        );

        this.imageFiles = imageFiles;
        this.ui.updateImageCount(imageFiles.length);

        if (imageFiles.length > 0) {
            this.ui.showNotification(`${imageFiles.length} images loaded`, 'success');
        }
    }

    async handleCSVImport(file) {
        try {
            const comparisons = await this.storage.importCSV(file);
            this.ui.showNotification(
                `Imported ${comparisons.length} comparisons`,
                'success'
            );
        } catch (e) {
            this.ui.showNotification('Failed to import CSV', 'error');
        }
    }

    startTournament(settings) {
        if (this.imageFiles.length < 2) {
            this.ui.showNotification('Select at least 2 images', 'error');
            return;
        }

        // Create image data objects
        const images = this.imageFiles.map(file => ({
            filename: file.name,
            blob: file
        }));

        this.tournament = new Tournament(images, settings);
        this.ui.showScreen('tournament');
        this.nextComparison();
    }

    resumeTournament() {
        const session = this.storage.loadSession();
        if (!session) {
            this.ui.showNotification('No session to resume', 'error');
            return;
        }

        if (this.imageFiles.length === 0) {
            this.ui.showNotification('Please select the same image folder first', 'error');
            return;
        }

        // Match saved session images with loaded files
        const fileMap = new Map();
        this.imageFiles.forEach(f => fileMap.set(f.name, f));

        const missingFiles = session.images.filter(img => !fileMap.has(img.filename));
        if (missingFiles.length > 0) {
            this.ui.showNotification(
                `Missing ${missingFiles.length} images from session`,
                'error'
            );
            return;
        }

        // Restore tournament from session
        this.tournament = Tournament.fromSession(session, this.imageFiles);
        this.ui.showScreen('tournament');
        this.nextComparison();
    }

    clearSession() {
        this.storage.clearSession();
        this.ui.hideResumeOption();
        this.ui.showNotification('Session cleared', 'info');
    }

    nextComparison() {
        if (!this.tournament) return;

        // Check completion
        if (this.tournament.isComplete()) {
            this.showResults();
            return;
        }

        // Get next pair
        const pair = this.tournament.getNextPair();
        if (!pair) {
            this.showResults();
            return;
        }

        // Update UI
        this.ui.showComparison(pair[0], pair[1]);
        this.ui.updateProgress(this.tournament.getProgress());
    }

    processComparison(result) {
        if (!this.tournament || !this.tournament.currentPair) return;

        this.ui.disableButtons();

        try {
            this.tournament.processComparison(result);

            // Save after each comparison
            this.storage.saveSession(this.tournament.getSessionData());

            // Small delay for visual feedback
            setTimeout(() => this.nextComparison(), 200);

        } catch (e) {
            console.error('Error processing comparison:', e);
            this.ui.showNotification('Error processing comparison', 'error');
            this.ui.enableButtons();
        }
    }

    pauseTournament() {
        if (this.tournament) {
            this.storage.saveSession(this.tournament.getSessionData());
        }
        this.ui.showScreen('setup');
        this.ui.showNotification('Progress saved', 'success');
    }

    exportProgress() {
        if (!this.tournament) return;
        this.storage.exportComparisons(this.tournament.comparisons);
        this.ui.showNotification('CSV exported', 'success');
    }

    showResults() {
        if (!this.tournament) return;

        const rankings = this.tournament.getFinalRankings();
        const totalComparisons = this.tournament.comparisons.length;

        this.ui.showScreen('results');
        this.ui.showResults(rankings, totalComparisons);

        // Clear saved session since we're done
        this.storage.clearSession();
    }

    exportResults() {
        if (!this.tournament) return;
        const rankings = this.tournament.getFinalRankings();
        this.storage.exportResults(rankings);
        this.ui.showNotification('Results exported', 'success');
    }

    copyFilenames() {
        if (!this.tournament) return;
        const rankings = this.tournament.getFinalRankings();
        const filenames = rankings.map((img, i) => `${i + 1}. ${img.filename}`).join('\n');
        this.storage.copyToClipboard(filenames);
        this.ui.showNotification('Filenames copied to clipboard', 'success');
    }

    newTournament() {
        this.tournament = null;
        this.imageFiles = [];
        this.storage.clearSession();
        this.ui.reset();
        this.ui.showScreen('setup');
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ImageRankerApp();
});
