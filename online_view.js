(function () {
    'use strict';

    // ─── Конфигурация ────────────────────────────────────────────────────────
    var SOURCES = [
        {
            name: 'Collaps',
            iframe: function (movie) {
                var kp = movie.kinopoisk_id || (movie.ids && movie.ids.kinopoisk);
                return kp ? 'https://api.delivembd.ws/embed/kp/' + kp : null;
            }
        },
        {
            name: 'Alloha',
            iframe: function (movie) {
                var kp   = movie.kinopoisk_id || (movie.ids && movie.ids.kinopoisk);
                var imdb = movie.imdb_id      || (movie.ids && movie.ids.imdb);
                if (kp)   return 'https://p.alloha.tv/iframe?kp='   + kp   + '&token=04941a9a3ca3ac16e2b4327347bbc1';
                if (imdb) return 'https://p.alloha.tv/iframe?imdb=' + imdb + '&token=04941a9a3ca3ac16e2b4327347bbc1';
                return null;
            }
        },
        {
            name: 'HDVB',
            iframe: function (movie) {
                var kp   = movie.kinopoisk_id || (movie.ids && movie.ids.kinopoisk);
                var imdb = movie.imdb_id      || (movie.ids && movie.ids.imdb);
                if (kp)   return 'https://apivb.info/api/embed.php?kp_id='   + kp;
                if (imdb) return 'https://apivb.info/api/embed.php?imdb_id=' + imdb;
                return null;
            }
        },
        {
            name: 'Bazon',
            iframe: function (movie) {
                var kp = movie.kinopoisk_id || (movie.ids && movie.ids.kinopoisk);
                return kp ? 'https://bazon.cc/kp/' + kp : null;
            }
        }
    ];

    // ─── CSS ─────────────────────────────────────────────────────────────────
    function injectCSS() {
        if (document.getElementById('ov-css')) return;
        var s = document.createElement('style');
        s.id = 'ov-css';
        s.textContent = [
            '.ov-wrap{display:flex;flex-direction:column;width:100%;height:100%}',
            '.ov-head{display:flex;align-items:center;padding:.8em 1.2em;gap:1em;flex-shrink:0}',
            '.ov-head-title{font-size:1.2em;font-weight:700;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;opacity:.9}',
            '.ov-tabs{display:flex;gap:.5em;padding:.5em 1.2em;flex-shrink:0;border-bottom:1px solid rgba(255,255,255,.08)}',
            '.ov-tab{padding:.4em 1.1em;border-radius:2em;font-size:.85em;font-weight:600;cursor:pointer;opacity:.5;transition:opacity .2s,background .2s;outline:none;background:transparent;border:none;color:inherit}',
            '.ov-tab.active,.ov-tab:focus,.ov-tab.focus{opacity:1;background:rgba(255,255,255,.12)}',
            '.ov-player{flex:1;position:relative;background:#000;min-height:0}',
            '.ov-iframe{position:absolute;inset:0;width:100%;height:100%;border:none}',
            '.ov-empty{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:.8em;opacity:.5;font-size:1.1em}',
            '.ov-spinner{width:2.5em;height:2.5em;border:.3em solid rgba(255,255,255,.2);border-top-color:#fff;border-radius:50%;animation:ov-spin .8s linear infinite}',
            '@keyframes ov-spin{to{transform:rotate(360deg)}}'
        ].join('');
        document.head.appendChild(s);
    }

    // ─── Компонент ───────────────────────────────────────────────────────────
    function IframeOnline(object) {
        var movie      = object.movie || {};
        var title      = movie.name || movie.title || movie.original_name || '';
        var available  = SOURCES.filter(function(s){ return !!s.iframe(movie); });

        var self       = this;
        var $root      = null;   // jQuery-объект корня
        var $iframe    = null;
        var $status    = null;
        var activeIdx  = 0;
        var loadTimer  = null;
        var destroyed  = false;

        // Создание DOM-дерева
        this.create = function () {
            injectCSS();

            $root = $('<div class="ov-wrap"></div>');

            // Шапка
            var $head = $('<div class="ov-head">'
                + '<div class="ov-head-title">' + Lampa.Utils.htmlSafe(title) + '</div>'
                + '</div>');
            $root.append($head);

            // Вкладки источников
            if (available.length > 1) {
                var $tabs = $('<div class="ov-tabs"></div>');
                available.forEach(function(src, i) {
                    var $t = $('<button class="ov-tab selector">' + src.name + '</button>');
                    if (i === 0) $t.addClass('active');
                    $t.on('hover:enter', function() { self.loadSource(i); });
                    $tabs.append($t);
                });
                $root.append($tabs);
            }

            // Зона плеера
            var $player = $('<div class="ov-player"></div>');
            $status  = $('<div class="ov-empty"><div class="ov-spinner"></div></div>');
            $iframe  = $('<iframe class="ov-iframe" allowfullscreen allow="autoplay; fullscreen" referrerpolicy="no-referrer"></iframe>');
            $iframe.hide();
            $player.append($status, $iframe);
            $root.append($player);

            // Автозагрузка первого источника
            if (available.length) {
                setTimeout(function(){ if (!destroyed) self.loadSource(0); }, 200);
            } else {
                $status.html('<div>Нет источников для этого фильма</div>');
            }

            return $root;
        };

        this.loadSource = function (idx) {
            if (destroyed || !available[idx]) return;
            activeIdx = idx;

            // Активная вкладка
            $root.find('.ov-tab').each(function(i, el){
                $(el).toggleClass('active', i === idx);
            });

            // Сбросить iframe и показать спиннер
            clearTimeout(loadTimer);
            $iframe.hide().attr('src', 'about:blank');
            $status.html('<div class="ov-spinner"></div>').show();

            setTimeout(function(){
                if (destroyed) return;
                var url = available[idx].iframe(movie);
                $iframe.attr('src', url);
                $iframe.off('load error').on('load', function(){
                    $status.hide();
                    $iframe.show();
                }).on('error', function(){
                    $status.html('<div>Источник не отвечает</div>').show();
                    $iframe.hide();
                });
                // Таймаут 15 сек
                loadTimer = setTimeout(function(){
                    if ($iframe.is(':hidden')) {
                        $status.html('<div>Нет ответа от ' + available[idx].name + '</div>').show();
                    }
                }, 15000);
            }, 80);
        };

        this.render  = function () { return $root; };
        this.start   = function () {};
        this.pause   = function () {};
        this.stop    = function () {};
        this.destroy = function () {
            destroyed = true;
            clearTimeout(loadTimer);
            if ($iframe) $iframe.attr('src', 'about:blank');
            Lampa.Controller.toggle('content');
        };
    }

    // ─── Регистрация компонента ───────────────────────────────────────────────
    function registerComponent() {
        // Регистрируем через встроенный механизм
        window.Lampa.Component.add('ov_iframe', IframeOnline);
    }

    // ─── Открыть просмотр ────────────────────────────────────────────────────
    function openViewer(movie) {
        Lampa.Activity.push({
            url:       '',
            title:     movie.name || movie.title || 'Онлайн',
            component: 'ov_iframe',
            movie:     movie,
            page:      1
        });
    }

    // ─── Кнопка в карточке фильма ────────────────────────────────────────────
    function hookCard() {
        Lampa.Listener.follow('full', function (e) {
            if (e.type !== 'complite') return;

            var movie = e.data.movie || e.data.card || {};

            var hasSrc = SOURCES.some(function(s){ return !!s.iframe(movie); });

            // Создаём кнопку в стиле lampa full-start
            var $btn = $([
                '<div class="full-start__button selector">',
                    '<div class="full-start__icon">',
                        '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">',
                            '<path d="M8 5v14l11-7z"/>',
                        '</svg>',
                    '</div>',
                    '<div class="full-start__text">Смотреть онлайн</div>',
                '</div>'
            ].join(''));

            if (!hasSrc) {
                $btn.addClass('full-start__button--disabled');
                $btn.css('opacity', '0.4');
            } else {
                $btn.on('hover:enter', function () {
                    openViewer(movie);
                });
            }

            // Ищем блок с кнопками разными способами (разные версии Lampa)
            var render = e.object.activity.render();
            var $btns  = render.find('.full-start__buttons');
            if (!$btns.length) $btns = render.find('.full-start__footer');
            if (!$btns.length) $btns = render.find('.full-start');

            $btns.prepend($btn);
        });
    }

    // ─── Пункт в контекстном меню карточек ───────────────────────────────────
    function hookMenu() {
        Lampa.Listener.follow('menu', function (e) {
            if (e.type !== 'show') return;
            var movie = e.data.movie || e.data.card || e.data || {};
            e.menu.push({
                title:  'Смотреть онлайн',
                icon:   'play',
                action: function () { openViewer(movie); }
            });
        });
    }

    // ─── Запуск ──────────────────────────────────────────────────────────────
    function start() {
        if (typeof Lampa === 'undefined'
            || !Lampa.Component
            || !Lampa.Activity
            || !Lampa.Listener) return;

        registerComponent();
        hookCard();
        hookMenu();

        console.log('[OnlineView] запущен');
    }

    // Ждём готовности Lampa
    if (window.appready) {
        start();
    } else {
        document.addEventListener('appready', start);
        // Запасной вариант — через Lampa.Listener
        if (window.Lampa && Lampa.Listener) {
            Lampa.Listener.follow('app', function (e) {
                if (e.type === 'start' || e.type === 'ready') start();
            });
        }
    }

})();
