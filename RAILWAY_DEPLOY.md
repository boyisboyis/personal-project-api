# Railway Deployment Guide

## Prerequisites
1. Create account at [Railway.app](https://railway.app)
2. Install Railway CLI: `npm install -g @railway/cli`
3. Login: `railway login`

## Deploy Steps

### 1. Connect to Railway
```bash
railway login
```

### 2. Create new project
```bash
railway init
```
- Choose "Deploy from GitHub repo" or "Empty project"
- Select your repository or upload

### 3. Environment Variables
Set these in Railway dashboard or via CLI:

```bash
# Required
railway variables set NODE_ENV=production
railway variables set PORT=3000

# Optional (customize as needed)
railway variables set CORS_ORIGIN=*
railway variables set PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
railway variables set PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Your app-specific variables (if any)
# railway variables set JWT_SECRET=your-secret-here
```

### 4. Deploy
```bash
railway up
```

### 5. Check deployment
```bash
railway status
railway logs
```

## Railway Configuration

- **Region**: Singapore (select in Railway dashboard)
- **Memory**: 1GB (adjustable)
- **CPU**: Shared (upgradeable)
- **Build**: Docker-based
- **Health Check**: `/api/v1/health`

## Custom Domain (Optional)
1. Go to Railway dashboard
2. Select your service
3. Go to "Settings" → "Domains"
4. Add your custom domain

## Monitoring
- Railway provides built-in metrics
- View logs: `railway logs --follow`
- Check health: `https://your-app.railway.app/api/v1/health`

## Scaling
- Auto-scaling available in Railway Pro
- Manual scaling via dashboard
- Resource usage monitoring included

## Cost Estimation
- **Starter**: $5/month (512MB RAM)
- **Pro**: $20/month (8GB RAM, priority support)
- Additional usage-based pricing for compute and bandwidth