function swapAuth() {
    const lf = document.getElementById('loginForm');
    const sf = document.getElementById('signupForm');
    const show = lf.style.display !== 'none';
    lf.style.display = show ? 'none' : 'block';
    sf.style.display = show ? 'block' : 'none';
    document.getElementById('authMsg').innerHTML = '';
}

async function doLogin() {
    const e = V('lEmail'), p = V('lPass');
    if (!e || !p) { authMsg('Please fill in all fields!', 'err'); return; }
    spin(true);
    try { await auth.signInWithEmailAndPassword(e, p); }
    catch (err) { authMsg(authErrMsg(err.code), 'err'); }
    finally { spin(false); }
}

async function doSignup() {
    const fn = V('sFamily'), e = V('sEmail'), p = V('sPass');
    if (!fn || !e || !p) { authMsg('Please fill in all fields!', 'err'); return; }
    if (p.length < 6) { authMsg('Password must be at least 6 characters!', 'err'); return; }
    spin(true);
    try {
        const c = await auth.createUserWithEmailAndPassword(e, p);
        await db.collection('families').doc(c.user.uid).set({ familyName: fn, email: e, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    } catch (err) { authMsg(authErrMsg(err.code), 'err'); }
    finally { spin(false); }
}

async function doLogout() {
    if (!confirm('Are you sure you want to logout?')) return;
    if (btDevice?.gatt?.connected) await btDevice.gatt.disconnect();
    if (isGuest) {
        isGuest = false;
        user = null; familyId = null; profiles = []; curPid = null;
        showLogin();
        return;
    }
    await auth.signOut();
}

function authMsg(msg, type) {
    const el = document.getElementById('authMsg');
    el.innerHTML = `<div class="auth-msg ${type}">${msg}</div>`;
    setTimeout(() => el.innerHTML = '', 5000);
}

function authErrMsg(code) {
    return ({
        'auth/email-already-in-use': 'This email is already registered!',
        'auth/invalid-email': 'Invalid email address!',
        'auth/weak-password': 'Password is too weak!',
        'auth/user-not-found': 'No account found with this email!',
        'auth/wrong-password': 'Incorrect password!',
        'auth/invalid-credential': 'Invalid email or password!',
        'auth/operation-not-supported-in-this-environment': 'Google Sign-In is not supported when running the app directly as a local file (file:// protocol). Please use Guest Login, or run the app on a local web server (like localhost) to sign in with Google!',
        'auth/popup-blocked': 'Popup was blocked by your browser! Please allow popups for this site and try again.',
        'auth/popup-closed-by-user': 'The sign-in popup was closed before completion. Please try again!'
    })[code] || 'An error occurred. Please try again!';
}
