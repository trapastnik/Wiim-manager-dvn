# Claude AI Assistant Guide - WiiM Web Control

This document provides context for AI assistants working with this project.

## Project Overview

**WiiM Web Control** is a Node.js web application for controlling WiiM Mini media players over a local network.

### Key Information
- **Language**: JavaScript (Node.js ES Modules)
- **Framework**: Express.js
- **Version**: 2.0.0
- **License**: MIT
- **Primary Language**: Russian (documentation and UI)

## Architecture

### Running the Application

- Run with: `npm start` or `npm run dev`
- Requires npm dependencies (express, multer)

### File Structure

```
wiim/
├── server.js             # Express server with API routes
├── wiim-client.js        # HTTP client for WiiM device API
├── network-scanner.js    # Network scanner for finding WiiM devices
├── scan.js               # Scanner utility
├── storage.js            # Data persistence module
├── package.json          # npm dependencies
├── .env                  # Environment configuration (not in git)
├── .env.example          # Example environment file
├── public/               # Static web interface files
│   ├── index.html       # Main UI
│   ├── style.css        # Styles
│   └── app.js           # Frontend JavaScript (2270 lines)
├── docs/                # Full documentation
├── data/                # Persistent data storage
└── media/               # Media files (covers, etc.)
```

## Core Functionality

### WiiM Device Communication
- Communicates with WiiM Mini via HTTP/HTTPS API at `/httpapi.asp`
- Handles self-signed SSL certificates (HTTPS enabled by default)
- API commands:
  - `getPlayerStatus` - Basic player status
  - `getStatusEx` - Extended status information
  - `setPlayerCmd:play/pause/stop/next/prev` - Playback control
  - `setPlayerCmd:vol:N` - Set volume (0-100)
  - `setPlayerCmd:mute:0/1` - Mute/unmute

### Features
- Real-time player status updates
- Playback control (play, pause, stop, next, previous)
- Volume control and muting
- Track information display
- Network scanning to discover WiiM devices
- Multi-player support
- Media upload and management

## Configuration

Environment variables (`.env` file):
```
WIIM_IP=192.168.1.xxx    # WiiM device IP address
PORT=3000                 # Server port
WIIM_USE_HTTPS=true      # Use HTTPS for WiiM communication
```

## API Endpoints

### Status
- `GET /api/status` - Get player status
- `GET /api/info` - Get detailed player info

### Playback Control
- `POST /api/control/play`
- `POST /api/control/pause`
- `POST /api/control/stop`
- `POST /api/control/next`
- `POST /api/control/prev`

### Volume Control
- `POST /api/volume/set` - Body: `{ "volume": 50 }`
- `POST /api/volume/up`
- `POST /api/volume/down`
- `POST /api/volume/mute`
- `POST /api/volume/unmute`

## Development Guidelines

### Code Style
- ES Module syntax (`import`/`export`)
- Async/await for asynchronous operations
- Error handling with try-catch blocks
- Russian comments and documentation

### Key Modules

**server.js**
- Express server setup
- API route definitions
- Static file serving
- Error handling middleware

**wiim-client.js**
- HTTP client for WiiM API
- Command construction
- Response parsing
- SSL certificate handling

**storage.js**
- Persistent data management
- JSON file-based storage

**network-scanner.js**
- Network device discovery
- WiiM device identification

### Security Considerations
- Self-signed SSL certificates are accepted (required for WiiM HTTPS)
- Local network usage only (not designed for internet exposure)
- No authentication implemented (LAN trust model)

## Common Tasks

### Adding New API Endpoints
1. Define route in `server.js`
2. Implement handler function
3. Use `wiimClient` to communicate with device
4. Return JSON response

### Modifying UI
1. Edit `public/index.html` for structure
2. Edit `public/style.css` for styling
3. Edit `public/app.js` for client-side logic
4. Test with `npm run dev` (auto-reload)

### Adding WiiM Commands
1. Identify command from WiiM API documentation
2. Add method to `wiim-client.js`
3. Create corresponding route in `server.js`
4. Update UI if needed

## Documentation Files

All documentation is located in the `docs/` folder:

- `README.md` - Main documentation (Russian)
- `docs/QUICK_START.md` - Quick start guide
- `docs/INSTALL.md` - Installation instructions
- `docs/PROJECT_STRUCTURE.md` - Project structure overview
- `docs/FEATURES.md` - Feature list
- `docs/MULTI-PLAYER-GUIDE.md` - Multi-player setup
- `docs/DIAGNOSTICS-GUIDE.md` - Troubleshooting
- `docs/APP_STRUCTURE.md` - Detailed app.js structure (2270 lines)
- `docs/CHANGELOG.md` - Version history
- `docs/SECURITY_RECOMMENDATIONS.md` - Security guidelines
- `docs/V3_SUGGESTIONS.md` - Future improvements

## Testing

### Manual Testing
1. Start server: `npm start`
2. Open browser: `http://localhost:3000`
3. Test each control button
4. Verify status updates

### Network Scanning
```bash
node scan.js
```

## Troubleshooting

### Common Issues
1. **Connection failed**: Check `WIIM_IP` in `.env`
2. **Status not updating**: Check browser console for errors
3. **HTTPS errors**: Verify `WIIM_USE_HTTPS` setting
4. **Port in use**: Change `PORT` in `.env`

## Important Notes for AI Assistants

1. **Language**: All user-facing text should be in Russian
2. **Code Format**: Use ES Modules, not CommonJS
3. **Error Handling**: Always wrap WiiM API calls in try-catch
4. **SSL**: Remember that WiiM uses self-signed certificates
5. **Documentation**: Keep all .md files in `docs/` folder updated when making changes
6. **Testing**: Always test changes with demo mode before deploying to production

## Dependencies

### Runtime (package.json)
- `express` ^4.18.2 - Web server framework
- `multer` ^1.4.5-lts.1 - File upload handling

### Built-in Node.js Modules Used
- `https` - HTTPS client
- `http` - HTTP server/client
- `fs` - File system operations
- `path` - Path utilities
- `url` - URL parsing
- `dgram` - UDP socket (for network scanning)

## Contact & Support

This is a personal/educational project. No official support channels.
