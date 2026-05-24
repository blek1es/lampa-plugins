(function () {
    'use strict';

    // ─── Настройки плагина ───────────────────────────────────────────────────
    var PLUGIN_NAME = 'OnlineView';
    var PLUGIN_VERSION = '1.0.0';

    // Публичные iframe-источники (подставляют kp_id или imdb_id)
    var SOURCES = [
        {
            name: 'Alloha',
            // Alloha поддерживает kp и imdb
            url: function (card) {
                var id = card.kinopoisk_id || card.imdb_id || '';
                if (!id) return null;
                var param = card.kinopoisk_id ? 'kp=' + card.kinopoisk_id : 'imdb=' + card.imdb_id;
                return 'https://p.alloha.tv/iframe?' + param + '&token=04941a9a3ca3ac16e2b4327347bbc1';
            }
        },
        {
            name: 'HDVB',
            url: function (card) {
                var id = card.kinopoisk_id || card.imdb_id || '';
                if (!id) return null;
                var param = card.kinopoisk_id ? 'kp_id=' + card.kinopoisk_id : 'imdb_id=' + card.imdb_id;
                return 'https://apivb.info/api/videos.xml?' + param + '&token=06f569b78cbbf5e8b84d';
            }
        },
        {
            name: 'VideoCDN',
            url: function (card) {
                if (!card.kinopoisk_id) return null;
                return 'https://videocdn.tv/api/short?api_token=3i40G5TSECmLF77oAqnEgbx61ZWiJIF3&kinopoisk_id=' + card.kinopoisk_id;
            }
        },
        {
            name: 'Bazon',
            url: function (card) {
                var id = card.kinopoisk_id || card.imdb_id || '';
                if (!id) return null;
                var param = card.kinopoisk_id ? 'kp=' + card.kinopoisk_id : 'imdb=' + card.imdb_id;
                return 'https://bazon.cc/api/video?' + param;
            }
        },
        {
            name: 'Collaps',
            url: function (card) {
                if (!card.kinopoisk_id) return null;
                return 'https://api.delivembd.ws/embed/kp/' + card.kinopoisk_id;
            }
        }
    ];

    // Источники с прямым iframe (без API, просто embed)
    var IFRAME_SOURCES = [
        {
            name: 'Alloha',
            iframe: function (card) {
                if (card.kinopoisk_id)
                    return 'https://p.alloha.tv/iframe?kp=' + card.kinopoisk_id + '&token=04941a9a3ca3ac16e2b4327347bbc1';
                if (card.imdb_id)
                    return 'https://p.alloha.tv/iframe?imdb=' + card.imdb_id + '&token=04941a9a3ca3ac16e2b4327347bbc1';
                return null;
            }
        },
        {
            name: 'Collaps',
            iframe: function (card) {
                if (card.kinopoisk_id)
                    return 'https://api.delivembd.ws/embed/kp/' + card.kinopoisk_id;
                return null;
            }
        },
        {
            name: 'HDVB',
            iframe: function (card) {
                if (card.kinopoisk_id)
                    return 'https://apivb.info/api/embed.php?kp_id=' + card.kinopoisk_id;
                if (card.imdb_id)
                    return 'https://apivb.info/api/embed.php?imdb_id=' + card.imdb_id;
                return null;
            }
        },
        {
            name: 'Bazon',
            iframe: function (card) {
                if (card.kinopoisk_id)
                    return 'https://bazon.cc/kp/' + card.kinopoisk_id;
                return null;
            }
        },
        {
            name: 'VideoCDN',
            iframe: function (card) {
                if (card.kinopoisk_id)
                    return 'https://videocdn.tv/kp/' + card.kinopoisk_id;
                return null;
            }
        }
    ];

    // ─── Вспомогательные функции ─────────────────────────────────────────────

    function getCard(data) {
        // Lampa передаёт объект с полями movie/card
        return data.movie || data.card || data || {};
    }

    function buildSourceList(card) {
        var list = [];
        IFRAME_SOURCES.forEach(function (src) {
            var url = src.iframe(card);
            if (url) list.push({ name: src.name, url: url });
        });
        return list;
    }

    // ─── UI: Окно выбора источника ───────────────────────────────────────────

    function showSourceSelector(card, sources) {
        var html = '<div class="online-view-overlay" id="online-view-overlay">'
            + '<div class="online-view-modal">'
            + '<div class="online-view-header">'
            + '<span class="online-view-title">Онлайн просмотр</span>'
            + '<span class="online-view-movie-name">' + (card.name || card.title || '') + '</span>'
            + '<button class="online-view-close" id="online-view-close">✕</button>'
            + '</div>'
            + '<div class="online-view-sources">';

        if (sources.length === 0) {
            html += '<div class="online-view-empty">Источники не найдены.<br>Нет Kinopoisk ID или IMDB ID.</div>';
        } else {
            sources.forEach(function (src, i) {
                html += '<button class="online-view-src-btn" data-url="' + src.url + '" data-name="' + src.name + '">'
                    + '<span class="online-view-src-icon">▶</span>'
                    + '<span class="online-view-src-name">' + src.name + '</span>'
                    + '</button>';
            });
        }

        html += '</div></div></div>';

        var style = document.createElement('style');
        style.id = 'online-view-style';
        style.textContent = [
            '.online-view-overlay{position:fixed;inset:0;background:rgba(0,0,0,.82);z-index:99999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)}',
            '.online-view-modal{background:#181a1f;border:1px solid #2e3140;border-radius:14px;padding:0;min-width:340px;max-width:480px;width:90%;box-shadow:0 8px 48px #000a}',
            '.online-view-header{display:flex;flex-direction:column;gap:4px;padding:20px 20px 16px;border-bottom:1px solid #2e3140;position:relative}',
            '.online-view-title{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#6c7080;font-family:monospace}',
            '.online-view-movie-name{font-size:18px;font-weight:600;color:#f0f2f7;line-height:1.2}',
            '.online-view-close{position:absolute;top:16px;right:16px;background:none;border:1px solid #2e3140;border-radius:6px;color:#6c7080;font-size:14px;cursor:pointer;width:28px;height:28px;display:flex;align-items:center;justify-content:center;transition:all .15s}',
            '.online-view-close:hover{background:#2e3140;color:#f0f2f7}',
            '.online-view-sources{padding:14px 16px 18px;display:flex;flex-direction:column;gap:8px}',
            '.online-view-src-btn{background:#1e2130;border:1px solid #2e3140;border-radius:9px;color:#c8cdd8;font-size:15px;padding:12px 18px;cursor:pointer;display:flex;align-items:center;gap:12px;transition:all .15s;text-align:left}',
            '.online-view-src-btn:hover{background:#262b3e;border-color:#4e5880;color:#fff}',
            '.online-view-src-icon{color:#4e90e8;font-size:13px}',
            '.online-view-src-name{font-weight:500}',
            '.online-view-empty{color:#6c7080;text-align:center;padding:20px 0;line-height:1.7}',
            '.online-view-player-wrap{position:fixed;inset:0;z-index:100000;background:#000;display:flex;flex-direction:column}',
            '.online-view-player-bar{display:flex;align-items:center;gap:14px;padding:10px 18px;background:#181a1f;border-bottom:1px solid #2e3140;flex-shrink:0}',
            '.online-view-player-label{color:#6c7080;font-size:12px;letter-spacing:.08em}',
            '.online-view-player-src{color:#c8cdd8;font-size:14px;font-weight:600}',
            '.online-view-player-back{margin-left:auto;background:#2e3140;border:none;border-radius:7px;color:#c8cdd8;font-size:13px;padding:6px 16px;cursor:pointer;transition:all .15s}',
            '.online-view-player-back:hover{background:#4e5880;color:#fff}',
            '.online-view-player-frame{flex:1;width:100%;border:none}'
        ].join('\n');

        document.head.appendChild(style);

        var wrap = document.createElement('div');
        wrap.innerHTML = html;
        document.body.appendChild(wrap.firstChild);

        document.getElementById('online-view-close').addEventListener('click', closeOverlay);
        document.getElementById('online-view-overlay').addEventListener('click', function (e) {
            if (e.target === this) closeOverlay();
        });

        document.querySelectorAll('.online-view-src-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                openPlayer(btn.dataset.url, btn.dataset.name, card);
            });
        });
    }

    function closeOverlay() {
        var el = document.getElementById('online-view-overlay');
        if (el) el.remove();
        var st = document.getElementById('online-view-style');
        if (st) st.remove();
    }

    function openPlayer(url, sourceName, card) {
        closeOverlay();

        var wrap = document.createElement('div');
        wrap.className = 'online-view-player-wrap';
        wrap.id = 'online-view-player-wrap';
        wrap.innerHTML = '<div class="online-view-player-bar">'
            + '<span class="online-view-player-label">Источник</span>'
            + '<span class="online-view-player-src">' + sourceName + '</span>'
            + '<span style="color:#6c7080;font-size:13px;margin-left:8px">— ' + (card.name || card.title || '') + '</span>'
            + '<button class="online-view-player-back" id="online-view-back">← Назад</button>'
            + '</div>'
            + '<iframe class="online-view-player-frame" src="' + url + '" allowfullscreen allow="autoplay; fullscreen" referrerpolicy="no-referrer"></iframe>';

        document.body.appendChild(wrap);

        document.getElementById('online-view-back').addEventListener('click', function () {
            wrap.remove();
        });
    }

    // ─── Регистрация компонента Lampa ────────────────────────────────────────

    function init() {
        // Добавляем кнопку в меню карточки (action-menu)
        Lampa.Listener.follow('full', function (e) {
            if (e.type !== 'complite') return;

            var card = getCard(e.data);

            // Создаём кнопку для меню
            var button = $('<div class="full-start__button selector">'
                + '<div class="full-start__icon">'
                + '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>'
                + '</div>'
                + '<div class="full-start__text">Смотреть онлайн</div>'
                + '</div>');

            button.on('hover:enter', function () {
                var sources = buildSourceList(card);
                showSourceSelector(card, sources);
            });

            // Вставляем кнопку после кнопки "Смотреть"
            var watchBtn = e.object.activity.render().find('.full-start__button').first();
            if (watchBtn.length) {
                watchBtn.after(button);
            } else {
                e.object.activity.render().find('.full-start').append(button);
            }
        });

        // Добавляем пункт в контекстное меню (правая кнопка / long press)
        Lampa.Listener.follow('menu', function (e) {
            if (e.type !== 'show') return;

            var card = getCard(e.data);

            e.menu.push({
                title: 'Смотреть онлайн',
                subtitle: 'Выбор источника',
                icon: 'play',
                action: function () {
                    var sources = buildSourceList(card);
                    showSourceSelector(card, sources);
                }
            });
        });

        console.log('[' + PLUGIN_NAME + '] v' + PLUGIN_VERSION + ' загружен');
    }

    // ─── Точка входа ─────────────────────────────────────────────────────────

    if (window.Lampa) {
        if (Lampa.Api && Lampa.Api.sources) {
            init();
        } else {
            Lampa.Listener.follow('app', function (e) {
                if (e.type === 'start') init();
            });
        }
    }

})();
