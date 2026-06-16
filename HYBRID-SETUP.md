# Hybrid Lead System - Google Form + Local Backup

## Overview

The Lodha Pune website now uses a **hybrid approach** for lead capture:

1. **Local Storage** (Primary) - Always works, no server needed
2. **Google Form** (Optional Backup) - Cloud backup if configured

**No Supabase, No databases, No server complexity. Just pure local + optional cloud.**

---

## How It Works

```
User fills form (name, phone, requirement, budget, timeline)
  ↓
Form submits → script.js
  ↓
✓ Automatically saved to browser localStorage
  ↓
If Google Form URL configured:
  → Also submit to Google Form (backup)
  ↓
✓ All set! No server required.
```

---

## Features

### ✅ Local Storage (हमेशा काम करता है)
- Form data automatically saved to browser
- Works **completely offline**
- No setup required
- Fast and reliable
- Visitor can close browser, data stays

### ✅ CSV Export (डाउनलोड करो)
- Visit `/export.html`
- See all saved leads in a table
- Click "📥 Export as CSV"
- Open in Excel / Google Sheets
- Share with team

### ✅ Google Form (Optional)
- Automatic cloud backup (if configured)
- Google Sheets syncing
- Email notifications
- Team collaboration

### ✅ Console Tools (Developer)
```javascript
// Browser console में:
window.leadTools.exportCSV()   // CSV download
window.leadTools.viewAll()     // देख all leads
window.leadTools.count()       // कितने leads
window.leadTools.lastLead()    // आखरी lead
```

---

## Setup Instructions

### Option 1: Local Only (बस यह करो)

**No setup needed!** The form automatically saves locally.

```javascript
// script.js में:
const GOOGLE_FORM_URL = ""; // खाली रखो
```

Users can:
1. Fill form → Submit
2. Visit `/export.html` → Download CSV
3. Done! ✓

### Option 2: Add Google Form Backup

**1. Create Google Form**
- Go to [forms.google.com](https://forms.google.com)
- Create new form
- Add fields: Name, Phone, Requirement, Budget, Timeline
- Get submission URL

**2. Find Form Entry IDs**
- Open form → Click 3 dots → Script editor
- Or inspect form HTML to find `entry.XXXXXX` IDs
- Note down each field's entry ID

**3. Update script.js**

```javascript
// script.js में:
const GOOGLE_FORM_URL = "https://docs.google.com/forms/d/e/{FORM_ID}/formResponse";
const GOOGLE_FORM_FIELDS = {
  name: "entry.1234567890",      // Replace with your ID
  phone: "entry.0987654321",
  requirement: "entry.1111111111",
  budget: "entry.2222222222",
  timeline: "entry.3333333333"
};
```

**4. Test**
- Fill form
- Check Google Sheet linked to form
- Lead should appear there

---

## CSV Export Format

When you export from `/export.html`, you get:

```csv
"Saved At","Name","Phone","Requirement","Budget","Timeline","Lead Source"
"2026-06-16T14:30:00Z","Rajesh Kumar","9876543210","2BHK Flat","₹1.2 Cr - ₹1.8 Cr","3-6 months","website"
"2026-06-16T14:35:15Z","Priya Sharma","9876543211","Buy a home","₹1.8 Cr - ₹2.5 Cr","Within 1 month","google"
```

Perfect for importing to:
- Excel
- Google Sheets
- CRM (Salesforce, HubSpot, Pipedrive)
- Any spreadsheet tool

---

## Technical Details

### Local Storage
- **Storage Key**: `lodha_pune_leads`
- **Format**: JSON array
- **Limit**: ~5-10MB per domain
- **Persistence**: Permanent (until cleared)
- **Security**: Browser-only, not transmitted

### Google Form
- **Method**: POST with FormData
- **Mode**: no-cors (bypasses CORS)
- **Fallback**: If fails, local save still succeeds
- **Non-blocking**: Won't break form if Google fails

### No Dependencies
- ✅ Zero server code
- ✅ Zero databases
- ✅ Zero API keys in client
- ✅ Works offline
- ✅ No build step
- ✅ Pure vanilla JavaScript

---

## Console Commands (Developer)

```javascript
// View all leads
window.leadTools.viewAll()

// Export as CSV
window.leadTools.exportCSV()

// Count leads
window.leadTools.count()

// Get last submitted lead
window.leadTools.lastLead()

// Delete all leads (careful!)
window.leadTools.clearAll()
```

---

## Troubleshooting

### "No local leads saved yet"
- ✓ This is good! All submissions went to Google Form (cloud)
- If you want local backup: Check if localStorage is disabled

### CSV won't open in Excel
- Try Google Sheets instead
- Or open in Notepad → Save As CSV

### Google Form not receiving data
- Verify GOOGLE_FORM_URL is correct
- Check form entry IDs match your form
- Inspect console for errors
- **Local save still works!** Google Form is optional

### Leads disappeared
- Browser cleared localStorage?
- Check browser settings
- Consider regular exports

---

## Migration from Supabase

If migrating from Supabase:

### 1. Export old Supabase leads
```bash
# From Supabase table, export as CSV
# Download the file
```

### 2. Import to Google Sheets
```
Google Sheets → File → Import → Upload CSV
```

### 3. Going forward
```
New leads → localStorage
Export → CSV whenever needed
Upload to Google Sheets manually
```

---

## Best Practices

### For Developers
1. **Regular exports** - Don't accumulate leads in localStorage
2. **Weekly backup** - Export CSV and save locally
3. **Monitor count** - Check `window.leadTools.count()` 
4. **Test offline** - Disconnect internet, verify form saves

### For Users
1. **Share CSV** - Export and share with team
2. **Manual entry** - Upload to your CRM
3. **Backup locally** - Save CSV files regularly

---

## Why This Approach?

✅ **Simplicity** - No server, no database, no complexity  
✅ **Privacy** - Leads stay in browser until exported  
✅ **Reliability** - Always saves locally, no network needed  
✅ **Flexibility** - Use Google Form, Excel, or manual entry  
✅ **Cost** - Free tier everything  
✅ **Speed** - No network delays  

---

## Limitations & Workarounds

| Limitation | Workaround |
|-----------|-----------|
| No automatic notifications | Check CSV weekly |
| No lead scoring | Add manually in spreadsheet |
| No CRM integration | Use CSV import in CRM |
| Storage per device | Export regularly |
| Manual sync needed | Use Google Sheets |

---

## Security

✅ **No API keys** in client code  
✅ **No passwords** needed  
✅ **No server vulnerabilities**  
✅ **No data breaches** (data stays local until exported)  
✅ **HTTPS only** in production  

---

## Future Enhancements

- [ ] Automatic Google Sheets sync
- [ ] Email notifications via Zapier
- [ ] Lead filtering & search
- [ ] Notes field for follow-ups
- [ ] Bulk export with archive
- [ ] Auto-backup to cloud
- [ ] WhatsApp integration

---

## Support

**Local issues?**
- Check `/export.html`
- Open DevTools console
- Run `window.leadTools.viewAll()`

**Google Form issues?**
- Verify entry IDs
- Check form submission URL
- Review form settings

**Need help?**
- WhatsApp: +91 9673 000 053
- Contact: 24K Realtors

---

**System Status**: ✅ Production Ready  
**Last Updated**: June 16, 2026  
**Dependencies**: Zero (vanilla JavaScript)
