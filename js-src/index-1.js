
    (function(){
        function fitHeroBg() {
            var hero = document.querySelector('.hero-bg');
            if (!hero) return;
            if (window.innerWidth > 640) { hero.style.height = ''; return; }
            var h = 0;
            hero.querySelectorAll('.slide').forEach(function(slide){
                var img = slide.querySelector('img');
                if (img && img.naturalWidth && img.naturalHeight) {
                    var ratio = img.naturalWidth / img.naturalHeight;
                    if (ratio > 0) h = Math.max(h, slide.clientWidth / ratio);
                }
            });
            if (h > 0) hero.style.height = h + 'px';
        }
        if (document.readyState === 'complete') { fitHeroBg(); } else { window.addEventListener('load', fitHeroBg); }
        window.addEventListener('resize', fitHeroBg);
    })();
    