# Image Ranker - Project Specification

## Overview
Build a local web application that helps users efficiently rank images to select the top N images and rank them in order. The tool should minimize the number of comparisons needed while ensuring high-quality results.

## Core Features

### Image Comparison Interface
- Display two images side by side for comparison
- Three comparison options:
  - **A > B**: Slight preference for A (both images remain in consideration)
  - **A >> B**: Knockout - A is much better, B is eliminated entirely
  - **B > A**: Slight preference for B
  - **B >> A**: Knockout - B is much better, A is eliminated entirely
- Keyboard shortcuts for quick comparisons (e.g., 1, 2, 3, 4 keys)
- Progress indicator showing current phase and completion percentage

### Algorithm Implementation
Use a hybrid two-phase approach:

**Phase 1: Tournament with Knockouts**
- Multi-life tournament system where images get multiple chances before elimination
- Elo-style rating system to track image quality scores
- Swiss-system inspired pairing to prevent early elimination of good images
- Target: Reduce image pool to ~30-40 candidates

**Phase 2: Precise Ranking**
- Merge sort approach on remaining candidates
- Focus on ranking the top N images (default: 20)
- More careful comparisons between similar-quality images

### Data Persistence
- **CSV Export/Import**: Save comparison history as CSV for portability
- **Session State**: Use localStorage for immediate resume capability
- **Tournament State**: Save current progress, image ratings, elimination status

### File Management
- Local file system access via HTML5 File API
- Support common image formats (JPG, PNG, WEBP, etc.)
- Handle folders with 100-2000+ images efficiently
- Generate thumbnails for faster loading

## Technical Requirements

### Technology Stack
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **No external dependencies** - keep it simple and self-contained
- **Local storage**: CSV files + localStorage for session state
- **Deployment**: Static files suitable for Docker container

### CSV Data Schema
```csv
image_a,image_b,comparison,timestamp,phase,round
img001.jpg,img045.jpg,A_wins,2024-08-25T10:30:00,knockout,1
img002.jpg,img003.jpg,A_ko,2024-08-25T10:31:00,knockout,1
img045.jpg,img067.jpg,B_wins,2024-08-25T10:32:00,ranking,3
```

### State Management Schema
```json
{
  "images": [
    {
      "filename": "img001.jpg",
      "path": "relative/path",
      "rating": 1045,
      "eliminated": false,
      "lives": 2
    }
  ],
  "tournament_state": {
    "phase": "knockout",
    "round": 1,
    "target_final_count": 20,
    "completed_comparisons": 45,
    "total_estimated_comparisons": 180
  },
  "settings": {
    "initial_lives": 3,
    "rating_change_slight": 16,
    "rating_change_ko": 50,
    "elimination_threshold": 900
  }
}
```

## User Interface Requirements

### Main Screen
- Clean, distraction-free interface focused on image comparison
- Large image display with good zoom/pan capabilities
- Clear comparison buttons with visual feedback
- Progress bar and statistics

### Controls Panel
- Start new tournament / Resume existing
- Import/Export CSV data
- Settings (target count, algorithm parameters)
- Tournament statistics and current standings

### Results View
- Display final rankings of top N images
- Export final selection as file list or copy images to new folder
- Show comparison statistics and decision history

## File Structure
```
image-ranker/
├── index.html          # Main application
├── css/
│   └── styles.css      # Application styles
├── js/
│   ├── app.js          # Main application logic
│   ├── tournament.js   # Tournament algorithm implementation
│   ├── storage.js      # CSV and localStorage handling
│   └── ui.js           # User interface controls
├── README.md           # Setup and usage instructions
└── Dockerfile          # For containerized deployment
```

## Algorithm Details

### Phase 1: Knockout Tournament
1. **Initial Setup**: All images start with 1000 rating points and 3 lives
2. **Pairing Strategy**: Pair images with similar ratings when possible
3. **Rating Updates**:
   - Slight win: +16 to winner, -16 to loser
   - Knockout win: +50 to winner, eliminate loser immediately
   - Knockout loss: Immediate elimination regardless of lives/rating
4. **Elimination**: Images eliminated when rating < 900 AND lives = 0
5. **Completion**: When ~30-40 images remain or max rounds reached

### Phase 2: Precise Ranking
1. Take top-rated survivors from Phase 1
2. Use merge sort with human comparisons
3. Only rank top N positions (ignore bottom positions)
4. Handle ties gracefully

### Comparison Estimation
- **Phase 1**: ~1.5 × initial_image_count comparisons
- **Phase 2**: ~N × log(N) comparisons for top N ranking
- **Total**: Much better than N × log(N) full sort

## Success Criteria
1. **Efficiency**: Significantly fewer comparisons than full sorting
2. **Accuracy**: Top images are reliably identified and ranked
3. **Usability**: Intuitive interface, easy to pause/resume
4. **Reliability**: Data persistence works flawlessly
5. **Performance**: Handles 2000+ images smoothly

## Future Enhancement Ideas
- Batch operations for obvious eliminations
- Undo/redo functionality
- Export ranked images to separate folders
- Multiple tournament profiles/presets
- Comparison analytics and insights