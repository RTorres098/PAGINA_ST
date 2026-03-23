// Auth guard for admin modules
// Include after Firebase and config.js
// Redirects to /admin/ login if not authenticated or not admin/super_admin

function initAuthGuard(onReady) {
  const auth = firebase.auth();
  const db = firebase.firestore();

  // Show loading overlay
  const overlay = document.createElement('div');
  overlay.id = 'authOverlay';
  overlay.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#18403E"><div style="text-align:center;color:rgba(255,255,255,0.5);font-size:13px"><div style="width:28px;height:28px;border:3px solid rgba(255,255,255,0.15);border-top-color:#34A678;border-radius:50%;animation:spin .6s linear infinite;margin:0 auto 10px"></div>Verificando acceso...</div></div>';
  const style = document.createElement('style');
  style.textContent = '@keyframes spin{to{transform:rotate(360deg)}}';
  document.head.appendChild(style);
  document.body.prepend(overlay);

  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = '../';
      return;
    }

    try {
      const doc = await db.collection('usuarios').doc(user.uid).get();
      if (!doc.exists) { window.location.href = '../'; return; }

      const data = doc.data();
      const rol = data.rol || 'operativo';

      if (rol !== 'super_admin' && rol !== 'admin') {
        window.location.href = '../';
        return;
      }

      // Access granted - remove overlay and call callback
      overlay.remove();
      if (onReady) onReady(user, data, rol);
    } catch (e) {
      console.error('Auth guard error:', e);
      window.location.href = '../';
    }
  });
}
