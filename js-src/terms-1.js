
        // المحتوى الافتراضي للعرض في حال تعذر الاتصال بالسيرفر
        const fallbackContent = `
            <div class="section-card">
                <p>مرحباً بك في منصة <strong>ماتريكس برو</strong>. باستخدامك للمنصة، فإنك توافق على الشروط والأحكام التالية. إذا كنت لا توافق على أي من هذه الشروط، يرجى عدم استخدام المنصة.</p>
            </div>
            <div class="section-card">
                <div class="section-title"><span class="num">1</span> تعريفات</div>
                <ul>
                    <li><strong>المنصة:</strong> موقع ماتريكس برو الإلكتروني (matrixpro.ly) وتطبيقاته.</li>
                    <li><strong>المزود:</strong> الشخص الطبيعي أو الاعتباري المسجل في المنصة لعرض وبيع الاشتراكات.</li>
                    <li><strong>المشتري/العميل:</strong> الشخص الذي يشتري الاشتراكات عبر المنصة.</li>
                    <li><strong>الاشتراك:</strong> خدمة رقمية أو اشتراك يتم عرضه للبيع عبر المنصة.</li>
                    <li><strong>العمولة:</strong> النسبة التي تحتفظ بها المنصة من سعر الاشتراك.</li>
                </ul>
            </div>
            <div class="section-card">
                <div class="section-title"><span class="num">2</span> قبول الشروط</div>
                <p>باستخدامك للمنصة، سواء كمزود أو مشتري، فإنك تقر وتوافق على:</p>
                <ul>
                    <li>أنك قرأت وفهمت هذه الشروط والأحكام.</li>
                    <li>أنك تبلغ من العمر 18 عاماً على الأقل.</li>
                    <li>أن جميع المعلومات التي تقدمها صحيحة وكاملة.</li>
                    <li>التزامك بجميع القوانين واللوائح المحلية النافذة في دولة ليبيا.</li>
                </ul>
            </div>
            <div class="section-card">
                <div class="section-title"><span class="num">3</span> التسجيل والحسابات</div>
                <ul>
                    <li>يجب على المزودين إنشاء حساب للوصول إلى لوحة التحكم وعرض الخدمات.</li>
                    <li>يتم مراجعة طلبات التسجيل من قبل الإدارة قبل الموافقة عليها.</li>
                    <li>المزود مسؤول عن الحفاظ على سرية معلومات حسابه وكلمة المرور.</li>
                    <li>يمنع إنشاء أكثر من حساب لنفس الشخص دون إذن خطي من الإدارة.</li>
                    <li>تحتفظ المنصة بالحق في تعليق أو حذف أي حساب يخالف الشروط.</li>
                    <li>يمكن للمزود طلب حذف حسابه في أي وقت، ويتم مراجعة الطلب من قبل الإدارة.</li>
                </ul>
            </div>
            <div class="section-card">
                <div class="section-title"><span class="num">4</span> الاشتراكات والخدمات</div>
                <ul>
                    <li>المزود مسؤول بشكل كامل عن صحة وصف الخدمة وسعرها ومدة الاشتراك.</li>
                    <li>يمنع عرض خدمات غير قانونية أو مخالفة للآداب العامة أو تنتهك حقوق الملكية الفكرية.</li>
                    <li>يجب أن تكون جميع الاشتراكات المعروضة قابلة للتفعيل من قبل المزود.</li>
                    <li>المنصة غير مسؤولة عن جودة الخدمة المقدمة من المزود، ولكنها تتعهد ببذل قصارى جهدها لحل النزاعات.</li>
                    <li>الصور المستخدمة في الإعلانات يجب أن تكون حقيقية وتعبر عن الخدمة المقدمة فعلياً.</li>
                </ul>
            </div>
            <div class="section-card">
                <div class="section-title"><span class="num">5</span> العمولات والتسعير</div>
                <ul>
                    <li>تفرض المنصة عمولة على كل عملية بيع تتم عبر المنصة.</li>
                    <li>نسبة العمولة العامة تحدد من قبل الإدارة وقد تختلف حسب فئة الخدمة.</li>
                    <li>يمكن أن تختلف نسبة العمولة لكل مزود حسب الاتفاق مع الإدارة.</li>
                    <li>سعر الاشتراك المعروض شامل لعمولة المنصة.</li>
                    <li>تحتفظ المنصة بالحق في تغيير نسب العمولة مع إشعار مسبق للمزودين.</li>
                </ul>
            </div>
            <div class="section-card">
                <div class="section-title"><span class="num">6</span> عمليات الشراء والدفع</div>
                <ul>
                    <li>عند تقديم طلب شراء، يقوم المشترك بإدخال اسمه ورقم واتسابه للتواصل مع المزود.</li>
                    <li>يتم توجيه المشتري إلى واتساب المزود مباشرة لتأكيد الطلب والتفعيل.</li>
                    <li>المنصة وسيط فقط بين المزود والمشتري، ولا تتحمل مسؤولية تأخير التفعيل من قبل المزود.</li>
                    <li>جميع المعاملات المالية تتم خارج المنصة بين المزود والمشتري مباشرة.</li>
                    <li>في حال عدم التفعيل أو وجود مشكلة في الخدمة، يحق للمشتري تقديم شكوى لاسترجاع حقه.</li>
                </ul>
            </div>
            <div class="section-card">
                <div class="section-title"><span class="num">7</span> سياسة الاسترجاع والإلغاء</div>
                <ul>
                    <li>سياسة الاسترجاع والإلغاء تحدد من قبل كل مزود على حدة.</li>
                    <li><strong>يحق للمشتري تقديم طلب استرجاع خلال مدة لا تتجاوز 48 ساعة</strong> من تاريخ تقديم الطلب.</li>
                    <li>لتقديم طلب استرجاع، يجب على المشتري تقديم بلاغ عبر المنصة مع إرفاق سكرين شوت لمحادثة واتساب.</li>
                    <li>بعد تقديم البلاغ، تقوم المنصة بمراجعة البلاغ والأدلة خلال مدة أقصاها 3 أيام عمل.</li>
                    <li>المنصة غير ملزمة بدفع المبلغ نيابة عن المزود، ولكنها تلتزم ببذل أقصى جهد لاسترجاع حق المشتري.</li>
                </ul>
            </div>
            <div class="section-card">
                <div class="section-title"><span class="num">8</span> حسابات المزودين</div>
                <ul>
                    <li>يجب على المزود تفعيل الاشتراك للمشتري بعد تأكيد الطلب.</li>
                    <li>المزود ملزم بالرد على استفسارات العملاء في وقت معقول.</li>
                    <li>في حال المخالفات المتكررة، تحتفظ المنصة بالحق في تعليق الحساب أو حذفه.</li>
                    <li>يحق للمزود طلب حذف حسابه مع إبداء السبب.</li>
                </ul>
            </div>
            <div class="section-card">
                <div class="section-title"><span class="num">9</span> الملكية الفكرية</div>
                <ul>
                    <li>المحتوى المعروض على المنصة (الشعار، التصميم، النصوص) هو ملك للمنصة.</li>
                    <li>المحتوى الذي يرفعه المزودون يبقى ملكاً لهم مع منح المنصة حق عرضه.</li>
                    <li>يمنع نسخ أو إعادة نشر أي محتوى من المنصة دون إذن خطي.</li>
                </ul>
            </div>
            <div class="section-card">
                <div class="section-title"><span class="num">10</span> الخصوصية</div>
                <ul>
                    <li>نحن نحترم خصوصية مستخدمينا.</li>
                    <li>بيانات المستخدمين لا تُباع أو تُشارك مع أطراف ثالثة.</li>
                    <li>للمزيد، راجع <a href="privacy.html" class="text-brand hover:text-brand-600 underline">سياسة الخصوصية</a>.</li>
                </ul>
            </div>
            <div class="section-card">
                <div class="section-title"><span class="num">11</span> إخلاء المسؤولية</div>
                <ul>
                    <li>المنصة تقدم الخدمات "كما هي" دون أي ضمانات.</li>
                    <li>المنصة غير مسؤولة عن أي أضرار ناتجة عن استخدام الخدمة.</li>
                </ul>
            </div>
            <div class="section-card">
                <div class="section-title"><span class="num">12</span> تعديل الشروط</div>
                <ul>
                    <li>تحتفظ المنصة بالحق في تعديل هذه الشروط في أي وقت.</li>
                    <li>سيتم إشعار المستخدمين بالتغييرات الجوهرية.</li>
                    <li>استمرار استخدام المنصة بعد التعديل يعني الموافقة على الشروط المعدلة.</li>
                </ul>
            </div>
            <div class="section-card">
                <div class="section-title"><span class="num">13</span> القانون الواجب التطبيق</div>
                <ul>
                    <li>تخضع هذه الشروط للقوانين النافذة في دولة ليبيا.</li>
                </ul>
            </div>
            <div class="section-card">
                <div class="section-title"><span class="num">14</span> التواصل</div>
                <ul>
                    <li>للاستفسارات: <a href="mailto:support@matrixpro.ly" class="text-brand hover:text-brand-600 underline">support@matrixpro.ly</a></li>
                </ul>
            </div>
        `;

        function renderTermsContent(html) {
            const container = document.getElementById('terms-content');
            if (html) {
                container.innerHTML = html + '<div class="text-center pt-6 pb-2 border-t border-deep-50"><p class="text-xs text-deep-400">جميع الحقوق محفوظة &copy; 2026 <strong>ماتريكس برو</strong> | سوق الخدمات الرقمية</p></div>';
            } else {
                container.innerHTML = fallbackContent + '<div class="text-center pt-6 pb-2 border-t border-deep-50"><p class="text-xs text-deep-400">جميع الحقوق محفوظة &copy; 2026 <strong>ماتريكس برو</strong> | سوق الخدمات الرقمية</p></div>';
            }
        }

        fetch('/api/pages/terms')
            .then(r => r.json())
            .then(d => {
                if (d.success && d.exists) {
                    renderTermsContent(d.page.content);
                    document.querySelector('.text-white\\/60').textContent = 'آخر تحديث: ' + (d.page.updated_at ? new Date(d.page.updated_at).toLocaleDateString('ar-SA') : '');
                } else {
                    renderTermsContent(null);
                }
            })
            .catch(() => renderTermsContent(null));
    