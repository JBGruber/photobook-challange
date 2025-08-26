class Tournament {
    constructor(images, settings) {
        this.images = images.map(img => ({
            ...img,
            rating: img.rating || 1000,
            eliminated: img.eliminated || false,
            lives: img.lives !== undefined ? img.lives : settings.initial_lives,
            comparisons: img.comparisons || 0
        }));
        
        this.settings = {
            target_final_count: settings.target_final_count || 20,
            initial_lives: settings.initial_lives || 3,
            rating_change_slight: settings.rating_change_slight || 16,
            rating_change_ko: settings.rating_change_ko || 50,
            elimination_threshold: settings.elimination_threshold || 900
        };
        
        this.phase = 'knockout';
        this.round = 1;
        this.comparisons = [];
        this.currentPair = null;
        this.pairingHistory = new Map();
        
        this.maxRounds = Math.max(10, Math.ceil(Math.log2(this.images.length)));
    }

    static fromSessionData(sessionData) {
        const tournament = new Tournament(sessionData.images, {
            target_final_count: sessionData.tournament_state.target_final_count,
            initial_lives: sessionData.tournament_state.initial_lives || 3,
            rating_change_slight: 16,
            rating_change_ko: 50,
            elimination_threshold: 900
        });
        
        tournament.phase = sessionData.tournament_state.phase;
        tournament.round = sessionData.tournament_state.round;
        tournament.comparisons = sessionData.comparisons || [];
        
        tournament.pairingHistory = new Map();
        tournament.comparisons.forEach(comp => {
            const key = tournament.getPairingKey(comp.imageA, comp.imageB);
            tournament.pairingHistory.set(key, (tournament.pairingHistory.get(key) || 0) + 1);
        });
        
        return tournament;
    }

    getNextPair() {
        if (this.phase === 'knockout') {
            return this.getKnockoutPair();
        } else if (this.phase === 'ranking') {
            return this.getRankingPair();
        }
        return null;
    }

    getKnockoutPair() {
        const activeImages = this.getActiveImages();
        
        if (activeImages.length <= this.settings.target_final_count) {
            this.phase = 'ranking';
            this.round = 1;
            return this.getRankingPair();
        }
        
        if (activeImages.length < 2) {
            return null;
        }

        let bestPair = null;
        let bestScore = -1;
        const maxAttempts = Math.min(50, activeImages.length * (activeImages.length - 1) / 2);
        
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const imageA = this.getRandomWeightedImage(activeImages);
            const imageB = this.getRandomWeightedImage(activeImages.filter(img => img !== imageA));
            
            if (!imageB) continue;
            
            const pairKey = this.getPairingKey(imageA.filename, imageB.filename);
            const pairCount = this.pairingHistory.get(pairKey) || 0;
            const ratingDiff = Math.abs(imageA.rating - imageB.rating);
            
            const score = this.calculatePairScore(imageA, imageB, pairCount, ratingDiff);
            
            if (score > bestScore) {
                bestScore = score;
                bestPair = [imageA, imageB];
            }
            
            if (pairCount === 0 && ratingDiff < 100) {
                break;
            }
        }
        
        if (bestPair) {
            this.currentPair = bestPair;
            const pairKey = this.getPairingKey(bestPair[0].filename, bestPair[1].filename);
            this.pairingHistory.set(pairKey, (this.pairingHistory.get(pairKey) || 0) + 1);
        }
        
        return bestPair;
    }

    getRankingPair() {
        const topImages = this.getTopImages();
        
        if (topImages.length < 2) {
            return null;
        }

        if (!this.mergeSortPairs) {
            this.initializeMergeSort(topImages);
        }

        return this.getNextMergeSortPair();
    }

    initializeMergeSort(images) {
        this.sortedImages = [...images].sort((a, b) => b.rating - a.rating);
        this.mergeSortPairs = [];
        this.mergeSortIndex = 0;
        
        this.generateMergeSortPairs(this.sortedImages);
    }

    generateMergeSortPairs(images) {
        if (images.length < 2) return;
        
        for (let i = 0; i < images.length - 1; i++) {
            for (let j = i + 1; j < Math.min(i + 4, images.length); j++) {
                this.mergeSortPairs.push([images[i], images[j]]);
            }
        }
        
        this.mergeSortPairs.sort(() => Math.random() - 0.5);
    }

    getNextMergeSortPair() {
        if (this.mergeSortIndex >= this.mergeSortPairs.length) {
            return null;
        }
        
        const pair = this.mergeSortPairs[this.mergeSortIndex++];
        this.currentPair = pair;
        return pair;
    }

    calculatePairScore(imageA, imageB, pairCount, ratingDiff) {
        let score = 100;
        
        score -= pairCount * 30;
        
        if (ratingDiff < 50) score += 30;
        else if (ratingDiff < 100) score += 20;
        else if (ratingDiff < 200) score += 10;
        else score -= 10;
        
        const avgComparisons = (imageA.comparisons + imageB.comparisons) / 2;
        const targetComparisons = this.round * 2;
        if (avgComparisons < targetComparisons) {
            score += 15;
        }
        
        if (imageA.lives === 1 || imageB.lives === 1) {
            score += 20;
        }
        
        return score;
    }

    getRandomWeightedImage(images) {
        if (images.length === 0) return null;
        if (images.length === 1) return images[0];
        
        const weights = images.map(img => {
            let weight = 1;
            
            if (img.comparisons < this.round * 2) weight *= 2;
            if (img.lives === 1) weight *= 1.5;
            
            const ratingNormalized = (img.rating - 800) / 400;
            weight *= Math.max(0.5, ratingNormalized);
            
            return weight;
        });
        
        const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
        const random = Math.random() * totalWeight;
        
        let cumulativeWeight = 0;
        for (let i = 0; i < images.length; i++) {
            cumulativeWeight += weights[i];
            if (random <= cumulativeWeight) {
                return images[i];
            }
        }
        
        return images[images.length - 1];
    }

    processComparison(result) {
        if (!this.currentPair) {
            throw new Error('No current pair to process');
        }
        
        const [imageA, imageB] = this.currentPair;
        const timestamp = new Date().toISOString();
        
        const comparison = {
            imageA: imageA.filename,
            imageB: imageB.filename,
            result: result,
            timestamp: timestamp,
            phase: this.phase,
            round: this.round
        };
        
        this.comparisons.push(comparison);
        
        imageA.comparisons = (imageA.comparisons || 0) + 1;
        imageB.comparisons = (imageB.comparisons || 0) + 1;
        
        this.updateRatings(imageA, imageB, result);
        
        this.checkEliminations();
        
        if (this.phase === 'knockout' && this.shouldAdvanceRound()) {
            this.round++;
            
            if (this.round > this.maxRounds || this.getActiveImages().length <= this.settings.target_final_count) {
                this.phase = 'ranking';
                this.round = 1;
            }
        }
        
        this.currentPair = null;
        
        return comparison;
    }

    updateRatings(imageA, imageB, result) {
        const kFactor = this.phase === 'knockout' ? 1.0 : 0.5;
        
        switch (result) {
            case 'A_wins':
                this.updateEloRatings(imageA, imageB, 1, this.settings.rating_change_slight * kFactor);
                break;
            case 'A_ko':
                imageA.rating += this.settings.rating_change_ko * kFactor;
                imageB.eliminated = true;
                break;
            case 'B_wins':
                this.updateEloRatings(imageB, imageA, 1, this.settings.rating_change_slight * kFactor);
                break;
            case 'B_ko':
                imageB.rating += this.settings.rating_change_ko * kFactor;
                imageA.eliminated = true;
                break;
        }
        
        imageA.rating = Math.max(0, imageA.rating);
        imageB.rating = Math.max(0, imageB.rating);
    }

    updateEloRatings(winner, loser, result, kFactor) {
        const expectedA = 1 / (1 + Math.pow(10, (loser.rating - winner.rating) / 400));
        const expectedB = 1 - expectedA;
        
        winner.rating += kFactor * (result - expectedA);
        loser.rating += kFactor * ((1 - result) - expectedB);
    }

    checkEliminations() {
        this.images.forEach(img => {
            if (!img.eliminated && img.rating < this.settings.elimination_threshold && img.lives <= 0) {
                img.eliminated = true;
            }
            
            if (img.rating < this.settings.elimination_threshold && img.lives > 0) {
                img.lives--;
            }
        });
    }

    shouldAdvanceRound() {
        const activeImages = this.getActiveImages();
        const roundComparisons = this.comparisons.filter(c => c.round === this.round && c.phase === 'knockout').length;
        const targetComparisons = Math.max(activeImages.length / 4, 10);
        
        return roundComparisons >= targetComparisons || activeImages.length <= this.settings.target_final_count * 1.5;
    }

    getActiveImages() {
        return this.images.filter(img => !img.eliminated);
    }

    getTopImages() {
        return this.getActiveImages()
            .sort((a, b) => b.rating - a.rating)
            .slice(0, this.settings.target_final_count);
    }

    getEliminatedImages() {
        return this.images.filter(img => img.eliminated);
    }

    getFinalRankings() {
        if (this.phase !== 'ranking') {
            return this.getTopImages();
        }
        
        const rankings = this.getTopImages();
        
        if (this.mergeSortPairs && this.mergeSortIndex > 0) {
            this.sortByComparisons(rankings);
        }
        
        return rankings;
    }

    sortByComparisons(images) {
        const wins = new Map();
        images.forEach(img => wins.set(img.filename, 0));
        
        this.comparisons
            .filter(c => c.phase === 'ranking')
            .forEach(comp => {
                if (comp.result === 'A_wins' || comp.result === 'A_ko') {
                    wins.set(comp.imageA, (wins.get(comp.imageA) || 0) + 1);
                } else if (comp.result === 'B_wins' || comp.result === 'B_ko') {
                    wins.set(comp.imageB, (wins.get(comp.imageB) || 0) + 1);
                }
            });
        
        images.sort((a, b) => {
            const winsA = wins.get(a.filename) || 0;
            const winsB = wins.get(b.filename) || 0;
            if (winsA !== winsB) return winsB - winsA;
            return b.rating - a.rating;
        });
    }

    getPairingKey(filenameA, filenameB) {
        return filenameA < filenameB ? `${filenameA}:${filenameB}` : `${filenameB}:${filenameA}`;
    }

    getProgress() {
        const activeImages = this.getActiveImages();
        const totalImages = this.images.length;
        const eliminatedImages = totalImages - activeImages.length;
        
        let totalComparisons = this.comparisons.length;
        let estimatedTotal;
        
        if (this.phase === 'knockout') {
            const remainingEliminations = Math.max(0, activeImages.length - this.settings.target_final_count);
            const avgComparisonsPerElimination = eliminatedImages > 0 ? totalComparisons / eliminatedImages : 3;
            estimatedTotal = totalComparisons + (remainingEliminations * avgComparisonsPerElimination);
        } else {
            const rankingComparisons = this.settings.target_final_count * Math.log2(this.settings.target_final_count);
            const knockoutComparisons = this.comparisons.filter(c => c.phase === 'knockout').length;
            estimatedTotal = knockoutComparisons + rankingComparisons;
        }
        
        const progress = Math.min(100, (totalComparisons / estimatedTotal) * 100);
        
        return {
            phase: this.phase,
            round: this.round,
            completed_comparisons: totalComparisons,
            total_estimated_comparisons: Math.ceil(estimatedTotal),
            progress_percentage: Math.round(progress),
            remaining_images: activeImages.length,
            eliminated_images: eliminatedImages
        };
    }

    isComplete() {
        const activeImages = this.getActiveImages();
        
        if (this.phase === 'knockout') {
            return activeImages.length <= this.settings.target_final_count;
        } else {
            return !this.getNextPair();
        }
    }

    getStats() {
        const progress = this.getProgress();
        const activeImages = this.getActiveImages();
        
        return {
            ...progress,
            total_images: this.images.length,
            average_rating: Math.round(activeImages.reduce((sum, img) => sum + img.rating, 0) / activeImages.length),
            highest_rating: Math.max(...activeImages.map(img => img.rating)),
            lowest_rating: Math.min(...activeImages.map(img => img.rating)),
            total_rounds: this.round,
            comparisons_this_round: this.comparisons.filter(c => c.round === this.round && c.phase === this.phase).length
        };
    }
}