function V(id) { return document.getElementById(id).value.trim(); }
function today() { return new Date().toISOString().split('T')[0]; }
function fmtDate(d) {
    if (!d) return '';
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}

function spin(show) { document.getElementById('spinner').classList.toggle('show', show); }

function toast(msg) {
    const n = document.createElement('div');
    n.className = 'toast'; n.textContent = msg;
    document.body.appendChild(n);
    setTimeout(() => { n.style.opacity = '0'; n.style.transform = 'translateX(30px)'; n.style.transition = 'all .4s'; setTimeout(() => n.remove(), 400); }, 3000);
}
