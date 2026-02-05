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
const connectionStatus = document.getElementById('connection-status');
const usernameEl = document.getElementById('username');

// Last.fm Integration - Auto-connect
let LASTFM_API_KEY;
let YOUTUBE_API_KEY;
const lastfmUsername = 'maroughi99';
let updateInterval;
let youtubePlayer;
let currentTrackId = null;
let playerInitialized = false;
let currentSongStartTime = null; // Track when current song started
let pendingTrackSwitch = null; // Store next track to switch to
let requiresUserInteraction = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent); // Mobile detection
let hasUserInteracted = false;
let videoCache = {}; // Cache YouTube video IDs to save API quota

// Fetch API keys from server
fetch('/api/config')
  .then(res => res.json())
  .then(config => {
    LASTFM_API_KEY = config.lastfmApiKey;
    YOUTUBE_API_KEY = config.youtubeApiKey;
    console.log('✅ API keys loaded from server');
  })
  .catch(err => console.error('❌ Failed to load API keys:', err));

// Login button click
if (loginBtn) {
  loginBtn.addEventListener('click', () => {
    console.log('🎵 Start Listening button clicked!');
    hasUserInteracted = true;
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

// Show player
function showDemoPlayer() {
  console.log('📻 Showing player section...');
  
  if (!loginSection || !playerSection) {
    console.error('Required sections not found!');
    return;
  }
  
  const alreadyVisible = !playerSection.classList.contains('hidden');
  
  loginSection.classList.add('hidden');
  playerSection.classList.remove('hidden');
  
  console.log('✓ Player section is now visible');
  
  if (usernameEl) usernameEl.textContent = 'Guest';
  
  if (trackName) trackName.textContent = 'Loading...';
  if (trackArtist) trackArtist.textContent = 'Connecting to Radio Station';
  if (trackAlbum) trackAlbum.textContent = '';
  
  if (connectionStatus) {
    const statusText = connectionStatus.querySelector('.status-text');
    if (statusText) {
      statusText.textContent = 'Connecting...';
    }
  }
  
  animateVisualizer();
  
  if (alreadyVisible) {
    console.log('Returning user - forcing playback');
    currentTrackId = null;
    fetchNowPlaying();
  } else {
    console.log('First time loading - initializing...');
    initializeLastfm();
  }
}

// Animate visualizer bars
function animateVisualizer() {
  const bars = document.querySelectorAll('.visualizer .bar');
  bars.forEach((bar, index) => {
    setInterval(() => {
      const height = Math.random() * 60 + 20;
      bar.style.height = height + '%';
    }, 300 + (index * 100));
  });
}

// YouTube Player Setup
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
      playerVars: {
        'autoplay': 0,
        'controls': 1,
        'modestbranding': 1,
        'rel': 0,
        'fs': 1,
        'enablejsapi': 1,
        'playsinline': 1, // Required for iOS inline playback
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
  updatePlayerStatus('Ready - Fetching song...');
  
  // Immediately check for current song and play it
  if (!playerSection.classList.contains('hidden')) {
    console.log('Player ready and user is listening - fetching track immediately');
    syncWithRadioState();
    setTimeout(() => {
      console.log('Force fetching from Last.fm...');
      fetchNowPlaying();
    }, 500);
  }
}

function onPlayerStateChange(event) {
  console.log('Player state changed:', event.data);
  
  const states = {
    '-1': 'Unstarted',
    '0': 'Ended',
    '1': 'Playing',
    '2': 'Paused',
    '3': 'Buffering',
    '5': 'Video Cued'
  };
  updatePlayerStatus(states[event.data] || 'Unknown');
  
  // When song ends naturally, check for pending track switch or fetch next
  if (event.data === YT.PlayerState.ENDED) {
    console.log('Song ended naturally');
    if (pendingTrackSwitch) {
      console.log('Playing pending track:', pendingTrackSwitch.name);
      switchToTrack(pendingTrackSwitch);
      pendingTrackSwitch = null;
    } else {
      fetchNowPlaying();
    }
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
  updatePlayerStatus('Error: ' + errorMsg + ' - Trying alternative...');
  
  // If embedding not allowed (101/150), try to find an alternative
  if (event.data === 101 || event.data === 150 || event.data === 100) {
    console.log('Video cannot be embedded, searching for alternative...');
    // Wait a moment then retry Last.fm fetch to get alternative video
    setTimeout(() => {
      fetchNowPlaying();
    }, 2000);
  }
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
  if (!songName || !artistName) {
    console.error('Missing song or artist name');
    return;
  }
  
  const cacheKey = `${songName.toLowerCase()}-${artistName.toLowerCase()}`;
  
  // Check cache first to save API quota
  if (videoCache[cacheKey]) {
    console.log('💾 Using cached video for:', songName);
    const cachedVideoId = videoCache[cacheKey];
    
    if (youtubePlayer && youtubePlayer.loadVideoById) {
      console.log('📡 Loading cached video ID:', cachedVideoId);
      youtubePlayer.loadVideoById({
        videoId: cachedVideoId,
        startSeconds: startSeconds
      });
      
      setTimeout(() => {
        if (youtubePlayer.playVideo) {
          youtubePlayer.playVideo();
        }
      }, 1500);
    }
    return;
  }
  
  console.log('🔍 Searching YouTube API for:', songName, 'by', artistName);
  
  try {
    const searchStrategies = [
      `${artistName} ${songName} official audio`,
      `${artistName} ${songName} audio`,
      `${songName} ${artistName} official`,
      `${artistName} - ${songName}`
    ];
    
    console.log('Searching YouTube for:', songName, 'by', artistName, '| Start at:', startSeconds + 's');
    
    for (const strategy of searchStrategies) {
      const query = encodeURIComponent(strategy);
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${query}&type=video&videoCategoryId=10&videoEmbeddable=true&key=${YOUTUBE_API_KEY}&maxResults=5`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.error) {
        console.error('YouTube API Error:', data.error);
        return;
      }
      
      if (data.items && data.items.length > 0) {
        let bestMatch = null;
        let bestScore = 0;
        
        for (const item of data.items) {
          const title = item.snippet.title.toLowerCase();
          const channel = item.snippet.channelTitle.toLowerCase();
          const songLower = songName.toLowerCase();
          const artistLower = artistName.toLowerCase();
          
          if (title.includes('cover') && !songLower.includes('cover')) continue;
          if (title.includes('remix') && !songLower.includes('remix')) continue;
          if (title.includes('live') && !songLower.includes('live')) continue;
          if (title.includes('karaoke')) continue;
          if (title.includes('instrumental') && !songLower.includes('instrumental')) continue;
          
          let score = 0;
          
          // Very high priority: Topic channels (auto-generated, always embeddable)
          if (channel.includes('topic')) {
            score += 20;
          } else if (channel.includes('vevo') || channel.includes('official')) {
            score += 10;
          }
          
          if (title.includes(songLower) && title.includes(artistLower)) {
            score += 8;
          } else if (title.includes(songLower) || title.includes(artistLower)) {
            score += 3;
          }
          
          if (title.includes('official')) score += 5;
          if (title.includes('audio')) score += 3;
          
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
          
          // Cache the video ID to save API quota
          videoCache[cacheKey] = videoId;
          console.log('💾 Cached video ID for future use');
          
          updateCurrentVideo(videoTitle);
          
          if (!playerInitialized || !youtubePlayer || !youtubePlayer.loadVideoById) {
            console.error('⚠️ YouTube player not ready! Will retry when player initializes...');
            updatePlayerStatus('Waiting for player...');
            setTimeout(() => searchAndPlayYouTube(songName, artistName, startSeconds), 2000);
            return;
          }
          
          if (youtubePlayer && youtubePlayer.loadVideoById) {
            console.log('📡 Loading video ID:', videoId, '| Starting at:', startSeconds + 's');
            youtubePlayer.loadVideoById({
              videoId: videoId,
              startSeconds: startSeconds
            });
            
            setTimeout(() => {
              if (youtubePlayer.playVideo) {
                console.log('▶️ Playing video...');
                youtubePlayer.playVideo().then(() => {
                  console.log('✅ Playback started successfully');
                }).catch(err => {
                  console.log('⚠️ Autoplay blocked, will try on next user interaction');
                });
              }
            }, 1500);
          }
          
          return;
        }
      }
    }
    
    console.log('No suitable match found for:', songName, 'by', artistName);
  } catch (error) {
    console.error('Error searching YouTube:', error);
  }
}

// Initialize Last.fm
function initializeLastfm() {
  console.log('Initializing Last.fm sync...');
  syncWithRadioState();
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
      
      if (trackName) trackName.textContent = state.song.name;
      if (trackArtist) trackArtist.textContent = state.song.artist;
      if (trackAlbum) trackAlbum.textContent = state.song.album || '';
      if (albumArt && state.song.albumArt) albumArt.src = state.song.albumArt;
      
      const statusText = connectionStatus.querySelector('.status-text');
      if (statusText) {
        statusText.textContent = '📡 Synced with Radio';
      }
      
      currentTrackId = state.song.name + state.song.artist;
      searchAndPlayYouTube(state.song.name, state.song.artist, state.position);
    } else {
      console.log('No song currently playing on the radio - will check Last.fm');
    }
  } catch (error) {
    console.error('Error syncing with radio:', error);
  }
}

function startLastfmSync() {
  if (updateInterval) {
    clearInterval(updateInterval);
  }
  
  fetchNowPlaying();
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
      
      // Get album art
      let albumArtUrl = null;
      const images = track.image;
      if (images && images.length > 0) {
        const largeImage = images.find(img => img.size === 'extralarge') || images[images.length - 1];
        if (largeImage && largeImage['#text']) {
          albumArtUrl = largeImage['#text'];
        }
      }
      
      const isPlaying = track['@attr'] && track['@attr'].nowplaying === 'true';
      
      // On initial load (no currentTrackId), play whatever Last.fm shows
      const isInitialLoad = !currentTrackId;
      
      if ((isPlaying || isInitialLoad) && trackId !== currentTrackId) {
        // Check if we should switch immediately (initial load or nothing playing) or queue it
        const isPlayerPlaying = youtubePlayer && 
                               youtubePlayer.getPlayerState && 
                               youtubePlayer.getPlayerState() === 1;
        
        if (isInitialLoad || !isPlayerPlaying) {
          // Initial load or current song not playing - switch immediately
          console.log(isInitialLoad ? 'Initial load - starting track:' : 'No song playing - switching to:', track.name);
          currentTrackId = trackId;
          currentSongStartTime = Date.now();
          pendingTrackSwitch = null;
          
          // Update UI when actually playing
          if (trackName) trackName.textContent = track.name;
          if (trackArtist) trackArtist.textContent = track.artist['#text'] || track.artist;
          if (trackAlbum) trackAlbum.textContent = track.album['#text'] || 'Album';
          if (albumArt && albumArtUrl) albumArt.src = albumArtUrl;
          
          fetch('/api/update-radio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              song: track.name,
              artist: track.artist['#text'] || track.artist,
              album: track.album['#text'],
              albumArt: albumArtUrl,
              duration: 180000
            })
          });
          
          searchAndPlayYouTube(track.name, track.artist['#text'] || track.artist, 0);
        } else {
          // Song is currently playing - queue the new track
          console.log('🎵 Queuing next track:', track.name, '(letting current song finish)');
          pendingTrackSwitch = {
            name: track.name,
            artist: track.artist['#text'] || track.artist,
            album: track.album['#text'],
            albumArt: albumArtUrl,
            trackId: trackId
          };
        }
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

// Switch to a new track
function switchToTrack(trackInfo) {
  currentTrackId = trackInfo.trackId;
  currentSongStartTime = Date.now();
  
  if (trackName) trackName.textContent = trackInfo.name;
  if (trackArtist) trackArtist.textContent = trackInfo.artist;
  if (trackAlbum) trackAlbum.textContent = trackInfo.album || 'Album';
  if (trackInfo.albumArt && albumArt) albumArt.src = trackInfo.albumArt;
  
  fetch('/api/update-radio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      song: trackInfo.name,
      artist: trackInfo.artist,
      album: trackInfo.album,
      albumArt: trackInfo.albumArt,
      duration: 180000
    })
  });
  
  searchAndPlayYouTube(trackInfo.name, trackInfo.artist, 0);
}

// Show mobile tap-to-play overlay
function showMobileTapToPlay() {
  // Check if overlay already exists
  if (document.getElementById('mobile-play-overlay')) return;
  
  const overlay = document.createElement('div');
  overlay.id = 'mobile-play-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(10, 14, 39, 0.95);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    backdrop-filter: blur(10px);
  `;
  
  const button = document.createElement('button');
  button.innerHTML = `
    <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z"/>
    </svg>
    <div style="margin-top: 16px; font-size: 18px; font-weight: 600;">TAP TO PLAY</div>
  `;
  button.style.cssText = `
    background: linear-gradient(135deg, #00d4ff, #7b2ff7);
    border: none;
    color: white;
    padding: 32px 48px;
    border-radius: 24px;
    font-size: 24px;
    font-weight: bold;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    font-family: 'Poppins', sans-serif;
    box-shadow: 0 8px 32px rgba(0, 212, 255, 0.3);
  `;
  
  button.onclick = () => {
    hasUserInteracted = true;
    if (youtubePlayer && youtubePlayer.playVideo) {
      youtubePlayer.playVideo();
    }
    overlay.remove();
  };
  
  overlay.appendChild(button);
  document.body.appendChild(overlay);
}

// Socket events
socket.on('connect', () => {
  console.log('Connected to server');
});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
});

socket.on('radio-update', (radioState) => {
  console.log('📻 Radio update received:', radioState.currentSong.name);
  
  const newTrackId = radioState.currentSong.name + radioState.currentSong.artist;
  
  if (newTrackId !== currentTrackId) {
    currentTrackId = newTrackId;
    
    if (trackName) trackName.textContent = radioState.currentSong.name;
    if (trackArtist) trackArtist.textContent = radioState.currentSong.artist;
    if (trackAlbum) trackAlbum.textContent = radioState.currentSong.album || '';
    if (albumArt && radioState.currentSong.albumArt) albumArt.src = radioState.currentSong.albumArt;
    
    const elapsed = Date.now() - radioState.startedAt;
    const position = Math.floor(elapsed / 1000);
    
    searchAndPlayYouTube(radioState.currentSong.name, radioState.currentSong.artist, position);
  }
});

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then((registration) => {
        console.log('✅ PWA: Service Worker registered', registration.scope);
      })
      .catch((error) => {
        console.log('❌ PWA: Service Worker registration failed', error);
      });
  });
}
