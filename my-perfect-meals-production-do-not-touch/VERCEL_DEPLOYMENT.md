# Vercel Deployment Guide - My Perfect Meals

This guide walks you through deploying the **frontend** to Vercel while keeping the **backend** on Render.

## 🎯 Architecture Overview

After migration:
- **Frontend (React/Vite)**: Hosted on Vercel at `myperfectmeals.com`
- **Backend (Express/Node)**: Hosted on Render at `api.myperfectmeals.com`
- **Database (NeonDB)**: Connected to Render backend

## ✅ Pre-Migration Checklist

Your codebase is now **Vercel-ready** with these changes:

1. ✅ `vercel.json` - Vercel build configuration
2. ✅ `client/.env.example` - API URL template
3. ✅ Updated CORS in `server/index.ts` - Accepts Vercel domains
4. ✅ Updated API client - Uses `VITE_API_URL` environment variable
5. ✅ `.gitignore` - Excludes Vercel files from Git

## 📋 Step-by-Step Deployment

### Step 1: Set Up Vercel Account

1. Go to [vercel.com](https://vercel.com)
2. Sign up or log in with your GitHub account
3. Grant Vercel access to your repository

### Step 2: Create New Vercel Project

1. Click "Add New Project" in Vercel dashboard
2. Import your GitHub repository (`myperfectmeals`)
3. Configure build settings:
   - **Framework Preset**: Vite
   - **Root Directory**: `client`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

### Step 3: Add Environment Variables

In Vercel project settings → Environment Variables, add:

```
VITE_API_URL=https://api.myperfectmeals.com
```

**Important**: Replace `api.myperfectmeals.com` with your actual Render backend domain.

### Step 4: Deploy

1. Click "Deploy" button
2. Wait for build to complete (~2-3 minutes)
3. Vercel will provide a preview URL: `https://your-project.vercel.app`

### Step 5: Configure Custom Domain

1. In Vercel dashboard → Settings → Domains
2. Add domain: `myperfectmeals.com`
3. Vercel will show DNS configuration instructions

### Step 6: Update DNS Settings (GoDaddy)

**For Main Domain (`myperfectmeals.com`):**

Go to GoDaddy DNS management and update:

| Type  | Name | Value                  | TTL  |
|-------|------|------------------------|------|
| CNAME | www  | cname.vercel-dns.com   | 600  |
| A     | @    | 76.76.21.21            | 600  |

**For API Subdomain (`api.myperfectmeals.com`):**

Keep pointing to your Render backend (existing setup).

### Step 7: Update Render Backend Environment Variables

In Render dashboard, add/update:

```
CORS_ORIGIN=https://myperfectmeals.com,https://www.myperfectmeals.com
APP_ORIGIN=https://myperfectmeals.com
```

### Step 8: Verify Deployment

1. **Visit**: `https://myperfectmeals.com`
2. **Open DevTools** → Console
3. **Check API calls**: Should go to `api.myperfectmeals.com`
4. **Test features**:
   - Login/signup
   - Save biometrics
   - Create a meal
   - Check PWA update detection

### Step 9: Test PWA Updates

1. **Make a small change** (e.g., change text in `MainDashboard.tsx`)
2. **Push to Git**: `git push`
3. **Vercel auto-deploys** within 30-60 seconds
4. **Open PWA on iPhone**: Should see update banner automatically
5. **Click "Update"**: New version loads instantly

## 🚀 Benefits You'll See

✅ **Instant Updates**: Changes appear in <1 minute (vs 5+ minutes on Render)  
✅ **No Cache Issues**: Vercel purges CDN cache automatically  
✅ **Global CDN**: Faster load times worldwide  
✅ **Auto SSL**: Free HTTPS certificates  
✅ **Preview Deployments**: Every Git branch gets a preview URL  

## 🔄 Continuous Deployment

After initial setup, deployments are automatic:

1. **You push code**: `git push`
2. **Vercel detects change**: Automatically
3. **Vercel builds & deploys**: ~1-2 minutes
4. **Users get update**: Instantly via PWA update banner

## 🛠️ Troubleshooting

### API Calls Failing (CORS Errors)

**Check**:
1. Render backend has correct `CORS_ORIGIN` environment variable
2. `VITE_API_URL` in Vercel matches your Render API domain

**Fix**: Add missing domain to Render's `CORS_ORIGIN`

### PWA Not Updating

**Check**:
1. Service worker cache headers in `vercel.json` (already configured)
2. Version.json is being regenerated on build

**Fix**: Clear browser cache, reinstall PWA

### Build Fails

**Check**:
1. Root directory is set to `client`
2. All dependencies are in `client/package.json`

**Fix**: Run `cd client && npm install` locally first

## 📊 Rollback Plan

If something goes wrong, you can instantly revert:

1. **Keep Render frontend running** (don't disable it until Vercel is confirmed working)
2. **DNS rollback**: Point domain back to Render in GoDaddy
3. **Propagation**: DNS changes take 5-60 minutes

## 🎉 Success Checklist

Once deployed, verify:

- [ ] `myperfectmeals.com` loads frontend from Vercel
- [ ] API calls successfully reach `api.myperfectmeals.com` (Render)
- [ ] Login/signup works
- [ ] Database operations work (save biometrics, meals, etc.)
- [ ] PWA installs on mobile
- [ ] Push a test change → Users see update banner within 60 seconds
- [ ] No CORS errors in browser console

## 📞 Support

If you encounter issues during migration, check:
1. Vercel build logs
2. Render backend logs
3. Browser console errors

---

**Ready to deploy?** Follow the steps above and your app will be live on Vercel with instant updates! 🚀
