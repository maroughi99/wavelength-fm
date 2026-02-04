// Socket.io connection
const socket = io();

// State
let currentPlayback = null;

// DOM Elements
const loginSection = document.getElementById('login-section');
const playerSection = document.getElementById('player-section');
const loginBtn = document.getElementById('login-btn');
const albumArt = document.getElementById('album-art');
const trackName = document.getElementById('track-name');
const trackArtist = document.getElementById('track-artist');
const trackAlbum = document.getElementById('track-album');
const currentTimeEl = document.getElementById('current-time');
const durationEl = document.getElementById('duration');
const progressFill = document.getElementById('progress-fill');
const playBtn = document.getElementById('play-btn');
const connectionStatus = document.getElementById('connection-status');
const usernameEl = document.getElementById('username');

// Login button click - Demo mode since no backend yet
if (loginBtn) {
  loginBtn.addEventListener('click', () => {
    console.log('🎵 Start Listening button clicked!');
    try {
      showDemoPlayer();
    } catch (error) {
      console.error('Error showing player:', error);
      alert('Error loading player. Check console for details.');
    }
  });
} else {
  console.error('Login button not found!');
}

// Show demo player with sample content
function showDemoPlayer() {
  console.log('📻 Showing player section...');
  
  if (!loginSection || !playerSection) {
    console.error('Required sections not found!');
    return;
  }
  
  // Check if player is already visible (returning user)
  const alreadyVisible = !playerSection.classList.contains('hidden');
  
  loginSection.classList.add('hidden');
  playerSection.classList.remove('hidden');
  
  console.log('✓ Player section is now visible');
  
  // Set user
  if (usernameEl) usernameEl.textContent = 'Guest';
  
  // Don't set demo track info - let Last.fm populate it
  if (trackName) trackName.textContent = 'Loading...';
  if (trackArtist) trackArtist.textContent = 'Connecting to Radio Station';
  if (trackAlbum) trackAlbum.textContent = '';
  
  // Update status
  if (connectionStatus) {
    const statusText = connectionStatus.querySelector('.status-text');
    if (statusText) {
      statusText.textContent = 'Connecting...';
    }
  }
  
  // Animate visualizer bars
  animateVisualizer();
  
  if (alreadyVisible) {
    // User came back - force immediate refresh and play
    console.log('Returning user - forcing playback');
    currentTrackId = null; // Reset so it plays even if same song
    fetchNowPlaying();
  } else {
    // First time - start Last.fm sync automatically
    console.log('First time loading - initializing...');
    initializeLastfm();
  }
}

// Animate the visualizer bars
function animateVisualizer() {
  const bars = document.querySelectorAll('.visualizer .bar');
  bars.forEach((bar, index) => {
    setInterval(() => {
      const height = Math.random() * 60 + 20;
      bar.style.height = height + '%';
    }, 300 + (index * 100));
  });
}

// Last.fm Integration - Auto-connect
const LASTFM_API_KEY = 'b25b959554ed76058ac220b7b2e0a026'; // Public API key for demo
const YOUTUBE_API_KEY = 'AIzaSyA_SPigBXGsaKBdLvAQz1usd35_Bi-cPDQ'; // User's YouTube API key
const lastfmUsername = 'maroughi99'; // Hardcoded username
let updateInterval;
let youtubePlayer;
let currentTrackId = null;
let playerInitialized = false;

// Make the YouTube ready function globally accessible
window.onYouTubeIframeAPIReady = function() {
  console.log('YouTube API ready, attempting to create player...');
  
  const playerElement = document.getElementById('youtube-player');
  if (!playerElement) {
    console.error('Player element not found! Waiting...');
    setTimeout(window.onYouTubeIframeAPIReady, 500);
    return;
  }
  
  try {
    youtubePlayer = new YT.Player('youtube-player', {
      height: '360',
      width: '100%',
      videoId: 'jNQXAC9IVRw',
      playerVars: {
        'autoplay': 0,
        'controls': 1,
        'modestbranding': 1,
        'rel': 0,
        'fs': 1,
        'enablejsapi': 1,
        'origin': window.location.origin
      },
      events: {
        'onReady': onPlayerReady,
        'onStateChange': onPlayerStateChange,
        'onError': onPlayerError
      }
    });
    console.log('YouTube player object created successfully');
    playerInitialized = true;
  } catch (error) {
    console.error('Error creating YouTube player:', error);
    updatePlayerStatus('Error: ' + error.message);
  }
};

function onPlayerReady(event) {
  console.log('✅ YouTube player ready and functional!');
  updatePlayerStatus('Ready - Click play on video or wait for song');
  // If player section is visible, fetch current track immediately
  if (!playerSection.classList.contains('hidden')) {
    console.log('Player ready and user is listening - fetching track');
    setTimeout(() => fetchNowPlaying(), 1000);
  }
}

function onPlayerStateChange(event) {
  console.log('Player state changed:', event.data);
  
  // Update status display
  const states = {
    '-1': 'Unstarted',
    '0': 'Ended',
    '1': 'Playing',
    '2': 'Paused',
    '3': 'Buffering',
    '5': 'Video Cued'
  };
  updatePlayerStatus(states[event.data] || 'Unknown');
  
  // Auto-play next when song ends
  if (event.data === YT.PlayerState.ENDED) {
    fetchNowPlaying(); // Check for new song
  }
}

function onPlayerError(event) {
  console.error('YouTube player error code:', event.data);
  const errorMessages = {
    2: 'Invalid video ID',
    5: 'HTML5 player error',
    100: 'Video not found or private',
    101: 'Video owner does not allow embedding',
    150: 'Video owner does not allow embedding'
  };
  const errorMsg = errorMessages[event.data] || 'Unknown error';
  console.error('Error:', errorMsg);
  updatePlayerStatus('Error: ' + errorMsg);
}

function updatePlayerStatus(status) {
  const statusEl = document.getElementById('player-status');
  if (statusEl) {
    statusEl.textContent = status;
  }
}

function updateCurrentVideo(title) {
  const videoEl = document.getElementById('current-video');
  if (videoEl) {
    videoEl.textContent = title;
  }
}

// Search YouTube and play
async function searchAndPlayYouTube(songName, artistName, startSeconds = 0) {
  try {
    // Try multiple search strategies to find the best match
    const searchStrategies = [
      `${artistName} ${songName} official audio`,
      `${artistName} ${songName} audio`,
      `${songName} ${artistName} official`,
      `${artistName} - ${songName}`
    ];
    
    console.log('Searching YouTube for:', songName, 'by', artistName, '| Start at:', startSeconds + 's');
    
    for (const strategy of searchStrategies) {
      const query = encodeURIComponent(strategy);
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${query}&type=video&videoCategoryId=10&key=${YOUTUBE_API_KEY}&maxResults=5`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.error) {
        console.error('YouTube API Error:', data.error);
        return;
      }
      
      if (data.items && data.items.length > 0) {
        // Filter and rank results
        let bestMatch = null;
        let bestScore = 0;
        
        for (const item of data.items) {
          const title = item.snippet.title.toLowerCase();
          const channel = item.snippet.channelTitle.toLowerCase();
          const songLower = songName.toLowerCase();
          const artistLower = artistName.toLowerCase();
          
          // Skip videos that are clearly wrong
          if (title.includes('cover') && !songLower.includes('cover')) continue;
          if (title.includes('remix') && !songLower.includes('remix')) continue;
          if (title.includes('live') && !songLower.includes('live')) continue;
          if (title.includes('karaoke')) continue;
          if (title.includes('instrumental') && !songLower.includes('instrumental')) continue;
          
          // Calculate match score
          let score = 0;
          
          // High priority: Official channels or "Topic" channels (auto-generated by YouTube)
          if (channel.includes('topic') || channel.includes('vevo') || channel.includes('official')) {
            score += 10;
          }
          
          // Title contains both artist and song
          if (title.includes(songLower) && title.includes(artistLower)) {
            score += 8;
          } else if (title.includes(songLower) || title.includes(artistLower)) {
            score += 3;
          }
          
          // Prefer "audio" or "official" in title
          if (title.includes('official')) score += 5;
          if (title.includes('audio')) score += 3;
          
          // Penalize certain keywords
          if (title.includes('lyrics')) score -= 2;
          if (title.includes('reaction')) score -= 10;
          if (title.includes('review')) score -= 10;
          
          if (score > bestScore) {
            bestScore = score;
            bestMatch = item;
          }
        }
        
        if (bestMatch) {
          const videoId = bestMatch.id.videoId;
          const videoTitle = bestMatch.snippet.title;
          const videoChannel = bestMatch.snippet.channelTitle;
          
          console.log('✓ Selected:', videoTitle);
          console.log('  Channel:', videoChannel);
          console.log('  Score:', bestScore);
          
          updateCurrentVideo(videoTitle);
          
          if (!playerInitialized || !youtubePlayer || !youtubePlayer.loadVideoById) {
            console.error('⚠️ YouTube player not ready! Will retry when player initializes...');
            updatePlayerStatus('Waiting for player...');
            // Retry in 2 seconds
            setTimeout(() => searchAndPlayYouTube(songName, artistName, startSeconds), 2000);
            return;
          }
          
          if (youtubePlayer && youtubePlayer.loadVideoById) {
            console.log('📡 Loading video ID:', videoId, '| Starting at:', startSeconds + 's');
            youtubePlayer.loadVideoById({
              videoId: videoId,
              startSeconds: startSeconds
            });
            
            // Play the video after a short delay
            setTimeout(() => {
              if (youtubePlayer.playVideo) {
                console.log('▶️ Playing video...');
                youtubePlayer.playVideo();
              }
            }, 1500);
          }
          
          return; // Found a good match, stop searching
        }
      }
    }
    
    console.log('No suitable match found for:', songName, 'by', artistName);
  } catch (error) {
    console.error('Error searching YouTube:', error);
  }
}
  try {
    // Try multiple search strategies to find the best match
    const searchStrategies = [
      `${artistName} ${songName} official audio`,
      `${artistName} ${songName} audio`,
      `${songName} ${artistName} official`,
      `${artistName} - ${songName}`
    ];
    
    console.log('Searching YouTube for:', songName, 'by', artistName);
    
    for (const strategy of searchStrategies) {
      const query = encodeURIComponent(strategy);
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${query}&type=video&videoCategoryId=10&key=${YOUTUBE_API_KEY}&maxResults=5`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.error) {
        console.error('YouTube API Error:', data.error);
        return;
      }
      
      if (data.items && data.items.length > 0) {
        // Filter and rank results
        let bestMatch = null;
        let bestScore = 0;
        
        for (const item of data.items) {
          const title = item.snippet.title.toLowerCase();
          const channel = item.snippet.channelTitle.toLowerCase();
          const songLower = songName.toLowerCase();
          const artistLower = artistName.toLowerCase();
          
          // Skip videos that are clearly wrong
          if (title.includes('cover') && !songLower.includes('cover')) continue;
          if (title.includes('remix') && !songLower.includes('remix')) continue;
          if (title.includes('live') && !songLower.includes('live')) continue;
          if (title.includes('karaoke')) continue;
          if (title.includes('instrumental') && !songLower.includes('instrumental')) continue;
          
          // Calculate match score
          let score = 0;
          
          // High priority: Official channels or "Topic" channels (auto-generated by YouTube)
          if (channel.includes('topic') || channel.includes('vevo') || channel.includes('official')) {
            score += 10;
          }
          
          // Title contains both artist and song
          if (title.includes(songLower) && title.includes(artistLower)) {
            score += 8;
          } else if (title.includes(songLower) || title.includes(artistLower)) {
            score += 3;
          }
          
          // Prefer "audio" or "official" in title
          if (title.includes('official')) score += 5;
          if (title.includes('audio')) score += 3;
          
          // Penalize certain keywords
          if (title.includes('lyrics')) score -= 2;
          if (title.includes('reaction')) score -= 10;
          if (title.includes('review')) score -= 10;
          
          if (score > bestScore) {
            bestScore = score;
            bestMatch = item;
          }
        }
        
        if (bestMatch) {
          const videoId = bestMatch.id.videoId;
          const videoTitle = bestMatch.snippet.title;
          const videoChannel = bestMatch.snippet.channelTitle;
          
          console.log('✓ Selected:', videoTitle);
          console.log('  Channel:', videoChannel);
          console.log('  Score:', bestScore);
          
          updateCurrentVideo(videoTitle);
          
          if (!playerInitialized || !youtubePlayer || !youtubePlayer.loadVideoById) {
            console.error('⚠️ YouTube player not ready! Will retry when player initializes...');
            updatePlayerStatus('Waiting for player...');
            // Retry in 2 seconds
            setTimeout(() => searchAndPlayYouTube(songName, artistName), 2000);
            return;
          }
          
          if (youtubePlayer && youtubePlayer.loadVideoById) {
            console.log('Loading video ID:', videoId);
            youtubePlayer.loadVideoById({
              videoId: videoId,
              startSeconds: 0
            });
            
            // Play the video after a short delay
            setTimeout(() => {
              if (youtubePlayer.playVideo) {
                console.log('▶️ Attempting to play video...');
                youtubePlayer.playVideo();
              }
            }, 1500);
          }
          
          return; // Found a good match, stop searching
        }
      }
    }
    
    console.log('No suitable match found for:', songName, 'by', artistName);
  } catch (error) {
    console.error('Error searching YouTube:', error);
  }
}

// Auto-start syncing when player loads
function initializeLastfm() {
  console.log('Initializing Last.fm sync...');
  
  // First, check if there's a global radio state to sync with
  syncWithRadioState();
  
  // Then start regular updates
  startLastfmSync();
}

// Sync with global radio state
async function syncWithRadioState() {
  try {
    const response = await fetch('/api/radio-state');
    const state = await response.json();
    
    if (state.playing && state.song) {
      console.log('📡 Syncing with radio station...');
      console.log('Current song:', state.song.name, 'by', state.song.artist);
      console.log('Position:', state.position + 's of', Math.floor(state.duration / 1000) + 's');
      
      // Update UI
      if (trackName) trackName.textContent = state.song.name;
      if (trackArtist) trackArtist.textContent = state.song.artist;
      if (trackAlbum) trackAlbum.textContent = state.song.album || '';
      if (albumArt && state.song.albumArt) albumArt.src = state.song.albumArt;
      
      const statusText = connectionStatus.querySelector('.status-text');
      if (statusText) {
        statusText.textContent = '📡 Synced with Radio';
      }
      
      currentTrackId = state.song.name + state.song.artist;
      
      // Start playback at current position
      searchAndPlayYouTube(state.song.name, state.song.artist, state.position);
    } else {
      console.log('No song currently playing on the radio - will check Last.fm');
    }
  } catch (error) {
    console.error('Error syncing with radio:', error);
  }
}

function startLastfmSync() {
  // Clear any existing interval
  if (updateInterval) {
    clearInterval(updateInterval);
  }
  
  // Fetch immediately
  fetchNowPlaying();
  
  // Then fetch every 10 seconds
  updateInterval = setInterval(fetchNowPlaying, 10000);
}

async function fetchNowPlaying() {
  if (!lastfmUsername) return;
  
  try {
    const url = `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${lastfmUsername}&api_key=${LASTFM_API_KEY}&format=json&limit=1`;
    const response = await fetch(url);
    const data = await response.json();
    
    console.log('Last.fm data:', data);
    
    if (data.recenttracks && data.recenttracks.track && data.recenttracks.track.length > 0) {
      const track = data.recenttracks.track[0];
      const trackId = track.name + track.artist['#text'];
      
      // Update track info
      if (trackName) trackName.textContent = track.name;
      if (trackArtist) trackArtist.textContent = track.artist['#text'] || track.artist;
      if (trackAlbum) trackAlbum.textContent = track.album['#text'] || 'Album';
      
      // Update album art
      const images = track.image;
      if (images && images.length > 0) {
        const largeImage = images.find(img => img.size === 'extralarge') || images[images.length - 1];
        if (largeImage && largeImage['#text'] && albumArt) {
          albumArt.src = largeImage['#text'];
        }
      }
      
      // Update status
      const isPlaying = track['@attr'] && track['@attr'].nowplaying === 'true';
      const statusText = connectionStatus.querySelector('.status-text');
      if (statusText) {
        statusText.textContent = isPlaying ? '🎵 Now Playing' : '⏸️ Last Played';
      }
      
      // Update server with current track for global sync
      if (isPlaying && trackId !== currentTrackId) {
        currentTrackId = trackId;
        
        // Report to server
        fetch('/api/update-radio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            song: track.name,
            artist: track.artist['#text'] || track.artist,
            album: track.album['#text'],
            albumArt: largeImage && largeImage['#text'],
            duration: 180000 // Most songs ~3 min, Last.fm doesn't provide duration
          })
        });
        
        // For the DJ (person playing), start immediately
        searchAndPlayYouTube(track.name, track.artist['#text'] || track.artist, 0);
      }
      
      console.log('Updated track:', track.name, 'by', track.artist['#text']);
    } else if (data.error) {
      console.error('Last.fm error:', data.message);
      alert(`Last.fm Error: ${data.message}. Check if username "${lastfmUsername}" is correct.`);
    }
  } catch (error) {
    console.error('Error fetching from Last.fm:', error);
  }
}

// Original login flow (keeping for when API is set up)
function realLogin() {
  window.location.href = '/login';
}

// Initialize player
function initializePlayer() {
  loginSection.classList.add('hidden');
  playerSection.classList.remove('hidden');
  
  // Authenticate with socket
  socket.emit('authenticate', {
    accessToken: accessToken,
    refreshToken: refreshToken
  });
  
  // Initialize Spotify Web Playback SDK
  if (window.Spotify) {
    initSpotifyPlayer();
  } else {
    window.onSpotifyWebPlaybackSDKReady = initSpotifyPlayer;
  }
}

// Initialize Spotify Player
function initSpotifyPlayer() {
  spotifyPlayer = new Spotify.Player({
    name: '24/7 Radio Station',
    getOAuthToken: cb => {
      cb(accessToken);
    },
    volume: 0.8
  });

  // Ready
  spotifyPlayer.addListener('ready', ({ device_id }) => {
    console.log('Ready with Device ID', device_id);
    deviceId = device_id;
    updateConnectionStatus('connected', 'Connected to Radio Station');
  });

  // Not Ready
  spotifyPlayer.addListener('not_ready', ({ device_id }) => {
    console.log('Device ID has gone offline', device_id);
    updateConnectionStatus('disconnected', 'Disconnected');
  });

  // Errors
  spotifyPlayer.addListener('initialization_error', ({ message }) => {
    console.error('Initialization Error:', message);
  });

  spotifyPlayer.addListener('authentication_error', ({ message }) => {
    console.error('Authentication Error:', message);
    localStorage.removeItem('spotify_access_token');
    localStorage.removeItem('spotify_refresh_token');
    location.reload();
  });

  spotifyPlayer.addListener('account_error', ({ message }) => {
    console.error('Account Error:', message);
    alert('Spotify Premium is required to use this radio station.');
  });

  // Connect player
  spotifyPlayer.connect();
}

// Socket events
socket.on('connect', () => {
  console.log('Connected to server');
  updateConnectionStatus('connected', 'Connected to Server');
});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
  updateConnectionStatus('disconnected', 'Disconnected from Server');
});

socket.on('authenticated', (data) => {
  console.log('Authenticated as:', data.username);
  usernameEl.textContent = data.username;
});

socket.on('auth-error', (data) => {
  console.error('Auth error:', data.message);
  alert('Authentication failed. Please login again.');
  localStorage.removeItem('spotify_access_token');
  localStorage.removeItem('spotify_refresh_token');
  location.reload();
});

// Socket.io listeners
socket.on('connect', () => {
  console.log('Connected to server');
});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
});

// Listen for radio updates from server
socket.on('radio-update', (radioState) => {
  console.log('📻 Radio update received:', radioState.currentSong.name);
  
  const newTrackId = radioState.currentSong.name + radioState.currentSong.artist;
  
  // Only update if it's a different song
  if (newTrackId !== currentTrackId) {
    currentTrackId = newTrackId;
    
    // Update UI
    if (trackName) trackName.textContent = radioState.currentSong.name;
    if (trackArtist) trackArtist.textContent = radioState.currentSong.artist;
    if (trackAlbum) trackAlbum.textContent = radioState.currentSong.album || '';
    if (albumArt && radioState.currentSong.albumArt) albumArt.src = radioState.currentSong.albumArt;
    
    // Calculate current position
    const elapsed = Date.now() - radioState.startedAt;
    const position = Math.floor(elapsed / 1000);
    
    // Start playing at synced position
    searchAndPlayYouTube(radioState.currentSong.name, radioState.currentSong.artist, position);
  }
});

socket.on('playback-update', (playback) => {
  console.log('Playback update:', playback);
  currentPlayback = playback;
  updateUI(playback);
  
  // Sync playback on Spotify player
  if (spotifyPlayer && deviceId && playback.track) {
    syncPlayback(playback);
  }
});

// Update UI with current track
function updateUI(playback) {
  if (!playback || !playback.track) {
    trackName.textContent = 'No track playing';
    trackArtist.textContent = 'Waiting for DJ...';
    trackAlbum.textContent = '';
    albumArt.src = 'https://via.placeholder.com/400?text=No+Track';
    return;
  }

  const track = playback.track;
  
  trackName.textContent = track.name;
  trackArtist.textContent = track.artist;
  trackAlbum.textContent = track.album;
  albumArt.src = track.albumArt || 'https://via.placeholder.com/400?text=No+Image';
  
  // Update progress
  updateProgress(playback);
}

// Update progress bar
function updateProgress(playback) {
  if (!playback || !playback.track) return;
  
  const duration = playback.track.duration;
  const progress = playback.progressMs;
  
  const percentage = (progress / duration) * 100;
  progressFill.style.width = `${percentage}%`;
  
  currentTimeEl.textContent = formatTime(progress);
  durationEl.textContent = formatTime(duration);
}

// Sync playback with Spotify
async function syncPlayback(playback) {
  if (!playback || !playback.track || !deviceId) return;
  
  try {
    const trackUri = playback.track.uri;
    const positionMs = playback.progressMs;
    
    // Calculate current position based on when update was sent
    const elapsed = Date.now() - playback.timestamp;
    const currentPosition = positionMs + elapsed;
    
    // Play track at correct position
    await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        uris: [trackUri],
        position_ms: currentPosition
      })
    });
    
    updateConnectionStatus('connected', '✓ Synced with Radio');
  } catch (error) {
    console.error('Error syncing playback:', error);
  }
}

// Play button click (manual sync)
playBtn.addEventListener('click', () => {
  if (currentPlayback) {
    syncPlayback(currentPlayback);
  } else {
    socket.emit('request-sync');
  }
});

// Update connection status
function updateConnectionStatus(status, message) {
  connectionStatus.textContent = message;
  connectionStatus.className = `connection-status ${status}`;
}

// Format time (ms to mm:ss)
function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Update progress continuously
setInterval(() => {
  if (currentPlayback && currentPlayback.isPlaying) {
    const elapsed = Date.now() - currentPlayback.timestamp;
    const currentProgress = currentPlayback.progressMs + elapsed;
    
    if (currentProgress <= currentPlayback.track.duration) {
      const percentage = (currentProgress / currentPlayback.track.duration) * 100;
      progressFill.style.width = `${percentage}%`;
      currentTimeEl.textContent = formatTime(currentProgress);
    }
  }
}, 100);

// Request sync every 30 seconds to stay in sync
setInterval(() => {
  if (accessToken && deviceId) {
    socket.emit('request-sync');
  }
}, 30000);
