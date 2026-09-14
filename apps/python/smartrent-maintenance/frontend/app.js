/**
 * SmartRent — AI Maintenance Coordinator
 * Dashboard v2 — Particle system, animated pipeline, auto-demo, premium rendering
 */

const API = '';
let selectedId = null;
let poll = null;

// ═══════════════════════════════════════════════════════════════════════════
// PARTICLE SYSTEM — Neural Network Background
// ═══════════════════════════════════════════════════════════════════════════

class ParticleSystem {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.particles = [];
        this.mouse = { x: -1000, y: -1000 };
        this.resize();
        this.init();
        window.addEventListener('resize', () => this.resize());
        document.addEventListener('mousemove', e => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; });
        this.animate();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    init() {
        const count = Math.floor((window.innerWidth * window.innerHeight) / 18000);
        this.particles = [];
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                vx: (Math.random() - 0.5) * 0.3,
                vy: (Math.random() - 0.5) * 0.3,
                r: Math.random() * 1.5 + 0.5,
                o: Math.random() * 0.4 + 0.1,
            });
        }
    }

    animate() {
        const { ctx, canvas, particles, mouse } = this;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            p.x += p.vx; p.y += p.vy;
            if (p.x < 0) p.x = canvas.width;
            if (p.x > canvas.width) p.x = 0;
            if (p.y < 0) p.y = canvas.height;
            if (p.y > canvas.height) p.y = 0;

            // Draw particle
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(99, 102, 241, ${p.o})`;
            ctx.fill();

            // Draw connections
            for (let j = i + 1; j < particles.length; j++) {
                const p2 = particles[j];
                const dx = p.x - p2.x, dy = p.y - p2.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 120) {
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(p2.x, p2.y);
                    const alpha = (1 - dist / 120) * 0.08;
                    ctx.strokeStyle = `rgba(99, 102, 241, ${alpha})`;
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            }

            // Mouse interaction
            const mdx = p.x - mouse.x, mdy = p.y - mouse.y;
            const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
            if (mdist < 150) {
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(mouse.x, mouse.y);
                const alpha = (1 - mdist / 150) * 0.15;
                ctx.strokeStyle = `rgba(99, 102, 241, ${alpha})`;
                ctx.lineWidth = 0.8;
                ctx.stroke();
            }
        }

        requestAnimationFrame(() => this.animate());
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// SOUND WAVE ANIMATION
// ═══════════════════════════════════════════════════════════════════════════

function createWaveBars(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '';
    for (let i = 0; i < 5; i++) {
        const bar = document.createElement('div');
        bar.style.cssText = `
            width: 2px; border-radius: 1px;
            background: currentColor; opacity: 0.6;
            animation: wave-bar 0.8s ease-in-out infinite;
            animation-delay: ${i * 0.1}s;
        `;
        el.appendChild(bar);
    }

    if (!document.getElementById('wave-style')) {
        const style = document.createElement('style');
        style.id = 'wave-style';
        style.textContent = `
            @keyframes wave-bar {
                0%, 100% { height: 4px; }
                50% { height: 12px; }
            }
        `;
        document.head.appendChild(style);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// WORKFLOW PIPELINE
// ═══════════════════════════════════════════════════════════════════════════

function updatePipeline(state) {
    const steps = [
        document.getElementById('pipeStep1'),
        document.getElementById('pipeStep2'),
        document.getElementById('pipeStep3'),
    ];
    const conns = [
        document.getElementById('pipeConn1'),
        document.getElementById('pipeConn2'),
    ];
    const status = document.getElementById('pipelineStatus');

    // Reset
    steps.forEach(s => { s.classList.remove('active', 'done'); });
    conns.forEach(c => { c.classList.remove('active'); });
    status.className = 'pipeline-status';

    const stateMap = {
        created:           { active: 0, done: [] },
        tenant_calling:    { active: 0, done: [], conns: [] },
        tenant_called:     { active: -1, done: [0], conns: [0] },
        vendor_searching:  { active: 1, done: [0], conns: [0] },
        vendor_found:      { active: -1, done: [0, 1], conns: [0, 1] },
        tenant_confirming: { active: 2, done: [0, 1], conns: [0, 1] },
        tenant_confirmed:  { active: -1, done: [0, 1, 2], conns: [0, 1] },
        completed:         { active: -1, done: [0, 1, 2], conns: [0, 1] },
        failed:            { active: -1, done: [], conns: [] },
    };

    const config = stateMap[state] || stateMap.created;

    (config.done || []).forEach(i => steps[i].classList.add('done'));
    if (config.active >= 0) {
        steps[config.active].classList.add('active');
        status.className = 'pipeline-status running';
        status.innerHTML = `<span class="pipeline-status-dot"></span>AI workflow in progress...`;
    }
    (config.conns || []).forEach(i => conns[i].classList.add('active'));

    if (state === 'completed') {
        status.className = 'pipeline-status done';
        status.innerHTML = `<span class="pipeline-status-dot"></span>Workflow complete — Vendor confirmed & dispatched`;
    } else if (state === 'failed') {
        status.innerHTML = `<span class="pipeline-status-dot"></span>Workflow failed — Check request details`;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// ANIMATED COUNTER
// ═══════════════════════════════════════════════════════════════════════════

function animateCounter(id, target) {
    const el = document.getElementById(id);
    const current = parseInt(el.textContent) || 0;
    if (current === target) return;

    const duration = 600;
    const start = performance.now();

    function step(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
        const value = Math.round(current + (target - current) * eased);
        el.textContent = value;
        if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

// ═══════════════════════════════════════════════════════════════════════════
// CONFIDENCE RING SVG
// ═══════════════════════════════════════════════════════════════════════════

function confidenceRingHTML(score, label) {
    const pct = Math.round(score * 100);
    const circumference = 2 * Math.PI * 17;
    const offset = circumference - (score * circumference);
    const color = score >= 0.9 ? 'var(--green)' : score >= 0.7 ? 'var(--yellow)' : 'var(--red)';

    return `
        <div class="confidence-ring-wrap">
            <div class="confidence-ring">
                <svg viewBox="0 0 40 40">
                    <circle class="confidence-ring-bg" cx="20" cy="20" r="17"/>
                    <circle class="confidence-ring-fill" cx="20" cy="20" r="17"
                        stroke="${color}"
                        stroke-dasharray="${circumference}"
                        stroke-dashoffset="${offset}"/>
                </svg>
            </div>
            <div class="confidence-info">
                <div class="confidence-score" style="color:${color}">${pct}%</div>
                <div class="confidence-label-text">${label || 'confidence'}</div>
            </div>
        </div>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {
    new ParticleSystem(document.getElementById('particleCanvas'));
    createWaveBars('wave1');
    createWaveBars('wave2');
    createWaveBars('wave3');
    await loadConfig();
    await refresh();
    startPolling();
});

async function loadConfig() {
    try {
        const res = await fetch(`${API}/api/config`);
        const cfg = await res.json();
        const badge = document.getElementById('modeBadge');
        if (!cfg.dry_run) {
            badge.className = 'mode-badge live';
            badge.querySelector('.mode-text').textContent = 'LIVE';
        }
    } catch {}
}

// ═══════════════════════════════════════════════════════════════════════════
// POLLING & DATA
// ═══════════════════════════════════════════════════════════════════════════

function startPolling() {
    if (poll) clearInterval(poll);
    poll = setInterval(refresh, 1500);
}

async function refresh() {
    try {
        const res = await fetch(`${API}/api/dashboard`);
        const data = await res.json();
        renderStats(data);
        renderList(data.requests);
        if (selectedId) await refreshDetail(selectedId);

        // Update pipeline for most recent active request
        if (data.requests.length > 0) {
            const active = data.requests.find(r => !['completed', 'failed', 'created'].includes(r.state));
            const latest = active || data.requests[0];
            updatePipeline(latest.state);
        }
    } catch {}
}

function renderStats(data) {
    animateCounter('statTotal', data.total_requests);
    animateCounter('statActive', data.active_requests);
    animateCounter('statCompleted', data.completed_requests);
    animateCounter('statCalls', data.total_calls);
}

// ═══════════════════════════════════════════════════════════════════════════
// REQUEST LIST
// ═══════════════════════════════════════════════════════════════════════════

function renderList(requests) {
    const list = document.getElementById('requestsList');

    if (!requests || requests.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon-wrap">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                </div>
                <p class="empty-title">No requests yet</p>
                <p class="empty-hint">Click <strong>"Run Demo"</strong> to see the AI workflow</p>
            </div>`;
        return;
    }

    list.innerHTML = requests.map(req => {
        const progress = getProgress(req.state);
        const progressClass = req.state === 'completed' ? 'done' : req.state === 'failed' ? 'failed' : '';
        const stateBadge = getStateBadge(req.state);

        return `
        <div class="request-card ${req.id === selectedId ? 'active' : ''}" onclick="selectRequest('${req.id}')">
            <div class="request-card-header">
                <span class="request-id">${req.id}</span>
                ${stateBadge}
            </div>
            <div class="request-card-body">
                <span class="request-tenant">${req.tenant_name}</span>
                <span class="request-unit">Unit ${req.unit_number}</span>
            </div>
            <div class="request-progress">
                <div class="request-progress-fill ${progressClass}" style="width:${progress}%"></div>
            </div>
            <div class="request-card-tags">
                ${req.issue_type ? `<span class="badge badge-accent">${req.issue_type}</span>` : ''}
                ${req.urgency ? `<span class="badge ${req.urgency === 'emergency' ? 'badge-red' : req.urgency === 'urgent' ? 'badge-orange' : 'badge-green'}">${req.urgency}</span>` : ''}
                ${req.assigned_vendor ? `<span class="badge badge-purple">${typeof req.assigned_vendor === 'object' ? (req.assigned_vendor.name || 'Vendor') : req.assigned_vendor}</span>` : ''}
            </div>
        </div>`;
    }).join('');
}

function getProgress(state) {
    const map = { created: 5, tenant_calling: 20, tenant_called: 33, vendor_searching: 50, vendor_found: 66, tenant_confirming: 80, tenant_confirmed: 90, completed: 100, failed: 100 };
    return map[state] || 0;
}

function getStateBadge(state) {
    const map = {
        created:           '<span class="badge badge-blue">Created</span>',
        tenant_calling:    '<span class="badge badge-cyan">Calling...</span>',
        tenant_called:     '<span class="badge badge-accent">Tenant Called</span>',
        vendor_searching:  '<span class="badge badge-orange">Finding Vendor</span>',
        vendor_found:      '<span class="badge badge-yellow">Vendor Found</span>',
        tenant_confirming: '<span class="badge badge-cyan">Confirming...</span>',
        tenant_confirmed:  '<span class="badge badge-green">Confirmed</span>',
        completed:         '<span class="badge badge-green">Completed</span>',
        failed:            '<span class="badge badge-red">Failed</span>',
    };
    return map[state] || `<span class="badge badge-blue">${state}</span>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// DETAIL PANEL
// ═══════════════════════════════════════════════════════════════════════════

async function selectRequest(id) {
    selectedId = id;
    const reqs = await fetchJSON(`${API}/api/requests`);
    renderList(reqs);
    await refreshDetail(id);
}

async function refreshDetail(id) {
    const req = await fetchJSON(`${API}/api/requests/${id}`);
    if (!req) return;
    updatePipeline(req.state);
    renderDetail(req);
}

function renderDetail(req) {
    const panel = document.getElementById('detailPanel');

    panel.innerHTML = `
        <div class="detail-header">
            <div>
                <div class="detail-title">${req.id}</div>
                <div class="detail-subtitle">${req.tenant_name} · ${req.tenant_phone} · Unit ${req.unit_number}</div>
            </div>
            ${getStateBadge(req.state)}
        </div>

        <!-- Issue Details -->
        ${req.issue_type ? `
        <div class="detail-section" style="animation-delay:0.05s">
            <div class="section-header">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                Issue Details
            </div>
            <div class="info-grid">
                <div><div class="info-item-label">Type</div><div class="info-item-value"><span class="badge badge-accent">${req.issue_type}</span></div></div>
                <div><div class="info-item-label">Urgency</div><div class="info-item-value"><span class="badge ${req.urgency === 'emergency' ? 'badge-red' : req.urgency === 'urgent' ? 'badge-orange' : 'badge-green'}">${req.urgency || '—'}</span></div></div>
                <div><div class="info-item-label">Location</div><div class="info-item-value">${req.location_in_unit || '—'}</div></div>
                <div><div class="info-item-label">Access</div><div class="info-item-value">${req.access_instructions || '—'}</div></div>
            </div>
            ${req.additional_details ? `<p style="margin-top:12px;font-size:12px;color:var(--text-2);line-height:1.6;padding:10px 14px;background:var(--bg-glass-light);border-radius:var(--r-sm);border-left:3px solid var(--accent)">${req.additional_details}</p>` : ''}
        </div>` : ''}

        <!-- Vendor Assignment -->
        ${req.assigned_vendor ? `
        <div class="detail-section" style="animation-delay:0.1s">
            <div class="section-header">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                Assigned Vendor
            </div>
            ${(() => {
                const vName = (typeof req.assigned_vendor === 'object' && req.assigned_vendor?.name) ? req.assigned_vendor.name : (typeof req.assigned_vendor === 'string' ? req.assigned_vendor : 'Vendor');
                const vSpecs = (typeof req.assigned_vendor === 'object' && Array.isArray(req.assigned_vendor?.specialties)) ? req.assigned_vendor.specialties : [];
                return `
            <div class="vendor-card">
                <div class="vendor-avatar">${vName.charAt(0)}</div>
                <div class="vendor-info">
                    <div class="vendor-name">${vName}</div>
                    <div class="vendor-detail">ETA: ${req.vendor_eta || 'TBD'} · Est. Cost: ${req.vendor_cost_estimate || 'TBD'}</div>
                    <div class="vendor-specs">
                        ${vSpecs.map(s => `<span class="badge badge-purple">${s}</span>`).join('')}
                    </div>
                </div>
                <span class="badge ${req.tenant_confirmed ? 'badge-green' : 'badge-yellow'}">${req.tenant_confirmed ? 'Confirmed' : 'Pending'}</span>
            </div>`;
            })()}
        </div>` : ''}

        <!-- AI Call History -->
        ${req.calls && req.calls.length > 0 ? `
        <div class="detail-section" style="animation-delay:0.15s">
            <div class="section-header">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72"/></svg>
                AI Call History · ${req.calls.length} calls
            </div>
            ${req.calls.map((call, i) => renderCallCard(call, i)).join('')}
        </div>` : ''}

        <!-- Timeline -->
        ${req.timeline && req.timeline.length > 0 ? `
        <div class="detail-section" style="animation-delay:0.2s">
            <div class="section-header">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Event Timeline
            </div>
            <div class="timeline">
                ${req.timeline.map((evt, i) => {
                    const isLast = i === req.timeline.length - 1;
                    const cls = evt.event.includes('completed') || evt.event.includes('confirmed') ? 'done'
                              : evt.event.includes('failed') || evt.event.includes('error') ? 'fail'
                              : isLast ? 'active' : '';
                    return `
                    <div class="tl-event ${cls}">
                        <div class="tl-time">${fmtTime(evt.timestamp)}</div>
                        <div class="tl-text">${fmtEvent(evt.event)}</div>
                        ${evt.details ? `<div class="tl-detail">${evt.details}</div>` : ''}
                    </div>`;
                }).join('')}
            </div>
        </div>` : ''}
    `;
}

function renderCallCard(call, index) {
    const typeMap = {
        tenant_intake: { label: 'Tenant Intake', cls: 'intake', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3"/></svg>' },
        vendor_dispatch: { label: 'Vendor Dispatch', cls: 'dispatch', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>' },
        tenant_confirm: { label: 'Tenant Confirm', cls: 'confirm', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>' },
    };
    const t = typeMap[call.call_type] || { label: call.call_type, cls: '', icon: '' };
    const hasTranscript = call.transcript && call.transcript.length > 0;
    const hasEvidence = call.evidence && call.evidence.length > 0;

    return `
    <div class="call-card" id="call-${index}">
        <div class="call-card-header" onclick="toggleCall(${index})">
            <div class="call-type-badge ${t.cls}">${t.icon} ${t.label}</div>
            <span class="badge ${call.status === 'completed' ? 'badge-green' : 'badge-red'}">${call.status}</span>
        </div>
        <div class="call-expand" id="callx-${index}">
            ${call.confidence_score ? confidenceRingHTML(call.confidence_score, call.confidence_label) : ''}

            ${hasEvidence ? `
            <div style="margin-top:14px">
                <div class="section-header" style="margin-bottom:8px">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    Evidence
                </div>
                ${call.evidence.map(e => `<div class="evidence-card"><span class="evidence-icon">✓</span><span class="evidence-text">${e}</span></div>`).join('')}
            </div>` : ''}

            ${hasTranscript ? `
            <div style="margin-top:14px">
                <div class="section-header" style="margin-bottom:8px">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    Transcript
                </div>
                <div class="chat">
                    ${call.transcript.map(turn => `
                    <div class="chat-bubble ${turn.speaker === 'bot' ? 'ai' : 'user'}">
                        <div class="chat-speaker">${turn.speaker === 'bot' ? 'AI Agent' : 'Caller'}</div>
                        ${turn.text}
                    </div>`).join('')}
                </div>
            </div>` : ''}

            ${call.structured_result ? `
            <div style="margin-top:14px">
                <div class="section-header" style="margin-bottom:8px">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
                    Structured Result
                </div>
                <pre class="call-result-json">${JSON.stringify(call.structured_result, null, 2)}</pre>
            </div>` : ''}
        </div>
    </div>`;
}

function toggleCall(i) {
    document.getElementById(`call-${i}`).classList.toggle('expanded');
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTO-DEMO
// ═══════════════════════════════════════════════════════════════════════════

async function runAutoDemo() {
    const btn = document.getElementById('btnDemo');
    btn.disabled = true;
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Running...`;

    showToast('🚀 Starting AI demo workflow...');

    try {
        const res = await fetch(`${API}/api/requests`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tenant_name: 'Sarah Chen',
                tenant_phone: '+15551234567',
                unit_number: '4B',
                property_name: 'SmartRent Demo Property',
                initial_description: 'Kitchen sink is leaking under the cabinet, water pooling on floor',
            }),
        });
        const req = await res.json();
        selectedId = req.id;
        await refresh();
        showToast(`✅ Demo started — Watch the pipeline animate!`);
    } catch (e) {
        showToast(`❌ Demo failed: ${e.message}`);
    } finally {
        setTimeout(() => {
            btn.disabled = false;
            btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg> Run Demo`;
        }, 5000);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// MODAL
// ═══════════════════════════════════════════════════════════════════════════

function showNewRequestModal() {
    document.getElementById('modalOverlay').classList.add('visible');
    setTimeout(() => document.getElementById('tenantName').focus(), 100);
}

function hideNewRequestModal() {
    document.getElementById('modalOverlay').classList.remove('visible');
    document.getElementById('newRequestForm').reset();
}

async function submitNewRequest(event) {
    event.preventDefault();
    const btn = document.getElementById('btnSubmit');
    btn.disabled = true;

    const payload = {
        tenant_name: document.getElementById('tenantName').value,
        tenant_phone: document.getElementById('tenantPhone').value,
        unit_number: document.getElementById('unitNumber').value,
        property_name: document.getElementById('propertyName').value || 'SmartRent Demo Property',
        initial_description: document.getElementById('initialDescription').value,
    };

    try {
        const res = await fetch(`${API}/api/requests`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Failed');
        const req = await res.json();
        hideNewRequestModal();
        showToast(`✅ ${req.id} created — AI workflow started!`);
        selectedId = req.id;
        await refresh();
    } catch (e) {
        showToast(`❌ Error: ${e.message}`);
    } finally {
        btn.disabled = false;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════════════════════════

async function fetchJSON(url) {
    try { const r = await fetch(url); return r.ok ? await r.json() : null; } catch { return null; }
}

function fmtTime(ts) {
    try { return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
    catch { return ts; }
}

function fmtEvent(e) { return e.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }

function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('visible');
    setTimeout(() => t.classList.remove('visible'), 3500);
}
