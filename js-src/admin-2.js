
        function toggleDarkMode() {
            const html = document.documentElement;
            const isDark = html.classList.toggle('dark');
            localStorage.setItem('darkMode', isDark ? '1' : '0');
            document.getElementById('darkText').textContent = isDark ? 'الوضع الفاتح' : 'الوضع المظلم';
        }
        if (localStorage.getItem('darkMode') === '1') {
            document.documentElement.classList.add('dark');
            document.getElementById('darkText').textContent = 'الوضع الفاتح';
        }
    