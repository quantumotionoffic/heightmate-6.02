function renderProfiles() {
    const COLORS = [['#FF6B6B', '#FFA500'], ['#4ECDC4', '#44A08D'], ['#9B59B6', '#E74C3C'], ['#3498DB', '#2ECC71'], ['#F39C12', '#E67E22']];
    const grid = document.getElementById('profileGrid');
    grid.innerHTML = profiles.map((p, i) => {
        const c = COLORS[i % COLORS.length];
        const gIcon = p.gender === 'male' ? '👦' : p.gender === 'female' ? '👧' : '🧒';
        return `<div class="pcard${p.id === curPid ? ' active' : ''}" onclick="selectProfile('${p.id}')"
            style="background:linear-gradient(135deg,${p.color1 || c[0]},${p.color2 || c[1]})">
            <div class="av">${p.avatar || gIcon}</div>
            <div class="pname">${p.name}</div>
            <div class="pmeta">${p.age} yrs ${p.gender ? gIcon : ''}</div>
            <div class="pbadge">${p._count || 0} measurements</div>
            <div class="p-acts">
                <button class="p-act" onclick="openEditModal('${p.id}',event)">✏️</button>
                <button class="p-act del" onclick="openDelModal('${p.id}',event)">🗑️</button>
            </div>
        </div>`;
    }).join('') + `<div class="pcard add-pcard" onclick="openAddModal()"><div>➕</div><div style="font-size:1rem;margin-top:5px;font-weight:600;">Add Kid</div></div>`;
}

async function selectProfile(pid) {
    curPid = pid;
    renderProfiles();
    await loadMeasurements();
}

async function saveProfile() {
    const name = V('pName'), age = parseInt(V('pAge')), birth = V('pBirth'), gender = V('pGender');
    const av = document.querySelector('#avGrid .av-opt.sel');
    if (!name || !age || !av) { alert('Please fill name, age and choose an avatar! 😊'); return; }
    spin(true);
    try {
        const COLS = [['#FF6B6B', '#FFA500'], ['#4ECDC4', '#44A08D'], ['#9B59B6', '#E74C3C'], ['#3498DB', '#2ECC71'], ['#F39C12', '#E67E22']];
        const c = COLS[Math.floor(Math.random() * COLS.length)];
        if (isGuest) {
            const newP = { id: guestId(), name, age, birth, gender, avatar: av.textContent.trim(), color1: c[0], color2: c[1], measurements: [], _count: 0 };
            profiles.push(newP);
            saveGuestData();
            closeAddModal();
            renderProfiles();
            curPid = newP.id;
            renderProfiles();
            updateDisplay();
            if (cfg.confetti) doConfetti();
        } else {
            const ref = await db.collection('families').doc(familyId).collection('profiles').add({
                name, age, birth, gender, avatar: av.textContent.trim(),
                color1: c[0], color2: c[1],
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            closeAddModal();
            await loadProfiles();
            await selectProfile(ref.id);
            if (cfg.confetti) doConfetti();
        }
    } catch (e) { console.error(e); alert('Error creating profile.'); }
    finally { spin(false); }
}

async function updateProfile() {
    const name = V('eName'), age = parseInt(V('eAge')), birth = V('eBirth'), gender = V('eGender');
    const av = document.querySelector('#eAvGrid .av-opt.sel');
    if (!name || !age || !av) { alert('Please fill name, age and choose an avatar! 😊'); return; }
    spin(true);
    try {
        if (isGuest) {
            const p = profiles.find(x => x.id === editPid);
            if (p) Object.assign(p, { name, age, birth, gender, avatar: av.textContent.trim() });
            saveGuestData();
            closeEditModal();
            renderProfiles();
            if (curPid === editPid) updateDisplay();
            toast('✅ Profile updated!');
        } else {
            await db.collection('families').doc(familyId).collection('profiles').doc(editPid).update({ name, age, birth, gender, avatar: av.textContent.trim() });
            closeEditModal();
            await loadProfiles();
            toast('✅ Profile updated!');
        }
    } catch (e) { console.error(e); alert('Error updating profile.'); }
    finally { spin(false); }
}

async function confirmDelete() {
    if (!delPid) return;
    spin(true);
    try {
        if (isGuest) {
            profiles = profiles.filter(x => x.id !== delPid);
            if (curPid === delPid) curPid = null;
            saveGuestData();
            closeDelModal();
            renderProfiles();
            if (curPid) updateDisplay(); else document.getElementById('histList').innerHTML = '<p class="no-data">Select a profile to see history.</p>';
            updateDashboard();
            toast('🗑️ Profile deleted.');
        } else {
            const snap = await db.collection('families').doc(familyId).collection('profiles').doc(delPid).collection('measurements').get();
            const batch = db.batch();
            snap.forEach(d => batch.delete(d.ref));
            await batch.commit();
            await db.collection('families').doc(familyId).collection('profiles').doc(delPid).delete();
            if (curPid === delPid) curPid = null;
            closeDelModal();
            await loadProfiles();
            toast('🗑️ Profile deleted.');
        }
    } catch (e) { console.error(e); alert('Error deleting profile.'); }
    finally { spin(false); }
}
