# Photobook Challenge

>[!WARNING]
>  This is a "vibe coding" experiment/project. Don't take seriously

A local web application that helps users efficiently rank images to select and order the top N images using a hybrid tournament approach that minimizes comparisons while ensuring high-quality results.

## Features

### 🏆 Smart Tournament Algorithm
- **Phase 1: Knockout Tournament** - Multi-life system with Elo ratings eliminates weaker images
- **Phase 2: Precise Ranking** - Merge sort approach for final top N ranking
- Significantly fewer comparisons than traditional sorting methods

### 🖼️ User-Friendly Interface
- Side-by-side image comparison
- Keyboard shortcuts (1, 2, 3, 4) for rapid decisions
- Image zoom functionality
- Progress tracking with visual indicators
- Clean, distraction-free design

### 💾 Data Persistence
- **Auto-save**: Session state preserved in localStorage
- **CSV Export/Import**: Portable comparison history
- **Resume capability**: Pick up exactly where you left off
- **Results export**: Save final rankings as CSV

### ⚡ Performance Optimized
- Handles 100-2000+ images efficiently
- 100% local processing (files never leave your device)
- Smart image preprocessing and memory management
- Responsive design for all screen sizes

## Quick Start

### Option 1: Direct Use
1. Download or clone this repository
2. Open `index.html` in a modern web browser
3. Choose your local image folder
4. Configure tournament settings (optional)
5. Start ranking!

### Option 2: Docker (Recommended for sharing)
```bash
# Build the container
docker build -t photobook-challenge .

# Run locally
docker run -p 8080:80 photobook-challenge

# Access at http://localhost:8080
```

## How It Works

### The Algorithm

**Phase 1: Knockout Tournament (Elimination)**
- All images start with 1000 rating points and 3 lives
- Smart pairing system matches similar-rated images
- Two comparison types:
  - **Slight preference** (A/B Better): ±16 rating points
  - **Knockout** (A/B Much Better): +50 points, immediate elimination
- Images eliminated when rating < 900 AND lives = 0
- Continues until ~30-40 top images remain

**Phase 2: Precise Ranking (Final Order)**
- Takes top survivors from Phase 1
- Uses merge sort with human comparisons
- Focuses only on ranking top N positions
- Handles ties and edge cases gracefully

### Why This Approach?

Traditional sorting requires **N × log(N)** comparisons. For 1000 images:
- **Full sort**: ~10,000 comparisons
- **Our method**: ~2,000-3,000 comparisons

The hybrid approach eliminates obviously inferior images quickly while ensuring top images get careful ranking.

## Usage Guide

### 1. Setup
- Click "Choose Image Folder" and select a directory containing images
- Supported formats: JPG, PNG, WEBP, GIF, and other common image types
- Adjust settings:
  - **Target Final Count**: How many images you want ranked (default: 20)
  - **Initial Lives**: How many chances each image gets (default: 3)

### 2. Tournament Phase
- Compare images side-by-side
- Use buttons or keyboard shortcuts:
  - **1**: A Better (slight preference)
  - **2**: A Much Better (knockout B)
  - **3**: B Much Better (knockout A)  
  - **4**: B Better (slight preference)
- Monitor progress via the progress bar
- Click images to zoom for better comparison

### 3. Results
- View final rankings with ratings
- Export results as CSV
- Start a new tournament with different images/settings

### 4. Session Management
- **Auto-save**: Progress saved every 30 seconds
- **Resume**: Refresh/reopen to continue where you left off
- **Import/Export**: Save tournament data as CSV for backup or analysis
- **Pause**: Return to setup screen anytime

## Technical Details

### File Structure
```
image-ranker/
├── index.html          # Main application
├── css/
│   └── styles.css      # Application styles  
├── js/
│   ├── app.js          # Main application logic
│   ├── tournament.js   # Tournament algorithm
│   ├── storage.js      # Data persistence
│   └── ui.js           # User interface
├── README.md           # This file
└── Dockerfile          # Container configuration
```

### Data Formats

**CSV Export Schema:**
```csv
image_a,image_b,comparison,timestamp,phase,round
img001.jpg,img045.jpg,A_wins,2024-08-25T10:30:00,knockout,1
img002.jpg,img003.jpg,A_ko,2024-08-25T10:31:00,knockout,1
```

**Session State Schema:**
```json
{
  "images": [
    {
      "filename": "img001.jpg",
      "rating": 1045,
      "eliminated": false,
      "lives": 2
    }
  ],
  "tournament_state": {
    "phase": "knockout",
    "round": 1,
    "target_final_count": 20
  }
}
```

### Browser Compatibility
- Modern browsers with ES6+ support
- Chrome 60+, Firefox 55+, Safari 12+, Edge 79+
- Requires File API support for local image access
- No server required - runs entirely client-side

### Performance Considerations
- Images larger than 5MB are skipped for memory management
- Session data compressed for localStorage efficiency
- Object URLs properly managed to prevent memory leaks
- Responsive design adapts to screen size and device capabilities

## Tips for Best Results

### Image Selection
- Use high-quality source images
- Similar aspect ratios work better for comparison
- Consistent lighting/style helps with decision-making
- Remove obvious duplicates beforehand

### Tournament Strategy
- **Conservative approach**: Use "Better" for close calls, save "Much Better" for clear winners
- **Aggressive approach**: Use "Much Better" more liberally to eliminate faster
- **Trust your instincts**: First impressions are often accurate
- **Take breaks**: Avoid decision fatigue on large image sets

### Settings Optimization
- **Small collections (< 100 images)**: Reduce target count to 10-15
- **Large collections (> 1000 images)**: Increase initial lives to 4-5
- **Professional work**: Export CSV for analysis and documentation
- **Quick sorting**: Lower target count, use aggressive eliminations

## Troubleshooting

### Common Issues

**Images not loading:**
- Ensure browser supports File API
- Check file formats are supported
- Verify images aren't corrupted
- Try smaller image sets first

**Performance issues:**
- Reduce image count per session
- Clear browser cache/localStorage
- Close other browser tabs
- Use latest browser version

**Session not saving:**
- Check localStorage isn't full
- Ensure cookies/local storage enabled
- Export CSV as backup
- Clear old session data

**Export not working:**
- Allow downloads in browser settings
- Check available disk space
- Try different file names
- Verify CSV format compatibility

### Getting Help
- Check browser console for error messages
- Try the same images in different browser
- Export/import CSV to recover data
- Clear all data and start fresh if needed

## Development

### Local Development
```bash
# Clone repository
git clone [repository-url]
cd image-ranker

# Serve locally (Python example)
python -m http.server 8000

# Or use any local server
# Access at http://localhost:8000
```

### Docker Deployment
```bash
# Build
docker build -t photobook-challenge .

# Run with custom port
docker run -p 3000:80 image-ranker

# Run in background
docker run -d -p 8080:80 image-ranker
```

### Customization
- Modify `css/styles.css` for visual customization
- Adjust algorithm parameters in `tournament.js`
- Add new export formats in `storage.js`
- Extend UI functionality in `ui.js`

## License

This project is available under the MIT License. See the LICENSE file for details.

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

Focus areas for contribution:
- Additional export formats (JSON, XML)
- Batch operations for obvious eliminations
- Undo/redo functionality
- Advanced analytics and insights
- Mobile app version
- Server-side processing options