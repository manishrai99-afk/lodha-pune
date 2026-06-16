/**
 * Lodha Pune Lead Capture - Hybrid System
 * 
 * Handles form submission with local storage backup and optional Google Form integration.
 * Leads are always saved locally and can be exported as CSV.
 * No server or database required - fully works offline.
 * 
 * Configuration:
 * - GOOGLE_FORM_URL: Set to your Google Form submission URL (optional)
 * - Local backup: Automatic, always works
 * - CSV Export: Available via /export.html or console
 */

const header = document.querySelector("[data-header]");
const menuToggle = document.querySelector("[data-menu-toggle]");
const leadForm = document.querySelector("#leadForm");
const formStatus = document.querySelector("[data-form-status]");

// ==================== GOOGLE FORM CONFIGURATION ====================
// Replace with your Google Form submission URL (optional, leave empty to disable)
// To get URL: Open Form → Settings → Collect email → Get submission endpoint
const GOOGLE_FORM_URL = ""; // Example: https://docs.google.com/forms/d/e/{FORM_ID}/formResponse
const GOOGLE_FORM_FIELDS = {
  name: "entry.1234567890",      // Replace with your form's entry ID
  phone: "entry.0987654321",
  requirement: "entry.1111111111",
  budget: "entry.2222222222",
  timeline: "entry.3333333333"
};


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

  return {
    lead_source: get("utm_source") || get("source") || "website",
    utm_source: get("utm_source"),
    utm_medium: get("utm_medium"),
    utm_campaign: get("utm_campaign"),
    landing_page: window.location.href,
    referrer: document.referrer
  };
};

// ==================== LOCAL STORAGE MANAGEMENT ====================
/**
 * Save lead to browser localStorage (always works, no server needed)
 */
const saveLeadLocally = (lead) => {
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

/**
 * Export locally saved leads as CSV for download
 */
const exportLeadsAsCSV = () => {
  const leads = JSON.parse(localStorage.getItem("lodha_pune_leads") || "[]");
  if (leads.length === 0) {
    alert("कोई lead save नहीं है।");
    return;
  }

  const headers = ["Saved At", "Name", "Phone", "Requirement", "Budget", "Timeline", "Lead Source"];
  const rows = leads.map(lead => [
    lead.saved_at || "",
    lead.name || "",
    lead.phone || "",
    lead.requirement || "",
    lead.budget || "",
    lead.timeline || "",
    lead.lead_source || "website"
  ]);

  const csvContent = [
    headers.map(h => `"${h}"`).join(","),
    ...rows.map(row => row.map(cell => `"${(cell + "").replace(/"/g, '""')}"`).join(","))
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `lodha-pune-leads-${new Date().toISOString().split("T")[0]}.csv`;
  link.click();
};

/**
 * Clear all locally saved leads (use with caution)
 */
const clearLocalLeads = () => {
  if (confirm("क्या आप सुनिश्चित हैं? यह सभी saved leads delete कर देगा।")) {
    localStorage.removeItem("lodha_pune_leads");
    alert("सभी leads delete हो गए।");
  }
};

// ==================== GOOGLE FORM SUBMISSION ====================
/**
 * Submit lead data to Google Form (if configured)
 * Uses no-cors mode to avoid CORS restrictions
 */
const submitToGoogleForm = async (lead) => {
  if (!GOOGLE_FORM_URL) return; // Skip if not configured

  try {
    const formData = new FormData();
    formData.append(GOOGLE_FORM_FIELDS.name, lead.name);
    formData.append(GOOGLE_FORM_FIELDS.phone, lead.phone);
    formData.append(GOOGLE_FORM_FIELDS.requirement, lead.requirement);
    formData.append(GOOGLE_FORM_FIELDS.budget, lead.budget);
    formData.append(GOOGLE_FORM_FIELDS.timeline, lead.timeline);

    await fetch(GOOGLE_FORM_URL, {
      method: "POST",
      mode: "no-cors",
      body: formData
    });

    console.log("✓ Lead submitted to Google Form");
  } catch (error) {
    console.error("Google Form submission failed (non-blocking):", error);
    // Don't throw - Google Form is optional fallback
  }
};

const buildWhatsappMessage = ({ name, phone, requirement }) => [
  "Hi 24K Realtors, I want property consultation.",
  `Name: ${name}`,
  `Phone: ${phone}`,
  `Requirement: ${requirement}`
].join("\n");

// ==================== FORM SUBMISSION ====================
leadForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const data = new FormData(leadForm);
  const name = data.get("name").trim();
  const phone = data.get("phone").trim();
  const requirement = data.get("requirement");
  const budget = data.get("budget");
  const timeline = data.get("timeline");
  const submitButton = leadForm.querySelector("button[type='submit']");

  // Basic validation
  if (!name || !phone || !requirement || !budget || !timeline) {
    setFormStatus("कृपया सभी fields भरें।", "error");
    return;
  }

  const lead = {
    name,
    phone,
    requirement,
    budget,
    timeline,
    ...getTrackingData()
  };

  submitButton.disabled = true;
  submitButton.textContent = "सहेज रहे हैं...";

  try {
    // Always save to localStorage first (primary storage)
    saveLeadLocally(lead);
    console.log("✓ Lead saved locally");

    // Try to submit to Google Form if configured
    if (GOOGLE_FORM_URL) {
      await submitToGoogleForm(lead);
      leadForm.reset();
      setFormStatus("✓ आपका enquiry save हो गया! Local और Google Form दोनों में।");
    } else {
      leadForm.reset();
      setFormStatus("✓ आपका enquiry save हो गया! /export.html से CSV download कर सकते हो।");
    }

  } catch (error) {
    console.error("Form submission error:", error);
    setFormStatus("✓ Lead save हो गया (locally)। Google Form में error हो सकता है।", "error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Send Enquiry";
  }
});

// ==================== CONSOLE TOOLS FOR DEVELOPERS ====================
window.leadTools = {
  exportCSV: exportLeadsAsCSV,
  viewAll: () => JSON.parse(localStorage.getItem("lodha_pune_leads") || "[]"),
  clearAll: clearLocalLeads,
  count: () => JSON.parse(localStorage.getItem("lodha_pune_leads") || "[]").length,
  lastLead: () => {
    const leads = JSON.parse(localStorage.getItem("lodha_pune_leads") || "[]");
    return leads[leads.length - 1] || null;
  }
};

console.log(
  "%c✓ Lodha Pune Lead System Ready - Hybrid Mode",
  "color: #0f5d4f; font-weight: bold; font-size: 14px;",
  "\n\n📍 Storage: localStorage (सभी leads यहाँ save हैं)\n\n",
  "Use window.leadTools:\n",
  "  • leadTools.exportCSV() — CSV download करो\n",
  "  • leadTools.viewAll() — सभी leads देखो\n",
  "  • leadTools.count() — कितने leads हैं\n",
  "  • leadTools.lastLead() — आखरी lead देखो\n",
  "  • leadTools.clearAll() — सभी clear करो\n\n",
  "Or visit: /export.html for web interface"
);
