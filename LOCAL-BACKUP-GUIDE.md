# Local Lead Backup & Export Guide

## Overview

The Lodha Pune website includes automatic local backup functionality to ensure **no leads are ever lost**, even if the cloud database is temporarily unavailable or the connection fails.

When a lead submission cannot be saved to Supabase, it is automatically saved to the visitor's browser storage and can be exported anytime as an Excel/CSV file for manual CRM entry.

---

## How It Works

### Save Hierarchy

The form submission follows this priority:

```
1. Try /api/leads-proxy (server-side Supabase)
   └─ Success? → Saved to cloud ✓
   
2. Proxy fails → Try direct Supabase (if anon key configured)
   └─ Success? → Saved to cloud ✓
   
3. Both fail → Save to browser localStorage
   └─ Saved locally ✓
   └─ Show: "Enquiry saved locally. Our team will sync and contact you."
   
4. Open WhatsApp fallback (if no database configured)
   └─ User can message directly
```

### Local Storage Details

- **Storage Key**: `lodha_pune_leads` (in browser localStorage)
- **Data Persisted**: 
  - Lead details (name, phone, requirement, budget, timeline)
  - Tracking data (UTM params, referrer, landing page)
  - Timestamp of when lead was saved locally
  - Unique local ID for tracking
- **Capacity**: ~5-10 MB per domain (browser dependent)
- **Persistence**: Survives page refreshes, stays until cleared
- **Security**: Stored only in visitor's browser (not transmitted)

---

## For Website Visitors

### If "Enquiry saved locally" Message Appears

1. **Your enquiry is still saved** — it was stored on your device
2. **Share the CSV export**: 
   - Click the footer link "View locally saved leads"
   - Click "📥 Export as CSV"
   - Save the file to your device
   - Share the file or leads with 24K Realtors via WhatsApp

3. **Contact us directly**: 
   - WhatsApp: **+91 9673 000 053**
   - Phone: **+91 9673 000 053**
   - Mention that you submitted the form (we'll verify and process manually)

---

## For Website Administrators & Developers

### Export Locally Saved Leads

#### Method 1: Web Interface (Easiest)
1. Open `https://lodha-pune.vercel.app/export.html`
2. View all locally saved leads in a table
3. Click "📥 Export as CSV" to download as Excel file
4. Open in Excel, Google Sheets, or your CRM
5. Manually import or sync to Supabase

#### Method 2: Browser Console (Developer)
1. Open any page on the site
2. Press `Ctrl+Shift+J` (DevTools Console)
3. Use these commands:

```javascript
// View all locally saved leads
window.leadTools.viewAll()

// Export as CSV
window.leadTools.exportCSV()

// Count total saved leads
window.leadTools.count()

// Clear all local leads (use with caution!)
window.leadTools.clearAll()
```

#### Method 3: Direct localStorage Access
```javascript
// View raw JSON data
JSON.parse(localStorage.getItem("lodha_pune_leads"))

// Manual export (if needed)
const leads = JSON.parse(localStorage.getItem("lodha_pune_leads") || "[]");
console.table(leads); // View in formatted table
```

### CSV Format

When exported, the CSV contains these columns:

| Column | Description |
|--------|-------------|
| Saved At | ISO timestamp of submission |
| Name | Visitor's full name |
| Phone | Contact phone number |
| Requirement | Property type (2BHK, Buy, Sell, etc.) |
| Budget | Budget range |
| Timeline | Move-in or action timeframe |
| Lead Source | UTM source or "website" |
| Lead Series | Campaign name or "website" |

**Example CSV**:
```
"Saved At","Name","Phone","Requirement","Budget","Timeline","Lead Source","Lead Series"
"2026-06-16T14:30:00Z","Rajesh Kumar","9876543210","2BHK Flat","₹1.2 Cr - ₹1.8 Cr","3-6 months","website","website"
"2026-06-16T14:35:15Z","Priya Sharma","9876543211","Buy a home","₹1.8 Cr - ₹2.5 Cr","Within 1 month","google","search_campaign"
```

### Syncing to Supabase

Once you have the CSV, you can sync leads back to Supabase using **Supabase UI**:

1. Open **Supabase Project** → **Table Editor** → **leads** table
2. Click **Insert** → **Insert from CSV**
3. Upload the CSV file
4. Click **Create 1 row** (or whatever the count is)
5. Leads now appear in the realtime dashboard

Alternatively, use **Supabase API** to insert programmatically:

```bash
curl -X POST "https://vfrctiuavawnteutblbd.supabase.co/rest/v1/leads" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Rajesh Kumar","phone":"9876543210","requirement":"2BHK Flat",...}'
```

---

## Monitoring Local Backup Usage

### When Should You Check for Local Leads?

- ✓ After server downtime or Vercel maintenance
- ✓ If you notice `/api/leads-proxy` is returning errors
- ✓ If Supabase project is temporarily offline
- ✓ Weekly health check (ensure all leads are in cloud database)

### How to Check

```javascript
// In console:
const count = window.leadTools.count();
if (count > 0) {
  console.warn(`⚠ ${count} leads in local backup. Export and sync to Supabase.`);
}
```

### Production Best Practice

1. **Weekly**: Check `/export.html` for accumulated local leads
2. **If Found**: Export CSV and sync to Supabase
3. **Verify**: Check that Vercel and Supabase are healthy
4. **Clear**: Delete local leads after confirming sync

---

## Troubleshooting

### "No local leads saved yet" Message

✓ **This is good!** It means all submissions were successfully saved to the cloud database.

### CSV File Won't Open in Excel

- Try opening with **Google Sheets** instead (more forgiving with encoding)
- Or use **Notepad** → Save As → CSV format selection
- Ensure UTF-8 encoding

### Leads Disappeared from `/export.html`

Possible causes:
1. Browser cleared localStorage (check browser settings)
2. User/visitor cleared their browser cache
3. Someone clicked "Clear All" button
4. Different browser/device (leads are device-specific)

**Prevention**: Export CSV regularly and back up

### Can't Upload CSV to Supabase

Check:
- ✓ CSV headers match table columns exactly
- ✓ Phone numbers are in correct format
- ✓ No null/empty required fields (name, phone)
- ✓ Date format matches Supabase timestamp format

---

## Security Considerations

### What's Stored Locally?

- ✅ Lead data (name, phone, requirement, budget, timeline)
- ✅ Tracking params (UTM, referrer, landing page)
- ❌ **NOT** stored: Service role keys, payment data, sensitive credentials

### Is It Secure?

- ✓ Stored only in visitor's browser (not on servers)
- ✓ Uses browser's standard localStorage (same as any website)
- ✓ Expires when localStorage is cleared
- ✓ Not transmitted over network
- ⚠ **Caution**: If device is compromised, data can be accessed

### Best Practices

1. **Export regularly** — Don't let leads accumulate in localStorage
2. **Sync promptly** — Move CSV to Supabase as soon as possible
3. **Clear after sync** — Use "Clear All" only after confirming sync
4. **Monitor availability** — Ensure proxy and Supabase are healthy

---

## Development Notes

### Adding Local Storage to Forms

If you add more form fields, update the `exportLeadsAsCSV()` function in `script.js`:

```javascript
const headers = ["Saved At", "Name", "Phone", "Requirement", "Budget", "Timeline", ...];
const rows = leads.map(lead => [
  lead.saved_at,
  lead.name,
  lead.phone,
  lead.requirement,
  lead.budget,
  lead.timeline,
  ...
]);
```

### Disabling Local Backup

If you want to disable local backup (not recommended):

In `script.js`, replace the catch block:
```javascript
} catch (error) {
  console.error(error);
  // Comment out or remove this line:
  // saveLeadToLocal(lead);
  
  setFormStatus("Enquiry could not be saved. Please try again later.", "error");
}
```

### Testing Locally

1. Open **DevTools** → **Storage** → **Local Storage** → select site domain
2. You'll see `lodha_pune_leads` key with JSON array value
3. Manually edit to test export functionality

---

## Support

- **Issue**: Local leads not saving? Check browser localStorage quota
- **Issue**: CSV won't sync? Verify field names match exactly
- **Issue**: Too many accumulated leads? Export and manually verify before clearing

Contact: **+91 9673 000 053** (WhatsApp)

---

**Last Updated**: June 16, 2026  
**Feature**: Local Lead Backup v1.0  
**Status**: Production Ready
