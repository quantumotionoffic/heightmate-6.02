async function loadFamily() {
    spin(true);
    try {
        familyId = user.uid;
        const doc = await db.collection('families').doc(familyId).get();
        if (doc.exists) setFamilyName(doc.data().familyName);
        await loadProfiles();
    } catch (e) { console.error(e); alert('Error loading data. Please refresh.'); }
    finally { spin(false); }
}

async function loadProfiles() {
    if (isGuest) { loadGuestData(); return; }
    const snap = await db.collection('families').doc(familyId).collection('profiles').orderBy('createdAt', 'asc').get();
    profiles = [];
    snap.forEach(d => profiles.push({ id: d.id, ...d.data() }));

    // Load measurement counts per profile from Firestore
    await Promise.all(profiles.map(async p => {
        const ms = await db.collection('families').doc(familyId).collection('profiles').doc(p.id).collection('measurements').get();
        p._count = ms.size;
    }));

    renderProfiles();
    if (profiles.length > 0 && !curPid) await selectProfile(profiles[0].id);
    else if (curPid) await selectProfile(curPid);
    updateDashboard();
}

async function loadMeasurements() {
    if (!curPid) return;
    if (isGuest) { updateDisplay(); return; }
    const snap = await db.collection('families').doc(familyId).collection('profiles').doc(curPid).collection('measurements').orderBy('timestamp', 'asc').get();
    const p = getProfile();
    if (!p) return;
    p.measurements = [];
    snap.forEach(d => p.measurements.push({ id: d.id, ...d.data() }));
    p._count = p.measurements.length;
    renderProfiles();
    updateDisplay();
}

async function saveMeasurement(data) {
    if (!curPid) { alert('Please select a profile first! 👶'); return; }
    const p = getProfile();
    try {
        if (isGuest) {
            const entry = { ...data, age: p.age, id: guestId(), timestamp: new Date().toISOString() };
            if (!p.measurements) p.measurements = [];
            p.measurements.push(entry);
            p._count = p.measurements.length;
            saveGuestData();
            renderProfiles();
            updateDisplay();
            if (cfg.confetti) doConfetti();
            if (cfg.notif) toast(`📏 Measurement recorded for ${p.name}! 🎉`);
            checkMilestones(getProfile());
        } else {
            await db.collection('families').doc(familyId).collection('profiles').doc(curPid).collection('measurements').add({
                ...data,
                age: p.age,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            await loadMeasurements();
            if (cfg.confetti) doConfetti();
            if (cfg.notif) toast(`📏 Measurement recorded for ${p.name}! 🎉`);
            checkMilestones(getProfile());
        }
    } catch (e) { console.error(e); alert('Error saving measurement.'); }
}
