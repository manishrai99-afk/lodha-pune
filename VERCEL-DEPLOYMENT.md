# Vercel Deployment Guide

This repository is ready to deploy as a static site on Vercel.

## Recommended Settings

- Framework Preset: `Other`
- Build Command: none
- Output Directory: `.`
- Root Directory: `/`

## Environment Variables

If you want to store Supabase keys securely in Vercel, use environment variables:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Then update `script.js` to read from environment variables during build, or use a small server-side function that injects the values into runtime.

## Live Deployment Steps

1. Sign in to Vercel.
2. Create a new project and import the GitHub repository `manishrai99-afk/lodha-pune`.
3. Confirm the root directory and static settings.
4. Deploy.
5. Use the project domain provided by Vercel or assign a custom domain.

## Notes

- The site is static; no build step is required.
- `server.js` is only for local preview and does not need to run on Vercel.
- If using Supabase in production, use secure environment variables and avoid exposing service-role keys in the client.
