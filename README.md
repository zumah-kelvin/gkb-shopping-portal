# GKB Technologies — Shopping Portal

Dedicated e-commerce and retail tech gadget store for browsing and ordering laptops, workstations, electronic gadgets, and hardware accessories.

## Features
- **Product Catalog**: Live inventory synced with Supabase, spec filtering (RAM, Storage, Brand), high-resolution photo previews.
- **Direct Order Placement**: Seamless checkout with pickup or delivery options.
- **MTN Mobile Money Guidance**: Clear payment instructions with account holder card (`0552117787`, `zumah kelvin🥳😍`).
- **Live Realtime Tracking**: Instant order status transitions (`pending` → `processing` → `delivered` / `picked_up`).
- **Admin Inventory Manager**: Add new devices with image uploads, specs, and pricing; archive or restore listings.

## Local Setup & Development

```bash
npm install
npm run dev
```

Build for production:
```bash
npm run build
npm run preview
```

## Environment Configuration (`.env`)
```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY
```

## Independent Netlify Deployment

1. Initialize git and push to a new GitHub repository:
   ```bash
   git init
   git add .
   git commit -m "Initial commit for GKB Shopping Portal"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/gkb-shopping-portal.git
   git push -u origin main
   ```
2. In the Netlify Dashboard:
   - Click **Add new site → Import an existing project**.
   - Select the `gkb-shopping-portal` GitHub repository.
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Add environment variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Click **Deploy Site**.
