# Vercel Deployment Guide for Hornbach Logistics App

## Automatic Deployment via GitHub (Recommended - Easiest)

### Step 1: Connect GitHub to Vercel
1. Go to https://vercel.com/login
2. Sign in with your GitHub account
3. Click "Add New..." → "Project"
4. Import your repository: `SanorSmith/Hornbach-Logistic-app-`

### Step 2: Configure Project Settings
- **Framework Preset:** Vite
- **Root Directory:** `frontend`
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Install Command:** `npm install`

### Step 3: Add Environment Variables
In the Vercel project settings, add these environment variables:

```
VITE_SUPABASE_URL=https://tgrgqulnmwgcowlrrkfv.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRncmdxdWxubXdnY293bHJya2Z2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyMjkyMzUsImV4cCI6MjA4NzgwNTIzNX0.ZSEz2OD0qyui0vGqd92Wrn8EB1VIMi8FuBDWDIqqLV4
```

### Step 4: Deploy
Click "Deploy" and wait for the build to complete.

### Your Deployment URLs
- Production: `hornbachlogisticapp.vercel.app`
- Preview: `hornbachlogisticapp-git-main-samiths-projects-9b2b167d.vercel.app`

---

## Manual CLI Deployment (Alternative)

If you prefer using the CLI:

### Step 1: Install Vercel CLI
```bash
npm install -g vercel
```

### Step 2: Login
```bash
vercel login
```

### Step 3: Deploy
```bash
cd "G:\Windsurf Workspace\GMLG\frontend"
vercel --prod
```

### Step 4: Answer Prompts
- Set up and deploy? **Y**
- Which scope? **Select your account**
- Link to existing project? **Y** (if exists) or **N**
- Project name? **hornbachlogisticapp**
- Override settings? **N**

---

## What's Already Configured

✅ `vercel.json` - Vercel configuration with build settings
✅ `netlify.toml` - Netlify configuration (backup)
✅ Environment variables - Pre-configured in vercel.json
✅ Build settings - Optimized for Vite + React
✅ Routing - SPA routing configured
✅ GitHub repository - All code pushed and ready

---

## Troubleshooting

### Build Fails
- Check that Node.js version is 18 or higher
- Ensure all dependencies are in package.json
- Verify environment variables are set correctly

### App Loads but Shows Errors
- Check browser console for errors
- Verify Supabase URL and anon key are correct
- Check that RLS policies are properly configured in Supabase

### Deployment Succeeds but Page is Blank
- Check that `dist` folder is being generated
- Verify `index.html` exists in dist after build
- Check Vercel build logs for any warnings

---

## Next Steps After Deployment

1. Test all features on the deployed app
2. Set up custom domain (if needed)
3. Enable automatic deployments for future git pushes
4. Monitor deployment logs and analytics in Vercel dashboard

**Deployment is ready! Just follow the GitHub integration steps above.** 🚀
