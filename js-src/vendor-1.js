
        function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
        let vendorId = null;
        let subsData = [];
        let catsData = [];
        let currentCatId = null;

        (function autoLogin() {
            const storedToken = localStorage.getItem('vendorToken');
            if (storedToken) {
                // تحقق من صحة التوكن
                fetch('/api/vendor/verify-token', { headers: { 'x-auth-token': storedToken } })
                    .then(r => r.json()).then(d => {
                        if (d.valid) {
                            vendorId = storedToken;
                            document.getElementById('vendor-name-display').textContent = d.vendor.display_name || d.vendor.username || 'مزود';
                            localStorage.setItem('vendorName', d.vendor.display_name || d.vendor.username || 'مزود');
                            document.getElementById('login-screen').classList.add('hidden');
                            document.getElementById('dashboard').classList.remove('hidden');
                            initNotifications();
                            loadAllData();
                        } else {
                            localStorage.removeItem('vendorToken');
                            localStorage.removeItem('vendorName');
                        }
                    }).catch(() => {});
                return;
            }
            const params = new URLSearchParams(window.location.search);
            const t = params.get('t');
            if (t) {
                // Auto-login عبر توكن من رابط المتجر
                window.history.replaceState({}, '', '/vendor.html');
                fetch('/api/vendor/verify-token', { headers: { 'x-auth-token': t } })
                    .then(r => r.json()).then(d => {
                        if (d.valid) {
                            vendorId = t;
                            localStorage.setItem('vendorToken', t);
                            localStorage.setItem('vendorName', d.vendor.display_name || d.vendor.username || 'مزود');
                            document.getElementById('vendor-name-display').textContent = d.vendor.display_name || d.vendor.username || 'مزود';
                            document.getElementById('login-screen').classList.add('hidden');
                            document.getElementById('dashboard').classList.remove('hidden');
                            initNotifications();
                            loadAllData();
                        } else {
                            document.getElementById('login-info').classList.remove('hidden');
                            document.getElementById('login-info').textContent = '❌ رابط الدخول غير صالح أو منتهي الصلاحية';
                        }
                    }).catch(() => {});
            }
        })();

        function performVendorLogin(u, p, attempt) {
            const retry = () => {
                if (attempt < 3) {
                    setTimeout(function() { performVendorLogin(u, p, attempt + 1); }, 1500);
                } else {
                    document.getElementById('login-error').classList.remove('hidden');
                    document.getElementById('login-error').textContent = 'فشل الاتصال بالسيرفر. تأكد من اتصال الإنترنت وحاول مجدداً';
                }
            };
            fetch('/api/vendor/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: u, password: p })
            }).then(r => r.text()).then(text => {
                let data;
                try { data = JSON.parse(text); } catch (e) { data = null; }
                if (!data) return retry();
                if (data.success) {
                    if (data.vendor.is_admin) { window.location.href = '/admin.html'; return; }
                    vendorId = data.token;
                    localStorage.setItem('vendorToken', data.token);
                    localStorage.setItem('vendorName', data.vendor.display_name || u);
                    document.getElementById('vendor-name-display').textContent = data.vendor.display_name || u;
                    document.getElementById('login-screen').classList.add('hidden');
                    document.getElementById('dashboard').classList.remove('hidden');
                    initNotifications();
                    loadAllData();
                } else {
                    const info = document.getElementById('login-info');
                    info.classList.remove('hidden');
                    if (data.status === 'pending') {
                        info.className = 'text-xs text-center p-3 rounded-2xl bg-amber-50 text-amber-700';
                        info.innerHTML = '⏳ طلبك قيد المراجعة.<br>انتظر الموافقة وسيتم إشعارك.';
                    } else if (data.status === 'rejected') {
                        info.className = 'text-xs text-center p-3 rounded-2xl bg-red-50 text-red-700';
                        info.innerHTML = '❌ تم رفض طلبك.<br>' + (data.rejected_reason ? 'السبب: ' + esc(data.rejected_reason) : '');
                    } else {
                        document.getElementById('login-error').classList.remove('hidden');
                        document.getElementById('login-error').textContent = data.message || 'فشل تسجيل الدخول';
                    }
                }
            }).catch(() => retry());
        }

        function vendorLogin() {
            const u = document.getElementById('login-username').value;
            const p = document.getElementById('login-password').value;
            document.getElementById('login-error').classList.add('hidden');
            document.getElementById('login-info').classList.add('hidden');
            performVendorLogin(u, p, 0);
        }

        function logout() {
            const token = vendorId;
            vendorId = null;
            localStorage.removeItem('vendorToken');
            localStorage.removeItem('vendorName');
            // إبطال التوكن في السيرفر
            if (token) fetch('/api/vendor/logout', { method: 'POST', headers: { 'x-auth-token': token } }).catch(() => {});
            document.getElementById('dashboard').classList.add('hidden');
            document.getElementById('login-screen').classList.remove('hidden');
        }

        function showSection(name) {
            document.querySelectorAll('.section-content').forEach(s => s.classList.add('hidden'));
            document.getElementById('section-' + name).classList.remove('hidden');
            document.querySelectorAll('.sidebar-link').forEach(b => b.classList.remove('active'));
            const btn = document.querySelector(`.sidebar-link[onclick="showSection('${name}')"]`);
            if (btn) btn.classList.add('active');
            if (name === 'categories') loadCategories();
            if (name === 'orders') loadOrders();
            if (name === 'profile') { loadProfile(); loadVendorPoints(); }
            if (name === 'overview') loadVendorPoints();
            closeSidebar();
        }

        function toggleSidebar() {
            const sidebar = document.getElementById('main-sidebar');
            const overlay = document.getElementById('sidebar-overlay');
            const isOpen = sidebar.classList.contains('translate-x-0');
            if (isOpen) {
                sidebar.classList.remove('translate-x-0');
                sidebar.classList.add('translate-x-full', 'hidden');
            } else {
                sidebar.classList.remove('hidden');
                setTimeout(function() { sidebar.classList.remove('translate-x-full'); sidebar.classList.add('translate-x-0'); }, 10);
            }
            overlay.classList.toggle('hidden', isOpen);
        }

        function closeSidebar() {
            const sidebar = document.getElementById('main-sidebar');
            const overlay = document.getElementById('sidebar-overlay');
            if (window.innerWidth < 1024) {
                sidebar.classList.remove('translate-x-0');
                sidebar.classList.add('translate-x-full', 'hidden');
                overlay.classList.add('hidden');
            }
        }

        function loadAllData() { loadCategories(); loadOrders(); loadProfile(); loadVendorPoints(); startDeletePolling(); setInterval(startDeletePolling, 10000); }

        // ====== الأصناف ======
        function loadCategories() {
            if (!vendorId) return;
            fetch('/api/vendor/categories', { headers: { 'x-vendor-id': vendorId } })
                .then(r => r.json()).then(d => {
                    if (!d.success) return;
                    catsData = d.categories;
                    document.getElementById('ov-cats-count').textContent = d.categories.length;
                    document.getElementById('cats-total-badge').textContent = d.categories.length;
                    const allSubs = d.categories.reduce((sum, c) => sum + (c.subs_count || 0), 0);
                    document.getElementById('ov-subs-count').textContent = allSubs;
                    const grid = document.getElementById('cats-grid');
                    grid.innerHTML = d.categories.length ? d.categories.map(c => {
                        const imgHtml = c.image_path ? `<img src="${c.image_path}" class="w-full h-28 object-cover">` : `<div class="w-full h-16 bg-gradient-to-br from-blue-500 to-indigo-600"></div>`;
                        return `
                        <div class="cat-card bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 cursor-pointer relative">
                            <div onclick="event.stopPropagation()" class="absolute top-3 left-3 z-10">
                                <input type="checkbox" class="cat-checkbox rounded border-gray-300" value="${c.id}" onchange="updateBatchCatsBtn()">
                            </div>
                            <div onclick="enterCategory(${c.id})">
                                ${imgHtml}
                                <div class="p-4">
                                    <div class="flex items-start justify-between mb-3">
                                        <h3 class="text-lg font-bold text-black">${esc(c.name)}</h3>
                                        <div class="flex gap-1 items-center">
                                            <span class="bg-blue-50 text-blue-600 text-xs font-bold px-2.5 py-1 rounded-full">${c.subs_count || 0}</span>
                                            <span class="bg-amber-50 text-amber-600 text-[10px] font-bold px-2 py-1 rounded-full" title="عمولة الصنف">${c.effective_commission_rate}%</span>
                                        </div>
                                    </div>
                                    ${c.description ? `<p class="text-xs text-gray-500 mb-4">${esc(c.description)}</p>` : ''}
                                    <div class="flex gap-2">
                                        <button onclick="event.stopPropagation(); editCat(${c.id})" class="flex-1 bg-gray-50 hover:bg-gray-100 text-gray-600 py-2 rounded-xl text-xs font-medium smooth-transition">تعديل</button>
                                        <button onclick="event.stopPropagation(); deleteCat(${c.id})" class="flex-1 bg-red-50 hover:bg-red-100 text-red-500 py-2 rounded-xl text-xs font-medium smooth-transition">حذف</button>
                                    </div>
                                </div>
                            </div>
                        </div>`;
                    }).join('') : '<p class="text-gray-400 text-sm col-span-full text-center py-12">لا توجد أصناف بعد. أضف صنفك الأول!</p>';
                });
        }

        function previewCatImage(event) {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    document.getElementById('cat-image-img').src = e.target.result;
                    document.getElementById('cat-image-placeholder').classList.add('hidden');
                    document.getElementById('cat-image-preview').classList.remove('hidden');
                };
                reader.readAsDataURL(file);
            }
        }

        function showAddCatModal() {
            document.getElementById('cat-modal-title').textContent = 'إضافة صنف جديد';
            document.getElementById('cat-id').value = '';
            document.getElementById('cat-form').reset();
            document.getElementById('cat-image-placeholder').classList.remove('hidden');
            document.getElementById('cat-image-preview').classList.add('hidden');
            document.getElementById('cat-existing-image').value = '';
            document.getElementById('cat-modal').classList.remove('hidden');
        }

        function editCat(id) {
            const c = catsData.find(x => x.id === id);
            if (!c) return;
            document.getElementById('cat-modal-title').textContent = 'تعديل الصنف';
            document.getElementById('cat-id').value = c.id;
            document.getElementById('cat-name').value = c.name;
            document.getElementById('cat-desc').value = c.description || '';
            if (c.image_path) {
                document.getElementById('cat-image-img').src = c.image_path;
                document.getElementById('cat-image-placeholder').classList.add('hidden');
                document.getElementById('cat-image-preview').classList.remove('hidden');
                document.getElementById('cat-existing-image').value = c.image_path;
            } else {
                document.getElementById('cat-image-placeholder').classList.remove('hidden');
                document.getElementById('cat-image-preview').classList.add('hidden');
                document.getElementById('cat-existing-image').value = '';
            }
            document.getElementById('cat-image-input').value = '';
            document.getElementById('cat-modal').classList.remove('hidden');
        }

        function saveCat() {
            const id = document.getElementById('cat-id').value;
            const formData = new FormData();
            formData.append('name', document.getElementById('cat-name').value);
            formData.append('description', document.getElementById('cat-desc').value);
            const imgInput = document.getElementById('cat-image-input');
            if (imgInput.files[0]) formData.append('cat_image', imgInput.files[0]);
            if (id) formData.append('existing_image', document.getElementById('cat-existing-image').value || '');
            const url = id ? '/api/vendor/categories/' + id : '/api/vendor/categories';
            const method = id ? 'PUT' : 'POST';
            fetch(url, { method, headers: { 'x-vendor-id': vendorId }, body: formData })
                .then(r => r.json()).then(d => {
                    if (d.success) {
                        document.getElementById('cat-modal').classList.add('hidden');
                        loadCategories();
                    }
                });
        }

        async function deleteCat(id) {
            const delSubs = await CustomDialog.show({ title: 'حذف صنف', message: 'حذف الاشتراكات داخله أيضاً؟', type: 'confirm', style: 'warning', confirmText: 'نعم، احذف الكل', cancelText: 'لا، أبقِ الاشتراكات' });
            fetch('/api/vendor/categories/' + id + '?delete_subs=' + (delSubs ? '1' : '0'), { method: 'DELETE', headers: { 'x-vendor-id': vendorId } })
                .then(r => r.json()).then(d => { if (d.success) loadCategories(); });
        }

        // ====== Batch delete ======
        function toggleSelectAllCats() {
            const checked = document.getElementById('select-all-cats').checked;
            document.querySelectorAll('.cat-checkbox').forEach(cb => cb.checked = checked);
            document.getElementById('batch-delete-cats-btn').classList.toggle('hidden', !checked && !document.querySelector('.cat-checkbox:checked'));
        }

        function toggleSelectAllSubs() {
            const checked = document.getElementById('select-all-subs').checked;
            document.querySelectorAll('.sub-checkbox').forEach(cb => cb.checked = checked);
            document.getElementById('batch-delete-subs-btn').classList.toggle('hidden', !checked && !document.querySelector('.sub-checkbox:checked'));
        }

        async function batchDeleteCats() {
            const ids = [...document.querySelectorAll('.cat-checkbox:checked')].map(cb => parseInt(cb.value));
            if (!ids.length) return;
            const confirmed = await CustomDialog.show({ title: 'حذف عدة أصناف', message: 'حذف ' + ids.length + ' صنف مع الاشتراكات داخلها؟', type: 'confirm', style: 'error', confirmText: 'نعم، احذف الكل', cancelText: 'إلغاء' });
            if (!confirmed) return;
            const delSubs = true;
            fetch('/api/vendor/categories/batch-delete', { method: 'POST', headers: { 'x-vendor-id': vendorId, 'Content-Type': 'application/json' }, body: JSON.stringify({ ids, delete_subs: delSubs }) })
                .then(r => r.json()).then(d => { if (d.success) { document.getElementById('select-all-cats').checked = false; loadCategories(); } });
        }

        async function batchDeleteSubs() {
            const ids = [...document.querySelectorAll('.sub-checkbox:checked')].map(cb => parseInt(cb.value));
            if (!ids.length) return;
            const confirmed = await CustomDialog.confirm('حذف ' + ids.length + ' اشتراك؟');
            if (!confirmed) return;
            fetch('/api/vendor/subscriptions/batch-delete', { method: 'POST', headers: { 'x-vendor-id': vendorId, 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) })
                .then(r => r.json()).then(d => { if (d.success) { document.getElementById('select-all-subs').checked = false; loadCategorySubs(currentCatId); } });
        }

        function updateBatchCatsBtn() {
            const checked = document.querySelectorAll('.cat-checkbox:checked').length;
            document.getElementById('batch-delete-cats-btn').classList.toggle('hidden', !checked);
            const all = document.querySelectorAll('.cat-checkbox').length;
            document.getElementById('select-all-cats').checked = checked === all && all > 0;
        }

        function updateBatchSubsBtn() {
            const checked = document.querySelectorAll('.sub-checkbox:checked').length;
            document.getElementById('batch-delete-subs-btn').classList.toggle('hidden', !checked);
            const all = document.querySelectorAll('.sub-checkbox').length;
            document.getElementById('select-all-subs').checked = checked === all && all > 0;
        }

        // ====== النشاطات ======
        function loadActivityLog() {
            fetch('/api/vendor/activity-log', { headers: { 'x-vendor-id': vendorId } })
                .then(r => r.json()).then(d => {
                    const list = document.getElementById('activity-log-list');
                    if (!d.success || !d.logs.length) {
                        list.innerHTML = '<p class="text-xs text-gray-400 text-center py-4">لا توجد نشاطات بعد</p>';
                        return;
                    }
                    list.innerHTML = d.logs.slice(0, 10).map(log => {
                        const emoji = log.action.includes('قبول') ? '✅' : log.action.includes('رفض') ? '❌' : log.action === 'create' || log.action.includes('إضافة') ? '➕' : log.action === 'update' || log.action.includes('تعديل') ? '✏️' : log.action === 'delete' || log.action.includes('حذف') ? '🗑️' : log.action.includes('طلب') ? '📩' : '📋';
                        return `
                        <div class="flex items-start gap-2 py-2 border-b border-gray-50 last:border-0">
                            <div class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-base flex-shrink-0">${emoji}</div>
                            <div>
                                <p class="text-xs text-gray-700">${esc(log.details || log.action)}</p>
                                <p class="text-[10px] text-gray-400">${log.created_at}</p>
                            </div>
                        </div>`;
                    }).join('');
                });
        }

        // ====== حذف الحساب ======
        function requestDeleteAccount() {
            document.getElementById('delete-reason-modal').classList.remove('hidden');
        }

        async function confirmDeleteAccount() {
            const reason = document.getElementById('delete-reason-input').value.trim();
            if (!reason) { await CustomDialog.error('الرجاء إدخال سبب حذف الحساب'); return; }
            document.getElementById('delete-reason-modal').classList.add('hidden');
            fetch('/api/vendor/request-delete', { method: 'POST', headers: { 'x-vendor-id': vendorId, 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) })
                .then(r => r.json()).then(d => {
                    const msg = document.getElementById('delete-account-msg');
                    msg.classList.remove('hidden');
                    if (d.success) {
                        msg.textContent = '✅ تم إرسال طلبك للإدارة. ستتلقى إشعاراً عند الرد.';
                        msg.className = 'text-xs text-green-600 mt-2';
                    } else {
                        msg.textContent = d.error || '❌ حدث خطأ';
                        msg.className = 'text-xs text-red-500 mt-2';
                    }
                });
        }

        // ====== عرض صنف معين ======
        let currentCatData = null;

        function enterCategory(catId) {
            currentCatId = catId;
            currentCatData = catsData.find(c => c.id === catId);
            if (!currentCatData) return;
            document.getElementById('categories-main-view').classList.add('hidden');
            document.getElementById('category-detail-view').classList.remove('hidden');
            document.getElementById('detail-cat-name').textContent = currentCatData.name;
            document.getElementById('detail-cat-desc').textContent = currentCatData.description || '';
            loadCategorySubs(catId);
        }

        function showCategoriesView() {
            currentCatId = null;
            currentCatData = null;
            document.getElementById('category-detail-view').classList.add('hidden');
            document.getElementById('categories-main-view').classList.remove('hidden');
            loadCategories();
        }

        function editCurrentCat() {
            if (currentCatData) editCat(currentCatData.id);
        }

        function loadCategorySubs(catId) {
            fetch('/api/vendor/subscriptions', { headers: { 'x-vendor-id': vendorId } })
                .then(r => r.json()).then(d => {
                    if (!d.success) return;
                    const filtered = d.subscriptions.filter(s => s.cat_id == catId);
                    subsData = d.subscriptions;
                    const grid = document.getElementById('cat-subs-grid');
                    grid.innerHTML = filtered.length ? filtered.map(s => {
                        const img = s.image_path ? `<img src="${s.image_path}" class="w-full h-28 object-cover cursor-pointer" onclick="window.open('${s.image_path}','_blank')">` : '';
                        return `
                        <div class="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 ${s.is_active ? '' : 'opacity-60'}">
                            ${img ? `<div class="h-28 bg-gray-100">${img}</div>` : '<div class="h-12 bg-gradient-to-br from-blue-50 to-indigo-50"></div>'}
                            <div class="p-4">
                                <div class="flex items-start justify-between mb-1">
                                    <div class="flex items-center gap-2">
                                        <input type="checkbox" class="sub-checkbox rounded border-gray-300" value="${s.id}" onchange="updateBatchSubsBtn()">
                                        <h4 class="font-bold text-black text-sm">${esc(s.name)}</h4>
                                    </div>
                                    <span class="text-sm font-bold text-emerald-600">${s.price} د.ل</span>
                                </div>
                                ${s.description ? `<p class="text-xs text-gray-500 mb-2">${esc(s.description)}</p>` : ''}
                                <div class="flex flex-wrap gap-1.5 mb-3">
                                    ${s.duration ? `<span class="bg-purple-50 text-purple-600 text-[10px] px-2 py-0.5 rounded-full">${s.duration}</span>` : ''}
                                    ${s.views > 0 ? `<span class="bg-blue-50 text-blue-500 text-[10px] px-2 py-0.5 rounded-full">👁 ${s.views}</span>` : ''}
                                    <span class="bg-amber-50 text-amber-600 text-[10px] px-2 py-0.5 rounded-full" title="العمولة">💰${s.effective_commission_rate}%</span>
                                    <span class="${s.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'} text-[10px] px-2 py-0.5 rounded-full">${s.is_active ? 'نشط' : 'موقف'}</span>
                                </div>
                                <div class="flex gap-1.5">
                                    <button onclick="editSub(${s.id})" class="flex-1 bg-gray-50 hover:bg-gray-100 text-gray-600 py-1.5 rounded-xl text-xs font-medium">تعديل</button>
                                    <button onclick="toggleSubStatus(${s.id}, ${s.is_active ? 0 : 1})" class="flex-1 ${s.is_active ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'} hover:opacity-80 py-1.5 rounded-xl text-xs font-medium">${s.is_active ? 'إيقاف' : 'تفعيل'}</button>
                                    <button onclick="deleteSub(${s.id})" class="bg-red-50 hover:bg-red-100 text-red-500 py-1.5 px-2.5 rounded-xl text-xs font-medium">×</button>
                                </div>
                            </div>
                        </div>`;
                    }).join('') : '<p class="text-gray-400 text-sm col-span-full text-center py-12">لا توجد اشتراكات في هذا الصنف بعد</p>';
                    document.getElementById('batch-delete-subs-btn').classList.add('hidden');
                    document.getElementById('select-all-subs').checked = false;
                });
        }

        // ====== نظام صندوق الحوار التفاعلي (Custom Dialog) ======
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
        return '<div class="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center text-2xl sm:text-3xl ' + bg + ' shadow-inner">' + icon + '</div>';
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
            async confirm(message, title = 'تأكيد') { return this.show({ title, message, type: 'confirm', style: 'question', confirmText: 'نعم', cancelText: 'إلغاء' }); },
            async prompt(message, defaultValue = '', title = 'إدخال') { return this.show({ title, message, type: 'prompt', style: 'info', confirmText: 'حفظ', inputPlaceholder: message, inputValue: defaultValue, showInput: true }); }
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

        // ====== متابعة حالة طلب حذف الحساب (إشعار فوري) ======
        function startDeletePolling() {
            if (!vendorId) return;
            fetch('/api/vendor/delete-response-status', { headers: { 'x-vendor-id': vendorId } })
                .then(r => r.json()).then(d => {
                    if (d.success && d.has_response) {
                        const shownKey = 'lastDeleteShownId_' + vendorId;
                        const shownId = localStorage.getItem(shownKey);
                        // أول تحميل: فقط سجّل المعرف بدون إظهار الإشعار
                        if (!shownId) {
                            localStorage.setItem(shownKey, String(d.id));
                            return;
                        }
                        // التحميلات التالية: إذا ظهر رد جديد → أظهر الإشعار
                        if (d.id !== parseInt(shownId)) {
                            localStorage.setItem(shownKey, String(d.id));
                            const msg = d.status === 'approved' ? 'تمت الموافقة على حذف حسابك' : 'تم رفض طلب حذف حسابك';
                            sendDesktopNotification('📋 رد على طلب الحذف', msg);
                            CustomDialog.show({ title: 'رد على طلب الحذف', message: msg, type: 'alert', style: d.status === 'approved' ? 'success' : 'info' });
                        }
                    }
                });
        }

        // ====== الاشتراكات ======
        function showAddSubModal() {
            document.getElementById('sub-modal-title').textContent = 'إضافة اشتراك جديد';
            document.getElementById('sub-id').value = '';
            document.getElementById('sub-form').reset();
            document.getElementById('sub-cat-id').value = currentCatId || '';
            document.getElementById('sub-image-placeholder').classList.remove('hidden');
            document.getElementById('sub-image-preview').classList.add('hidden');
            document.getElementById('sub-existing-image').value = '';
            document.getElementById('sub-modal').classList.remove('hidden');
        }

        function editSub(id) {
            const s = subsData.find(x => x.id === id);
            if (!s) return;
            document.getElementById('sub-modal-title').textContent = 'تعديل الاشتراك';
            document.getElementById('sub-id').value = s.id;
            document.getElementById('sub-cat-id').value = s.cat_id || currentCatId || '';
            document.getElementById('sub-name').value = s.name;
            document.getElementById('sub-desc').value = s.description || '';
            document.getElementById('sub-price').value = s.price;
            document.getElementById('sub-duration').value = s.duration || '';
            if (s.image_path) {
                document.getElementById('sub-image-img').src = s.image_path;
                document.getElementById('sub-image-placeholder').classList.add('hidden');
                document.getElementById('sub-image-preview').classList.remove('hidden');
                document.getElementById('sub-existing-image').value = s.image_path;
            } else {
                document.getElementById('sub-image-placeholder').classList.remove('hidden');
                document.getElementById('sub-image-preview').classList.add('hidden');
                document.getElementById('sub-existing-image').value = '';
            }
            document.getElementById('sub-image-input').value = '';
            document.getElementById('sub-modal').classList.remove('hidden');
        }

        function previewSubImage(event) {
            const file = event.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    document.getElementById('sub-image-img').src = e.target.result;
                    document.getElementById('sub-image-placeholder').classList.add('hidden');
                    document.getElementById('sub-image-preview').classList.remove('hidden');
                };
                reader.readAsDataURL(file);
            }
        }

        function saveSub() {
            const id = document.getElementById('sub-id').value;
            const formData = new FormData();
            formData.append('name', document.getElementById('sub-name').value);
            formData.append('description', document.getElementById('sub-desc').value);
            formData.append('price', parseFloat(document.getElementById('sub-price').value));
            formData.append('duration', document.getElementById('sub-duration').value);
            formData.append('category', '');
            formData.append('cat_id', document.getElementById('sub-cat-id').value || currentCatId || '');
            const imgInput = document.getElementById('sub-image-input');
            if (imgInput.files[0]) formData.append('sub_image', imgInput.files[0]);
            if (id) formData.append('existing_image', document.getElementById('sub-existing-image').value || '');
            const url = id ? '/api/vendor/subscriptions/' + id : '/api/vendor/subscriptions';
            const method = id ? 'PUT' : 'POST';
            fetch(url, { method, headers: { 'x-vendor-id': vendorId }, body: formData })
                .then(r => r.json()).then(d => {
                    if (d.success) {
                        document.getElementById('sub-modal').classList.add('hidden');
                        if (currentCatId) loadCategorySubs(currentCatId);
                        else loadCategories();
                    }
                });
        }

        function toggleSubStatus(id, is_active) {
            const s = subsData.find(x => x.id === id);
            if (!s) return;
            fetch('/api/vendor/subscriptions/' + id, {
                method: 'PUT',
                headers: { 'x-vendor-id': vendorId, 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: s.name, description: s.description, price: s.price, duration: s.duration, category: s.category || '', cat_id: s.cat_id || '', is_active, existing_image: s.image_path || '' })
            }).then(r => r.json()).then(d => { if (d.success) { if (currentCatId) loadCategorySubs(currentCatId); else loadCategories(); } });
        }

        async function deleteSub(id) {
            const confirmed = await CustomDialog.confirm('تأكيد حذف هذا الاشتراك؟');
            if (!confirmed) return;
            fetch('/api/vendor/subscriptions/' + id, { method: 'DELETE', headers: { 'x-vendor-id': vendorId } })
                .then(r => r.json()).then(d => { if (d.success) { if (currentCatId) loadCategorySubs(currentCatId); else loadCategories(); } });
        }

        // ====== الطلبات ======
        function loadOrders() {
            fetch('/api/vendor/orders', { headers: { 'x-vendor-id': vendorId } })
                .then(r => r.json()).then(d => {
                    if (!d.success) return;
                    ordersData = d.orders;
                    document.getElementById('ov-orders-count').textContent = d.orders.length;
                    document.getElementById('orders-total-badge').textContent = d.orders.length;
                    const revenue = d.orders.filter(function(o) { return o.status === 'completed'; }).reduce((sum, o) => sum + (o.vendor_share || 0), 0);
                    document.getElementById('ov-revenue-count').textContent = revenue.toFixed(2);
                    const tbody = document.getElementById('orders-table-body');
                    const mobileList = document.getElementById('orders-mobile-list');
                    const ordersHtml = d.orders.map(o => {
                        const statusClass = o.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : o.status === 'pending' ? 'bg-amber-50 text-amber-600' : o.status === 'awaiting_verification' ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600';
                        const statusText = o.status === 'completed' ? 'مكتمل' : o.status === 'pending' ? 'قيد الانتظار' : o.status === 'awaiting_verification' ? 'قيد التحقق' : 'ملغي';
                        const commissionHtml = o.status === 'completed' || o.status === 'pending' ? `<span class="text-gray-400 block xs:inline">عمولة ${o.commission_rate}%</span><span class="font-bold text-emerald-600 block xs:inline"> صافي ${o.vendor_share} د.ل</span>` : '<span class="text-gray-300">—</span>';
                        const actionsHtml = o.status === 'pending' ? `
                            <div class="flex items-center justify-center gap-1">
                                <button onclick="openVerifyModal(${o.id})" class="p-1.5 sm:p-2 rounded-lg hover:bg-emerald-50 text-gray-400 hover:text-emerald-600" title="تأكيد بصورة"><svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg></button>
                                <button onclick="updateOrderStatus(${o.id}, 'cancelled')" class="p-1.5 sm:p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500" title="إلغاء"><svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
                            </div>` : '-';
                        const dateStr = new Date(o.created_at).toLocaleDateString('ar-SA');
                        return {
                            table: `<tr class="border-b border-gray-50 hover:bg-gray-50/50">
                                <td class="p-3 sm:p-4 text-gray-400 text-xs">${o.id}</td>
                                <td class="p-3 sm:p-4 font-medium text-sm sm:text-base">${esc(o.customer_name)}</td>
                                <td class="p-3 sm:p-4 text-gray-500 text-xs" dir="ltr">${esc(o.customer_phone || '-')}</td>
                                <td class="p-3 sm:p-4 text-sm sm:text-base">${esc(o.subscription_name)}</td>
                                <td class="p-3 sm:p-4 font-bold text-sm sm:text-base">${o.amount} د.ل</td>
                                <td class="p-3 sm:p-4 text-xs sm:text-sm">${commissionHtml}</td>
                                <td class="p-3 sm:p-4"><span class="text-xs font-medium px-2 sm:px-2.5 py-1 rounded-full ${statusClass}">${statusText}</span></td>
                                <td class="p-3 sm:p-4 text-gray-400 text-xs">${dateStr}</td>
                                <td class="p-3 sm:p-4 text-center">${actionsHtml}</td>
                            </tr>`,
                            mobile: `<div class="bg-white animate-fade-in mb-4 border-2 border-gray-200 rounded-2xl shadow-sm shadow-gray-200/50 overflow-hidden">
                                <!-- رأس البطاقة رقم + الحالة -->
                                <div class="flex items-center justify-between mb-4 pb-4 border-b border-gray-100 px-5">
                                    <div class="flex items-center gap-3">
                                        <div class="w-11 h-11 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center shadow-sm">
                                            <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"></path></svg>
                                        </div>
                                        <div>
                                            <span class="text-[10px] text-gray-400 block leading-tight">رقم الطلب</span>
                                            <span class="text-xl font-black text-gray-900">#${o.id}</span>
                                        </div>
                                    </div>
                                    <span class="text-sm font-bold px-4 py-2 rounded-xl ${statusClass} border shadow-sm">${statusText}</span>
                                </div>
                                <!-- بيانات الطلب -->
                                <div class="px-5 pb-5 space-y-3">
                                    <!-- الزبون -->
                                    <div class="flex items-center justify-between bg-gradient-to-l from-gray-50/80 to-transparent px-4 py-3.5 rounded-2xl">
                                        <div class="flex items-center gap-2.5">
                                            <svg class="w-[18px] h-[18px] text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                                            <span class="text-sm text-gray-400 font-medium">الزبون</span>
                                        </div>
                                        <span class="text-base font-bold text-gray-900">${esc(o.customer_name)}</span>
                                    </div>
                                    <!-- الهاتف -->
                                    <div class="flex items-center justify-between px-4 py-3.5">
                                        <div class="flex items-center gap-2.5">
                                            <svg class="w-[18px] h-[18px] text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                                            <span class="text-sm text-gray-400 font-medium">الهاتف</span>
                                        </div>
                                        <span dir="ltr" class="text-base text-gray-700 font-semibold tabular-nums">${esc(o.customer_phone || '-')}</span>
                                    </div>
                                    <!-- الاشتراك -->
                                    <div class="flex items-center justify-between bg-gradient-to-l from-gray-50/80 to-transparent px-4 py-3.5 rounded-2xl">
                                        <div class="flex items-center gap-2.5">
                                            <svg class="w-[18px] h-[18px] text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>
                                            <span class="text-sm text-gray-400 font-medium">الاشتراك</span>
                                        </div>
                                        <span class="text-base font-bold text-gray-800 max-w-[55%] text-left">${esc(o.subscription_name)}</span>
                                    </div>
                                    <!-- المبلغ -->
                                    <div class="flex items-center justify-between px-4 py-3.5">
                                        <div class="flex items-center gap-2.5">
                                            <svg class="w-[18px] h-[18px] text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                            <span class="text-sm text-gray-400 font-medium">المبلغ</span>
                                        </div>
                                        <span class="text-lg font-extrabold text-gray-900">${o.amount} <span class="text-sm font-medium text-gray-500">د.ل</span></span>
                                    </div>
                                    <!-- العمولة (فقط pending/completed) -->
                                    ${o.status === 'completed' || o.status === 'pending' || o.status === 'awaiting_verification' ? `
                                    <div class="bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-2xl p-4 border border-emerald-200/60">
                                        <div class="flex items-center gap-2 mb-3">
                                            <div class="w-7 h-7 rounded-lg bg-emerald-200/50 flex items-center justify-center">
                                                <svg class="w-[15px] h-[15px] text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
                                            </div>
                                            <span class="text-sm font-bold text-emerald-700">تفاصيل العمولة</span>
                                        </div>
                                        <div class="space-y-2">
                                            <div class="flex items-center justify-between">
                                                <span class="text-xs text-emerald-600/80">نسبة العمولة</span>
                                                <span class="text-sm font-bold text-emerald-800 bg-white/70 px-3 py-1 rounded-lg">${o.commission_rate}%</span>
                                            </div>
                                            <div class="flex items-center justify-between pt-2 border-t border-emerald-200/50">
                                                <span class="text-xs text-emerald-600/80 font-medium">صافي أرباحك</span>
                                                <span class="text-lg font-black text-emerald-700">${o.vendor_share} <span class="text-sm font-semibold">د.ل</span></span>
                                            </div>
                                        </div>
                                    </div>` : ''}
                                    <!-- التاريخ -->
                                    <div class="flex items-center justify-between bg-gradient-to-l from-gray-50/80 to-transparent px-4 py-3.5 rounded-2xl">
                                        <div class="flex items-center gap-2.5">
                                            <svg class="w-[18px] h-[18px] text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                            <span class="text-sm text-gray-400 font-medium">التاريخ</span>
                                        </div>
                                        <span class="text-sm font-medium text-gray-600">${dateStr}</span>
                                    </div>
                                    <!-- أزرار الإجراءات (للطلبات قيد الانتظار) -->
                                    ${o.status === 'pending' ? `
                                    <div class="flex gap-3 pt-2">
                                        <button onclick="openVerifyModal(${o.id})" class="flex-1 bg-gradient-to-l from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white py-[14px] rounded-2xl text-base font-bold shadow-lg shadow-emerald-200/50 active:scale-[0.97] transition-all duration-150 flex items-center justify-center gap-2">
                                            <svg class="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg>
                                            تأكيد بصورة
                                        </button>
                                        <button onclick="updateOrderStatus(${o.id}, 'cancelled')" class="flex-1 bg-gradient-to-l from-red-50 to-red-100 hover:from-red-100 hover:to-red-200 text-red-600 py-[14px] rounded-2xl text-base font-bold border-2 border-red-200 active:scale-[0.97] transition-all duration-150 flex items-center justify-center gap-2">
                                            <svg class="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                                            رفض
                                        </button>
                                    </div>` : o.status === 'awaiting_verification' ? `
                                    <div class="flex gap-3 pt-2">
                                        <div class="flex-1 bg-blue-50 text-blue-600 py-3 rounded-2xl text-sm font-bold text-center border border-blue-200 flex items-center justify-center gap-2">
                                            <svg class="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                            في انتظار مراجعة الإدارة
                                        </div>
                                    </div>` : ''}
                                </div>
                            </div>`
                        };
                    });
                    tbody.innerHTML = ordersHtml.length ? ordersHtml.map(h => h.table).join('') : '<tr><td colspan="9" class="p-8 text-center text-gray-400">لا توجد طلبات</td></tr>';
                    mobileList.innerHTML = ordersHtml.length ? ordersHtml.map(h => h.mobile).join('') : '<div id="orders-empty" class="flex flex-col items-center justify-center py-12 px-5 animate-fade-in"><svg class="w-14 h-14 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9 14l2 2 4-4"/></svg><p class="empty-title">لا توجد طلبات بعد</p><p class="text-sm text-gray-400">عندما يطلب أحد العملاء اشتراكاً، سيظهر هنا</p></div>';
                });
        }

        function updateOrderStatus(id, status) {
            fetch('/api/vendor/orders/' + id + '/status', { method: 'PATCH', headers: { 'x-vendor-id': vendorId, 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
                .then(r => r.json()).then(d => { if (d.success) loadOrders(); });
        }

        let verifyOrderId = null;
        let ordersData = [];
        function openVerifyModal(id) {
            const order = ordersData.find(function(o) { return o.id === id; });
            if (!order) return;
            verifyOrderId = order.id;
            document.getElementById('v-customer-name').textContent = order.customer_name;
            document.getElementById('v-sub-name').textContent = order.subscription_name;
            document.getElementById('v-amount').textContent = order.amount + ' د.ل';
            document.getElementById('verify-file-input').value = '';
            document.getElementById('verify-file-list').innerHTML = '';
            document.getElementById('verify-upload-area').classList.remove('border-emerald-400');
            document.getElementById('verify-upload-area').classList.add('border-gray-300');
            document.getElementById('verify-submit-btn').disabled = false;
            document.getElementById('verify-submit-btn').innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>\u0625\u0631\u0633\u0627\u0644 \u0644\u0644\u0625\u062F\u0627\u0631\u0629';
            document.getElementById('verify-modal').classList.remove('hidden');
        }
        function closeVerifyModal() {
            document.getElementById('verify-modal').classList.add('hidden');
            verifyOrderId = null;
        }
        function updateFileList(input) {
            const list = document.getElementById('verify-file-list');
            const area = document.getElementById('verify-upload-area');
            list.innerHTML = '';
            if (input.files && input.files.length > 0) {
                area.classList.add('border-emerald-400');
                area.classList.remove('border-gray-300');
                for (let i = 0; i < input.files.length; i++) {
                    const f = input.files[i];
                    const div = document.createElement('div');
                    div.className = 'text-xs bg-emerald-50 text-emerald-700 px-2.5 py-1.5 rounded-lg font-medium border border-emerald-200';
                    div.textContent = (i + 1) + '. ' + f.name;
                    list.appendChild(div);
                }
            } else {
                area.classList.remove('border-emerald-400');
                area.classList.add('border-gray-300');
            }
        }
        function submitVerification() {
            const fileInput = document.getElementById('verify-file-input');
            if (!fileInput.files || !fileInput.files.length) {
                CustomDialog.error('\u064A\u0631\u062C\u0649 \u0631\u0641\u0639 \u0635\u0648\u0631 \u0634\u0627\u0634\u0629 \u0648\u0627\u062A\u0633\u0627\u0628');
                return;
            }
            const btn = document.getElementById('verify-submit-btn');
            btn.disabled = true;
            btn.innerHTML = '<svg class="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg> \u062C\u0627\u0631\u064A \u0627\u0644\u0625\u0631\u0633\u0627\u0644...';
            const formData = new FormData();
            for (let i = 0; i < fileInput.files.length; i++) {
                formData.append('screenshots', fileInput.files[i]);
            }
            fetch('/api/vendor/orders/' + verifyOrderId + '/verify', { method: 'POST', headers: { 'x-vendor-id': vendorId }, body: formData })
                .then(r => r.json()).then(d => {
                    if (d.success) {
                        closeVerifyModal();
                        CustomDialog.success(d.message);
                        loadOrders();
                    } else {
                        btn.disabled = false;
                        btn.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>\u0625\u0631\u0633\u0627\u0644 \u0644\u0644\u0625\u062F\u0627\u0631\u0629';
                        CustomDialog.error(d.message);
                    }
                }).catch(function() {
                    btn.disabled = false;
                    btn.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>\u0625\u0631\u0633\u0627\u0644 \u0644\u0644\u0625\u062F\u0627\u0631\u0629';
                    CustomDialog.error('\u062D\u062F\u062B \u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u0627\u062A\u0635\u0627\u0644');
                });
        }

        // ====== الملف الشخصي ======
        function loadProfile() {
            const msg = document.getElementById('delete-account-msg');
            if (msg) { msg.classList.add('hidden'); }
            fetch('/api/vendor/profile', { headers: { 'x-vendor-id': vendorId } })
                .then(r => r.json()).then(d => {
                    if (!d.success) return;
                    const v = d.vendor;
                    const photo = v.photo_path ? `<img src="${v.photo_path}" class="w-20 h-20 rounded-2xl object-cover shadow-md">` : `<div class="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-md">${(v.display_name||'م')[0]}</div>`;
                    document.getElementById('profile-content').innerHTML = `
                        <div class="flex items-center gap-6 pb-6 border-b border-gray-100">
                            ${photo}
                            <div>
                                <h3 class="text-xl font-bold text-black">${esc(v.display_name || v.username)}</h3>
                                <p class="text-sm text-gray-500">@${esc(v.username)}</p>
                                <span class="inline-block mt-1 bg-emerald-50 text-emerald-600 text-xs font-medium px-3 py-1 rounded-full">نشط</span>
                            </div>
                        </div>
                        <div class="space-y-3 pt-4 text-sm">
                            <div class="flex justify-between py-2 border-b border-gray-50"><span class="text-gray-500">الاسم</span><span class="font-medium">${esc(v.fullname || '-')}</span></div>
                            <div class="flex justify-between py-2 border-b border-gray-50"><span class="text-gray-500">العمر</span><span class="font-medium">${esc(v.age ? v.age + ' سنة' : '-')}</span></div>
                            <div class="flex justify-between py-2 border-b border-gray-50"><span class="text-gray-500">المدينة</span><span class="font-medium">${esc(v.location || '-')}</span></div>
                            <div class="flex justify-between py-2 border-b border-gray-50"><span class="text-gray-500">البريد</span><span class="font-medium" dir="ltr">${esc(v.email || '-')}</span></div>
                            <div class="flex justify-between py-2 border-b border-gray-50"><span class="text-gray-500">واتساب</span><span class="font-medium" dir="ltr">${esc(v.phone || '-')}</span></div>
                            <div class="flex justify-between py-2 border-b border-gray-50"><span class="text-gray-500">نسبة عمولة المنصة</span><span class="font-medium text-blue-600">${v.effective_commission_rate !== undefined ? v.effective_commission_rate + '%' : '-'}</span></div>
                            ${v.commission_rate !== null && v.commission_rate !== undefined ? `<div class="flex justify-between py-2 border-b border-gray-50 text-[10px]"><span class="text-gray-400">عمولة خاصة بك</span><span class="text-gray-400">${v.commission_rate}%</span></div>` : `<div class="flex justify-between py-2 border-b border-gray-50 text-[10px]"><span class="text-gray-400">عمولة عامة</span><span class="text-gray-400">${v.global_commission_rate !== undefined ? v.global_commission_rate + '%' : '-'}</span></div>`}
                            <div class="flex justify-between py-2"><span class="text-gray-500">التسجيل</span><span class="font-medium">${new Date(v.created_at).toLocaleDateString('ar-SA')}</span></div>
                        </div>`;
                    if (v.delete_requested) {
                        const delMsg = document.getElementById('delete-account-msg');
                        if (delMsg) {
                            delMsg.classList.remove('hidden');
                            delMsg.textContent = '⏳ في انتظار موافقة الإدارة على طلب الحذف';
                            delMsg.className = 'text-xs text-amber-600 mt-2';
                        }
                    }
                    loadActivityLog();
                });
        }

        // ====== نقاط المزود ======
        function loadVendorPoints() {
            fetch('/api/vendor/points', { headers: { 'x-vendor-id': vendorId } })
                .then(r => r.json()).then(d => {
                    if (!d.success) return;
                    document.getElementById('ov-points-count').textContent = d.points;
                    document.getElementById('profile-points').textContent = d.points + ' نقطة';
                    document.getElementById('profile-commission-rate').textContent = d.effective_commission_rate + '%';
                    const redDiv = document.getElementById('profile-reductions');
                    if (d.reductions && d.reductions.length) {
                        redDiv.classList.remove('hidden');
                        redDiv.innerHTML = d.reductions.map(r => 'تخفيض عمولة ' + r.reduction_percent + '% حتى ' + new Date(r.expires_at).toLocaleString('ar-SA')).join('<br>');
                    } else {
                        redDiv.classList.add('hidden');
                    }
                });
        }

        function openRedeemModal() {
            fetch('/api/vendor/points', { headers: { 'x-vendor-id': vendorId } })
                .then(r => r.json()).then(d => {
                    if (!d.success) return;
                    document.getElementById('redeem-balance').textContent = d.points + ' نقطة';
                    document.getElementById('redeem-current-rate').textContent = d.effective_commission_rate + '%';
                    document.getElementById('redeem-points-input').value = '';
                    document.getElementById('redeem-info').classList.add('hidden');
                    document.getElementById('redeem-modal').classList.remove('hidden');
                });
        }

        function confirmRedeem() {
            const pts = parseInt(document.getElementById('redeem-points-input').value);
            if (!pts || pts <= 0) { CustomDialog.error('أدخل عدد النقاط'); return; }
            const balanceText = document.getElementById('redeem-balance').textContent;
            const balance = parseInt(balanceText.replace(/[^0-9]/g, '')) || 0;
            if (pts > balance) { CustomDialog.error('رصيد النقاط غير كافٍ. رصيدك: ' + balance + ' نقطة'); return; }
            fetch('/api/vendor/redeem-points', { method: 'POST', headers: { 'x-vendor-id': vendorId, 'Content-Type': 'application/json' }, body: JSON.stringify({ points: pts }) })
                .then(r => r.json()).then(d => {
                    if (d.success) {
                        CustomDialog.success(d.message);
                        document.getElementById('redeem-modal').classList.add('hidden');
                        loadVendorPoints();
                        loadProfile();
                    } else {
                        CustomDialog.error(d.message);
                    }
                }).catch(function(e) { CustomDialog.error('حدث خطأ في الاتصال'); });
        }
    