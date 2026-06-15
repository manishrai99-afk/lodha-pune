# Lodha Pune | 24K Realtors

Professional real estate lead generation website for Lodha Pune projects, built for client acquisition, property shortlisting, and CRM-ready lead capture.

## Overview

This repository contains the complete front-end experience for `24K Realtors`, including:

- High-conversion lead form with budget and timeline qualification
- Featured project sections for Lodha Pune Hinjwadi
- Success stories, testimonials, FAQ, and incentive sections
- Supabase-compatible lead capture logic for real business leads
- Local preview server for development and QA

## Key Features

- **Lead capture form** with `name`, `phone`, `requirement`, `budget`, and `timeline`
- **Rich landing page** sections to drive trust and conversions
- **Tracking parameter collection** for UTM and source attribution
- **Direct Supabase REST integration** for lead storage
- **WhatsApp fallback** if database configuration is missing or fails

## Live Deployment

This project is optimized for static hosting. The deployed production site should deploy the root directory as a static site.

### Recommended deployment path

1. Connect this GitHub repository to Vercel.
2. Use the root directory as the deployment target.
3. Set the build step to none and deploy as a static site.
4. Configure the `SUPABASE_URL` and `SUPABASE_ANON_KEY` in runtime if needed.

## Repository Structure

- `index.html` — main landing page content
- `styles.css` — full site styling and responsive layout
- `script.js` — lead capture, tracking, and Supabase integration logic
- `server.js` — local preview server for development
- `CRM-DATABASE-SETUP.md` — Supabase database setup instructions
- `supabase-leads.sql` — SQL table schema for lead capture

## CRM Integration

Leads are saved to the `leads` table using the Supabase REST API.

The form includes standard CRM fields such as:

- `name`
- `phone`
- `requirement`
- `budget`
- `timeline`
- `lead_source`
- `lead_series`
- `utm_source`, `utm_medium`, `utm_campaign`, etc.
- `landing_page`
- `referrer`

## Local Development

Run the local preview server with:

```bash
node server.js
```

Then open `http://127.0.0.1:4173/` in your browser.

## Professional Notes

- This website is intentionally static for performance and reliability.
- `server.js` is only for local development and preview.
- Production deployment should use static hosting or Vercel Git integration.

## Deployment Documentation

See `VERCEL-DEPLOYMENT.md` for exact deployment configuration recommendations.
