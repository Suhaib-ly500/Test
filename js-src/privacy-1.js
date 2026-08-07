
        // المحتوى الافتراضي للعرض في حال تعذر الاتصال بالسيرفر
        const fallbackContent = `
            <div class="section-card">
                <p>نحن في <strong>ماتريكس برو</strong> نلتزم بحماية خصوصيتك وبياناتك الشخصية. توضح سياسة الخصوصية هذه كيفية جمع واستخدام وحماية المعلومات التي تقدمها عند استخدام منصتنا.</p>
            </div>
            <div class="section-card">
                <div class="section-title"><span class="num">1</span> المعلومات التي نجمعها</div>
                <ul>
                    <li><strong>معلومات التسجيل:</strong> الاسم الكامل، اسم المستخدم، البريد الإلكتروني، العمر، مكان الإقامة.</li>
                    <li><strong>معلومات المزود:</strong> الاسم التجاري، رقم الهاتف، الصورة الشخصية.</li>
                    <li><strong>معلومات الطلبات:</strong> اسم العميل، رقم الهاتف، الاشتراكات التي تم شراؤها.</li>
                    <li><strong>معلومات الشكاوى:</strong> اسم المشتكي، تفاصيل الشكوى، الصور المرفقة.</li>
                    <li><strong>معلومات الاستخدام:</strong> الصفحات التي تزورها، عدد المشاهدات.</li>
                </ul>
            </div>
            <div class="section-card">
                <div class="section-title"><span class="num">2</span> كيفية استخدام معلوماتك</div>
                <ul>
                    <li>تشغيل المنصة وتقديم الخدمات لك.</li>
                    <li>تمكين المزودين من عرض وبيع اشتراكاتهم.</li>
                    <li>التواصل معك بخصوص طلباتك واستفساراتك.</li>
                    <li>تحسين المنصة وتجربة المستخدم.</li>
                    <li>مراجعة الشكاوى وطلبات الاسترجاع.</li>
                </ul>
            </div>
            <div class="section-card">
                <div class="section-title"><span class="num">3</span> مشاركة المعلومات</div>
                <ul>
                    <li><strong>بين المزود والمشتري:</strong> يتم مشاركة اسم المشتري ورقم هاتفه مع المزود.</li>
                    <li><strong>مع جهات إنفاذ القانون:</strong> إذا طلب القانون ذلك.</li>
                    <li><strong>مع مزودي الخدمة:</strong> مثل خدمات الاستضافة وهم ملزمون باتفاقيات سرية.</li>
                </ul>
            </div>
            <div class="section-card">
                <div class="section-title"><span class="num">4</span> حماية المعلومات</div>
                <ul>
                    <li>نستخدم إجراءات أمنية معيارية لحماية بياناتك.</li>
                    <li>كلمات المرور مشفرة باستخدام bcrypt.</li>
                    <li>نحد من الوصول إلى بياناتك الشخصية للموظفين المصرح لهم.</li>
                </ul>
            </div>
            <div class="section-card">
                <div class="section-title"><span class="num">5</span> الكوكيز (Cookies)</div>
                <ul>
                    <li>نستخدم ملفات تعريف الارتباط لتحسين تجربتك.</li>
                    <li>يمكنك ضبط متصفحك لرفض الكوكيز.</li>
                </ul>
            </div>
            <div class="section-card">
                <div class="section-title"><span class="num">6</span> الاحتفاظ بالبيانات</div>
                <ul>
                    <li>نحتفظ ببياناتك طالما كان حسابك نشطاً.</li>
                    <li>عند حذف حسابك، يتم حذف جميع بياناتك المرتبطة به.</li>
                </ul>
            </div>
            <div class="section-card">
                <div class="section-title"><span class="num">7</span> حقوقك</div>
                <ul>
                    <li><strong>حق الوصول:</strong> طلب نسخة من البيانات.</li>
                    <li><strong>حق التصحيح:</strong> طلب تصحيح أي بيانات غير دقيقة.</li>
                    <li><strong>حق الحذف:</strong> طلب حذف حسابك وبياناتك.</li>
                </ul>
            </div>
            <div class="section-card">
                <div class="section-title"><span class="num">8</span> روابط خارجية</div>
                <ul>
                    <li>قد تحتوي المنصة على روابط لمواقع خارجية.</li>
                    <li>نحن غير مسؤولين عن ممارسات الخصوصية لتلك المواقع.</li>
                </ul>
            </div>
            <div class="section-card">
                <div class="section-title"><span class="num">9</span> خصوصية القاصرين</div>
                <ul>
                    <li>خدماتنا موجهة للأشخاص الذين تبلغ أعمارهم 18 عاماً أو أكثر.</li>
                </ul>
            </div>
            <div class="section-card">
                <div class="section-title"><span class="num">10</span> التعديلات على سياسة الخصوصية</div>
                <ul>
                    <li>قد نقوم بتحديث سياسة الخصوصية هذه من وقت لآخر.</li>
                    <li>سيتم إشعارك بأي تغييرات جوهرية.</li>
                    <li>تاريخ آخر تحديث يظهر في أعلى هذه الصفحة.</li>
                </ul>
            </div>
            <div class="section-card">
                <div class="section-title"><span class="num">11</span> القانون الواجب التطبيق</div>
                <ul>
                    <li>تخضع سياسة الخصوصية هذه للقوانين النافذة في دولة ليبيا.</li>
                </ul>
            </div>
            <div class="section-card">
                <div class="section-title"><span class="num">12</span> التواصل معنا</div>
                <ul>
                    <li>للاستفسارات: <a href="mailto:privacy@matrixpro.ly" class="text-brand hover:text-brand-600 underline">privacy@matrixpro.ly</a></li>
                </ul>
            </div>
        `;

        function renderPrivacyContent(html) {
            const container = document.getElementById('privacy-content');
            if (html) {
                container.innerHTML = html + '<div class="text-center pt-6 pb-2 border-t border-deep-50"><p class="text-xs text-deep-400">جميع الحقوق محفوظة &copy; 2026 <strong>ماتريكس برو</strong> | سوق الخدمات الرقمية</p></div>';
            } else {
                container.innerHTML = fallbackContent + '<div class="text-center pt-6 pb-2 border-t border-deep-50"><p class="text-xs text-deep-400">جميع الحقوق محفوظة &copy; 2026 <strong>ماتريكس برو</strong> | سوق الخدمات الرقمية</p></div>';
            }
        }

        fetch('/api/pages/privacy')
            .then(r => r.json())
            .then(d => {
                if (d.success && d.exists) {
                    renderPrivacyContent(d.page.content);
                    const el = document.querySelector('.text-white\\/60');
                    if (el) el.textContent = 'آخر تحديث: ' + (d.page.updated_at ? new Date(d.page.updated_at).toLocaleDateString('ar-SA') : '');
                } else {
                    renderPrivacyContent(null);
                }
            })
            .catch(() => renderPrivacyContent(null));
    