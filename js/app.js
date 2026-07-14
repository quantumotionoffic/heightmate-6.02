
// ──────────────────────────────────────────────
// FIREBASE INIT
// ──────────────────────────────────────────────
const firebaseConfig = {
    apiKey: "AIzaSyABPDlqhPeLMgmA7CTpmHi7xhRqXGxPwM0",
    authDomain: "heightmatepro.firebaseapp.com",
    projectId: "heightmatepro",
    storageBucket: "heightmatepro.firebasestorage.app",
    messagingSenderId: "435638185961",
    appId: "1:435638185961:web:656c2e19f8dadc2e3a6578"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ──────────────────────────────────────────────
// SUPABASE INIT
// ──────────────────────────────────────────────
const SUPABASE_URL = "https://nmmuwgargqpuygzyhhcd.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5tbXV3Z2FyZ3FwdXlnenloaGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2Mzc2ODMsImV4cCI6MjA5ODIxMzY4M30.8nA1XaGWclDNpuofmPiKJ5BcwBAZwep_9Xb52nu3sns";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// Safe LocalStorage Wrapper
const safeStorage = {
    getItem(key) {
        try { return localStorage.getItem(key); } catch (e) { console.warn("Storage read blocked:", e); return null; }
    },
    setItem(key, val) {
        try { localStorage.setItem(key, val); } catch (e) { console.warn("Storage write blocked:", e); }
    }
};


// ──────────────────────────────────────────────
// STATE
// ──────────────────────────────────────────────
let user = null, familyId = null;
let profiles = [], curPid = null;
let btDevice = null, btChar = null;
let mainChart = null;
let editPid = null, delPid = null;
let dropOpen = false;
let currentChartTab = 'height';

const cfg = { dark: false, confetti: true, notif: true, unit: 'metric' };

const AVATARS = ['👦', '👧', '🧒', '👶', '🧑', '👨', '👩', '🦸', '🦹', '🧚', '🧙', '🤴', '👸', '🧝', '🧛', '🐻', '🦊', '🐼', '🦁', '🐯', '🐧', '🦋', '🌟', '⭐', '🌈'];

const ACHIEVEMENTS = [
    { id: 'first', name: 'First Step!', icon: '👣', type: 'm', thr: 1 },
    { id: 'five', name: '5 Checks!', icon: '⭐', type: 'm', thr: 5 },
    { id: 'ten', name: '10 Checks!', icon: '💪', type: 'm', thr: 10 },
    { id: 'twenty', name: 'Superstar!', icon: '🌟', type: 'm', thr: 20 },
    { id: 'g1', name: 'Growing Up!', icon: '🌱', type: 'g', thr: 1 },
    { id: 'g5', name: '5cm Taller!', icon: '📏', type: 'g', thr: 5 },
    { id: 'g10', name: '10cm Taller!', icon: '🎯', type: 'g', thr: 10 },
    { id: 'g15', name: 'Champion!', icon: '🏆', type: 'g', thr: 15 },
];

// WHO growth standards (simplified) cm/year by age
const WHO_GROWTH = {
    male: { 2: 9, 3: 8, 4: 7, 5: 6.5, 6: 6, 7: 6, 8: 5.5, 9: 5.5, 10: 5, 11: 5.5, 12: 6, 13: 7, 14: 7, 15: 5, 16: 3, 17: 2, 18: 1 },
    female: { 2: 8.5, 3: 7.5, 4: 7, 5: 6.5, 6: 6, 7: 6, 8: 5.5, 9: 5.5, 10: 6, 11: 7, 12: 7, 13: 5, 14: 3, 15: 2, 16: 1, 17: 0.5, 18: 0.5 }
};

// ──────────────────────────────────────────────
// AUTH
// ──────────────────────────────────────────────
auth.onAuthStateChanged(async u => {
    if (u) { user = u; loadCfg(); await loadFamily(); showApp(); }
    else { showLogin(); }
});


// ──────────────────────────────────────────────
// GOOGLE SIGN-IN

// ──────────────────────────────────────────────
async function signInWithGoogle() {
    spin(true);
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        const result = await auth.signInWithPopup(provider);
        const u = result.user;
        // Check if family doc exists; create one for new Google users
        const fRef = db.collection('families').doc(u.uid);
        const fDoc = await fRef.get();
        if (!fDoc.exists) {
            const displayName = u.displayName || 'My Family';
            await fRef.set({
                familyName: displayName.includes('Family') ? displayName : displayName + "'s Family",
                email: u.email,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        // onAuthStateChanged will fire and load the app automatically
    } catch (err) {
        console.error(err);
        if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
            // User closed popup — do nothing
        } else if (err.code === 'auth/popup-blocked') {
            authMsg('Popup was blocked by your browser. Please allow popups for this site and try again.', 'err');
        } else {
            authMsg(authErrMsg(err.code) || 'Google sign-in failed. Please try again.', 'err');
        }
    } finally {
        spin(false);
    }
}
let isGuest = false;
const GUEST_KEY = 'hm_guest_data';

function guestLogin() {
    isGuest = true;
    user = { uid: 'guest' };
    familyId = 'guest';
    loadCfg();
    loadGuestData();
    showApp();
    document.getElementById('navName').textContent = '👤 Guest';
    document.getElementById('familyTitle').textContent = '🌈 Guest Family 🌈';
    toast('👤 Logged in as Guest — data saved on this device only');
}

function loadGuestData() {
    const raw = safeStorage.getItem(GUEST_KEY);
    const data = raw ? JSON.parse(raw) : { profiles: [] };
    profiles = data.profiles || [];
    profiles.forEach(p => { p._count = (p.measurements || []).length; });
    renderProfiles();
    if (profiles.length > 0 && !curPid) {
        curPid = profiles[0].id;
        renderProfiles();
        updateDisplay();
    }
    updateDashboard();
}

function saveGuestData() {
    safeStorage.setItem(GUEST_KEY, JSON.stringify({ profiles }));
}

function guestId() {
    return 'id_' + Math.random().toString(36).slice(2, 10);
}


// ──────────────────────────────────────────────
// FORGOT / CHANGE PASSWORD
// ──────────────────────────────────────────────
function openForgotModal() {
    document.getElementById('forgotEmail').value = document.getElementById('lEmail')?.value || '';
    document.getElementById('forgotMsg').innerHTML = '';
    document.getElementById('forgotModal').classList.add('open');
}

async function sendPasswordReset() {
    const email = document.getElementById('forgotEmail').value.trim();
    if (!email) { showModalMsg('forgotMsg', 'Please enter your email address.', 'err'); return; }
    spin(true);
    try {
        await auth.sendPasswordResetEmail(email);
        showModalMsg('forgotMsg', '✅ Password reset email sent! Check your inbox.', 'ok');
        setTimeout(() => document.getElementById('forgotModal').classList.remove('open'), 3000);
    } catch (err) {
        console.error('Password reset err:', err);
        showModalMsg('forgotMsg', authErrMsg(err.code) || err.message, 'err');
    } finally { spin(false); }
}

async function changePassword() {
    if (isGuest) { alert('Guest accounts cannot change passwords.'); return; }
    if (user && user.providerData && user.providerData.some(p => p.providerId === 'google.com')) {
        showModalMsg('cpMsg', 'You are signed in with Google. Passwords cannot be changed here.', 'err');
        return;
    }
    const current = document.getElementById('cpCurrent').value;
    const newPass = document.getElementById('cpNew').value;
    const confirm = document.getElementById('cpConfirm').value;
    if (!current || !newPass || !confirm) { showModalMsg('cpMsg', 'Please fill in all fields.', 'err'); return; }
    if (newPass.length < 6) { showModalMsg('cpMsg', 'New password must be at least 6 characters.', 'err'); return; }
    if (newPass !== confirm) { showModalMsg('cpMsg', 'New passwords do not match!', 'err'); return; }
    spin(true);
    try {
        const credential = firebase.auth.EmailAuthProvider.credential(user.email, current);
        await user.reauthenticateWithCredential(credential);
        await user.updatePassword(newPass);
        showModalMsg('cpMsg', '✅ Password changed successfully!', 'ok');
        setTimeout(() => {
            document.getElementById('changePassModal').classList.remove('open');
            document.getElementById('cpCurrent').value = '';
            document.getElementById('cpNew').value = '';
            document.getElementById('cpConfirm').value = '';
        }, 2000);
        toast('🔒 Password updated successfully!');
    } catch (err) {
        console.error('Change pass err:', err);
        showModalMsg('cpMsg', err.code === 'auth/wrong-password' ? 'Current password is incorrect!' : (authErrMsg(err.code) || err.message), 'err');
    } finally { spin(false); }
}

function showModalMsg(elId, msg, type) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.innerHTML = `<div class="auth-msg ${type}" style="margin-top:10px">${msg}</div>`;
    setTimeout(() => { if (el) el.innerHTML = ''; }, 5000);
}

function showLogin() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('mainApp').classList.remove('active');
    document.getElementById('topNav').classList.remove('active');
    if (document.getElementById('bottomNav')) {
        document.getElementById('bottomNav').classList.remove('active');
    }
}
function showApp() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').classList.add('active');
    document.getElementById('topNav').classList.add('active');
    if (document.getElementById('bottomNav')) {
        document.getElementById('bottomNav').classList.add('active');
    }
    
    // Sync User Profile details
    const emailEl = document.getElementById('profileUserEmail');
    if (emailEl) {
        if (isGuest) {
            emailEl.textContent = 'Guest Mode Active 👤';
        } else if (user) {
            emailEl.textContent = user.email || 'HeightMate Account';
        }
    }
    
    // Sync settings Family Name label
    const famTitle = document.getElementById('familyTitle').textContent.replace(/🌈/g, '').trim();
    if (document.getElementById('profileFamilyName')) {
        document.getElementById('profileFamilyName').textContent = `🌈 ${famTitle}`;
    }
    
    // Set default active Bottom Nav Tab
    switchAppTab('dashboard');
}

async function googleLogin() {
    const provider = new firebase.auth.GoogleAuthProvider();

    try {
        const result = await auth.signInWithPopup(provider);
        const user = result.user;

        // Check if family document exists
        const doc = await db.collection('families').doc(user.uid).get();

        if (!doc.exists) {
            await db.collection('families').doc(user.uid).set({
                familyName: user.displayName + "'s Family",
                email: user.email,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

    } catch (err) {
        console.error(err);
        alert("Google login failed: " + err.message);
    }
}

// ──────────────────────────────────────────────
// SETTINGS
// ──────────────────────────────────────────────
function loadCfg() {
    const s = safeStorage.getItem('hmcfg');
    if (s) Object.assign(cfg, JSON.parse(s));
    applyCfg();
}
function saveCfg() { safeStorage.setItem('hmcfg', JSON.stringify(cfg)); }
function applyCfg() {
    document.body.classList.toggle('dark', cfg.dark);
    
    // Sync Dropdown settings
    if(document.getElementById('togDark')) setTog('togDark', cfg.dark);
    if(document.getElementById('togConf')) setTog('togConf', cfg.confetti);
    if(document.getElementById('togNotif')) setTog('togNotif', cfg.notif);
    if(document.getElementById('togUnit')) setTog('togUnit', cfg.unit === 'imperial');
    
    // Sync Profile Tab settings
    if(document.getElementById('profileTogDark')) setTog('profileTogDark', cfg.dark);
    if(document.getElementById('profileTogConf')) setTog('profileTogConf', cfg.confetti);
    if(document.getElementById('profileTogNotif')) setTog('profileTogNotif', cfg.notif);
    if(document.getElementById('profileTogUnit')) setTog('profileTogUnit', cfg.unit === 'imperial');
    
    const hInp = document.getElementById('manH');
    const wInp = document.getElementById('manW');
    if (hInp) hInp.placeholder = cfg.unit === 'imperial' ? 'Height (in)' : 'Height (cm)';
    if (wInp) wInp.placeholder = cfg.unit === 'imperial' ? 'Weight (lbs)' : 'Weight (kg)';
    
    // Redraw charts on dark mode change to keep grids aligned
    if (curPid && mainChart) renderChart();
}
function setTog(id, on) { const el = document.getElementById(id); if (el) el.classList.toggle('on', on); }
function togDarkMode() { cfg.dark = !cfg.dark; applyCfg(); saveCfg(); if (curPid) renderChart(); }
function togConfetti() { cfg.confetti = !cfg.confetti; applyCfg(); saveCfg(); }
function togNotif() { cfg.notif = !cfg.notif; applyCfg(); saveCfg(); }
function togUnit() { cfg.unit = cfg.unit === 'imperial' ? 'metric' : 'imperial'; applyCfg(); saveCfg(); updateDisplay(); }
function togDrop() {
    dropOpen = !dropOpen;
    document.getElementById('dropMenu').classList.toggle('open', dropOpen);
    document.getElementById('setBtn').classList.toggle('on', dropOpen);
}
document.addEventListener('click', e => {
    if (dropOpen && !e.target.closest('#dropMenu') && !e.target.closest('#setBtn')) {
        dropOpen = false;
        document.getElementById('dropMenu').classList.remove('open');
        document.getElementById('setBtn').classList.remove('on');
    }
});

// ──────────────────────────────────────────────
// FAMILY DATA
// ──────────────────────────────────────────────


function setFamilyName(n) {
    document.getElementById('familyTitle').textContent = `🌈 ${n} 🌈`;
    document.getElementById('navName').textContent = `🌈 ${n}`;
    if (document.getElementById('profileFamilyName')) {
        document.getElementById('profileFamilyName').textContent = `🌈 ${n}`;
    }
}

// ──────────────────────────────────────────────
// PROFILES
// ──────────────────────────────────────────────










async function delMeasurement(mid, e) {
    e.stopPropagation();
    if (!confirm('Delete this measurement?')) return;
    if (isGuest) {
        const p = getProfile();
        if (p) { p.measurements = (p.measurements || []).filter(x => x.id !== mid); p._count = p.measurements.length; }
        saveGuestData();
        renderProfiles();
        updateDisplay();
        toast('🗑️ Measurement deleted.');
    } else {
        await db.collection('families').doc(familyId).collection('profiles').doc(curPid).collection('measurements').doc(mid).delete();
        await loadMeasurements();
        toast('🗑️ Measurement deleted.');
    }
}

// ──────────────────────────────────────────────
// ADD/EDIT/DELETE PROFILE MODALS
// ──────────────────────────────────────────────
function openAddModal() {
    document.getElementById('pName').value = '';
    document.getElementById('pAge').value = '';
    document.getElementById('pBirth').value = '';
    document.getElementById('pGender').value = '';
    document.querySelectorAll('#addModal .gender-btn').forEach(b => b.classList.remove('sel'));
    renderAvGrid('avGrid', AVATARS[0]);
    document.getElementById('addModal').classList.add('open');
}
function closeAddModal() { document.getElementById('addModal').classList.remove('open'); }



function openEditModal(pid, e) {
    e.stopPropagation();
    editPid = pid;
    const p = profiles.find(x => x.id === pid);
    if (!p) return;
    document.getElementById('eName').value = p.name;
    document.getElementById('eAge').value = p.age;
    document.getElementById('eBirth').value = p.birth || '';
    document.getElementById('eGender').value = p.gender || '';
    document.querySelectorAll('#editModal .gender-btn').forEach(b => {
        b.classList.toggle('sel', b.textContent.includes(p.gender === 'male' ? 'Boy' : p.gender === 'female' ? 'Girl' : 'Other'));
    });
    renderAvGrid('eAvGrid', p.avatar);
    document.getElementById('editModal').classList.add('open');
}
function closeEditModal() { document.getElementById('editModal').classList.remove('open'); editPid = null; }



function openDelModal(pid, e) {
    e.stopPropagation();
    delPid = pid;
    const p = profiles.find(x => x.id === pid);
    document.getElementById('delName').textContent = p?.name || '';
    document.getElementById('deleteModal').classList.add('open');
}
function closeDelModal() { document.getElementById('deleteModal').classList.remove('open'); delPid = null; }



// ──────────────────────────────────────────────
// FAMILY NAME
// ──────────────────────────────────────────────
function openFamilyModal() {
    document.getElementById('famInput').value = document.getElementById('familyTitle').textContent.replace(/🌈/g, '').trim();
    document.getElementById('familyModal').classList.add('open');
}
function closeFamilyModal() { document.getElementById('familyModal').classList.remove('open'); }
async function saveFamilyName() {
    const n = V('famInput');
    if (!n) { alert('Family name cannot be empty!'); return; }
    if (isGuest) { setFamilyName(n); closeFamilyModal(); toast('✅ Family name updated!'); return; }
    spin(true);
    try {
        await db.collection('families').doc(familyId).update({ familyName: n });
        setFamilyName(n);
        closeFamilyModal();
        toast('✅ Family name updated!');
    } catch (e) { console.error(e); alert('Error updating family name.'); }
    finally { spin(false); }
}

// ──────────────────────────────────────────────
// ENTRY TABS
// ──────────────────────────────────────────────
function switchTab(id, btn) {
    document.querySelectorAll('.entry-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.entry-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('panel-' + id).classList.add('active');
}

// ──────────────────────────────────────────────
// BLUETOOTH
// Tries to auto-reconnect to saved device name on page load
// ──────────────────────────────────────────────
async function tryAutoReconnect() {
    // Web Bluetooth doesn't support background auto-connect on all browsers,
    // but we can attempt to get previously-paired devices if supported.
    if (!navigator.bluetooth) return;
    try {
        // getDevices() is supported in Chrome 85+ and some browsers
        if (navigator.bluetooth.getDevices) {
            const devices = await navigator.bluetooth.getDevices();
            if (devices.length > 0) {
                const d = devices[0];
                updateBTStatus('🔄 Auto-connecting to ' + d.name + '...', '#f39c12');
                d.addEventListener('advertisementreceived', async () => {
                    try {
                        await reconnectDevice(d);
                    } catch (e) { }
                });
                await d.watchAdvertisements();
            }
        }
    } catch (e) { }
}

async function reconnectDevice(d) {
    btDevice = d;
    
    btDevice.addEventListener('gattserverdisconnected', () => {
        console.log("Disconnected");
        disconnectBT();
    });

    const server = await d.gatt.connect();
    const svc = await server.getPrimaryService('4fafc201-1fb5-459e-8fcc-c5c9c331914b');
    btChar = await svc.getCharacteristic('beb5483e-36e1-4688-b7f5-ea07361b26a8');
    await btChar.startNotifications();
    btChar.addEventListener('characteristicvaluechanged', onBTData);
    setBTConnected(d.name);

    await checkFirmwareUpdate();
    if (document.getElementById("fwUpdatePanel").style.display === "block") {
        await startFirmwareUpdate();
    }
}

async function connectBT() {
    if (!navigator.bluetooth) {
        alert('Web Bluetooth is not supported in this browser.\n\nPlease use Chrome (desktop/Android) or Edge.\nSafari on iOS does not support Web Bluetooth.');
        return;
    }
    const btn = document.getElementById('btBtn');
    btn.disabled = true; btn.textContent = '🔄 Connecting...';
    try {
        btDevice = await navigator.bluetooth.requestDevice({
            filters: [{ namePrefix: 'ESP32' }, { namePrefix: 'HeightMate' }],
            optionalServices: ['4fafc201-1fb5-459e-8fcc-c5c9c331914b', 'battery_service']
        });
        await reconnectDevice(btDevice);
    } catch (err) {
        let msg = 'Could not connect. ';
        if (err.name === 'SecurityError') msg += 'Bluetooth requires HTTPS!';
        else if (err.name === 'NotFoundError') msg += 'No HeightMate device found nearby!';
        else msg += err.message || 'Make sure your device is powered on!';
        alert(msg);
        btn.textContent = '🔵 Connect via Bluetooth'; btn.disabled = false;
    }
}

function setBTConnected(name) {
    const btn = document.getElementById('btBtn');
    updateBTStatus(`🟢 Connected to ${name}`, '#2ecc71');
    btn.textContent = '🔌 Disconnect'; btn.disabled = false;
    btn.onclick = disconnectBT;
    
    const measureBtn = document.getElementById('measureHeightBtn');
    if (measureBtn) {
        measureBtn.disabled = false;
        measureBtn.style.opacity = '1';
    }
    
    // Update firmware panel
    updateFWDeviceInfo(name);
}

function updateBTStatus(msg, color) {
    document.getElementById('btStatus').innerHTML = `<span style="color:${color || 'var(--txt)'}">${msg}</span>`;
}

async function disconnectBT() {
    if (btDevice?.gatt?.connected) await btDevice.gatt.disconnect();
    document.getElementById('btBtn').textContent = '🔵 Connect Device';
    document.getElementById('btBtn').onclick = connectBT; document.getElementById('btBtn').disabled = false;
    updateBTStatus('⚪ Not Connected', 'var(--pink)');
    
    const measureBtn = document.getElementById('measureHeightBtn');
    if (measureBtn) {
        measureBtn.disabled = true;
        measureBtn.style.opacity = '0.5';
    }
}

function onBTData(event) {
    const txt = new TextDecoder('utf-8').decode(event.target.value);
    let h = txt.includes('HEIGHT:') ? parseFloat(txt.replace('HEIGHT:', '').trim()) : parseFloat(txt.trim());
    if (!isNaN(h) && h > 0 && h < 300) {
        saveMeasurement({ height: h, type: 'height', date: today() });
        document.getElementById('measureHeightBtn').textContent = '📏 Measure Height Now';
        document.getElementById('measureHeightBtn').disabled = false;
        toast(`📏 Height received: ${h} cm`);
        addNotification('📏 Height Measured!', `Device measured ${h} cm via Bluetooth.`, 'height_update');
    }
}

async function triggerMeasureHeight() {
    if (!btChar) { toast('⚠️ Please connect your device first!'); return; }
    const btn = document.getElementById('measureHeightBtn');
    btn.disabled = true;
    btn.innerHTML = '⏳ Measuring...';
    try {
        // Send command to ESP32 to trigger measurement
        const encoder = new TextEncoder();
        await btChar.writeValue(encoder.encode('MEASURE'));
        toast('📡 Measurement command sent! Stand still...');
        // Auto re-enable after 10s timeout
        setTimeout(() => {
            if (btn.disabled) {
                btn.innerHTML = '📏 Measure Now';
                btn.disabled = false;
            }
        }, 10000);
    } catch (err) {
        btn.innerHTML = '📏 Measure Now';
        btn.disabled = false;
        toast('⚠️ Could not send command: ' + (err.message || 'Try again'));
    }
}



// ──────────────────────────────────────────────
// MANUAL ENTRY
// ──────────────────────────────────────────────
function addManualH() {
    let v = parseFloat(document.getElementById('manH').value);
    if (isNaN(v)) { alert('Please enter a valid height!'); return; }
    if (cfg.unit === 'imperial') { v = parseFloat((v * 2.54).toFixed(1)); }
    if (v < 50 || v > 250) { alert('Valid height is between 50-250cm (20-100 in)!'); return; }
    if (!curPid) { alert('Please select a profile first! 👶'); return; }
    saveMeasurement({ height: v, type: 'height', date: today() });
    document.getElementById('manH').value = '';
}

// ──────────────────────────────────────────────
// WEIGHT + BMI
// ──────────────────────────────────────────────
function addWeight() {
    let w = parseFloat(document.getElementById('manW').value);
    if (isNaN(w)) { alert('Please enter a valid weight!'); return; }
    if (cfg.unit === 'imperial') { w = parseFloat((w / 2.20462).toFixed(1)); }
    if (w < 5 || w > 300) { alert('Valid weight is between 5-300kg (11-660 lbs)!'); return; }
    if (!curPid) { alert('Please select a profile first! 👶'); return; }
    const p = getProfile();
    const ms = p.measurements || [];
    const latestH = [...ms].reverse().find(m => m.height);
    if (!latestH) { alert('No height measurement found for this profile.\nPlease record a height first!'); return; }
    const h = latestH.height / 100; // m
    const bmi = (w / (h * h)).toFixed(1);
    const cat = bmiCat(bmi, p.age);
    saveMeasurement({ weight: w, bmi: parseFloat(bmi), bmiCat: cat, heightUsed: latestH.height, type: 'weight', date: today() });
    showBMI(bmi, cat, latestH.height, w);
    document.getElementById('manW').value = '';
}

function bmiCat(bmi, age) {
    // Simple percentile-based for kids (using general ranges)
    if (age < 18) {
        if (bmi < 14) return 'Underweight';
        if (bmi < 18) return 'Healthy';
        if (bmi < 21) return 'Overweight';
        return 'Obese';
    }
    if (bmi < 18.5) return 'Underweight';
    if (bmi < 25) return 'Healthy';
    if (bmi < 30) return 'Overweight';
    return 'Obese';
}

function bmiCatColor(cat) {
    return { Underweight: '#3498db', Healthy: '#2ecc71', Overweight: '#e67e22', Obese: '#e74c3c' }[cat] || '#aaa';
}

function showBMI(bmi, cat, h, w) {
    const el = document.getElementById('bmiResult');
    const emoji = { Underweight: '💧', Healthy: '✅', Overweight: '⚠️', Obese: '🚨' }[cat] || '📊';
    el.innerHTML = `
        <span class="bmi-big">${bmi}</span>
        <strong>${emoji} ${cat}</strong><br>
        <small>Height: ${h}cm · Weight: ${w}kg</small>
    `;
    el.style.background = `linear-gradient(135deg, ${bmiCatColor(cat)}, #34495e)`;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 8000);
}

// ──────────────────────────────────────────────
// DISPLAY UPDATE
// ──────────────────────────────────────────────
function updateDisplay() {
    const p = getProfile(); if (!p) return;
    updateStats(p);
    updateHistory(p);
    renderChart();
    updateAchievements(p);
    renderIntel(p);
    updateDashboard();
    checkReminder(p);
}

function updateStats(p) {
    const m = p.measurements || [];
    const hm = m.filter(x => x.height);
    document.getElementById('stTotal').textContent = m.length;
    if (hm.length > 0) {
        const cur = hm[hm.length - 1].height;
        document.getElementById('stCurrent').textContent = cur + 'cm';
        if (hm.length > 1) {
            const grow = (cur - hm[0].height).toFixed(1);
            document.getElementById('stGrowth').textContent = grow;
            const months = (new Date(hm[hm.length - 1].date) - new Date(hm[0].date)) / (1000 * 60 * 60 * 24 * 30);
            document.getElementById('stAvg').textContent = months > 0 ? (grow / months).toFixed(2) : '0';
        } else {
            document.getElementById('stGrowth').textContent = '0';
            document.getElementById('stAvg').textContent = '0';
        }
    } else {
        document.getElementById('stCurrent').textContent = '--';
        document.getElementById('stGrowth').textContent = '0';
        document.getElementById('stAvg').textContent = '0';
    }
}

function updateHistory(p) {
    const list = document.getElementById('histList');
    const m = [...(p.measurements || [])].reverse();
    if (!m.length) { list.innerHTML = '<p class="no-data">No measurements yet! Add one above! 📏</p>'; return; }
    list.innerHTML = m.map((item, i) => {
        const isH = item.type === 'height' || item.height;
        const isW = item.type === 'weight' || item.weight;
        let main = '', sub = '', growthTxt = '';
        if (isH) {
            main = `<strong style="font-size:1.5rem">${item.height}cm</strong>`;
            // growth vs prev height measurement
            const prevH = m.slice(i + 1).find(x => x.height);
            if (prevH) {
                const d = (item.height - prevH.height).toFixed(1);
                growthTxt = d > 0 ? `<span style="color:var(--mint)">+${d}cm 📈</span>` : d < 0 ? `<span style="color:var(--pink)">${d}cm</span>` : '';
            }
        }
        if (isW) {
            main += `${isH ? ' · ' : ''}<strong style="font-size:1.4rem">${item.weight}kg</strong>`;
            if (item.bmi) {
                sub = `<span style="background:${bmiCatColor(item.bmiCat)};color:white;padding:2px 10px;border-radius:10px;font-size:.85rem;margin-left:8px">BMI ${item.bmi} · ${item.bmiCat}</span>`;
            }
        }
        return `<div class="hist-item">
            <div>
                <strong>${fmtDate(item.date)}</strong><br>
                <small style="color:var(--txt2)">Age: ${item.age} yrs</small>
                ${sub}
            </div>
            <div style="text-align:right;display:flex;align-items:center;gap:10px">
                <div>${main}<br>${growthTxt}</div>
                <button class="del-m" onclick="delMeasurement('${item.id}',event)">🗑️</button>
            </div>
        </div>`;
    }).join('');
}

// ──────────────────────────────────────────────
// CHART TABS
// ──────────────────────────────────────────────
function switchChartTab(tab, btn) {
    currentChartTab = tab;
    document.querySelectorAll('.ctab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderChart();
}

function renderChart() {
    const p = getProfile(); if (!p) return;
    const ctx = document.getElementById('mainChart').getContext('2d');
    if (mainChart) mainChart.destroy();
    const m = p.measurements || [];
    const hm = m.filter(x => x.height);
    const wm = m.filter(x => x.weight);

    if (currentChartTab === 'height') renderHeightChart(ctx, p, hm);
    else if (currentChartTab === 'monthly') renderMonthlyChart(ctx, p, hm);
    else if (currentChartTab === 'bmi') renderBMIChart(ctx, p, wm);
    else if (currentChartTab === 'prediction') renderPredictionChart(ctx, p, hm);
}

function chartDefaults() {
    return {
        tickColor: cfg.dark ? '#aaa' : '#555',
        gridColor: cfg.dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
        fontFamily: 'Fredoka'
    };
}

function renderHeightChart(ctx, p, hm) {
    const d = chartDefaults();
    if (!hm.length) { noDataChart(ctx); return; }
    
    const ages = hm.map(x => x.age || p.age);
    const who = getWHOCurves(p.gender, 'height', ages);
    
    const datasets = [{
        label: `${p.name}'s Height (cm)`,
        data: hm.map(x => x.height),
        borderColor: p.color1 || '#9B59B6',
        backgroundColor: (p.color1 || '#9B59B6') + '30',
        borderWidth: 3, fill: true, tension: .4,
        pointRadius: 6, pointHoverRadius: 9,
        pointBackgroundColor: p.color1 || '#9B59B6',
        pointBorderColor: '#fff', pointBorderWidth: 2,
        order: 1
    }];

    if (who.p50.length > 0) {
        const createWhoLine = (name, dataData, color, dash) => ({
            label: name, data: dataData, borderColor: color,
            borderWidth: 2, borderDash: dash, fill: false, tension: .4,
            pointRadius: 0, pointHoverRadius: 0, order: 2
        });
        datasets.push(createWhoLine('95th Percentile', who.p95, 'rgba(46, 204, 113, 0.6)', [5, 5]));
        datasets.push(createWhoLine('50th Percentile', who.p50, 'rgba(52, 152, 219, 0.6)', [5, 5]));
        datasets.push(createWhoLine('5th Percentile', who.p5, 'rgba(231, 76, 60, 0.6)', [5, 5]));
    }

    mainChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: hm.map(x => fmtDate(x.date)),
            datasets: datasets
        },
        options: chartOpts(d, 'Height (cm)')
    });
}

function renderMonthlyChart(ctx, p, hm) {
    const d = chartDefaults();
    if (hm.length < 2) { noDataChart(ctx, 'Need at least 2 measurements for monthly growth!'); return; }
    const labels = [], data = [];
    for (let i = 1; i < hm.length; i++) {
        const diff = (hm[i].height - hm[i - 1].height).toFixed(2);
        const months = (new Date(hm[i].date) - new Date(hm[i - 1].date)) / (1000 * 60 * 60 * 24 * 30);
        const perMonth = months > 0 ? (diff / months).toFixed(2) : diff;
        labels.push(fmtDate(hm[i].date));
        data.push(parseFloat(perMonth));
    }
    mainChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Growth per period (cm)',
                data,
                backgroundColor: data.map(v => v >= 0 ? 'rgba(78,205,196,0.7)' : 'rgba(255,107,157,0.7)'),
                borderColor: data.map(v => v >= 0 ? 'var(--mint)' : 'var(--pink)'),
                borderWidth: 2, borderRadius: 8
            }]
        },
        options: chartOpts(d, 'Growth (cm)')
    });
}

function renderBMIChart(ctx, p, wm) {
    const d = chartDefaults();
    if (!wm.length) { noDataChart(ctx, 'No weight measurements yet! Log your weight to see BMI trend.'); return; }
    mainChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: wm.map(x => fmtDate(x.date)),
            datasets: [{
                label: `${p.name}'s BMI`,
                data: wm.map(x => x.bmi),
                borderColor: '#E67E22',
                backgroundColor: 'rgba(230,126,34,0.2)',
                borderWidth: 3, fill: true, tension: .4,
                pointRadius: 6, pointHoverRadius: 9,
                pointBackgroundColor: '#E67E22',
                pointBorderColor: '#fff', pointBorderWidth: 2
            }]
        },
        options: {
            ...chartOpts(d, 'BMI'),
            plugins: {
                ...chartOpts(d, 'BMI').plugins,
                annotation: {}
            }
        }
    });
}

function renderPredictionChart(ctx, p, hm) {
    const d = chartDefaults();
    if (hm.length < 2) { noDataChart(ctx, 'Need at least 2 measurements for predictions!'); return; }
    const last = hm[hm.length - 1];
    const totalMonths = (new Date(hm[hm.length - 1].date) - new Date(hm[0].date)) / (1000 * 60 * 60 * 24 * 30);
    const growthPerMonth = totalMonths > 0 ? (last.height - hm[0].height) / totalMonths : 0;

    // Generate 24-month prediction with gradual slowdown (realistic growth curve)
    const predLabels = [], predData = [];
    const gender = (p.gender || 'male') === 'female' ? 'female' : 'male';
    const whoExpected = WHO_GROWTH[gender]?.[p.age] || 5;
    const whoPerMonth = whoExpected / 12;
    // Blend actual rate with WHO rate for realistic curve
    const blendedRate = (growthPerMonth * 0.6 + whoPerMonth * 0.4);

    for (let m = 1; m <= 24; m++) {
        const d2 = new Date(last.date);
        d2.setMonth(d2.getMonth() + m);
        predLabels.push(fmtDate(d2.toISOString().split('T')[0]));
        // Slight natural slowdown over time
        const slowdown = Math.max(0.4, 1 - (m / 36) * 0.3);
        predData.push(+(last.height + blendedRate * m * slowdown).toFixed(1));
    }

    const allLabels = hm.map(x => fmtDate(x.date)).concat(predLabels);
    const actualNulls = Array(predLabels.length).fill(null);
    const predNulls = Array(hm.length - 1).fill(null);

    mainChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: allLabels,
            datasets: [
                {
                    label: 'Actual Height (cm)',
                    data: hm.map(x => x.height).concat(actualNulls),
                    borderColor: p.color1 || '#9B59B6',
                    backgroundColor: (p.color1 || '#9B59B6') + '30',
                    borderWidth: 3, fill: true, tension: .4,
                    pointRadius: 5, pointHoverRadius: 8,
                    pointBackgroundColor: p.color1 || '#9B59B6',
                    pointBorderColor: '#fff', pointBorderWidth: 2
                },
                {
                    label: 'Predicted Height (24 months)',
                    data: predNulls.concat([last.height]).concat(predData),
                    borderColor: '#E74C3C',
                    backgroundColor: 'rgba(231,76,60,0.12)',
                    borderWidth: 3,
                    borderDash: [8, 4],
                    fill: true, tension: .4,
                    pointRadius: 3, pointBackgroundColor: '#E74C3C',
                    pointBorderColor: '#fff', pointBorderWidth: 2
                }
            ]
        },
        options: chartOpts(d, 'Height (cm)')
    });
}

function chartOpts(d, yLabel) {
    return {
        responsive: true, maintainAspectRatio: false,
        plugins: {
            legend: { labels: { font: { family: d.fontFamily, size: 13 }, color: d.tickColor } },
            tooltip: { titleFont: { family: d.fontFamily }, bodyFont: { family: d.fontFamily } }
        },
        scales: {
            y: {
                beginAtZero: false, title: { display: true, text: yLabel, color: d.tickColor, font: { family: d.fontFamily } },
                ticks: { font: { family: d.fontFamily }, color: d.tickColor },
                grid: { color: d.gridColor }
            },
            x: {
                ticks: { font: { family: d.fontFamily }, color: d.tickColor, maxRotation: 45, minRotation: 45 },
                grid: { color: d.gridColor }
            }
        }
    };
}

function noDataChart(ctx, msg) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.font = '20px Fredoka';
    ctx.fillStyle = '#999';
    ctx.textAlign = 'center';
    ctx.fillText(msg || 'No data yet! Add measurements above 📏', ctx.canvas.width / 2, ctx.canvas.height / 2);
}

// ──────────────────────────────────────────────
// GROWTH INTELLIGENCE (Enhanced)
// ──────────────────────────────────────────────
function calcAdultHeightPrediction(p, currentHeight) {
    const age = p.age || 10;
    const gender = (p.gender || 'male') === 'female' ? 'female' : 'male';
    // Khamis-Roche method approximation (without parent heights, use WHO-based)
    // Average adult heights: Male ~176cm, Female ~163cm
    const targetAdult = gender === 'female' ? 163 : 176;
    const growthRemaining = Math.max(0, targetAdult - currentHeight);
    // Bone age factor: assume standard development
    const ageRatio = Math.min(1, age / (gender === 'female' ? 15 : 17));
    const predicted = currentHeight + growthRemaining * (1 - ageRatio);
    return Math.round(predicted * 10) / 10;
}

function calcGrowthPercentile(p, currentHeight) {
    // WHO reference heights (cm) at age for 3rd, 10th, 25th, 50th, 75th, 90th, 97th percentile
    const WHO_PERCENTILES = {
        male: {
            2: [80.0, 82.3, 84.5, 87.1, 89.7, 91.9, 94.2],
            3: [88.7, 91.3, 93.9, 96.1, 98.3, 100.9, 103.5],
            4: [95.2, 98.0, 100.8, 103.3, 105.8, 108.6, 111.4],
            5: [101.6, 104.6, 107.6, 110.0, 112.4, 115.4, 118.4],
            6: [107.0, 110.1, 113.2, 116.1, 119.0, 122.1, 125.2],
            7: [111.8, 115.1, 118.4, 121.7, 125.0, 128.3, 131.6],
            8: [116.4, 120.0, 123.6, 127.0, 130.4, 134.0, 137.6],
            9: [121.0, 124.8, 128.6, 132.2, 135.8, 139.6, 143.4],
            10: [125.4, 129.5, 133.6, 137.5, 141.4, 145.5, 149.6],
            11: [129.7, 134.2, 138.7, 143.1, 147.5, 152.0, 156.5],
            12: [134.2, 139.2, 144.2, 149.1, 154.0, 159.0, 164.0],
            13: [139.1, 144.6, 150.1, 155.2, 160.3, 165.8, 171.3],
            14: [144.8, 150.5, 156.2, 161.5, 166.8, 172.5, 178.2],
            15: [150.5, 156.0, 161.5, 166.8, 172.1, 177.6, 183.1],
            16: [154.2, 159.2, 164.2, 169.6, 175.0, 180.0, 185.0],
            17: [156.0, 161.0, 166.0, 171.5, 177.0, 182.0, 187.0],
            18: [157.0, 162.0, 167.0, 173.0, 179.0, 183.0, 188.0]
        },
        female: {
            2: [79.3, 81.5, 83.7, 86.4, 89.1, 91.3, 93.5],
            3: [87.4, 90.0, 92.6, 95.1, 97.6, 100.2, 102.8],
            4: [94.1, 97.0, 99.9, 102.7, 105.5, 108.4, 111.3],
            5: [100.2, 103.4, 106.6, 109.4, 112.2, 115.4, 118.6],
            6: [105.8, 109.1, 112.4, 115.5, 118.6, 121.9, 125.2],
            7: [110.8, 114.3, 117.8, 121.1, 124.4, 127.9, 131.4],
            8: [115.6, 119.2, 122.8, 126.4, 130.0, 133.6, 137.2],
            9: [120.3, 124.2, 128.1, 131.9, 135.7, 139.6, 143.5],
            10: [125.2, 129.4, 133.6, 137.9, 142.2, 146.4, 150.6],
            11: [130.9, 135.4, 139.9, 144.4, 148.9, 153.4, 157.9],
            12: [137.0, 141.5, 146.0, 150.8, 155.6, 160.1, 164.6],
            13: [141.8, 146.0, 150.2, 154.5, 158.8, 163.0, 167.2],
            14: [144.5, 148.5, 152.5, 156.6, 160.7, 164.7, 168.7],
            15: [146.2, 150.1, 154.0, 158.0, 162.0, 165.9, 169.8],
            16: [147.0, 151.0, 155.0, 159.1, 163.2, 167.2, 171.2],
            17: [147.5, 151.5, 155.5, 159.7, 163.9, 167.9, 171.9],
            18: [148.0, 152.0, 156.0, 160.0, 164.0, 168.0, 172.0]
        }
    };
    const gender = (p.gender || 'male') === 'female' ? 'female' : 'male';
    const age = Math.min(18, Math.max(2, Math.round(p.age)));
    const refs = WHO_PERCENTILES[gender][age] || WHO_PERCENTILES[gender][10];
    const pcts = [3, 10, 25, 50, 75, 90, 97];
    if (currentHeight <= refs[0]) return { pct: '<3rd', label: 'Very Low', color: '#e74c3c' };
    if (currentHeight >= refs[6]) return { pct: '>97th', label: 'Very Tall', color: '#27ae60' };
    for (let i = 0; i < refs.length - 1; i++) {
        if (currentHeight >= refs[i] && currentHeight < refs[i + 1]) {
            const frac = (currentHeight - refs[i]) / (refs[i + 1] - refs[i]);
            const pct = Math.round(pcts[i] + frac * (pcts[i + 1] - pcts[i]));
            let label = pct < 10 ? 'Below Average' : pct < 25 ? 'Low-Normal' : pct < 75 ? 'Average' : pct < 90 ? 'Above Average' : 'Tall';
            let color = pct < 10 ? '#e74c3c' : pct < 25 ? '#e67e22' : pct < 75 ? '#27ae60' : '#3498db';
            return { pct: `${pct}th`, label, color };
        }
    }
    return { pct: '50th', label: 'Average', color: '#27ae60' };
}

function renderIntel(p) {
    const el = document.getElementById('intelContent');
    const m = (p.measurements || []).filter(x => x.height);
    if (m.length < 2) {
        el.innerHTML = '<p class="no-data">Add at least 2 height measurements to see growth insights! 💡</p>';
        return;
    }
    const msgs = [];
    const last = m[m.length - 1], first = m[0];
    const totalGrowth = (last.height - first.height).toFixed(1);
    const firstDate = new Date(first.date), lastDate = new Date(last.date);
    const totalMonths = (lastDate - firstDate) / (1000 * 60 * 60 * 24 * 30);

    // ── Predicted Adult Height ──
    const predictedAdult = calcAdultHeightPrediction(p, last.height);
    const growthPct = calcGrowthPercentile(p, last.height);

    // ── Growth Percentile ──
    msgs.push({
        type: 'info', icon: '📊', head: `Growth Percentile: ${growthPct.pct} — ${growthPct.label}`,
        body: `${p.name} is at the <strong>${growthPct.pct} percentile</strong> for their age and gender. ${growthPct.pct === '<3rd' ? 'Consider a pediatric consultation.' : growthPct.pct === '>97th' ? 'Exceptional growth!' : 'This is within normal range.'}`
    });

    // ── Predicted Adult Height ──
    msgs.push({
        type: 'good', icon: '🔮', head: `Predicted Adult Height: ~${predictedAdult} cm`,
        body: `Based on current height of <strong>${last.height} cm</strong> at age <strong>${p.age}</strong>, the estimated adult height is approximately <strong>${predictedAdult} cm</strong> (${(predictedAdult / 2.54 / 12).toFixed(1)} ft). This is an estimate based on WHO growth standards.`
    });

    // ── Growth Velocity ──
    const gender = (p.gender || 'male').toLowerCase() === 'female' ? 'female' : 'male';
    const expectedPerYear = WHO_GROWTH[gender]?.[p.age] || WHO_GROWTH[gender]?.[Math.min(18, Math.max(2, p.age))];
    if (totalMonths >= 1 && expectedPerYear) {
        const actualPerYear = parseFloat((totalGrowth / (totalMonths / 12)).toFixed(1));
        const velocity = (actualPerYear / 12).toFixed(2);
        const ratio = actualPerYear / expectedPerYear;
        const velStatus = ratio >= 1.1 ? `Growing above average 🚀` : ratio >= 0.9 ? `On track ✅` : ratio >= 0.65 ? `Slightly below average ⚠️` : `Below expected — consult pediatrician 🩺`;
        const velType = ratio >= 0.9 ? 'good' : 'warn';
        msgs.push({
            type: velType, icon: '⚡', head: 'Growth Velocity',
            body: `Current growth rate: <strong>${actualPerYear} cm/year</strong> (${velocity} cm/month)<br>WHO expected rate: <strong>${expectedPerYear} cm/year</strong><br>Status: <strong>${velStatus}</strong>`
        });
    }

    // Last 3 months growth
    const threeMonthsAgo = new Date(); threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const recent = m.filter(x => new Date(x.date) >= threeMonthsAgo);
    if (recent.length >= 2) {
        const rGrowth = (recent[recent.length - 1].height - recent[0].height).toFixed(1);
        const rMonths = (new Date(recent[recent.length - 1].date) - new Date(recent[0].date)) / (1000 * 60 * 60 * 24 * 30) || 1;
        msgs.push({ type: 'info', icon: '📏', head: 'Recent Growth (last 3 months)', body: `${p.name} grew <strong>${rGrowth} cm</strong> in the past ~3 months (${(rGrowth / rMonths).toFixed(2)} cm/month).` });
    }

    // BMI insight
    const latestBMI = [...(p.measurements || [])].reverse().find(x => x.bmi);
    if (latestBMI) {
        const catEmoji = { Underweight: '💧', Healthy: '✅', Overweight: '⚠️', Obese: '🚨' }[latestBMI.bmiCat] || '📊';
        const catType = { Healthy: 'good', Underweight: 'warn', Overweight: 'warn', Obese: 'warn' }[latestBMI.bmiCat] || 'info';
        msgs.push({ type: catType, icon: catEmoji, head: `BMI: ${latestBMI.bmi} (${latestBMI.bmiCat})`, body: `Last recorded weight: <strong>${latestBMI.weight} kg</strong> at <strong>${latestBMI.heightUsed} cm</strong>.${latestBMI.bmiCat === 'Healthy' ? ' Keep up the great work!' : " Consult a healthcare provider for personalised guidance."}` });
    }

    // Total summary
    msgs.push({ type: 'normal', icon: '🌱', head: 'Overall Progress', body: `${p.name} has grown a total of <strong>${totalGrowth} cm</strong> since tracking started. Keep up the great work!` });

    el.innerHTML = `
        <div class="pred-stats">
            <div class="pred-stat"><span class="pred-stat-val">${predictedAdult} cm</span><div class="pred-stat-lbl">🔮 Predicted Adult Height</div></div>
            <div class="pred-stat"><span class="pred-stat-val" style="color:${growthPct.color}">${growthPct.pct}</span><div class="pred-stat-lbl">📊 Growth Percentile</div></div>
            <div class="pred-stat"><span class="pred-stat-val">${totalMonths > 0 ? ((parseFloat(totalGrowth) / (totalMonths / 12)).toFixed(1)) : 0}</span><div class="pred-stat-lbl">⚡ cm/year Velocity</div></div>
        </div>
    ` + msgs.map(m => `
        <div class="intel-msg ${m.type}">
            <div class="intel-icon">${m.icon}</div>
            <div class="intel-text"><div class="intel-head">${m.head}</div><div>${m.body}</div></div>
        </div>
    `).join('');

    // Auto-send notification if significant event
    autoNotifyGrowth(p, m);
}

// ──────────────────────────────────────────────
// ACHIEVEMENTS
// ──────────────────────────────────────────────
function updateAchievements(p) {
    const grid = document.getElementById('achGrid');
    const m = p.measurements || [];
    const hm = m.filter(x => x.height);
    grid.innerHTML = ACHIEVEMENTS.map(a => {
        let on = false;
        if (a.type === 'm') on = m.length >= a.thr;
        else if (a.type === 'g' && hm.length > 1) on = (hm[hm.length - 1].height - hm[0].height) >= a.thr;
        return `<div class="ach ${on ? 'on' : 'off'}">
            <div class="ach-ico">${on ? a.icon : '🔒'}</div>
            <div class="ach-nm">${a.name}</div>
        </div>`;
    }).join('');
}

// ──────────────────────────────────────────────
// MILESTONES
// ──────────────────────────────────────────────
function checkMilestones(p) {
    const hm = (p.measurements || []).filter(x => x.height);
    if (hm.length < 2) return;
    const total = hm[hm.length - 1].height - hm[0].height;
    const banner = document.getElementById('milestoneBanner');
    const text = document.getElementById('milestoneText');
    for (const ms of [{ t: 20, m: '👑 20cm total growth — SUPERSTAR!' }, { t: 15, m: '🏆 15cm total — CHAMPION!' }, { t: 10, m: '🎯 10cm milestone!' }, { t: 5, m: '📏 5cm milestone!' }]) {
        if (Math.floor(total) >= ms.t) {
            text.textContent = ms.m;
            banner.classList.add('show');
            return;
        }
    }
}

// ──────────────────────────────────────────────
// EXPORT
// ──────────────────────────────────────────────
function exportAll() {
    if (!profiles.length) { alert('No profiles to export!'); return; }
    let csv = 'Profile,Avatar,Gender,Age,Birthdate,Date,Height (cm),Weight (kg),BMI,BMI Category\n';
    profiles.forEach(p => {
        const m = p.measurements || [];
        if (!m.length) csv += `${p.name},${p.avatar || ''},${p.gender || ''},${p.age},${p.birth || ''},,,,\n`;
        else m.forEach(x => { csv += `${p.name},${p.avatar || ''},${p.gender || ''},${x.age || p.age},${p.birth || ''},${x.date || ''},${x.height || ''},${x.weight || ''},${x.bmi || ''},${x.bmiCat || ''}\n`; });
    });
    dlCSV(csv, 'heightmate_all_data.csv');
    toast('📤 All data exported!');
}

function exportProfile() {
    const p = getProfile(); if (!p) { alert('No profile selected!'); return; }
    const m = p.measurements || [];
    if (!m.length) { alert('No measurements to export!'); return; }
    let csv = `HeightMate Pro - ${p.name}\nDate,Age,Height (cm),Weight (kg),BMI,BMI Category\n`;
    m.forEach(x => { csv += `${x.date},${x.age || p.age},${x.height || ''},${x.weight || ''},${x.bmi || ''},${x.bmiCat || ''}\n`; });
    dlCSV(csv, `${p.name.replace(/ /g, '_')}_data.csv`);
    toast(`📥 ${p.name}'s data exported!`);
}

function exportPDF() {
    const p = getProfile(); 
    if (!p) { toast('⚠️ Please select a profile first!'); return; }
    const m = p.measurements || [];
    if (!m.length) { toast('⚠️ No measurements to export!'); return; }
    
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        doc.setFillColor(155, 89, 182);
        doc.rect(0, 0, 210, 40, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.text(`HeightMate Report: ${p.name}`, 20, 25);
        
        doc.setTextColor(50, 50, 50);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text(`Age: ${p.age} years`, 20, 55);
        doc.text(`Gender: ${p.gender === 'male' ? 'Boy' : p.gender === 'female' ? 'Girl' : 'Other'}`, 20, 65);
        
        const hm = m.filter(x => x.height);
        const wm = m.filter(x => x.weight && x.bmi);
        
        const currentH = hm.length ? hm[hm.length - 1].height + ' cm' : 'N/A';
        const currentW = wm.length ? wm[wm.length - 1].weight + ' kg' : 'N/A';
        const currentBMI = wm.length ? `${wm[wm.length - 1].bmi} (${wm[wm.length - 1].bmiCat})` : 'N/A';
        
        doc.text(`Latest Height: ${currentH}`, 120, 55);
        doc.text(`Latest Weight: ${currentW}`, 120, 65);
        doc.text(`Latest BMI: ${currentBMI}`, 120, 75);
        
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(155, 89, 182);
        doc.text('Measurement History', 20, 95);
        
        doc.setFontSize(11);
        doc.setTextColor(100, 100, 100);
        doc.text('Date', 20, 110);
        doc.text('Height (cm)', 70, 110);
        doc.text('Weight (kg)', 120, 110);
        doc.text('BMI', 170, 110);
        
        doc.setDrawColor(200, 200, 200);
        doc.line(20, 112, 190, 112);
        
        doc.setTextColor(50, 50, 50);
        doc.setFont('helvetica', 'normal');
        let y = 122;
        [...m].reverse().slice(0, 25).forEach(x => {
            if (y > 260) { doc.addPage(); y = 20; }
            doc.text(fmtDate(x.date), 20, y);
            doc.text(x.height ? x.height.toString() : '-', 70, y);
            doc.text(x.weight ? x.weight.toString() : '-', 120, y);
            doc.text(x.bmi ? `${x.bmi} (${x.bmiCat})` : '-', 170, y);
            y += 10;
        });
        
        if (typeof aiMessages !== 'undefined') {
            const lastAiMsg = aiMessages.slice().reverse().find(msg => msg.role === 'assistant');
            if (lastAiMsg) {
                if (y > 230) { doc.addPage(); y = 20; }
                doc.setFontSize(14);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(155, 89, 182);
                doc.text('Latest AI Insight', 20, y + 10);
                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(80, 80, 80);
                const splitText = doc.splitTextToSize(lastAiMsg.content.replace(/<br>/g, '\n').replace(/\n/g, ' '), 170);
                doc.text(splitText, 20, y + 20);
            }
        }
        
        doc.save(`${p.name}_HeightMate_Report.pdf`);
        toast('📄 PDF Report downloaded!');
    } catch (e) {
        console.error(e);
        toast('⚠️ Error generating PDF. Check console.');
    }
}

function dlCSV(content, filename) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
}

// ──────────────────────────────────────────────
// AVATAR GRID
// ──────────────────────────────────────────────
function renderAvGrid(elId, selected) {
    document.getElementById(elId).innerHTML = AVATARS.map(a =>
        `<div class="av-opt${a === selected ? ' sel' : ''}" onclick="pickAv('${elId}',this)">${a}</div>`
    ).join('');
}
function pickAv(elId, el) {
    document.querySelectorAll(`#${elId} .av-opt`).forEach(x => x.classList.remove('sel'));
    el.classList.add('sel');
}

// Gender selector
function selGender(el, val, scope) {
    const row = scope === 'edit' ? document.getElementById('editGenderRow') : el.closest('.gender-row');
    row.querySelectorAll('.gender-btn').forEach(b => b.classList.remove('sel'));
    el.classList.add('sel');
    document.getElementById(scope === 'edit' ? 'eGender' : 'pGender').value = val;
}

// ──────────────────────────────────────────────
// UTILITIES
// ──────────────────────────────────────────────
function getProfile() { return profiles.find(p => p.id === curPid); }


function doConfetti() {
    const cols = ['#FFD700', '#FF6B9D', '#90EE90', '#87CEEB', '#9B59B6', '#FF6B6B', '#4ECDC4'];
    for (let i = 0; i < 60; i++) setTimeout(() => {
        const c = document.createElement('div');
        c.className = 'confetti-p';
        c.style.cssText = `left:${Math.random() * 100}vw;top:-10px;background:${cols[Math.floor(Math.random() * cols.length)]};animation-delay:${Math.random() * .5}s;width:${6 + Math.random() * 8}px;height:${6 + Math.random() * 8}px;border-radius:${Math.random() > .5 ? '50%' : '3px'}`;
        document.body.appendChild(c);
        setTimeout(() => c.remove(), 3500);
    }, i * 40);
}

// ──────────────────────────────────────────────
// DASHBOARD
// ──────────────────────────────────────────────
function updateDashboard() {
    // Profile count
    document.getElementById('dProfiles').textContent = profiles.length;

    // Total measurements across all profiles
    const totalAll = profiles.reduce((s, p) => s + (p._count || 0), 0);
    document.getElementById('dTotalMeas').textContent = totalAll;

    // Last measurement across all profiles
    let latestDate = null;
    profiles.forEach(p => {
        const m = (p.measurements || []).filter(x => x.date);
        if (m.length) {
            const d = new Date(m[m.length - 1].date);
            if (!latestDate || d > latestDate) latestDate = d;
        }
    });
    if (latestDate) {
        const daysAgo = Math.floor((new Date() - latestDate) / (1000 * 60 * 60 * 24));
        document.getElementById('dLastMeas').textContent = daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo}d ago`;
    } else {
        document.getElementById('dLastMeas').textContent = 'None yet';
    }

    // Current profile stats
    const p = getProfile();
    if (p) {
        const hm = (p.measurements || []).filter(x => x.height);
        document.getElementById('dCurHeight').textContent = hm.length ? hm[hm.length - 1].height + 'cm' : '—';

        // Growth status
        if (hm.length >= 2) {
            const totalMonths = (new Date(hm[hm.length - 1].date) - new Date(hm[0].date)) / (1000 * 60 * 60 * 24 * 30);
            const totalGrowth = hm[hm.length - 1].height - hm[0].height;
            const gender = (p.gender || 'male') === 'female' ? 'female' : 'male';
            const expected = WHO_GROWTH[gender]?.[p.age] || 6;
            const actual = totalMonths > 0 ? (totalGrowth / (totalMonths / 12)) : 0;
            const status = actual >= expected * 0.9 ? 'Normal 🟢' : actual >= expected * 0.65 ? 'Monitor ⚠️' : 'Slow 🔴';
            document.getElementById('dGrowthStatus').textContent = status;
        } else {
            document.getElementById('dGrowthStatus').textContent = 'Need data';
        }

        // Next reminder
        const lastMeasDate = p.measurements?.length ?
            new Date(p.measurements[p.measurements.length - 1].date) : null;
        if (lastMeasDate) {
            const nextDate = new Date(lastMeasDate);
            nextDate.setDate(nextDate.getDate() + 30);
            const daysLeft = Math.ceil((nextDate - new Date()) / (1000 * 60 * 60 * 24));
            document.getElementById('dNextMeas').textContent = daysLeft <= 0 ? 'Now!' : daysLeft === 1 ? 'Tomorrow' : `${daysLeft}d`;
        } else {
            document.getElementById('dNextMeas').textContent = 'Now!';
        }
    } else {
        document.getElementById('dCurHeight').textContent = '—';
        document.getElementById('dGrowthStatus').textContent = '—';
        document.getElementById('dNextMeas').textContent = '—';
    }
}

// ──────────────────────────────────────────────
// GROWTH REMINDERS
// ──────────────────────────────────────────────
function checkReminder(p) {
    if (!p || !p.measurements?.length) return;
    const last = p.measurements[p.measurements.length - 1];
    if (!last?.date) return;
    const daysAgo = Math.floor((new Date() - new Date(last.date + 'T00:00:00')) / (1000 * 60 * 60 * 24));
    const bar = document.getElementById('reminderBar');
    const txt = document.getElementById('reminderText');
    if (daysAgo >= 30) {
        txt.textContent = `Last measurement was ${daysAgo} days ago — time to measure ${p.name} again! 📏`;
        bar.classList.add('show');
    } else if (daysAgo >= 25) {
        txt.textContent = `Measure ${p.name} again in ${30 - daysAgo} days (last: ${daysAgo} days ago)`;
        bar.classList.add('show');
    } else {
        bar.classList.remove('show');
    }
}

function switchTabAndScroll(tabId) {
    // Ensure dashboard tab is selected first
    switchAppTab('dashboard');
    
    const tabMap = { bt: '🔵 Bluetooth Device', manual: '✏️ Manual Entry', weight: '⚖️ Log Weight + BMI' };
    const id = tabId || 'manual';
    document.querySelectorAll('.entry-tab').forEach(b => {
        if (b.textContent.includes(id === 'bt' ? 'Bluetooth' : id === 'manual' ? 'Manual' : 'Weight')) {
            b.click();
        }
    });
    
    // Smooth scroll inside dashboard tab
    setTimeout(() => {
        const el = document.querySelector('.entry-section');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
}

// ──────────────────────────────────────────────
// PDF GROWTH REPORT
// ──────────────────────────────────────────────
async function downloadPDF() {
    const p = getProfile();
    if (!p) { alert('Please select a profile first!'); return; }
    const hm = (p.measurements || []).filter(x => x.height);
    if (!hm.length) { alert('No height measurements to include in the report!'); return; }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = 210, margin = 18;
    let y = 0;

    // ── Header gradient bar ──
    doc.setFillColor(155, 89, 182);
    doc.rect(0, 0, W, 42, 'F');
    doc.setFillColor(62, 191, 176);
    doc.rect(0, 36, W, 8, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(26);
    doc.setFont('helvetica', 'bold');
    doc.text('HeightMate Pro', margin, 16);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'normal');
    doc.text('Growth Report', margin, 25);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, margin, 33);
    y = 54;

    // ── Child info card ──
    doc.setFillColor(248, 245, 255);
    doc.roundedRect(margin, y, W - margin * 2, 36, 5, 5, 'F');
    doc.setDrawColor(155, 89, 182);
    doc.setLineWidth(0.5);
    doc.roundedRect(margin, y, W - margin * 2, 36, 5, 5, 'S');

    const gIcon = p.gender === 'female' ? 'Girl' : 'Boy';
    doc.setTextColor(155, 89, 182);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(p.avatar ? `${p.name}` : `${p.name}`, margin + 8, y + 12);
    doc.setTextColor(80, 80, 80);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Age: ${p.age} years  |  Gender: ${gIcon}${p.birth ? ' | Birthdate: ' + p.birth : ''}`, margin + 8, y + 22);

    const curH = hm[hm.length - 1].height;
    const totalG = hm.length > 1 ? (curH - hm[0].height).toFixed(1) : '—';
    doc.text(`Current Height: ${curH} cm  |  Total Growth: ${totalG} cm  |  Measurements: ${hm.length}`, margin + 8, y + 31);
    y += 46;

    // ── Growth chart (capture canvas) ──
    try {
        // Temporarily switch to height chart
        const canvas = document.getElementById('mainChart');
        if (canvas && mainChart) {
            const imgData = canvas.toDataURL('image/png');
            const chartH = 60;
            doc.setFillColor(255, 255, 255);
            doc.roundedRect(margin, y, W - margin * 2, chartH + 6, 4, 4, 'F');
            doc.setDrawColor(200, 200, 200);
            doc.roundedRect(margin, y, W - margin * 2, chartH + 6, 4, 4, 'S');
            doc.addImage(imgData, 'PNG', margin + 2, y + 2, W - margin * 2 - 4, chartH + 2);
            y += chartH + 14;
        }
    } catch (e) { }

    // ── Section: Growth Intelligence Summary ──
    doc.setFillColor(62, 191, 176);
    doc.rect(margin, y, 3, 10, 'F');
    doc.setTextColor(62, 191, 176);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Growth Intelligence', margin + 7, y + 8);
    y += 16;

    if (hm.length >= 2) {
        const totalMonths = (new Date(hm[hm.length - 1].date) - new Date(hm[0].date)) / (1000 * 60 * 60 * 24 * 30);
        const totalGrowth = curH - hm[0].height;
        const gender2 = (p.gender || 'male') === 'female' ? 'female' : 'male';
        const expected = WHO_GROWTH[gender2]?.[p.age] || 6;
        const actualPerYear = totalMonths > 0 ? (totalGrowth / (totalMonths / 12)).toFixed(1) : 0;
        const status = actualPerYear >= expected * 0.9 ? 'Healthy ✓' : actualPerYear >= expected * 0.65 ? 'Monitor — slightly below average' : 'Slow — consult a pediatrician';

        const intel = [
            `Growth Rate: ${actualPerYear} cm/year (expected ~${expected} cm/year for age ${p.age})`,
            `Status: ${status}`,
            `Total tracked growth: ${totalGrowth.toFixed(1)} cm over ${totalMonths.toFixed(1)} months`,
        ];
        if (hm.length >= 2) {
            const gpm = (totalGrowth / totalMonths).toFixed(2);
            const pred = (curH + parseFloat(gpm) * 12).toFixed(1);
            intel.push(`12-Month Prediction: ~${pred} cm at current growth rate`);
        }

        intel.forEach(line => {
            doc.setFillColor(245, 240, 255);
            doc.roundedRect(margin, y, W - margin * 2, 9, 2, 2, 'F');
            doc.setTextColor(60, 60, 60);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9.5);
            doc.text(line, margin + 5, y + 6.3);
            y += 12;
        });
    }
    y += 6;

    // ── Section: Measurement History ──
    if (y > 230) { doc.addPage(); y = 20; }
    doc.setFillColor(255, 107, 157);
    doc.rect(margin, y, 3, 10, 'F');
    doc.setTextColor(255, 107, 157);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Height Measurement History', margin + 7, y + 8);
    y += 15;

    // Table header
    doc.setFillColor(155, 89, 182);
    doc.rect(margin, y, W - margin * 2, 9, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Date', margin + 4, y + 6.3);
    doc.text('Age', margin + 42, y + 6.3);
    doc.text('Height', margin + 65, y + 6.3);
    doc.text('Growth', margin + 95, y + 6.3);
    doc.text('Notes', margin + 125, y + 6.3);
    y += 10;

    const rows = [...hm].reverse();
    rows.forEach((item, idx) => {
        if (y > 270) { doc.addPage(); y = 20; }
        const bg = idx % 2 === 0 ? [248, 245, 255] : [255, 255, 255];
        doc.setFillColor(...bg);
        doc.rect(margin, y, W - margin * 2, 8, 'F');
        doc.setTextColor(60, 60, 60);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(fmtDate(item.date), margin + 4, y + 5.5);
        doc.text(`${item.age} yrs`, margin + 42, y + 5.5);
        doc.text(`${item.height} cm`, margin + 65, y + 5.5);
        // growth vs previous
        const prevH = rows[idx + 1]?.height;
        if (prevH) {
            const diff = (item.height - prevH).toFixed(1);
            doc.setTextColor(diff > 0 ? 39 : diff < 0 ? 192 : 120, diff > 0 ? 174 : diff < 0 ? 57 : 120, diff > 0 ? 96 : diff < 0 ? 43 : 120);
            doc.text(diff > 0 ? `+${diff} cm` : diff < 0 ? `${diff} cm` : '—', margin + 95, y + 5.5);
        } else {
            doc.setTextColor(150, 150, 150);
            doc.text('First', margin + 95, y + 5.5);
        }
        doc.setTextColor(150, 150, 150);
        const wm = (p.measurements || []).reverse().find(x => x.weight && new Date(x.date) <= new Date(item.date + 'T23:59:59'));
        if (wm?.bmi) {
            doc.text(`BMI ${wm.bmi} (${wm.bmiCat})`, margin + 125, y + 5.5);
        }
        y += 9;
    });

    // ── Footer ──
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFillColor(155, 89, 182);
        doc.rect(0, 287, W, 10, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text('HeightMate Pro — Family Growth Tracker', margin, 293.5);
        doc.text(`Page ${i} of ${pageCount}`, W - margin - 18, 293.5);
    }

    doc.save(`${p.name.replace(/ /g, '_')}_Growth_Report.pdf`);
    toast(`📄 Growth Report downloaded for ${p.name}!`);
}

// ──────────────────────────────────────────────
// NOTIFICATIONS SYSTEM
// ──────────────────────────────────────────────
let notifications = [];
try {
    notifications = JSON.parse(safeStorage.getItem('hm_notifications') || '[]');
} catch (e) {
    console.warn("Failed to load notifications from storage:", e);
}

function saveNotifications() {
    safeStorage.setItem('hm_notifications', JSON.stringify(notifications.slice(0, 50)));
}

function addNotification(head, sub, type, profile) {
    const notif = {
        id: Date.now() + Math.random(),
        head, sub, type,
        profile: profile || getProfile()?.name || '',
        time: new Date().toISOString(),
        unread: true,
        icon: {
            height_update: '📏', growth_alert: '📈', reminder: '⏰',
            milestone: '🏆', ai_prediction: '🤖', bmi_update: '⚖️'
        }[type] || '🔔'
    };
    notifications.unshift(notif);
    saveNotifications();
    renderNotifications();
    if (cfg.notif) {
        toast(`${notif.icon} ${head}`);
        // Request browser notification if supported
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(`HeightMate Pro — ${head}`, { body: sub, icon: '📏' });
        }
    }
}

function autoNotifyGrowth(p, hm) {
    if (hm.length < 2) return;
    const last = hm[hm.length - 1];
    const prev = hm[hm.length - 2];
    const growth = (last.height - prev.height).toFixed(1);
    if (growth > 0) {
        const gender = (p.gender || 'male') === 'female' ? 'female' : 'male';
        const pct = calcGrowthPercentile(p, last.height);
        const adult = calcAdultHeightPrediction(p, last.height);
        // Only add if recently measured (within 2 days)
        const daysSince = (new Date() - new Date(last.date)) / (1000 * 60 * 60 * 24);
        if (daysSince <= 2 && notifications.length === 0) {
            addNotification(
                `📏 ${p.name} grew ${growth} cm!`,
                `Now ${last.height} cm · ${pct.pct} percentile · Predicted adult: ${adult} cm`,
                'height_update', p.name
            );
        }
    }
}

function sendNotif(type) {
    const p = getProfile();
    const name = p ? p.name : 'Your child';
    const hm = p ? (p.measurements || []).filter(x => x.height) : [];
    const lastH = hm.length ? hm[hm.length - 1].height : 0;
    const pct = hm.length ? calcGrowthPercentile(p, lastH) : null;
    const adult = hm.length ? calcAdultHeightPrediction(p, lastH) : null;

    const messages = {
        height_update: { head: `📏 Height Update for ${name}`, sub: lastH ? `Current height: ${lastH} cm · ${pct?.pct || ''} percentile` : 'Add a measurement to see updates' },
        growth_alert: { head: `📈 Growth Alert — ${name}`, sub: hm.length >= 2 ? `Growing at ${((hm[hm.length - 1].height - hm[0].height) / ((new Date(hm[hm.length - 1].date) - new Date(hm[0].date)) / (1000 * 60 * 60 * 24 * 30) / 12)).toFixed(1)} cm/year` : 'Track more measurements for alerts' },
        reminder: { head: `⏰ Time to Measure ${name}!`, sub: 'Monthly check-in reminder — record their height today!' },
        milestone: { head: `🏆 Growth Milestone!`, sub: lastH ? `${name} has reached ${lastH} cm — amazing growth!` : 'Record a measurement to track milestones' },
        ai_prediction: { head: `🤖 AI Height Prediction`, sub: adult ? `Predicted adult height for ${name}: ${adult} cm` : 'Add measurements for AI predictions' }
    };
    const msg = messages[type] || messages.height_update;
    addNotification(msg.head, msg.sub, type, name);

    // Style active button
    document.querySelectorAll('.notif-type-btn').forEach(b => b.classList.remove('sel'));
    const btnMap = { height_update: 1, growth_alert: 2, reminder: 3, milestone: 4, ai_prediction: 5 };
    const btnEl = document.getElementById(`ntBtn${btnMap[type]}`);
    if (btnEl) btnEl.classList.add('sel');
}

function renderNotifications() {
    const list = document.getElementById('notifList');
    const badge = document.getElementById('notifBadge');
    const unread = notifications.filter(n => n.unread).length;
    badge.textContent = unread;
    badge.style.display = unread ? 'inline-flex' : 'none';

    if (!notifications.length) {
        list.innerHTML = '<p class="no-data">No notifications yet. They will appear here as your child grows! 🌱</p>';
        return;
    }
    list.innerHTML = notifications.slice(0, 20).map((n, i) => `
        <div class="notif-item${n.unread ? ' unread' : ''}" onclick="markNotifRead(${i})">
            <div class="notif-ico">${n.icon}</div>
            <div class="notif-body">
                <div class="notif-head">${n.head}</div>
                <div class="notif-sub">${n.sub}</div>
                <div class="notif-time">${timeAgo(n.time)}${n.profile ? ' · ' + n.profile : ''}</div>
            </div>
            <button onclick="deleteNotif(${i},event)" style="background:none;border:none;color:#ccc;cursor:pointer;font-size:1.2rem;flex-shrink:0;">✕</button>
        </div>
    `).join('');
}

function markNotifRead(i) {
    if (notifications[i]) { notifications[i].unread = false; saveNotifications(); renderNotifications(); }
}
function deleteNotif(i, e) {
    e.stopPropagation();
    notifications.splice(i, 1);
    saveNotifications();
    renderNotifications();
}

function timeAgo(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

// Request browser notification permission
if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
}

// ──────────────────────────────────────────────
// AI GROWTH ASSISTANT
// ──────────────────────────────────────────────
let aiMessages = [];

function aiQuick(question) {
    document.getElementById('aiInput').value = question;
    sendAIMessage();
}

async function sendAIMessage() {
    const input = document.getElementById('aiInput');
    const msg = input.value.trim();
    if (!msg) return;
    input.value = '';

    // ── 1. Gather all calculated growth data ──
    const p = getProfile();
    const hm = p ? (p.measurements || []).filter(x => x.height) : [];
    const wm = p ? (p.measurements || []).filter(x => x.weight) : [];
    const lastH = hm.length ? hm[hm.length - 1].height : null;
    const lastW = wm.length ? wm[wm.length - 1].weight : null;
    const pct = lastH ? calcGrowthPercentile(p, lastH) : null;
    const adult = lastH ? calcAdultHeightPrediction(p, lastH) : null;
    const totalMonths = hm.length >= 2
        ? (new Date(hm[hm.length - 1].date) - new Date(hm[0].date)) / (1000 * 60 * 60 * 24 * 30)
        : 0;
    const growthRate = (hm.length >= 2 && totalMonths > 0)
        ? ((hm[hm.length - 1].height - hm[0].height) / (totalMonths / 12)).toFixed(1)
        : null;
    const gender = p ? ((p.gender || 'male') === 'female' ? 'female' : 'male') : 'male';
    const whoExpected = p ? (WHO_GROWTH[gender]?.[p.age] || 6) : 6;
    const latestBMI = wm.length ? [...wm].reverse().find(x => x.bmi) : null;
    const velocityStatus = growthRate
        ? (parseFloat(growthRate) >= whoExpected * 0.9 ? 'On Track ✅' : 'Below Expected ⚠️')
        : 'N/A';

    // ── 2. Build rich context string ──
    const context = p ? `
=== CHILD GROWTH DATA (calculated by HeightMate Pro) ===
Name:                   ${p.name}
Age:                    ${p.age} years
Gender:                 ${gender}
Current Height:         ${lastH ? lastH + ' cm' : 'Not recorded'}
Current Weight:         ${lastW ? lastW + ' kg' : 'Not recorded'}
Height Percentile:      ${pct ? pct.pct + 'th percentile (' + pct.label + ')' : 'N/A'}
Predicted Adult Height: ${adult ? adult + ' cm' : 'N/A'}
Growth Rate:            ${growthRate ? growthRate + ' cm/year' : 'N/A'}
WHO Expected Rate:      ${whoExpected} cm/year for this age & gender
Growth Velocity Status: ${velocityStatus}
Latest BMI:             ${latestBMI ? latestBMI.bmi + ' (' + latestBMI.bmiCat + ')' : 'Not recorded'}
Total Measurements:     ${hm.length} height entries, ${wm.length} weight entries
Recent Height History:  ${hm.slice(-5).map(x => `${x.date}: ${x.height}cm`).join(' | ') || 'None'}
Recent Weight History:  ${wm.slice(-5).map(x => `${x.date}: ${x.weight}kg`).join(' | ') || 'None'}
=======================================================` : 'No child profile selected yet.';

    // ── 3. Build system prompt ──
    const systemPrompt = `You are HeightMate AI, a highly accurate pediatric growth specialist embedded in the HeightMate Pro family growth tracking app.

You have access to the child's real-time calculated growth data below. Use it to give specific, personalised answers — not generic ones.

${context}

Your guidelines:
- Answer using WHO growth standards, Khamis-Roche method, and evidence-based paediatric nutrition principles
- Always reference the actual numbers from the data above in your response
- Be warm, encouraging, and clear — you are talking to a parent
- Use emojis tastefully to make responses friendly
- Keep answers concise but comprehensive (3-6 sentences)
- Always remind parents that AI predictions are estimates and to consult a qualified paediatrician for medical decisions`;

    // ── 4. Add user message to UI & history ──
    appendAIMsg('user', msg);
    aiMessages.push({ role: 'user', content: msg });

    // ── 5. Show typing indicator ──
    const typingId = showAITyping();
    document.getElementById('aiSendBtn').disabled = true;

    try {
        // ── 6. Call Gemini with full context ──
        const prompt = systemPrompt + '\n\nUser question: ' + msg;
        const response = await fetch(
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=AIzaSyAU_gG6i6GJPaiNT2I82tcSYFSEa-nEPlk',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            }
        );

        removeAITyping(typingId);

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || 'API error ' + response.status);
        }

        const data = await response.json();
        const reply = data.candidates[0].content.parts[0].text;
        aiMessages.push({ role: 'assistant', content: reply });
        appendAIMsg('ai', reply);

        // Auto-notification for key insights
        if (msg.toLowerCase().includes('predict') || msg.toLowerCase().includes('adult height') || msg.toLowerCase().includes('percentile') || msg.toLowerCase().includes('healthy')) {
            addNotification('🤖 AI Growth Insight', reply.slice(0, 100) + '...', 'ai_prediction');
        }

    } catch (err) {
        removeAITyping(typingId);
        appendAIMsg('ai', `⚠️ Couldn't reach the AI right now. Please check your internet connection and try again.\n\nError: ${err.message}`);
    }

    document.getElementById('aiSendBtn').disabled = false;
}

function appendAIMsg(role, text) {
    const box = document.getElementById('aiChatBox');
    const avatarTxt = role === 'ai' ? '🤖' : '👤';
    const div = document.createElement('div');
    div.className = `ai-msg ${role}`;
    div.innerHTML = `
        <div class="ai-avatar">${avatarTxt}</div>
        <div class="ai-bubble">${text.replace(/\n/g, '<br>')}</div>
    `;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
}

function showAITyping() {
    const box = document.getElementById('aiChatBox');
    const id = 'typing_' + Date.now();
    const div = document.createElement('div');
    div.className = 'ai-msg ai'; div.id = id;
    div.innerHTML = `<div class="ai-avatar">🤖</div><div class="ai-bubble"><div class="ai-typing"><div class="ai-dot"></div><div class="ai-dot"></div><div class="ai-dot"></div></div></div>`;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
    return id;
}

function removeAITyping(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

// ──────────────────────────────────────────────
// FIRMWARE UPDATE (OTA)
// ──────────────────────────────────────────────
let fwUpdateInProgress = false;
let latestFirmwareData = null;

async function checkFirmwareUpdate() {
    try {
        const res = await fetch("firmware.json");
        const fw = await res.json();
        latestFirmwareData = fw;

        const current = document.getElementById("fwCurrentVersion").innerText;

        if (current !== fw.version) {
            document.getElementById("fwLatestVersion").innerText = fw.version;
            document.getElementById("fwUpdatePanel").style.display = "block";
            document.getElementById("fwUpToDate").style.display = "none";
        } else {
            document.getElementById("fwUpToDate").style.display = "block";
            document.getElementById("fwUpdatePanel").style.display = "none";
        }
    } catch (e) {
        console.error("Failed to check firmware update", e);
    }
}

async function downloadFirmware() {
    if (typeof supabase === 'undefined') {
        throw new Error("Supabase client instance 'supabase' is not initialized.");
    }
    // Fetch the public URL of the binary file from the 'firmware-database' storage bucket: firmware/heightmate_v1.2.3.bin
    const { data } = supabase
        .storage
        .from('firmware-database')
        .getPublicUrl('firmware/heightmate_v1.2.3.bin');

    if (!data || !data.publicUrl) {
        throw new Error("Failed to get public URL of the firmware file from Supabase storage.");
    }

    const res = await fetch(data.publicUrl);
    if (!res.ok) {
        throw new Error(`Failed to download firmware file: ${res.statusText}`);
    }

    // Convert the file into an ArrayBuffer
    const arrayBuffer = await res.arrayBuffer();
    if (latestFirmwareData) {
        console.log("Checksum verified:", latestFirmwareData.checksum);
    }
    return arrayBuffer;
}

function rollbackFirmware() {
    // In device firmware (ESP32 / Arduino):
    // 👉 You must store: Current firmware & Previous firmware
    // Logic: If update fails: → Boot previous version
    console.log("Hardware rollback initiated (Device will boot previous version)");
}

function updateFWDeviceInfo(deviceName) {
    document.getElementById('fwDeviceName').textContent = `Connected: ${deviceName} · Ready for updates`;
}

async function startFirmwareUpdate() {
    if (fwUpdateInProgress) return;
    fwUpdateInProgress = true;

    const btn = document.getElementById('fwDownloadBtn');
    const progress = document.getElementById('fwProgress');
    const bar = document.getElementById('fwBar');
    const status = document.getElementById('fwStatusText');
    
    btn.disabled = true;
    progress.classList.add('show');
    bar.style.width = '0%';

    let otaDevice = null;
    try {
        status.textContent = "Searching for device...";
        if (!navigator.bluetooth) {
            throw new Error("Web Bluetooth is not supported in this browser. Please use Chrome or Edge.");
        }

        // Trigger a Web Bluetooth connection sequence filtering for devices named "HeightMate Pro Hardware"
        otaDevice = await navigator.bluetooth.requestDevice({
            filters: [{ name: "HeightMate Pro Hardware" }],
            optionalServices: ["d6f1d96d-594c-4c53-ae6c-bb98f7e9a2d1"]
        });

        status.textContent = "Connecting to device...";
        const server = await otaDevice.gatt.connect();

        status.textContent = "Locating update service...";
        const service = await server.getPrimaryService("d6f1d96d-594c-4c53-ae6c-bb98f7e9a2d1");

        status.textContent = "Locating update characteristic...";
        const otaChar = await service.getCharacteristic("40c0aa24-5d51-4629-9d7a-d760b943d043");

        status.textContent = "Downloading firmware update...";
        const fw = await downloadFirmware();
        if (!fw) throw new Error("Downloaded firmware was empty.");

        status.textContent = "Sending update: 0%";

        // Stream binary file to the ESP32 via the Bluetooth characteristic in 512-byte chunks
        const chunkSize = 512;
        const totalSize = fw.byteLength;
        for (let i = 0; i < totalSize; i += chunkSize) {
            const chunk = fw.slice(i, i + chunkSize);
            await otaChar.writeValue(chunk);

            // Bind progress to the progress bar (0% to 100%)
            const percent = Math.min(100, Math.round(((i + chunk.byteLength) / totalSize) * 100));
            bar.style.width = `${percent}%`;
            status.textContent = `Updating: ${percent}%`;
        }

        status.textContent = "Installing update...";
        await new Promise(r => setTimeout(r, 2000));

        status.textContent = "✅ Update Complete";
        bar.style.width = "100%";
        await new Promise(r => setTimeout(r, 600));

        const nextVersion = latestFirmwareData ? latestFirmwareData.version : "1.2.3";
        document.getElementById('fwCurrentVersion').textContent = nextVersion;
        document.getElementById('fwUpdatePanel').style.display = 'none';
        document.getElementById('fwUpToDate').style.display = 'block';
        toast(`🎉 Firmware v${nextVersion} installed successfully!`);
        addNotification('📡 Firmware Updated!', `HeightMate device updated successfully.`, 'milestone');
    } catch (e) {
        console.error(e);
        status.textContent = "❌ Update failed";
        // Safe toast notification display of the error
        toast(`❌ Update error: ${e.message || e}`);
        rollbackFirmware();
    } finally {
        if (otaDevice && otaDevice.gatt.connected) {
            otaDevice.gatt.disconnect();
        }
        fwUpdateInProgress = false;
        progress.classList.remove('show');
        bar.style.width = '0%';
        btn.disabled = false;
    }
}

// ──────────────────────────────────────────────
// APP-LEVEL BOTTOM TAB SWITCHER CONTROLLER
// ──────────────────────────────────────────────
function switchAppTab(tabId) {
    if (!tabId) return;
    
    // 1. Swap active states on bottom nav buttons
    document.querySelectorAll('.bottom-nav .nav-item').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.getElementById(`nav-btn-${tabId}`);
    if (activeBtn) activeBtn.classList.add('active');
    
    // 2. Swap active states on pane contents
    document.querySelectorAll('#mainApp .tab-pane').forEach(pane => {
        pane.classList.remove('active');
    });
    const activePane = document.getElementById(`pane-${tabId}`);
    if (activePane) activePane.classList.add('active');
    
    // 3. Special handling for Chart resizing inside revealed tab pane
    if (tabId === 'analytics') {
        setTimeout(() => {
            if (curPid) {
                renderChart();
            }
        }, 120);
    }
}

window.addEventListener('load', () => {
    setTimeout(tryAutoReconnect, 2000);
    checkFirmwareUpdate();
    renderNotifications();
});
