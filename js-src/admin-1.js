
        function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
        function jsStr(s) { return JSON.stringify(String(s == null ? '' : s)).replace(/"/g, '&quot;'); }
        function safeUrl(u) { try { var p = new URL(String(u), window.location.href); return (p.protocol === 'http:' || p.protocol === 'https:') ? p.href : ''; } catch (e) { return ''; } }
        function escAttrPath(p) { return esc(p); }
        // التحقق من الإعداد الأولي (اختياري)
        var setupChecked = false;
        fetch('/api/setup/check').then(function(r) { return r.json(); }).then(function(d) {
            if (d.success && !d.setup_done) {
                if (!confirm('لم يتم إنشاء حساب المشرف بعد. هل تريد الذهاب إلى صفحة الإعداد الأولي؟\n\n(اختر "موافق" للذهاب إلى الإعداد، أو "إلغاء" لتجاهل الرسالة)')) {
                    setupChecked = true;
                } else {
                    window.location.href = '/setup.html';
                }
            } else {
                setupChecked = true;
            }
        }).catch(function() { setupChecked = true; });

        let API_TOKEN = '';
        let isLoggedIn = false;
        let vendorsData = [];

        // ===== تسجيل الدخول =====
        function adminLogin() {
            const u = document.getElementById('admin-username').value;
            const p = document.getElementById('admin-password').value;
            fetch('/api/vendor/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: u, password: p })
            }).then(r => r.json()).then(data => {
                if (data.success && data.vendor.is_admin) {
                    isLoggedIn = true;
                    API_TOKEN = 'Bearer ' + data.token;
                    sessionStorage.setItem('adminToken', data.token);
                    document.getElementById('login-screen').classList.add('hidden');
                    document.getElementById('dashboard').classList.remove('hidden');
                    document.getElementById('login-error').classList.add('hidden');
                    initNotifications();
                    checkNewOrders();
                    loadAllData();
                } else {
                    document.getElementById('login-error').classList.remove('hidden');
                    document.getElementById('login-error').textContent = 'بيانات دخول غير صحيحة للمشرف';
                }
            }).catch(() => {
                document.getElementById('login-error').classList.remove('hidden');
                document.getElementById('login-error').textContent = 'فشل الاتصال بالسيرفر';
            });
        }

        // تحقق من التوكن المحفوظ عند تحميل الصفحة
        (function checkAdminToken() {
            const storedToken = sessionStorage.getItem('adminToken');
            if (storedToken) {
                fetch('/api/vendor/verify-token', { headers: { 'x-auth-token': storedToken } })
                    .then(r => r.json()).then(d => {
                        if (d.valid && d.vendor.is_admin) {
                            isLoggedIn = true;
                            API_TOKEN = 'Bearer ' + storedToken;
                            document.getElementById('login-screen').classList.add('hidden');
                            document.getElementById('dashboard').classList.remove('hidden');
                            initNotifications();
                            checkNewOrders();
                            loadAllData();
                        } else {
                            sessionStorage.removeItem('adminToken');
                        }
                    }).catch(() => {});
            }
        })();

        function adminLogout() {
            const token = sessionStorage.getItem('adminToken');
            isLoggedIn = false;
            sessionStorage.removeItem('adminToken');
            if (token) fetch('/api/vendor/logout', { method: 'POST', headers: { 'x-auth-token': token } }).catch(() => {});
            document.getElementById('dashboard').classList.add('hidden');
            document.getElementById('login-screen').classList.remove('hidden');
        }

        // ===== التنقل =====
        const pageTitles = { overview: 'نظرة عامة', vendors: 'إدارة الحسابات', orders: 'المشتريات والمبيعات', reports: 'التقارير والإحصائيات', featured: 'العروض المميزة', pages: 'إدارة المحتوى', activity: 'سجل النشاطات', 'delete-requests': 'طلبات حذف الحسابات', 'contact-vendors': 'تواصل مع المزودين', complaints: 'الشكاوى', settings: 'الإعدادات' };
        function showSection(name) {
            document.querySelectorAll('.section-content').forEach(s => s.classList.add('hidden'));
            document.getElementById('section-' + name).classList.remove('hidden');
            document.querySelectorAll('.sidebar-link').forEach(b => b.classList.remove('active'));
            const btn = document.querySelector(`.sidebar-link[onclick="showSection('${name}')"]`);
            if (btn) btn.classList.add('active');
            const pt = document.getElementById('page-title');
            if (pt) pt.textContent = pageTitles[name] || name;
            if (name === 'reports') loadReports();
            if (name === 'featured') loadFeaturedSubs();
            if (name === 'activity') loadAdminActivityLog();
    if (name === 'delete-requests') loadDeleteRequests();
    if (name === 'complaints') loadComplaints();
    if (name === 'contact-vendors') loadContactVendors();
            if (name === 'settings') loadSettings();
            if (name === 'points-system') loadPointsSystem();
            if (name === 'views') loadViews();
            if (name === 'custom-assets') loadCustomAssets();
            if (name === 'admin-management') loadAdmins();
    closeSidebar();
        }

        function toggleSidebar() {
            const sidebar = document.getElementById('main-sidebar');
            const overlay = document.getElementById('sidebar-overlay');
            const isOpen = sidebar.classList.contains('translate-x-0');
            sidebar.classList.toggle('translate-x-0', !isOpen);
            sidebar.classList.toggle('translate-x-full', isOpen);
            overlay.classList.toggle('hidden', isOpen);
        }

        function closeSidebar() {
            const sidebar = document.getElementById('main-sidebar');
            const overlay = document.getElementById('sidebar-overlay');
            if (window.innerWidth < 1024) {
                sidebar.classList.remove('translate-x-0');
                sidebar.classList.add('translate-x-full');
                overlay.classList.add('hidden');
            }
        }

        // ===== تحميل البيانات =====
        function loadAllData() {
    loadStats();
    loadVendors();
    loadOrders();
    loadAdminActivityLog();
    loadDeleteRequests();
    loadComplaints();
}

        function updateClock() {
            const el = document.getElementById('live-time');
            if (el) el.textContent = new Date().toLocaleString('ar-SA');
        }
        setInterval(updateClock, 1000);

        function loadStats() {
            const statsSeq = (loadStats._seq = (loadStats._seq || 0) + 1);
            return fetch('/api/admin/stats', { headers: { 'Authorization': API_TOKEN } })
                .then(r => r.json()).then(d => {
                    if (statsSeq !== loadStats._seq || !d.success) return;
                    pendingVendorsCount = d.stats.pendingVendors;
                    document.getElementById('stat-vendors').textContent = d.stats.vendorsCount;
                    document.getElementById('stat-active').textContent = d.stats.activeVendors;
                    document.getElementById('stat-orders').textContent = d.stats.ordersCount;
                    document.getElementById('stat-revenue').textContent = d.stats.totalRevenue + ' د.ل';
                    document.getElementById('vendors-badge').textContent = d.stats.pendingVendors;
                    document.getElementById('orders-badge').textContent = d.stats.pendingOrders;
                    document.getElementById('stat-views').textContent = d.stats.totalViews || 0;
                    const vt = document.getElementById('vendors-total-badge');
                    if (vt) vt.textContent = d.stats.vendorsCount;
                    const ot = document.getElementById('orders-total-badge');
                    if (ot) ot.textContent = d.stats.ordersCount;
                    const ab = document.getElementById('awaiting-badge');
                    if (ab) {
                        const cnt = d.stats.awaitingVerification || 0;
                        if (cnt > 0) { ab.textContent = cnt + ' قيد التحقق'; ab.classList.remove('hidden'); }
                        else ab.classList.add('hidden');
                    }
                });
            // المزودون النشطون (مصغر)
            fetch('/api/admin/vendors', { headers: { 'Authorization': API_TOKEN } })
                .then(r => r.json()).then(d => {
                    if (!d.success) return;
                    const active = d.vendors.filter(v => v.status === 'active').slice(0, 4);
                    document.getElementById('top-vendors-mini').innerHTML = active.length ? active.map(v => `
                        <div class="flex items-center gap-3 p-2 bg-gray-50 rounded-xl hover:bg-gray-100 cursor-pointer" onclick="viewVendorDetails(${v.id})">
                            <div class="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">${esc((v.display_name || v.username || 'م')[0])}</div>
                            <div class="flex-1 min-w-0"><p class="text-sm font-medium text-black">${esc(v.display_name || v.fullname || v.username)}</p><p class="text-[10px] text-gray-400">${esc(v.email || '')}</p></div>
                            <span class="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">نشط</span>
                        </div>
                    `).join('') : '<p class="text-gray-400 text-sm text-center py-4">لا يوجد مزودون</p>';
                });
            // الطلبات المعلقة (مصغر)
            fetch('/api/admin/orders', { headers: { 'Authorization': API_TOKEN } })
                .then(r => r.json()).then(d => {
                    if (!d.success) return;
                    const pending = d.orders.filter(o => o.status === 'pending' || o.status === 'awaiting_verification').slice(0, 4);
                    document.getElementById('pending-orders-mini').innerHTML = pending.length ? pending.map(o => {
                        const iconBg = o.status === 'awaiting_verification' ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-600';
                        return `<div class="flex items-center gap-3 p-2 bg-gray-50 rounded-xl">
                            <div class="w-8 h-8 rounded-xl ${iconBg} flex items-center justify-center text-xs font-bold shrink-0">${esc((o.customer_name || 'ط')[0])}</div>
                            <div class="flex-1 min-w-0"><p class="text-sm font-medium text-black">${esc(o.subscription_name)}</p><p class="text-[10px] text-gray-400">${esc(o.customer_name)}</p></div>
                            <span class="text-xs font-bold">${o.amount} د.ل</span>
                        </div>`;
                    }).join('') : '<p class="text-gray-400 text-sm text-center py-4">لا توجد طلبات معلقة</p>';
                });
        }

        function loadVendors() {
            const seq = ++vendorsRefreshSeq;
            fetch('/api/admin/vendors', { headers: { 'Authorization': API_TOKEN } })
                .then(r => r.json()).then(d => {
                    if (seq !== vendorsRefreshSeq || !d.success) return;
                    vendorsData = d.vendors;
                    const pending = d.vendors.filter(v => v.status === 'pending');
                    const others = d.vendors.filter(v => v.status !== 'pending');

                    // عرض طلبات الانتظار
                    const pendingSection = document.getElementById('pending-vendors-section');
                    const pendingList = document.getElementById('pending-vendors-list');
                    document.getElementById('pending-count').textContent = pending.length;

                    if (pending.length > 0) {
                        pendingSection.classList.remove('hidden');
                        pendingList.innerHTML = pending.map(function(v) {
                            var photoHtml = v.photo_path ? '<img src="' + escAttrPath(v.photo_path) + '" class="w-14 h-14 rounded-2xl object-cover shadow-md shrink-0 cursor-pointer" onclick="window.open(' + jsStr(v.photo_path) + ',\'_blank\')" title="اضغط للتكبير">' : '<div class="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold shadow-md shrink-0">' + esc((v.display_name || 'م')[0]) + '</div>';
                            return '<div class="bg-white rounded-2xl border border-amber-200 shadow-sm p-4 sm:p-5 animate-fade-in"><div class="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">' + photoHtml + '<div class="flex-1 min-w-0 w-full sm:w-auto"><div class="flex flex-wrap items-center gap-2 mb-1"><h4 class="font-bold text-black text-sm sm:text-base truncate max-w-full">' + esc(v.display_name || v.username) + '</h4><span class="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">مزود جديد</span></div><p class="text-xs text-gray-500">' + esc(v.fullname || '') + ' · ' + esc(v.location || '') + ' · ' + (v.age ? esc(v.age) + ' سنة' : '') + '</p><div class="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-400"><span>📧 ' + esc(v.email || '-') + '</span><span>📞 ' + esc(v.phone || '-') + '</span><span>🔑 كلمة المرور: <span class="font-mono bg-gray-100 px-1.5 py-0.5 rounded" dir="ltr">' + esc(v.password) + '</span></span><span>🔗 ' + (v.social_link ? '<a href="' + safeUrl(v.social_link) + '" target="_blank" class="text-blue-600 hover:underline">رابط</a>' : '-') + '</span></div></div><div class="flex gap-2 sm:shrink-0 mt-3 sm:mt-0 w-full sm:w-auto"><button onclick="approveVendor(' + v.id + ', ' + jsStr(v.username) + ')" class="flex-1 sm:flex-none bg-emerald-500 hover:bg-emerald-600 text-white px-3 sm:px-4 py-2 rounded-xl text-xs font-medium shadow-sm flex items-center justify-center gap-1.5"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg><span class="hidden xs:inline">قبول</span></button><button onclick="showRejectModal(' + v.id + ', ' + jsStr(v.username) + ')" class="flex-1 sm:flex-none bg-red-50 hover:bg-red-100 text-red-600 px-3 sm:px-4 py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg><span class="hidden xs:inline">رفض</span></button></div></div></div>';
                        }).join('');
                    } else {
                        pendingSection.classList.add('hidden');
                    }

                    // الجدول العام
                    const tbody = document.getElementById('vendors-table-body');
                    tbody.innerHTML = others.map(function(v) {
                        var photoHtml = v.photo_path ? '<img src="' + v.photo_path + '" class="w-10 h-10 rounded-xl object-cover cursor-pointer shadow-sm" onclick="window.open(\'' + v.photo_path + '\',\'_blank\')" title="اضغط للتكبير">' : '<span class="text-gray-300 text-xs">—</span>';
                        var rejectReason = v.status === 'rejected' && v.rejected_reason ? '<span class="block text-[10px] text-red-400 mt-0.5">' + esc(v.rejected_reason) + '</span>' : '';
                        return '<tr class="border-b border-gray-50 hover:bg-gray-50/50"><td class="p-4 text-gray-400 text-xs">' + v.id + '</td><td class="p-4">' + photoHtml + '</td><td class="p-4 font-medium">' + esc(v.username) + '</td><td class="p-4 font-mono text-xs text-gray-500" dir="ltr">' + esc(v.password) + '</td><td class="p-4">' + esc(v.fullname || '-') + '</td><td class="p-4"><span class="bg-blue-50 text-blue-600 text-xs px-2 py-1 rounded-lg">' + esc(v.display_name || '-') + '</span></td><td class="p-4 text-gray-500 text-xs">' + esc(v.age || '-') + '</td><td class="p-4 text-gray-500 text-xs" dir="ltr">' + esc(v.phone || '-') + '</td><td class="p-4 text-gray-500 text-xs" dir="ltr">' + esc(v.email || '-') + '</td><td class="p-4 text-gray-500 text-xs">' + esc(v.location || '-') + '</td><td class="p-4"><span class="text-xs font-medium px-2.5 py-1 rounded-full ' + (v.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600') + '">' + (v.status === 'active' ? 'نشط' : 'مرفوض') + '</span>' + rejectReason + '</td><td class="p-4 text-gray-400 text-xs">' + new Date(v.created_at).toLocaleDateString('ar-SA') + '</td><td class="p-4 text-center"><div class="flex items-center justify-center gap-1"><button onclick="viewVendorDetails(' + v.id + ')" class="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600" title="عرض التفاصيل"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg></button><button onclick="toggleVendorStatus(' + v.id + ', \'' + (v.status === 'active' ? 'pending' : 'active') + '\')" class="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-blue-600" title="تغيير الحالة"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg></button><button onclick="deleteVendor(' + v.id + ')" class="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500" title="حذف"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button></div></td></tr>';
                    }).join('') || '<tr><td colspan="13" class="p-8 text-center text-gray-400">لا يوجد مزودين بعد</td></tr>';
                    // تحديث قائمة المزودين في مودال الطلب
                    const sel = document.getElementById('order-vendor');
                    sel.innerHTML = '<option value="">بدون مزود</option>' + d.vendors.filter(v => v.status === 'active').map(v => `<option value="${v.id}">${esc(v.display_name || v.username)}</option>`).join('');
                    loadStats();
                });
        }

        function viewVendorDetails(id) {
            const v = vendorsData.find(x => x.id === id);
            if (!v) return;
            const photoHtml = v.photo_path ? `<img src="${escAttrPath(v.photo_path)}" class="w-28 h-28 rounded-2xl object-cover shadow-md mx-auto mb-4" onclick="window.open(${jsStr(v.photo_path)},'_blank')" style="cursor:pointer">` : `<div class="w-28 h-28 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold text-3xl shadow-md mx-auto mb-4">${esc((v.display_name||'م')[0])}</div>`;
            const statusClass = v.status === 'active' ? 'bg-emerald-50 text-emerald-600' : v.status === 'pending' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600';
            const statusText = v.status === 'active' ? 'نشط' : v.status === 'pending' ? 'قيد الانتظار' : 'مرفوض';
            document.getElementById('vendor-detail-content').innerHTML = `
                <div class="text-center border-b border-gray-100 pb-5 mb-5">
                    ${photoHtml}
                    <h4 class="text-xl font-bold text-black">${esc(v.display_name || v.username)}</h4>
                    <p class="text-sm text-gray-500">@${esc(v.username)}</p>
                    <span class="inline-block mt-2 text-xs font-medium px-3 py-1 rounded-full ${statusClass}">${statusText}</span>
                    ${v.status === 'rejected' && v.rejected_reason ? `<p class="text-xs text-red-500 mt-2">سبب الرفض: ${esc(v.rejected_reason)}</p>` : ''}
                </div>
                <div class="space-y-3 text-sm">
                    <div class="flex justify-between py-2 border-b border-gray-50"><span class="text-gray-500">الاسم الكامل</span><span class="font-medium">${esc(v.fullname || '-')}</span></div>
                    <div class="flex justify-between py-2 border-b border-gray-50"><span class="text-gray-500">العمر</span><span class="font-medium">${esc(v.age ? v.age + ' سنة' : '-')}</span></div>
                    <div class="flex justify-between py-2 border-b border-gray-50"><span class="text-gray-500">مكان الإقامة</span><span class="font-medium">${esc(v.location || '-')}</span></div>
                    <div class="flex justify-between py-2 border-b border-gray-50"><span class="text-gray-500">البريد الإلكتروني</span><span class="font-medium" dir="ltr">${esc(v.email || '-')}</span></div>
                    <div class="flex justify-between py-2 border-b border-gray-50"><span class="text-gray-500">كلمة المرور</span><span class="font-medium font-mono text-xs" dir="ltr">${esc(v.password)}</span></div>
                    <div class="flex justify-between py-2 border-b border-gray-50"><span class="text-gray-500">رقم الهاتف</span><span class="font-medium" dir="ltr">${esc(v.phone || '-')}</span></div>
                    <div class="flex justify-between py-2 border-b border-gray-50"><span class="text-gray-500">رابط التواصل</span><span class="font-medium">${v.social_link ? `<a href="${safeUrl(v.social_link)}" target="_blank" class="text-blue-600 hover:underline">${esc(v.social_link)}</a>` : '-'}</span></div>
                    <div class="flex justify-between py-2 border-b border-gray-50"><span class="text-gray-500">تاريخ التسجيل</span><span class="font-medium">${new Date(v.created_at).toLocaleDateString('ar-SA') + ' ' + new Date(v.created_at).toLocaleTimeString('ar-SA')}</span></div>
                    <div class="flex justify-between py-2 border-b border-gray-50"><span class="text-gray-500">نسبة العمولة</span><span class="font-medium text-blue-600">${v.commission_rate !== null && v.commission_rate !== undefined ? v.commission_rate + '%' : 'عام (افتراضي)'}</span></div>
                    <div class="flex justify-between py-2"><span class="text-gray-500">حالة الحساب</span><span class="font-medium ${statusClass} px-2 py-0.5 rounded-lg text-xs">${statusText}</span></div>
                </div>
                ${v.status === 'active' && v.username !== 'admin' ? `
                <div class="mt-4 p-4 bg-gray-50 rounded-2xl">
                    <p class="text-xs font-bold text-gray-600 mb-2">تخصيص عمولة هذا المزود</p>
                    <div class="flex items-center gap-2">
                        <input type="number" id="vendor-commission-input" min="0" max="100" step="0.5" class="w-20 px-3 py-2 bg-white rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-600 text-sm outline-none text-center" placeholder="%" value="${v.commission_rate !== null && v.commission_rate !== undefined ? v.commission_rate : ''}">
                        <span class="text-sm text-gray-400">%</span>
                        <button onclick="saveVendorCommission(${v.id})" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-medium">حفظ</button>
                        <button onclick="resetVendorCommission(${v.id})" class="bg-gray-200 hover:bg-gray-300 text-gray-600 px-3 py-2 rounded-xl text-xs font-medium">إعادة تعيين</button>
                    </div>
                    <p class="text-[10px] text-gray-400 mt-2">اترك الحقل فارغاً لاستخدام النسبة العامة</p>
                </div>
                <div class="mt-4">
                    <p class="text-xs font-bold text-gray-600 mb-3">🔧 عمولات الاشتراكات (حسب الصنف والمدة)</p>
                    <div id="vendor-subs-commission" class="space-y-2">
                        <p class="text-[10px] text-gray-400 text-center py-3">جاري التحميل...</p>
                    </div>
                </div>
                <div class="mt-4 border-t border-gray-100 pt-4">
                    <p class="text-xs font-bold text-gray-600 mb-3">📋 نشاطات هذا المزود</p>
                    <div id="vendor-activity-log" class="max-h-40 overflow-y-auto space-y-1">
                        <p class="text-[10px] text-gray-400 text-center py-3">جاري التحميل...</p>
                    </div>
                </div>` : ''}
            `;
            document.getElementById('vendor-detail-modal').classList.remove('hidden');
            if (v.status === 'active' && v.username !== 'admin') { loadVendorSubsCommission(v.id); loadVendorActivityLog(id); }
        }

        function loadVendorActivityLog(vendorId) {
            fetch('/api/admin/vendors/' + vendorId + '/activity', { headers: { 'Authorization': API_TOKEN } })
                .then(r => r.json()).then(d => {
                    const container = document.getElementById('vendor-activity-log');
                    if (!d.success || !d.logs.length) {
                        container.innerHTML = '<p class="text-[10px] text-gray-400 text-center py-3">لا توجد نشاطات بعد</p>';
                        return;
                    }
                    const actionIcon = a => a.includes('حذف') ? '🗑️' : a.includes('إضافة') ? '➕' : a.includes('تعديل') ? '✏️' : a.includes('قبول') ? '✅' : a.includes('رفض') ? '❌' : a.includes('طلب') ? '📩' : '📋';
                    container.innerHTML = d.logs.map(l => `
                        <div class="flex items-start gap-2 py-1.5 border-b border-gray-50 last:border-0">
                            <span class="text-sm shrink-0">${actionIcon(l.action)}</span>
                            <div class="flex-1 min-w-0">
                                <p class="text-[11px] text-gray-700">${esc(l.details || l.action)}</p>
                                <p class="text-[9px] text-gray-400">${l.created_at || ''}</p>
                            </div>
                        </div>
                    `).join('');
                });
        }

        function loadVendorSubsCommission(vendorId) {
            fetch('/api/admin/subscriptions', { headers: { 'Authorization': API_TOKEN } })
                .then(r => r.json()).then(d => {
                    if (!d.success) return;
                    const vendorSubs = d.subscriptions.filter(s => s.v_id == vendorId);
                    const container = document.getElementById('vendor-subs-commission');
                    if (!vendorSubs.length) { container.innerHTML = '<p class="text-[10px] text-gray-400 text-center py-2">لا توجد اشتراكات لهذا المزود</p>'; return; }
                    container.innerHTML = vendorSubs.map(s => `
                        <div class="flex items-center gap-2 p-2 bg-white rounded-xl border border-gray-100">
                            <div class="flex-1 min-w-0">
                                <p class="text-xs font-medium text-black truncate">${esc(s.name)}</p>
                                <p class="text-[10px] text-gray-400">${s.duration || ''} · ${s.category_name || s.cat_name || ''}</p>
                            </div>
                            <input type="number" id="sub-comm-${s.id}" min="0" max="100" step="0.5" class="w-14 px-2 py-1 bg-gray-50 rounded-lg border-0 text-xs text-center font-bold" placeholder="%" value="${s.commission_rate !== null && s.commission_rate !== undefined ? s.commission_rate : ''}">
                            <span class="text-[10px] text-gray-400 w-4">%</span>
                            <button onclick="saveSubCommission(${s.id})" class="bg-blue-50 hover:bg-blue-100 text-blue-600 px-2 py-1 rounded-lg text-[10px] font-medium">حفظ</button>
                        </div>
                    `).join('');
                });
        }

        function saveSubCommission(id) {
            const val = document.getElementById('sub-comm-' + id).value;
            const rate = val === '' ? null : parseFloat(val);
            fetch('/api/admin/subscriptions/' + id + '/commission', { method: 'POST', headers: { 'Authorization': API_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ rate }) })
                .then(r => r.json()).then(d => { if (d.success) CustomDialog.success(d.message); else CustomDialog.error(d.message); });
        }

        // ====== العروض المميزة ======
        function loadFeaturedSubs() {
            fetch('/api/admin/subscriptions', { headers: { 'Authorization': API_TOKEN } })
                .then(r => r.json()).then(d => {
                    const tbody = document.getElementById('featured-table-body');
                    if (!d.success || !d.subscriptions.length) {
                        tbody.innerHTML = '<tr><td colspan="7" class="p-6 text-center text-gray-400 text-sm">لا توجد اشتراكات مسجلة</td></tr>';
                        return;
                    }
                    tbody.innerHTML = d.subscriptions.map(s => `
                        <tr class="border-b border-gray-50">
<td class="p-3 text-xs font-medium">${esc(s.name)}</td>
                <td class="p-3 text-xs text-gray-500">${esc(s.vendor_name || '-')}</td>
                            <td class="p-3 text-xs text-gray-500">${s.cat_name || '-'}</td>
                            <td class="p-3 text-xs font-bold">${s.price} د.ل</td>
                            <td class="p-3">
                                <input type="number" id="fp-${s.id}" min="0" step="0.5" class="w-20 px-2 py-1 bg-gray-50 rounded-lg border-0 text-xs text-center font-bold" placeholder="سعر" value="${s.featured_price || ''}" ${s.is_featured ? '' : 'disabled'}>
                            </td>
                            <td class="p-3">
                                <label class="inline-flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" ${s.is_featured ? 'checked' : ''} onchange="toggleFeature(${s.id}, this.checked)" class="rounded border-gray-300 text-blue-600">
                                    <span class="text-xs ${s.is_featured ? 'text-amber-600 font-medium' : 'text-gray-400'}">${s.is_featured ? 'مميز' : 'عادي'}</span>
                                </label>
                            </td>
                            <td class="p-3">
                                <button onclick="saveFeaturedPrice(${s.id})" class="text-[10px] bg-blue-50 hover:bg-blue-100 text-blue-600 px-2 py-1 rounded-lg font-medium">حفظ السعر</button>
                            </td>
                        </tr>
                    `).join('');
                });
        }

        function toggleFeature(id, featured) {
            const val = featured ? document.getElementById('fp-' + id).value : null;
            const price = featured && val ? parseFloat(val) : null;
            fetch('/api/admin/subscriptions/' + id + '/feature', { method: 'POST', headers: { 'Authorization': API_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ featured, featured_price: price }) })
                .then(r => r.json()).then(d => {
                    if (d.success) { CustomDialog.success(d.message); loadFeaturedSubs(); }
                    else CustomDialog.error(d.message);
                });
        }

        function saveFeaturedPrice(id) {
            const val = document.getElementById('fp-' + id).value;
            if (!val) return;
            fetch('/api/admin/subscriptions/' + id + '/feature', { method: 'POST', headers: { 'Authorization': API_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ featured: true, featured_price: parseFloat(val) }) })
                .then(r => r.json()).then(d => { if (d.success) CustomDialog.success('تم حفظ السعر المميز'); });
        }

        async function approveVendor(id, username) {
            const ok = await CustomDialog.show({ title: 'قبول طلب', message: 'تأكيد قبول طلب المزود "' + username + '"؟', type: 'confirm', style: 'success', confirmText: 'نعم، قبول' });
            if (!ok) return;
            fetch('/api/admin/vendors/' + id + '/status', { method: 'PATCH', headers: { 'Authorization': API_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'active' }) })
                .then(r => r.json()).then(d => { if (d.success) { CustomDialog.success('تم قبول طلب المزود وسيتم إشعاره'); loadVendors(); } });
        }

        let rejectVendorId = null;
        let rejectVendorName = '';

        function showRejectModal(id, username) {
            rejectVendorId = id;
            rejectVendorName = username;
            document.getElementById('reject-modal').classList.remove('hidden');
            document.getElementById('reject-vendor-name').textContent = username;
            document.getElementById('reject-reason').value = '';
        }

        async function confirmReject() {
            const reason = document.getElementById('reject-reason').value || 'لم يتم تقديم سبب';
            const ok = await CustomDialog.show({ title: 'رفض طلب', message: 'تأكيد رفض طلب المزود "' + rejectVendorName + '"؟', type: 'confirm', style: 'error', confirmText: 'نعم، رفض' });
            if (!ok) return;
            fetch('/api/admin/vendors/' + rejectVendorId + '/status', { method: 'PATCH', headers: { 'Authorization': API_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'rejected', rejected_reason: reason }) })
                .then(r => r.json()).then(d => {
                    if (d.success) {
                        CustomDialog.success('تم رفض طلب المزود وسيتم إشعاره');
                        document.getElementById('reject-modal').classList.add('hidden');
                        loadVendors();
                    }
                });
        }

        function toggleVendorStatus(id, status) {
            fetch('/api/admin/vendors/' + id + '/status', { method: 'PATCH', headers: { 'Authorization': API_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
                .then(r => r.json()).then(d => { if (d.success) loadVendors(); });
        }

        async function deleteVendor(id) {
            const ok = await CustomDialog.show({ title: 'حذف مزود', message: 'تأكيد حذف هذا المزود وجميع بياناته؟', type: 'confirm', style: 'error', confirmText: 'نعم، احذف' });
            if (!ok) return;
            fetch('/api/admin/vendors/' + id + '/delete', { method: 'POST', headers: { 'Authorization': API_TOKEN } })
                .then(r => r.json()).then(d => { if (d.success) loadVendors(); });
        }

        function loadOrders() {
            const seq = ++ordersRefreshSeq;
            fetch('/api/admin/orders', { headers: { 'Authorization': API_TOKEN } })
                .then(r => r.json()).then(d => {
                    if (seq !== ordersRefreshSeq || !d.success) return;
                    const tbody = document.getElementById('orders-table-body');
                    tbody.innerHTML = d.orders.map(o => {
                        const badgeClass = o.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : o.status === 'pending' ? 'bg-amber-50 text-amber-600' : o.status === 'awaiting_verification' ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600';
                        const badgeText = o.status === 'completed' ? 'مكتمل' : o.status === 'pending' ? 'قيد الانتظار' : o.status === 'awaiting_verification' ? 'قيد التحقق' : 'ملغي';
                        const screenshotPaths = o.screenshot_path ? (function(){try{return JSON.parse(o.screenshot_path)}catch(e){return o.screenshot_path ? [o.screenshot_path] : []}})() : [];
                        const screenshotBtn = screenshotPaths.length ? `<button onclick='viewScreenshot(${JSON.stringify(screenshotPaths)})' class="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600" title="عرض الصور (${screenshotPaths.length})"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg></button>` : '';
                        let actBtns = '';
                        if (o.status === 'awaiting_verification') {
                            actBtns = `
                                <button onclick="toggleOrderStatus(${o.id}, 'completed')" class="p-1.5 rounded-lg hover:bg-emerald-50 text-gray-400 hover:text-emerald-600" title="قبول"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg></button>
                                <button onclick="toggleOrderStatus(${o.id}, 'cancelled')" class="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500" title="رفض"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>`;
                        } else {
                            actBtns = `
                                <button onclick="toggleOrderStatus(${o.id}, '${o.status === 'pending' ? 'completed' : 'pending'}')" class="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-blue-600" title="تغيير الحالة"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg></button>`;
                        }
                        return `<tr class="border-b border-gray-50 hover:bg-gray-50/50">
                            <td class="p-4 text-gray-400 text-xs">${o.id}</td>
                            <td class="p-4 font-medium">${esc(o.customer_name)}</td>
                            <td class="p-4 text-gray-500 text-xs">${esc(o.customer_phone || '-')}</td>
                            <td class="p-4">${esc(o.subscription_name)}</td>
                            <td class="p-4 text-xs"><span class="bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg">${esc(o.vendor_name || '—')}</span></td>
                             <td class="p-4 font-bold">${o.amount} د.ل</td>
                            <td class="p-4"><span class="badge ${badgeClass}">${badgeText}</span></td>
                            <td class="p-4 text-gray-400 text-xs">${new Date(o.created_at).toLocaleDateString('ar-SA')}</td>
                            <td class="p-4 text-center">
                                <div class="flex items-center justify-center gap-1">
                                    ${screenshotBtn}
                                    ${actBtns}
                                    <button onclick="deleteOrder(${o.id})" class="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500" title="حذف">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                    </button>
                                </div>
                            </td>
                        </tr>`;
                    }).join('') || '<tr><td colspan="9" class="p-8 text-center text-gray-400">لا توجد طلبات بعد</td></tr>';
                    loadStats();
                });
        }

        function toggleOrderStatus(id, status) {
            fetch('/api/admin/orders/' + id + '/status', { method: 'PATCH', headers: { 'Authorization': API_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
                .then(r => r.json()).then(d => { if (d.success) loadOrders(); });
        }

        async function deleteOrder(id) {
            const ok = await CustomDialog.confirm('تأكيد حذف هذا الطلب؟');
            if (!ok) return;
            fetch('/api/admin/orders/' + id, { method: 'DELETE', headers: { 'Authorization': API_TOKEN } })
                .then(r => r.json()).then(d => { if (d.success) loadOrders(); });
        }

        function addOrder() {
            const data = {
                customer_name: document.getElementById('order-customer').value,
                customer_phone: document.getElementById('order-phone').value,
                customer_email: document.getElementById('order-email').value,
                subscription_name: document.getElementById('order-subscription').value,
                amount: parseFloat(document.getElementById('order-amount').value),
                vendor_id: document.getElementById('order-vendor').value || null
            };
            fetch('/api/admin/orders', { method: 'POST', headers: { 'Authorization': API_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
                .then(r => r.json()).then(d => {
                    if (d.success) {
                        document.getElementById('order-modal').classList.add('hidden');
                        loadOrders();
                        document.querySelector('#order-modal form').reset();
                    }
                });
        }

        // ===== التقارير مع رسوم بيانية متطورة =====
        function loadReports() {
            fetch('/api/admin/report-details', { headers: { 'Authorization': API_TOKEN } })
                .then(r => r.json()).then(dd => {
                    if (!dd.success) return;
                    const d = dd.report;

                    // ========== صف البطاقات الإحصائية (تصميم كارت ملون) ==========
                    document.getElementById('report-mini-stats').innerHTML = `
                        <div class="rounded-2xl p-4 bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-lg shadow-blue-500/20 report-card-hover"><p class="text-xs text-blue-200 font-medium">إجمالي الحسابات</p><p class="text-3xl font-bold mt-1">${d.totalVendors}</p><div class="flex gap-2 mt-2 text-[10px] text-blue-200"><span>🟢 ${d.activeVendors} نشط</span><span>🟡 ${d.pendingVendors} معلق</span><span>🔴 ${d.rejectedVendors} مرفوض</span></div></div>
                        <div class="rounded-2xl p-4 bg-gradient-to-br from-emerald-500 to-teal-700 text-white shadow-lg shadow-emerald-500/20 report-card-hover"><p class="text-xs text-emerald-200 font-medium">المزودون النشطون</p><p class="text-3xl font-bold mt-1">${d.activeVendors}</p><p class="text-[10px] text-emerald-200 mt-2">${d.totalVendors > 0 ? Math.round(d.activeVendors/d.totalVendors*100) : 0}% من إجمالي الحسابات</p><div class="w-full bg-white/20 rounded-full h-1.5 mt-1"><div class="bg-white rounded-full h-1.5 animate-width" style="width:${d.totalVendors > 0 ? Math.round(d.activeVendors/d.totalVendors*100) : 0}%"></div></div></div>
                        <div class="rounded-2xl p-4 bg-gradient-to-br from-amber-500 to-orange-700 text-white shadow-lg shadow-amber-500/20 report-card-hover"><p class="text-xs text-amber-200 font-medium">الطلبات</p><p class="text-3xl font-bold mt-1">${d.totalOrders}</p><div class="flex gap-3 mt-2 text-[10px] text-amber-200"><span>✅ ${d.completedOrders} مكتمل</span><span>⏳ ${d.pendingOrders} معلق</span></div></div>
                        <div class="rounded-2xl p-4 bg-gradient-to-br from-purple-500 to-pink-700 text-white shadow-lg shadow-purple-500/20 report-card-hover"><p class="text-xs text-purple-200 font-medium">المشاهدات</p><p class="text-3xl font-bold mt-1">${d.totalViews}</p><p class="text-[10px] text-purple-200 mt-2">على ${d.totalSubs} اشتراك و ${d.totalCategories} صنف</p></div>
                        <div class="rounded-2xl p-4 bg-gradient-to-br from-cyan-500 to-blue-700 text-white shadow-lg shadow-cyan-500/20 report-card-hover"><p class="text-xs text-cyan-200 font-medium">الاشتراكات</p><p class="text-3xl font-bold mt-1">${d.totalSubs}</p><div class="flex gap-2 mt-2 text-[10px] text-cyan-200"><span>🟢 ${d.activeSubs} نشط</span><span>📁 ${d.totalCategories} صنف</span></div></div>
                        <div class="rounded-2xl p-4 bg-gradient-to-br from-indigo-500 to-violet-700 text-white shadow-lg shadow-indigo-500/20 report-card-hover"><p class="text-xs text-indigo-200 font-medium">الأصناف</p><p class="text-3xl font-bold mt-1">${d.totalCategories}</p><p class="text-[10px] text-indigo-200 mt-2">تصنيف مختلف للخدمات</p></div>
                        <div class="rounded-2xl p-4 bg-gradient-to-br from-emerald-500 to-green-700 text-white shadow-lg shadow-emerald-500/20 report-card-hover"><p class="text-xs text-emerald-200 font-medium">الإيرادات المحققة</p><p class="text-3xl font-bold mt-1">${d.totalRevenue} <span class="text-lg">د.ل</span></p><p class="text-[10px] text-emerald-200 mt-2">من طلبات مكتملة ✓</p></div>
                        <div class="rounded-2xl p-4 bg-gradient-to-br from-amber-500 to-yellow-700 text-white shadow-lg shadow-amber-500/20 report-card-hover"><p class="text-xs text-amber-200 font-medium">الإيرادات المعلقة</p><p class="text-3xl font-bold mt-1">${d.pendingRevenue} <span class="text-lg">د.ل</span></p><p class="text-[10px] text-amber-200 mt-2">بانتظار الدفع ⏳</p></div>
                    `;

                    // ========== الرسم الدائري (Donut) مع أنميشن ==========
                    const total = d.totalVendors || 1;
                    const pActive = (d.activeVendors / total) * 360;
                    const pPending = (d.pendingVendors / total) * 360;
                    const pRejected = (d.rejectedVendors / total) * 360;
                    const donut = document.getElementById('donut-chart-el');
                    donut.style.background = d.totalVendors > 0
                        ? `conic-gradient(#10b981 0deg ${pActive}deg, #f59e0b ${pActive}deg ${pActive + pPending}deg, #ef4444 ${pActive + pPending}deg ${pActive + pPending + pRejected}deg, #f3f4f6 ${pActive + pPending + pRejected}deg 360deg)`
                        : 'conic-gradient(#f3f4f6 0deg 360deg)';
                    document.getElementById('donut-total').textContent = d.totalVendors;
                    document.getElementById('donut-legend').innerHTML = `
                        <div class="flex items-center gap-2 p-2 rounded-xl bg-emerald-50"><span class="w-3 h-3 rounded-full bg-emerald-500 shrink-0"></span><span class="flex-1 text-xs text-gray-600">نشط</span><span class="text-sm font-bold text-emerald-600">${d.activeVendors}</span><span class="text-[10px] text-gray-400">${d.totalVendors > 0 ? Math.round(d.activeVendors/d.totalVendors*100) : 0}%</span></div>
                        <div class="flex items-center gap-2 p-2 rounded-xl bg-amber-50"><span class="w-3 h-3 rounded-full bg-amber-500 shrink-0"></span><span class="flex-1 text-xs text-gray-600">معلق</span><span class="text-sm font-bold text-amber-600">${d.pendingVendors}</span><span class="text-[10px] text-gray-400">${d.totalVendors > 0 ? Math.round(d.pendingVendors/d.totalVendors*100) : 0}%</span></div>
                        <div class="flex items-center gap-2 p-2 rounded-xl bg-red-50"><span class="w-3 h-3 rounded-full bg-red-500 shrink-0"></span><span class="flex-1 text-xs text-gray-600">مرفوض</span><span class="text-sm font-bold text-red-600">${d.rejectedVendors}</span><span class="text-[10px] text-gray-400">${d.totalVendors > 0 ? Math.round(d.rejectedVendors/d.totalVendors*100) : 0}%</span></div>
                    `;

                    // ========== الرسم البياني الشهري (أعمدة أفقية) ==========
                    const months = d.monthlyOrders || [];
                    const chartContainer = document.getElementById('monthly-chart-container');
                    if (months.length) {
                        const maxCount = Math.max(...months.map(m => m.count), 1);
                        const monthNames = { '01':'يناير','02':'فبراير','03':'مارس','04':'أبريل','05':'مايو','06':'يونيو','07':'يوليو','08':'أغسطس','09':'سبتمبر','10':'أكتوبر','11':'نوفمبر','12':'ديسمبر' };
                        chartContainer.innerHTML = '<div class="space-y-2.5">' + months.slice().reverse().map(m => {
                            const pct = Math.round((m.count / maxCount) * 100);
                            const monthLabel = monthNames[m.month.split('-')[1]] || m.month;
                            return `
                            <div class="chart-tooltip" data-tip="${m.count} طلب - ${m.revenue} د.ل">
                                <div class="flex items-center gap-2 mb-1">
                                    <span class="text-[11px] text-gray-500 w-16 shrink-0 font-medium">${monthLabel}</span>
                                    <span class="text-[10px] text-gray-400">${m.count} طلب</span>
                                    <span class="text-[10px] text-gray-400 mr-auto">${m.revenue} د.ل</span>
                                </div>
                                <div class="w-full bg-gray-100 rounded-full h-3 overflow-hidden relative">
                                    <div class="bar-month h-full rounded-full bg-gradient-to-l from-blue-500 via-indigo-500 to-purple-500 flex items-center justify-end px-2" style="width:${Math.max(pct, 3)}%">
                                        <span class="text-[9px] text-white font-bold drop-shadow-sm">${m.count}</span>
                                    </div>
                                </div>
                            </div>`;
                        }).join('') + '</div>';
                    } else {
                        chartContainer.innerHTML = '<div class="text-center py-10"><div class="w-16 h-16 bg-gradient-to-br from-amber-100 to-orange-100 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-3">📊</div><p class="text-gray-400 text-sm">لا توجد طلبات مسجلة بعد</p><p class="text-[10px] text-gray-300 mt-1">عندما يتم تسجيل الطلبات، ستظهر هنا</p></div>';
                    }

                    // ========== ملخص المنصة (بأيقونات) ==========
                    const summaryMap = [
                        { icon: '👥', label: 'إجمالي الحسابات', val: d.totalVendors, cls: '' },
                        { icon: '✅', label: 'نشط', val: d.activeVendors, cls: 'text-emerald-600', bar: d.totalVendors > 0 ? Math.round(d.activeVendors/d.totalVendors*100) : 0 },
                        { icon: '⏳', label: 'معلق', val: d.pendingVendors, cls: 'text-amber-600', bar: d.totalVendors > 0 ? Math.round(d.pendingVendors/d.totalVendors*100) : 0 },
                        { icon: '❌', label: 'مرفوض', val: d.rejectedVendors, cls: 'text-red-600', bar: d.totalVendors > 0 ? Math.round(d.rejectedVendors/d.totalVendors*100) : 0 },
                        { icon: '📦', label: 'إجمالي الطلبات', val: d.totalOrders, cls: '' },
                        { icon: '✔️', label: 'مكتملة', val: d.completedOrders, cls: 'text-emerald-600', bar: d.totalOrders > 0 ? Math.round(d.completedOrders/d.totalOrders*100) : 0 },
                        { icon: '⏰', label: 'معلقة', val: d.pendingOrders, cls: 'text-amber-600', bar: d.totalOrders > 0 ? Math.round(d.pendingOrders/d.totalOrders*100) : 0 },
                        { icon: '👁️', label: 'المشاهدات', val: d.totalViews, cls: 'text-blue-600' },
                        { icon: '💰', label: 'الإيرادات المحققة', val: d.totalRevenue + ' د.ل', cls: 'text-lg text-emerald-600' },
                        { icon: '💳', label: 'الإيرادات المعلقة', val: d.pendingRevenue + ' د.ل', cls: 'text-amber-600' },
                    ];
                    document.getElementById('report-summary').innerHTML = summaryMap.map(item => `
                        <div class="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0 hover:bg-gray-50/50 rounded-lg px-2 -mx-2">
                            <span class="text-lg shrink-0">${item.icon}</span>
                            <span class="text-gray-600 text-sm flex-1">${item.label}</span>
                            <span class="font-bold ${item.cls}">${item.val}</span>
                            ${item.bar !== undefined ? `<div class="w-12 bg-gray-100 rounded-full h-1.5"><div class="h-1.5 rounded-full ${item.cls.replace('text-','bg-').replace('text-lg ','')}" style="width:${item.bar}%"></div></div>` : ''}
                        </div>
                    `).join('');

                    // ========== أفضل المزودين مع شريط تقدم ==========
                    const topVs = d.topVendors || [];
                    document.getElementById('top-vendors-report').innerHTML = topVs.length
                        ? topVs.map((v, i) => {
                            const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
                            const barW = topVs[0].orders_count > 0 ? Math.round((v.orders_count / topVs[0].orders_count) * 100) : 0;
                            const colors = ['from-yellow-400 to-amber-500', 'from-gray-300 to-gray-400', 'from-amber-600 to-orange-700', 'from-blue-400 to-blue-500', 'from-blue-300 to-blue-400'];
                            return `
                            <div class="p-3 bg-gradient-to-r ${colors[i] || 'from-gray-100 to-gray-200'} rounded-xl hover:shadow-md transition-all">
                                <div class="flex items-center gap-3">
                                    <span class="text-xl shrink-0">${medals[i] || (i+1)}</span>
                                    <div class="w-9 h-9 rounded-xl bg-white/40 backdrop-blur flex items-center justify-center text-sm font-bold shrink-0">${(v.display_name||v.username)[0]}</div>
                                    <div class="flex-1 min-w-0">
                                        <p class="text-sm font-bold text-black">${esc(v.display_name || v.username)}</p>
                                        <p class="text-[10px] text-gray-600">${v.subs_count||0} اشتراك · ${v.orders_count||0} طلب</p>
                                    </div>
                                    <span class="text-sm font-bold text-emerald-700 bg-white/60 px-2 py-1 rounded-lg">${v.revenue||0} د.ل</span>
                                </div>
                                <div class="w-full bg-white/60 rounded-full h-2 mt-2 overflow-hidden">
                                    <div class="h-2 rounded-full bg-gradient-to-l from-blue-600 to-indigo-700 animate-width" style="width:${barW}%"></div>
                                </div>
                            </div>`;
                        }).join('')
                        : '<div class="text-center py-8"><div class="w-12 h-12 bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl flex items-center justify-center text-xl mx-auto mb-3">🏆</div><p class="text-gray-400 text-sm">لا يوجد مزودون نشطون</p></div>';

                    // ========== الأكثر مشاهدة ==========
                    const topSubs = d.topSubs || [];
                    const maxV = topSubs.length ? Math.max(...topSubs.map(s => s.views || 0), 1) : 1;
                    const vColors = ['from-amber-400 to-orange-500', 'from-orange-400 to-red-500', 'from-yellow-400 to-amber-500', 'from-amber-300 to-yellow-500', 'from-orange-300 to-amber-400'];
                    document.getElementById('top-categories-report').innerHTML = topSubs.length
                        ? topSubs.map((s, i) => {
                            const pct = Math.round(((s.views || 0) / maxV) * 100);
                            return `
                            <div class="p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all">
                                <div class="flex items-center justify-between mb-2">
                                    <div class="flex items-center gap-2.5 min-w-0 flex-1">
                                        <span class="text-lg shrink-0">🔥</span>
                                        <div class="min-w-0">
                                            <p class="text-sm font-bold text-black truncate">${esc(s.name)}</p>
                                            <p class="text-[10px] text-gray-400">${esc(s.vendor_name||'مزود')} · ${esc(s.price)} د.ل</p>
                                        </div>
                                    </div>
                                    <div class="flex items-center gap-2 shrink-0">
                                        <span class="text-xs font-bold text-purple-600">${s.views || 0}</span>
                                        <span class="text-xs">👁</span>
                                    </div>
                                </div>
                                <div class="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                                    <div class="h-2.5 rounded-full bg-gradient-to-l ${vColors[i] || 'from-amber-400 to-orange-500'} animate-width" style="width:${pct}%"></div>
                                </div>
                            </div>`;
                        }).join('')
                        : '<div class="text-center py-8"><div class="w-12 h-12 bg-gradient-to-br from-amber-50 to-yellow-50 rounded-2xl flex items-center justify-center text-xl mx-auto mb-3">🔥</div><p class="text-gray-400 text-sm">لا توجد اشتراكات بعد</p></div>';

                    // ========== آخر الطلبات (مع أيقونات) ==========
                    fetch('/api/admin/orders', { headers: { 'Authorization': API_TOKEN } })
                        .then(r => r.json()).then(d2 => {
                            if (!d2.success) return;
                            const recent = d2.orders.slice(0, 8);
                            const statusColors = { completed: 'bg-emerald-100 text-emerald-700 border-emerald-200', pending: 'bg-amber-100 text-amber-700 border-amber-200', cancelled: 'bg-red-100 text-red-700 border-red-200' };
                            const statusText = { completed: 'مكتمل ✓', pending: 'معلق ⏳', cancelled: 'ملغي ✕' };
                            document.getElementById('report-recent-orders').innerHTML = recent.length
                                ? recent.map(o => `
                                    <div class="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl hover:shadow-sm hover:border-gray-200 transition-all">
                                        <div class="flex items-center gap-3 min-w-0 flex-1">
                                            <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 border border-blue-200 flex items-center justify-center text-sm font-bold text-blue-600 shrink-0">${(o.customer_name||'ط')[0]}</div>
                                            <div class="min-w-0">
                                                <p class="text-sm font-medium text-black truncate">${esc(o.subscription_name)}</p>
                                                <p class="text-xs text-gray-400">${esc(o.customer_name)}</p>
                                            </div>
                                        </div>
                                        <div class="flex items-center gap-3 shrink-0">
                                            <span class="text-xs font-semibold px-2.5 py-1 rounded-full border ${statusColors[o.status] || statusColors.pending}">${statusText[o.status] || 'معلق ⏳'}</span>
                                            <span class="text-sm font-bold text-black">${o.amount} د.ل</span>
                                        </div>
                                    </div>
                                `).join('')
                                : '<div class="text-center py-8"><div class="w-12 h-12 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl flex items-center justify-center text-xl mx-auto mb-3">📋</div><p class="text-gray-400 text-sm">لا توجد طلبات بعد</p></div>';
                        });
                });

            // ========== آخر النشاطات ==========
            fetch('/api/admin/activity-log', { headers: { 'Authorization': API_TOKEN } })
                .then(r => r.json()).then(d => {
                    if (!d.success) return;
                    const recent = d.logs.slice(0, 8);
                    const actionIcon = a => a.includes('حذف') ? '🗑️' : a.includes('إضافة') ? '➕' : a.includes('تعديل') ? '✏️' : a.includes('موافقة') ? '✅' : a.includes('رفض') ? '❌' : '📋';
                    const actionColor = a => a.includes('حذف') ? 'bg-red-50 border-red-100' : a.includes('إضافة') ? 'bg-emerald-50 border-emerald-100' : a.includes('تعديل') ? 'bg-blue-50 border-blue-100' : 'bg-gray-50 border-gray-100';
                    document.getElementById('report-recent-activity').innerHTML = recent.length
                        ? recent.map(l => `
                            <div class="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0 hover:bg-gray-50/50 rounded-lg px-2 -mx-2">
                                <span class="text-lg shrink-0 mt-0.5">${actionIcon(l.action)}</span>
                                <div class="flex-1 min-w-0">
                                    <p class="text-xs text-gray-700 font-medium">${esc(l.details || l.action)}</p>
                                    <div class="flex items-center gap-2 mt-1">
                                        <span class="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">${esc(l.vendor_name || 'مزود')}</span>
                                        <span class="text-[10px] text-gray-400">•</span>
                                        <span class="text-[10px] text-gray-400">${l.created_at || ''}</span>
                                    </div>
                                </div>
                            </div>
                        `).join('')
                        : '<div class="text-center py-8"><div class="w-12 h-12 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl flex items-center justify-center text-xl mx-auto mb-3">⚡</div><p class="text-gray-400 text-sm">لا توجد نشاطات بعد</p></div>';
                });
        }

        // ===== سجل النشاطات للمشرف =====
        function loadAdminActivityLog() {
            var vendor = document.getElementById('filter-activity-vendor').value.trim();
            var dateFrom = document.getElementById('filter-activity-date-from').value;
            var dateTo = document.getElementById('filter-activity-date-to').value;
            var action = document.getElementById('filter-activity-action').value;
            var params = new URLSearchParams();
            if (vendor) params.set('vendor_name', vendor);
            if (dateFrom) params.set('date_from', dateFrom);
            if (dateTo) params.set('date_to', dateTo);
            if (action) params.set('action', action);
            var qs = params.toString() ? '?' + params.toString() : '';
            fetch('/api/admin/activity-log' + qs, { headers: { 'Authorization': API_TOKEN } })
                .then(r => r.json()).then(d => {
                    const list = document.getElementById('admin-activity-list');
                    if (!d.success || !d.logs.length) {
                        list.innerHTML = '<div class="p-8 text-center text-gray-400 text-sm">لا توجد نشاطات بعد</div>';
                        return;
                    }
                    list.innerHTML = '<table class="w-full text-sm"><thead><tr class="border-b border-gray-100 text-gray-400 text-xs"><th class="text-right p-4 font-medium">#</th><th class="text-right p-4 font-medium">المزود</th><th class="text-right p-4 font-medium">الإجراء</th><th class="text-right p-4 font-medium">التفاصيل</th><th class="text-right p-4 font-medium">التاريخ</th></tr></thead><tbody>' +
                        d.logs.map(l => `
                            <tr class="border-b border-gray-50">
                                <td class="p-4 text-xs text-gray-400">${l.id}</td>
                                <td class="p-4 font-medium text-xs">${esc(l.vendor_name || 'مزود')}</td>
                                <td class="p-4"><span class="text-xs font-medium px-2 py-0.5 rounded-full ${l.action.includes('حذف') ? 'bg-red-50 text-red-600' : l.action.includes('إضافة') ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}">${esc(l.action)}</span></td>
                                <td class="p-4 text-xs text-gray-500">${esc(l.details || '')}</td>
                                <td class="p-4 text-xs text-gray-400">${l.created_at}</td>
                            </tr>
                        `).join('') + '</tbody></table>';
                });
        }

        // ===== طلبات حذف الحسابات =====
        function loadDeleteRequests() {
            fetch('/api/admin/delete-requests', { headers: { 'Authorization': API_TOKEN } })
                .then(r => r.json()).then(d => {
                    const tbody = document.getElementById('delete-requests-table-body');
                    const badge = document.getElementById('delete-req-badge');
                    if (!d.success || !d.requests.length) {
                        tbody.innerHTML = '<tr><td colspan="6" class="p-8 text-center text-gray-400">لا توجد طلبات حذف</td></tr>';
                        badge.classList.add('hidden');
                        return;
                    }
                    badge.classList.remove('hidden');
                    badge.textContent = d.requests.length;
                    tbody.innerHTML = d.requests.map(v => `
                        <tr class="border-b border-gray-50">
                            <td class="p-4 text-xs text-gray-400">${v.id}</td>
<td class="p-4 font-medium text-xs">${esc(v.display_name || v.fullname || v.username)}</td>
                                <td class="p-4 text-xs text-gray-500" dir="ltr">${esc(v.email || '-')}</td>
                                <td class="p-4 text-xs text-gray-500" dir="ltr">${esc(v.phone || '-')}</td>
                            <td class="p-4 text-xs text-gray-500">${esc(v.delete_reason || 'غير محدد')}</td>
                            <td class="p-4 text-center">
                                <div class="flex items-center justify-center gap-2">
                                    <button onclick="approveDelete(${v.id})" class="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-1.5 rounded-xl text-xs font-medium">موافقة</button>
                                    <button onclick="rejectDelete(${v.id})" class="bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-1.5 rounded-xl text-xs font-medium">رفض</button>
                                </div>
                            </td>
                        </tr>
                    `).join('');
                });
        }

        async function approveDelete(id) {
            const ok = await CustomDialog.show({ title: 'حذف الحساب', message: 'موافقة على حذف الحساب وجميع بياناته نهائياً؟', type: 'confirm', style: 'error', confirmText: 'نعم، احذف الكل' });
            if (!ok) return;
            fetch('/api/admin/vendors/' + id + '/approve-delete', { method: 'POST', headers: { 'Authorization': API_TOKEN } })
                .then(r => r.json()).then(d => { if (d.success) { CustomDialog.success('تم حذف الحساب وجميع بياناته'); loadDeleteRequests(); loadVendors(); loadStats(); } });
        }

        async function rejectDelete(id) {
            const ok = await CustomDialog.confirm('رفض طلب حذف الحساب؟');
            if (!ok) return;
            fetch('/api/admin/vendors/' + id + '/reject-delete', { method: 'POST', headers: { 'Authorization': API_TOKEN } })
                .then(r => r.json()).then(d => { if (d.success) { CustomDialog.success('تم رفض طلب الحذف'); loadDeleteRequests(); } });
        }

        // ====== الشكاوى ======
        function loadComplaints() {
            fetch('/api/admin/complaints', { headers: { 'Authorization': API_TOKEN } })
                .then(r => r.json()).then(d => {
                    const tbody = document.getElementById('complaints-table-body');
                    const badge = document.getElementById('complaint-badge');
                    if (!d.success || !d.complaints.length) {
                        tbody.innerHTML = '<tr><td colspan="8" class="p-8 text-center text-gray-400">لا توجد شكاوى</td></tr>';
                        badge.classList.add('hidden');
                        return;
                    }
                    var pending = d.complaints.filter(function(c) { return c.status === 'pending'; }).length;
                    if (pending) { badge.classList.remove('hidden'); badge.textContent = pending; } else { badge.classList.add('hidden'); }
                    tbody.innerHTML = d.complaints.map(function(c) {
                        var statusBadge = c.status === 'pending' ? '<span class="bg-amber-50 text-amber-600 text-[10px] font-bold px-2 py-0.5 rounded-full">قيد المراجعة</span>' : c.status === 'approved' ? '<span class="bg-emerald-50 text-emerald-600 text-[10px] font-bold px-2 py-0.5 rounded-full">تم قبول الشكوى</span>' : '<span class="bg-gray-50 text-gray-500 text-[10px] font-bold px-2 py-0.5 rounded-full">مرفوضة</span>';
                        var imgHtml = c.screenshot_path ? '<a href="/uploads/' + esc(c.screenshot_path) + '" target="_blank" class="text-blue-600 underline text-xs">عرض السكرين</a>' : '<span class="text-gray-400 text-xs">لا يوجد</span>';
                        return '<tr class="border-b border-gray-50"><td class="p-4 text-xs text-gray-400">' + c.id + '</td><td class="p-4 font-medium text-xs">' + esc(c.customer_name) + '<br><span class="text-gray-400 text-[10px]">' + esc(c.customer_phone) + '</span></td><td class="p-4 text-xs">' + esc(c.vendor_name) + '</td><td class="p-4 text-xs text-gray-500">' + esc(c.subscription_name) + '</td><td class="p-4 text-xs text-gray-500 max-w-[200px] truncate" title="' + esc(c.reason) + '">' + esc(c.reason) + '</td><td class="p-4">' + statusBadge + '</td><td class="p-4 text-xs text-gray-400">' + esc(c.created_at || '') + '<br>' + imgHtml + '</td><td class="p-4 text-center"><div class="flex items-center justify-center gap-1.5">' + (c.status === 'pending' ? '<button onclick="resolveComplaint(' + c.id + ', \'approved\')" class="bg-emerald-500 hover:bg-emerald-600 text-white px-2.5 py-1 rounded-lg text-[10px] font-medium">قبول</button><button onclick="resolveComplaint(' + c.id + ', \'rejected\')" class="bg-gray-100 hover:bg-gray-200 text-gray-600 px-2.5 py-1 rounded-lg text-[10px] font-medium">رفض</button>' : '<span class="text-gray-400 text-xs">تم</span>') + '</div></td></tr>';
                    }).join('');
                });
        }

        function resolveComplaint(id, status) {
            fetch('/api/admin/complaints/' + id, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': API_TOKEN }, body: JSON.stringify({ status: status }) })
                .then(r => r.json()).then(function(d) { if (d.success) { CustomDialog.success(status === 'approved' ? 'تم قبول الشكوى' : 'تم رفض الشكوى'); loadComplaints(); } });
        }

        // ====== تواصل مع المزودين ======
        function loadContactVendors() {
            fetch('/api/admin/vendors', { headers: { 'Authorization': API_TOKEN } })
                .then(r => r.json()).then(d => {
                    const grid = document.getElementById('contact-vendors-grid');
                    if (!d.success || !d.vendors.length) {
                        grid.innerHTML = '<div class="col-span-full text-center py-12 text-gray-400">لا يوجد مزودون بعد</div>';
                        return;
                    }
                    grid.innerHTML = d.vendors.filter(function(v) { return v.username !== 'admin'; }).map(function(v) {
                        var img = v.photo_path ? '<img src="' + v.photo_path + '" class="w-16 h-16 rounded-2xl object-cover shadow-sm border-2 border-white">' : '<div class="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-sm border-2 border-white">' + ((v.display_name||v.fullname||'م')[0]) + '</div>';
                        var statusBadge = v.status === 'active' ? '<span class="bg-emerald-50 text-emerald-600 text-[10px] font-bold px-2 py-0.5 rounded-full">نشط</span>' : v.status === 'pending' ? '<span class="bg-amber-50 text-amber-600 text-[10px] font-bold px-2 py-0.5 rounded-full">قيد المراجعة</span>' : '<span class="bg-red-50 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded-full">مرفوض</span>';
                        var phoneNum = v.phone ? v.phone.replace(/[^0-9]/g, '') : '';
                        if (phoneNum.startsWith('0')) phoneNum = '218' + phoneNum.slice(1);
                        else if (!phoneNum.startsWith('218')) phoneNum = '218' + phoneNum;
                        var waLink = v.phone ? 'https://wa.me/' + phoneNum : '#';
                        return '<div class="bg-white rounded-3xl p-4 sm:p-5 shadow-sm border border-gray-100 hover:shadow-lg smooth-transition card-hover"><div class="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">' + img + '<div class="flex-1 min-w-0"><h3 class="font-bold text-black text-sm truncate">' + (v.display_name || v.fullname || v.username) + '</h3><span class="text-xs text-gray-400">' + statusBadge + '</span></div></div><div class="space-y-2 text-xs"><div class="flex justify-between gap-2"><span class="text-gray-400 shrink-0">اسم المستخدم:</span><span class="font-medium text-deep-600" dir="ltr">' + (v.username || '-') + '</span></div><div class="flex justify-between gap-2"><span class="text-gray-400 shrink-0">كلمة المرور:</span><span class="font-medium text-deep-600 font-mono truncate min-w-0" dir="ltr">' + v.password + '</span></div><div class="flex justify-between gap-2"><span class="text-gray-400 shrink-0">رقم الهاتف:</span><span class="font-medium text-deep-600 truncate min-w-0" dir="ltr">' + (v.phone || '-') + '</span></div><div class="flex justify-between gap-2"><span class="text-gray-400 shrink-0">البريد:</span><span class="font-medium text-deep-600 truncate min-w-0 max-w-[100px] sm:max-w-[180px]" dir="ltr">' + (v.email || '-') + '</span></div></div>' + (v.phone ? '<a href="' + waLink + '" target="_blank" class="mt-4 w-full flex items-center justify-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 py-2.5 rounded-xl text-sm font-bold smooth-transition border border-emerald-100"><svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>دردشة واتساب</a>' : '<div class="mt-4 w-full text-center text-xs text-gray-400 py-2.5">لا يوجد رقم هاتف</div>') + '</div>';
                    }).join('');
                });
        }

        // ====== الإعدادات (العمولات) ======
        function loadSettings() {
            fetch('/api/admin/settings', { headers: { 'Authorization': API_TOKEN } })
                .then(r => r.json()).then(d => {
                    if (!d.success) return;
                    document.getElementById('global-commission-input').value = d.global_commission_rate || 0;
                    document.getElementById('cs-global-rate').textContent = (d.global_commission_rate || 0) + '%';
                });
            fetch('/api/admin/report-details', { headers: { 'Authorization': API_TOKEN } })
                .then(r => r.json()).then(d => {
                    if (d.success) {
                        document.getElementById('cs-total-commission').textContent = (d.data.totalCommission || 0) + ' د.ل';
                    }
                });
        }

        function saveGlobalCommission() {
            const rate = parseFloat(document.getElementById('global-commission-input').value);
            if (isNaN(rate) || rate < 0 || rate > 100) { CustomDialog.error('النسبة يجب أن تكون بين 0 و 100'); return; }
            fetch('/api/admin/settings/commission', { method: 'POST', headers: { 'Authorization': API_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ rate }) })
                .then(r => r.json()).then(d => {
                    if (d.success) {
                        const msg = document.getElementById('global-commission-msg');
                        msg.classList.remove('hidden');
                        msg.textContent = '✅ تم حفظ النسبة بنجاح';
                        msg.className = 'text-xs text-green-600 mt-3';
                        loadSettings();
                        setTimeout(() => msg.classList.add('hidden'), 3000);
                    } else { CustomDialog.error(d.message || 'فشل الحفظ'); }
                });
        }

        function saveVendorCommission(id) {
            const val = document.getElementById('vendor-commission-input').value;
            const rate = val === '' ? null : parseFloat(val);
            if (rate !== null && (isNaN(rate) || rate < 0 || rate > 100)) { CustomDialog.error('النسبة يجب أن تكون بين 0 و 100'); return; }
            fetch('/api/admin/vendors/' + id + '/commission', { method: 'POST', headers: { 'Authorization': API_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ rate }) })
                .then(r => r.json()).then(d => {
                    if (d.success) { CustomDialog.success(d.message); loadVendors(); viewVendorDetails(id); }
                    else { CustomDialog.error(d.message); }
                });
        }

        function resetVendorCommission(id) {
            fetch('/api/admin/vendors/' + id + '/commission', { method: 'POST', headers: { 'Authorization': API_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ rate: null }) })
                .then(r => r.json()).then(d => {
                    if (d.success) { CustomDialog.success(d.message); loadVendors(); viewVendorDetails(id); }
                });
        }

        // ====== نظام النقاط ======
        function loadPointsSystem() {
            loadPointSettings();
            loadCustomerPoints();
            loadVendorPoints();
            loadCustomerOffers();
            loadOfferSubscriptions();
            loadManualVendors();
        }

        function loadPointSettings() {
            fetch('/api/admin/points-settings', { headers: { 'Authorization': API_TOKEN } })
                .then(r => r.json()).then(d => {
                    if (!d.success) return;
                    document.getElementById('ps-customer-points-per-order').value = d.settings.customer_points_per_order;
                    document.getElementById('ps-customer-point-discount').value = d.settings.customer_point_discount;
                    document.getElementById('ps-customer-max-discount-percent').value = d.settings.customer_max_discount_percent;
                    document.getElementById('ps-vendor-daily-target').value = d.settings.vendor_daily_target;
                    document.getElementById('ps-vendor-points-per-target').value = d.settings.vendor_points_per_target;
                    document.getElementById('ps-vendor-commission-reduction-per-point').value = d.settings.vendor_commission_reduction_per_point;
                    document.getElementById('ps-vendor-reduction-hours').value = d.settings.vendor_reduction_hours;
                });
        }

        function savePointSetting(key, value) {
            fetch('/api/admin/points-settings', { method: 'POST', headers: { 'Authorization': API_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ key, value }) })
                .then(r => r.json()).then(d => {
                    if (d.success) { CustomDialog.success('تم الحفظ'); loadPointSettings(); }
                    else { CustomDialog.error(d.message); }
                });
        }

        function saveAllCustomerSettings() {
            savePointSetting('customer_points_per_order', document.getElementById('ps-customer-points-per-order').value);
            savePointSetting('customer_point_discount', document.getElementById('ps-customer-point-discount').value);
            savePointSetting('customer_max_discount_percent', document.getElementById('ps-customer-max-discount-percent').value);
        }

        function saveAllVendorSettings() {
            savePointSetting('vendor_daily_target', document.getElementById('ps-vendor-daily-target').value);
            savePointSetting('vendor_points_per_target', document.getElementById('ps-vendor-points-per-target').value);
            savePointSetting('vendor_commission_reduction_per_point', document.getElementById('ps-vendor-commission-reduction-per-point').value);
            savePointSetting('vendor_reduction_hours', document.getElementById('ps-vendor-reduction-hours').value);
        }

        function loadCustomerPoints() {
            fetch('/api/admin/customer-points', { headers: { 'Authorization': API_TOKEN } })
                .then(r => r.json()).then(d => {
                    const tbody = document.getElementById('ps-customer-points-table-body');
                    if (!d.success || !d.points.length) { tbody.innerHTML = '<tr><td colspan="2" class="p-4 text-center text-gray-400">لا توجد نقاط</td></tr>'; return; }
                    tbody.innerHTML = d.points.map(p => '<tr class="border-b border-gray-50"><td class="p-3 text-xs">' + p.phone + '</td><td class="p-3 text-xs font-bold">' + p.points + '</td></tr>').join('');
                });
        }
        
        function loadVendorPoints() {
            fetch('/api/admin/vendor-points-summary', { headers: { 'Authorization': API_TOKEN } })
                .then(r => r.json()).then(d => {
                    const tbody = document.getElementById('ps-vendor-points-table-body');
                    if (!d.success || !d.data.length) { tbody.innerHTML = '<tr><td colspan="3" class="p-4 text-center text-gray-400">لا توجد نقاط</td></tr>'; } else {
                        tbody.innerHTML = d.data.map(p => '<tr class="border-b border-gray-50"><td class="p-3 text-xs">' + p.vendor_name + '</td><td class="p-3 text-xs font-bold">' + p.points + '</td><td class="p-3 text-xs">' + (p.daily_sales_total || 0) + '</td></tr>').join('');
                    }
                    const rtbody = document.getElementById('ps-reductions-table-body');
                    if (!d.success || !d.reductions.length) { rtbody.innerHTML = '<tr><td colspan="3" class="p-4 text-center text-gray-400">لا توجد تخفيضات نشطة</td></tr>'; return; }
                    rtbody.innerHTML = d.reductions.map(r => '<tr class="border-b border-gray-50"><td class="p-3 text-xs">' + r.vendor_name + '</td><td class="p-3 text-xs font-bold text-emerald-600">' + r.reduction_percent + '%</td><td class="p-3 text-xs text-gray-400">' + r.expires_at + '</td></tr>').join('');
                });
        }

        function loadCustomerOffers() {
            fetch('/api/admin/offers', { headers: { 'Authorization': API_TOKEN } })
                .then(r => r.json()).then(d => {
                    const tbody = document.getElementById('ps-offers-table-body');
                    if (!d.success || !d.offers.length) { tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-gray-400">لا توجد عروض</td></tr>'; return; }
                    tbody.innerHTML = d.offers.map(o => '<tr class="border-b border-gray-50"><td class="p-3 text-xs">' + o.sub_name + '</td><td class="p-3 text-xs">' + o.vendor_name + '</td><td class="p-3 text-xs font-bold text-purple-600">' + o.discount_percent + '%</td><td class="p-3 text-xs"><button onclick="deleteCustomerOffer(' + o.id + ')" class="text-red-500 hover:text-red-700 text-xs">حذف</button></td></tr>').join('');
                });
        }

        function loadOfferSubscriptions() {
            fetch('/api/marketplace/offerings').then(r => r.json()).then(d => {
                const sel = document.getElementById('ps-offer-subscription');
                if (!d.success) return;
                let html = '<option value="">اختر الاشتراك</option>';
                d.offerings.forEach(o => {
                    o.categories.forEach(c => {
                        c.subscriptions.forEach(s => {
                            html += '<option value="' + s.id + '">' + s.name + ' - ' + o.vendor.display_name + '</option>';
                        });
                    });
                    o.uncategorized.forEach(s => {
                        html += '<option value="' + s.id + '">' + s.name + ' - ' + o.vendor.display_name + '</option>';
                    });
                });
                sel.innerHTML = html;
            });
        }

        function addCustomerOffer() {
            const sid = document.getElementById('ps-offer-subscription').value;
            const disc = document.getElementById('ps-offer-discount').value;
            if (!sid || !disc) { CustomDialog.error('يرجى اختيار الاشتراك وإدخال الخصم'); return; }
            fetch('/api/admin/offers', { method: 'POST', headers: { 'Authorization': API_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription_id: sid, discount_percent: disc }) })
                .then(r => r.json()).then(d => {
                    if (d.success) { CustomDialog.success('تم إضافة العرض'); loadCustomerOffers(); document.getElementById('ps-offer-discount').value = ''; }
                    else { CustomDialog.error(d.message); }
                });
        }

        async function deleteCustomerOffer(id) {
            const ok = await CustomDialog.confirm('هل تريد حذف هذا العرض؟', 'تأكيد الحذف');
            if (!ok) return;
            fetch('/api/admin/offers/' + id, { method: 'DELETE', headers: { 'Authorization': API_TOKEN } })
                .then(r => r.json()).then(d => {
                    if (d.success) { CustomDialog.success('تم الحذف'); loadCustomerOffers(); }
                    else { CustomDialog.error(d.message); }
                });
        }

        // ====== إضافة نقاط يدوية لمزود ======
        function loadManualVendors() {
            fetch('/api/admin/vendors', { headers: { 'Authorization': API_TOKEN } })
                .then(r => r.json()).then(d => {
                    if (!d.success) return;
                    const sel = document.getElementById('ps-manual-vendor');
                    sel.innerHTML = '<option value="">اختر المزود</option>' + d.vendors.filter(function(v) { return v.username !== 'admin'; }).map(function(v) { return '<option value="' + v.id + '">' + (v.display_name || v.fullname || v.username) + '</option>'; }).join('');
                });
        }

        function addVendorPointsManual() {
            const vendor_id = document.getElementById('ps-manual-vendor').value;
            const points = document.getElementById('ps-manual-points').value;
            const reason = document.getElementById('ps-manual-reason').value;
            if (!vendor_id || !points || parseInt(points) <= 0) { CustomDialog.error('اختر المزود وأدخل عدد النقاط'); return; }
            fetch('/api/admin/vendor-points/add', { method: 'POST', headers: { 'Authorization': API_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ vendor_id: parseInt(vendor_id), points: parseInt(points), reason: reason }) })
                .then(r => r.json()).then(d => {
                    if (d.success) { CustomDialog.success(d.message); document.getElementById('ps-manual-points').value = ''; document.getElementById('ps-manual-reason').value = ''; loadVendorPoints(); }
                    else { CustomDialog.error(d.message); }
                });
        }

        // ====== إدارة المشرفين ======
        function createAdmin() {
            var username = document.getElementById('admin-username').value.trim();
            var password = document.getElementById('admin-password').value.trim();
            var phone = document.getElementById('admin-phone').value.trim();
            var email = document.getElementById('admin-email').value.trim();
            var city = document.getElementById('admin-city').value.trim();
            if (!username || !password) { CustomDialog.error('يرجى إدخال اسم المستخدم وكلمة المرور'); return; }
            var btn = document.querySelector('#section-admin-management form button');
            btn.disabled = true;
            btn.textContent = 'جاري الإنشاء...';
            fetch('/api/admin/create-admin', { method: 'POST', headers: { 'Authorization': API_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password, phone, email, city }) })
                .then(r => r.json()).then(d => {
                    if (d.success) {
                        CustomDialog.success(d.message);
                        document.getElementById('admin-username').value = '';
                        document.getElementById('admin-password').value = '';
                        document.getElementById('admin-phone').value = '';
                        document.getElementById('admin-email').value = '';
                        document.getElementById('admin-city').value = '';
                        loadAdmins();
                    } else {
                        CustomDialog.error(d.message);
                    }
                }).catch(function() { CustomDialog.error('فشل الاتصال بالسيرفر'); })
                .finally(function() { btn.disabled = false; btn.textContent = 'إنشاء المشرف'; });
        }

        function loadAdmins() {
            fetch('/api/admin/admins', { headers: { 'Authorization': API_TOKEN } })
                .then(r => r.json()).then(d => {
                    const tbody = document.getElementById('admins-table-body');
                    if (!d.success || !d.admins.length) { tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-gray-400">لا يوجد مشرفون</td></tr>'; return; }
                    tbody.innerHTML = d.admins.map(function(a, i) {
                        return '<tr class="border-b border-gray-50"><td class="p-3 text-xs text-gray-400">' + (i+1) + '</td><td class="p-3 text-xs font-medium">' + a.username + '</td><td class="p-3 text-xs">' + (a.phone || '-') + '</td><td class="p-3 text-xs text-gray-400">' + (a.email || '-') + '</td><td class="p-3 text-xs text-gray-400">' + a.created_at + '</td></tr>';
                    }).join('');
                });
        }

        function loadViews() {
            fetch('/api/admin/views', { headers: { 'Authorization': API_TOKEN } })
                .then(r => r.json()).then(d => {
                    if (!d.success) return;
                    document.getElementById('views-today-count').textContent = d.stats.todayViews;
                    document.getElementById('views-unique-count').textContent = d.stats.uniqueIPs;
                    document.getElementById('views-total-count').textContent = d.views.length;
                    const tbody = document.getElementById('views-table-body');
                    if (!d.views.length) { tbody.innerHTML = '<tr><td colspan="5" class="p-6 text-center text-gray-400">لا توجد مشاهدات بعد</td></tr>'; return; }
                    tbody.innerHTML = d.views.map(function(v, i) {
                        return '<tr class="border-b border-gray-50 hover:bg-gray-50/50"><td class="p-3 text-xs text-gray-400">' + (i+1) + '</td><td class="p-3 text-xs font-medium">' + v.sub_name + '</td><td class="p-3 text-xs">' + v.vendor_name + '</td><td class="p-3 text-xs text-gray-400 font-mono" dir="ltr">' + v.viewer_ip + '</td><td class="p-3 text-xs text-gray-400">' + v.created_at + '</td></tr>';
                    }).join('');
                    const topList = document.getElementById('views-top-list');
                    if (!d.stats.topSubs.length) { topList.innerHTML = '<p class="text-xs text-gray-400 text-center py-4">لا توجد بيانات</p>'; return; }
                    topList.innerHTML = d.stats.topSubs.map(function(s, i) {
                        return '<div class="flex items-center justify-between p-2 bg-gray-50 rounded-xl"><span class="text-xs font-medium">' + (i+1) + '. ' + s.name + '</span><span class="text-xs font-bold text-brand">' + s.views_count + ' مشاهدة</span></div>';
                    }).join('');
                });
        }

        // ====== إدارة محتوى الصفحات ======
        let currentPageSlug = 'terms';

        function switchPageTab(slug) {
            currentPageSlug = slug;
            document.getElementById('tab-terms').className = 'px-5 py-2.5 rounded-xl text-sm font-medium ' + (slug === 'terms' ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200');
            document.getElementById('tab-privacy').className = 'px-5 py-2.5 rounded-xl text-sm font-medium ' + (slug === 'privacy' ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200');
            const titles = { terms: 'الشروط والأحكام', privacy: 'سياسة الخصوصية' };
            document.getElementById('page-editor-title').textContent = titles[slug] || slug;
            loadPageContent(slug);
        }

        function loadPageContent(slug) {
            fetch('/api/pages/' + slug)
                .then(r => r.json()).then(d => {
                    const editor = document.getElementById('page-content-editor');
                    if (d.success && d.exists) {
                        editor.value = d.page.content;
                        document.getElementById('page-updated-at').textContent = d.page.updated_at ? new Date(d.page.updated_at).toLocaleString('ar-SA') : '—';
                    } else {
                        // تحميل المحتوى الافتراضي المضمن
                        editor.value = '' + (slug === 'terms' ? defaultTermsContent : defaultPrivacyContent);
                        document.getElementById('page-updated-at').textContent = 'لم يتم الحفظ بعد';
                    }
                }).catch(() => {
                    document.getElementById('page-content-editor').value = slug === 'terms' ? defaultTermsContent : defaultPrivacyContent;
                });
        }

        function savePageContent() {
            const content = document.getElementById('page-content-editor').value;
            if (!content.trim()) { CustomDialog.error('المحتوى لا يمكن أن يكون فارغاً'); return; }
            const titles = { terms: 'الشروط والأحكام', privacy: 'سياسة الخصوصية' };
            fetch('/api/admin/pages/' + currentPageSlug, { method: 'POST', headers: { 'Authorization': API_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ title: titles[currentPageSlug], content }) })
                .then(r => r.json()).then(d => {
                    if (d.success) { CustomDialog.success(d.message); loadPageContent(currentPageSlug); }
                    else { CustomDialog.error(d.message); }
                }).catch(e => CustomDialog.error('خطأ في الاتصال: ' + e.message));
        }

        // المحتوى الافتراضي للشروط
        const defaultTermsContent = `<!-- المحتوى الافتراضي للشروط والأحكام -->
<p class="text-sm text-deep-600 leading-relaxed mb-6">مرحباً بك في منصة <strong>ماتريكس برو</strong>. باستخدامك للمنصة، فإنك توافق على الشروط والأحكام التالية. إذا كنت لا توافق على أي من هذه الشروط، يرجى عدم استخدام المنصة.</p>

<h2 class="text-lg font-cairo font-bold text-deep mb-3">1. تعريفات</h2>
<ul class="list-disc pr-5 space-y-1 text-sm text-deep-600 mb-6">
<li><strong>المنصة:</strong> موقع ماتريكس برو الإلكتروني (matrixpro.ly) وتطبيقاته.</li>
<li><strong>المزود:</strong> الشخص الطبيعي أو الاعتباري المسجل في المنصة لعرض وبيع الاشتراكات.</li>
<li><strong>المشتري/العميل:</strong> الشخص الذي يشتري الاشتراكات عبر المنصة.</li>
<li><strong>الاشتراك:</strong> خدمة رقمية أو اشتراك يتم عرضه للبيع عبر المنصة.</li>
<li><strong>العمولة:</strong> النسبة التي تحتفظ بها المنصة من سعر الاشتراك.</li>
</ul>

<h2 class="text-lg font-cairo font-bold text-deep mb-3">2. قبول الشروط</h2>
<p class="text-sm text-deep-600 leading-relaxed mb-3">باستخدامك للمنصة، سواء كمزود أو مشتري، فإنك تقر وتوافق على:</p>
<ul class="list-disc pr-5 space-y-1 text-sm text-deep-600 mb-6">
<li>أنك قرأت وفهمت هذه الشروط والأحكام.</li>
<li>أنك تبلغ من العمر 18 عاماً على الأقل.</li>
<li>أن جميع المعلومات التي تقدمها صحيحة وكاملة.</li>
<li>التزامك بجميع القوانين واللوائح المحلية النافذة في دولة ليبيا.</li>
</ul>

<h2 class="text-lg font-cairo font-bold text-deep mb-3">3. التسجيل والحسابات</h2>
<ul class="list-disc pr-5 space-y-1 text-sm text-deep-600 mb-6">
<li>يجب على المزودين إنشاء حساب للوصول إلى لوحة التحكم وعرض الخدمات.</li>
<li>يتم مراجعة طلبات التسجيل من قبل الإدارة قبل الموافقة عليها.</li>
<li>المزود مسؤول عن الحفاظ على سرية معلومات حسابه وكلمة المرور.</li>
<li>يمنع إنشاء أكثر من حساب لنفس الشخص دون إذن خطي من الإدارة.</li>
<li>تحتفظ المنصة بالحق في تعليق أو حذف أي حساب يخالف الشروط.</li>
<li>يمكن للمزود طلب حذف حسابه في أي وقت، ويتم مراجعة الطلب من قبل الإدارة.</li>
</ul>

<h2 class="text-lg font-cairo font-bold text-deep mb-3">4. الاشتراكات والخدمات</h2>
<ul class="list-disc pr-5 space-y-1 text-sm text-deep-600 mb-6">
<li>المزود مسؤول بشكل كامل عن صحة وصف الخدمة وسعرها ومدة الاشتراك.</li>
<li>يمنع عرض خدمات غير قانونية أو مخالفة للآداب العامة أو تنتهك حقوق الملكية الفكرية.</li>
<li>يجب أن تكون جميع الاشتراكات المعروضة قابلة للتفعيل من قبل المزود.</li>
<li>المنصة غير مسؤولة عن جودة الخدمة المقدمة من المزود، ولكنها تتعهد ببذل قصارى جهدها لحل النزاعات.</li>
<li>الصور المستخدمة في الإعلانات يجب أن تكون حقيقية وتعبر عن الخدمة المقدمة فعلياً.</li>
</ul>

<h2 class="text-lg font-cairo font-bold text-deep mb-3">5. العمولات والتسعير</h2>
<ul class="list-disc pr-5 space-y-1 text-sm text-deep-600 mb-6">
<li>تفرض المنصة عمولة على كل عملية بيع تتم عبر المنصة.</li>
<li>نسبة العمولة العامة تحدد من قبل الإدارة وقد تختلف حسب فئة الخدمة.</li>
<li>يمكن أن تختلف نسبة العمولة لكل مزود حسب الاتفاق مع الإدارة.</li>
<li>سعر الاشتراك المعروض شامل لعمولة المنصة.</li>
<li>تحتفظ المنصة بالحق في تغيير نسب العمولة مع إشعار مسبق للمزودين.</li>
</ul>

<h2 class="text-lg font-cairo font-bold text-deep mb-3">6. عمليات الشراء والدفع</h2>
<ul class="list-disc pr-5 space-y-1 text-sm text-deep-600 mb-6">
<li>عند تقديم طلب شراء، يقوم المشترك بإدخال اسمه ورقم واتسابه للتواصل مع المزود.</li>
<li>يتم توجيه المشتري إلى واتساب المزود مباشرة لتأكيد الطلب والتفعيل.</li>
<li>المنصة وسيط فقط بين المزود والمشتري، ولا تتحمل مسؤولية تأخير التفعيل من قبل المزود.</li>
<li>جميع المعاملات المالية تتم خارج المنصة بين المزود والمشتري مباشرة.</li>
<li>في حال عدم التفعيل أو وجود مشكلة في الخدمة، يحق للمشتري تقديم شكوى لاسترجاع حقه.</li>
</ul>

<h2 class="text-lg font-cairo font-bold text-deep mb-3">7. سياسة الاسترجاع والإلغاء</h2>
<ul class="list-disc pr-5 space-y-1 text-sm text-deep-600 mb-6">
<li>سياسة الاسترجاع والإلغاء تحدد من قبل كل مزود على حدة، مع مراعاة البنود التالية.</li>
<li><strong>يحق للمشتري تقديم طلب استرجاع خلال مدة لا تتجاوز 48 ساعة</strong> من تاريخ تقديم الطلب.</li>
<li>لتقديم طلب استرجاع، يجب على المشتري تقديم بلاغ عبر المنصة مع إرفاق سكرين شوت لمحادثة واتساب مع المزود.</li>
<li>بعد تقديم البلاغ، تقوم المنصة بمراجعة البلاغ والأدلة خلال مدة أقصاها 3 أيام عمل.</li>
<li>المنصة غير ملزمة بدفع المبلغ نيابة عن المزود، ولكنها تلتزم ببذل أقصى جهد لاسترجاع حق المشتري.</li>
</ul>

<h2 class="text-lg font-cairo font-bold text-deep mb-3">8. حسابات المزودين</h2>
<ul class="list-disc pr-5 space-y-1 text-sm text-deep-600 mb-6">
<li>يجب على المزود تفعيل الاشتراك للمشتري بعد تأكيد الطلب.</li>
<li>المزود ملزم بالرد على استفسارات العملاء في وقت معقول.</li>
<li>في حال المخالفات المتكررة، تحتفظ المنصة بالحق في تعليق الحساب أو حذفه.</li>
<li>يحق للمزود طلب حذف حسابه مع إبداء السبب، ويتم البت في الطلب من قبل الإدارة.</li>
</ul>

<h2 class="text-lg font-cairo font-bold text-deep mb-3">9. الملكية الفكرية</h2>
<ul class="list-disc pr-5 space-y-1 text-sm text-deep-600 mb-6">
<li>المحتوى المعروض على المنصة (الشعار، التصميم، النصوص) هو ملك للمنصة.</li>
<li>المحتوى الذي يرفعه المزودون (صور، أوصاف، أسماء) يبقى ملكاً لهم مع منح المنصة حق عرضه.</li>
<li>يمنع نسخ أو إعادة نشر أي محتوى من المنصة دون إذن خطي.</li>
</ul>

<h2 class="text-lg font-cairo font-bold text-deep mb-3">10. الخصوصية</h2>
<ul class="list-disc pr-5 space-y-1 text-sm text-deep-600 mb-6">
<li>نحن نحترم خصوصية مستخدمينا. يتم جمع المعلومات الضرورية فقط لتشغيل المنصة.</li>
<li>بيانات المستخدمين لا تُباع أو تُشارك مع أطراف ثالثة لأغراض تسويقية.</li>
<li>يتم تخزين المعلومات بأمان وفقاً للمعايير المعتمدة.</li>
</ul>

<h2 class="text-lg font-cairo font-bold text-deep mb-3">11. إخلاء المسؤولية</h2>
<ul class="list-disc pr-5 space-y-1 text-sm text-deep-600 mb-6">
<li>المنصة تقدم الخدمات "كما هي" دون أي ضمانات صريحة أو ضمنية.</li>
<li>المنصة غير مسؤولة عن أي أضرار مباشرة أو غير مباشرة ناتجة عن استخدام الخدمة.</li>
<li>المنصة غير مسؤولة عن انقطاع الخدمة أو الأعطال الفنية.</li>
</ul>

<h2 class="text-lg font-cairo font-bold text-deep mb-3">12. تعديل الشروط</h2>
<ul class="list-disc pr-5 space-y-1 text-sm text-deep-600 mb-6">
<li>تحتفظ المنصة بالحق في تعديل هذه الشروط في أي وقت.</li>
<li>سيتم إشعار المستخدمين بالتغييرات الجوهرية عبر البريد الإلكتروني أو عبر المنصة.</li>
<li>استمرار استخدام المنصة بعد التعديل يعني الموافقة على الشروط المعدلة.</li>
</ul>

<h2 class="text-lg font-cairo font-bold text-deep mb-3">13. القانون الواجب التطبيق</h2>
<ul class="list-disc pr-5 space-y-1 text-sm text-deep-600 mb-6">
<li>تخضع هذه الشروط وأي نزاعات ناشئة عنها للقوانين النافذة في دولة ليبيا.</li>
<li>في حالة وجود نزاع، يتم حله ودياً أولاً، فإن تعذر يتم اللجوء إلى القضاء الليبي المختص.</li>
</ul>

<h2 class="text-lg font-cairo font-bold text-deep mb-3">14. التواصل</h2>
<ul class="list-disc pr-5 space-y-1 text-sm text-deep-600 mb-6">
<li>للاستفسارات والشكاوى، يرجى التواصل عبر البريد الإلكتروني: support@matrixpro.ly</li>
</ul>`;

        // المحتوى الافتراضي لسياسة الخصوصية
        const defaultPrivacyContent = `<!-- المحتوى الافتراضي لسياسة الخصوصية -->
<p class="text-sm text-deep-600 leading-relaxed mb-6">نحن في <strong>ماتريكس برو</strong> نلتزم بحماية خصوصيتك وبياناتك الشخصية. توضح سياسة الخصوصية هذه كيفية جمع واستخدام وحماية المعلومات التي تقدمها عند استخدام منصتنا.</p>

<h2 class="text-lg font-cairo font-bold text-deep mb-3">1. المعلومات التي نجمعها</h2>
<ul class="list-disc pr-5 space-y-1 text-sm text-deep-600 mb-6">
<li><strong>معلومات التسجيل:</strong> الاسم الكامل، اسم المستخدم، كلمة المرور، البريد الإلكتروني، العمر، مكان الإقامة.</li>
<li><strong>معلومات المزود:</strong> الاسم التجاري، رقم الهاتف، رابط التواصل الاجتماعي، الصورة الشخصية.</li>
<li><strong>معلومات الطلبات:</strong> اسم العميل، رقم الهاتف، الاشتراكات التي تم شراؤها.</li>
<li><strong>معلومات الشكاوى:</strong> اسم المشتكي، رقم الهاتف، تفاصيل الشكوى، الصور المرفقة.</li>
<li><strong>معلومات الاستخدام:</strong> الصفحات التي تزورها، وقت الزيارة، عدد المشاهدات.</li>
<li><strong>معلومات تقنية:</strong> عنوان IP، نوع المتصفح، نظام التشغيل.</li>
</ul>

<h2 class="text-lg font-cairo font-bold text-deep mb-3">2. كيفية استخدام معلوماتك</h2>
<ul class="list-disc pr-5 space-y-1 text-sm text-deep-600 mb-6">
<li>تشغيل المنصة وتقديم الخدمات لك.</li>
<li>تمكين المزودين من عرض وبيع اشتراكاتهم.</li>
<li>تمكين العملاء من تصفح وشراء الاشتراكات.</li>
<li>التواصل معك بخصوص طلباتك واستفساراتك.</li>
<li>تحسين المنصة وتجربة المستخدم.</li>
<li>مراجعة الشكاوى وطلبات الاسترجاع ومعالجتها.</li>
<li>إرسال إشعارات مهمة (تأكيد التسجيل، حالة الطلب، تحديثات).</li>
</ul>

<h2 class="text-lg font-cairo font-bold text-deep mb-3">3. مشاركة المعلومات</h2>
<p class="text-sm text-deep-600 leading-relaxed mb-3">نحن لا نبيع أو نؤجر معلوماتك الشخصية لأطراف ثالثة. ومع ذلك، قد نشارك معلوماتك في الحالات التالية:</p>
<ul class="list-disc pr-5 space-y-1 text-sm text-deep-600 mb-6">
<li><strong>بين المزود والمشتري:</strong> يتم مشاركة اسم المشتري ورقم هاتفه مع المزود لتأكيد الطلب.</li>
<li><strong>مع جهات إنفاذ القانون:</strong> إذا طلب القانون ذلك أو لحماية حقوق المنصة.</li>
<li><strong>مع مزودي الخدمة:</strong> مثل خدمات الاستضافة والبريد الإلكتروني، وهم ملزمون باتفاقيات سرية.</li>
</ul>

<h2 class="text-lg font-cairo font-bold text-deep mb-3">4. حماية المعلومات</h2>
<ul class="list-disc pr-5 space-y-1 text-sm text-deep-600 mb-6">
<li>نستخدم إجراءات أمنية معيارية لحماية بياناتك.</li>
<li>كلمات المرور مشفرة باستخدام bcrypt.</li>
<li>نحد من الوصول إلى بياناتك الشخصية للموظفين المصرح لهم فقط.</li>
</ul>

<h2 class="text-lg font-cairo font-bold text-deep mb-3">5. الكوكيز (Cookies)</h2>
<ul class="list-disc pr-5 space-y-1 text-sm text-deep-600 mb-6">
<li>نستخدم ملفات تعريف الارتباط لتحسين تجربتك على المنصة.</li>
<li>يمكنك ضبط متصفحك لرفض الكوكيز، ولكن قد يؤثر ذلك على بعض وظائف المنصة.</li>
</ul>

<h2 class="text-lg font-cairo font-bold text-deep mb-3">6. الاحتفاظ بالبيانات</h2>
<ul class="list-disc pr-5 space-y-1 text-sm text-deep-600 mb-6">
<li>نحتفظ ببياناتك طالما كان حسابك نشطاً.</li>
<li>عند حذف حسابك، يتم حذف جميع بياناتك المرتبطة به.</li>
<li>قد نحتفظ ببعض البيانات للامتثال للالتزامات القانونية.</li>
</ul>

<h2 class="text-lg font-cairo font-bold text-deep mb-3">7. حقوقك</h2>
<ul class="list-disc pr-5 space-y-1 text-sm text-deep-600 mb-6">
<li><strong>حق الوصول:</strong> طلب نسخة من البيانات التي نحتفظ بها عنك.</li>
<li><strong>حق التصحيح:</strong> طلب تصحيح أي بيانات غير دقيقة.</li>
<li><strong>حق الحذف:</strong> طلب حذف حسابك وبياناتك.</li>
</ul>

<h2 class="text-lg font-cairo font-bold text-deep mb-3">8. روابط خارجية</h2>
<ul class="list-disc pr-5 space-y-1 text-sm text-deep-600 mb-6">
<li>قد تحتوي المنصة على روابط لمواقع خارجية (مثل واتساب).</li>
<li>نحن غير مسؤولين عن ممارسات الخصوصية لتلك المواقع.</li>
</ul>

<h2 class="text-lg font-cairo font-bold text-deep mb-3">9. خصوصية القاصرين</h2>
<ul class="list-disc pr-5 space-y-1 text-sm text-deep-600 mb-6">
<li>خدماتنا موجهة للأشخاص الذين تبلغ أعمارهم 18 عاماً أو أكثر.</li>
<li>نحن لا نجمع عن قصد معلومات من أشخاص تقل أعمارهم عن 18 عاماً.</li>
</ul>

<h2 class="text-lg font-cairo font-bold text-deep mb-3">10. التعديلات على سياسة الخصوصية</h2>
<ul class="list-disc pr-5 space-y-1 text-sm text-deep-600 mb-6">
<li>قد نقوم بتحديث سياسة الخصوصية هذه من وقت لآخر.</li>
<li>سيتم إشعارك بأي تغييرات جوهرية عبر البريد الإلكتروني أو من خلال المنصة.</li>
<li>تاريخ آخر تحديث يظهر في أعلى هذه الصفحة.</li>
</ul>

<h2 class="text-lg font-cairo font-bold text-deep mb-3">11. القانون الواجب التطبيق</h2>
<ul class="list-disc pr-5 space-y-1 text-sm text-deep-600 mb-6">
<li>تخضع سياسة الخصوصية هذه للقوانين النافذة في دولة ليبيا.</li>
</ul>

<h2 class="text-lg font-cairo font-bold text-deep mb-3">12. التواصل معنا</h2>
<ul class="list-disc pr-5 space-y-1 text-sm text-deep-600 mb-6">
<li>للاستفسارات، يرجى التواصل عبر البريد الإلكتروني: privacy@matrixpro.ly</li>
</ul>`;

        // ====== تنظيف الإيرادات ======
        async function clearRevenue() {
            const confirmed = await CustomDialog.confirm('هل أنت متأكد من حذف جميع سجلات الطلبات والعمولات؟ لا يمكن التراجع عن هذا الإجراء.');
            if (!confirmed) return;
            fetch('/api/admin/clear-revenue', { method: 'POST', headers: { 'Authorization': API_TOKEN } })
                .then(r => r.json()).then(d => {
                    if (d.success) { CustomDialog.success(d.message); loadAllData(); }
                    else { CustomDialog.error(d.message); }
                }).catch(e => CustomDialog.error('خطأ في الاتصال: ' + e.message));
        }

        // ====== تصفير اللوحة بالكامل ======
        async function resetAllData() {
            const step1 = await CustomDialog.confirm('⚠️ تحذير! هذا الإجراء سيقوم بحذف جميع البيانات (مزودين، اشتراكات، أصناف، طلبات، عمولات، سجلات النشاط). هل أنت متأكد؟');
            if (!step1) return;
            const step2 = await CustomDialog.confirm('تأكيد نهائي: سيتم إعادة اللوحة إلى حالتها الأولية بالكامل. لا يمكن التراجع. هل تريد المتابعة؟');
            if (!step2) return;
            fetch('/api/admin/reset-all', { method: 'POST', headers: { 'Authorization': API_TOKEN } })
                .then(r => r.json()).then(d => {
                    if (d.success) { CustomDialog.success(d.message); loadAllData(); }
                    else { CustomDialog.error(d.message); }
                }).catch(e => CustomDialog.error('خطأ في الاتصال: ' + e.message));
        }

        // ====== نظام صندوق الحوار التفاعلي (Custom Dialog) ======
        const CustomDialog = {
            _overlay: null,
            _resolve: null,
            _lastOrdersCount: 0,
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
            async show({ title, message, type = 'alert', style = 'info', confirmText = 'موافق', cancelText = 'إلغاء', inputPlaceholder = '', inputValue = '', showInput = false }) {
                const overlay = this._overlay;
                overlay.querySelector('#dialog-icon').innerHTML = this._getIconHtml(style);
                overlay.querySelector('#dialog-title').textContent = title || '';
                overlay.querySelector('#dialog-message').textContent = message || '';
                const inputArea = overlay.querySelector('#dialog-input-area');
                const inputEl = overlay.querySelector('#dialog-input');
                if (showInput) {
                    inputArea.classList.remove('hidden');
                    inputEl.placeholder = inputPlaceholder;
                    inputEl.value = inputValue;
                    setTimeout(() => inputEl.focus(), 100);
                } else {
                    inputArea.classList.add('hidden');
                }
                const btnContainer = overlay.querySelector('#dialog-buttons');
                const styleColors = { info: 'bg-blue-600 hover:bg-blue-700', success: 'bg-emerald-600 hover:bg-emerald-700', warning: 'bg-amber-600 hover:bg-amber-700', error: 'bg-red-600 hover:bg-red-700', question: 'bg-purple-600 hover:bg-purple-700' };
                const color = styleColors[style] || styleColors.info;
                return new Promise(resolve => {
                    this._resolve = resolve;
                    if (type === 'alert') {
                        btnContainer.innerHTML = `<button class="flex-1 ${color} text-white py-2.5 rounded-xl text-sm font-medium shadow-md" id="dialog-ok-btn">${confirmText}</button>`;
                        overlay.querySelector('#dialog-ok-btn').onclick = () => { overlay.classList.add('hidden'); resolve(true); };
                    } else if (type === 'confirm') {
                        btnContainer.innerHTML = `
                            <button class="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium" id="dialog-cancel-btn">${cancelText}</button>
                            <button class="flex-1 ${color} text-white py-2.5 rounded-xl text-sm font-medium shadow-md" id="dialog-confirm-btn">${confirmText}</button>`;
                        overlay.querySelector('#dialog-confirm-btn').onclick = () => { overlay.classList.add('hidden'); resolve(true); };
                        overlay.querySelector('#dialog-cancel-btn').onclick = () => { overlay.classList.add('hidden'); resolve(false); };
                    } else if (type === 'prompt') {
                        btnContainer.innerHTML = `
                            <button class="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium" id="dialog-cancel-btn">${cancelText}</button>
                            <button class="flex-1 ${color} text-white py-2.5 rounded-xl text-sm font-medium shadow-md" id="dialog-ok-btn">${confirmText}</button>`;
                        overlay.querySelector('#dialog-ok-btn').onclick = () => { const val = inputEl.value; overlay.classList.add('hidden'); resolve(val); };
                        overlay.querySelector('#dialog-cancel-btn').onclick = () => { overlay.classList.add('hidden'); resolve(null); };
                    }
                    overlay.classList.remove('hidden');
                    if (type === 'alert') overlay.querySelector('#dialog-ok-btn').focus();
                });
            },
            async alert(message, title = '') { return this.show({ title, message, type: 'alert', style: 'info' }); },
            async success(message, title = '') { return this.show({ title, message, type: 'alert', style: 'success' }); },
            async error(message, title = '') { return this.show({ title, message, type: 'alert', style: 'error' }); },
            async confirm(message, title = 'تأكيد') { return this.show({ title, message, type: 'confirm', style: 'question', confirmText: 'نعم', cancelText: 'إلغاء' }); }
        };
        CustomDialog.init();

        // ====== إشعارات سطح المكتب (Desktop Notifications) ======
        function initNotifications() {
            if (!('Notification' in window)) return;
            if (Notification.permission === 'default') Notification.requestPermission();
        }
        function sendDesktopNotification(title, body, icon = '/favicon.ico') {
            if (!('Notification' in window) || Notification.permission !== 'granted') return;
            try { new Notification(title, { body, icon }); } catch(e) {}
        }

        // ====== متابعة الطلبات الجديدة (إشعار فوري للأدمن) ======
        let lastKnownOrdersCount = 0;
        let ordersRefreshSeq = 0;
        let vendorsRefreshSeq = 0;
        let pendingVendorsCount = 0;
        function checkNewOrders() {
            if (!isLoggedIn) return;
            fetch('/api/admin/orders/count', { headers: { 'Authorization': API_TOKEN } })
                .then(r => r.json()).then(d => {
                    if (!d.success) return;
                    const currentCount = d.count;
                    if (lastKnownOrdersCount > 0 && currentCount > lastKnownOrdersCount) {
                        sendDesktopNotification('🛒 طلب جديد', 'وصل ' + (currentCount - lastKnownOrdersCount) + ' طلب جديد');
                        CustomDialog.show({ title: '🛒 طلب جديد', message: 'وصل ' + (currentCount - lastKnownOrdersCount) + ' طلب جديد', type: 'alert', style: 'info' });
                        loadOrders();
                    }
                    lastKnownOrdersCount = currentCount;
                });
        }

        // ====== إضافات مخصصة (Custom Assets) ======
        function loadCustomAssets() {
            fetch('/api/admin/custom-assets', { headers: { 'Authorization': API_TOKEN } })
                .then(r => r.json()).then(d => {
                    if (!d.success) return;
                    document.getElementById('ca-css').value = d.assets.custom_css || '';
                    document.getElementById('ca-js').value = d.assets.custom_js || '';
                    document.getElementById('ca-html').value = d.assets.custom_html || '';
                });
        }
        function validateCustomAsset(id, type) {
            const el = document.getElementById(id);
            const hint = document.getElementById(id + '-hint');
            const val = el.value;
            if (!val.trim()) { hint.classList.add('hidden'); hint.textContent = ''; return true; }
            let warnings = [];
            if (type === 'css') {
                if (/<style\b/i.test(val)) warnings.push('لا تضف وسوم &lt;style&gt; — اكتب CSS فقط');
                const open = (val.match(/\{/g) || []).length;
                const close = (val.match(/\}/g) || []).length;
                if (open !== close) warnings.push('عدد الأقواس غير متطابق: ' + open + ' مفتوحة و ' + close + ' مغلقة');
            }
            if (type === 'js') {
                if (/<script\b/i.test(val)) warnings.push('لا تضف وسوم &lt;script&gt; — اكتب JavaScript فقط');
                try { new Function(val); } catch(e) { warnings.push('خطأ في الصياغة: ' + e.message); }
            }
            if (type === 'html') {
                if (/<script\b/i.test(val)) warnings.push('تحذير: وجد وسم &lt;script&gt; — تأكد من صحة الكود');
            }
            if (warnings.length) {
                hint.innerHTML = '⚠️ ' + warnings.join('<br>⚠️ ');
                hint.className = 'text-xs mt-1 text-amber-600';
                return false;
            }
            hint.classList.add('hidden');
            return true;
        }
        async function saveCustomAssets() {
            const css = document.getElementById('ca-css').value;
            const js = document.getElementById('ca-js').value;
            const html = document.getElementById('ca-html').value;
            const cssOk = validateCustomAsset('ca-css', 'css');
            const jsOk = validateCustomAsset('ca-js', 'js');
            const htmlOk = validateCustomAsset('ca-html', 'html');
            if (!cssOk || !jsOk || !htmlOk) {
                CustomDialog.error('يوجد أخطاء في الإدخال. راجع التنبيهات أسفل كل حقل');
                return;
            }
            const totalLength = css.length + js.length + html.length;
            if (totalLength > 50000) {
                const ok = await CustomDialog.confirm('الإضافات كبيرة جداً (' + totalLength + ' حرف). هل تريد الحفظ على أي حال؟');
                if (!ok) return;
            }
            Promise.all([
                fetch('/api/admin/custom-assets', { method: 'POST', headers: { 'Authorization': API_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'custom_css', value: css }) }),
                fetch('/api/admin/custom-assets', { method: 'POST', headers: { 'Authorization': API_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'custom_js', value: js }) }),
                fetch('/api/admin/custom-assets', { method: 'POST', headers: { 'Authorization': API_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'custom_html', value: html }) })
            ]).then(() => {
                CustomDialog.success('تم حفظ جميع الإضافات بنجاح');
            }).catch(e => CustomDialog.error('خطأ في الحفظ: ' + e.message));
        }

        var screenshotPaths = [];
        var screenshotIndex = 0;
        function viewScreenshot(paths) {
            screenshotPaths = typeof paths === 'string' ? [paths] : paths;
            screenshotIndex = 0;
            showScreenshot();
            document.getElementById('screenshot-viewer').classList.remove('hidden');
        }
        function showScreenshot() {
            var img = document.getElementById('screenshot-viewer-img');
            var counter = document.getElementById('screenshot-counter');
            var prevBtn = document.getElementById('screenshot-prev');
            var nextBtn = document.getElementById('screenshot-next');
            img.src = screenshotPaths[screenshotIndex];
            if (counter) counter.textContent = (screenshotIndex + 1) + ' / ' + screenshotPaths.length;
            if (prevBtn) prevBtn.style.display = screenshotIndex > 0 ? '' : 'none';
            if (nextBtn) nextBtn.style.display = screenshotIndex < screenshotPaths.length - 1 ? '' : 'none';
        }
        function prevScreenshot() { if (screenshotIndex > 0) { screenshotIndex--; showScreenshot(); } }
        function nextScreenshot() { if (screenshotIndex < screenshotPaths.length - 1) { screenshotIndex++; showScreenshot(); } }
        function closeScreenshotViewer() {
            document.getElementById('screenshot-viewer').classList.add('hidden');
        }

        // التحميل التلقائي
        let lastKnownPendingVendors = -1;
        setInterval(() => {
            if (!isLoggedIn) return;
            loadStats().then(() => {
                if (lastKnownPendingVendors >= 0 && pendingVendorsCount !== lastKnownPendingVendors) loadVendors();
                lastKnownPendingVendors = pendingVendorsCount;
            });
        }, 15000);
        setInterval(() => { if (isLoggedIn) { checkNewOrders(); } }, 8000);
    