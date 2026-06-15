const header = document.querySelector("[data-header]");
const menuToggle = document.querySelector("[data-menu-toggle]");
const leadForm = document.querySelector("#leadForm");
const formStatus = document.querySelector("[data-form-status]");

// Updated Supabase project URL as requested. Provide the anon key securely.
const SUPABASE_URL = "https://vfrctiuavawnteutblbd.supabase.co";
const SUPABASE_ANON_KEY = ""; // <-- paste your anon public key here or set as environment variable in production
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
    throw new Error(`Supabase lead insert failed with status ${response.status}`);
  }
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
    if (!isDatabaseConfigured()) {
      const message = buildWhatsappMessage(lead);
      window.open(`https://wa.me/919673000053?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
      setFormStatus("Database is not configured yet. Opening WhatsApp enquiry instead.", "error");
      return;
    }

    await saveLead(lead);
    leadForm.reset();
    setFormStatus("Enquiry saved. Our team will contact you shortly.");
  } catch (error) {
    console.error(error);
    setFormStatus("We could not save this enquiry. Please call or WhatsApp us.", "error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Send Enquiry";
  }
});
