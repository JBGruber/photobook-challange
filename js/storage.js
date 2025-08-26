class StorageManager {
    constructor() {
        this.sessionKey = 'imageRanker_session';
        this.settingsKey = 'imageRanker_settings';
    }

    saveSession(sessionData) {
        try {
            localStorage.setItem(this.sessionKey, JSON.stringify(sessionData));
            return true;
        } catch (error) {
            console.error('Error saving session:', error);
            return false;
        }
    }

    loadSession() {
        try {
            const sessionStr = localStorage.getItem(this.sessionKey);
            return sessionStr ? JSON.parse(sessionStr) : null;
        } catch (error) {
            console.error('Error loading session:', error);
            return null;
        }
    }

    clearSession() {
        localStorage.removeItem(this.sessionKey);
    }

    saveSettings(settings) {
        try {
            localStorage.setItem(this.settingsKey, JSON.stringify(settings));
            return true;
        } catch (error) {
            console.error('Error saving settings:', error);
            return false;
        }
    }

    loadSettings() {
        try {
            const settingsStr = localStorage.getItem(this.settingsKey);
            return settingsStr ? JSON.parse(settingsStr) : {
                target_final_count: 20,
                initial_lives: 3,
                rating_change_slight: 16,
                rating_change_ko: 50,
                elimination_threshold: 900
            };
        } catch (error) {
            console.error('Error loading settings:', error);
            return {
                target_final_count: 20,
                initial_lives: 3,
                rating_change_slight: 16,
                rating_change_ko: 50,
                elimination_threshold: 900
            };
        }
    }

    exportToCSV(comparisons, filename = 'tournament_data.csv') {
        const headers = ['image_a', 'image_b', 'comparison', 'timestamp', 'phase', 'round'];
        const csvContent = [
            headers.join(','),
            ...comparisons.map(comp => [
                `"${comp.imageA}"`,
                `"${comp.imageB}"`,
                comp.result,
                comp.timestamp,
                comp.phase,
                comp.round
            ].join(','))
        ].join('\n');

        this.downloadCSV(csvContent, filename);
    }

    exportResults(results, filename = 'tournament_results.csv') {
        const headers = ['rank', 'filename', 'rating', 'final_score'];
        const csvContent = [
            headers.join(','),
            ...results.map((result, index) => [
                index + 1,
                `"${result.filename}"`,
                result.rating || 0,
                result.finalScore || result.rating || 0
            ].join(','))
        ].join('\n');

        this.downloadCSV(csvContent, filename);
    }

    downloadCSV(csvContent, filename) {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }
    }

    importFromCSV(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (event) => {
                try {
                    const csv = event.target.result;
                    const lines = csv.split('\n');
                    const headers = lines[0].split(',').map(h => h.replace(/"/g, ''));
                    
                    const comparisons = [];
                    for (let i = 1; i < lines.length; i++) {
                        const line = lines[i].trim();
                        if (!line) continue;
                        
                        const values = this.parseCSVLine(line);
                        if (values.length >= 6) {
                            comparisons.push({
                                imageA: values[0].replace(/"/g, ''),
                                imageB: values[1].replace(/"/g, ''),
                                result: values[2],
                                timestamp: values[3],
                                phase: values[4],
                                round: parseInt(values[5]) || 1
                            });
                        }
                    }
                    
                    resolve(comparisons);
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
        });
    }

    parseCSVLine(line) {
        const values = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        
        values.push(current);
        return values;
    }

    createSessionData(images, tournamentState, comparisons = []) {
        return {
            images: images.map(img => ({
                filename: img.filename,
                path: img.path,
                rating: img.rating || 1000,
                eliminated: img.eliminated || false,
                lives: img.lives !== undefined ? img.lives : 3,
                blob: img.blob
            })),
            tournament_state: {
                phase: tournamentState.phase || 'knockout',
                round: tournamentState.round || 1,
                target_final_count: tournamentState.target_final_count || 20,
                completed_comparisons: comparisons.length,
                total_estimated_comparisons: tournamentState.total_estimated_comparisons || 0
            },
            comparisons: comparisons,
            timestamp: new Date().toISOString()
        };
    }

    validateSessionData(sessionData) {
        if (!sessionData) return false;
        
        const required = ['images', 'tournament_state'];
        for (const field of required) {
            if (!sessionData[field]) return false;
        }
        
        if (!Array.isArray(sessionData.images)) return false;
        if (!sessionData.tournament_state.phase) return false;
        
        return true;
    }

    migrateOldSessionData(sessionData) {
        if (!sessionData.tournament_state.target_final_count) {
            sessionData.tournament_state.target_final_count = 20;
        }
        
        if (!sessionData.comparisons) {
            sessionData.comparisons = [];
        }
        
        sessionData.images.forEach(img => {
            if (img.rating === undefined) img.rating = 1000;
            if (img.eliminated === undefined) img.eliminated = false;
            if (img.lives === undefined) img.lives = 3;
        });
        
        return sessionData;
    }

    compressImages(images) {
        return images.map(img => ({
            ...img,
            blob: null
        }));
    }

    async restoreImageBlobs(compressedImages, fileList) {
        const fileMap = new Map();
        Array.from(fileList).forEach(file => {
            fileMap.set(file.name, file);
        });

        return compressedImages.map(img => ({
            ...img,
            blob: fileMap.get(img.filename) || null
        }));
    }

    getStorageUsage() {
        try {
            let total = 0;
            for (let key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    total += localStorage[key].length;
                }
            }
            return {
                used: total,
                usedMB: (total / (1024 * 1024)).toFixed(2)
            };
        } catch (error) {
            return { used: 0, usedMB: '0.00' };
        }
    }

    clearAllData() {
        localStorage.removeItem(this.sessionKey);
        localStorage.removeItem(this.settingsKey);
    }
}