# Deploy to Vercel Guide

## Prerequisites

1. Install Vercel CLI: `npm i -g vercel`
2. Login to Vercel: `vercel login`

## Deploy Steps

1. **Build the project locally to test:**
   ```bash
   npm run build
   ```

2. **Deploy to Vercel:**
   ```bash
   vercel
   ```

3. **For production deployment:**
   ```bash
   vercel --prod
   ```

## Important Notes

### Environment Variables
Set these environment variables in Vercel dashboard:
- `NODE_ENV=production`
- `CORS_ORIGIN=*` (or your specific domains)
- Any other environment variables your app needs

### Puppeteer Configuration
- The app is configured to work with Vercel's serverless functions
- Browser pool size is reduced to 1 for Vercel environment
- Puppeteer is configured with `--single-process` flag for Vercel

### Limitations
- Function timeout is set to 30 seconds (Vercel's maximum)
- Memory usage is optimized for serverless environment
- No persistent browser instances between requests

### Troubleshooting

If you encounter Puppeteer issues on Vercel:
1. Make sure `puppeteer-core` is in dependencies
2. Consider using chrome-aws-lambda for better Vercel compatibility:
   ```bash
   npm install chrome-aws-lambda
   ```

### Local Development
The app still works locally with full browser pooling:
```bash
npm run start:dev
```