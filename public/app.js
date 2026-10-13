const $ = (sel) => document.querySelector(sel);
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    node.setAttribute(k, v === true ? "" : v);
  }
  for (const c of [].concat(children)) if (c !== "" && c != null) node.append(c);
  return node;
}

const getJson = (url) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`${url} → ${r.status}`);
    return r.json();
  });

// ---------- theme ----------
(function initTheme() {
  try {
    const saved = localStorage.getItem("theme");
    if (saved) document.documentElement.dataset.theme = saved;
  } catch {}
  $("#theme-toggle").addEventListener("click", () => {
    const current =
      document.documentElement.dataset.theme ||
      (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch {}
  });
})();

// ---------- mobile menu ----------
(function initMenu() {
  const btn = $("#menu-toggle");
  const links = $("#nav-links");
  btn.addEventListener("click", () => {
    const open = links.classList.toggle("open");
    btn.setAttribute("aria-expanded", String(open));
  });
  links.addEventListener("click", (e) => {
    if (e.target.tagName === "A") {
      links.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
    }
  });
})();

// ---------- typing effect for roles ----------
function startTyping(roles) {
  const target = $("#typed");
  if (!roles?.length) return;
  if (reducedMotion) { target.textContent = roles.join(" · "); return; }
  let r = 0, i = 0, deleting = false;
  (function tick() {
    const word = roles[r];
    i += deleting ? -1 : 1;
    target.textContent = word.slice(0, i);
    let delay = deleting ? 35 : 70;
    if (!deleting && i === word.length) { deleting = true; delay = 1600; }
    else if (deleting && i === 0) { deleting = false; r = (r + 1) % roles.length; delay = 300; }
    setTimeout(tick, delay);
  })();
}

// ---------- fake terminal in the hero ----------
function renderTerminal(p, projects, certs) {
  const span = (cls, text) => el("span", { class: cls }, text);
  const certCount = certs.reduce((n, c) => n + c.items.length, 0);
  const lines = [
    [span("g", "$ "), "whoami"],
    [span("c", p.name.toLowerCase().replace(/\s+/g, "_"))],
    [""],
    [span("g", "$ "), "cat role.txt"],
    [p.roles.slice(0, 3).join(" | ")],
    [""],
    [span("g", "$ "), "ls ./stack --top"],
    [span("k", ["wazuh", "elk", "xsoar", "burp", "suricata", "python"].join("  "))],
    [""],
    [span("g", "$ "), "./status --summary"],
    [span("d", "[+] "), `internships ........ ${p.stats?.[0]?.value ?? "-"}`],
    [span("d", "[+] "), `projects ........... ${projects.length}`],
    [span("d", "[+] "), `certifications ..... ${certCount}`],
    [span("d", "[+] "), "status ............. ", span("g", "open_to_work")],
  ];
  const term = $("#terminal");
  term.replaceChildren();
  const addLine = (parts) => { term.append(...parts, "\n"); };

  if (reducedMotion) { lines.forEach(addLine); return; }
  let n = 0;
  (function next() {
    if (n >= lines.length) return;
    addLine(lines[n++]);
    setTimeout(next, n % 3 === 1 ? 260 : 110);
  })();
}

// ---------- sections ----------
function renderProfile(p) {
  document.title = `${p.name} · ${p.roles?.[0] ?? "Portfolio"}`;
  $("#logo-mark").textContent = p.initials || p.name.split(" ").map((w) => w[0]).join("");
  $("#logo-name").textContent = p.name;
  $("#name").textContent = p.shortName || p.name;
  $("#availability").textContent = p.availability || "Available";
  $("#tagline").textContent = p.tagline;
  $("#footer-name").textContent = p.name;
  contactEmail = p.email || "";
  $("#year").textContent = new Date().getFullYear();

  $("#social").replaceChildren(
    ...(p.links || []).map((l) => el("a", { href: l.url, target: "_blank", rel: "noopener" }, l.label))
  );

  $("#stats").replaceChildren(
    ...(p.stats || []).map((s) => el("div", { class: "stat reveal" }, [el("b", {}, s.value), el("span", {}, s.label)]))
  );

  $("#about-text").replaceChildren(...[].concat(p.about || []).map((t) => el("p", {}, t)));
  $("#education").replaceChildren(
    ...(p.education || []).map((e) =>
      el("div", { class: "edu-item" }, [el("b", {}, e.degree), el("span", {}, e.school), el("span", { class: "mono small" }, `${e.period} · ${e.detail}`)])
    )
  );
  $("#extras").replaceChildren(...(p.extras || []).map((x) => el("li", {}, x)));
  $("#location").textContent = p.location ? `📍 ${p.location}` : "";

  $("#skills-grid").replaceChildren(
    ...(p.skills || []).map((g) =>
      el("article", { class: "card skill-card reveal" }, [
        el("h3", {}, g.group),
        el("div", { class: "tags" }, g.items.map((s) => el("span", { class: "tag" }, s))),
      ])
    )
  );

  startTyping(p.roles);
}

function renderExperience(list) {
  $("#timeline").replaceChildren(
    ...list.map((x) =>
      el("li", { class: "tl-item reveal" }, [
        el("div", { class: "card" }, [
          el("div", { class: "tl-head" }, [
            el("div", {}, [el("h3", {}, x.role), el("span", { class: "tl-company" }, x.company)]),
            el("span", { class: "tl-meta" }, `${x.period} · ${x.location}`),
          ]),
          el("ul", {}, x.points.map((pt) => el("li", {}, pt))),
          el("div", { class: "tags" }, (x.tags || []).map((t) => el("span", { class: "tag" }, t))),
        ]),
      ])
    )
  );
}

let allProjects = [];

function renderProjects(category) {
  const list = category ? allProjects.filter((p) => p.category === category) : allProjects;
  const grid = $("#project-grid");
  if (!list.length) {
    grid.replaceChildren(el("p", { class: "muted" }, "No projects in this category yet."));
    return;
  }
  grid.replaceChildren(
    ...list.map((p, i) => {
      const wip = /progress/i.test(p.status);
      const card = el("article", { class: "card project fade-in", style: `animation-delay:${i * 40}ms` }, [
        el("div", { class: "project-top" }, [
          el("span", { class: "cat" }, p.category),
          el("span", { class: `badge ${wip ? "wip" : "done"}` }, wip ? "● in progress" : "✓ completed"),
        ]),
        el("h3", {}, p.title),
        p.subtitle ? el("p", { class: "sub" }, p.subtitle) : "",
        el("p", { class: "desc" }, p.description),
        el("div", { class: "tags" }, p.tags.map((t) => el("span", { class: "tag" }, t))),
        el("div", { class: "project-foot" }, [
          el("span", { class: "muted" }, p.team || ""),
          p.link ? el("a", { href: p.link, target: "_blank", rel: "noopener" }, "View code →") : "",
        ]),
      ]);
      return card;
    })
  );
}

function renderFilters() {
  const cats = [...new Set(allProjects.map((p) => p.category))];
  const buttons = ["All", ...cats].map((c) => {
    const b = el("button", { type: "button", "aria-pressed": c === "All" ? "true" : "false" }, c);
    b.addEventListener("click", () => {
      $("#filters").querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", "false"));
      b.setAttribute("aria-pressed", "true");
      renderProjects(c === "All" ? null : c);
    });
    return b;
  });
  $("#filters").replaceChildren(...buttons);
}

function renderCerts(groups) {
  $("#cert-grid").replaceChildren(
    ...groups.map((g) =>
      el("article", { class: "card cert-card reveal" }, [
        el("h3", {}, g.issuer),
        el("span", { class: "count" }, `${g.items.length} credential${g.items.length > 1 ? "s" : ""}`),
        el("ul", {}, g.items.map((c) => el("li", {}, c))),
      ])
    )
  );
}

// ---------- scroll effects ----------
function initScrollEffects() {
  if (!("IntersectionObserver" in window) || reducedMotion) {
    document.querySelectorAll(".reveal").forEach((n) => n.classList.add("visible"));
    return;
  }
  const revealer = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add("visible"); revealer.unobserve(e.target); }
  }, { threshold: 0.12 });
  document.querySelectorAll(".reveal").forEach((n) => revealer.observe(n));

  const links = [...document.querySelectorAll("#nav-links a")];
  const spy = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      links.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === `#${e.target.id}`));
    }
  }, { rootMargin: "-45% 0px -50% 0px" });
  document.querySelectorAll("main section[id]").forEach((s) => spy.observe(s));
}

// ---------- contact form ----------
let contactEmail = "";

function validateContact({ name, email, message }) {
  const errors = {};
  if (!name || name.trim().length < 2) errors.name = "Please enter your name.";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Please enter a valid email.";
  if (!message || message.trim().length < 10) errors.message = "Message should be at least 10 characters.";
  return errors;
}

// On static hosting (GitHub Pages) there is no server, so deliver the message to my
// inbox through FormSubmit (https://formsubmit.co), a free form-to-email service.
async function sendViaFormSubmit({ name, email, message, website }) {
  const res = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(contactEmail)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      name: name.trim(),
      email: email.trim(),
      message: message.trim(),
      _subject: `Portfolio message from ${name.trim()}`,
      _replyto: email.trim(),
      _template: "table",
      _honey: website || "",
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || String(data.success) !== "true") {
    throw new Error(data.message || "Message could not be sent.");
  }
}

$("#contact-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const status = $("#form-status");
  const button = form.querySelector("button");
  const fields = Object.fromEntries(new FormData(form));
  form.querySelectorAll(".error").forEach((s) => (s.textContent = ""));
  status.className = "";

  const errors = validateContact(fields);
  if (Object.keys(errors).length) {
    for (const [field, msg] of Object.entries(errors)) {
      form.querySelector(`.error[data-for="${field}"]`).textContent = msg;
    }
    status.className = "fail";
    status.textContent = "Please fix the highlighted fields.";
    return;
  }

  status.textContent = "Sending…";
  button.disabled = true;

  try {
    const res = await fetch("api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    // 404/405 means there is no backend here (GitHub Pages): send by email instead.
    if ([404, 405, 501].includes(res.status) && contactEmail) {
      try {
        await sendViaFormSubmit(fields);
        form.reset();
        status.className = "ok";
        status.textContent = "Thanks! Your message was sent. I'll get back to you soon.";
      } catch {
        status.className = "fail";
        status.textContent = `Sorry, that didn't go through. Please email me at ${contactEmail}.`;
      }
      return;
    }
    const data = await res.json();
    if (res.ok) {
      form.reset();
      status.className = "ok";
      status.textContent = "Thanks! Your message was sent. I'll get back to you soon.";
    } else {
      for (const [field, msg] of Object.entries(data.errors || {})) {
        const slot = form.querySelector(`.error[data-for="${field}"]`);
        if (slot) slot.textContent = msg;
      }
      status.className = "fail";
      status.textContent = data.error || "Please fix the highlighted fields.";
    }
  } catch {
    status.className = "fail";
    status.textContent = "Network error. Please try again.";
  } finally {
    button.disabled = false;
  }
});

// ---------- boot ----------
(async function init() {
  const [profile, experience, projects, certs] = await Promise.allSettled([
    // Relative paths so the site works both at the domain root and under /portfolio/ on GitHub Pages.
    getJson("data/profile.json"),
    getJson("data/experience.json"),
    getJson("data/projects.json"),
    getJson("data/certifications.json"),
  ]);

  if (profile.status === "fulfilled") renderProfile(profile.value);
  if (experience.status === "fulfilled") renderExperience(experience.value);
  else $("#timeline").replaceChildren(el("li", { class: "muted" }, "Couldn't load experience."));

  if (projects.status === "fulfilled") {
    allProjects = projects.value;
    renderFilters();
    renderProjects(null);
  } else {
    $("#project-grid").replaceChildren(el("p", { class: "muted" }, "Couldn't load projects."));
  }
  if (certs.status === "fulfilled") renderCerts(certs.value);

  if (profile.status === "fulfilled") {
    renderTerminal(profile.value, allProjects, certs.status === "fulfilled" ? certs.value : []);
  }
  initScrollEffects();
})();
