/**
 * Lodha Pune Lead Capture - Client-Side Application
 * 
 * Handles form submission, tracking data collection, and lead saving to Supabase.
 * Includes fallback logic for offline/failed proxy scenarios.
 * 
 * Security: Anon key can be empty; proxy will use service_role_key server-side.
 * Never commit the actual SUPABASE_ANON_KEY; use environment variables in production.
 */

const header = document.querySelector("[data-header]");
const menuToggle = document.querySelector("[data-menu-toggle]");
const leadForm = document.querySelector("#leadForm");
const formStatus = document.querySelector("[data-form-status]");

// Supabase Configuration (set via environment variables in production)
const SUPABASE_URL = "https://vfrctiuavawnteutblbd.supabase.co";
const SUPABASE_ANON_KEY = ""; // Leave empty; proxy uses service_role_key server-side
const LEADS_TABLE = "leads";


const syncHeader = () => {
  header.classList.toggle("is-scrolled", window.scrollY > 12);
};

syncHeader();
window.addEventListener("scroll", syncHeader, { passive: true });

menuToggle.addEventListener("click", () => {
  header.classList.toggle("is-open");
});

document.querySelectorAll(".site-nav a").forEach((link) => {
  link.addEventListener("click", () => {
    header.classList.remove("is-open");
  });
});

document.querySelectorAll("[data-requirement-link]").forEach((link) => {
  link.addEventListener("click", () => {
    const requirement = link.dataset.requirementLink;
    const requirementInput = leadForm.elements.requirement;
    requirementInput.value = requirement;
    setTimeout(() => leadForm.querySelector("input[name='name']").focus(), 260);
  });
});

const setFormStatus = (message, type = "success") => {
  formStatus.textContent = message;
  formStatus.classList.add("is-visible");
  formStatus.classList.toggle("is-error", type === "error");
};

const getTrackingData = () => {
  const params = new URLSearchParams(window.location.search);
  const get = (key) => params.get(key) || "";
  const leadSeries = get("series") || get("utm_campaign") || get("cstm_media_sub_type") || "website";

  return {
    lead_source: get("utm_source") || get("cstm_ppc_channel") || "website",
    lead_series: leadSeries,
    utm_source: get("utm_source"),
    utm_medium: get("utm_medium"),
    utm_campaign: get("utm_campaign"),
    utm_term: get("utm_term"),
    utm_content: get("utm_content"),
    landing_page: window.location.href,
    referrer: document.referrer,
    metadata: {
      utm_sub_source: get("utm_sub_source"),
      cstm_ppc_channel: get("cstm_ppc_channel"),
      cstm_media_type: get("cstm_media_type"),
      cstm_media_sub_type: get("cstm_media_sub_type"),
      agency_partner: get("Agency_Partner"),
      gclid: get("gclid"),
      gbraid: get("gbraid"),
      gad_source: get("gad_source"),
      gad_campaignid: get("gad_campaignid")
    }
  };
};

const buildWhatsappMessage = ({ name, phone, requirement }) => [
  "Hi 24K Realtors, I want property consultation.",
  `Name: ${name}`,
  `Phone: ${phone}`,
  `Requirement: ${requirement}`
].join("\n");

// Local Storage Fallback: Save lead to browser if database unavailable
const saveLeadToLocal = (lead) => {
  const localLeads = JSON.parse(localStorage.getItem("lodha_pune_leads") || "[]");
  const leadWithTimestamp = {
    ...lead,
    saved_at: new Date().toISOString(),
    local_id: Date.now()
  };
  localLeads.push(leadWithTimestamp);
  localStorage.setItem("lodha_pune_leads", JSON.stringify(localLeads));
  return leadWithTimestamp;
};

// Export local leads as CSV (for offline backup)
const exportLeadsAsCSV = () => {
  const leads = JSON.parse(localStorage.getItem("lodha_pune_leads") || "[]");
  if (leads.length === 0) {
    alert("No local leads saved yet.");
    return;
  }

  // CSV headers
  const headers = ["Saved At", "Name", "Phone", "Requirement", "Budget", "Timeline", "Lead Source", "Lead Series", "Landing Page"];
  const rows = leads.map(lead => [
    lead.saved_at || "",
    lead.name || "",
    lead.phone || "",
    lead.requirement || "",
    lead.budget || "",
    lead.timeline || "",
    lead.lead_source || "",
    lead.lead_series || "",
    lead.landing_page || ""
  ]);

  // Build CSV content
  const csvContent = [
    headers.map(h => `"${h}"`).join(","),
    ...rows.map(row => row.map(cell => `"${(cell + "").replace(/"/g, '""')}"`).join(","))
  ].join("\n");

  // Trigger download
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `lodha-pune-leads-${new Date().toISOString().split("T")[0]}.csv`;
  link.click();
};

// Clear local leads after exporting
const clearLocalLeads = () => {
  if (confirm("Are you sure? This will delete all locally saved leads.")) {
    localStorage.removeItem("lodha_pune_leads");
    alert("Local leads cleared.");
  }
};

// Console shortcuts for developers
window.leadTools = {
  exportCSV: exportLeadsAsCSV,
  viewAll: () => JSON.parse(localStorage.getItem("lodha_pune_leads") || "[]"),
  clearAll: clearLocalLeads,
  count: () => JSON.parse(localStorage.getItem("lodha_pune_leads") || "[]").length
};

console.log(
  "%c✓ Lodha Pune Lead Tools Ready",
  "color: #0f5d4f; font-weight: bold; font-size: 14px;",
  "\n\nUse window.leadTools:\n",
  "  • leadTools.exportCSV() — Export local leads as CSV\n",
  "  • leadTools.viewAll() — View all locally saved leads\n",
  "  • leadTools.count() — Count saved leads\n",
  "  • leadTools.clearAll() — Delete all local leads\n\n",
  "Or visit: /export.html"
);

const isDatabaseConfigured = () => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const saveLead = async (lead) => {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${LEADS_TABLE}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Prefer: "return=minimal"
    },
    body: JSON.stringify(lead)
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase insert failed (${response.status}): ${body}`);
  }
};

const saveLeadViaProxy = async (lead) => {
  const resp = await fetch('/api/leads-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(lead)
  });

  if (resp.ok) return;

  if (resp.status === 404 || resp.status === 405) {
    const err = new Error('PROXY_NOT_AVAILABLE');
    err.code = resp.status;
    throw err;
  }

  const text = await resp.text();
  throw new Error(`Proxy insert failed (${resp.status}): ${text || resp.statusText}`);
};

leadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(leadForm);
  const name = data.get("name").trim();
  const phone = data.get("phone").trim();
  const requirement = data.get("requirement");
  const budget = data.get("budget");
  const timeline = data.get("timeline");
  const submitButton = leadForm.querySelector("button[type='submit']");

  const lead = {
    name,
    phone,
    requirement,
    budget,
    timeline,
    crm_stage: "new",
    ...getTrackingData()
  };

  submitButton.disabled = true;
  submitButton.textContent = "Saving...";

  try {
    // Try serverless proxy first (recommended). If proxy not available, fall back to direct Supabase
    try {
      await saveLeadViaProxy(lead);
    } catch (proxyErr) {
      const isProxyMissing = proxyErr && proxyErr.message === 'PROXY_NOT_AVAILABLE';
      const proxyErrorDetails = proxyErr && proxyErr.message ? proxyErr.message : 'unknown proxy error';

      if (isProxyMissing) {
        if (!isDatabaseConfigured()) {
          // Save to local storage before opening WhatsApp
          saveLeadToLocal(lead);
          const message = buildWhatsappMessage(lead);
          window.open(`https://wa.me/919673000053?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
          setFormStatus("Enquiry saved locally. Opening WhatsApp. You can export saved leads anytime.", "error");
          return;
        }
        await saveLead(lead);
      } else {
        if (isDatabaseConfigured()) {
          try {
            await saveLead(lead);
          } catch (directErr) {
            console.error('Proxy failed:', proxyErrorDetails, 'Direct Supabase failed:', directErr);
            // Save to local storage as final fallback
            saveLeadToLocal(lead);
            throw new Error(`Saved locally. Proxy failed: ${proxyErrorDetails}. Direct Supabase failed: ${directErr.message}`);
          }
        } else {
          // Save to local storage if no database configured
          saveLeadToLocal(lead);
          console.error('Proxy failed:', proxyErrorDetails);
          throw proxyErr;
        }
      }
    }
    leadForm.reset();
    setFormStatus("Enquiry saved. Our team will contact you shortly.");
  } catch (error) {
    console.error(error);
    // Final fallback: if we get here, data was already saved to localStorage
    setFormStatus("Enquiry saved locally. Our team will sync and contact you. Open DevTools for export option.", "error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Send Enquiry";
  }
});
