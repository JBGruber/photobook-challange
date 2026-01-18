/**
 * Tournament - Implements the two-phase ranking algorithm
 *
 * Phase 1 (Knockout): Swiss-style tournament with Elo ratings
 * Phase 2 (Ranking): True merge sort with human comparisons
 */
class Tournament {
    constructor(images, settings = {}) {
        this.settings = {
            targetCount: settings.targetCount || 20,
            initialLives: settings.initialLives || 3,
            ratingChangeSlide: 16,
            ratingChangeKO: 50,
            eliminationThreshold: 900,
            maxRounds: 20
        };

        // Initialize images
        this.images = images.map(img => ({
            filename: img.filename,
            blob: img.blob,
            rating: img.rating || 1000,
            lives: img.lives !== undefined ? img.lives : this.settings.initialLives,
            eliminated: img.eliminated || false,
            comparisons: 0
        }));

        this.phase = 'knockout';
        this.round = 1;
        this.comparisons = [];
        this.currentPair = null;

        // Comparison cache: "imgA:imgB" -> "A" or "B" (winner)
        this.comparisonCache = new Map();

        // Merge sort state for Phase 2
        this.mergeState = null;
    }

    // Restore from saved session
    static fromSession(session, imageBlobs) {
        const blobMap = new Map();
        imageBlobs.forEach(file => blobMap.set(file.name, file));

        const images = session.images.map(img => ({
            ...img,
            blob: blobMap.get(img.filename) || null
        }));

        const tournament = new Tournament(images, {
            targetCount: session.settings?.targetCount || 20,
            initialLives: session.settings?.initialLives || 3
        });

        tournament.phase = session.phase || 'knockout';
        tournament.round = session.round || 1;
        tournament.comparisons = session.comparisons || [];

        // Rebuild comparison cache
        tournament.comparisons.forEach(c => {
            const key = tournament.getCacheKey(c.imageA, c.imageB);
            const winner = (c.result === 'A_wins' || c.result === 'A_ko') ? 'A' : 'B';
            tournament.comparisonCache.set(key, winner);
        });

        // Restore merge state if in ranking phase
        if (session.mergeState) {
            tournament.mergeState = session.mergeState;
        }

        return tournament;
    }

    // Get session data for saving
    getSessionData() {
        return {
            images: this.images.map(img => ({
                filename: img.filename,
                rating: img.rating,
                lives: img.lives,
                eliminated: img.eliminated
            })),
            settings: this.settings,
            phase: this.phase,
            round: this.round,
            comparisons: this.comparisons,
            mergeState: this.mergeState
        };
    }

    // Main entry point - get next pair to compare
    getNextPair() {
        if (this.phase === 'knockout') {
            return this.getKnockoutPair();
        } else {
            return this.getRankingPair();
        }
    }

    // Phase 1: Knockout tournament
    getKnockoutPair() {
        const active = this.getActiveImages();

        // Check if we should transition to ranking phase
        if (active.length <= this.settings.targetCount) {
            this.phase = 'ranking';
            this.round = 1;
            this.initMergeSort();
            return this.getRankingPair();
        }

        if (active.length < 2) {
            return null;
        }

        // Find best pair: similar ratings, not recently compared
        const pair = this.findBestKnockoutPair(active);
        if (pair) {
            this.currentPair = pair;
        }
        return pair;
    }

    findBestKnockoutPair(active) {
        let bestPair = null;
        let bestScore = -Infinity;

        // Try multiple random pairs and pick the best
        const attempts = Math.min(100, active.length * 3);

        for (let i = 0; i < attempts; i++) {
            const idx1 = Math.floor(Math.random() * active.length);
            let idx2 = Math.floor(Math.random() * (active.length - 1));
            if (idx2 >= idx1) idx2++;

            const imgA = active[idx1];
            const imgB = active[idx2];

            const key = this.getCacheKey(imgA.filename, imgB.filename);
            const timesCompared = this.countComparisons(imgA.filename, imgB.filename);
            const ratingDiff = Math.abs(imgA.rating - imgB.rating);

            // Score: prefer new pairs with similar ratings
            let score = 100;
            score -= timesCompared * 50; // Penalize repeated comparisons
            score -= ratingDiff / 10;    // Prefer similar ratings
            score += (imgA.lives === 1 || imgB.lives === 1) ? 20 : 0; // Prioritize at-risk images

            if (score > bestScore) {
                bestScore = score;
                bestPair = [imgA, imgB];
            }

            // Good enough - fresh pair with similar ratings
            if (timesCompared === 0 && ratingDiff < 100) {
                break;
            }
        }

        return bestPair;
    }

    countComparisons(filenameA, filenameB) {
        return this.comparisons.filter(c =>
            (c.imageA === filenameA && c.imageB === filenameB) ||
            (c.imageA === filenameB && c.imageB === filenameA)
        ).length;
    }

    // Phase 2: True merge sort
    initMergeSort() {
        const candidates = this.getActiveImages()
            .sort((a, b) => b.rating - a.rating)
            .slice(0, this.settings.targetCount);

        // Initialize merge sort state
        // Each image starts as a sorted "run" of size 1
        this.mergeState = {
            runs: candidates.map(img => [img]),
            pendingMerge: null,
            completed: false
        };
    }

    getRankingPair() {
        if (!this.mergeState) {
            this.initMergeSort();
        }

        if (this.mergeState.completed) {
            return null;
        }

        // If we have a pending merge, continue it
        if (this.mergeState.pendingMerge) {
            const pair = this.getNextMergePair();
            if (pair) {
                this.currentPair = pair;
                return pair;
            }
        }

        // Start a new merge operation
        if (this.mergeState.runs.length >= 2) {
            this.startNextMerge();
            const pair = this.getNextMergePair();
            if (pair) {
                this.currentPair = pair;
                return pair;
            }
        }

        // Only one run left - we're done!
        if (this.mergeState.runs.length === 1) {
            this.mergeState.completed = true;
        }

        return null;
    }

    startNextMerge() {
        // Take two runs to merge
        const left = this.mergeState.runs.shift();
        const right = this.mergeState.runs.shift();

        this.mergeState.pendingMerge = {
            left: left,
            right: right,
            leftIdx: 0,
            rightIdx: 0,
            result: []
        };
    }

    getNextMergePair() {
        const merge = this.mergeState.pendingMerge;
        if (!merge) return null;

        // Check if one side is exhausted
        if (merge.leftIdx >= merge.left.length) {
            // Add remaining right elements
            while (merge.rightIdx < merge.right.length) {
                merge.result.push(merge.right[merge.rightIdx++]);
            }
            this.completeMerge();
            return this.getRankingPair(); // Continue with next merge
        }

        if (merge.rightIdx >= merge.right.length) {
            // Add remaining left elements
            while (merge.leftIdx < merge.left.length) {
                merge.result.push(merge.left[merge.leftIdx++]);
            }
            this.completeMerge();
            return this.getRankingPair(); // Continue with next merge
        }

        // Need to compare
        const imgA = merge.left[merge.leftIdx];
        const imgB = merge.right[merge.rightIdx];

        // Check cache first
        const cacheKey = this.getCacheKey(imgA.filename, imgB.filename);
        const cached = this.comparisonCache.get(cacheKey);

        if (cached) {
            // Use cached result
            this.applyMergeResult(cached === 'A' ? imgA : imgB, cached === 'A' ? imgB : imgA);
            return this.getNextMergePair();
        }

        // Need human comparison
        return [imgA, imgB];
    }

    applyMergeResult(winner, loser) {
        const merge = this.mergeState.pendingMerge;
        const leftImg = merge.left[merge.leftIdx];

        if (winner.filename === leftImg.filename) {
            merge.result.push(merge.left[merge.leftIdx++]);
        } else {
            merge.result.push(merge.right[merge.rightIdx++]);
        }
    }

    completeMerge() {
        const merge = this.mergeState.pendingMerge;
        // Add the merged run back to the list
        this.mergeState.runs.push(merge.result);
        this.mergeState.pendingMerge = null;
    }

    // Process user's comparison decision
    processComparison(result) {
        if (!this.currentPair) {
            throw new Error('No active comparison');
        }

        const [imgA, imgB] = this.currentPair;
        const timestamp = new Date().toISOString();

        // Record comparison
        const comparison = {
            imageA: imgA.filename,
            imageB: imgB.filename,
            result: result,
            timestamp: timestamp,
            phase: this.phase,
            round: this.round
        };
        this.comparisons.push(comparison);

        // Cache the result
        const cacheKey = this.getCacheKey(imgA.filename, imgB.filename);
        const winner = (result === 'A_wins' || result === 'A_ko') ? 'A' : 'B';
        this.comparisonCache.set(cacheKey, winner);

        // Update ratings
        this.updateRatings(imgA, imgB, result);

        if (this.phase === 'knockout') {
            // Check for eliminations
            this.checkEliminations();

            // Check if round should advance
            if (this.shouldAdvanceRound()) {
                this.round++;
                if (this.round > this.settings.maxRounds) {
                    this.phase = 'ranking';
                    this.round = 1;
                    this.initMergeSort();
                }
            }
        } else {
            // In ranking phase - apply merge result
            const winnerImg = (result === 'A_wins' || result === 'A_ko') ? imgA : imgB;
            const loserImg = (result === 'A_wins' || result === 'A_ko') ? imgB : imgA;
            this.applyMergeResult(winnerImg, loserImg);
        }

        this.currentPair = null;
        return comparison;
    }

    updateRatings(imgA, imgB, result) {
        const k = this.phase === 'knockout' ? 1.0 : 0.5;

        switch (result) {
            case 'A_wins':
                this.applyElo(imgA, imgB, k * this.settings.ratingChangeSlide);
                break;
            case 'A_ko':
                imgA.rating += k * this.settings.ratingChangeKO;
                imgB.eliminated = true;
                break;
            case 'B_wins':
                this.applyElo(imgB, imgA, k * this.settings.ratingChangeSlide);
                break;
            case 'B_ko':
                imgB.rating += k * this.settings.ratingChangeKO;
                imgA.eliminated = true;
                break;
        }
    }

    applyElo(winner, loser, k) {
        const expected = 1 / (1 + Math.pow(10, (loser.rating - winner.rating) / 400));
        winner.rating += k * (1 - expected);
        loser.rating -= k * expected;
    }

    checkEliminations() {
        for (const img of this.images) {
            if (img.eliminated) continue;

            if (img.rating < this.settings.eliminationThreshold) {
                if (img.lives > 0) {
                    img.lives--;
                } else {
                    img.eliminated = true;
                }
            }
        }
    }

    shouldAdvanceRound() {
        const active = this.getActiveImages();
        const roundComparisons = this.comparisons.filter(
            c => c.phase === 'knockout' && c.round === this.round
        ).length;

        const target = Math.max(Math.floor(active.length / 3), 5);
        return roundComparisons >= target;
    }

    // Helpers
    getCacheKey(filenameA, filenameB) {
        return filenameA < filenameB
            ? `${filenameA}|${filenameB}`
            : `${filenameB}|${filenameA}`;
    }

    getActiveImages() {
        return this.images.filter(img => !img.eliminated);
    }

    isComplete() {
        if (this.phase === 'knockout') {
            return this.getActiveImages().length <= this.settings.targetCount &&
                   this.mergeState?.completed;
        }
        return this.mergeState?.completed || false;
    }

    getFinalRankings() {
        if (this.mergeState?.completed && this.mergeState.runs.length === 1) {
            return this.mergeState.runs[0];
        }
        // Fallback: sort by rating
        return this.getActiveImages()
            .sort((a, b) => b.rating - a.rating)
            .slice(0, this.settings.targetCount);
    }

    getProgress() {
        const active = this.getActiveImages();
        const total = this.images.length;
        const eliminated = total - active.length;

        let percent, estimated;

        if (this.phase === 'knockout') {
            // Estimate based on eliminations needed
            const needed = Math.max(0, active.length - this.settings.targetCount);
            const done = eliminated;
            const totalNeeded = total - this.settings.targetCount;
            percent = totalNeeded > 0 ? Math.round((done / totalNeeded) * 50) : 50;
            estimated = Math.round(totalNeeded * 1.5);
        } else {
            // Merge sort: n*log(n) comparisons
            const n = this.settings.targetCount;
            const knockoutComps = this.comparisons.filter(c => c.phase === 'knockout').length;
            const rankingComps = this.comparisons.filter(c => c.phase === 'ranking').length;
            const expectedRanking = Math.round(n * Math.log2(n));

            percent = 50 + Math.min(50, Math.round((rankingComps / expectedRanking) * 50));
            estimated = knockoutComps + expectedRanking;
        }

        return {
            phase: this.phase,
            round: this.round,
            completedComparisons: this.comparisons.length,
            estimatedTotal: estimated,
            percent: Math.min(99, percent),
            activeImages: active.length,
            eliminatedImages: eliminated
        };
    }
}
