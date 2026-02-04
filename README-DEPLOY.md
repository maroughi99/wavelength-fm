# Deploying Wavelength FM to Render

## Quick Deploy Steps:

1. **Push to GitHub** (if not already):
   ```bash
   git init
   git add .
   git commit -m "Initial commit - Wavelength FM"
   git branch -M main
   git remote add origin YOUR_GITHUB_REPO_URL
   git push -u origin main
   ```

2. **Deploy on Render**:
   - Go to https://render.com
   - Sign up/Sign in with GitHub
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Render will auto-detect the `render.yaml` config
   - Click "Create Web Service"

3. **Your app will be live at**:
   - `https://wavelength-fm.onrender.com` (or similar)

## Notes:
- Free tier: App sleeps after 15 min of inactivity (wakes on first request)
- No environment variables needed - API keys are in the code
- Socket.io will work automatically on Render

## Testing:
Once deployed, visit your Render URL and click "CLICK TO START LISTENING"
