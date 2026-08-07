
const CustomDialog = {
    _overlay: null,
    _resolve: null,
    init() {
        this._overlay = document.getElementById('custom-dialog');
    },
    _getIconHtml(style) {
        const icons = {
            info: ['bg-blue-100','<svg class="w-7 h-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 110 20 10 10 0 010-20z"/></svg>'],
            success: ['bg-emerald-100','<svg class="w-7 h-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a10 10 0 11-20 0 10 10 0 0120 0z"/></svg>'],
            warning: ['bg-amber-100','<svg class="w-7 h-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01M10.29 3.86l-8.1 14c-.6 1.04.15 2.14 1.21 2.14h16.2c1.06 0 1.81-1.1 1.21-2.14l-8.1-14c-.6-1.04-1.82-1.04-2.42 0z"/></svg>'],
            error: ['bg-red-100','<svg class="w-7 h-7 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a10 10 0 11-20 0 10 10 0 0120 0z"/></svg>'],
            question: ['bg-purple-100','<svg class="w-7 h-7 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M12 2a10 10 0 110 20 10 10 0 010-20z"/></svg>']
        };
        const [bg, icon] = icons[style] || icons.info;
        return '<div class="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center text-2xl ' + bg + '">' + icon + '</div>';
    },
    async show({ title, message, type, style, confirmText, cancelText }) {
        type = type || 'alert'; style = style || 'info'; confirmText = confirmText || 'موافق'; cancelText = cancelText || 'إلغاء';
        const overlay = this._overlay;
        overlay.querySelector('#dialog-icon').innerHTML = this._getIconHtml(style);
        overlay.querySelector('#dialog-title').textContent = title || '';
        overlay.querySelector('#dialog-message').textContent = message || '';
        const btnContainer = overlay.querySelector('#dialog-buttons');
        const styleColors = { info: 'bg-blue-600 hover:bg-blue-700', success: 'bg-emerald-600 hover:bg-emerald-700', warning: 'bg-amber-600 hover:bg-amber-700', error: 'bg-red-600 hover:bg-red-700', question: 'bg-purple-600 hover:bg-purple-700' };
        const color = styleColors[style] || styleColors.info;
        return new Promise(resolve => {
            this._resolve = resolve;
            if (type === 'alert') {
                btnContainer.innerHTML = '<button class="flex-1 ' + color + ' text-white py-2.5 rounded-xl text-sm font-medium shadow-md" id="dialog-ok-btn">' + confirmText + '</button>';
                overlay.querySelector('#dialog-ok-btn').onclick = function() { overlay.classList.add('hidden'); resolve(true); };
            } else if (type === 'confirm') {
                btnContainer.innerHTML = '<button class="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium" id="dialog-cancel-btn">' + cancelText + '</button><button class="flex-1 ' + color + ' text-white py-2.5 rounded-xl text-sm font-medium shadow-md" id="dialog-confirm-btn">' + confirmText + '</button>';
                overlay.querySelector('#dialog-confirm-btn').onclick = function() { overlay.classList.add('hidden'); resolve(true); };
                overlay.querySelector('#dialog-cancel-btn').onclick = function() { overlay.classList.add('hidden'); resolve(false); };
            }
            overlay.classList.remove('hidden');
            if (type === 'alert') overlay.querySelector('#dialog-ok-btn').focus();
        });
    },
    async alert(message, title) { return this.show({ title: title || '', message: message || '', type: 'alert', style: 'info' }); },
    async success(message, title) { return this.show({ title: title || '', message: message || '', type: 'alert', style: 'success' }); },
    async error(message, title) { return this.show({ title: title || '', message: message || '', type: 'alert', style: 'error' }); },
    async confirm(message, title) { return this.show({ title: title || 'تأكيد', message: message || '', type: 'confirm', style: 'question', confirmText: 'نعم', cancelText: 'إلغاء' }); }
};
CustomDialog.init();
window.alert = function(m) { CustomDialog.alert(m); };

let currentStep = 0;
let photoBase64 = '';

function checkPasswordStrength(pw) {
  const bar = document.getElementById('pw-bar');
  let score = 0;
  if (pw.length >= 8) score += 25;
  if (pw.match(/[a-z]/)) score += 15;
  if (pw.match(/[A-Z]/)) score += 15;
  if (pw.match(/[0-9]/)) score += 15;
  if (pw.match(/[^a-zA-Z0-9]/)) score += 15;
  if (pw.length >= 12) score += 15;
  const colors = ['#ef4444','#f97316','#eab308','#22c55e','#10b981','#059669'];
  bar.style.width = Math.min(score, 100) + '%';
  bar.style.background = colors[Math.min(Math.floor(score / 17), 5)];
  const hints = ['ضعيفة جداً','ضعيفة','متوسطة','جيدة','قوية','قوية جداً'];
  document.getElementById('pw-hint').textContent = score > 60 ? '✅ ' + hints[Math.min(Math.floor(score / 17), 5)] : 'استخدم حروف كبيرة وصغيرة وأرقام ورموز';
}

function checkPasswordMatch() {
  const p1 = document.getElementById('s-password').value;
  const p2 = document.getElementById('s-password2').value;
  const el = document.getElementById('pw-match');
  if (!p2) { el.textContent = ''; return; }
  el.textContent = p1 === p2 ? '✅ كلمتا المرور متطابقتان' : '❌ كلمتا المرور غير متطابقتين';
  el.style.color = p1 === p2 ? '#10b981' : '#ef4444';
}

function previewPhoto(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(ev) {
    document.getElementById('photo-preview').src = ev.target.result;
    document.getElementById('photo-preview').classList.remove('hidden');
    document.getElementById('photo-placeholder').classList.add('hidden');
    photoBase64 = ev.target.result;
  };
  reader.readAsDataURL(file);
}

function showStep(n) {
  document.querySelectorAll('.step-content').forEach(el => el.classList.remove('active'));
  document.getElementById('step-' + n).classList.add('active');
  document.querySelectorAll('.step-dot').forEach((el, i) => {
    el.classList.remove('active', 'done');
    if (i < n) el.classList.add('done');
    if (i === n) el.classList.add('active');
  });
  currentStep = n;
}

function validateStep(n) {
  if (n === 0) {
    const u = document.getElementById('s-username').value.trim();
    const p1 = document.getElementById('s-password').value;
    const p2 = document.getElementById('s-password2').value;
    if (!u) { alert('يرجى إدخال اسم المستخدم'); return false; }
    if (u.length < 3) { alert('اسم المستخدم يجب أن يكون 3 أحرف على الأقل'); return false; }
    if (!/^[a-zA-Z0-9_\u0600-\u06FF]+$/.test(u)) { alert('اسم المستخدم غير صالح (حروف وأرقام فقط)'); return false; }
    if (p1.length < 8) { alert('كلمة المرور يجب أن تكون 8 أحرف على الأقل'); return false; }
    if (p1 !== p2) { alert('كلمتا المرور غير متطابقتين'); return false; }
    return true;
  }
  if (n === 1) {
    const email = document.getElementById('s-email').value.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { alert('البريد الإلكتروني غير صالح'); return false; }
    return true;
  }
  return true;
}

function nextStep(n) {
  if (!validateStep(currentStep)) return;
  if (n === 3) {
    document.getElementById('confirm-username').textContent = document.getElementById('s-username').value.trim();
    document.getElementById('confirm-email').textContent = document.getElementById('s-email').value.trim() || '(بدون بريد)';
    document.getElementById('confirm-phone').textContent = document.getElementById('s-phone').value.trim() || '(بدون هاتف)';
    document.getElementById('confirm-city').textContent = document.getElementById('s-city').value.trim() || '(بدون مدينة)';
    const pw = document.getElementById('s-password').value;
    const score = Math.min(Math.floor(
      ((pw.length >= 8 ? 25 : 0) + (pw.match(/[a-z]/) ? 15 : 0) + (pw.match(/[A-Z]/) ? 15 : 0) + (pw.match(/[0-9]/) ? 15 : 0) + (pw.match(/[^a-zA-Z0-9]/) ? 15 : 0) + (pw.length >= 12 ? 15 : 0)) / 17
    ), 5);
    const labels = ['ضعيفة جداً','ضعيفة','متوسطة','جيدة','قوية','قوية جداً'];
    document.getElementById('confirm-pw').textContent = labels[score];
    if (photoBase64) document.getElementById('confirm-avatar').innerHTML = '<img src="' + photoBase64 + '" class="w-full h-full rounded-full object-cover">';
  }
  showStep(n);
}

function prevStep(n) { showStep(n); }

async function submitSetup() {
  const btn = document.getElementById('submit-btn');
  const txt = document.getElementById('submit-text');
  const loading = document.getElementById('submit-loading');
  btn.disabled = true;
  txt.classList.add('hidden');
  loading.classList.remove('hidden');

  try {
    const formData = new FormData();
    formData.append('username', document.getElementById('s-username').value.trim());
    formData.append('password', document.getElementById('s-password').value);
    formData.append('email', document.getElementById('s-email').value.trim());
    formData.append('phone', document.getElementById('s-phone').value.trim());
    formData.append('city', document.getElementById('s-city').value.trim());
    if (document.getElementById('photo-input').files[0]) {
      formData.append('photo', document.getElementById('photo-input').files[0]);
    }

    const r = await fetch('/api/setup/admin', { method: 'POST', body: formData });
    const d = await r.json();
    if (d.success) {
      loading.textContent = '✅ تم إنشاء الحساب! جاري التوجيه...';
      setTimeout(function() { window.location.href = '/admin.html'; }, 1500);
    } else {
      alert('❌ ' + d.message);
      btn.disabled = false;
      txt.classList.remove('hidden');
      loading.classList.add('hidden');
    }
  } catch(e) {
    alert('❌ خطأ في الاتصال: ' + e.message);
    btn.disabled = false;
    txt.classList.remove('hidden');
    loading.classList.add('hidden');
  }
}
