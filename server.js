require('dotenv').config();
const express = require('express');
const SpotifyWebApi = require('spotify-web-api-node');
const socketIo = require('socket.io');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const http = require('http');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(cookieParser());
app.use(express.json());
app.use(express.static('public'));

// Serve API keys endpoint
app.get('/api/config', (req, res) => {
  res.json({
    lastfmApiKey: process.env.LASTFM_API_KEY || 'b25b959554ed76058ac220b7b2e0a026',
    youtubeApiKey: process.env.YOUTUBE_API_KEY || 'AIzaSyB6FhlAzbh21OvLAeM5D2G21jMv-rUT0b8'
  });
});

// Spotify API Setup
const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  redirectUri: process.env.SPOTIFY_REDIRECT_URI
});

// DJ Spotify API (controls the station)
const djSpotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  redirectUri: process.env.SPOTIFY_REDIRECT_URI
});

// Store connected listeners
let listeners = new Map();
let currentTrack = null;
let djAuthenticated = false;

// Global radio state - synced across all listeners
let radioState = {
  currentSong: null,
  startedAt: null,
  duration: null,
  lastfmUsername: 'maroughi99'
};

// Initialize DJ refresh token if available
if (process.env.DJ_REFRESH_TOKEN) {
  djSpotifyApi.setRefreshToken(process.env.DJ_REFRESH_TOKEN);
  refreshDJToken();
}

// Refresh DJ access token
async function refreshDJToken() {
  try {
    const data = await djSpotifyApi.refreshAccessToken();
    djSpotifyApi.setAccessToken(data.body.access_token);
    djAuthenticated = true;
    console.log('DJ token refreshed successfully');
    
    // Schedule next refresh (55 minutes)
    setTimeout(refreshDJToken, 55 * 60 * 1000);
  } catch (error) {
    console.error('Error refreshing DJ token:', error);
    djAuthenticated = false;
  }
}

// Get current radio state with position
app.get('/api/radio-state', (req, res) => {
  if (!radioState.currentSong) {
    return res.json({ playing: false });
  }
  
  const elapsed = Date.now() - radioState.startedAt;
  const position = Math.floor(elapsed / 1000); // in seconds
  
  res.json({
    playing: true,
    song: radioState.currentSong,
    position: position,
    duration: radioState.duration,
    startedAt: radioState.startedAt
  });
});

// Update radio state endpoint (called by frontend when Last.fm updates)
app.post('/api/update-radio', express.json(), (req, res) => {
  const { song, artist, album, albumArt, duration } = req.body;
  
  // Check if it's a new song
  const songId = `${song}-${artist}`;
  const currentId = radioState.currentSong ? `${radioState.currentSong.name}-${radioState.currentSong.artist}` : null;
  
  if (songId !== currentId) {
    radioState = {
      currentSong: { name: song, artist, album, albumArt },
      startedAt: Date.now(),
      duration: duration || 180000,
      lastfmUsername: 'maroughi99'
    };
    
    // Broadcast to all connected clients
    io.emit('radio-update', radioState);
    
    console.log('🎵 Radio now playing:', song, 'by', artist);
  }
  
  res.json({ success: true });
});

// Get current playback state from DJ
async function getCurrentPlayback() {
  if (!djAuthenticated) return null;
  
  try {
    const data = await djSpotifyApi.getMyCurrentPlaybackState();
    if (data.body && data.body.item) {
      return {
        track: {
          name: data.body.item.name,
          artist: data.body.item.artists.map(a => a.name).join(', '),
          album: data.body.item.album.name,
          albumArt: data.body.item.album.images[0]?.url,
          uri: data.body.item.uri,
          duration: data.body.item.duration_ms,
          id: data.body.item.id
        },
        isPlaying: data.body.is_playing,
        progressMs: data.body.progress_ms,
        timestamp: Date.now()
      };
    }
  } catch (error) {
    console.error('Error getting playback:', error.message);
  }
  return null;
}

// Sync playback across all listeners
async function syncPlayback() {
  const playback = await getCurrentPlayback();
  if (playback) {
    currentTrack = playback;
    io.emit('playback-update', playback);
  }
}

// Poll DJ's playback every 2 seconds
setInterval(syncPlayback, 2000);

// Routes

// Login route
app.get('/login', (req, res) => {
  const scopes = [
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing',
    'streaming',
    'user-read-email',
    'user-read-private'
  ];
  
  const authorizeURL = spotifyApi.createAuthorizeURL(scopes, 'state');
  res.redirect(authorizeURL);
});

// DJ Login route (for initial setup)
app.get('/dj-login', (req, res) => {
  const scopes = [
    'user-read-playback-state',
    'user-read-currently-playing',
    'user-read-private'
  ];
  
  const authorizeURL = spotifyApi.createAuthorizeURL(scopes, 'dj-state');
  res.redirect(authorizeURL);
});

// Callback route
app.get('/callback', async (req, res) => {
  const { code, state } = req.query;
  
  if (!code) {
    return res.redirect('/?error=no_code');
  }

  try {
    const data = await spotifyApi.authorizationCodeGrant(code);
    const { access_token, refresh_token } = data.body;
    
    // If this is DJ authentication
    if (state === 'dj-state') {
      console.log('DJ Refresh Token:', refresh_token);
      console.log('Add this to your .env file as DJ_REFRESH_TOKEN');
      return res.send(`
        <html>
          <body style="font-family: Arial; padding: 40px;">
            <h1>DJ Setup Complete!</h1>
            <p>Add this to your .env file:</p>
            <pre style="background: #f0f0f0; padding: 20px; border-radius: 5px;">DJ_REFRESH_TOKEN=${refresh_token}</pre>
            <p>Then restart the server.</p>
            <a href="/">Go to Radio Station</a>
          </body>
        </html>
      `);
    }
    
    // Regular listener authentication
    res.redirect(`/?access_token=${access_token}&refresh_token=${refresh_token}`);
  } catch (error) {
    console.error('Error in callback:', error);
    res.redirect('/?error=auth_failed');
  }
});

// Get current track
app.get('/api/current-track', async (req, res) => {
  const playback = await getCurrentPlayback();
  res.json(playback || { error: 'No track playing' });
});

// DJ status
app.get('/api/dj-status', (req, res) => {
  res.json({ authenticated: djAuthenticated });
});

// Socket.io connection
io.on('connection', (socket) => {
  console.log('New listener connected:', socket.id);
  
  // Send current track immediately
  if (currentTrack) {
    socket.emit('playback-update', currentTrack);
  }
  
  // Handle listener authentication
  socket.on('authenticate', async (data) => {
    const { accessToken, refreshToken } = data;
    
    const userSpotifyApi = new SpotifyWebApi({
      clientId: process.env.SPOTIFY_CLIENT_ID,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
      accessToken: accessToken,
      refreshToken: refreshToken
    });
    
    try {
      const userData = await userSpotifyApi.getMe();
      listeners.set(socket.id, {
        spotifyApi: userSpotifyApi,
        username: userData.body.display_name,
        id: userData.body.id
      });
      
      socket.emit('authenticated', { username: userData.body.display_name });
      console.log(`Listener authenticated: ${userData.body.display_name}`);
    } catch (error) {
      console.error('Authentication error:', error);
      socket.emit('auth-error', { message: 'Failed to authenticate' });
    }
  });
  
  // Request sync
  socket.on('request-sync', async () => {
    if (currentTrack) {
      socket.emit('playback-update', currentTrack);
    }
  });
  
  socket.on('disconnect', () => {
    console.log('Listener disconnected:', socket.id);
    listeners.delete(socket.id);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🎵 Radio station running on http://localhost:${PORT}`);
  console.log(`DJ Authenticated: ${djAuthenticated}`);
  if (!djAuthenticated) {
    console.log(`⚠️  Visit http://localhost:${PORT}/dj-login to set up DJ account`);
  }
});
