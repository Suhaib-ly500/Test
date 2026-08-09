
        let cart = [];
        let currentSubDetail = null;
        let customerPoints = 0;
        let offersMap = {};

        function loadOffersMap() {
            fetch('/api/customer-offers/active').then(r => r.json()).then(d => {
                if (d.success && d.offers) {
                    d.offers.forEach(function(o) { offersMap[o.subscription_id] = o.discount_percent; });
                }
            }).catch(function(){});
        }
        loadOffersMap();
        let pointsDiscountPerPoint = 0.5;
        let pointsMaxDiscountPercent = 30;
        let appliedPointsDiscount = 0;
        let pointsToUse = 0;

        function cartToast(name) {
            const toast = document.getElementById('toast');
            document.getElementById('toast-title').innerText = 'تم إضافة: ' + name;
            toast.classList.remove('translate-y-20', 'opacity-0', 'pointer-events-none');
            setTimeout(() => toast.classList.add('translate-y-20', 'opacity-0', 'pointer-events-none'), 2500);
        }

        function updateCartBadge() {
            const badge = document.getElementById('cart-badge');
            badge.textContent = cart.length;
            if (cart.length > 0) { badge.classList.remove('opacity-0', 'scale-50'); badge.classList.add('opacity-100', 'scale-100'); }
            else { badge.classList.add('opacity-0', 'scale-50'); badge.classList.remove('opacity-100', 'scale-100'); }
        }

        function addToCart(item) {
            if (!item) return;
            const exists = cart.find(i => i.vendor_id === item.vendor_id && i.subscription_name === item.subscription_name);
            if (exists) { cartToast(item.subscription_name + ' (موجود مسبقاً)'); return; }
            cart.push({ ...item });
            updateCartBadge();
            cartToast(item.subscription_name);
            document.getElementById('sub-detail-modal').classList.add('hidden');
        }

        function removeFromCart(index) { cart.splice(index, 1); renderCart(); updateCartBadge(); }

        function renderCart() {
            const list = document.getElementById('cart-items-list');
            const footer = document.getElementById('cart-footer');
            if (!cart.length) {
                list.innerHTML = '<p class="text-deep-400 text-sm text-center py-8">سلتك فارغة. تصفح الاشتراكات وأضف ما يعجبك!</p>';
                footer.classList.add('hidden'); return;
            }
            footer.classList.remove('hidden');
            let total = 0;
            list.innerHTML = cart.map((item, i) => {
                total += parseFloat(item.amount) || 0;
                return '<div class="flex items-center gap-3 p-3 bg-deep-50 rounded-2xl mb-2 border border-deep-100/50 sub-item-card">' +
                    '<div class="w-10 h-10 bg-gradient-to-br from-brand to-emerald-600 rounded-xl flex items-center justify-center text-white font-bold shrink-0 text-sm shadow-sm">' + (item.subscription_name ? item.subscription_name[0] : '?') + '</div>' +
                    '<div class="flex-1 min-w-0"><p class="text-sm font-bold text-deep">' + (item.subscription_name || '') + '</p><p class="text-[10px] text-deep-400">' + (item.vendor_display || '') + ' · ' + (item.duration || '') + '</p></div>' +
                    '<span class="text-sm font-bold text-brand shrink-0">' + (item.amount || 0) + ' د.ل</span>' +
                    '<button onclick="removeFromCart(' + i + ')" class="text-red-400 hover:text-red-600 smooth-transition p-1.5 hover:bg-red-50 rounded-xl"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button></div>';
            }).join('');
            document.getElementById('cart-total').textContent = total + ' د.ل';
        }

        function openCart() { renderCart(); document.getElementById('cart-modal').classList.remove('hidden'); }

        function updateCartConfirmNote() {
            const name = (document.getElementById('checkout-name').value || '').trim();
            const phone = (document.getElementById('checkout-phone').value || '').trim();
            const note = document.getElementById('cart-confirm-note');
            if (name && phone && cart.length) {
                const total = cart.reduce(function(s, i) { return s + (parseFloat(i.amount) || 0); }, 0);
                document.getElementById('cart-confirm-count').textContent = cart.length;
                document.getElementById('cart-confirm-total').textContent = total.toFixed(2);
                note.classList.remove('hidden');
            } else { note.classList.add('hidden'); }
        }

        function checkout() {
            document.getElementById('cart-modal').classList.add('hidden');
            document.getElementById('cart-confirm-note').classList.add('hidden');
            document.getElementById('terms-confirm-note').classList.add('hidden');
            appliedPointsDiscount = 0;
            pointsToUse = 0;
            document.getElementById('points-to-use').value = '0';
            document.getElementById('points-section').classList.add('hidden');
            document.getElementById('points-discount-info').classList.add('hidden');
            let total = 0;
            const summary = document.getElementById('checkout-summary');
            summary.innerHTML = cart.map(function(item) { total += parseFloat(item.amount) || 0; return '<div class="flex justify-between text-xs"><span class="text-deep-500">' + (item.subscription_name || '') + '</span><span class="font-bold text-deep">' + (item.amount || 0) + ' د.ل</span></div>'; }).join('') + '<div class="flex justify-between text-sm font-bold border-t border-deep-200 pt-2 mt-2"><span class="text-deep">المجموع</span><span class="text-brand">' + total + ' د.ل</span></div>';
            document.getElementById('checkout-modal').classList.remove('hidden');
        }

        function fetchCustomerPoints(phone) {
            if (!phone || phone.length < 8) { document.getElementById('points-section').classList.add('hidden'); return; }
            fetch('/api/points-settings-public').then(r => r.json()).then(s => {
                if (s.success) {
                    pointsDiscountPerPoint = s.settings.customer_point_discount || 0.5;
                    pointsMaxDiscountPercent = s.settings.customer_max_discount_percent || 30;
                }
            });
            fetch('/api/customer-points/' + encodeURIComponent(phone)).then(r => r.json()).then(d => {
                if (d.success && d.points > 0) {
                    customerPoints = d.points;
                    document.getElementById('points-balance').textContent = d.points + ' نقطة';
                    document.getElementById('points-section').classList.remove('hidden');
                } else {
                    document.getElementById('points-section').classList.add('hidden');
                }
            });
        }

        function updatePointsDiscount() {
            const val = parseInt(document.getElementById('points-to-use').value) || 0;
            const maxPoints = Math.min(val, customerPoints);
            pointsToUse = maxPoints;
            appliedPointsDiscount = maxPoints * pointsDiscountPerPoint;
            const cartTotal = cart.reduce(function(sum, item) { return sum + (parseFloat(item.amount) || 0); }, 0);
            const maxDiscount = cartTotal * pointsMaxDiscountPercent / 100;
            if (appliedPointsDiscount > maxDiscount) {
                appliedPointsDiscount = maxDiscount;
                pointsToUse = Math.ceil(appliedPointsDiscount / pointsDiscountPerPoint);
                document.getElementById('points-to-use').value = pointsToUse;
                document.getElementById('points-discount-amount').textContent = appliedPointsDiscount.toFixed(2);
            } else {
                if (maxPoints < val) document.getElementById('points-to-use').value = maxPoints;
                document.getElementById('points-discount-amount').textContent = appliedPointsDiscount.toFixed(2);
            }
        }

        function applyPointsDiscount() {
            pointsToUse = parseInt(document.getElementById('points-to-use').value) || 0;
            if (pointsToUse <= 0 || pointsToUse > customerPoints) { CustomDialog.error('عدد النقاط غير صالح'); return; }
            updatePointsDiscount();
            if (appliedPointsDiscount <= 0) { CustomDialog.error('الخصم صفر، حاول مرة أخرى'); return; }
            const totalEl = document.getElementById('checkout-summary');
            const cartTotal = cart.reduce(function(sum, item) { return sum + (parseFloat(item.amount) || 0); }, 0);
            const newTotal = cartTotal - appliedPointsDiscount;
            totalEl.innerHTML = totalEl.innerHTML.replace(/المجموع<.*?<\/span><span class="text-brand">.*?<\/span>/, 'المجموع</span><span class="text-brand line-through text-gray-400 text-xs ml-2">' + cartTotal.toFixed(2) + ' د.ل</span><span class="text-amber-600">' + newTotal.toFixed(2) + ' د.ل</span>');
            document.getElementById('points-discount-info').classList.remove('hidden');
            CustomDialog.success('تم تطبيق الخصم بنجاح!');
        }

        // دالة نسخ احتياطي للحافظة
        function fallbackCopy(text) {
            var ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy'); showToast('✅ تم نسخ الرسالة'); } catch(e) {}
            document.body.removeChild(ta);
        }
        // دالة إشعار مؤقت (توست)
        function showToast(msg) {
            var el = document.createElement('div');
            el.textContent = msg;
            el.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#1a1a2e;color:#fff;padding:12px 24px;border-radius:12px;font-size:13px;z-index:9999;direction:rtl;box-shadow:0 8px 32px rgba(0,0,0,0.3);animation:fadeInUp 0.3s ease';
            document.body.appendChild(el);
            setTimeout(function() { el.style.opacity = '0'; el.style.transition = 'opacity 0.5s'; setTimeout(function() { el.remove(); }, 500); }, 4000);
        }

        // قراءة CSRF token من الصفحة
        var csrfToken = (document.querySelector('meta[name="csrf-token"]') || {}).content || '';

function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function escAttr(s) { return esc(s); }
function escJs(s) { return JSON.stringify(String(s == null ? '' : s)); }

        var lastOrderMsgs = [];
        var lastOrderCopyMsg = '';

        function whatsappNumber(v) {
            var num = String(v.phone || '').replace(/[^0-9]/g, '');
            if (num.startsWith('0')) num = '218' + num.slice(1);
            else if (!num.startsWith('218')) num = '218' + num;
            return num;
        }

        function showOrderSuccess(cartItems, d) {
            lastOrderMsgs = [];
            lastOrderCopyMsg = '';
            var ptsEl = document.getElementById('order-success-points');
            if (d.points_earned > 0) {
                ptsEl.classList.remove('hidden');
                ptsEl.innerHTML = '🎉 مبروك! تمت إضافة <b>' + d.points_earned + '</b> نقطة إلى رصيدك';
            } else { ptsEl.classList.add('hidden'); }
            var itemsEl = document.getElementById('order-success-items');
            itemsEl.innerHTML = cartItems.map(function(item, i) {
                return '<div class="flex justify-between text-deep-500"><span>' + (i + 1) + ') ' + esc(item.subscription_name) + '</span><span class="font-bold">' + (parseFloat(item.amount) || 0).toFixed(2) + ' د.ل</span></div>';
            }).join('');
            var vendorsEl = document.getElementById('order-success-vendors');
            var html = '';
            if (d.vendors && d.vendors.length) {
                d.vendors.forEach(function(v, idx) {
                    if (!v.phone) return;
                    var vendorItems = cartItems.filter(function(item) { return item.vendor_id == v.id; });
                    var discountPerItem = d.discount_amount ? (d.discount_amount / vendorItems.length) : 0;
                    var itemsList = vendorItems.map(function(item, i) {
                        var discounted = (parseFloat(item.amount) || 0) - discountPerItem;
                        var priceStr = d.discount_amount > 0 ? discounted.toFixed(2) + ' د.ل (بدلاً من ' + item.amount + ')' : item.amount + ' د.ل';
                        return (i + 1) + '- ' + item.subscription_name + ' (' + priceStr + ')';
                    }).join('\n');
                    var totalAmount = vendorItems.reduce(function(sum, item) { return sum + (parseFloat(item.amount) || 0); }, 0);
                    var finalTotal = d.discount_amount > 0 ? (totalAmount - (d.discount_amount / d.vendors.length)).toFixed(2) : totalAmount.toFixed(2);
                    var msg = 'السلام عليكم 👋\nطلب جديد من متجر ماتريكس برو\n\n👤 اسم العميل: ' + document.getElementById('checkout-name').value.trim() + '\n📱 رقم الهاتف: ' + document.getElementById('checkout-phone').value.trim() + '\n\n🛒 المشتريات:\n' + itemsList + '\n\n💰 المجموع الكلي: ' + finalTotal + ' د.ل' + (d.points_earned > 0 ? '\n\n🎉 تم إضافة ' + d.points_earned + ' نقطة إلى رصيدك!' : '') + '\n\nأرجو تأكيد الطلب وشكراً.';
                    lastOrderMsgs.push({ phone: whatsappNumber(v), msg: msg, name: esc(v.display_name || v.username || 'المزود') });
                    html += '<div class="bg-white border border-deep-100 rounded-2xl p-3.5 flex items-center justify-between gap-2"><div><div class="text-xs font-bold text-deep-600">' + esc(v.display_name || v.username || 'المزود') + '</div><div class="text-[10px] text-deep-400">' + vendorItems.length + ' اشتراكات • ' + finalTotal + ' د.ل</div></div>' + '<button onclick="sendOrderWhatsApp(' + idx + ')" class="bg-gradient-to-l from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold smooth-transition shadow-md shadow-emerald-200 flex items-center gap-1.5"><svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg> واتساب</button></div>';
                });
            }
            vendorsEl.innerHTML = html || '<div class="text-xs text-deep-400">لا توجد أرقام واتساب للمزودين بعد</div>';
            lastOrderCopyMsg = lastOrderMsgs.map(function(m) { return m.msg; }).join('\n\n==========\n\n');
            document.getElementById('order-success-modal').classList.remove('hidden');
        }

        function sendOrderWhatsApp(idx) {
            var m = lastOrderMsgs[idx];
            if (!m) return;
            window.open('https://wa.me/' + m.phone + '?text=' + encodeURIComponent(m.msg), '_blank');
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(m.msg).then(function() { showToast('✅ الرسالة جاهزة في واتساب'); }).catch(function() { fallbackCopy(m.msg); });
            } else { fallbackCopy(m.msg); }
        }

        function copyLastOrderMsg() {
            if (!lastOrderCopyMsg) return;
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(lastOrderCopyMsg).then(function() { showToast('✅ تم نسخ الرسالة كاملة'); }).catch(function() { fallbackCopy(lastOrderCopyMsg); });
            } else { fallbackCopy(lastOrderCopyMsg); }
        }

        function submitOrder() {
            var name = document.getElementById('checkout-name').value.trim();
            var phone = document.getElementById('checkout-phone').value.trim();
            if (!name || !phone) { alert('يرجى إدخال الاسم ورقم الهاتف'); return; }
            if (!cart.length) { alert('السلة فارغة'); return; }
            if (!document.getElementById('agree-terms').checked) { CustomDialog.warning('يرجى الموافقة على الشروط والأحكام وسياسة الخصوصية أولاً'); return; }
            fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrfToken },
                body: JSON.stringify({ customer_name: name, customer_phone: phone, items: cart, discount_amount: appliedPointsDiscount, points_used: pointsToUse })
            }).then(function(r) { return r.json(); }).then(function(d) {
                if (d.success) {
                    var cartItems = cart.slice();
                    cart = []; updateCartBadge();
                    document.getElementById('checkout-modal').classList.add('hidden');
                    showOrderSuccess(cartItems, d);
                } else { alert('❌ ' + d.message); }
            }).catch(function() { alert('❌ فشل الاتصال بالسيرفر'); });
        }

        function showSubDetail(sub, vendorName) {
            currentSubDetail = { vendor_id: sub.vendor_id, subscription_name: sub.name, amount: sub.price, duration: sub.duration || '', vendor_display: vendorName || '' };
            document.getElementById('sub-detail-name').textContent = sub.name;
            document.getElementById('sub-detail-vendor').textContent = vendorName ? 'بواسطة ' + vendorName : '';
            document.getElementById('sub-detail-price').textContent = sub.price + ' د.ل';
            document.getElementById('sub-detail-desc').textContent = sub.description || 'لا يوجد وصف';
            document.getElementById('sub-detail-duration').textContent = sub.duration || '';
            var pausedEl = document.getElementById('sub-detail-paused');
            var addBtn = document.getElementById('sub-detail-add-btn');
            if (sub.is_paused) {
                if (pausedEl) pausedEl.classList.remove('hidden');
                if (addBtn) { addBtn.disabled = true; addBtn.classList.add('opacity-50', 'pointer-events-none'); }
            } else {
                if (pausedEl) pausedEl.classList.add('hidden');
                if (addBtn) { addBtn.disabled = false; addBtn.classList.remove('opacity-50', 'pointer-events-none'); }
            }
            var img = document.getElementById('sub-detail-img');
            if (sub.image_path) { img.innerHTML = '<img src="' + escAttr(sub.image_path) + '" class="w-full h-auto">'; }
            else { img.innerHTML = '<div class="w-full h-44 bg-gradient-to-br from-deep-50 to-brand-50 flex items-center justify-center text-4xl">📦</div>'; }
            document.getElementById('sub-detail-modal').classList.remove('hidden');
            // تسجيل المشاهدة
            fetch('/api/marketplace/view/' + sub.id, { method: 'POST', headers: { 'x-csrf-token': csrfToken } }).catch(function(){});
        }

        function toggleModal(show) {
            const modal = document.getElementById('auth-modal');
            if (!modal) return;
            const inner = modal.querySelector('div');
            if(show) { modal.classList.remove('opacity-0', 'pointer-events-none'); inner.classList.remove('scale-95'); inner.classList.add('scale-100'); }
            else { modal.classList.add('opacity-0', 'pointer-events-none'); inner.classList.remove('scale-100'); inner.classList.add('scale-95'); }
        }

        function filterApps(category, btn) {
            const buttons = document.querySelectorAll('.filter-btn');
            buttons.forEach(b => { b.classList.remove('bg-deep', 'text-white'); b.classList.add('bg-deep-50', 'text-deep-500'); });
            btn.classList.remove('bg-deep-50', 'text-deep-500');
            btn.classList.add('bg-deep', 'text-white');
            const cards = document.querySelectorAll('.app-card');
            cards.forEach(card => { if(category === 'all' || card.getAttribute('data-category') === category) { card.style.opacity = '1'; card.style.display = 'flex'; } else { card.style.opacity = '0'; card.style.display = 'none'; } });
        }

        function closeModal(id) { document.getElementById(id).style.display = 'none'; }
        function openModal(id) { document.getElementById(id).style.display = ''; }
        function toggleVendorModal(show) {
            const modal = document.getElementById('vendor-modal');
            const inner = modal.querySelector('div');
            if(show) { modal.classList.remove('opacity-0', 'pointer-events-none'); inner.classList.remove('scale-90'); inner.classList.add('scale-100'); document.body.style.overflow = 'hidden'; }
            else { modal.classList.add('opacity-0', 'pointer-events-none'); inner.classList.remove('scale-100'); inner.classList.add('scale-90'); document.body.style.overflow = ''; }
        }

        function toggleMobileMenu() {
            const menu = document.getElementById('mobile-menu');
            const icon = document.getElementById('hamburger-icon');
            const close = document.getElementById('hamburger-close');
            menu.classList.toggle('hidden');
            icon.classList.toggle('hidden');
            close.classList.toggle('hidden');
        }

        function closeMobileMenu() {
            const menu = document.getElementById('mobile-menu');
            const icon = document.getElementById('hamburger-icon');
            const close = document.getElementById('hamburger-close');
            menu.classList.add('hidden');
            icon.classList.remove('hidden');
            close.classList.add('hidden');
        }

        let isVendorRegister = false;

        function toggleVendorMode(forceRegister) {
            const shouldRegister = forceRegister !== undefined ? forceRegister : !isVendorRegister;
            isVendorRegister = shouldRegister;
            const title = document.getElementById('vendor-modal-title');
            const submitBtn = document.getElementById('vendor-submit-btn');
            const submitText = document.getElementById('vendor-submit-text');
            const switchBtn = document.getElementById('vendor-switch-btn');
            const switchText = document.getElementById('vendor-switch-text');
            const registerFields = document.getElementById('register-fields');
            const body = document.getElementById('vendor-modal-body');
            const steps = document.getElementById('form-steps');
            if(isVendorRegister) {
                title.innerText = 'إنشاء حساب مزود';
                submitBtn.querySelector('span').innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-6 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg> تسجيل حساب جديد';
                switchBtn.innerText = 'تسجيل دخول';
                switchText.innerText = 'لديك حساب بالفعل؟';
                registerFields.classList.remove('hidden');
                steps.classList.remove('hidden');
                body.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                title.innerText = 'منصة المزودين';
                submitBtn.querySelector('span').innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/></svg> دخول';
                switchBtn.innerText = 'إنشاء حساب جديد';
                switchText.innerText = 'ليس لديك حساب؟';
                registerFields.classList.add('hidden');
                steps.classList.add('hidden');
            }
        }

        function resetVendorForm() {
            isVendorRegister = false;
            document.getElementById('vendor-modal-title').innerText = 'منصة المزودين';
            document.getElementById('vendor-submit-btn').querySelector('span').innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/></svg> دخول';
            document.getElementById('vendor-switch-btn').innerText = 'إنشاء حساب جديد';
            document.getElementById('vendor-switch-text').innerText = 'ليس لديك حساب؟';
            document.getElementById('register-fields').classList.add('hidden');
            document.getElementById('form-steps').classList.add('hidden');
            document.getElementById('vendor-form').reset();
            document.getElementById('vendor-photo-placeholder').classList.remove('hidden');
            document.getElementById('vendor-photo-preview').classList.add('hidden');
        }

        function previewVendorPhoto(event) {
            const file = event.target.files[0];
            if(file) {
                const reader = new FileReader();
                reader.onload = function(e) { document.getElementById('vendor-photo-img').src = e.target.result; document.getElementById('vendor-photo-placeholder').classList.add('hidden'); document.getElementById('vendor-photo-preview').classList.remove('hidden'); };
                reader.readAsDataURL(file);
            }
        }

        function vendorFormSubmit() {
            const username = document.getElementById('vendor-username').value;
            const password = document.getElementById('vendor-password').value;
            if(isVendorRegister) {
                const formData = new FormData();
                formData.append('username', username); formData.append('password', password);
                formData.append('fullname', document.getElementById('vendor-fullname').value);
                formData.append('age', document.getElementById('vendor-age').value);
                formData.append('location', document.getElementById('vendor-location').value);
                formData.append('email', document.getElementById('vendor-email').value);
                formData.append('display_name', document.getElementById('vendor-display-name').value);
                formData.append('phone', document.getElementById('vendor-phone').value);
                formData.append('social_link', document.getElementById('vendor-social').value);
                const photoInput = document.getElementById('vendor-photo');
                if(photoInput.files[0]) formData.append('photo', photoInput.files[0]);
                fetch('/api/vendor/register', { method: 'POST', body: formData }).then(r => r.json()).then(data => { if(data.success) { alert('✅ ' + data.message); toggleVendorModal(false); } else { alert('❌ ' + data.message); } }).catch(() => alert('❌ فشل الاتصال بالسيرفر.'));
            } else {
                fetch('/api/vendor/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) }).then(r => r.json()).then(data => { if(data.success) { if(data.vendor.is_admin) { window.location.href = '/admin.html'; } else { sessionStorage.setItem('vendorToken', data.token); window.location.href = '/vendor.html?t=' + encodeURIComponent(data.token); } } else { alert('❌ ' + data.message); if (data.status === 'pending' || data.status === 'rejected') { window.location.href = '/vendor.html'; } } }).catch(() => alert('❌ فشل الاتصال بالسيرفر. تأكد من تشغيله.'));
            }
        }

        var allOfferings = [];

        function populateFilters(offerings) {
            var vendorSet = {}, catSet = {};
            var vendorSel = document.getElementById('filter-vendor');
            var catSel = document.getElementById('filter-category');
            vendorSel.innerHTML = '<option value="">كل المزودين</option>';
            catSel.innerHTML = '<option value="">كل الأصناف</option>';
            offerings.forEach(function(o) {
                var vName = o.vendor.display_name || 'مزود';
                vendorSet[vName] = true;
                (o.categories || []).forEach(function(c) { catSet[c.name] = true; });
            });
            Object.keys(vendorSet).sort().forEach(function(n) { vendorSel.innerHTML += '<option value="' + escAttr(n) + '">' + esc(n) + '</option>'; });
            Object.keys(catSet).sort().forEach(function(n) { catSel.innerHTML += '<option value="' + escAttr(n) + '">' + esc(n) + '</option>'; });
        }

        function applyFilters() {
            var search = document.getElementById('filter-search').value.trim().toLowerCase();
            var vendorFilter = document.getElementById('filter-vendor').value;
            var catFilter = document.getElementById('filter-category').value;
            var grid = document.getElementById('marketplace-grid');
            var empty = document.getElementById('marketplace-empty');
            var visibleCount = 0;
            var sections = grid.querySelectorAll('.vendor-section');
            sections.forEach(function(sec) {
                var vName = sec.getAttribute('data-vendor') || '';
                var showVendor = !vendorFilter || vName === vendorFilter;
                var cats = sec.querySelectorAll('.vendor-cat');
                var anyCatVisible = false;
                cats.forEach(function(cat) {
                    var cName = cat.getAttribute('data-cat') || '';
                    var showCat = !catFilter || cName === catFilter;
                    var subs = cat.querySelectorAll('.sub-item');
                    var anySubVisible = false;
                    subs.forEach(function(sub) { var sName = sub.getAttribute('data-name') || ''; var showSub = !search || sName.indexOf(search) !== -1; sub.style.display = showSub && showCat && showVendor ? 'flex' : 'none'; if (showSub && showCat && showVendor) anySubVisible = true; });
                    cat.style.display = showCat && showVendor && anySubVisible ? '' : 'none';
                    if (showCat && showVendor && anySubVisible) anyCatVisible = true;
                });
                var uncat = sec.querySelector('.uncat-items');
                if (uncat) {
                    var uSubs = uncat.querySelectorAll('.sub-item');
                    var anyUVisible = false;
                    uSubs.forEach(function(sub) { var sName = sub.getAttribute('data-name') || ''; var showSub = !search || sName.indexOf(search) !== -1; sub.style.display = showSub && showVendor ? 'flex' : 'none'; if (showSub && showVendor) anyUVisible = true; });
                    uncat.style.display = showVendor && anyUVisible ? '' : 'none';
                    if (showVendor && anyUVisible) anyCatVisible = true;
                }
                sec.style.display = anyCatVisible ? '' : 'none';
                if (anyCatVisible) visibleCount++;
            });
            if (visibleCount === 0) { empty.classList.remove('hidden'); } else { empty.classList.add('hidden'); }
        }

        function resetFilters() { document.getElementById('filter-search').value = ''; document.getElementById('filter-vendor').value = ''; document.getElementById('filter-category').value = ''; applyFilters(); }

        function loadAppsFeatured() {
            fetch('/api/featured-subscriptions').then(r => r.json()).then(d => {
                var loading = document.getElementById('apps-loading');
                var grid = document.getElementById('apps-grid');
                if (!d.success || !d.subscriptions.length) { loading.innerHTML = 'لا توجد اشتراكات مميزة حالياً'; return; }
                loading.classList.add('hidden');
                grid.classList.remove('hidden');
                grid.innerHTML = d.subscriptions.map(function(s) {
                    var colors = ['bg-gradient-to-br from-deep to-deep-800', 'bg-gradient-to-br from-brand to-emerald-600', 'bg-gradient-to-br from-accent to-orange-500', 'bg-gradient-to-br from-purple-500 to-pink-600', 'bg-gradient-to-br from-cyan-500 to-blue-600', 'bg-gradient-to-br from-red-500 to-rose-600'];
                    var c = colors[s.id % colors.length];
                    var imgHtml = s.image_path ? '<img src="' + escAttr(s.image_path) + '" class="w-full h-auto rounded-t-2xl">' : '<div class="w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-md ' + c + '"><svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg></div>';
                    var priceHtml = s.featured_price ? '<span class="text-xl font-bold text-accent">' + esc(s.featured_price) + ' د.ل</span><span class="text-xs text-deep-400 line-through mr-2">' + esc(s.price) + ' د.ل</span>' : '<span class="text-xl font-bold text-deep">' + esc(s.price) + ' د.ل</span>';
                    var badge = s.featured_price ? '<span class="bg-accent-100 text-accent-700 text-[10px] font-bold px-2 py-1 rounded-md border border-accent-200">عرض خاص</span>' : '<span class="bg-brand-50 text-brand text-[10px] font-bold px-2 py-1 rounded-md border border-brand-100">مميز</span>';
                    var subData = JSON.stringify({vendor_id: s.vendor_id, name: s.name, price: s.featured_price || s.price, duration: s.duration || '', description: s.description || '', image_path: s.image_path || ''}).replace(/"/g, '&quot;');
                    return '<div class="app-card card-hover bg-white p-5 rounded-3xl border border-deep-100/60 shadow-sm hover:shadow-xl flex flex-col justify-between"><div><div class="flex items-start justify-between mb-4">' + imgHtml + '<span>' + badge + '</span></div><h4 class="font-cairo text-lg font-bold text-deep mb-1 card-title">' + esc(s.name) + '</h4><p class="text-xs text-deep-400 mb-3">بواسطة: <span class="text-brand font-bold">' + esc(s.vendor_name || '') + '</span></p></div><div><div class="flex items-baseline justify-between mb-4"><span class="text-xs text-deep-400">' + esc(s.duration || '') + '</span><div>' + priceHtml + '</div></div><button type="button" onclick="showSubDetail(' + subData + ', ' + JSON.stringify(s.vendor_name || '').replace(/"/g, '&quot;') + ')" class="btn-primary w-full bg-white hover:bg-deep hover:text-white text-deep text-sm font-bold py-3 rounded-xl border-2 border-deep-100 hover:border-deep shadow-sm smooth-transition">اشتري ويفعّلها المزود</button></div></div>';
                }).join('');
            }).catch(function() { document.getElementById('apps-loading').innerHTML = 'تعذر تحميل الاشتراكات المميزة'; });
        }

        function loadFeaturedSubs() {
            fetch('/api/featured-subscriptions').then(r => r.json()).then(d => {
                var section = document.getElementById('featured-section');
                var grid = document.getElementById('featured-grid');
                if (!d.success || !d.subscriptions.length) { section.classList.add('hidden'); return; }
                section.classList.remove('hidden');
                grid.innerHTML = d.subscriptions.map(function(s) {
                    var img = s.image_path ? '<img src="' + escAttr(s.image_path) + '" class="w-full h-auto rounded-t-2xl">' : '<div class="w-full h-16 bg-gradient-to-br from-accent-50 to-orange-50 rounded-t-2xl"></div>';
                    var priceHtml = s.featured_price ? '<span class="text-lg font-bold text-accent">' + esc(s.featured_price) + ' د.ل</span><span class="text-xs text-deep-400 line-through mr-2">' + esc(s.price) + ' د.ل</span>' : '<span class="text-lg font-bold text-deep">' + esc(s.price) + ' د.ل</span>';
                    var badge = s.featured_price ? '<span class="absolute top-2 right-2 bg-accent text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">عرض خاص</span>' : '';
                    var vImg = s.vendor_photo ? '<img src="' + escAttr(s.vendor_photo) + '" class="w-5 h-5 rounded-full object-cover">' : '<div class="w-5 h-5 bg-gradient-to-br from-brand to-emerald-600 rounded-full flex items-center justify-center text-white text-[8px] font-bold">' + esc((s.vendor_name || 'م')[0]) + '</div>';
                    var subData = JSON.stringify({vendor_id: s.vendor_id, name: s.name, price: s.featured_price || s.price, duration: s.duration || '', description: s.description || '', image_path: s.image_path || ''}).replace(/"/g, '&quot;');
                    return '<div class="card-hover bg-white rounded-2xl border border-accent-100 overflow-hidden shadow-sm hover:shadow-xl relative">' + badge + img + '<div class="p-3"><div class="flex items-center gap-1.5 mb-2">' + vImg + '<span class="text-[10px] text-deep-400">' + esc(s.vendor_name || '') + '</span></div><h4 class="font-cairo font-bold text-deep text-sm mb-1">' + esc(s.name) + '</h4><p class="text-[10px] text-deep-400 mb-2">' + esc(s.duration || '') + '</p><div class="flex items-center justify-between"><div>' + priceHtml + '</div><button onclick="showSubDetail(' + subData + ', ' + JSON.stringify(s.vendor_name || '').replace(/"/g, '&quot;') + ')" class="btn-primary bg-accent-50 hover:bg-accent-100 text-accent px-3 py-1.5 rounded-xl text-[10px] font-bold smooth-transition">أضف للسلة</button></div></div></div>';
                }).join('');
            });
        }

        function loadMarketplace() {
            fetch('/api/marketplace/offerings').then(r => r.json()).then(d => {
                if (!d.success) { document.getElementById('marketplace-loading').innerHTML = 'لا توجد عروض متاحة حالياً'; return; }
                var grid = document.getElementById('marketplace-grid');
                var loading = document.getElementById('marketplace-loading');
                grid.innerHTML = '';
                allOfferings = d.offerings || [];
                if (!allOfferings.length) { loading.innerHTML = 'لا توجد عروض متاحة حالياً'; return; }
                loading.classList.add('hidden');
                grid.classList.remove('hidden');
                populateFilters(allOfferings);
                allOfferings.forEach(function(o) {
                    var v = o.vendor;
                    var cats = o.categories || [];
                    if (!cats.length && (!o.uncategorized || !o.uncategorized.length)) return;
                    var vImg = v.photo ? '<img src="' + escAttr(v.photo) + '" class="w-8 h-8 rounded-full object-cover">' : '<div class="w-8 h-8 bg-gradient-to-br from-brand to-emerald-600 rounded-full flex items-center justify-center text-white text-xs font-bold">' + esc((v.display_name||'م')[0]) + '</div>';
                    var sectionHtml = '<div class="vendor-section border-b border-deep-100 pb-8 mb-8 last:border-0 last:pb-0 last:mb-0" data-vendor="' + escAttr(v.display_name) + '">';
                    sectionHtml += '<div class="flex items-center gap-3 mb-5">' + vImg + '<div><h3 class="font-cairo font-bold text-deep">' + esc((v.display_name || 'مزود')) + '</h3></div></div>';
                    sectionHtml += '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">';
                    cats.forEach(function(c) {
                        var imgHtml = c.image_path ? '<img src="' + escAttr(c.image_path) + '" class="w-full h-auto rounded-t-2xl">' : '<div class="w-full h-10 bg-gradient-to-br from-brand-50 to-emerald-50 rounded-t-2xl"></div>';
                        sectionHtml += '<div class="vendor-cat card-hover bg-white rounded-2xl border border-deep-100 overflow-hidden shadow-sm" data-cat="' + escAttr(c.name) + '">' + imgHtml + '<div class="p-3"><h4 class="font-cairo font-bold text-deep text-sm mb-2">' + esc(c.name) + '</h4>';
                        if (c.description) sectionHtml += '<p class="text-xs text-deep-400 mb-2">' + esc(c.description) + '</p>';
                        sectionHtml += '<div class="space-y-1.5">';
                        if (c.subscriptions) {
                            c.subscriptions.forEach(function(s) {
                                var simg = s.image_path ? '<img src="' + escAttr(s.image_path) + '" class="w-16 h-16 rounded-xl object-cover shrink-0">' : '<div class="w-16 h-16 bg-gradient-to-br from-brand to-emerald-600 rounded-xl flex items-center justify-center text-white font-bold shrink-0">' + esc(s.name && s.name[0]) + '</div>';
                                var effectivePrice = s.featured_price || s.price;
                                var priceHtml = s.featured_price ? '<span class="text-sm font-bold text-accent">' + esc(s.featured_price) + '</span><span class="text-[10px] text-deep-400 line-through mr-1">' + esc(s.price) + '</span> د.ل' : '<span class="text-sm font-bold text-brand">' + esc(s.price) + ' د.ل</span>';
                                var subData = JSON.stringify({vendor_id: v.id, name: s.name, price: effectivePrice, duration: s.duration || '', description: s.description || '', image_path: s.image_path || '', is_paused: s.is_paused}).replace(/"/g, '&quot;');
                                var featuredBadge = s.is_featured ? '<span class="text-[9px] bg-accent-100 text-accent px-1.5 py-0.5 rounded-full font-bold">مميز</span>' : '';
                                var offerDisc = offersMap[s.id];
                                var offerBadge = offerDisc ? '<span class="text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-bold">خصم ' + esc(offerDisc) + '%</span>' : '';
                                var badgesHtml = featuredBadge + (featuredBadge && offerBadge ? ' ' : '') + offerBadge;
                                var pausedBadge = s.is_paused ? '<span class="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">موقوف مؤقتاً من قبل المزود</span>' : '';
                                var pausedOverlay = s.is_paused ? ' opacity-60 pointer-events-none ' : '';
                                sectionHtml += '<div class="sub-item flex items-center gap-3 p-3 bg-deep-50 rounded-2xl cursor-pointer hover:bg-deep-100 smooth-transition relative' + pausedOverlay + '" data-name="' + escAttr((s.name || '').toLowerCase()) + '" onclick="showSubDetail(' + subData + ', ' + JSON.stringify(v.display_name || '').replace(/"/g, '&quot;') + ')">';
                                if (badgesHtml || pausedBadge) sectionHtml += '<div class="absolute top-1 left-1 flex gap-1">' + badgesHtml + (badgesHtml && pausedBadge ? ' ' : '') + pausedBadge + '</div>';
                                sectionHtml += simg + '<div class="flex-1 min-w-0"><p class="text-sm font-bold text-deep">' + esc(s.name) + '</p><p class="text-xs text-deep-500">' + esc(s.duration || '') + '</p></div>' + priceHtml + '</div>';
                            });
                        }
                        sectionHtml += '</div></div></div>';
                    });
                    sectionHtml += '</div>';
                    if (o.uncategorized && o.uncategorized.length) {
                        sectionHtml += '<div class="uncat-items mt-4 card-hover bg-white rounded-2xl border border-deep-100 overflow-hidden shadow-sm"><div class="p-3"><h4 class="font-cairo font-bold text-deep text-sm mb-2">بدون صنف</h4><div class="space-y-1.5">';
                        o.uncategorized.forEach(function(s) {
                            var simg = s.image_path ? '<img src="' + escAttr(s.image_path) + '" class="w-16 h-16 rounded-xl object-cover shrink-0">' : '<div class="w-16 h-16 bg-gradient-to-br from-brand to-emerald-600 rounded-xl flex items-center justify-center text-white font-bold shrink-0">' + esc(s.name[0]) + '</div>';
                            var effectivePrice2 = s.featured_price || s.price;
                            var priceHtml2 = s.featured_price ? '<span class="text-sm font-bold text-accent">' + esc(s.featured_price) + '</span><span class="text-[10px] text-deep-400 line-through mr-1">' + esc(s.price) + '</span> د.ل' : '<span class="text-sm font-bold text-brand">' + esc(s.price) + ' د.ل</span>';
                            var subData2 = JSON.stringify({vendor_id: v.id, name: s.name, price: effectivePrice2, duration: s.duration || '', description: s.description || '', image_path: s.image_path || '', is_paused: s.is_paused}).replace(/"/g, '&quot;');
                            var featuredBadge2 = s.is_featured ? '<span class="text-[9px] bg-accent-100 text-accent px-1.5 py-0.5 rounded-full font-bold">مميز</span>' : '';
                            var offerDisc2 = offersMap[s.id];
                            var offerBadge2 = offerDisc2 ? '<span class="text-[9px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-bold">خصم ' + esc(offerDisc2) + '%</span>' : '';
                            var badgesHtml2 = featuredBadge2 + (featuredBadge2 && offerBadge2 ? ' ' : '') + offerBadge2;
                            var pausedBadge2 = s.is_paused ? '<span class="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">موقوف مؤقتاً من قبل المزود</span>' : '';
                            var pausedOverlay2 = s.is_paused ? ' opacity-60 pointer-events-none ' : '';
                            sectionHtml += '<div class="sub-item flex items-center gap-3 p-3 bg-deep-50 rounded-2xl cursor-pointer hover:bg-deep-100 smooth-transition relative' + pausedOverlay2 + '" data-name="' + escAttr((s.name || '').toLowerCase()) + '" onclick="showSubDetail(' + subData2 + ', ' + JSON.stringify(v.display_name || '').replace(/"/g, '&quot;') + ')">';
                            if (badgesHtml2 || pausedBadge2) sectionHtml += '<div class="absolute top-1 left-1 flex gap-1">' + badgesHtml2 + (badgesHtml2 && pausedBadge2 ? ' ' : '') + pausedBadge2 + '</div>';
                            sectionHtml += simg + '<div class="flex-1 min-w-0"><p class="text-sm font-bold text-deep">' + esc(s.name) + '</p><p class="text-xs text-deep-500">' + esc(s.duration || '') + '</p></div>' + priceHtml2 + '</div>';
                        });
                        sectionHtml += '</div></div></div>';
                    }
                    sectionHtml += '</div>';
                    grid.innerHTML += sectionHtml;
                });
                if (!grid.innerHTML) { loading.innerHTML = 'لا توجد عروض متاحة حالياً'; loading.classList.remove('hidden'); grid.classList.add('hidden'); }
            }).catch(function() { document.getElementById('marketplace-loading').innerHTML = 'تعذر تحميل العروض'; });
        }

        loadMarketplace();
        loadFeaturedSubs();
        loadAppsFeatured();

        // تحميل الإضافات المخصصة من لوحة الإدارة
        function loadCustomAssets() {
            fetch('/api/custom-assets').then(function(r) { return r.json(); }).then(function(d) {
                if (!d.success || !d.assets) return;
                if (d.assets.custom_css) {
                    var style = document.createElement('style');
                    style.textContent = d.assets.custom_css;
                    document.head.appendChild(style);
                }
                if (d.assets.custom_js) {
                    var script = document.createElement('script');
                    script.textContent = d.assets.custom_js;
                    document.body.appendChild(script);
                }
                if (d.assets.custom_html) {
                    var div = document.createElement('div');
                    div.innerHTML = d.assets.custom_html;
                    document.body.appendChild(div);
                }
            });
        }
        loadCustomAssets();

        function sendSupport() {
            var name = document.getElementById('support-name').value.trim();
            var phone = document.getElementById('support-phone').value.trim();
            var message = document.getElementById('support-message').value.trim();
            var result = document.getElementById('support-result');
            if (!name) { CustomDialog.alert('يرجى إدخال الاسم'); return; }
            if (!phone) { CustomDialog.alert('يرجى إدخال رقم الهاتف'); return; }
            if (!message) { CustomDialog.alert('يرجى كتابة الرسالة'); return; }
            var btn = document.querySelector('#support button');
            btn.disabled = true;
            btn.innerHTML = '<svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg> جاري الإرسال...';
            result.classList.add('hidden');
            fetch('/api/support', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-csrf-token': document.querySelector('meta[name="csrf-token"]').getAttribute('content') }, body: JSON.stringify({ name: name, phone: phone, message: message }) }).then(function(r) { return r.json(); }).then(function(d) {
                result.classList.remove('hidden');
                if (d.success) {
                    result.className = 'mt-4 p-4 bg-green-50 border border-green-200 rounded-2xl text-sm text-green-700 font-medium';
                    result.textContent = d.message || 'تم إرسال رسالتك بنجاح';
                    document.getElementById('support-name').value = '';
                    document.getElementById('support-phone').value = '';
                    document.getElementById('support-message').value = '';
                } else {
                    result.className = 'mt-4 p-4 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700 font-medium';
                    result.textContent = d.message || 'حدث خطأ. حاول مرة أخرى.';
                }
            }).catch(function() {
                result.classList.remove('hidden');
                result.className = 'mt-4 p-4 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700 font-medium';
                result.textContent = 'تعذر الاتصال بالخادم. حاول مرة أخرى.';
            }).finally(function() {
                btn.disabled = false;
                btn.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg> إرسال الرسالة';
            });
        }

        // Dark mode
        function toggleDarkMode() {
            var html = document.documentElement;
            html.classList.toggle('dark');
            var isDark = html.classList.contains('dark');
            localStorage.setItem('darkMode', isDark ? '1' : '0');
            document.getElementById('dark-icon-sun').classList.toggle('hidden', isDark);
            document.getElementById('dark-icon-moon').classList.toggle('hidden', !isDark);
        }
        if (localStorage.getItem('darkMode') === '1') {
            document.documentElement.classList.add('dark');
            document.getElementById('dark-icon-sun').classList.add('hidden');
            document.getElementById('dark-icon-moon').classList.remove('hidden');
        }

        const CustomDialog = {
            _overlay: null,
            init() {
                const html = '<div id="custom-dialog" class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-deep/50 backdrop-blur-sm hidden" style="direction:rtl" onclick="if(event.target===this)this.classList.add(\'hidden\')"><div class="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden" style="box-shadow: 0 32px 80px rgba(15,23,42,0.15);"><div class="p-6 text-center"><div id="dialog-icon" class="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center text-2xl"></div><h3 id="dialog-title" class="text-lg font-cairo font-bold text-deep mb-2"></h3><p id="dialog-message" class="text-sm text-deep-400 mb-5"></p><div id="dialog-input-area" class="hidden mb-4"><input type="text" id="dialog-input" class="w-full px-4 py-3 bg-deep-50 rounded-xl border border-deep-100 focus:border-brand focus:ring-2 focus:ring-brand/20 text-sm outline-none" placeholder=""></div><div id="dialog-buttons" class="flex gap-2"></div></div></div></div>';
                const div = document.createElement('div');
                div.innerHTML = html;
                document.body.appendChild(div.firstElementChild);
                this._overlay = document.getElementById('custom-dialog');
            },
            _getIconHtml(style) {
                const icons = {
                    info: ['bg-deep-100','<svg class="w-7 h-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 110 20 10 10 0 010-20z"/></svg>'],
                    success: ['bg-brand-100','<svg class="w-7 h-7 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a10 10 0 11-20 0 10 10 0 0120 0z"/></svg>'],
                    warning: ['bg-accent-100','<svg class="w-7 h-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01M10.29 3.86l-8.1 14c-.6 1.04.15 2.14 1.21 2.14h16.2c1.06 0 1.81-1.1 1.21-2.14l-8.1-14c-.6-1.04-1.82-1.04-2.42 0z"/></svg>'],
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
                const styleColors = { info: 'bg-deep hover:bg-deep-800', success: 'bg-brand hover:bg-brand-600', warning: 'bg-accent hover:bg-accent-600', error: 'bg-red-600 hover:bg-red-700', question: 'bg-purple-600 hover:bg-purple-700' };
                const color = styleColors[style] || styleColors.info;
                document.getElementById('dialog-input-area').classList.add('hidden');
                return new Promise(resolve => {
                    if (type === 'alert') {
                        btnContainer.innerHTML = '<button class="flex-1 ' + color + ' text-white py-2.5 rounded-xl text-sm font-bold shadow-md" id="dialog-ok-btn">' + confirmText + '</button>';
                        overlay.querySelector('#dialog-ok-btn').onclick = () => { overlay.classList.add('hidden'); resolve(true); };
                    } else if (type === 'confirm') {
                        btnContainer.innerHTML = '<button class="flex-1 bg-deep-50 hover:bg-deep-100 text-deep-500 py-2.5 rounded-xl text-sm font-medium" id="dialog-cancel-btn">' + cancelText + '</button><button class="flex-1 ' + color + ' text-white py-2.5 rounded-xl text-sm font-bold shadow-md" id="dialog-confirm-btn">' + confirmText + '</button>';
                        overlay.querySelector('#dialog-confirm-btn').onclick = () => { overlay.classList.add('hidden'); resolve(true); };
                        overlay.querySelector('#dialog-cancel-btn').onclick = () => { overlay.classList.add('hidden'); resolve(false); };
                    } else if (type === 'prompt') {
                        document.getElementById('dialog-input-area').classList.remove('hidden');
                        btnContainer.innerHTML = '<button class="flex-1 bg-deep-50 hover:bg-deep-100 text-deep-500 py-2.5 rounded-xl text-sm font-medium" id="dialog-cancel-btn">' + cancelText + '</button><button class="flex-1 ' + color + ' text-white py-2.5 rounded-xl text-sm font-bold shadow-md" id="dialog-ok-btn">' + confirmText + '</button>';
                        overlay.querySelector('#dialog-ok-btn').onclick = () => { const val = document.getElementById('dialog-input').value; overlay.classList.add('hidden'); document.getElementById('dialog-input-area').classList.add('hidden'); resolve(val); };
                        overlay.querySelector('#dialog-cancel-btn').onclick = () => { overlay.classList.add('hidden'); document.getElementById('dialog-input-area').classList.add('hidden'); resolve(null); };
                    }
                    overlay.classList.remove('hidden');
                });
            },
            async alert(message, title) { return this.show({ title: title || '', message: message || '', type: 'alert', style: 'info' }); },
            async success(message, title) { return this.show({ title: title || '', message: message || '', type: 'alert', style: 'success' }); },
            async error(message, title) { return this.show({ title: title || '', message: message || '', type: 'alert', style: 'error' }); }
        };
        function previewComplaintScreenshot(e) {
            var file = e.target.files[0];
            if (file) {
                var reader = new FileReader();
                reader.onload = function(ev) {
                    document.getElementById('complaint-screenshot-placeholder').classList.add('hidden');
                    document.getElementById('complaint-screenshot-preview').classList.remove('hidden');
                    document.getElementById('complaint-screenshot-img').src = ev.target.result;
                };
                reader.readAsDataURL(file);
            }
        }

        function submitComplaint() {
            var name = document.getElementById('complaint-name').value.trim();
            var phone = document.getElementById('complaint-phone').value.trim();
            var vendor = document.getElementById('complaint-vendor').value.trim();
            var sub = document.getElementById('complaint-sub').value.trim();
            var reason = document.getElementById('complaint-reason').value;
            var details = document.getElementById('complaint-details').value.trim();
            var screenshot = document.getElementById('complaint-screenshot').files[0];
            if (!name || !phone || !vendor || !sub || !reason || !details) { alert('يرجى ملء جميع الحقول المطلوبة'); return; }
            var btn = document.getElementById('complaint-submit-btn');
            btn.disabled = true; btn.textContent = 'جاري الإرسال...';
            var formData = new FormData();
            formData.append('customer_name', name);
            formData.append('customer_phone', phone);
            formData.append('vendor_name', vendor);
            formData.append('subscription_name', sub);
            formData.append('reason', reason + ' - ' + details);
            if (screenshot) formData.append('screenshot', screenshot);
            fetch('/api/complaints', { method: 'POST', headers: { 'x-csrf-token': csrfToken }, body: formData })
                .then(function(r) { return r.json(); }).then(function(d) {
                    btn.disabled = false; btn.textContent = 'إرسال الشكوى';
                    if (d.success) {
                        alert('تم تقديم الشكوى بنجاح. سيتم مراجعتها من قبل الإدارة خلال 3 أيام عمل.');
                        closeModal('complaint-modal');
                        document.getElementById('complaint-name').value = '';
                        document.getElementById('complaint-phone').value = '';
                        document.getElementById('complaint-vendor').value = '';
                        document.getElementById('complaint-sub').value = '';
                        document.getElementById('complaint-reason').value = '';
                        document.getElementById('complaint-details').value = '';
                        document.getElementById('complaint-screenshot').value = '';
                        document.getElementById('complaint-screenshot-placeholder').classList.remove('hidden');
                        document.getElementById('complaint-screenshot-preview').classList.add('hidden');
                    } else { alert('حدث خطأ: ' + d.message); }
                }).catch(function() { btn.disabled = false; btn.textContent = 'إرسال الشكوى'; alert('فشل الاتصال بالخادم'); });
        }
        CustomDialog.init();
        window.alert = function(msg) { CustomDialog.alert(msg); };
    