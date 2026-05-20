import { useState, useEffect, useCallback, useRef } from "react";
// ── FIXED Groq API helpers ───────────────────────────────────────────────
const GROQ_KEY = import.meta.env.VITE_GROQ_KEY?.trim();
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

async function callAI(prompt, systemPrompt = "") {
  if (!GROQ_KEY) throw new Error("Missing Groq API Key");

  const messages = [
    ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
    { role: "user", content: prompt }
  ];

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_KEY}`
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",   // Better & faster model
      messages,
      temperature: 0.7,
      max_tokens: 1200
    })
  });

  const data = await res.json();

  if (!res.ok) {
    console.error("🚨 Groq callAI Error:", data);
    throw new Error(data.error?.message || `HTTP ${res.status}`);
  }
  return data.choices?.[0]?.message?.content || "Sorry, I couldn't generate a response.";
}

async function callAIChat(history, systemPrompt = "") {
  if (!GROQ_KEY) throw new Error("Missing Groq API Key");

  const messages = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });

  // Fix: Ensure we never start with assistant message
  const validHistory = history.filter((msg, idx) => {
    if (idx === 0 && msg.role === "assistant") return false;
    return ["user", "assistant", "system"].includes(msg.role);
  });

  validHistory.forEach(m => messages.push({ role: m.role, content: m.content }));

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_KEY}`
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages,
      temperature: 0.75,
      max_tokens: 1500
    })
  });

  const data = await res.json();

  if (!res.ok) {
    console.error("🚨 Groq callAIChat Error:", JSON.stringify(data, null, 2));
    throw new Error(data.error?.message || `HTTP ${res.status}`);
  }
  return data.choices?.[0]?.message?.content || "Sorry, I couldn't generate a response.";
}

const REGIONS = ["All Regions", "Africa", "Asia", "Europe", "Americas", "Middle East", "Oceania"];
const FIELDS = ["All Fields", "STEM", "Engineering", "Computer Science", "Data Science", "Cybersecurity", "AI & Machine Learning", "Medicine", "Business", "Law", "Arts & Humanities", "Social Sciences", "Agriculture", "Education"];
const STATUS_FILTERS = ["All", "Open", "Closed"];
const TRACKER_COLS = ["Interested", "Applied", "Awaiting Response", "Result"];
const TRACKER_COLORS = { "Interested": "#3d3870", "Applied": "#1d4ed8", "Awaiting Response": "#b45309", "Result": "#065f46" };
const TRACKER_ICONS = { "Interested": "🔖", "Applied": "📤", "Awaiting Response": "⏳", "Result": "🏆" };
const FLAGS = { "United Kingdom": "🇬🇧", "Germany": "🇩🇪", "United States": "🇺🇸", "France": "🇫🇷", "Japan": "🇯🇵", "South Korea": "🇰🇷", "China": "🇨🇳", "Australia": "🇦🇺", "Canada": "🇨🇦", "Sweden": "🇸🇪", "Netherlands": "🇳🇱", "Turkey": "🇹🇷", "Hungary": "🇭🇺", "Russia": "🇷🇺", "Saudi Arabia": "🇸🇦", "Switzerland": "🇨🇭", "Italy": "🇮🇹", "Finland": "🇫🇮", "Taiwan": "🇹🇼", "Qatar": "🇶🇦" };
function getFlag(c) { for (const [k, v] of Object.entries(FLAGS)) { if (c?.includes(k)) return v; } return "🌍"; }
const NOW = new Date();
function isOpen(s) { if (s.status === "open") return true; if (s.status === "closed") return false; return new Date(s.deadlineDate) >= NOW; }
function daysUntil(d) { if (!d) return null; return Math.ceil((new Date(d) - NOW) / 86400000); }

function CountdownBadge({ dateStr, status }) {
  const d = daysUntil(dateStr);
  if (status === "closed" || d === null || d < 0) return <span className="cd cd-off">⏰ Closed</span>;
  if (d === 0) return <span className="cd cd-red">⚡ Today!</span>;
  if (d <= 7) return <span className="cd cd-red">🔥 {d}d left</span>;
  if (d <= 30) return <span className="cd cd-yellow">⏳ {d}d left</span>;
  if (d <= 90) return <span className="cd cd-green">✅ {d}d left</span>;
  return <span className="cd cd-blue">📅 {d}d left</span>;
}

function computeMatch(s, p) {
  if (!p) return null;
  let sc = 0;
  if (s.region === p.region || !p.region || p.region === "Any") sc += 30; else sc += 5;
  const pf = (p.field || "").toLowerCase();
  if (!pf || pf === "any" || s.field === "All Fields") sc += 35;
  else if (s.field?.toLowerCase().includes(pf) || s.courses?.some(c => c.toLowerCase().includes(pf))) sc += 35;
  else sc += 8;
  const lv = (p.level || "").toLowerCase();
  if (!lv || lv === "any") sc += 20; else if (s.eligibility?.toLowerCase().includes(lv)) sc += 20; else sc += 5;
  if (isOpen(s)) sc += 15;
  return Math.round((sc / 100) * 100);
}
function MatchBadge({ pct }) {
  if (pct === null) return null;
  const c = pct >= 80 ? "#34d399" : pct >= 60 ? "#fbbf24" : "#f87171";
  return <span className="mbadge" style={{ background: c + "22", color: c, borderColor: c + "55" }}>{pct}% match</span>;
}
function computeAcceptance(s, p) {
  if (!p) return null;
  let sc = 50;
  const gpa = parseFloat(p.gpa || 0);
  if (gpa >= 3.8) sc += 20; else if (gpa >= 3.5) sc += 12; else if (gpa >= 3.0) sc += 5; else if (gpa > 0) sc -= 10;
  if (s.region === p.region) sc += 10;
  const pf = (p.field || "").toLowerCase();
  if (pf && (s.courses?.some(c => c.toLowerCase().includes(pf)) || s.field?.toLowerCase().includes(pf))) sc += 8;
  if (s.amount?.toLowerCase().includes("full")) sc -= 8;
  if (s.tag === "Elite" || s.tag === "Prestigious") sc -= 15;
  else if (s.tag === "Government") sc -= 5;
  else if (s.tag === "Merit") sc += 5;
  if (p.ielts === "no" && s.eligibility?.toLowerCase().includes("english")) sc -= 8;
  if (p.ielts === "yes") sc += 5;
  if (p.workExp === "2+" && s.eligibility?.toLowerCase().includes("work")) sc += 8;
  return Math.max(10, Math.min(92, Math.round(sc)));
}
// new grok's code 
// ── Difficulty Meter ─────────────────────────────────────────────────────
function computeDifficulty(s) {
  let score = 50; // base

  if (s.tag === "Elite" || s.tag === "Prestigious") score += 35;
  if (s.amount?.toLowerCase().includes("full")) score += 20;
  if (s.eligibility?.toLowerCase().includes("leadership") ||
    s.eligibility?.toLowerCase().includes("work experience")) score += 15;

  // Lower difficulty for regional/need-based
  if (s.tag === "Africa-Focused" || s.tag === "Need-Based" || s.tag === "Merit") score -= 25;

  score = Math.max(20, Math.min(95, score));

  if (score >= 80) return { level: "🔴 Highly Competitive", color: "#f87171" };
  if (score >= 60) return { level: "🟡 Moderate", color: "#fbbf24" };
  return { level: "🟢 Easy", color: "#34d399" };
}

// ── Netflix-style Recommendations ───────────────────────────────────────
function getRecommendations(viewedScholarship, allList, profile, limit = 4) {
  if (!viewedScholarship) return [];

  return allList
    .filter(s => s.id !== viewedScholarship.id)
    .map(s => {
      let score = 0;

      // Same region boost
      if (s.region === viewedScholarship.region) score += 40;

      // Similar field / courses
      if (s.field === viewedScholarship.field) score += 30;
      if (s.courses?.some(c => viewedScholarship.courses?.includes(c))) score += 25;

      // Match user profile
      if (profile) score += (computeMatch(s, profile) || 0) * 0.6;

      // Same funding level
      if ((s.amount?.includes("Full") && viewedScholarship.amount?.includes("Full")) ||
        (s.amount?.includes("tuition") && viewedScholarship.amount?.includes("tuition"))) score += 15;

      return { ...s, recScore: Math.round(score) };
    })
    .sort((a, b) => b.recScore - a.recScore)
    .slice(0, limit);
}

// ── Application Checklist ─────────────────────────────────────────────────
function getApplicationChecklist(s, profile) {
  const checklist = [
    { item: "Valid Passport", status: true, icon: "🛂" },
    { item: "Academic Transcript", status: true, icon: "📄" },
    { item: "Recommendation Letter", status: false, icon: "✉️" },
    { item: "Statement of Purpose / Motivation Letter", status: false, icon: "📝" },
    { item: "English Test (IELTS/TOEFL)", status: profile?.ielts === "yes", icon: "🗣️" },
    { item: "Proof of Financial Need (if required)", status: false, icon: "💰" },
    { item: "CV / Resume", status: true, icon: "📋" },
  ];

  // Customize based on scholarship
  if (s.eligibility?.toLowerCase().includes("work")) {
    checklist.push({ item: "Proof of Work Experience", status: false, icon: "💼" });
  }
  if (s.name.includes("MEXT") || s.name.includes("KGSP") || s.name.includes("CSC")) {
    checklist.push({ item: "Medical Certificate", status: false, icon: "🩺" });
  }

  return checklist;
}

// ── Best Countries For You ───────────────────────────────────────────────
function getBestCountries(profile, allList) {
  if (!profile) return [];

  const scores = {};

  allList.forEach(s => {
    if (!isOpen(s)) return;
    let score = 0;
    if (s.region === profile.region) score += 45;
    if (profile.field && (s.field === profile.field || s.courses?.some(c => c.includes(profile.field)))) score += 30;
    if (s.amount?.toLowerCase().includes("full")) score += 15;

    scores[s.country] = (scores[s.country] || 0) + score;
  });

  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([country]) => country);
}


function AccBadge({ pct }) {
  if (pct === null) return null;
  if (pct >= 70) return <span className="acc acc-hi">🎯 {pct}%</span>;
  if (pct >= 45) return <span className="acc acc-mid">⚠️ {pct}%</span>;
  return <span className="acc acc-low">🔥 {pct}%</span>;
}
function AccBreakdown({ s, p }) {
  if (!p) return null;
  const pct = computeAcceptance(s, p);
  const gpa = parseFloat(p.gpa || 0);
  const reasons = [];
  if (s.region === p.region) reasons.push({ i: "✅", t: "Your region is eligible" });
  if (gpa >= 3.5) reasons.push({ i: "✅", t: `GPA ${gpa} fits average range` });
  else if (gpa > 0) reasons.push({ i: "⚠️", t: `GPA ${gpa} may be below average` });
  if (p.ielts === "yes") reasons.push({ i: "✅", t: "English proficiency confirmed" });
  else if (p.ielts === "no") reasons.push({ i: "⚠️", t: "IELTS may be required — verify" });
  if (s.amount?.toLowerCase().includes("full")) reasons.push({ i: "⚠️", t: "Fully funded = highly competitive" });
  if (s.tag === "Elite") reasons.push({ i: "🔥", t: "Elite programme — top-tier applicants only" });
  if (p.workExp === "2+") reasons.push({ i: "✅", t: "Work experience is an advantage" });
  const label = pct >= 70 ? "High Chance" : pct >= 45 ? "Moderate" : "Competitive";
  const color = pct >= 70 ? "#34d399" : pct >= 45 ? "#fbbf24" : "#f87171";
  return (
    <div className="acc-box">
      <div className="acc-head"><span className="sec-lbl" style={{ margin: 0 }}>🎯 Acceptance Likelihood</span><span style={{ fontSize: ".82rem", fontWeight: 700, color }}>{pct}% — {label}</span></div>
      <div className="acc-track"><div className="acc-fill" style={{ width: `${pct}%`, background: color }} /></div>
      <div className="acc-reasons">{reasons.map((r, i) => <div key={i} className="acc-reason"><span>{r.i}</span><span>{r.t}</span></div>)}</div>
    </div>
  );
}

// ── Hidden Gems Detection ─────────────────────────────────────────────────────
const HIDDEN_GEM_TAGS = ["Need-Based", "Merit", "Regional", "Africa-Focused", "Professional", "Leadership", "Exchange"];
const POPULAR_NAMES = ["Chevening", "Gates Cambridge", "Fulbright", "Rhodes"];
function isHiddenGem(s) {
  const notPopular = !POPULAR_NAMES.some(n => s.name?.includes(n));
  const niche = HIDDEN_GEM_TAGS.includes(s.tag);
  const open = isOpen(s);
  return notPopular && niche && open;
}

// ── Timeline Generator ────────────────────────────────────────────────────────
function generateTimeline(allList, profile, trackerFlat) {
  const months = [];
  const today = new Date();
  for (let i = 0; i < 8; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const label = d.toLocaleString("default", { month: "long", year: "numeric" });
    const monthNum = d.getMonth();
    const tasks = [];
    // Check scholarships closing this month
    allList.filter(isOpen).forEach(s => {
      if (!s.deadlineDate) return;
      const dl = new Date(s.deadlineDate);
      if (dl.getMonth() === d.getMonth() && dl.getFullYear() === d.getFullYear()) {
        tasks.push({ type: "deadline", text: `Submit ${s.name}`, color: s.color || "#7c3aed", urgent: daysUntil(s.deadlineDate) <= 14 });
      }
    });
    // Add prep tasks based on month
    if (i === 0) { tasks.push({ type: "prep", text: "Update your CV and academic transcripts", color: "#60a5fa" }); }
    if (i === 0 || i === 1) { tasks.push({ type: "prep", text: "Request recommendation letters (allow 4–6 weeks)", color: "#60a5fa" }); }
    if (i === 1) { tasks.push({ type: "prep", text: "Prepare English proficiency test if needed", color: "#a78bfa" }); }
    if (i === 2) { tasks.push({ type: "prep", text: "Draft your Statement of Purpose", color: "#a78bfa" }); }
    if (i === 3) { tasks.push({ type: "prep", text: "Review and finalize all application essays", color: "#fbbf24" }); }
    if (i === 4) { tasks.push({ type: "prep", text: "Do mock interviews if scholarship requires one", color: "#f97316" }); }
    if (i === 5) { tasks.push({ type: "prep", text: "Follow up on submitted applications", color: "#34d399" }); }
    if (i === 6) { tasks.push({ type: "prep", text: "Research new scholarships opening for next cycle", color: "#818cf8" }); }
    months.push({ label, tasks, month: monthNum, index: i });
  }
  return months;
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard({ profile, allList, saved, trackerFlat, tracker, onOpen, onTab }) {
  const name = profile?.name || null;
  const openSoon = allList.filter(s => isOpen(s) && daysUntil(s.deadlineDate) <= 30 && daysUntil(s.deadlineDate) >= 0);
  const thisMonth = allList.filter(s => {
    if (!isOpen(s) || !s.deadlineDate) return false;
    const dl = new Date(s.deadlineDate);
    return dl.getMonth() === NOW.getMonth() && dl.getFullYear() === NOW.getFullYear();
  });
  const topMatches = allList.filter(isOpen).map(s => ({ ...s, _match: computeMatch(s, profile) || 0 })).sort((a, b) => b._match - a._match).slice(0, 3);
  const gems = allList.filter(isHiddenGem).slice(0, 3);
  const applied = tracker["Applied"]?.length || 0;
  const awaiting = tracker["Awaiting Response"]?.length || 0;

  return (
    <div className="dash">
      {/* Welcome */}
      <div className="dash-welcome">
        <div>
          <h2 className="dash-hi">👋 {name ? `Welcome back, ${name}!` : "Welcome back!"}</h2>
          <p className="dash-sub">Here's your scholarship overview for today, {NOW.toLocaleDateString("default", { weekday: "long", month: "long", day: "numeric" })}</p>
        </div>
        <div className="dash-avatar">{name ? name[0].toUpperCase() : "🎓"}</div>
      </div>

      {/* Stats row */}
      <div className="dash-stats">
        {[
          { n: saved.length, l: "Saved", i: "🔖", c: "#a78bfa", action: () => onTab("saved") },
          { n: trackerFlat.length, l: "Tracking", i: "📋", c: "#60a5fa", action: () => onTab("tracker") },
          { n: thisMonth.length, l: "Due This Month", i: "📅", c: "#fbbf24", action: () => onTab("all") },
          { n: openSoon.length, l: "Closing Soon", i: "🔥", c: "#f87171", action: () => onTab("all") },
          { n: applied, l: "Applied", i: "📤", c: "#34d399", action: () => onTab("tracker") },
          { n: awaiting, l: "Awaiting", i: "⏳", c: "#f97316", action: () => onTab("tracker") },
        ].map(({ n, l, i, c, action }) => (
          <div key={l} className="dash-stat" onClick={action} style={{ cursor: "pointer", borderTop: `3px solid ${c}` }}>
            <span className="dash-stat-icon">{i}</span>
            <span className="dash-stat-n" style={{ color: c }}>{n}</span>
            <span className="dash-stat-l">{l}</span>
          </div>
        ))}
      </div>

      {/* Urgent deadlines */}
      {openSoon.length > 0 && (
        <div className="dash-section">
          <div className="dash-sec-head"><span className="dash-sec-title">🔥 Closing Within 30 Days</span><button className="dash-see-all" onClick={() => onTab("all")}>See all →</button></div>
          <div className="dash-list">
            {openSoon.slice(0, 4).map(s => (
              <div key={s.id} className="dash-item" onClick={() => onOpen(s)} style={{ borderLeft: `3px solid ${s.color || "#7c3aed"}` }}>
                <div className="dash-item-main">
                  <span className="dash-item-name">{getFlag(s.country)} {s.name}</span>
                  <CountdownBadge dateStr={s.deadlineDate} status={s.status} />
                </div>
                <span className="dash-item-meta">{s.amount}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top matches */}
      {profile && topMatches.length > 0 && (
        <div className="dash-section">
          <div className="dash-sec-head"><span className="dash-sec-title">🎯 Top Matches For You</span><button className="dash-see-all" onClick={() => onTab("all")}>See all →</button></div>
          <div className="dash-list">
            {topMatches.map(s => (
              <div key={s.id} className="dash-item" onClick={() => onOpen(s)} style={{ borderLeft: `3px solid ${s.color || "#7c3aed"}` }}>
                <div className="dash-item-main">
                  <span className="dash-item-name">{getFlag(s.country)} {s.name}</span>
                  <MatchBadge pct={s._match} />
                </div>
                <span className="dash-item-meta">{s.country} · {s.deadline}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hidden gems */}
      {gems.length > 0 && (
        <div className="dash-section">
          <div className="dash-sec-head"><span className="dash-sec-title">💎 Hidden Gems</span><button className="dash-see-all" onClick={() => onTab("gems")}>See all →</button></div>
          <div className="dash-list">
            {gems.map(s => (
              <div key={s.id} className="dash-item" onClick={() => onOpen(s)} style={{ borderLeft: "3px solid #a78bfa" }}>
                <div className="dash-item-main">
                  <span className="dash-item-name">{getFlag(s.country)} {s.name}</span>
                  <span className="gem-badge">💎 Hidden Gem</span>
                </div>
                <span className="dash-item-meta">{s.amount}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tracker progress */}
      {trackerFlat.length > 0 && (
        <div className="dash-section">
          <div className="dash-sec-head"><span className="dash-sec-title">📋 Application Progress</span><button className="dash-see-all" onClick={() => onTab("tracker")}>Manage →</button></div>
          <div className="trk-progress">
            {TRACKER_COLS.map(col => {
              const cnt = tracker[col]?.length || 0;
              const color = TRACKER_COLORS[col];
              return (
                <div key={col} className="trk-prog-item">
                  <div className="trk-prog-top"><span style={{ fontSize: ".75rem", color: "#9d8fcc" }}>{TRACKER_ICONS[col]} {col}</span><span style={{ fontSize: ".82rem", fontWeight: 700, color }}>{cnt}</span></div>
                  <div className="trk-prog-bar"><div style={{ height: "100%", background: color, borderRadius: 4, width: `${trackerFlat.length > 0 ? (cnt / trackerFlat.length) * 100 : 0}%`, transition: "width .6s ease" }} /></div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!profile && (
        <div className="dash-cta">
          <p className="dash-cta-text">🎯 Complete your profile to get personalized recommendations and match scores</p>
        </div>
      )}
    </div>
  );
}

// ── Timeline ──────────────────────────────────────────────────────────────────
function Timeline({ allList, profile, trackerFlat }) {
  const months = generateTimeline(allList, profile, trackerFlat);
  const [active, setActive] = useState(0);
  return (
    <div className="timeline-wrap">
      <div className="tl-header">
        <h2 className="tl-title">📅 Your Application Roadmap</h2>
        <p className="tl-sub">A personalised month-by-month guide to your scholarship applications</p>
      </div>
      {/* Month selector */}
      <div className="tl-months">
        {months.map((m, i) => (
          <button key={i} className={`tl-month-btn ${active === i ? "active" : ""}`} onClick={() => setActive(i)}>
            <span className="tl-month-name">{m.label.split(" ")[0]}</span>
            <span className="tl-month-year">{m.label.split(" ")[1]}</span>
            {m.tasks.filter(t => t.type === "deadline").length > 0 && <span className="tl-month-dot" />}
          </button>
        ))}
      </div>
      {/* Active month detail */}
      <div className="tl-detail">
        <div className="tl-detail-head">
          <h3 className="tl-detail-title">{months[active].label}</h3>
          <span className="tl-task-cnt">{months[active].tasks.length} task{months[active].tasks.length !== 1 ? "s" : ""}</span>
        </div>
        {months[active].tasks.length === 0 && <p style={{ color: "#3d3870", fontSize: ".88rem", padding: "20px 0" }}>No tasks or deadlines this month. Use this time to prepare!</p>}
        <div className="tl-tasks">
          {months[active].tasks.map((t, i) => (
            <div key={i} className={`tl-task ${t.urgent ? "tl-urgent" : ""}`} style={{ borderLeft: `3px solid ${t.color}` }}>
              <div className="tl-task-icon">{t.type === "deadline" ? "🎯" : "✅"}</div>
              <div className="tl-task-body">
                <p className="tl-task-text">{t.text}</p>
                {t.type === "deadline" && <span className="tl-task-tag" style={{ background: t.color + "22", color: t.color }}>Deadline</span>}
                {t.urgent && <span className="tl-task-tag" style={{ background: "#f8717122", color: "#f87171" }}>⚡ Urgent</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Full timeline bar */}
      <div className="tl-bar-wrap">
        <div className="tl-bar">
          {months.map((m, i) => {
            const hasDeadline = m.tasks.some(t => t.type === "deadline");
            const isNow = i === 0;
            return (
              <div key={i} className="tl-bar-seg" onClick={() => setActive(i)}>
                <div className={`tl-bar-dot ${isNow ? "tl-bar-now" : hasDeadline ? "tl-bar-dead" : ""}`} />
                {i < months.length - 1 && <div className="tl-bar-line" />}
              </div>
            );
          })}
        </div>
        <div className="tl-bar-labels">
          {months.map((m, i) => <span key={i} className="tl-bar-lbl" style={{ color: i === active ? "#c084fc" : "#3d3870" }}>{m.label.split(" ")[0].slice(0, 3)}</span>)}
        </div>
      </div>
    </div>
  );
}

// ── Hidden Gems Panel ─────────────────────────────────────────────────────────
function HiddenGems({ allList, profile, onOpen, onSave, isSaved, onTrack, isTracked, onCompare, isCompared }) {
  const gems = allList.filter(isHiddenGem);
  const GEM_REASONS = {
    "Need-Based": "Low applicant pool — financial need reduces competition",
    "Merit": "Merit-based with less name recognition = fewer applicants",
    "Regional": "Region-specific = only students from certain areas qualify",
    "Africa-Focused": "Targets African students specifically — highly targeted pool",
    "Professional": "Requires work experience — fewer qualifying applicants",
    "Leadership": "Leadership focus filters out most applicants",
    "Exchange": "Exchange programmes often have lower application volumes",
  };
  if (!gems.length) return (<div className="empty-state"><div style={{ fontSize: 44, marginBottom: 14 }}>💎</div><h3>No hidden gems found</h3><p>Refresh to auto-discover more niche scholarships</p></div>);
  return (
    <div>
      <div className="gems-header">
        <h2 className="gems-title">💎 Hidden Gem Scholarships</h2>
        <p className="gems-sub">Lower competition · Niche opportunities · High reward</p>
      </div>
      <div className="grid">
        {gems.map((s, i) => (
          <div key={s.id} className="card gem-card" style={{ animationDelay: `${i * 55}ms`, borderTop: `3px solid #a78bfa` }}>
            <div className="card-top">
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", flex: 1 }}>
                <span className="gem-badge-lg">💎 Hidden Gem</span>
                <span className="tag" style={{ background: (s.color || "#7c3aed") + "22", color: (s.color || "#7c3aed") }}>{s.tag}</span>
              </div>
              <button onClick={() => onCompare(s)} className="cmp-btn" style={{ color: isCompared(s) ? "#a78bfa" : "#3d3870" }}>⚖️</button>
            </div>
            <h3 className="card-title">{getFlag(s.country)} {s.name}</h3>
            <p className="card-host">{s.host}</p>
            <p className="card-country">{s.country} · {s.region}</p>
            <div className="gem-reason">
              <span className="gem-reason-icon">💡</span>
              <span className="gem-reason-text">{GEM_REASONS[s.tag] || "Less well-known = lower competition"}</span>
            </div>
            {profile && <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 9 }}><MatchBadge pct={computeMatch(s, profile)} /><AccBadge pct={computeAcceptance(s, profile)} /><CountdownBadge dateStr={s.deadlineDate} status={s.status} /></div>}
            <div className="card-details">
              <div className="drow"><span className="dico">💰</span><span>{s.amount}</span></div>
              <div className="drow"><span className="dico">📅</span><span>{s.deadline}</span></div>
              <div className="drow"><span className="dico">✅</span><span>{s.eligibility}</span></div>
            </div>
            {s.courses?.length > 0 && <div className="mini-courses">{s.courses.slice(0, 4).map((c, i) => <span key={i} className="mini-chip">{c}</span>)}{s.courses.length > 4 && <span className="mini-chip more">+{s.courses.length - 4}</span>}</div>}
            <div className="card-foot">
              <a href={s.link} target="_blank" rel="noopener noreferrer" className="link-btn">🔗 Site</a>
              <button className="view-btn" onClick={() => onOpen(s)}>Details →</button>
              <button className={`save-btn ${isSaved(s) ? "saved" : ""}`} onClick={() => onSave(s)}>{isSaved(s) ? "✅" : "🔖"}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Curated Data ──────────────────────────────────────────────────────────────
const CURATED = [
  { id: 1, name: "Chevening Scholarships", country: "United Kingdom", host: "UK Foreign Commonwealth & Development Office", amount: "Full funding – tuition + £1,093–£1,330/month + flights + visa", deadline: "5 Nov 2025", deadlineDate: "2025-11-05", status: "closed", eligibility: "2+ years work experience; eligible country citizenship; leadership potential", link: "https://www.chevening.org/scholarships/", field: "All Fields", region: "Europe", tag: "Prestigious", color: "#c0392b", courses: ["Public Policy", "International Relations", "Law", "Business", "STEM", "Economics", "Development Studies", "Public Health", "Computer Science", "Data Science"], howToApply: ["Register at chevening.org", "Choose up to 3 UK universities and courses", "Write 4 essays: leadership, UK study, career goals, why Chevening", "Request 2 professional referees", "Submit before November deadline", "Attend Embassy interview if shortlisted"] },
  { id: 2, name: "DAAD Scholarships", country: "Germany", host: "German Academic Exchange Service", amount: "€850–€1,200/month + travel + health insurance", deadline: "Oct–Dec 2025", deadlineDate: "2025-12-15", status: "open", eligibility: "Above-average academic record; relevant degree; German or English proficiency", link: "https://www.daad.de/en/study-and-research-in-germany/scholarships/", field: "All Fields", region: "Europe", tag: "Research", color: "#27ae60", courses: ["Engineering", "Natural Sciences", "Architecture", "Agriculture", "Medicine", "Economics", "Social Sciences", "Law", "Computer Science", "AI & Machine Learning", "Data Science"], howToApply: ["Browse DAAD scholarship finder at daad.de", "Register and apply on DAAD portal", "Write a motivation letter about your Germany study plans", "Gather transcripts, CV, language certificates", "Request 2–3 academic reference letters"] },
  { id: 3, name: "Gates Cambridge Scholarship", country: "United Kingdom", host: "Gates Cambridge Trust", amount: "Full funding – tuition + £21,756/year + airfare + family allowance", deadline: "3 Dec 2025", deadlineDate: "2025-12-03", status: "closed", eligibility: "Non-UK citizen applying to full-time Cambridge postgraduate course", link: "https://www.gatescambridge.org/apply/", field: "All Fields", region: "Europe", tag: "Elite", color: "#16a085", courses: ["Computer Science", "Engineering", "Natural Sciences", "Medicine", "Law", "Economics", "Philosophy", "Public Health", "Political Science", "AI & Machine Learning"], howToApply: ["Apply to Cambridge via Graduate Applicant Portal", "Tick Gates Cambridge in funding section", "Write a Why Gates Cambridge essay", "Virtual interview if shortlisted", "Decisions in late March/April"] },
  { id: 4, name: "Erasmus Mundus Joint Masters", country: "Multiple EU Countries", host: "European Commission", amount: "€1,400/month + full tuition waiver + travel costs", deadline: "Jan–Mar 2026", deadlineDate: "2026-03-01", status: "open", eligibility: "Bachelor's degree; non-EU/EEA citizens get priority for full award", link: "https://www.eacea.ec.europa.eu/scholarships/erasmus-mundus-catalogue_en", field: "All Fields", region: "Europe", tag: "Exchange", color: "#8e44ad", courses: ["Environmental Science", "Data Science", "Global Studies", "Journalism", "Biomedical Engineering", "Public Health", "Economics", "AI & Machine Learning", "Software Engineering", "Cybersecurity"], howToApply: ["Browse the Erasmus Mundus catalogue", "Apply directly to the programme consortium", "Write a programme-specific motivation letter", "Submit transcripts, diploma, CV, language certificate", "Provide 2 academic recommendation letters"] },
  { id: 5, name: "Fulbright Foreign Student Program", country: "United States", host: "U.S. Department of State", amount: "Full funding – tuition + airfare + monthly stipend + health insurance", deadline: "Varies by country (Feb–Oct)", deadlineDate: "2026-10-01", status: "open", eligibility: "Citizen of a Fulbright-participating country; bachelor's degree; strong English proficiency", link: "https://foreign.fulbrightonline.org/", field: "All Fields", region: "Americas", tag: "Government", color: "#2980b9", courses: ["Arts", "Business", "Education", "Engineering", "Journalism", "Law", "Medicine", "Science", "Social Sciences", "Computer Science", "Cybersecurity", "Data Science"], howToApply: ["Find your country's Fulbright commission", "Check country-specific deadline", "Complete the online application", "Write Personal Statement and Research Objective essays", "Submit transcripts, CV, and 3 recommendation letters"] },
  { id: 6, name: "Korean Government Scholarship (KGSP)", country: "South Korea", host: "NIIED", amount: "Full tuition + KRW 900,000/month + airfare + health insurance", deadline: "Feb–Apr 2026", deadlineDate: "2026-04-01", status: "open", eligibility: "Non-Korean citizen; under 25 (undergrad); GPA equivalent B+ or above", link: "https://www.studyinkorea.go.kr/en/sub/gks/allnew_overview.do", field: "All Fields", region: "Asia", tag: "Government", color: "#e91e8c", courses: ["Korean Language", "Engineering", "Computer Science", "Business", "Medicine", "Social Sciences", "Arts", "Education", "Environmental Science", "AI & Machine Learning"], howToApply: ["Choose Embassy Track or University Track", "Get KGSP form from Korean Embassy", "Prepare transcripts, diploma, personal statement, study plan", "Submit 2 recommendation letters", "Sit written exam and Embassy interview", "Complete 1-year Korean language programme"] },
  { id: 7, name: "MEXT Japanese Government Scholarship", country: "Japan", host: "Ministry of Education, Science & Technology Japan", amount: "Full tuition + ¥117,000–¥145,000/month + return airfare", deadline: "May–Jun 2026", deadlineDate: "2026-06-01", status: "open", eligibility: "Under 35; citizen of country with Japan diplomatic ties; strong academics", link: "https://www.mext.go.jp/en/", field: "All Fields", region: "Asia", tag: "Government", color: "#b5179e", courses: ["Science", "Engineering", "Agriculture", "Medicine", "Social Sciences", "Humanities", "Education", "Arts", "Law", "Computer Science", "Robotics"], howToApply: ["Apply via Embassy or University Recommendation", "Get MEXT form from Japanese Embassy", "Prepare transcripts, research plan, health certificate, 2 references", "Sit written exam at Embassy", "Complete 6-month Japanese language programme"] },
  { id: 8, name: "Chinese Government Scholarship (CSC)", country: "China", host: "China Scholarship Council", amount: "Full tuition + CNY 2,500–3,500/month + free accommodation + health insurance", deadline: "Mar–Apr 2026", deadlineDate: "2026-04-15", status: "open", eligibility: "Non-Chinese citizen; under 25 (undergrad) or 35 (postgrad); good academics", link: "https://www.campuschina.org/", field: "All Fields", region: "Asia", tag: "Government", color: "#e63946", courses: ["Medicine", "Engineering", "Agriculture", "Economics", "Law", "Management", "Science", "Literature", "Computer Science", "Data Science", "Fine Arts"], howToApply: ["Choose Type A (Embassy) or Type B (University Track)", "Register on CSC system", "Upload passport, transcripts, diploma, study plan, 2 references", "Submit physical examination form", "Results announced June/July"] },
  { id: 9, name: "Australia Awards Scholarships", country: "Australia", host: "Australian Government (DFAT)", amount: "Full funding – tuition + airfare + living costs + health cover", deadline: "Apr–Jun 2026", deadlineDate: "2026-06-30", status: "open", eligibility: "Citizen of eligible developing country; 2+ years work experience", link: "https://www.australiaawards.gov.au/", field: "All Fields", region: "Oceania", tag: "Development", color: "#e67e22", courses: ["Agriculture", "Business", "Education", "Engineering", "Environment", "Governance", "Health", "Law", "Social Work", "Infrastructure"], howToApply: ["Confirm country eligibility at australiaawards.gov.au", "Contact Australian Embassy for application pack", "Complete official form with certified documents", "Attach transcripts, 3 referee reports, personal statement", "Attend in-country interviews if shortlisted"] },
  { id: 10, name: "Swedish Institute Scholarships (SISGP)", country: "Sweden", host: "Swedish Institute", amount: "Full tuition waiver + SEK 11,000/month + travel grant", deadline: "10 Feb 2026", deadlineDate: "2026-02-10", status: "open", eligibility: "Eligible country citizen; 3,000+ hours paid work experience; leadership record", link: "https://si.se/en/apply/scholarships/", field: "All Fields", region: "Europe", tag: "Leadership", color: "#0077b6", courses: ["Sustainable Development", "Public Health", "Human Rights", "Urban Planning", "Business Administration", "IT", "Environmental Science", "Political Science", "Computer Science"], howToApply: ["Apply to Swedish master's at universityadmissions.se", "Apply for SISGP simultaneously at si.se", "Write motivation letter linking goals to country development", "Results announced May/June"] },
  { id: 11, name: "Turkish Government Scholarship", country: "Turkey", host: "Presidency for Turks Abroad", amount: "Full tuition + accommodation + health insurance + airfare", deadline: "Feb 2026", deadlineDate: "2026-02-20", status: "open", eligibility: "Any non-Turkish citizen; age limits apply; min. 70% academic score", link: "https://turkiyeburslari.gov.tr/", field: "All Fields", region: "Middle East", tag: "Government", color: "#e63946", courses: ["Medicine", "Engineering", "Agriculture", "Law", "Economics", "Social Sciences", "Education", "Arts", "Architecture", "Computer Science"], howToApply: ["Apply online at turkiyeburslari.gov.tr in February", "Select up to 12 Turkish universities", "Upload transcripts, diploma, language scores, passport", "Attend interview if shortlisted", "1-year Turkish language training", "Results announced June/July"] },
  { id: 12, name: "Stipendium Hungaricum (Hungary)", country: "Hungary", host: "Government of Hungary", amount: "Full tuition waiver + HUF 43,700/month + free dormitory + health insurance", deadline: "Jan 2026", deadlineDate: "2026-01-15", status: "open", eligibility: "Citizen of a partner country; nominated by home country nominating authority", link: "https://stipendiumhungaricum.hu/", field: "All Fields", region: "Europe", tag: "Government", color: "#c1121f", courses: ["Medicine", "Dentistry", "Pharmacy", "Engineering", "Agriculture", "Natural Sciences", "Arts", "Business", "Law", "Computer Science", "Data Science"], howToApply: ["Apply through your home country's nominating authority", "Register on Stipendium Hungaricum system", "Submit transcripts, diploma, motivation letter, CV, medical certificate", "Results announced April/May"] },
  { id: 13, name: "Eiffel Excellence Scholarship (France)", country: "France", host: "Campus France", amount: "€1,181/month (master's) or €1,400/month (PhD) + transport + health insurance", deadline: "Jan 2026", deadlineDate: "2026-01-12", status: "open", eligibility: "International students under 30 (master's) or 35 (PhD); nominated by a French institution", link: "https://www.campusfrance.org/en/the-eiffel-excellence-scholarship-program", field: "All Fields", region: "Europe", tag: "Excellence", color: "#0077b6", courses: ["Law", "Economics", "Management", "Political Science", "Engineering", "Exact Sciences", "Humanities", "Computer Science", "AI & Machine Learning", "Data Science"], howToApply: ["Apply for admission at a French institution", "Ask your host institution to nominate you", "French institution submits nomination through CampusFrance", "Results announced in April"] },
  { id: 14, name: "Mastercard Foundation Scholars Program", country: "Multiple Countries (Africa-focused)", host: "Mastercard Foundation + Partner Universities", amount: "Full funding – tuition + housing + meals + travel + tech stipend + mentorship", deadline: "Varies by partner university", deadlineDate: "2026-02-28", status: "open", eligibility: "Young Africans with academic talent and financial need; commitment to giving back", link: "https://mastercardfdn.org/all/scholars/", field: "All Fields", region: "Africa", tag: "Africa-Focused", color: "#ff6b35", courses: ["Agriculture", "Business", "Computer Science", "Education", "Engineering", "Environmental Science", "Health", "Law", "Public Policy", "Social Sciences", "AI & Machine Learning"], howToApply: ["Identify a partner university (Toronto, McGill, Cornell, AIMS)", "Apply for admission via standard process", "Write essay on leadership and vision for Africa", "Visit mastercardfdn.org for each partner's specific deadline"] },
  { id: 15, name: "Aga Khan Foundation Scholarship", country: "Multiple Countries", host: "Aga Khan Foundation", amount: "50% grant + 50% loan (effectively full funding)", deadline: "31 Mar 2026", deadlineDate: "2026-03-31", status: "open", eligibility: "Students from developing countries; academic merit AND financial need required", link: "https://www.akdn.org/our-agencies/aga-khan-foundation/international-scholarships", field: "All Fields", region: "Africa", tag: "Need-Based", color: "#457b9d", courses: ["Architecture", "Agriculture", "Development Studies", "Economics", "Health Sciences", "Law", "Public Administration", "Social Sciences", "Education", "Computer Science"], howToApply: ["Confirm country eligibility at akdn.org", "Download form from local AKF office (opens January)", "Demonstrate both academic merit AND financial need", "Provide proof of admission to graduate institution", "Submit financial documents"] },
  { id: 16, name: "KAUST Fellowship (Saudi Arabia)", country: "Saudi Arabia", host: "King Abdullah University of Science and Technology", amount: "Full funding – tuition + SAR 3,200–5,000/month + housing + health + travel", deadline: "Jan 2026", deadlineDate: "2026-01-15", status: "open", eligibility: "STEM bachelor's degree; strong GRE/GPA; all nationalities welcome", link: "https://admissions.kaust.edu.sa/", field: "STEM", region: "Middle East", tag: "Research", color: "#2d6a4f", courses: ["Computer Science", "Electrical Engineering", "Environmental Science", "Bioscience", "Marine Science", "Mathematics", "Applied Physics", "Chemical Engineering", "Data Science", "AI & Machine Learning", "Cybersecurity"], howToApply: ["Apply online at admissions.kaust.edu.sa", "Submit GRE scores, transcripts, 3 references, statement of purpose", "Attend interview if shortlisted", "All admitted students automatically receive KAUST Fellowship"] },
  { id: 17, name: "Russian Government Scholarship", country: "Russia", host: "Ministry of Science and Higher Education", amount: "Full tuition waiver + monthly stipend + free accommodation", deadline: "Feb–Apr 2026", deadlineDate: "2026-04-01", status: "open", eligibility: "Non-Russian citizen; good academic record; pass medical examination", link: "https://education-in-russia.com/", field: "All Fields", region: "Europe", tag: "Government", color: "#d62828", courses: ["Medicine", "Engineering", "Technology", "Natural Sciences", "Mathematics", "Economics", "Law", "Architecture", "Arts", "Computer Science", "Aviation"], howToApply: ["Apply through Russia.edu.ru online system", "Select up to 6 Russian universities", "Upload passport, certificates, medical certificate", "Submit motivation letter and language documents"] },
  { id: 18, name: "OFID Scholarship Award", country: "Multiple Countries", host: "OPEC Fund for International Development", amount: "USD $100,000 over 2 years (master's level)", deadline: "Jun 2026", deadlineDate: "2026-06-30", status: "open", eligibility: "Citizen of developing country; under 35; financial need; accepted to master's programme", link: "https://opecfund.org/programs/scholarships", field: "All Fields", region: "Africa", tag: "Need-Based", color: "#f4a261", courses: ["Economics", "Development Studies", "Energy Studies", "Environmental Science", "Engineering", "Public Health", "Business", "Social Sciences", "Computer Science"], howToApply: ["Confirm your country qualifies as developing", "Secure admission to a master's programme abroad", "Apply online at opecfund.org during June window", "Upload acceptance letter, transcripts, CV, financial need statement"] },
  { id: 19, name: "Vanier Canada Graduate Scholarships", country: "Canada", host: "Government of Canada", amount: "CAD $50,000/year for up to 3 years", deadline: "1 Nov 2025", deadlineDate: "2025-11-01", status: "closed", eligibility: "Doctoral students; academic excellence + research potential + leadership", link: "https://vanier.gc.ca/en/home-accueil.html", field: "STEM", region: "Americas", tag: "Research", color: "#d62828", courses: ["Health Sciences", "Natural Sciences", "Engineering", "Social Sciences", "Computer Science", "Data Science", "AI & Machine Learning", "Biomedical Engineering"], howToApply: ["Must be nominated by a Canadian university", "Contact graduate studies office of your chosen university", "University nominates to Vanier CGS by Nov 1"] },
  { id: 20, name: "Holland Scholarship", country: "Netherlands", host: "Dutch Ministry of Education", amount: "€5,000 one-time grant (tuition offset)", deadline: "1 May 2026", deadlineDate: "2026-05-01", status: "open", eligibility: "Non-EEA student; starting first year of bachelor's or master's in Netherlands", link: "https://www.studyinholland.nl/scholarships/holland-scholarship", field: "All Fields", region: "Europe", tag: "Merit", color: "#f4845f", courses: ["Agriculture", "Technology", "Water Management", "Design", "Business", "Social Sciences", "Arts", "Natural Sciences", "Health Sciences", "Computer Science"], howToApply: ["Apply for admission to a Dutch university", "Apply through your university's scholarship portal once admitted", "Write motivation letter about your Netherlands study choice"] },
];

const AUTO_PROMPT = `You are a live scholarship database. Today is ${new Date().toDateString()}. Find 6 NEW open scholarships for international students. Do NOT repeat: Chevening, DAAD, Gates Cambridge, Erasmus Mundus, Fulbright, KGSP, MEXT, CSC China, Australia Awards, Swedish Institute SISGP, Turkish Government, Stipendium Hungaricum, Eiffel, Mastercard Foundation, Aga Khan, KAUST, Russian Government, OFID, Vanier Canada, Holland Scholarship. Reply ONLY with raw JSON no markdown no backticks: {"scholarships":[{"name":"","host":"","country":"","amount":"","deadline":"","deadlineDate":"YYYY-MM-DD","status":"open","eligibility":"","link":"https://example.com","field":"All Fields","region":"Europe","tag":"Merit","color":"#hex","courses":[""],"howToApply":[""]}],"fetchedAt":"${new Date().toISOString()}"}`;
const CACHE_KEY = "scholar_v6"; const CACHE_HRS = 12;

async function loadAuto() {
  try { const c = localStorage.getItem(CACHE_KEY); if (c) { const d = JSON.parse(c); if ((Date.now() - new Date(d.fetchedAt).getTime()) / 3600000 < CACHE_HRS && d.scholarships?.length) return { list: d.scholarships, cached: true }; } } catch (_) { }
  const raw = await callAI(AUTO_PROMPT, "Output ONLY raw JSON. No markdown. No backticks. No extra text.");
  const m = raw.match(/\{[\s\S]*\}/); if (!m) throw new Error("No JSON");
  const parsed = JSON.parse(m[0]); if (!parsed.scholarships?.length) throw new Error("Empty");
  parsed.scholarships = parsed.scholarships.map((s, i) => ({ ...s, id: `auto-${Date.now()}-${i}` }));
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ scholarships: parsed.scholarships, fetchedAt: new Date().toISOString() })); } catch (_) { }
  return { list: parsed.scholarships, cached: false };
}

const QUIZ = [
  { k: "name", q: "What is your first name?", icon: "👤", opts: [] },
  { k: "region", q: "Where are you from?", icon: "🌍", opts: ["Africa", "Asia", "Americas", "Europe", "Middle East", "Oceania"] },
  { k: "level", q: "What level are you applying for?", icon: "🎓", opts: ["undergraduate", "master's", "PhD", "any"] },
  { k: "field", q: "What do you want to study?", icon: "📚", opts: ["Computer Science", "AI & Machine Learning", "Data Science", "Cybersecurity", "Engineering", "Medicine", "Business", "Law", "Arts & Humanities", "Social Sciences", "Any"] },
  { k: "gpa", q: "What is your GPA or grade equivalent?", icon: "📊", opts: ["3.8–4.0", "3.5–3.7", "3.0–3.4", "Below 3.0", "N/A"] },
  { k: "ielts", q: "Do you have an English proficiency certificate?", icon: "🗣️", opts: ["yes", "no", "in progress"] },
  { k: "workExp", q: "Do you have work experience?", icon: "💼", opts: ["2+", "less than 2 years", "none"] },
  { k: "need", q: "Funding preference?", icon: "💰", opts: ["Fully funded only", "Partial is fine", "No preference"] },
];

function QuizModal({ onDone, onSkip }) {
  const [step, setStep] = useState(0); const [ans, setAns] = useState({}); const [txt, setTxt] = useState("");
  const q = QUIZ[step]; const pct = Math.round((step / QUIZ.length) * 100);
  const pick = v => { const n = { ...ans, [q.k]: v }; setAns(n); setTxt(""); if (step < QUIZ.length - 1) setStep(step + 1); else onDone(n); };
  const pickTxt = () => { if (txt.trim()) pick(txt.trim()); };
  return (
    <div className="overlay">
      <div className="quiz-box">
        <button className="skip-btn" onClick={onSkip}>Skip →</button>
        <div className="qpb"><div className="qpf" style={{ width: `${pct}%` }} /></div>
        <p className="q-lbl">Step {step + 1} of {QUIZ.length}</p>
        <div className="q-icon">{q.icon}</div>
        <h2 className="q-title">{q.q}</h2>
        {q.opts.length === 0 ? (
          <div style={{ display: "flex", gap: 8 }}>
            <input className="filt-sel" style={{ flex: 1, borderRadius: 10, padding: "10px 14px" }} placeholder="Type your name..." value={txt} onChange={e => setTxt(e.target.value)} onKeyDown={e => e.key === "Enter" && pickTxt()} autoFocus />
            <button className="search-btn" onClick={pickTxt} style={{ borderRadius: 10 }}>→</button>
          </div>
        ) : (
          <div className="q-opts">{q.opts.map(o => <button key={o} className="q-opt" onClick={() => pick(o)}>{o}</button>)}</div>
        )}
      </div>
    </div>
  );
}

const SYS = `You are ScholarBot, an expert AI scholarship advisor helping international students find and apply for scholarships worldwide. Known scholarships in database: Chevening, DAAD, Gates Cambridge, Erasmus Mundus, Fulbright, KGSP Korea, MEXT Japan, CSC China, Australia Awards, Swedish Institute SISGP, Turkish Government, Stipendium Hungaricum, Eiffel France, Mastercard Foundation, Aga Khan Foundation, KAUST Saudi Arabia, Russian Government, OFID, Vanier Canada, Holland Scholarship, and many more. When responding: 1. Recommend specific scholarships by name. 2. Explain WHY each one matches the student. 3. Warn about any requirements they might not meet. 4. Suggest safer alternatives. 5. Give actionable next steps. Be warm, specific, honest. Keep responses under 350 words.`;

function ChatModal({ onClose }) {
  const [msgs, setMsgs] = useState([{ role: "assistant", content: "Hi! I am ScholarBot, your personal scholarship advisor.\n\nTell me about yourself — your country, GPA, field of study, and what you are looking for.\n\nExample: I am from Nigeria, 3.8 GPA, want a fully funded master's in Computer Science in Europe with no IELTS.\n\nI will find scholarships that match you and explain exactly why." }]);
  const [inp, setInp] = useState(""); const [loading, setLoading] = useState(false); const botRef = useRef(null);
  useEffect(() => botRef.current?.scrollIntoView({ behavior: "smooth" }), [msgs]);
  const send = async () => {
    if (!inp.trim() || loading) return;
    const um = { role: "user", content: inp.trim() }; const hist = [...msgs, um]; setMsgs(hist); setInp(""); setLoading(true);
    try {
      const txt = await callAIChat(hist, SYS);
      setMsgs(p => [...p, { role: "assistant", content: txt || "I could not generate a response. Please try again." }]);
    } catch { setMsgs(p => [...p, { role: "assistant", content: "I am having trouble connecting right now. This works best when deployed with your own API key. Try again!" }]); }
    setLoading(false);
  };
  const chips = ["I am from Nigeria, want fully funded CS master's in Europe, no IELTS", "Best scholarships for Kenyan students in medicine?", "Scholarships for undergraduate in Japan or Korea", "What are the easiest fully funded scholarships?"];
  return (
    <div className="overlay" onClick={onClose}>
      <div className="chat-box" onClick={e => e.stopPropagation()}>
        <div className="chat-head">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}><div className="chat-av">🤖</div><div><p className="chat-name">ScholarBot</p><p className="chat-sub">AI Scholarship Advisor</p></div></div>
          <button className="x-btn" onClick={onClose}>✕</button>
        </div>
        <div className="chat-msgs">
          {msgs.map((m, i) => (
            <div key={i} className={`msg ${m.role === "user" ? "msg-u" : "msg-b"}`}>
              {m.role === "assistant" && <div className="bot-av">🤖</div>}
              <div className={`bubble ${m.role === "user" ? "bub-u" : "bub-b"}`}>{m.content.split("\n").map((l, li) => <p key={li} style={{ margin: li > 0 ? "4px 0 0" : 0 }}>{l}</p>)}</div>
            </div>
          ))}
          {loading && <div className="msg msg-b"><div className="bot-av">🤖</div><div className="bubble bub-b"><span className="dot" /><span className="dot" /><span className="dot" /></div></div>}
          <div ref={botRef} />
        </div>
        {msgs.length <= 1 && <div className="chips">{chips.map((c, i) => <button key={i} className="chip" onClick={() => setInp(c)}>{c}</button>)}</div>}
        <div className="chat-inp-row">
          <input className="chat-inp" placeholder="Tell me about yourself..." value={inp} onChange={e => setInp(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()} />
          <button className="send-btn" onClick={send} disabled={loading || !inp.trim()}>{loading ? "⏳" : "➤"}</button>
        </div>
      </div>
    </div>
  );
}

const DOC_TYPES = [{ k: "sop", l: "📝 Statement of Purpose" }, { k: "ml", l: "💌 Motivation Letter" }, { k: "plan", l: "📋 Study Plan" }, { k: "rec", l: "📧 Recommendation Request" }];
function SOPModal({ s, profile, onClose }) {
  const [dt, setDt] = useState("sop"); const [gen, setGen] = useState(false); const [res, setRes] = useState(""); const [copied, setCopied] = useState(false);
  const [info, setInfo] = useState({ name: profile?.name || "", bg: "", goals: "" });
  const generate = async () => {
    setGen(true); setRes("");
    const prompts = { sop: `Write a compelling Statement of Purpose (~500 words) for ${info.name || "a student"} applying to the ${s.name} scholarship. Background: ${info.bg || "not specified"}. Goals: ${info.goals || "not specified"}. GPA: ${profile?.gpa || "not specified"}. Field: ${profile?.field || s.field}. Country: ${profile?.region || "international"}. Host: ${s.host} in ${s.country}. Be personal, professional, and specific.`, ml: `Write a Motivation Letter (~400 words) for ${info.name || "a student"} applying to ${s.name}. Background: ${info.bg || "not specified"}. Goals: ${info.goals || "not specified"}. Host: ${s.host}, Country: ${s.country}. Be warm and persuasive.`, plan: `Write a structured Study Plan for a student applying to ${s.name}. Field: ${profile?.field || s.field}. Level: ${profile?.level || "postgraduate"}. Goals: ${info.goals || "not specified"}. Include Year 1, Year 2, research focus, career goals, contribution to home country.`, rec: `Write a professional email requesting a recommendation letter for ${s.name}. Student: ${info.name || "[Student Name]"}. Deadline: ${s.deadline}. Programme: ${profile?.field || s.field}. Make it polite and concise.` };
    try {
      const txt = await callAI(prompts[dt], "You are an expert scholarship application writer. Write professional authentic documents.");
      setRes(txt);
    } catch { setRes("Generation failed. This works best when deployed with your own API key."); }
    setGen(false);
  };
  const copy = () => { navigator.clipboard.writeText(res); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sop-box" onClick={e => e.stopPropagation()}>
        <div className="sop-head"><div><h3 className="sop-title">✍️ Document Generator</h3><p className="sop-sub">For: {s.name}</p></div><button className="x-btn" onClick={onClose}>✕</button></div>
        <div className="sop-tabs">{DOC_TYPES.map(d => <button key={d.k} className={`sop-tab ${dt === d.k ? "active" : ""}`} onClick={() => { setDt(d.k); setRes(""); }}>{d.l}</button>)}</div>
        <div className="sop-fields">
          <input className="sop-inp" placeholder="Your full name" value={info.name} onChange={e => setInfo(p => ({ ...p, name: e.target.value }))} />
          <input className="sop-inp" placeholder="Your background (degree, university, brief)" value={info.bg} onChange={e => setInfo(p => ({ ...p, bg: e.target.value }))} />
          <textarea className="sop-inp sop-ta" placeholder="Your career goals and why you want this scholarship..." value={info.goals} onChange={e => setInfo(p => ({ ...p, goals: e.target.value }))} rows={3} />
        </div>
        <button className="gen-btn" onClick={generate} disabled={gen}>{gen ? <><span className="spin-sm" />Generating...</> : `✨ Generate ${DOC_TYPES.find(d => d.k === dt)?.l}`}</button>
        {res && (<div className="sop-res"><div className="sop-res-head"><span style={{ fontSize: ".74rem", color: "#7e78a8" }}>Review and personalize before use</span><button className="copy-btn" onClick={copy}>{copied ? "✅ Copied!" : "📋 Copy"}</button></div><div className="sop-res-body">{res}</div></div>)}
      </div>
    </div>
  );
}

function ComparePanel({ items, onRemove, onClear, profile }) {
  if (!items.length) return (<div className="empty-state"><div style={{ fontSize: 44, marginBottom: 14 }}>⚖️</div><h3>No scholarships to compare</h3><p>Click ⚖️ on any card to add it here</p></div>);
  const rows = [{ l: "💰 Funding", k: "amount" }, { l: "📅 Deadline", k: "deadline" }, { l: "✅ Eligibility", k: "eligibility" }, { l: "🌍 Country", k: "country" }, { l: "🗺️ Region", k: "region" }];
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 8 }}>
        <p style={{ color: "#7e78a8", fontSize: ".88rem" }}>{items.length} selected · Max 3</p>
        <button onClick={onClear} style={{ background: "transparent", border: "1px solid #2a2560", borderRadius: 8, padding: "5px 12px", color: "#5a5488", fontFamily: "inherit", fontSize: ".76rem", cursor: "pointer" }}>Clear All</button>
      </div>
      <div className="cmp-table">
        <div className="cmp-row cmp-header">
          <div className="cmp-lbl" />
          {items.map(s => (
            <div key={s.id} className="cmp-col-head">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 5 }}><span style={{ fontSize: ".8rem", fontWeight: 700, color: "#fff", lineHeight: 1.3 }}>{getFlag(s.country)} {s.name}</span><button onClick={() => onRemove(s)} style={{ background: "transparent", border: "none", color: "#3d3870", cursor: "pointer", fontSize: 12 }}>✕</button></div>
              <div style={{ marginTop: 5, display: "flex", gap: 4, flexWrap: "wrap" }}>
                <span className={`sbadge ${isOpen(s) ? "sopen" : "sclosed"}`} style={{ fontSize: "9px" }}>{isOpen(s) ? "🟢 Open" : "🔴 Closed"}</span>
                <CountdownBadge dateStr={s.deadlineDate} status={s.status} />
                {profile && <MatchBadge pct={computeMatch(s, profile)} />}
              </div>
            </div>
          ))}
        </div>
        {rows.map(r => <div key={r.l} className="cmp-row"><div className="cmp-lbl">{r.l}</div>{items.map(s => <div key={s.id} className="cmp-cell">{s[r.k] || "—"}</div>)}</div>)}
        <div className="cmp-row"><div className="cmp-lbl">📚 Courses</div>{items.map(s => <div key={s.id} className="cmp-cell"><div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>{(s.courses || []).slice(0, 5).map((c, i) => <span key={i} className="mini-chip">{c}</span>)}{(s.courses || []).length > 5 && <span className="mini-chip more">+{s.courses.length - 5}</span>}</div></div>)}</div>
        <div className="cmp-row"><div className="cmp-lbl">🔗 Apply</div>{items.map(s => <div key={s.id} className="cmp-cell"><a href={s.link} target="_blank" rel="noopener noreferrer" className="pri-btn" style={{ fontSize: ".74rem", padding: "6px 11px" }}>Visit Site</a></div>)}</div>
      </div>
    </div>
  );
}

function Tracker({ tracker, onMove, onRemove }) {
  const all = Object.values(tracker).flat();
  if (!all.length) return (<div className="empty-state"><div style={{ fontSize: 44, marginBottom: 14 }}>📋</div><h3>Tracker is empty</h3><p>Click Track Application on any scholarship to add it here</p></div>);
  return (
    <div>
      <p style={{ color: "#7e78a8", marginBottom: 18, fontSize: ".88rem" }}>{all.length} scholarship{all.length > 1 ? "s" : ""} tracked</p>
      <div className="trk-board">
        {TRACKER_COLS.map(col => {
          const items = tracker[col] || []; const tc = TRACKER_COLORS[col];
          return (
            <div key={col} className="trk-col">
              <div className="trk-head" style={{ borderBottom: `2px solid ${tc}` }}><span>{TRACKER_ICONS[col]}</span><span className="trk-col-name">{col}</span><span className="trk-cnt" style={{ background: tc + "33", color: tc }}>{items.length}</span></div>
              <div className="trk-body">
                {!items.length && <div className="trk-empty">Empty</div>}
                {items.map(s => (
                  <div key={s.id} className="trk-card" style={{ borderLeft: `3px solid ${isOpen(s) ? (s.color || "#7c3aed") : "#444"}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 5, marginBottom: 5 }}><span style={{ fontSize: ".74rem", fontWeight: 700, color: "#e2dff5", lineHeight: 1.3 }}>{getFlag(s.country)} {s.name}</span><button onClick={() => onRemove(s)} style={{ background: "transparent", border: "none", color: "#3d3870", cursor: "pointer", fontSize: 11 }}>✕</button></div>
                    <p style={{ fontSize: ".67rem", color: "#5a5488", marginBottom: 5 }}>{s.country}</p>
                    <CountdownBadge dateStr={s.deadlineDate} status={s.status} />
                    <div className="trk-btns">{TRACKER_COLS.filter(c => c !== col).map(c => <button key={c} className="trk-mv-btn" onClick={() => onMove(s, c)}>→ {c}</button>)}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Modal({ s, onClose, onSave, saved, allList, profile, onOpen, onTrack, tracked, onCompare, compared, onSOP }) {
  const open = isOpen(s); const flag = getFlag(s.country); const match = computeMatch(s, profile);
  const similar = allList.filter(x => x.id !== s.id && (x.region === s.region || x.courses?.some(c => s.courses?.includes(c)))).sort((a, b) => (computeMatch(b, profile) || 0) - (computeMatch(a, profile) || 0)).slice(0, 3);
  useEffect(() => { const fn = e => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", fn); return () => window.removeEventListener("keydown", fn); }, [onClose]);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <button className="x-btn" style={{ position: "sticky", top: 12, float: "right", margin: "12px 12px 0 0", zIndex: 10 }} onClick={onClose}>✕</button>
        <div className="modal-head" style={{ borderTop: `4px solid ${s.color || "#7c3aed"}` }}>
          <div className="modal-badges"><span className="tag" style={{ background: (s.color || "#7c3aed") + "22", color: (s.color || "#7c3aed") }}>{s.tag}</span><span className={`sbadge ${open ? "sopen" : "sclosed"}`}>{open ? "🟢 Open" : "🔴 Closed"}</span><CountdownBadge dateStr={s.deadlineDate} status={s.status} />{match !== null && <MatchBadge pct={match} />}</div>
          <h2 className="modal-title">{flag} {s.name}</h2>
          <p className="card-host">{s.host} · {s.country}</p>
        </div>
        <div className="modal-body">
          <div className="msec"><span className="sec-lbl">📋 Overview</span><div className="drow"><span className="dico">💰</span><span>{s.amount}</span></div><div className="drow"><span className="dico">📅</span><span>Deadline: <strong style={{ color: "#e2dff5" }}>{s.deadline}</strong></span></div><div className="drow"><span className="dico">🎓</span><span>{s.eligibility}</span></div><div className="drow"><span className="dico">🗺️</span><span>{s.field} · {s.region}</span></div></div>
          {profile && <AccBreakdown s={s} p={profile} />}

          {/* ==================== NEW CODE STARTS HERE ==================== */}

          {/* Difficulty Meter */}
          <div className="msec">
            <span className="sec-lbl">⚔️ Difficulty Level</span>
            {(() => {
              const diff = computeDifficulty(s);
              return (
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "#13102a", borderRadius: 12 }}>
                  <span style={{ fontSize: "28px" }}>{diff.level.split(" ")[0]}</span>
                  <div>
                    <div style={{ fontWeight: 700, color: diff.color }}>{diff.level}</div>
                    <div style={{ fontSize: ".75rem", color: "#7e78a8" }}>Chance of getting in</div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Netflix-style Recommendation */}
          <div className="msec">
            <span className="sec-lbl">🎥 Because you viewed {s.name.split(" ")[0]}...</span>
            <div className="similar-grid">
              {getRecommendations(s, allList, profile).map(rec => (
                <div key={rec.id} className="sim-card"
                  onClick={() => { onClose(); setTimeout(() => onOpen(rec), 100); }}
                  style={{ cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: ".75rem", color: "#34d399" }}>{rec.recScore}% Match</span>
                  </div>
                  <p className="sim-name">{getFlag(rec.country)} {rec.name}</p>
                  <p className="sim-meta">{rec.country} · {rec.amount}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ==================== NEW CODE ENDS HERE ==================== */}

          {s.courses?.length > 0 && <div className="msec"><span className="sec-lbl">📚 Courses / Fields Covered ({s.courses.length})</span><div className="courses-wrap">{s.courses.map((c, i) => <span key={i} className="course-chip">{c}</span>)}</div></div>}
          <div className="msec"><span className="sec-lbl">📝 How to Apply — Step by Step</span><ol className="how-list">{(s.howToApply || ["Visit the official website."]).map((step, i) => <li key={i} className="how-step"><span className="step-n">{i + 1}</span><span>{step}</span></li>)}</ol></div>
          <div className="modal-actions">
            <a href={s.link} target="_blank" rel="noopener noreferrer" className="pri-btn">🌐 Official Website</a>
            <button className={`sec-btn ${saved ? "active-green" : ""}`} onClick={() => onSave(s)}>{saved ? "✅ Saved" : "🔖 Save"}</button>
            <button className={`sec-btn ${tracked ? "active-blue" : ""}`} onClick={() => onTrack(s)}>{tracked ? "📋 Tracking" : "📋 Track"}</button>
            <button className={`sec-btn ${compared ? "active-purple" : ""}`} onClick={() => { onCompare(s); onClose(); }}>{compared ? "⚖️ In Compare" : "⚖️ Compare"}</button>
            <button className="sec-btn" onClick={() => onSOP(s)}>✍️ Generate Docs</button>
          </div>
          {similar.length > 0 && <div className="msec" style={{ marginTop: 24 }}><span className="sec-lbl">✨ Similar Scholarships</span><div className="similar-grid">{similar.map(sim => <div key={sim.id} className="sim-card" onClick={() => { onClose(); setTimeout(() => onOpen(sim), 50); }} style={{ borderLeft: `3px solid ${isOpen(sim) ? (sim.color || "#7c3aed") : "#444"}` }}><div style={{ display: "flex", justifyContent: "space-between", gap: 4, marginBottom: 5, flexWrap: "wrap" }}><span className="tag" style={{ background: (sim.color || "#7c3aed") + "22", color: (sim.color || "#7c3aed"), fontSize: "9px" }}>{sim.tag}</span><div style={{ display: "flex", gap: 3 }}>{profile && <MatchBadge pct={computeMatch(sim, profile)} />}<CountdownBadge dateStr={sim.deadlineDate} status={sim.status} /></div></div><p className="sim-name">{getFlag(sim.country)} {sim.name}</p><p className="sim-meta">{sim.amount}</p></div>)}</div></div>}
        </div>
      </div>
    </div>
  );
}

function Card({ s, index, onOpen, onSave, saved, badge, profile, onCompare, compared, onTrack, tracked }) {
  const open = isOpen(s); const match = computeMatch(s, profile); const flag = getFlag(s.country);
  const days = daysUntil(s.deadlineDate); const pPct = s.deadlineDate ? Math.max(0, Math.min(100, ((365 - (days || 0)) / 365) * 100)) : 0;
  const pCol = (days || 0) <= 7 ? "#f87171" : (days || 0) <= 30 ? "#fbbf24" : "#34d399";
  const acc = computeAcceptance(s, profile);
  return (
    <div className={`card ${!open ? "card-off" : ""}`} style={{ animationDelay: `${Math.min(index, 14) * 45}ms`, borderTop: `3px solid ${open ? (s.color || "#7c3aed") : "#444"}` }}>
      <div className="card-top">
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", flex: 1 }}><span className="tag" style={open ? { background: (s.color || "#7c3aed") + "22", color: (s.color || "#7c3aed") } : { background: "#33333388", color: "#666" }}>{s.tag}</span>{badge && <span className="new-badge">{badge}</span>}{tracked && <span className="new-badge" style={{ background: "#1d4ed833", color: "#60a5fa", borderColor: "#1d4ed855" }}>📋</span>}</div>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}><button onClick={() => onCompare(s)} className="cmp-btn" style={{ color: compared ? "#a78bfa" : "#3d3870" }}>⚖️</button><span className={`sbadge ${open ? "sopen" : "sclosed"}`}>{open ? "🟢" : "🔴"}</span></div>
      </div>
      <h3 className="card-title">{flag} {s.name}</h3>
      <p className="card-host">{s.host}</p>
      <p className="card-country">{s.country} · {s.region}</p>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 9 }}>{match !== null && <MatchBadge pct={match} />}{acc !== null && <AccBadge pct={acc} />}<CountdownBadge dateStr={s.deadlineDate} status={s.status} /></div>
      <div className="card-details"><div className="drow"><span className="dico">💰</span><span>{s.amount}</span></div><div className="drow"><span className="dico">📅</span><span>{s.deadline}</span></div><div className="drow"><span className="dico">✅</span><span>{s.eligibility}</span></div></div>
      {open && s.deadlineDate && <div className="dl-bar-wrap"><div className="dl-track"><div className="dl-fill" style={{ width: `${pPct}%`, background: pCol }} /></div><span style={{ fontSize: ".67rem", color: pCol }}>{(days || 0) <= 0 ? "Closing soon" : `${days}d remaining`}</span></div>}
      {s.courses?.length > 0 && <div className="mini-courses">{s.courses.slice(0, 4).map((c, i) => <span key={i} className="mini-chip">{c}</span>)}{s.courses.length > 4 && <span className="mini-chip more">+{s.courses.length - 4}</span>}</div>}
      <div className="card-foot">
        <a href={s.link} target="_blank" rel="noopener noreferrer" className="link-btn">🔗 Site</a>
        <button className="view-btn" onClick={() => onOpen(s)}>Details & Apply →</button>
        <button className={`save-btn ${saved ? "saved" : ""}`} onClick={() => onSave(s)}>{saved ? "✅" : "🔖"}</button>
      </div>
    </div>
  );
}

function SavedPanel({ saved, onRemove, onOpen, profile, onCompare, compareList, onTrack, trackerFlat }) {
  if (!saved.length) return (<div className="empty-state"><div style={{ fontSize: 44, marginBottom: 14 }}>🔖</div><h3>Nothing saved yet</h3><p>Click 🔖 on any card to save it here</p></div>);
  return (<><p style={{ color: "#7e78a8", marginBottom: 18, fontSize: ".88rem" }}>{saved.length} saved</p><div className="grid">{saved.map((s, i) => <Card key={s.id || i} s={s} index={i} onOpen={onOpen} onSave={onRemove} saved={true} profile={profile} onCompare={onCompare} compared={compareList.some(x => (x.id ?? x.name) === (s.id ?? s.name))} onTrack={onTrack} tracked={trackerFlat.some(x => (x.id ?? x.name) === (s.id ?? s.name))} />)}</div></>);
}

// ── Heatmap ───────────────────────────────────────────────────────────────────
const REGION_DATA = [
  { id: "Europe", label: "Europe", x: 48, y: 22, r: 52, color: "#7c3aed", countries: ["UK", "Germany", "France", "Sweden", "Netherlands", "Hungary", "Russia", "Finland", "Italy", "Switzerland"] },
  { id: "Asia", label: "Asia", x: 72, y: 35, r: 48, color: "#2980b9", countries: ["Japan", "South Korea", "China", "Taiwan", "India", "Singapore", "Malaysia"] },
  { id: "Americas", label: "Americas", x: 22, y: 38, r: 44, color: "#27ae60", countries: ["USA", "Canada", "Brazil", "Mexico"] },
  { id: "Africa", label: "Africa", x: 50, y: 58, r: 36, color: "#e67e22", countries: ["Nigeria", "Kenya", "Ghana", "Ethiopia", "South Africa", "Egypt"] },
  { id: "Middle East", label: "Middle East", x: 60, y: 45, r: 30, color: "#c0392b", countries: ["Saudi Arabia", "Qatar", "UAE", "Turkey"] },
  { id: "Oceania", label: "Oceania", x: 82, y: 68, r: 26, color: "#16a085", countries: ["Australia", "New Zealand"] },
];

function Heatmap({ allList, profile, onTab }) {
  const [hovered, setHovered] = useState(null);
  const [selected, setSelected] = useState(null);

  const regionCounts = REGION_DATA.map(r => {
    const count = allList.filter(s => s.region === r.id && isOpen(s)).length;
    const total = allList.filter(s => s.region === r.id).length;
    return { ...r, count, total };
  });
  const maxCount = Math.max(...regionCounts.map(r => r.count), 1);

  const active = selected || hovered;
  const activeRegion = regionCounts.find(r => r.id === active);
  const activeScholarships = active ? allList.filter(s => s.region === active && isOpen(s)).slice(0, 5) : [];

  return (
    <div className="heatmap-wrap">
      <div className="hm-header">
        <h2 className="hm-title">🗺️ Scholarship Heatmap</h2>
        <p className="hm-sub">Explore scholarships by region — click any bubble to see what's available</p>
      </div>
      <div className="hm-body">
        {/* Bubble map */}
        <div className="hm-map">
          <svg viewBox="0 0 100 85" style={{ width: "100%", height: "100%" }}>
            {/* Grid lines */}
            {[20, 40, 60, 80].map(x => <line key={x} x1={x} y1="0" x2={x} y2="85" stroke="#1e1c45" strokeWidth=".3" />)}
            {[20, 40, 60, 80].map(y => <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="#1e1c45" strokeWidth=".3" />)}
            {/* Bubbles */}
            {regionCounts.map(r => {
              const intensity = r.count / maxCount;
              const isAct = active === r.id;
              const radius = Math.max(6, Math.min(14, 6 + intensity * 10));
              return (
                <g key={r.id} style={{ cursor: "pointer" }} onClick={() => setSelected(s => s === r.id ? null : r.id)} onMouseEnter={() => setHovered(r.id)} onMouseLeave={() => setHovered(null)}>
                  <circle cx={r.x} cy={r.y} r={radius + 4} fill={r.color} opacity=".08" />
                  <circle cx={r.x} cy={r.y} r={radius + 2} fill={r.color} opacity=".15" />
                  <circle cx={r.x} cy={r.y} r={radius} fill={r.color} opacity={isAct ? 1 : 0.7} stroke={isAct ? "#fff" : "none"} strokeWidth={isAct ? ".8" : "0"} style={{ transition: "all .3s" }} />
                  <text x={r.x} y={r.y + .8} textAnchor="middle" fill="#fff" fontSize="3.2" fontWeight="700">{r.count}</text>
                  <text x={r.x} y={r.y + 5} textAnchor="middle" fill="#ffffff99" fontSize="2.2">{r.label}</text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Stats sidebar */}
        <div className="hm-sidebar">
          <div className="hm-legend">
            {regionCounts.map(r => (
              <div key={r.id} className={`hm-leg-item ${active === r.id ? "hm-leg-active" : ""}`} onClick={() => setSelected(s => s === r.id ? null : r.id)} style={{ borderLeft: `3px solid ${r.color}` }}>
                <div className="hm-leg-top">
                  <span className="hm-leg-name">{r.label}</span>
                  <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                    <span className="hm-leg-open" style={{ color: r.color }}>{r.count} open</span>
                    <span className="hm-leg-total">/ {r.total} total</span>
                  </div>
                </div>
                <div className="hm-leg-bar"><div style={{ height: "100%", width: `${(r.count / maxCount) * 100}%`, background: r.color, borderRadius: 4, transition: "width .6s ease" }} /></div>
              </div>
            ))}
          </div>

          {activeRegion && (
            <div className="hm-detail">
              <p className="hm-detail-title" style={{ color: activeRegion.color }}>📍 {activeRegion.label}</p>
              <p className="hm-detail-sub">{activeRegion.count} open · {activeRegion.total} total scholarships</p>
              <div className="hm-detail-list">
                {activeScholarships.length > 0
                  ? activeScholarships.map(s => (
                    <div key={s.id} className="hm-sch-item">
                      <span className="hm-sch-name">{getFlag(s.country)} {s.name}</span>
                      <CountdownBadge dateStr={s.deadlineDate} status={s.status} />
                    </div>
                  ))
                  : <p style={{ fontSize: ".76rem", color: "#3d3870" }}>No open scholarships in this region right now</p>
                }
              </div>
              <button className="hm-explore-btn" onClick={() => onTab("all")} style={{ background: activeRegion.color + "22", color: activeRegion.color, borderColor: activeRegion.color + "44" }}>
                Explore {activeRegion.label} Scholarships →
              </button>
            </div>
          )}

          {!activeRegion && (
            <div className="hm-hint">
              <p style={{ fontSize: ".8rem", color: "#3d3870", textAlign: "center", padding: "20px 0" }}>👆 Click a bubble or region to explore scholarships</p>
            </div>
          )}
        </div>
      </div>

      {/* Country breakdown */}
      <div className="hm-countries">
        <p className="sec-lbl" style={{ marginBottom: 14 }}>📊 Breakdown by Host Country</p>
        <div className="hm-country-grid">
          {Object.entries(
            allList.filter(isOpen).reduce((acc, s) => {
              const key = s.country?.split("(")[0].trim() || "Other";
              acc[key] = (acc[key] || 0) + 1;
              return acc;
            }, {})
          ).sort((a, b) => b[1] - a[1]).slice(0, 16).map(([country, count]) => (
            <div key={country} className="hm-country-item">
              <span className="hm-country-flag">{getFlag(country)}</span>
              <div className="hm-country-info">
                <span className="hm-country-name">{country.length > 18 ? country.slice(0, 18) + "…" : country}</span>
                <div className="hm-country-bar"><div style={{ height: "100%", width: `${(count / Math.max(...Object.values(allList.filter(isOpen).reduce((a, s) => { const k = s.country?.split("(")[0].trim() || "Other"; a[k] = (a[k] || 0) + 1; return a; }, {})))) * 100}%`, background: "#7c3aed", borderRadius: 3 }} /></div>
              </div>
              <span className="hm-country-cnt">{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Students Like You ─────────────────────────────────────────────────────────
const STUDENT_PROFILES = {
  Africa: [
    { name: "Amara O.", country: "Nigeria", flag: "🇳🇬", applying: ["Chevening", "DAAD", "Mastercard Foundation"], field: "Computer Science", tip: "Start your Chevening essays 3 months early. The leadership essay is the hardest." },
    { name: "Kwame A.", country: "Ghana", flag: "🇬🇭", applying: ["MEXT", "Erasmus Mundus", "OFID"], field: "Engineering", tip: "MEXT through Embassy is very competitive. Apply University Track for better odds." },
    { name: "Fatima M.", country: "Kenya", flag: "🇰🇪", applying: ["Australia Awards", "Aga Khan Foundation", "Fulbright"], field: "Public Health", tip: "Australia Awards prioritizes work experience heavily. Get strong employer references." },
    { name: "Chidi E.", country: "Nigeria", flag: "🇳🇬", applying: ["Turkish Government", "Stipendium Hungaricum", "CSC China"], field: "Medicine", tip: "Turkish Government Scholarship is extremely generous. Apply in February without fail." },
  ],
  Asia: [
    { name: "Priya S.", country: "India", flag: "🇮🇳", applying: ["Gates Cambridge", "Erasmus Mundus", "DAAD"], field: "AI & Machine Learning", tip: "Gates Cambridge is incredibly competitive. Only apply if you have top 5% grades." },
    { name: "Rahul K.", country: "India", flag: "🇮🇳", applying: ["KGSP", "MEXT", "CSC China"], field: "Engineering", tip: "KGSP University Track gives you more control. Research Korean universities directly." },
    { name: "Anh T.", country: "Vietnam", flag: "🇻🇳", applying: ["Fulbright", "Australia Awards", "KAUST"], field: "Data Science", tip: "Fulbright is very competitive for Vietnam. Apply at least 18 months before your target start." },
  ],
  Europe: [
    { name: "Maria G.", country: "Romania", flag: "🇷🇴", applying: ["Erasmus Mundus", "Chevening", "Eiffel"], field: "Law", tip: "Erasmus Mundus gives you the best value — study in 2 EU countries for free." },
    { name: "Ivan P.", country: "Ukraine", flag: "🇺🇦", applying: ["DAAD", "Stipendium Hungaricum", "Eiffel"], field: "Engineering", tip: "DAAD has specific programmes for Eastern European students. Check the DAAD-Ukraine page." },
  ],
  Americas: [
    { name: "Carlos R.", country: "Colombia", flag: "🇨🇴", applying: ["Fulbright", "OAS Scholarships", "Erasmus Mundus"], field: "Social Sciences", tip: "OAS Scholarships are underutilized. Many Latin American students don't know about them." },
    { name: "Ana F.", country: "Brazil", flag: "🇧🇷", applying: ["Chevening", "Eiffel", "DAAD"], field: "Environmental Science", tip: "Brazil has bilateral agreements with Germany. DAAD has specific Brazil-focused programmes." },
  ],
  "Middle East": [
    { name: "Omar H.", country: "Egypt", flag: "🇪🇬", applying: ["KAUST", "Turkish Government", "CSC China"], field: "Engineering", tip: "KAUST is the best STEM opportunity in the region. GRE score is critical." },
    { name: "Leila N.", country: "Iran", flag: "🇮🇷", applying: ["DAAD", "Stipendium Hungaricum", "Russian Government"], field: "Medicine", tip: "Stipendium Hungaricum has a dedicated Medicine track. Hungary is very international-student friendly." },
  ],
  Oceania: [
    { name: "Sina F.", country: "Fiji", flag: "🇫🇯", applying: ["Australia Awards", "New Zealand Excellence", "Mastercard Foundation"], field: "Agriculture", tip: "Australia Awards is practically designed for Pacific Island students. Very strong acceptance rate." },
  ],
};

function StudentsLikeYou({ profile, allList, onOpen }) {
  const region = profile?.region;
  const students = region && STUDENT_PROFILES[region] ? STUDENT_PROFILES[region] : Object.values(STUDENT_PROFILES).flat().slice(0, 4);
  const [expanded, setExpanded] = useState(null);

  const popularAmongPeers = allList.filter(isOpen).filter(s => {
    const peer = students[0];
    return peer?.applying?.some(n => s.name?.includes(n.split(" ")[0]));
  }).slice(0, 3);

  return (
    <div className="sly-wrap">
      <div className="sly-header">
        <h2 className="sly-title">👥 Students Like You</h2>
        <p className="sly-sub">{region ? `See what students from ${region} are applying to and their insider tips` : "Students around the world sharing their scholarship journeys"}</p>
      </div>

      {/* Popular picks */}
      {popularAmongPeers.length > 0 && (
        <div className="sly-popular">
          <p className="sec-lbl">🔥 Popular Among Students{region ? ` From ${region}` : ""}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {popularAmongPeers.map(s => (
              <div key={s.id} className="sly-popular-item" onClick={() => onOpen(s)} style={{ borderLeft: `3px solid ${s.color || "#7c3aed"}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: ".83rem", fontWeight: 600, color: "#e2dff5" }}>{getFlag(s.country)} {s.name}</span>
                  <div style={{ display: "flex", gap: 5 }}><CountdownBadge dateStr={s.deadlineDate} status={s.status} /></div>
                </div>
                <p style={{ fontSize: ".72rem", color: "#5a5488", marginTop: 3 }}>{s.host} · {s.country}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Student profiles */}
      <p className="sec-lbl" style={{ marginBottom: 14 }}>💬 Student Experiences & Tips</p>
      <div className="sly-grid">
        {students.map((st, i) => (
          <div key={i} className={`sly-card ${expanded === i ? "sly-expanded" : ""}`} onClick={() => setExpanded(e => e === i ? null : i)}>
            <div className="sly-card-top">
              <div className="sly-avatar">{st.name[0]}</div>
              <div className="sly-info">
                <p className="sly-name">{st.name} {st.flag}</p>
                <p className="sly-meta">{st.country} · {st.field}</p>
              </div>
              <span className="sly-expand">{expanded === i ? "▲" : "▼"}</span>
            </div>
            <div className="sly-applying">
              <span className="sec-lbl" style={{ fontSize: ".63rem", marginBottom: 6 }}>Applying to:</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {st.applying.map((a, ai) => <span key={ai} className="sly-tag">{a}</span>)}
              </div>
            </div>
            {expanded === i && (
              <div className="sly-tip">
                <span className="sly-tip-icon">💡</span>
                <p className="sly-tip-text">{st.tip}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {!profile && (
        <div className="dash-cta" style={{ marginTop: 20 }}>
          <p className="dash-cta-text">🎯 Complete your profile to see students from your specific region and country</p>
        </div>
      )}
    </div>
  );
}

// ── Calendar Sync ─────────────────────────────────────────────────────────────
function CalendarSync({ allList, saved, trackerFlat }) {
  const [added, setAdded] = useState({});
  const [exportDone, setExportDone] = useState(false);

  const upcomingDeadlines = allList
    .filter(s => isOpen(s) && s.deadlineDate && daysUntil(s.deadlineDate) >= 0 && daysUntil(s.deadlineDate) <= 180)
    .sort((a, b) => new Date(a.deadlineDate) - new Date(b.deadlineDate));

  const generateICS = (scholarships) => {
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ScholarHub//Scholarship Deadlines//EN", "CALSCALE:GREGORIAN"];
    scholarships.forEach(s => {
      if (!s.deadlineDate) return;
      const dt = s.deadlineDate.replace(/-/g, "");
      const uid = `scholarship-${s.id}-${Date.now()}@scholarhub`;
      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${uid}`);
      lines.push(`DTSTART;VALUE=DATE:${dt}`);
      lines.push(`DTEND;VALUE=DATE:${dt}`);
      lines.push(`SUMMARY:📚 ${s.name} Deadline`);
      lines.push(`DESCRIPTION:Scholarship: ${s.name}\\nHost: ${s.host}\\nCountry: ${s.country}\\nAmount: ${s.amount}\\nEligibility: ${s.eligibility}\\nWebsite: ${s.link}`);
      lines.push(`URL:${s.link}`);
      lines.push("BEGIN:VALARM");
      lines.push("TRIGGER:-P7D");
      lines.push("ACTION:DISPLAY");
      lines.push(`DESCRIPTION:⏰ 7 days until ${s.name} closes!`);
      lines.push("END:VALARM");
      lines.push("BEGIN:VALARM");
      lines.push("TRIGGER:-P1D");
      lines.push("ACTION:DISPLAY");
      lines.push(`DESCRIPTION:🔥 Last day to apply for ${s.name}!`);
      lines.push("END:VALARM");
      lines.push("END:VEVENT");
    });
    lines.push("END:VCALENDAR");
    return lines.join("\r\n");
  };

  const downloadICS = (scholarships, label) => {
    const ics = generateICS(scholarships);
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${label.replace(/\s+/g, "-")}.ics`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    setExportDone(true); setTimeout(() => setExportDone(false), 3000);
  };

  const addToGoogle = (s) => {
    if (!s.deadlineDate) return;
    const dt = s.deadlineDate.replace(/-/g, "");
    const title = encodeURIComponent(`📚 ${s.name} Scholarship Deadline`);
    const details = encodeURIComponent(`Apply here: ${s.link}\n\nEligibility: ${s.eligibility}\nAmount: ${s.amount}`);
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dt}/${dt}&details=${details}&sf=true&output=xml`;
    window.open(url, "_blank");
    setAdded(p => ({ ...p, [s.id]: true }));
  };

  const urgency = upcomingDeadlines.filter(s => daysUntil(s.deadlineDate) <= 30);
  const thisMonth = upcomingDeadlines.filter(s => { const d = new Date(s.deadlineDate); return d.getMonth() === NOW.getMonth() && d.getFullYear() === NOW.getFullYear(); });

  return (
    <div className="cal-wrap">
      <div className="cal-header">
        <h2 className="cal-title">🔔 Deadline Calendar & Reminders</h2>
        <p className="cal-sub">Sync scholarship deadlines to your calendar and never miss an opportunity</p>
      </div>

      {/* Export buttons */}
      <div className="cal-export-row">
        <button className="cal-export-btn cal-ics" onClick={() => downloadICS(upcomingDeadlines, "All-Scholarship-Deadlines")}>
          📅 Export All to Calendar (.ics)
          <span className="cal-export-sub">Works with Apple Calendar, Google Calendar, Outlook</span>
        </button>
        <button className="cal-export-btn cal-saved" onClick={() => downloadICS(saved.filter(s => s.deadlineDate), "Saved-Scholarship-Deadlines")}>
          🔖 Export Saved Only (.ics)
          <span className="cal-export-sub">{saved.filter(s => s.deadlineDate).length} saved scholarships</span>
        </button>
        <button className="cal-export-btn cal-urgent" onClick={() => downloadICS(urgency, "Urgent-Scholarship-Deadlines")}>
          🔥 Export Urgent Only (.ics)
          <span className="cal-export-sub">{urgency.length} closing within 30 days</span>
        </button>
      </div>

      {exportDone && <div className="cal-success">✅ Calendar file downloaded! Open it to import into your calendar app. Reminders set for 7 days and 1 day before each deadline.</div>}

      {/* How to import */}
      <div className="cal-how">
        <p className="sec-lbl">📖 How to Import</p>
        <div className="cal-how-grid">
          {[
            { icon: "🍎", title: "Apple Calendar", steps: ["Download the .ics file", "Double-click the file", "Click Add to import all events"] },
            { icon: "📅", title: "Google Calendar", steps: ["Go to calendar.google.com", "Click Settings → Import", "Upload the .ics file"] },
            { icon: "📧", title: "Outlook", steps: ["Open Outlook Calendar", "File → Open & Export → Import", "Select the .ics file"] },
          ].map(({ icon, title, steps }) => (
            <div key={title} className="cal-how-card">
              <div className="cal-how-icon">{icon}</div>
              <p className="cal-how-title">{title}</p>
              <ol className="cal-how-steps">{steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
            </div>
          ))}
        </div>
      </div>

      {/* Upcoming deadlines with Google Calendar button */}
      {urgency.length > 0 && (
        <div className="cal-urgent-section">
          <p className="sec-lbl">🔥 Urgent — Closing Within 30 Days</p>
          <div className="cal-list">
            {urgency.map(s => (
              <div key={s.id} className="cal-item" style={{ borderLeft: `3px solid ${s.color || "#f87171"}` }}>
                <div className="cal-item-main">
                  <div>
                    <p className="cal-item-name">{getFlag(s.country)} {s.name}</p>
                    <p className="cal-item-meta">{s.host} · {s.deadlineDate}</p>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0, flexWrap: "wrap" }}>
                    <CountdownBadge dateStr={s.deadlineDate} status={s.status} />
                    <button className={`cal-add-btn ${added[s.id] ? "cal-added" : ""}`} onClick={() => addToGoogle(s)}>
                      {added[s.id] ? "✅ Added" : "📅 Add to Google"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full deadline list */}
      <div style={{ marginTop: 24 }}>
        <p className="sec-lbl">📋 All Upcoming Deadlines ({upcomingDeadlines.length})</p>
        {upcomingDeadlines.length === 0 && <p style={{ color: "#3d3870", fontSize: ".84rem" }}>No upcoming deadlines found. Refresh to load more scholarships.</p>}
        <div className="cal-list">
          {upcomingDeadlines.map(s => (
            <div key={s.id} className="cal-item" style={{ borderLeft: `3px solid ${s.color || "#7c3aed"}` }}>
              <div className="cal-item-main">
                <div>
                  <p className="cal-item-name">{getFlag(s.country)} {s.name}</p>
                  <p className="cal-item-meta">{s.country} · Due: {s.deadline}</p>
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0, flexWrap: "wrap" }}>
                  <CountdownBadge dateStr={s.deadlineDate} status={s.status} />
                  <button className={`cal-add-btn ${added[s.id] ? "cal-added" : ""}`} onClick={() => addToGoogle(s)}>
                    {added[s.id] ? "✅" : "📅 Google"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── CV Reviewer ───────────────────────────────────────────────────────────────
const CV_CATEGORIES = ["Structure & Formatting", "Academic Achievements", "Work & Research Experience", "Language & Clarity", "Scholarship Readiness"];
const CV_ICONS = ["📐", "🎓", "💼", "✍️", "🏆"];
const CV_COLORS = ["#7c3aed", "#2980b9", "#27ae60", "#e67e22", "#c0392b"];

function CVReviewer({ profile }) {
  const [mode, setMode] = useState("paste"); // paste | upload
  const [cvText, setCvText] = useState("");
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = ev => {
      // Extract text from file (works for .txt, basic .pdf text layer)
      const text = ev.target.result;
      setCvText(typeof text === "string" ? text.slice(0, 8000) : "[Binary file — please paste your CV text below instead]");
    };
    if (file.type === "application/pdf") {
      reader.readAsText(file); // reads PDF text layer
    } else {
      reader.readAsText(file);
    }
  };

  const analyse = async () => {
    if (!cvText.trim()) { setError("Please paste your CV text or upload a file first."); return; }
    if (cvText.length < 100) { setError("CV seems too short. Please paste the full content."); return; }
    setError(""); setLoading(true); setResult(null);

    const profileCtx = profile ? `Student profile: ${profile.level || ""} level, field: ${profile.field || ""}, region: ${profile.region || ""}, GPA: ${profile.gpa || "unknown"}.` : "No profile provided.";

    const prompt = `You are an expert scholarship CV reviewer. Analyse this CV and provide detailed feedback.

${profileCtx}

CV Content:
---
${cvText.slice(0, 5000)}
---

Respond ONLY with raw JSON (no markdown, no backticks):
{
  "overallScore": 72,
  "overallGrade": "B+",
  "summary": "2-3 sentence overall assessment",
  "strengths": ["strength 1","strength 2","strength 3"],
  "redFlags": ["red flag 1","red flag 2"],
  "categories": [
    {"name":"Structure & Formatting","score":75,"feedback":"specific feedback","tips":["tip 1","tip 2"]},
    {"name":"Academic Achievements","score":80,"feedback":"specific feedback","tips":["tip 1","tip 2"]},
    {"name":"Work & Research Experience","score":65,"feedback":"specific feedback","tips":["tip 1","tip 2"]},
    {"name":"Language & Clarity","score":70,"feedback":"specific feedback","tips":["tip 1","tip 2"]},
    {"name":"Scholarship Readiness","score":60,"feedback":"specific feedback","tips":["tip 1","tip 2"]}
  ],
  "topActions": ["Most important action 1","Most important action 2","Most important action 3"],
  "scholarshipFit": "Which types of scholarships this CV is strongest for"
}`;

    try {
      const raw = await callAI(prompt, "You are an expert scholarship CV reviewer. Output ONLY raw JSON. No markdown. No backticks.");
      const m = raw.match(/\{[\s\S]*\}/); if (!m) throw new Error("No JSON");
      const parsed = JSON.parse(m[0]);
      setResult(parsed);
    } catch (e) {
      setError("Analysis failed. This works best when deployed with your own API key. Try again!");
    } finally { setLoading(false); }
  };

  const scoreColor = (s) => s >= 80 ? "#34d399" : s >= 65 ? "#fbbf24" : "#f87171";
  const gradeColor = (g) => g?.startsWith("A") ? "#34d399" : g?.startsWith("B") ? "#fbbf24" : "#f87171";

  return (
    <div className="cv-wrap">
      <div className="cv-header">
        <h2 className="cv-title">📄 CV / Resume Reviewer</h2>
        <p className="cv-sub">Upload or paste your CV — AI will score it and give you scholarship-specific feedback</p>
      </div>

      {/* Input area */}
      <div className="cv-input-box">
        <div className="cv-mode-tabs">
          <button className={`cv-mode-btn ${mode === "paste" ? "active" : ""}`} onClick={() => setMode("paste")}>📋 Paste Text</button>
          <button className={`cv-mode-btn ${mode === "upload" ? "active" : ""}`} onClick={() => setMode("upload")}>📎 Upload File</button>
        </div>

        {mode === "paste" ? (
          <textarea
            className="cv-textarea"
            placeholder="Paste your full CV/resume text here...&#10;&#10;Include: personal info, education, work experience, skills, publications, awards, languages, etc."
            value={cvText}
            onChange={e => setCvText(e.target.value)}
            rows={12}
          />
        ) : (
          <div className="cv-upload-zone" onClick={() => fileRef.current?.click()}>
            <input ref={fileRef} type="file" accept=".txt,.pdf,.doc,.docx" style={{ display: "none" }} onChange={handleFile} />
            {fileName ? (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>📄</div>
                <p style={{ color: "#a78bfa", fontWeight: 600, fontSize: ".9rem" }}>{fileName}</p>
                <p style={{ color: "#5a5488", fontSize: ".76rem", marginTop: 4 }}>Click to change file</p>
                {cvText && <p style={{ color: "#34d399", fontSize: ".74rem", marginTop: 6 }}>✅ Text extracted — {cvText.length} characters</p>}
              </div>
            ) : (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 44, marginBottom: 12 }}>📎</div>
                <p style={{ color: "#b0a8d8", fontSize: ".9rem", fontWeight: 600, marginBottom: 4 }}>Click to upload your CV</p>
                <p style={{ color: "#3d3870", fontSize: ".76rem" }}>Supports .txt, .pdf, .doc, .docx</p>
                <p style={{ color: "#3d3870", fontSize: ".72rem", marginTop: 4 }}>For best results with PDF, also paste the text below</p>
              </div>
            )}
          </div>
        )}

        {mode === "upload" && fileName && (
          <textarea
            className="cv-textarea"
            style={{ marginTop: 10, minHeight: 120 }}
            placeholder="CV text extracted above. Edit if needed or paste additional content..."
            value={cvText}
            onChange={e => setCvText(e.target.value)}
            rows={6}
          />
        )}

        {error && <p className="cv-error">{error}</p>}

        <div className="cv-footer-row">
          <span style={{ fontSize: ".74rem", color: "#3d3870" }}>{cvText.length > 0 ? `${cvText.length} characters` : ""}</span>
          <button className="cv-analyse-btn" onClick={analyse} disabled={loading || !cvText.trim()}>
            {loading ? <><span className="spin-sm" />Analysing CV...</> : "🔍 Analyse My CV"}
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="loading" style={{ padding: "40px 0" }}>
          <div className="spinner" />
          <p className="load-txt">AI is reviewing your CV...</p>
          <p className="load-sub">Scoring across 5 categories · Finding strengths & gaps</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="cv-results">
          {/* Overall score */}
          <div className="cv-score-card">
            <div className="cv-score-left">
              <div className="cv-score-circle" style={{ borderColor: gradeColor(result.overallGrade) }}>
                <span className="cv-score-num" style={{ color: gradeColor(result.overallGrade) }}>{result.overallScore}</span>
                <span className="cv-score-label">/ 100</span>
              </div>
              <div>
                <div className="cv-grade" style={{ color: gradeColor(result.overallGrade) }}>{result.overallGrade}</div>
                <div style={{ fontSize: ".72rem", color: "#5a5488" }}>Overall Score</div>
              </div>
            </div>
            <p className="cv-summary">{result.summary}</p>
          </div>

          {/* Category scores */}
          <div className="cv-categories">
            {result.categories?.map((cat, i) => (
              <div key={i} className="cv-cat-card">
                <div className="cv-cat-head">
                  <span className="cv-cat-icon">{CV_ICONS[i]}</span>
                  <span className="cv-cat-name">{cat.name}</span>
                  <span className="cv-cat-score" style={{ color: scoreColor(cat.score) }}>{cat.score}/100</span>
                </div>
                <div className="cv-cat-bar-track">
                  <div className="cv-cat-bar-fill" style={{ width: `${cat.score}%`, background: scoreColor(cat.score) }} />
                </div>
                <p className="cv-cat-feedback">{cat.feedback}</p>
                {cat.tips?.length > 0 && (
                  <div className="cv-cat-tips">
                    {cat.tips.map((t, ti) => <div key={ti} className="cv-tip"><span>💡</span><span>{t}</span></div>)}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* 2-col: strengths + red flags */}
          <div className="cv-two-col">
            <div className="cv-strengths">
              <p className="sec-lbl" style={{ color: "#34d399", marginBottom: 12 }}>✅ Strengths</p>
              {result.strengths?.map((s, i) => (
                <div key={i} className="cv-strength-item"><span>✅</span><span>{s}</span></div>
              ))}
            </div>
            <div className="cv-redflags">
              <p className="sec-lbl" style={{ color: "#f87171", marginBottom: 12 }}>⚠️ Red Flags</p>
              {result.redFlags?.length > 0
                ? result.redFlags.map((r, i) => <div key={i} className="cv-flag-item"><span>⚠️</span><span>{r}</span></div>)
                : <p style={{ fontSize: ".78rem", color: "#3d3870" }}>No major red flags found 🎉</p>
              }
            </div>
          </div>

          {/* Top actions */}
          <div className="cv-actions-box">
            <p className="sec-lbl" style={{ marginBottom: 14 }}>🚀 Top 3 Actions to Improve Your CV</p>
            {result.topActions?.map((a, i) => (
              <div key={i} className="cv-action-item">
                <span className="cv-action-num">{i + 1}</span>
                <span className="cv-action-text">{a}</span>
              </div>
            ))}
          </div>

          {/* Scholarship fit */}
          {result.scholarshipFit && (
            <div className="cv-fit-box">
              <p className="sec-lbl" style={{ marginBottom: 8 }}>🎯 Scholarship Fit</p>
              <p style={{ fontSize: ".84rem", color: "#b0a8d8", lineHeight: 1.6 }}>{result.scholarshipFit}</p>
            </div>
          )}

          {/* Re-analyse button */}
          <button className="cv-analyse-btn" style={{ marginTop: 4, width: "100%" }} onClick={() => { setResult(null); setCvText(""); setFileName(""); }}>
            📄 Review Another CV
          </button>
        </div>
      )}
    </div>
  );
}

// ── Persistence helpers (localStorage for deployment) ────────────────────────
const PERSIST_KEYS = { profile: "sh_profile", saved: "sh_saved", tracker: "sh_tracker", compare: "sh_compare" };

async function persist(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch (_) { }
}
async function restore(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (_) { return fallback; }
}

export default function App() {
  const [query, setQuery] = useState(""); const [region, setRegion] = useState("All Regions"); const [field, setField] = useState("All Fields");
  const [statusF, setStatusF] = useState("All"); const [tab, setTab] = useState("dashboard");
  const [saved, setSaved] = useState([]); const [modal, setModal] = useState(null); const [profile, setProfile] = useState(null);
  const [quiz, setQuiz] = useState(false); // will be set after restore
  const [hydrated, setHydrated] = useState(false); // true once storage is loaded
  const [autoList, setAutoList] = useState([]); const [autoLoading, setAutoLoading] = useState(true);
  const [autoStatus, setAutoStatus] = useState("🔄 Fetching new scholarships..."); const [lastFetch, setLastFetch] = useState(null);
  const [fromCache, setFromCache] = useState(false); const [searchRes, setSearchRes] = useState([]); const [searchLoading, setSearchLoading] = useState(false);
  const [searchSum, setSearchSum] = useState(""); const [hasSearched, setHasSearched] = useState(false); const [dots, setDots] = useState(".");
  const [compareList, setCompareList] = useState([]); const [tracker, setTracker] = useState({ Interested: [], Applied: [], "Awaiting Response": [], Result: [] });
  const [showChat, setShowChat] = useState(false); const [sopS, setSopS] = useState(null);

  // ── Restore from storage on mount ──────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const [p, s, t, c] = await Promise.all([
        restore(PERSIST_KEYS.profile, null),
        restore(PERSIST_KEYS.saved, []),
        restore(PERSIST_KEYS.tracker, { Interested: [], Applied: [], "Awaiting Response": [], Result: [] }),
        restore(PERSIST_KEYS.compare, []),
      ]);
      if (p) { setProfile(p); setQuiz(false); } else { setQuiz(true); }
      if (s?.length) setSaved(s);
      if (t) setTracker(t);
      if (c?.length) setCompareList(c);
      setHydrated(true);
    })();
  }, []);

  // ── Persist whenever these change (only after hydrated) ───────────────────
  useEffect(() => { if (hydrated && profile) persist(PERSIST_KEYS.profile, profile); }, [profile, hydrated]);
  useEffect(() => { if (hydrated) persist(PERSIST_KEYS.saved, saved); }, [saved, hydrated]);
  useEffect(() => { if (hydrated) persist(PERSIST_KEYS.tracker, tracker); }, [tracker, hydrated]);
  useEffect(() => { if (hydrated) persist(PERSIST_KEYS.compare, compareList); }, [compareList, hydrated]);

  useEffect(() => {
    // Only load from cache on startup — don't hit API automatically
    // This saves your Gemini free tier quota for the chatbot and search
    try {
      const c = localStorage.getItem(CACHE_KEY);
      if (c) { const d = JSON.parse(c); if ((Date.now() - new Date(d.fetchedAt).getTime()) / 3600000 < CACHE_HRS && d.scholarships?.length) { setAutoList(d.scholarships); setFromCache(true); setLastFetch(new Date(d.fetchedAt)); setAutoStatus("✅ Loaded from cache"); setAutoLoading(false); return; } }
    } catch (_) { }
    setAutoStatus("💡 Click Refresh to discover new scholarships");
    setAutoLoading(false);
  }, []);
  useEffect(() => { if (!autoLoading && !searchLoading) return; const iv = setInterval(() => setDots(d => d.length >= 3 ? "." : d + "."), 500); return () => clearInterval(iv); }, [autoLoading, searchLoading]);

  const toggleSave = useCallback(s => { const k = s.id ?? s.name; setSaved(p => p.find(x => (x.id ?? x.name) === k) ? p.filter(x => (x.id ?? x.name) !== k) : [...p, s]); }, []);
  const isSaved = s => !!saved.find(x => (x.id ?? x.name) === (s.id ?? s.name));
  const toggleCompare = s => { const k = s.id ?? s.name; setCompareList(p => { if (p.find(x => (x.id ?? x.name) === k)) return p.filter(x => (x.id ?? x.name) !== k); if (p.length >= 3) return p; return [...p, s]; }); };
  const isCompared = s => !!compareList.find(x => (x.id ?? x.name) === (s.id ?? s.name));
  const trackerFlat = Object.values(tracker).flat();
  const isTracked = s => trackerFlat.some(x => (x.id ?? x.name) === (s.id ?? s.name));
  const toggleTrack = s => { if (isTracked(s)) { setTracker(p => { const n = { ...p }; for (const c of TRACKER_COLS) n[c] = n[c].filter(x => (x.id ?? x.name) !== (s.id ?? s.name)); return n; }); } else { setTracker(p => ({ ...p, Interested: [...p.Interested, s] })); } };
  const moveTracker = (s, toCol) => { setTracker(p => { const n = { ...p }; for (const c of TRACKER_COLS) n[c] = n[c].filter(x => (x.id ?? x.name) !== (s.id ?? s.name)); n[toCol] = [...n[toCol], s]; return n; }); };
  const removeTracker = s => { setTracker(p => { const n = { ...p }; for (const c of TRACKER_COLS) n[c] = n[c].filter(x => (x.id ?? x.name) !== (s.id ?? s.name)); return n; }); };

  const allList = [...CURATED, ...autoList];
  const applyF = list => { const q = query.toLowerCase(); return list.filter(s => (!q || s.name?.toLowerCase().includes(q) || s.host?.toLowerCase().includes(q) || s.country?.toLowerCase().includes(q) || s.eligibility?.toLowerCase().includes(q) || s.courses?.some(c => c.toLowerCase().includes(q))) && (region === "All Regions" || s.region === region) && (field === "All Fields" || s.field === field || s.field === "All Fields" || s.courses?.some(c => c.toLowerCase().includes(field.toLowerCase()))) && (statusF === "All" || (statusF === "Open" && isOpen(s)) || (statusF === "Closed" && !isOpen(s)))); };
  const sortM = list => { if (!profile) return list; return [...list].sort((a, b) => (computeMatch(b, profile) || 0) - (computeMatch(a, profile) || 0)); };
  const filtered = sortM(applyF(allList)); const filteredNew = sortM(applyF(autoList)); const openCount = allList.filter(isOpen).length;

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearchLoading(true); setHasSearched(true); setSearchRes([]); setSearchSum(""); setTab("search");
    const prompt = `Find 6 real scholarships for international students. Query: "${query}" Region: ${region === "All Regions" ? "worldwide" : region} Field: ${field === "All Fields" ? "any" : field}. Reply ONLY with raw JSON: {"scholarships":[{"name":"","host":"","country":"","amount":"","deadline":"","deadlineDate":"YYYY-MM-DD","status":"open","eligibility":"","link":"https://example.com","field":"","region":"","tag":"Merit","color":"#hex","courses":[""],"howToApply":[""]}],"summary":""}`;
    try {
      const raw = await callAI(prompt, "Output ONLY raw JSON. No markdown. No backticks.");
      const m = raw.match(/\{[\s\S]*\}/); if (!m) throw new Error("No JSON");
      const parsed = JSON.parse(m[0]); if (!parsed.scholarships?.length) throw new Error("Empty");
      setSearchRes(parsed.scholarships.map((s, i) => ({ ...s, id: `sr-${Date.now()}-${i}` }))); setSearchSum(parsed.summary || "");
    } catch {
      const fb = allList.filter(s => { const q = query.toLowerCase(); return s.name?.toLowerCase().includes(q) || s.country?.toLowerCase().includes(q) || s.courses?.some(c => c.toLowerCase().includes(q)); }).slice(0, 6);
      setSearchRes(fb.length ? fb : allList.slice(0, 6)); setSearchSum("Showing closest matches from our curated database.");
    } finally { setSearchLoading(false); }
  };

  const handleRefresh = async () => {
    setAutoLoading(true); setAutoStatus("🔄 Refreshing...");
    try { try { localStorage.removeItem(CACHE_KEY); } catch (_) { } const { list } = await loadAuto(); setAutoList(list); setLastFetch(new Date()); setAutoStatus(`✅ Refreshed — ${list.length} found`); setFromCache(false); }
    catch { setAutoStatus("⚠️ Refresh failed — try again"); }
    finally { setAutoLoading(false); }
  };

  const cp = (s, i, badge) => ({ s, index: i, onOpen: setModal, onSave: toggleSave, saved: isSaved(s), badge, profile, onCompare: toggleCompare, compared: isCompared(s), onTrack: toggleTrack, tracked: isTracked(s) });

  const tabs = [
    { id: "dashboard", l: `🏠 Dashboard` },
    { id: "all", l: `🌐 All (${filtered.length})` },
    { id: "gems", l: `💎 Hidden Gems` },
    { id: "new", l: `✨ New${autoLoading ? "…" : `(${filteredNew.length})`}` },
    { id: "search", l: `🔍 Search${searchRes.length > 0 ? ` (${searchRes.length})` : ""}` },
    { id: "heatmap", l: `🗺️ Heatmap` },
    { id: "students", l: `👥 Students Like You` },
    { id: "calendar", l: `🔔 Calendar` },
    { id: "timeline", l: `📅 Roadmap` },
    { id: "cv", l: `📄 CV Reviewer` },
    { id: "compare", l: `⚖️ Compare (${compareList.length})` },
    { id: "tracker", l: `📋 Tracker (${trackerFlat.length})` },
    { id: "saved", l: `🔖 Saved (${saved.length})` },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700;800&family=Outfit:wght@300;400;500;600;700&display=swap');
        *{margin:0;padding:0;box-sizing:border-box;}
        body{background:#080810;color:#e2dff5;font-family:'Outfit',sans-serif;min-height:100vh;}
        .app{min-height:100vh;background:#080810;background-image:radial-gradient(ellipse 100% 50% at 50% -5%,#170d3a 0%,transparent 65%),radial-gradient(ellipse 60% 40% at 90% 90%,#0a1f3a 0%,transparent 55%);}
        .overlay{position:fixed;inset:0;background:#000000bb;backdrop-filter:blur(8px);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px;}
        /* QUIZ */
        .quiz-box{background:#0d0c22;border:1px solid #2a2560;border-radius:24px;padding:32px 28px;max-width:500px;width:100%;position:relative;animation:fadeUp .3s both;max-height:90vh;overflow-y:auto;}
        .skip-btn{position:absolute;top:14px;right:14px;background:transparent;border:none;color:#3d3870;font-family:inherit;font-size:.8rem;cursor:pointer;}
        .skip-btn:hover{color:#9d8fcc;}
        .qpb{height:3px;background:#13102a;border-radius:4px;margin-bottom:18px;overflow:hidden;}
        .qpf{height:100%;background:linear-gradient(90deg,#7c3aed,#c084fc);transition:width .4s ease;}
        .q-lbl{font-size:.68rem;text-transform:uppercase;letter-spacing:2px;color:#3d3870;margin-bottom:12px;}
        .q-icon{font-size:34px;margin-bottom:10px;}
        .q-title{font-family:'Cormorant Garamond',serif;font-size:1.45rem;font-weight:700;color:#fff;margin-bottom:16px;line-height:1.2;}
        .q-opts{display:flex;flex-wrap:wrap;gap:7px;}
        .q-opt{background:#13102a;border:1px solid #2a2560;border-radius:10px;padding:8px 15px;color:#b0a8d8;font-family:inherit;font-size:.84rem;cursor:pointer;transition:all .2s;}
        .q-opt:hover{background:#1e1c45;border-color:#7c3aed;color:#c084fc;}
        /* DASHBOARD */
        .dash{max-width:900px;margin:0 auto;}
        .dash-welcome{display:flex;justify-content:space-between;align-items:center;background:linear-gradient(135deg,#13102a,#0d1a3a);border:1px solid #1e1c45;border-radius:18px;padding:24px 26px;margin-bottom:22px;gap:16px;}
        .dash-hi{font-family:'Cormorant Garamond',serif;font-size:1.6rem;font-weight:800;color:#fff;margin-bottom:5px;}
        .dash-sub{font-size:.8rem;color:#7e78a8;line-height:1.5;}
        .dash-avatar{width:52px;height:52px;background:linear-gradient(135deg,#7c3aed,#4f46e5);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;color:#fff;flex-shrink:0;font-family:'Cormorant Garamond',serif;}
        .dash-stats{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px;margin-bottom:22px;}
        .dash-stat{background:#0f0e25;border:1px solid #1e1c45;border-radius:14px;padding:14px 12px;display:flex;flex-direction:column;align-items:center;gap:3px;transition:all .2s;}
        .dash-stat:hover{background:#13102a;transform:translateY(-2px);}
        .dash-stat-icon{font-size:18px;margin-bottom:2px;}
        .dash-stat-n{font-family:'Cormorant Garamond',serif;font-size:1.6rem;font-weight:800;}
        .dash-stat-l{font-size:.66rem;color:#5a5488;text-transform:uppercase;letter-spacing:.5px;text-align:center;}
        .dash-section{background:#0f0e25;border:1px solid #1e1c45;border-radius:16px;padding:18px;margin-bottom:16px;}
        .dash-sec-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;}
        .dash-sec-title{font-family:'Cormorant Garamond',serif;font-size:1.05rem;font-weight:700;color:#fff;}
        .dash-see-all{background:transparent;border:none;color:#7c6fac;font-family:inherit;font-size:.77rem;cursor:pointer;transition:color .2s;}
        .dash-see-all:hover{color:#c084fc;}
        .dash-list{display:flex;flex-direction:column;gap:8px;}
        .dash-item{background:#13102a;border:1px solid #1e1c45;border-radius:10px;padding:11px 13px;cursor:pointer;transition:all .2s;}
        .dash-item:hover{background:#1a1840;transform:translateX(3px);}
        .dash-item-main{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:3px;flex-wrap:wrap;}
        .dash-item-name{font-size:.82rem;font-weight:600;color:#e2dff5;line-height:1.3;}
        .dash-item-meta{font-size:.72rem;color:#5a5488;}
        .gem-badge{font-size:.68rem;font-weight:700;padding:2px 8px;border-radius:20px;background:#a78bfa22;color:#a78bfa;border:1px solid #a78bfa44;white-space:nowrap;}
        .trk-progress{display:flex;flex-direction:column;gap:10px;}
        .trk-prog-item{display:flex;flex-direction:column;gap:5px;}
        .trk-prog-top{display:flex;justify-content:space-between;align-items:center;}
        .trk-prog-bar{height:6px;background:#13102a;border-radius:4px;overflow:hidden;}
        .dash-cta{background:linear-gradient(135deg,#7c3aed22,#4f46e522);border:1px solid #7c3aed44;border-radius:14px;padding:18px;text-align:center;}
        .dash-cta-text{font-size:.88rem;color:#a78bfa;line-height:1.6;}
        /* TIMELINE */
        .timeline-wrap{max-width:860px;margin:0 auto;}
        .tl-header{margin-bottom:24px;}
        .tl-title{font-family:'Cormorant Garamond',serif;font-size:1.6rem;font-weight:800;color:#fff;margin-bottom:6px;}
        .tl-sub{font-size:.84rem;color:#7e78a8;}
        .tl-months{display:flex;gap:6px;overflow-x:auto;padding-bottom:8px;margin-bottom:22px;-webkit-overflow-scrolling:touch;}
        .tl-month-btn{background:#0f0e25;border:1px solid #1e1c45;border-radius:12px;padding:10px 14px;cursor:pointer;transition:all .2s;display:flex;flex-direction:column;align-items:center;gap:2px;flex-shrink:0;position:relative;}
        .tl-month-btn.active{background:#7c3aed22;border-color:#7c3aed55;}
        .tl-month-btn:hover{border-color:#2a2560;}
        .tl-month-name{font-size:.82rem;font-weight:600;color:#e2dff5;}
        .tl-month-year{font-size:.66rem;color:#5a5488;}
        .tl-month-dot{position:absolute;top:6px;right:6px;width:6px;height:6px;background:#f87171;border-radius:50%;}
        .tl-detail{background:#0f0e25;border:1px solid #1e1c45;border-radius:16px;padding:20px;margin-bottom:22px;}
        .tl-detail-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;}
        .tl-detail-title{font-family:'Cormorant Garamond',serif;font-size:1.2rem;font-weight:700;color:#fff;}
        .tl-task-cnt{font-size:.76rem;color:#5a5488;background:#13102a;border:1px solid #1e1c45;border-radius:20px;padding:3px 10px;}
        .tl-tasks{display:flex;flex-direction:column;gap:10px;}
        .tl-task{display:flex;gap:12px;align-items:flex-start;background:#13102a;border:1px solid #1e1c45;border-radius:10px;padding:12px;transition:all .2s;}
        .tl-urgent{border-color:#f8717133;background:#7f1d1d11;}
        .tl-task-icon{font-size:16px;flex-shrink:0;margin-top:1px;}
        .tl-task-body{flex:1;}
        .tl-task-text{font-size:.83rem;color:#b0a8d8;line-height:1.45;margin-bottom:5px;}
        .tl-task-tag{font-size:.68rem;font-weight:600;padding:2px 8px;border-radius:20px;margin-right:4px;}
        .tl-bar-wrap{background:#0f0e25;border:1px solid #1e1c45;border-radius:14px;padding:18px;}
        .tl-bar{display:flex;align-items:center;margin-bottom:8px;}
        .tl-bar-seg{display:flex;align-items:center;flex:1;}
        .tl-bar-dot{width:12px;height:12px;border-radius:50%;background:#1e1c45;border:2px solid #2a2560;cursor:pointer;flex-shrink:0;transition:all .2s;}
        .tl-bar-now{background:#7c3aed;border-color:#a78bfa;box-shadow:0 0 0 4px #7c3aed33;}
        .tl-bar-dead{background:#f87171;border-color:#fca5a5;}
        .tl-bar-line{flex:1;height:2px;background:#1e1c45;}
        .tl-bar-labels{display:flex;justify-content:space-between;}
        .tl-bar-lbl{font-size:.65rem;text-align:center;flex:1;}
        /* HIDDEN GEMS */
        .gems-header{margin-bottom:24px;}
        .gems-title{font-family:'Cormorant Garamond',serif;font-size:1.6rem;font-weight:800;color:#fff;margin-bottom:6px;}
        .gems-sub{font-size:.84rem;color:#7e78a8;}
        .gem-card{border-top:3px solid #a78bfa !important;}
        .gem-badge-lg{font-size:.78rem;font-weight:700;padding:4px 12px;border-radius:20px;background:#a78bfa22;color:#a78bfa;border:1px solid #a78bfa44;}
        .gem-reason{display:flex;gap:8px;align-items:flex-start;background:#13102a;border:1px solid #1e1c45;border-radius:9px;padding:9px 11px;margin-bottom:10px;font-size:.77rem;}
        .gem-reason-icon{font-size:13px;flex-shrink:0;margin-top:1px;}
        .gem-reason-text{color:#9d8fcc;line-height:1.45;}
        /* CHAT */
        .chat-box{background:#0d0c22;border:1px solid #1e1c45;border-radius:22px;width:100%;max-width:640px;height:85vh;display:flex;flex-direction:column;animation:fadeUp .25s both;}
        .chat-head{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid #13102a;flex-shrink:0;}
        .chat-av{width:34px;height:34px;background:linear-gradient(135deg,#7c3aed,#4f46e5);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;}
        .chat-name{font-family:'Cormorant Garamond',serif;font-size:1rem;font-weight:700;color:#fff;margin-bottom:1px;}
        .chat-sub{font-size:.68rem;color:#5a5488;}
        .chat-msgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:12px;}
        .msg{display:flex;gap:8px;align-items:flex-end;}
        .msg-u{flex-direction:row-reverse;}
        .bot-av{width:24px;height:24px;background:linear-gradient(135deg,#7c3aed,#4f46e5);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0;}
        .bubble{padding:9px 12px;border-radius:14px;max-width:85%;font-size:.81rem;line-height:1.6;}
        .bub-b{background:#13102a;border:1px solid #1e1c45;color:#b0a8d8;border-bottom-left-radius:4px;}
        .bub-u{background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#fff;border-bottom-right-radius:4px;}
        .dot{display:inline-block;width:6px;height:6px;background:#5a5488;border-radius:50%;margin:0 2px;animation:bounce 1.2s infinite;}
        .dot:nth-child(2){animation-delay:.2s;}.dot:nth-child(3){animation-delay:.4s;}
        @keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-5px)}}
        .chips{padding:0 14px 8px;display:flex;flex-wrap:wrap;gap:5px;}
        .chip{background:#13102a;border:1px solid #2a2560;border-radius:20px;padding:4px 11px;color:#7c6fac;font-family:inherit;font-size:.7rem;cursor:pointer;transition:all .2s;text-align:left;}
        .chip:hover{border-color:#7c3aed;color:#c084fc;}
        .chat-inp-row{display:flex;gap:7px;padding:10px 14px;border-top:1px solid #13102a;flex-shrink:0;}
        .chat-inp{flex:1;background:#13102a;border:1px solid #1e1c45;border-radius:10px;padding:9px 12px;color:#e2dff5;font-family:inherit;font-size:.83rem;outline:none;transition:border-color .2s;}
        .chat-inp:focus{border-color:#7c3aed;}.chat-inp::placeholder{color:#3d3870;}
        .send-btn{background:linear-gradient(135deg,#7c3aed,#4f46e5);border:none;border-radius:10px;padding:9px 14px;color:#fff;font-size:1rem;cursor:pointer;transition:opacity .2s;flex-shrink:0;}
        .send-btn:disabled{opacity:.4;cursor:not-allowed;}
        /* SOP */
        .sop-box{background:#0d0c22;border:1px solid #1e1c45;border-radius:22px;width:100%;max-width:680px;max-height:92vh;overflow-y:auto;animation:fadeUp .25s both;}
        .sop-head{display:flex;justify-content:space-between;align-items:flex-start;padding:18px 20px 12px;border-bottom:1px solid #13102a;}
        .sop-title{font-family:'Cormorant Garamond',serif;font-size:1.25rem;font-weight:800;color:#fff;margin-bottom:2px;}
        .sop-sub{font-size:.73rem;color:#5a5488;}
        .sop-tabs{display:flex;gap:4px;padding:12px 20px 0;flex-wrap:wrap;}
        .sop-tab{background:transparent;border:1px solid #1e1c45;border-radius:8px;padding:6px 11px;color:#5a5488;font-family:inherit;font-size:.75rem;cursor:pointer;transition:all .2s;}
        .sop-tab.active{background:#7c3aed22;border-color:#7c3aed55;color:#a78bfa;}
        .sop-fields{padding:12px 20px;display:flex;flex-direction:column;gap:8px;}
        .sop-inp{background:#13102a;border:1px solid #1e1c45;border-radius:10px;padding:9px 12px;color:#e2dff5;font-family:inherit;font-size:.82rem;outline:none;width:100%;transition:border-color .2s;}
        .sop-inp:focus{border-color:#7c3aed;}.sop-inp::placeholder{color:#3d3870;}
        .sop-ta{resize:vertical;min-height:74px;}
        .gen-btn{margin:0 20px 12px;background:linear-gradient(135deg,#7c3aed,#4f46e5);border:none;border-radius:10px;padding:11px 18px;color:#fff;font-family:inherit;font-size:.86rem;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:7px;transition:opacity .2s;}
        .gen-btn:disabled{opacity:.5;cursor:not-allowed;}
        .spin-sm{width:14px;height:14px;border:2px solid #ffffff44;border-top-color:#fff;border-radius:50%;animation:spin .8s linear infinite;flex-shrink:0;}
        .sop-res{margin:0 20px 20px;background:#080810;border:1px solid #1e1c45;border-radius:12px;overflow:hidden;}
        .sop-res-head{display:flex;justify-content:space-between;align-items:center;padding:9px 13px;border-bottom:1px solid #1e1c45;background:#13102a;}
        .sop-res-body{padding:13px;font-size:.81rem;color:#b0a8d8;line-height:1.75;white-space:pre-wrap;max-height:320px;overflow-y:auto;}
        .copy-btn{background:#1e1c45;border:1px solid #2a2560;border-radius:6px;padding:4px 9px;color:#9d8fcc;font-family:inherit;font-size:.72rem;cursor:pointer;transition:all .2s;white-space:nowrap;}
        .copy-btn:hover{border-color:#7c3aed;color:#c084fc;}
        /* MODAL */
        .modal-box{background:#0d0c22;border:1px solid #1e1c45;border-radius:22px;width:100%;max-width:820px;max-height:92vh;overflow-y:auto;position:relative;animation:fadeUp .25s both;}
        .modal-head{padding:18px 22px 13px;border-bottom:1px solid #13102a;}
        .modal-badges{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:9px;}
        .modal-title{font-family:'Cormorant Garamond',serif;font-size:1.45rem;font-weight:800;color:#fff;margin-bottom:4px;line-height:1.2;}
        .modal-body{padding:18px 22px;}
        .msec{margin-bottom:20px;}
        .sec-lbl{display:block;font-size:.69rem;text-transform:uppercase;letter-spacing:2.5px;color:#3d3870;font-weight:600;margin-bottom:11px;}
        .drow{display:flex;align-items:flex-start;gap:7px;margin-bottom:5px;font-size:.8rem;color:#9d8fcc;line-height:1.45;}
        .dico{font-size:11px;flex-shrink:0;margin-top:2px;}
        .courses-wrap{display:flex;flex-wrap:wrap;gap:5px;}
        .course-chip{background:#13102a;border:1px solid #1e1c45;border-radius:20px;padding:4px 11px;font-size:.73rem;color:#a78bfa;}
        .how-list{list-style:none;display:flex;flex-direction:column;gap:8px;}
        .how-step{display:flex;gap:10px;align-items:flex-start;font-size:.8rem;color:#b0a8d8;line-height:1.55;}
        .step-n{background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#fff;border-radius:50%;width:20px;height:20px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;flex-shrink:0;margin-top:2px;}
        .modal-actions{display:flex;gap:7px;flex-wrap:wrap;padding-top:14px;border-top:1px solid #13102a;}
        .pri-btn{background:linear-gradient(135deg,#7c3aed,#4f46e5);border:none;border-radius:10px;padding:9px 16px;color:#fff;font-family:inherit;font-size:.84rem;font-weight:600;cursor:pointer;text-decoration:none;display:inline-block;transition:opacity .2s;}
        .pri-btn:hover{opacity:.88;}
        .sec-btn{background:#0f0e25;border:1px solid #1e1c45;border-radius:10px;padding:9px 13px;color:#9d8fcc;font-family:inherit;font-size:.8rem;font-weight:600;cursor:pointer;transition:all .2s;}
        .sec-btn:hover{border-color:#7c3aed;color:#a78bfa;}
        .active-green{background:#064e3b22;border-color:#34d39933;color:#34d399;}
        .active-blue{background:#1d4ed822;border-color:#1d4ed855;color:#60a5fa;}
        .active-purple{background:#7c3aed22;border-color:#7c3aed55;color:#a78bfa;}
        .similar-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:9px;}
        .sim-card{background:#13102a;border:1px solid #1e1c45;border-radius:11px;padding:12px;cursor:pointer;transition:all .2s;}
        .sim-card:hover{background:#1a1840;border-color:#2a2560;transform:translateY(-2px);}
        .sim-name{font-family:'Cormorant Garamond',serif;font-size:.9rem;font-weight:700;color:#e2dff5;margin-bottom:3px;line-height:1.3;}
        .sim-meta{font-size:.68rem;color:#5a5488;}
        /* ACCEPTANCE */
        .acc{font-size:.68rem;font-weight:700;padding:2px 7px;border-radius:20px;white-space:nowrap;}
        .acc-hi{background:#064e3b22;color:#34d399;border:1px solid #34d39944;}
        .acc-mid{background:#78350f22;color:#fbbf24;border:1px solid #fbbf2444;}
        .acc-low{background:#7f1d1d22;color:#f87171;border:1px solid #f8717144;}
        .acc-box{background:#13102a;border:1px solid #1e1c45;border-radius:12px;padding:13px;margin-bottom:16px;}
        .acc-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:7px;flex-wrap:wrap;gap:4px;}
        .acc-track{height:5px;background:#0f0e25;border-radius:4px;overflow:hidden;margin-bottom:9px;}
        .acc-fill{height:100%;border-radius:4px;transition:width .8s ease;}
        .acc-reasons{display:flex;flex-direction:column;gap:4px;}
        .acc-reason{display:flex;gap:6px;font-size:.75rem;color:#9d8fcc;align-items:flex-start;line-height:1.4;}
        /* HERO */
        .hero{text-align:center;padding:44px 20px 24px;}
        .pulse-row{display:inline-flex;align-items:center;gap:7px;background:#0f0e25;border:1px solid #2a2560;border-radius:30px;padding:5px 14px;font-size:10px;color:#9d8fcc;letter-spacing:3px;text-transform:uppercase;margin-bottom:16px;}
        .pulse-dot{width:6px;height:6px;background:#34d399;border-radius:50%;animation:pulse 2s ease-in-out infinite;}
        @keyframes pulse{0%,100%{opacity:1;box-shadow:0 0 0 0 #34d39955}50%{opacity:.7;box-shadow:0 0 0 5px #34d39900}}
        .hero-title{font-family:'Cormorant Garamond',serif;font-size:clamp(2rem,5.5vw,3.8rem);font-weight:800;line-height:1.05;color:#fff;margin-bottom:10px;letter-spacing:-1px;}
        .hero-title span{background:linear-gradient(135deg,#c084fc,#818cf8,#34d399);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
        .hero-sub{color:#7e78a8;font-size:.9rem;max-width:520px;margin:0 auto 20px;line-height:1.7;font-weight:300;}
        .stat-bar{display:flex;gap:0;justify-content:center;margin-bottom:16px;background:#0f0e25;border:1px solid #1e1c45;border-radius:14px;max-width:580px;margin-left:auto;margin-right:auto;overflow:hidden;}
        .stat{text-align:center;padding:12px 14px;flex:1;min-width:60px;border-right:1px solid #1e1c45;}
        .stat:last-child{border-right:none;}
        .stat-n{font-family:'Cormorant Garamond',serif;font-size:1.6rem;font-weight:800;background:linear-gradient(135deg,#c084fc,#818cf8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
        .stat-l{font-size:.63rem;color:#3d3870;text-transform:uppercase;letter-spacing:1.5px;margin-top:1px;}
        .prof-bar{max-width:860px;margin:0 auto 10px;display:flex;align-items:center;gap:6px;padding:8px 14px;background:#0f0e25;border:1px solid #1e1c45;border-radius:12px;flex-wrap:wrap;}
        .prof-chip{background:#13102a;border:1px solid #1e1c45;border-radius:20px;padding:3px 9px;font-size:.68rem;color:#c084fc;}
        .prof-lbl{font-size:.68rem;color:#3d3870;}
        .upd-btn{margin-left:auto;background:transparent;border:1px solid #1e1c45;border-radius:8px;padding:4px 9px;color:#5a5488;font-family:inherit;font-size:.7rem;cursor:pointer;transition:all .2s;white-space:nowrap;}
        .upd-btn:hover{border-color:#7c3aed;color:#c084fc;}
        .status-bar{max-width:860px;margin:0 auto 10px;display:flex;align-items:center;justify-content:space-between;gap:9px;padding:8px 14px;background:#0f0e25;border:1px solid #1e1c45;border-radius:12px;flex-wrap:wrap;}
        .status-txt{font-size:.75rem;color:#7e78a8;display:flex;align-items:center;gap:5px;}
        .ref-btn{background:transparent;border:1px solid #1e1c45;border-radius:8px;padding:4px 9px;color:#9d8fcc;font-family:inherit;font-size:.71rem;cursor:pointer;transition:all .2s;white-space:nowrap;}
        .ref-btn:hover{background:#1e1c45;color:#c084fc;}.ref-btn:disabled{opacity:.4;cursor:not-allowed;}
        .cache-note{font-size:.66rem;color:#3d3870;}
        /* CHAT FAB */
        .chat-fab{position:fixed;bottom:22px;right:22px;z-index:500;background:linear-gradient(135deg,#7c3aed,#4f46e5);border:none;border-radius:50%;width:54px;height:54px;display:flex;align-items:center;justify-content:center;font-size:21px;cursor:pointer;box-shadow:0 8px 30px rgba(124,58,237,.45);transition:transform .2s,box-shadow .2s;}
        .chat-fab:hover{transform:scale(1.1);box-shadow:0 12px 40px rgba(124,58,237,.6);}
        .fab-lbl{position:absolute;right:62px;background:#0d0c22;border:1px solid #2a2560;border-radius:20px;padding:5px 11px;font-size:.72rem;color:#c084fc;white-space:nowrap;font-family:inherit;}
        /* SEARCH */
        .search-box{background:#0f0e25;border:1px solid #1e1c45;border-radius:16px;padding:14px;max-width:860px;margin:0 auto 10px;}
        .search-row{display:flex;gap:8px;margin-bottom:8px;}
        .search-inp{flex:1;background:#080810;border:1px solid #1e1c45;border-radius:10px;padding:10px 13px;color:#e2dff5;font-family:inherit;font-size:.88rem;outline:none;transition:border-color .2s;}
        .search-inp::placeholder{color:#3d3870;}.search-inp:focus{border-color:#7c3aed;}
        .search-btn{background:linear-gradient(135deg,#7c3aed,#4f46e5);border:none;border-radius:10px;padding:10px 17px;color:#fff;font-family:inherit;font-size:.84rem;font-weight:600;cursor:pointer;transition:opacity .2s,transform .1s;white-space:nowrap;}
        .search-btn:hover{opacity:.9;transform:translateY(-1px);}.search-btn:disabled{opacity:.5;cursor:not-allowed;transform:none;}
        .filt-row{display:flex;gap:7px;flex-wrap:wrap;}
        .filt-sel{background:#080810;border:1px solid #1e1c45;border-radius:8px;padding:7px 10px;color:#b0a8d8;font-family:inherit;font-size:.79rem;outline:none;cursor:pointer;flex:1;min-width:110px;}
        .filt-sel:focus{border-color:#7c3aed;}
        /* MAIN */
        .main{max-width:1280px;margin:0 auto;padding:0 18px 80px;}
        .top-bar{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:9px;margin-bottom:18px;}
        .tabs{display:flex;gap:3px;background:#0f0e25;border:1px solid #1e1c45;border-radius:12px;padding:4px;flex-wrap:wrap;}
        .tab-btn{background:transparent;border:none;border-radius:9px;padding:8px 11px;color:#5a5488;font-family:inherit;font-size:.77rem;font-weight:500;cursor:pointer;transition:all .2s;white-space:nowrap;}
        .tab-btn.active{background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#fff;}
        .sf-row{display:flex;gap:5px;}
        .sf-btn{background:#0f0e25;border:1px solid #1e1c45;border-radius:20px;padding:5px 11px;color:#5a5488;font-family:inherit;font-size:.76rem;cursor:pointer;transition:all .2s;}
        .sf-btn.active{border-color:#7c3aed;color:#c084fc;background:#7c3aed22;}
        .sec-header{display:flex;align-items:center;gap:9px;margin-bottom:16px;}
        .sec-title{font-family:'Cormorant Garamond',serif;font-size:1.15rem;font-weight:700;color:#fff;white-space:nowrap;}
        .sec-div{flex:1;height:1px;background:linear-gradient(90deg,#1e1c45,transparent);}
        /* GRID & CARDS */
        .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;}
        .card{background:#0f0e25;border:1px solid #1e1c45;border-radius:16px;padding:17px;transition:transform .2s,box-shadow .2s,border-color .2s;animation:fadeUp .4s both;display:flex;flex-direction:column;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(15px)}to{opacity:1;transform:translateY(0)}}
        .card:hover{transform:translateY(-4px);box-shadow:0 14px 50px rgba(124,58,237,.12);border-color:#2a2560;}
        .card-off{opacity:.5;filter:saturate(.2);}.card-off:hover{opacity:.75;filter:saturate(.4);}
        .card-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:9px;gap:4px;}
        .tag{font-size:9px;font-weight:700;letter-spacing:.6px;padding:3px 8px;border-radius:20px;text-transform:uppercase;}
        .new-badge{font-size:9px;font-weight:700;padding:3px 8px;border-radius:20px;background:#34d39922;color:#34d399;border:1px solid #34d39944;text-transform:uppercase;}
        .sbadge{font-size:9.5px;font-weight:600;padding:3px 8px;border-radius:20px;}
        .sopen{background:#064e3b22;color:#34d399;border:1px solid #34d39944;}
        .sclosed{background:#7f1d1d22;color:#f87171;border:1px solid #f8717144;}
        .card-title{font-family:'Cormorant Garamond',serif;font-size:.97rem;font-weight:700;color:#fff;margin-bottom:2px;line-height:1.3;}
        .card-host{font-size:.71rem;color:#5a5488;margin-bottom:2px;}
        .card-country{font-size:.68rem;color:#3d3870;margin-bottom:8px;}
        .card-details{margin-bottom:8px;flex:1;}
        .mini-courses{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:9px;}
        .mini-chip{background:#13102a;border:1px solid #1e1c45;border-radius:20px;padding:2px 8px;font-size:.67rem;color:#7c6fac;white-space:nowrap;}
        .mini-chip.more{color:#3d3870;border-color:#13102a;}
        .card-foot{display:flex;align-items:center;gap:5px;margin-top:auto;}
        .link-btn{background:#080810;border:1px solid #1e1c45;border-radius:8px;padding:6px 8px;color:#60a5fa;font-size:.72rem;font-weight:600;text-decoration:none;white-space:nowrap;transition:all .2s;flex-shrink:0;}
        .link-btn:hover{background:#0f0e25;border-color:#3b82f6;}
        .view-btn{flex:1;background:#7c3aed18;border:1px solid #7c3aed33;border-radius:8px;padding:6px 8px;color:#a78bfa;font-size:.73rem;font-weight:600;cursor:pointer;transition:all .2s;font-family:inherit;}
        .view-btn:hover{background:#7c3aed33;color:#c4b5fd;}
        .save-btn{background:#13102a;border:1px solid #1e1c45;border-radius:8px;padding:6px 8px;cursor:pointer;font-size:13px;transition:all .2s;flex-shrink:0;}
        .save-btn:hover{background:#1e1c45;}.save-btn.saved{background:#064e3b22;border-color:#34d39933;}
        .cmp-btn{background:transparent;border:none;cursor:pointer;font-size:12px;padding:2px;transition:all .2s;flex-shrink:0;}
        .cmp-btn:hover{transform:scale(1.2);}
        .dl-bar-wrap{margin-bottom:8px;}
        .dl-track{height:3px;background:#13102a;border-radius:4px;overflow:hidden;margin-bottom:3px;}
        .dl-fill{height:100%;border-radius:4px;transition:width .6s ease;}
        .cd{font-size:.67rem;font-weight:700;padding:2px 7px;border-radius:20px;white-space:nowrap;}
        .cd-red{background:#7f1d1d22;color:#f87171;border:1px solid #f8717144;}
        .cd-yellow{background:#78350f22;color:#fbbf24;border:1px solid #fbbf2444;}
        .cd-green{background:#064e3b22;color:#34d399;border:1px solid #34d39944;}
        .cd-blue{background:#1e3a5f22;color:#60a5fa;border:1px solid #60a5fa44;}
        .cd-off{background:#33333322;color:#666;border:1px solid #44444444;}
        .mbadge{font-size:.68rem;font-weight:700;padding:2px 7px;border-radius:20px;border:1px solid;}
        .ai-sum{background:linear-gradient(135deg,#13102a,#0a1020);border:1px solid #1e1c45;border-radius:12px;padding:13px 17px;margin-bottom:17px;font-size:.85rem;color:#9d8fcc;line-height:1.7;}
        .ai-sum strong{color:#c084fc;}
        .loading{text-align:center;padding:55px 20px;}
        .spinner{width:34px;height:34px;border:3px solid #1e1c45;border-top-color:#7c3aed;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 13px;}
        @keyframes spin{to{transform:rotate(360deg)}}
        .load-txt{font-size:.86rem;color:#c084fc;margin-bottom:4px;}
        .load-sub{font-size:.72rem;color:#3d3870;}
        .empty-state{text-align:center;padding:48px;color:#3d3870;}
        .empty-state h3{color:#5a5488;margin-bottom:7px;font-family:'Cormorant Garamond',serif;font-size:1.3rem;font-weight:700;}
        .empty-state p{font-size:.83rem;line-height:1.6;}
        .skel-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;}
        .skel-card{background:#0f0e25;border:1px solid #1e1c45;border-radius:16px;padding:17px;height:240px;}
        .skel-line{background:linear-gradient(90deg,#13102a 25%,#1a1840 50%,#13102a 75%);background-size:200% 100%;animation:shimmer 1.5s infinite;border-radius:6px;margin-bottom:8px;}
        @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        .cmp-table{background:#0f0e25;border:1px solid #1e1c45;border-radius:16px;overflow:hidden;overflow-x:auto;}
        .cmp-row{display:grid;grid-template-columns:120px repeat(3,1fr);border-bottom:1px solid #13102a;min-width:480px;}
        .cmp-row:last-child{border-bottom:none;}
        .cmp-header{background:#13102a;}
        .cmp-lbl{padding:11px 13px;font-size:.72rem;font-weight:600;color:#5a5488;text-transform:uppercase;letter-spacing:.5px;border-right:1px solid #13102a;display:flex;align-items:center;}
        .cmp-col-head{padding:12px;border-right:1px solid #13102a;}.cmp-col-head:last-child{border-right:none;}
        .cmp-cell{padding:11px 13px;font-size:.77rem;color:#9d8fcc;border-right:1px solid #13102a;line-height:1.5;}.cmp-cell:last-child{border-right:none;}
        .trk-board{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;}
        .trk-col{background:#0f0e25;border:1px solid #1e1c45;border-radius:14px;overflow:hidden;display:flex;flex-direction:column;}
        .trk-head{display:flex;align-items:center;gap:6px;padding:11px 13px;background:#13102a;}
        .trk-col-name{font-size:.78rem;font-weight:600;color:#e2dff5;flex:1;}
        .trk-cnt{font-size:.68rem;font-weight:700;padding:2px 6px;border-radius:20px;}
        .trk-body{flex:1;padding:9px;display:flex;flex-direction:column;gap:7px;min-height:80px;}
        .trk-empty{flex:1;display:flex;align-items:center;justify-content:center;font-size:.72rem;color:#3d3870;border:1px dashed #1e1c45;border-radius:8px;padding:14px;text-align:center;}
        .trk-card{background:#13102a;border:1px solid #1e1c45;border-radius:8px;padding:9px;transition:all .2s;}
        .trk-card:hover{background:#1a1840;transform:translateY(-2px);box-shadow:0 4px 14px rgba(0,0,0,.3);}
        .trk-btns{display:flex;flex-wrap:wrap;gap:3px;margin-top:6px;}
        .trk-mv-btn{background:transparent;border:1px solid #2a2560;border-radius:5px;padding:2px 6px;color:#5a5488;font-family:inherit;font-size:.64rem;cursor:pointer;transition:all .2s;}
        .trk-mv-btn:hover{border-color:#7c3aed;color:#c084fc;}
        .x-btn{background:#13102a;border:1px solid #1e1c45;border-radius:8px;color:#7e78a8;font-size:12px;padding:5px 8px;cursor:pointer;transition:all .2s;}
        .x-btn:hover{color:#fff;background:#1e1c45;}
        @media(max-width:600px){.cmp-row{grid-template-columns:80px repeat(2,1fr);}.trk-board{grid-template-columns:1fr;}.modal-actions{flex-direction:column;}.fab-lbl{display:none;}.dash-stats{grid-template-columns:repeat(3,1fr);}}
        /* HEATMAP */
        .heatmap-wrap{max-width:1000px;margin:0 auto;}
        .hm-header{margin-bottom:22px;}
        .hm-title{font-family:'Cormorant Garamond',serif;font-size:1.6rem;font-weight:800;color:#fff;margin-bottom:6px;}
        .hm-sub{font-size:.84rem;color:#7e78a8;}
        .hm-body{display:grid;grid-template-columns:1fr 300px;gap:16px;margin-bottom:22px;}
        @media(max-width:700px){.hm-body{grid-template-columns:1fr;}}
        .hm-map{background:#0f0e25;border:1px solid #1e1c45;border-radius:16px;padding:14px;overflow:hidden;}
        .hm-sidebar{display:flex;flex-direction:column;gap:10px;}
        .hm-legend{background:#0f0e25;border:1px solid #1e1c45;border-radius:14px;padding:13px;display:flex;flex-direction:column;gap:7px;}
        .hm-leg-item{background:#13102a;border:1px solid #1e1c45;border-radius:9px;padding:8px 10px;cursor:pointer;transition:all .2s;}
        .hm-leg-item:hover,.hm-leg-active{background:#1a1840;border-color:#2a2560;}
        .hm-leg-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;gap:5px;flex-wrap:wrap;}
        .hm-leg-name{font-size:.76rem;font-weight:600;color:#e2dff5;}
        .hm-leg-open{font-size:.7rem;font-weight:700;}
        .hm-leg-total{font-size:.66rem;color:#3d3870;}
        .hm-leg-bar{height:3px;background:#080810;border-radius:4px;overflow:hidden;}
        .hm-detail{background:#0f0e25;border:1px solid #1e1c45;border-radius:14px;padding:13px;}
        .hm-detail-title{font-family:'Cormorant Garamond',serif;font-size:.96rem;font-weight:700;margin-bottom:3px;}
        .hm-detail-sub{font-size:.71rem;color:#5a5488;margin-bottom:10px;}
        .hm-detail-list{display:flex;flex-direction:column;gap:5px;margin-bottom:10px;}
        .hm-sch-item{display:flex;justify-content:space-between;align-items:center;gap:5px;flex-wrap:wrap;}
        .hm-sch-name{font-size:.73rem;color:#b0a8d8;flex:1;}
        .hm-explore-btn{width:100%;background:transparent;border:1px solid;border-radius:9px;padding:7px;font-family:inherit;font-size:.76rem;font-weight:600;cursor:pointer;transition:opacity .2s;}
        .hm-explore-btn:hover{opacity:.8;}
        .hm-hint{background:#0f0e25;border:1px solid #1e1c45;border-radius:14px;}
        .hm-countries{background:#0f0e25;border:1px solid #1e1c45;border-radius:16px;padding:16px;}
        .hm-country-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:7px;}
        .hm-country-item{display:flex;align-items:center;gap:7px;background:#13102a;border:1px solid #1e1c45;border-radius:9px;padding:7px 9px;}
        .hm-country-flag{font-size:15px;flex-shrink:0;}
        .hm-country-info{flex:1;min-width:0;}
        .hm-country-name{font-size:.7rem;color:#b0a8d8;display:block;margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .hm-country-bar{height:3px;background:#080810;border-radius:4px;overflow:hidden;}
        .hm-country-cnt{font-size:.7rem;font-weight:700;color:#a78bfa;flex-shrink:0;}
        /* STUDENTS LIKE YOU */
        .sly-wrap{max-width:900px;margin:0 auto;}
        .sly-header{margin-bottom:22px;}
        .sly-title{font-family:'Cormorant Garamond',serif;font-size:1.6rem;font-weight:800;color:#fff;margin-bottom:6px;}
        .sly-sub{font-size:.84rem;color:#7e78a8;}
        .sly-popular{background:#0f0e25;border:1px solid #1e1c45;border-radius:16px;padding:16px;margin-bottom:20px;}
        .sly-popular-item{background:#13102a;border:1px solid #1e1c45;border-radius:10px;padding:10px 12px;cursor:pointer;transition:all .2s;margin-bottom:6px;}
        .sly-popular-item:last-child{margin-bottom:0;}
        .sly-popular-item:hover{background:#1a1840;transform:translateX(3px);}
        .sly-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px;}
        .sly-card{background:#0f0e25;border:1px solid #1e1c45;border-radius:14px;padding:14px;cursor:pointer;transition:all .2s;}
        .sly-card:hover,.sly-expanded{border-color:#2a2560;background:#13102a;}
        .sly-card-top{display:flex;align-items:center;gap:10px;margin-bottom:11px;}
        .sly-avatar{width:36px;height:36px;background:linear-gradient(135deg,#7c3aed,#4f46e5);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#fff;flex-shrink:0;font-family:'Cormorant Garamond',serif;}
        .sly-info{flex:1;}
        .sly-name{font-size:.82rem;font-weight:700;color:#e2dff5;margin-bottom:2px;}
        .sly-meta{font-size:.68rem;color:#5a5488;}
        .sly-expand{font-size:.68rem;color:#3d3870;flex-shrink:0;}
        .sly-applying{margin-bottom:9px;display:flex;flex-direction:column;gap:5px;}
        .sly-tag{background:#13102a;border:1px solid #1e1c45;border-radius:20px;padding:2px 8px;font-size:.66rem;color:#a78bfa;}
        .sly-tip{display:flex;gap:7px;align-items:flex-start;background:#7c3aed11;border:1px solid #7c3aed33;border-radius:9px;padding:9px;margin-top:9px;animation:fadeUp .2s both;}
        .sly-tip-icon{font-size:13px;flex-shrink:0;}
        .sly-tip-text{font-size:.76rem;color:#c084fc;line-height:1.55;}
        /* CALENDAR */
        .cal-wrap{max-width:860px;margin:0 auto;}
        .cal-header{margin-bottom:20px;}
        .cal-title{font-family:'Cormorant Garamond',serif;font-size:1.6rem;font-weight:800;color:#fff;margin-bottom:6px;}
        .cal-sub{font-size:.84rem;color:#7e78a8;}
        .cal-export-row{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px;margin-bottom:16px;}
        .cal-export-btn{background:#0f0e25;border:1px solid #1e1c45;border-radius:14px;padding:14px;cursor:pointer;transition:all .2s;display:flex;flex-direction:column;gap:4px;text-align:left;font-family:inherit;font-size:.82rem;font-weight:600;}
        .cal-export-btn:hover{border-color:#7c3aed55;background:#13102a;transform:translateY(-2px);}
        .cal-ics{color:#c084fc;border-color:#7c3aed33;}
        .cal-saved{color:#34d399;border-color:#34d39933;}
        .cal-urgent{color:#f87171;border-color:#f8717133;}
        .cal-export-sub{font-size:.68rem;opacity:.6;font-weight:400;}
        .cal-success{background:#064e3b22;border:1px solid #34d39933;border-radius:10px;padding:11px 14px;margin-bottom:14px;font-size:.81rem;color:#34d399;text-align:center;}
        .cal-how{background:#0f0e25;border:1px solid #1e1c45;border-radius:16px;padding:16px;margin-bottom:20px;}
        .cal-how-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;}
        .cal-how-card{background:#13102a;border:1px solid #1e1c45;border-radius:12px;padding:12px;}
        .cal-how-icon{font-size:22px;margin-bottom:7px;}
        .cal-how-title{font-size:.78rem;font-weight:700;color:#e2dff5;margin-bottom:7px;}
        .cal-how-steps{padding-left:13px;display:flex;flex-direction:column;gap:3px;}
        .cal-how-steps li{font-size:.7rem;color:#9d8fcc;line-height:1.45;}
        .cal-urgent-section{background:#0f0e25;border:1px solid #f8717133;border-radius:16px;padding:16px;margin-bottom:16px;}
        .cal-list{display:flex;flex-direction:column;gap:7px;}
        .cal-item{background:#0f0e25;border:1px solid #1e1c45;border-radius:10px;padding:11px 13px;transition:all .2s;}
        .cal-item:hover{background:#13102a;}
        .cal-item-main{display:flex;justify-content:space-between;align-items:center;gap:9px;flex-wrap:wrap;}
        .cal-item-name{font-size:.8rem;font-weight:600;color:#e2dff5;margin-bottom:2px;}
        .cal-item-meta{font-size:.68rem;color:#5a5488;}
        .cal-add-btn{background:#13102a;border:1px solid #2a2560;border-radius:8px;padding:5px 10px;color:#9d8fcc;font-family:inherit;font-size:.7rem;font-weight:600;cursor:pointer;transition:all .2s;white-space:nowrap;}
        .cal-add-btn:hover{border-color:#7c3aed;color:#c084fc;}
        .cal-added{background:#064e3b22;border-color:#34d39933;color:#34d399;}
        /* CV REVIEWER */
        .cv-wrap{max-width:860px;margin:0 auto;}
        .cv-header{margin-bottom:22px;}
        .cv-title{font-family:'Cormorant Garamond',serif;font-size:1.6rem;font-weight:800;color:#fff;margin-bottom:6px;}
        .cv-sub{font-size:.84rem;color:#7e78a8;}
        .cv-input-box{background:#0f0e25;border:1px solid #1e1c45;border-radius:18px;padding:20px;margin-bottom:22px;}
        .cv-mode-tabs{display:flex;gap:6px;margin-bottom:14px;}
        .cv-mode-btn{background:transparent;border:1px solid #1e1c45;border-radius:10px;padding:8px 16px;color:#5a5488;font-family:inherit;font-size:.82rem;font-weight:500;cursor:pointer;transition:all .2s;}
        .cv-mode-btn.active{background:#7c3aed22;border-color:#7c3aed55;color:#a78bfa;}
        .cv-textarea{width:100%;background:#080810;border:1px solid #1e1c45;border-radius:12px;padding:14px;color:#e2dff5;font-family:inherit;font-size:.83rem;line-height:1.6;outline:none;resize:vertical;transition:border-color .2s;min-height:200px;}
        .cv-textarea:focus{border-color:#7c3aed;}
        .cv-textarea::placeholder{color:#3d3870;}
        .cv-upload-zone{background:#080810;border:2px dashed #1e1c45;border-radius:14px;padding:36px 20px;cursor:pointer;transition:all .2s;text-align:center;}
        .cv-upload-zone:hover{border-color:#7c3aed55;background:#0f0e25;}
        .cv-error{color:#f87171;font-size:.78rem;margin-top:10px;padding:8px 12px;background:#7f1d1d22;border:1px solid #f8717133;border-radius:8px;}
        .cv-footer-row{display:flex;justify-content:space-between;align-items:center;margin-top:12px;gap:10px;flex-wrap:wrap;}
        .cv-analyse-btn{background:linear-gradient(135deg,#7c3aed,#4f46e5);border:none;border-radius:12px;padding:12px 24px;color:#fff;font-family:inherit;font-size:.9rem;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:8px;transition:opacity .2s;}
        .cv-analyse-btn:disabled{opacity:.45;cursor:not-allowed;}
        .cv-analyse-btn:hover:not(:disabled){opacity:.88;}
        .cv-results{display:flex;flex-direction:column;gap:16px;}
        .cv-score-card{background:linear-gradient(135deg,#13102a,#0d1a3a);border:1px solid #2a2560;border-radius:18px;padding:22px;display:flex;align-items:flex-start;gap:20px;flex-wrap:wrap;}
        .cv-score-left{display:flex;align-items:center;gap:14px;flex-shrink:0;}
        .cv-score-circle{width:72px;height:72px;border-radius:50%;border:3px solid;display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0;}
        .cv-score-num{font-family:'Cormorant Garamond',serif;font-size:1.6rem;font-weight:800;line-height:1;}
        .cv-score-label{font-size:.6rem;color:#5a5488;}
        .cv-grade{font-family:'Cormorant Garamond',serif;font-size:1.3rem;font-weight:800;}
        .cv-summary{font-size:.86rem;color:#b0a8d8;line-height:1.65;flex:1;min-width:200px;}
        .cv-categories{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;}
        .cv-cat-card{background:#0f0e25;border:1px solid #1e1c45;border-radius:14px;padding:16px;}
        .cv-cat-head{display:flex;align-items:center;gap:8px;margin-bottom:8px;}
        .cv-cat-icon{font-size:16px;flex-shrink:0;}
        .cv-cat-name{flex:1;font-size:.8rem;font-weight:600;color:#e2dff5;}
        .cv-cat-score{font-size:.82rem;font-weight:700;flex-shrink:0;}
        .cv-cat-bar-track{height:5px;background:#13102a;border-radius:4px;overflow:hidden;margin-bottom:10px;}
        .cv-cat-bar-fill{height:100%;border-radius:4px;transition:width .8s ease;}
        .cv-cat-feedback{font-size:.78rem;color:#9d8fcc;line-height:1.5;margin-bottom:10px;}
        .cv-cat-tips{display:flex;flex-direction:column;gap:5px;}
        .cv-tip{display:flex;gap:6px;font-size:.74rem;color:#7e78a8;line-height:1.45;}
        .cv-two-col{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
        @media(max-width:580px){.cv-two-col{grid-template-columns:1fr;}}
        .cv-strengths,.cv-redflags{background:#0f0e25;border:1px solid #1e1c45;border-radius:14px;padding:16px;}
        .cv-strength-item,.cv-flag-item{display:flex;gap:7px;font-size:.78rem;color:#b0a8d8;line-height:1.5;margin-bottom:7px;align-items:flex-start;}
        .cv-strength-item:last-child,.cv-flag-item:last-child{margin-bottom:0;}
        .cv-actions-box{background:linear-gradient(135deg,#7c3aed11,#4f46e511);border:1px solid #7c3aed33;border-radius:16px;padding:18px;}
        .cv-action-item{display:flex;gap:12px;align-items:flex-start;margin-bottom:10px;font-size:.83rem;color:#c0b8d8;line-height:1.55;}
        .cv-action-item:last-child{margin-bottom:0;}
        .cv-action-num{background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#fff;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;margin-top:1px;}
        .cv-action-text{flex:1;}
        .cv-fit-box{background:#0f0e25;border:1px solid #1e1c45;border-radius:14px;padding:16px;}
      `}</style>

      {!hydrated && (
        <div style={{ position: "fixed", inset: 0, background: "#080810", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 9999, gap: 16 }}>
          <div style={{ width: 40, height: 40, border: "3px solid #1e1c45", borderTopColor: "#7c3aed", borderRadius: "50%", animation: "spin .8s linear infinite" }} />
          <p style={{ color: "#7e78a8", fontSize: ".9rem", fontFamily: "'Outfit',sans-serif" }}>Loading your profile...</p>
        </div>
      )}
      {quiz && <QuizModal onDone={p => { setProfile(p); setQuiz(false); persist(PERSIST_KEYS.profile, p); }} onSkip={() => setQuiz(false)} />}
      {modal && <Modal s={modal} onClose={() => setModal(null)} onSave={toggleSave} saved={isSaved(modal)} allList={allList} profile={profile} onOpen={setModal} onTrack={toggleTrack} tracked={isTracked(modal)} onCompare={toggleCompare} compared={isCompared(modal)} onSOP={s => { setSopS(s); setModal(null); }} />}
      {sopS && <SOPModal s={sopS} profile={profile} onClose={() => setSopS(null)} />}
      {showChat && <ChatModal onClose={() => setShowChat(false)} />}

      <button className="chat-fab" onClick={() => setShowChat(true)} title="Ask ScholarBot">
        <span className="fab-lbl">Ask ScholarBot 🤖</span>🤖
      </button>

      {/* NAVBAR */}
      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 28px", background: "#0d0820", borderBottom: "1px solid #1e1c45", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <svg width="32" height="32" viewBox="0 0 100 100">
            <defs>
              <linearGradient id="ng" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#7c3aed" />
                <stop offset="100%" stopColor="#4f46e5" />
              </linearGradient>
            </defs>
            <rect x="5" y="5" width="90" height="90" rx="12" fill="url(#ng)" stroke="#f5c842" strokeWidth="2" />
            <polygon points="50,18 30,28 50,36 70,28" fill="#f5c842" />
            <rect x="38" y="24" width="24" height="13" rx="2" fill="#4f46e5" stroke="#f5c842" strokeWidth="1" />
            <circle cx="50" cy="62" r="18" fill="none" stroke="#f5c842" strokeWidth="2" />
            <circle cx="50" cy="62" r="10" fill="none" stroke="#f5c842" strokeWidth="1.5" opacity="0.7" />
            <circle cx="50" cy="62" r="3.5" fill="#f5c842" />
            <line x1="50" y1="44" x2="50" y2="49" stroke="#f5c842" strokeWidth="2" strokeLinecap="round" />
            <line x1="50" y1="75" x2="50" y2="80" stroke="#f5c842" strokeWidth="2" strokeLinecap="round" />
            <line x1="32" y1="62" x2="37" y2="62" stroke="#f5c842" strokeWidth="2" strokeLinecap="round" />
            <line x1="63" y1="62" x2="68" y2="62" stroke="#f5c842" strokeWidth="2" strokeLinecap="round" />
            <rect x="72" y="56" width="6" height="12" rx="2" fill="#f5c842" />
          </svg>
          <div>
            <span style={{ fontFamily: "Georgia,serif", fontSize: "1.1rem", fontWeight: 700, background: "linear-gradient(135deg,#f5c842,#ffd700)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Scholar</span>
            <span style={{ fontFamily: "Georgia,serif", fontSize: "1.1rem", fontWeight: 700, color: "#fff" }}>Vault</span>
          </div>
        </div>
        <span style={{ fontSize: ".72rem", color: "#3d3870", letterSpacing: 2 }}>YOUR GATEWAY TO GLOBAL EDUCATION</span>
      </nav>

      <div className="app">
        <div className="hero">
          <div className="pulse-row"><span className="pulse-dot" />Live · AI-Powered · {allList.length} Scholarships</div>
          <h1 className="hero-title">Your Global<br /><span>Scholarship Hub</span></h1>
          <p className="hero-sub">Discover, match, compare, track and apply — powered by AI. Auto-discovers new scholarships every 12 hours.</p>
          <div className="stat-bar">
            {[[allList.length, "Total"], [openCount, "Open"], [trackerFlat.length, "Tracking"], [saved.length, "Saved"]].map(([n, l]) => (
              <div className="stat" key={l}><div className="stat-n">{n}</div><div className="stat-l">{l}</div></div>
            ))}
          </div>
          {profile && (<div className="prof-bar"><span className="prof-lbl">👤 {profile.name || "Your profile"}:</span>{Object.entries(profile).filter(([k]) => k !== "name").map(([k, v]) => <span key={k} className="prof-chip">{k}: {v}</span>)}<button className="upd-btn" onClick={() => { setQuiz(true); }}>✏️ Update</button></div>)}
          {!profile && !quiz && (<div style={{ maxWidth: 860, margin: "0 auto 10px", textAlign: "center" }}><button className="upd-btn" style={{ fontSize: ".8rem", padding: "7px 14px" }} onClick={() => setQuiz(true)}>🎯 Take Quiz for Match Scores & Dashboard</button></div>)}
          <div className="status-bar">
            <div className="status-txt">{autoLoading && <span style={{ width: 12, height: 12, border: "2px solid #1e1c45", borderTopColor: "#7c3aed", display: "inline-block", borderRadius: "50%", animation: "spin .8s linear infinite", flexShrink: 0 }} />}<span>{autoStatus}</span>{lastFetch && !autoLoading && <span className="cache-note">· {lastFetch.toLocaleTimeString()}</span>}</div>
            <button className="ref-btn" onClick={handleRefresh} disabled={autoLoading}>{autoLoading ? `Fetching${dots}` : "🔄 Refresh"}</button>
          </div>
          <div className="search-box">
            <div className="search-row">
              <input className="search-inp" placeholder='Search name, country, course e.g. "AI scholarships Asia"' value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && !searchLoading && handleSearch()} />
              <button className="search-btn" onClick={handleSearch} disabled={searchLoading}>{searchLoading ? `Searching${dots}` : "🔍 Search"}</button>
            </div>
            <div className="filt-row">{[[REGIONS, region, setRegion], [FIELDS, field, setField]].map(([opts, val, set], i) => <select key={i} className="filt-sel" value={val} onChange={e => set(e.target.value)}>{opts.map(o => <option key={o}>{o}</option>)}</select>)}</div>
          </div>
        </div>

        <div className="main">
          <div className="top-bar">
            <div className="tabs">{tabs.map(t => <button key={t.id} className={`tab-btn ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>{t.l}</button>)}</div>
            {(tab === "all" || tab === "new") && <div className="sf-row">{STATUS_FILTERS.map(s => <button key={s} className={`sf-btn ${statusF === s ? "active" : ""}`} onClick={() => setStatusF(s)}>{s === "Open" ? "🟢 " : s === "Closed" ? "🔴 " : ""}{s}</button>)}</div>}
          </div>

          {tab === "dashboard" && <Dashboard profile={profile} allList={allList} saved={saved} trackerFlat={trackerFlat} tracker={tracker} onOpen={setModal} onTab={setTab} />}

          {tab === "all" && (<>
            {(filteredNew.length > 0 || autoLoading) && (
              <div style={{ marginBottom: 28 }}>
                <div className="sec-header"><span className="sec-title">✨ Newly Discovered</span><div className="sec-div" />{fromCache && <span style={{ fontSize: ".66rem", color: "#3d3870", flexShrink: 0 }}>Cached</span>}</div>
                {autoLoading ? <div className="skel-grid">{[1, 2, 3].map(i => <div key={i} className="skel-card"><div className="skel-line" style={{ height: 12, width: "38%" }} /><div className="skel-line" style={{ height: 16, width: "78%" }} /><div className="skel-line" style={{ height: 10, width: "58%" }} /><div className="skel-line" style={{ height: 10, width: "68%", marginTop: 12 }} /></div>)}</div>
                  : <div className="grid">{filteredNew.map((s, i) => <Card key={s.id} {...cp(s, i, "✨ New")} />)}</div>}
              </div>
            )}
            <div className="sec-header"><span className="sec-title">📚 Curated Scholarships</span><div className="sec-div" /></div>
            {applyF(CURATED).length > 0 ? <div className="grid">{sortM(applyF(CURATED)).map((s, i) => <Card key={s.id} {...cp(s, i, null)} />)}</div> : <div className="empty-state"><h3>No matches</h3><p>Adjust your filters</p></div>}
          </>)}

          {tab === "gems" && <HiddenGems allList={allList} profile={profile} onOpen={setModal} onSave={toggleSave} isSaved={isSaved} onTrack={toggleTrack} isTracked={isTracked} onCompare={toggleCompare} isCompared={isCompared} />}

          {tab === "new" && (autoLoading ? <div className="loading"><div className="spinner" /><p className="load-txt">Fetching new scholarships{dots}</p><p className="load-sub">Searching the web for latest opportunities</p></div> : filteredNew.length > 0 ? <div className="grid">{filteredNew.map((s, i) => <Card key={s.id} {...cp(s, i, "✨ New")} />)}</div> : <div className="empty-state"><h3>No new scholarships yet</h3><p>Try refreshing</p></div>)}

          {tab === "search" && (searchLoading ? <div className="loading"><div className="spinner" /><p className="load-txt">Searching{dots}</p></div> : !hasSearched ? <div className="empty-state"><div style={{ fontSize: 38, marginBottom: 11 }}>🔍</div><h3>Search Scholarships</h3><p>Type a query above and hit Search</p></div> : <>{searchSum && <div className="ai-sum"><strong>Summary: </strong>{searchSum}</div>}{searchRes.length > 0 ? <div className="grid">{searchRes.map((s, i) => <Card key={s.id || i} {...cp(s, i, null)} />)}</div> : <div className="empty-state"><h3>No results</h3><p>Try a different query</p></div>}</>)}

          {tab === "heatmap" && <Heatmap allList={allList} profile={profile} onTab={setTab} />}
          {tab === "students" && <StudentsLikeYou profile={profile} allList={allList} onOpen={setModal} />}
          {tab === "calendar" && <CalendarSync allList={allList} saved={saved} trackerFlat={trackerFlat} />}
          {tab === "timeline" && <Timeline allList={allList} profile={profile} trackerFlat={trackerFlat} />}
          {tab === "cv" && <CVReviewer profile={profile} />}
          {tab === "compare" && <ComparePanel items={compareList} onRemove={toggleCompare} onClear={() => setCompareList([])} profile={profile} />}
          {tab === "tracker" && <Tracker tracker={tracker} onMove={moveTracker} onRemove={removeTracker} />}
          {tab === "saved" && <SavedPanel saved={saved} onRemove={toggleSave} onOpen={setModal} profile={profile} onCompare={toggleCompare} compareList={compareList} onTrack={toggleTrack} trackerFlat={trackerFlat} />}
        </div>
      </div>

      {/* FOOTER */}
<footer style={{background:"#0d0820",borderTop:"1px solid #1e1c45",padding:"32px 28px",marginTop:40}}>
  <div style={{maxWidth:1280,margin:"0 auto",display:"flex",flexDirection:"column",alignItems:"center",gap:20}}>
    <div style={{display:"flex",alignItems:"center",gap:10}}>
      <svg width="36" height="36" viewBox="0 0 100 100">
        <defs>
          <linearGradient id="fg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7c3aed"/>
            <stop offset="100%" stopColor="#4f46e5"/>
          </linearGradient>
        </defs>
        <rect x="5" y="5" width="90" height="90" rx="12" fill="url(#fg)" stroke="#f5c842" strokeWidth="2"/>
        <polygon points="50,18 30,28 50,36 70,28" fill="#f5c842"/>
        <rect x="38" y="24" width="24" height="13" rx="2" fill="#4f46e5" stroke="#f5c842" strokeWidth="1"/>
        <circle cx="50" cy="62" r="18" fill="none" stroke="#f5c842" strokeWidth="2"/>
        <circle cx="50" cy="62" r="10" fill="none" stroke="#f5c842" strokeWidth="1.5" opacity="0.7"/>
        <circle cx="50" cy="62" r="3.5" fill="#f5c842"/>
        <line x1="50" y1="44" x2="50" y2="49" stroke="#f5c842" strokeWidth="2" strokeLinecap="round"/>
        <line x1="50" y1="75" x2="50" y2="80" stroke="#f5c842" strokeWidth="2" strokeLinecap="round"/>
        <line x1="32" y1="62" x2="37" y2="62" stroke="#f5c842" strokeWidth="2" strokeLinecap="round"/>
        <line x1="63" y1="62" x2="68" y2="62" stroke="#f5c842" strokeWidth="2" strokeLinecap="round"/>
        <rect x="72" y="56" width="6" height="12" rx="2" fill="#f5c842"/>
      </svg>
      <div>
        <span style={{fontFamily:"Georgia,serif",fontSize:"1.2rem",fontWeight:700,background:"linear-gradient(135deg,#f5c842,#ffd700)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Scholar</span>
        <span style={{fontFamily:"Georgia,serif",fontSize:"1.2rem",fontWeight:700,color:"#fff"}}>Vault</span>
      </div>
    </div>
    <p style={{fontSize:".72rem",color:"#3d3870",letterSpacing:3,textTransform:"uppercase"}}>Your Gateway to Global Education</p>
    <div style={{display:"flex",alignItems:"center",gap:10,width:"100%",maxWidth:400}}>
      <div style={{flex:1,height:1,background:"linear-gradient(90deg,transparent,#f5c84244)"}}/>
      <div style={{width:6,height:6,background:"#f5c842",transform:"rotate(45deg)"}}/>
      <div style={{flex:1,height:1,background:"linear-gradient(90deg,#f5c84244,transparent)"}}/>
    </div>
    <div style={{display:"flex",gap:24,flexWrap:"wrap",justifyContent:"center"}}>
      {["Dashboard","All Scholarships","Hidden Gems","CV Reviewer","ScholarBot"].map(l=>(
        <span key={l} style={{fontSize:".78rem",color:"#5a5488",cursor:"pointer",transition:"color .2s"}}
          onMouseEnter={e=>e.target.style.color="#f5c842"}
          onMouseLeave={e=>e.target.style.color="#5a5488"}>
          {l}
        </span>
      ))}
    </div>
    <p style={{fontSize:".72rem",color:"#3d3870",marginTop:4}}>
      Sugarboi <span style={{color:"#f5c842"}}>©</span> 2026 · ScholarVault · All Rights Reserved
    </p>
  </div>
</footer>
    </>
  );
}
