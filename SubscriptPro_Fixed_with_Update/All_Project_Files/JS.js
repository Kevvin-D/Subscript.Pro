// JS.js — Final wired version (Flask backend @ :5000)

const API_BASE_URL = "http://127.0.0.1:5000/api";

/* =========================
   HELPERS
========================= */
async function parseJsonSafe(res) {
  try { return await res.json(); } catch { return {}; }
}
function onSubsPage() {
  return window.location.pathname.toLowerCase().includes("subspage.html");
}
function redirect(url) {
  window.location.href = url;
}

/* =========================
   SIGNUP (CreateAccountPage.html)
   Form + fields must have:
   - form id="signupForm"
   - input id="name", id="email", id="password", id="confirmPassword"
========================= */
const signupForm = document.getElementById("signupForm");
if (signupForm) {
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("name")?.value?.trim();
    const email = document.getElementById("email")?.value?.trim();
    const password = document.getElementById("password")?.value || "";
    const confirmPassword = document.getElementById("confirmPassword")?.value || "";

    if (!name || !email || !password || !confirmPassword) {
      alert("Please fill in all fields.");
      return;
    }
    if (password !== confirmPassword) {
      alert("Passwords do not match.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/auth/register/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password })
      });
      const data = await parseJsonSafe(res);
      if (res.ok) {
        alert("Account created successfully! Please sign in.");
        redirect("SignInpage.html");
      } else {
        alert(data.message || "Signup failed.");
      }
    } catch (err) {
      console.error("Signup error:", err);
      alert("Could not reach the server. Is the backend running on port 5000?");
    }
  });
}

/* =========================
   LOGIN (SignInpage.html)
   Form + fields must have:
   - form id="login-form"
   - input id="login-email", id="login-password"
========================= */
const loginForm = document.getElementById("login-form");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email")?.value?.trim();
    const password = document.getElementById("login-password")?.value || "";

    if (!email || !password) {
      alert("Please enter email and password.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/auth/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await parseJsonSafe(res);
      if (res.ok) {
        // store basic session
        sessionStorage.setItem("currentUser", JSON.stringify(data.user || { email }));
        alert("Login successful!");
        redirect("SubsPage.html");
      } else {
        alert(data.message || "Login failed. Check your credentials.");
      }
    } catch (err) {
      console.error("Login error:", err);
      alert("Could not reach the server. Is the backend running on port 5000?");
    }
  });
}

/* =========================
   SESSION GUARD (SubsPage.html)
========================= */
if (onSubsPage()) {
  const currentUser = sessionStorage.getItem("currentUser");
  if (!currentUser) {
    alert("Please sign in first.");
    redirect("SignInpage.html");
  }
}

/* =========================
   LOGOUT (optional button with id="logoutBtn")
========================= */
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    sessionStorage.removeItem("currentUser");
    alert("Logged out.");
    redirect("SignInpage.html");
  });
}

/* =========================
   SUBSCRIPTIONS (SubsPage.html)
   - form id="subscriptionForm"
   - fields: serviceName, amount, startDate, endDate, manualRenewal, autoRenewal
   - table body id="subscriptionTable"
========================= */
const subscriptionForm = document.getElementById("subscriptionForm");
const subscriptionTable = document.getElementById("subscriptionTable");

// --- Edit Modal elements ---
const editModal = document.getElementById("editModal");
const editForm = document.getElementById("editSubscriptionForm");
const editClose = document.getElementById("editModalClose");
const editServiceName = document.getElementById("editServiceName");
const editAmount = document.getElementById("editAmount");
const editStartDate = document.getElementById("editStartDate");
const editEndDate = document.getElementById("editEndDate");
const editManualRenewal = document.getElementById("editManualRenewal");
const editAutoRenewal = document.getElementById("editAutoRenewal");
let editingId = null;

function openEditModal(btn) {
  editingId = btn.getAttribute("data-id");
  editServiceName.value = btn.getAttribute("data-service") || "";
  editAmount.value = btn.getAttribute("data-amount") || "";
  editStartDate.value = btn.getAttribute("data-start") || "";
  editEndDate.value = btn.getAttribute("data-end") || "";
  editManualRenewal.checked = (btn.getAttribute("data-manual") === "true") || btn.getAttribute("data-manual") === "1";
  editAutoRenewal.checked = (btn.getAttribute("data-auto") === "true") || btn.getAttribute("data-auto") === "1";
  if (editModal) editModal.classList.add("show");
}
function closeEditModal() { if (editModal) editModal.classList.remove("show"); editingId = null; }
if (editClose) editClose.addEventListener("click", closeEditModal);
window.addEventListener("click", (e)=>{ if (e.target === editModal) closeEditModal(); });

if (editForm) {
  editForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!editingId) return;
    const payload = {
      serviceName: editServiceName.value.trim(),
      amount: editAmount.value,
      startDate: editStartDate.value,
      endDate: editEndDate.value,
      manualRenewal: !!editManualRenewal.checked,
      autoRenewal: !!editAutoRenewal.checked
    };
    try {
      const res = await fetch(`${API_BASE_URL}/subscriptions/${editingId}/`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await parseJsonSafe(res);
      if (res.ok) {
        alert("Subscription updated!");
        closeEditModal();
        loadSubscriptions();
      } else {
        alert(data.message || "Failed to update subscription.");
      }
    } catch (err) {
      console.error("Update sub error:", err);
      alert("Server error while updating subscription.");
    }
  });
}


async function loadSubscriptions() {
  if (!subscriptionTable) return;
  subscriptionTable.innerHTML = "";
  try {
    const res = await fetch(`${API_BASE_URL}/subscriptions/`);
    const data = await parseJsonSafe(res);
    if (!res.ok) {
      alert(data.message || "Failed to load subscriptions.");
      return;
    }
    (data || []).forEach((item) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${item.serviceName}</td>
        <td>${item.amount}</td>
        <td>${item.startDate}</td>
        <td>${item.endDate}</td>
        <td>${item.manualRenewal ? "Yes" : "No"}</td>
        <td>${item.autoRenewal ? "Yes" : "No"}</td>
        <td>
          <button type="button" data-id="${item.id}" class="edit-btn" data-service="${item.serviceName}" data-amount="${item.amount}" data-start="${item.startDate}" data-end="${item.endDate}" data-manual="${item.manualRenewal}" data-auto="${item.autoRenewal}">Edit</button>
          <button type="button" data-id="${item.id}" class="delete-btn">Delete</button>
        </td>
      `;
      subscriptionTable.appendChild(tr);
    });

    // wire delete buttons
    subscriptionTable.querySelectorAll(".edit-btn").forEach((b)=>{ b.addEventListener("click", ()=> openEditModal(b)); });
    subscriptionTable.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        if (!id) return;
        if (!confirm("Delete this subscription?")) return;
        try {
          const del = await fetch(`${API_BASE_URL}/subscriptions/${id}/`, { method: "DELETE" });
          const d = await parseJsonSafe(del);
          if (del.ok) {
            alert("Subscription deleted.");
            loadSubscriptions();
          } else {
            alert(d.message || "Failed to delete.");
          }
        } catch (err) {
          console.error("Delete error:", err);
          alert("Server error during delete.");
        }
      });
    });
  } catch (err) {
    console.error("Load subs error:", err);
    alert("Server error while loading subscriptions.");
  }
}

if (subscriptionForm) {
  subscriptionForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const serviceName = document.getElementById("serviceName")?.value?.trim();
    const amount = document.getElementById("amount")?.value;
    const startDate = document.getElementById("startDate")?.value;
    const endDate = document.getElementById("endDate")?.value;
    const manualRenewal = document.getElementById("manualRenewal")?.checked || false;
    const autoRenewal = document.getElementById("autoRenewal")?.checked || false;

    if (!serviceName || !amount || !startDate || !endDate) {
      alert("Please fill in all subscription fields.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/subscriptions/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceName, amount, startDate, endDate, manualRenewal, autoRenewal })
      });
      const data = await parseJsonSafe(res);
      if (res.ok) {
        alert("Subscription added!");
        subscriptionForm.reset();
        loadSubscriptions();
      } else {
        alert(data.message || "Failed to add subscription.");
      }
    } catch (err) {
      console.error("Add sub error:", err);
      alert("Server error while adding subscription.");
    }
  });
}

// Auto-load on SubsPage
if (onSubsPage()) {
  loadSubscriptions();
}
