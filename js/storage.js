/**
 * StorageManager - Handles localStorage and CSV import/export
 */
class StorageManager {
    constructor() {
        this.sessionKey = 'imageRanker_session';
    }

    // Session management
    saveSession(data) {
        try {
            // Don't store blob data in localStorage
            const cleanData = {
                ...data,
                images: data.images.map(img => ({
                    filename: img.filename,
                    rating: img.rating,
                    lives: img.lives,
                    eliminated: img.eliminated
                }))
            };
            localStorage.setItem(this.sessionKey, JSON.stringify(cleanData));
            return true;
        } catch (e) {
            console.error('Failed to save session:', e);
            return false;
        }
    }

    loadSession() {
        try {
            const data = localStorage.getItem(this.sessionKey);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('Failed to load session:', e);
            return null;
        }
    }

    clearSession() {
        localStorage.removeItem(this.sessionKey);
    }

    hasSession() {
        return localStorage.getItem(this.sessionKey) !== null;
    }

    // CSV Export
    exportComparisons(comparisons) {
        const headers = ['image_a', 'image_b', 'comparison', 'timestamp', 'phase', 'round'];
        const rows = comparisons.map(c => [
            this.escapeCSV(c.imageA),
            this.escapeCSV(c.imageB),
            c.result,
            c.timestamp,
            c.phase,
            c.round
        ].join(','));

        const csv = [headers.join(','), ...rows].join('\n');
        this.downloadFile(csv, `tournament_${this.getDateString()}.csv`, 'text/csv');
    }

    exportResults(rankedImages) {
        const headers = ['rank', 'filename', 'rating'];
        const rows = rankedImages.map((img, i) => [
            i + 1,
            this.escapeCSV(img.filename),
            Math.round(img.rating)
        ].join(','));

        const csv = [headers.join(','), ...rows].join('\n');
        this.downloadFile(csv, `results_${this.getDateString()}.csv`, 'text/csv');
    }

    // CSV Import
    async importCSV(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const lines = e.target.result.split('\n');
                    // Skip header line (index 0)
                    const comparisons = [];
                    for (let i = 1; i < lines.length; i++) {
                        const line = lines[i].trim();
                        if (!line) continue;

                        const values = this.parseCSVLine(line);
                        if (values.length >= 6) {
                            comparisons.push({
                                imageA: values[0],
                                imageB: values[1],
                                result: values[2],
                                timestamp: values[3],
                                phase: values[4],
                                round: parseInt(values[5]) || 1
                            });
                        }
                    }
                    resolve(comparisons);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
        });
    }

    // Helpers
    parseCSVLine(line) {
        const values = [];
        let current = '';
        let inQuotes = false;

        for (const char of line) {
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        values.push(current.trim());
        return values;
    }

    escapeCSV(str) {
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    }

    downloadFile(content, filename, type) {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    getDateString() {
        return new Date().toISOString().split('T')[0];
    }

    copyToClipboard(text) {
        navigator.clipboard.writeText(text).catch(e => {
            console.error('Failed to copy:', e);
        });
    }
}
