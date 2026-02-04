# 🎵 24/7 Spotify Radio Station

A synchronized radio station powered by Spotify that allows multiple users to listen together in real-time. Think of it like your own personal SiriusXM, but powered by Spotify!

## Features

- **Synchronized Playback**: All listeners hear the same track at the same time
- **Real-time Updates**: Automatic track changes and progress synchronization
- **Beautiful UI**: Modern, responsive radio player interface
- **Spotify Integration**: Uses official Spotify Web API and SDK
- **24/7 Streaming**: Runs continuously based on a DJ account's playback

## Prerequisites

- **Node.js** (v14 or higher)
- **Spotify Premium Account** (required for both DJ and listeners)
- **Spotify Developer Account** (to get API credentials)

## Setup Instructions

### 1. Get Spotify API Credentials

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Log in or create an account
3. Click "Create an App"
4. Fill in the details:
   - App name: "My Radio Station" (or whatever you prefer)
   - App description: "24/7 synchronized radio"
5. Once created, you'll see your **Client ID** and **Client Secret**
6. Click "Edit Settings"
7. Add `http://localhost:3000/callback` to **Redirect URIs**
8. Click "Save"

### 2. Install Dependencies

Open terminal in the project folder and run:

```bash
npm install
```

### 3. Configure Environment Variables

1. Copy the `.env.example` file to `.env`:
   ```bash
   copy .env.example .env
   ```

2. Edit the `.env` file and add your Spotify credentials:
   ```env
   SPOTIFY_CLIENT_ID=your_client_id_here
   SPOTIFY_CLIENT_SECRET=your_client_secret_here
   SPOTIFY_REDIRECT_URI=http://localhost:3000/callback
   PORT=3000
   ```

### 4. Set Up DJ Account

The DJ account controls what plays on the radio station.

1. Start the server:
   ```bash
   npm start
   ```

2. Open your browser and go to:
   ```
   http://localhost:3000/dj-login
   ```

3. Log in with the Spotify account you want to use as the DJ (the account that will control what plays)

4. After logging in, you'll see a refresh token. Copy it.

5. Add the refresh token to your `.env` file:
   ```env
   DJ_REFRESH_TOKEN=your_refresh_token_here
   ```

6. Restart the server

### 5. Start Broadcasting

1. Make sure the server is running (`npm start`)

2. On the DJ Spotify account:
   - Open Spotify (desktop app, web, or mobile)
   - Start playing music from any playlist
   - Keep it playing!

3. The radio station will now broadcast whatever the DJ account is playing

### 6. Listeners Tune In

1. Share your radio URL with friends: `http://localhost:3000`
   (or your public URL if you deploy it)

2. Listeners click "Login with Spotify"

3. They log in with their own Spotify Premium accounts

4. They'll automatically hear what the DJ is playing, synchronized!

## Usage

### For the DJ:
- Just play music on your Spotify account (any device)
- Whatever you play will be broadcast to all listeners
- You can change songs, playlists, etc. - listeners will follow

### For Listeners:
- Click "Login with Spotify" on the website
- Once logged in, playback syncs automatically
- If sync drifts, click the play button to resync
- Control volume using your Spotify app

## Deployment (Optional)

To make your radio accessible from anywhere:

### Option 1: Deploy to Heroku

1. Install Heroku CLI
2. Create a new Heroku app:
   ```bash
   heroku create my-radio-station
   ```
3. Set environment variables:
   ```bash
   heroku config:set SPOTIFY_CLIENT_ID=your_client_id
   heroku config:set SPOTIFY_CLIENT_SECRET=your_secret
   heroku config:set SPOTIFY_REDIRECT_URI=https://your-app.herokuapp.com/callback
   heroku config:set DJ_REFRESH_TOKEN=your_dj_token
   ```
4. Deploy:
   ```bash
   git push heroku main
   ```

### Option 2: Deploy to Vercel/Netlify

You'll need to set up environment variables in their dashboard and ensure WebSocket support.

## Troubleshooting

### "Spotify Premium Required" error
- All users (DJ and listeners) need Spotify Premium
- Free accounts cannot use the Web Playback SDK

### Playback not syncing
- Click the play button to manually resync
- Make sure the DJ account is actively playing music
- Check that both DJ and listener have stable internet

### DJ Setup Issues
- Make sure you completed the `/dj-login` step
- Verify the `DJ_REFRESH_TOKEN` is in your `.env` file
- Restart the server after adding the token

### "Authentication Failed"
- Your access token may have expired
- Click logout and log in again
- Clear localStorage and try again

## Technical Details

- **Backend**: Node.js + Express
- **Real-time**: Socket.io for WebSocket connections
- **Authentication**: OAuth 2.0 (Authorization Code Flow)
- **Frontend**: Vanilla JavaScript + Spotify Web Playback SDK

## Limitations

- Requires Spotify Premium for all users
- Cannot broadcast to non-Spotify users (licensing restrictions)
- Playback is individual (each user streams from their account)
- May experience slight sync drift over long periods

## License

MIT

## Credits

Built with love using the Spotify Web API ❤️🎵
