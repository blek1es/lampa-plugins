(function () {
    'use strict';

    // =====================================================================
    // 1. НАЛАШТУВАННЯ (ЗАХИСТ ВІД КРЕШІВ - СТРОГІ ПАРАМЕТРИ)
    // =====================================================================
    Lampa.SettingsApi.addComponent({
        component: 'jellyfin_config',
        name: 'Jellyfin',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>'
    });

    Lampa.SettingsApi.addParam({
        component: 'jellyfin_config',
        param: {
            name: 'jellyfin_nas_server',
            type: 'input',
            placeholder: '',
            values: '', 
            default: ''
        },
        field: {
            name: 'Адреса сервера Jellyfin',
            description: 'Наприклад: http://192.168.0.1:8096'
        }
    });

    Lampa.SettingsApi.addParam({
        component: 'jellyfin_config',
        param: {
            name: 'jellyfin_nas_token',
            type: 'input',
            placeholder: '',
            values: '', 
            default: ''
        },
        field: {
            name: 'API Ключ',
            description: 'Згенеруйте ключ в панелі адміністратора Jellyfin'
        }
    });

    Lampa.SettingsApi.addParam({
        component: 'jellyfin_config',
        param: {
            name: 'jellyfin_nas_check',
            type: 'button'
        },
        field: {
            name: 'Перевірити підключення',
            description: 'Натисніть для тестового запиту до сервера'
        }
    });

    Lampa.Settings.listener.follow('open', function (e) {
        if (e.name == 'jellyfin_config') {
            var checkBtn = e.body.find('[data-name="jellyfin_nas_check"]');
            checkBtn.find('.settings-param__name').css('color', '#00ff00');
            
            checkBtn.off('hover:enter click').on('hover:enter click', function () {
                var url = Lampa.Storage.get('jellyfin_nas_server', '').replace(/\/$/, '').trim();
                var token = Lampa.Storage.get('jellyfin_nas_token', '').trim();

                if (!url || !token) {
                    Lampa.Noty.show('Спочатку введіть адресу та ключ!');
                    return;
                }

                Lampa.Noty.show('З\'єднуємось з сервером...');
                
                $.ajax({
                    url: url + '/System/Info?api_key=' + token,
                    type: 'GET',
                    dataType: 'json',
                    timeout: 10000,
                    success: function (res) {
                        if (res && res.Id) {
                            Lampa.Noty.show('Успіх! Підключено до: ' + (res.ServerName || 'Jellyfin'));
                        } else {
                            Lampa.Noty.show('Помилка: Невірний API Ключ!');
                        }
                    },
                    error: function () {
                        Lampa.Noty.show('Помилка підключення до сервера');
                    }
                });
            });
        }
    });

    // =====================================================================
    // 2. ФУНКЦІЯ ПЛЕЄРА З ПІДТРИМКОЮ ТАЙМЛАЙНУ ТА ІСТОРІЇ
    // =====================================================================
    function startPlayer(id, title, url, token, movie, season, episode) {
        var streamUrl = url + '/Items/' + id + '/Download?api_key=' + token;
        // Надійніша перевірка на серіал (щоб сезон 0 (Спецвипуски) не зчитувався як false)
        var isTv = season !== null && season !== undefined && episode !== null && episode !== undefined;
        
        // 1. Формуємо унікальний хеш для відстеження прогресу (додано original_name для серіалів)
        var hashTitle = movie.original_title || movie.original_name || movie.title || movie.name || title || '';
        var hashStr = isTv ? [season, episode, hashTitle].join('') : hashTitle;
        var hash_file = Lampa.Utils.hash(hashStr);
        
        // 2. Отримуємо збережений прогрес (таймкод)
        var timelineData = Lampa.Timeline.view(hash_file);
        
        var video = {
            title: title.replace(/ \[[^\]]+\]$/, ''), // Прибираємо візуальні теги [✓] для плеєра
            url: streamUrl,
            timeline: timelineData,
            movie: movie
        };
        
        // 3. Зберігаємо історію та мітку останньої переглянутої серії
        if (isTv) {
            video.episode = { season: season, episode: episode };
            Lampa.Storage.set('online_watched_last', { id: movie.id || movie.tmdb_id, season: season, episode: episode });
        }
        
        // Заносимо у вкладку "Історія" Лампи
        Lampa.Favorite.add('history', movie, 100);
        
        console.log('Запуск Jellyfin:', video);
        Lampa.Noty.show('Відкриваємо плеєр...');
        
        Lampa.Player.play(video);
        Lampa.Player.playlist([video]);
    }

    // =====================================================================
    // 3. ПОШУК ТА ПЕРЕВІРКА ВІДПОВІДНОСТІ 
    // =====================================================================
    function findAndPlay(movie) {
        var url = Lampa.Storage.get('jellyfin_nas_server', '').replace(/\/$/, '').trim();
        var token = Lampa.Storage.get('jellyfin_nas_token', '').trim();
        if (!url || !token) return Lampa.Noty.show('Налаштуйте Jellyfin у налаштуваннях');

        var tmdbId = movie.id || movie.tmdb_id;
        // Захист: якщо ID довгий (UUID від Jellyfin), то це локальний об'єкт, а не TMDB ID
        var isTmdbId = tmdbId && String(tmdbId).length < 15;
        var targetTitle = (movie.title || movie.name || movie.original_name || movie.original_title || '').toLowerCase().trim();
        
        Lampa.Noty.show('Шукаємо відповідний файл...');

        $.ajax({
            url: url + '/Users?api_key=' + token,
            type: 'GET',
            dataType: 'json',
            success: function (users) {
                if (!users || users.length === 0) return Lampa.Noty.show('Користувачів Jellyfin не знайдено');
                var userId = users[0].Id;

                // Розумний пошук: якщо є справжній TMDB ID - шукаємо по ньому. Якщо ні - шукаємо по назві.
                var queryParam = isTmdbId ? '&AnyProviderIdEquals=tmdb.' + tmdbId : '&SearchTerm=' + encodeURIComponent(movie.title || movie.name || '');
                var searchUrl = url + '/Users/' + userId + '/Items?Recursive=true&IncludeItemTypes=Movie,Series,Episode&Fields=Path&api_key=' + token + queryParam;

                $.ajax({
                    url: searchUrl,
                    type: 'GET',
                    dataType: 'json',
                    success: function (data) {
                        if (data && data.Items && data.Items.length > 0) {
                            var foundItem = null;

                            // Спершу пробуємо точний пошук
                            for (var i = 0; i < data.Items.length; i++) {
                                var item = data.Items[i];
                                if (isTmdbId && item.ProviderIds && item.ProviderIds.Tmdb && String(item.ProviderIds.Tmdb) === String(tmdbId)) {
                                    foundItem = item;
                                    break;
                                }
                            }

                            // Запасний пошук по імені
                            if (!foundItem) {
                                for (var j = 0; j < data.Items.length; j++) {
                                    var item2 = data.Items[j];
                                    var jTitle = (item2.Name || '').toLowerCase().trim();
                                    if (jTitle === targetTitle) {
                                        foundItem = item2;
                                        break;
                                    }
                                }
                            }

                            // Глобальний фолбек, якщо нічого не зійшлось (щоб не крешити)
                            if (!foundItem) foundItem = data.Items[0];

                            if (foundItem) {
                                if (foundItem.Type === 'Series') {
                                    $.ajax({
                                        url: url + '/Shows/' + foundItem.Id + '/Episodes?userId=' + userId + '&Fields=Path&api_key=' + token,
                                        type: 'GET',
                                        dataType: 'json',
                                        success: function (epData) {
                                            if (epData && epData.Items && epData.Items.length > 0) {
                                                
                                                // ВИНОСИМО ЗВЕРНЕННЯ ДО ПАМ'ЯТІ (КЕШУ) ЗА МЕЖІ ЦИКЛУ
                                                // Саме це викликало Script Error на масиві серій
                                                var viewedCheck = Lampa.Storage.cache('file_view', 10000, []);
                                                if (!Array.isArray(viewedCheck)) viewedCheck = [];
                                                
                                                var hashTitle = movie.original_title || movie.original_name || movie.title || movie.name || '';
                                                
                                                // Генеруємо список серій з мітками прогресу
                                                var episodes = epData.Items.map(function (ep) {
                                                    // Безпечне читання сезонів (враховує 0 сезон)
                                                    var sNum = ep.ParentIndexNumber !== undefined ? ep.ParentIndexNumber : 1;
                                                    var eNum = ep.IndexNumber !== undefined ? ep.IndexNumber : 1;
                                                    
                                                    // Перевірка прогресу для відображення
                                                    var hashStr = [sNum, eNum, hashTitle].join('');
                                                    var hash_file = Lampa.Utils.hash(hashStr);
                                                    var tl = Lampa.Timeline.view(hash_file);
                                                    
                                                    var isViewed = viewedCheck.indexOf(hash_file) !== -1 || (tl && tl.percent > 95);
                                                    var statusIndicator = isViewed ? ' [✓]' : (tl && tl.percent > 0 ? ' [' + Math.floor(tl.percent) + '%]' : '');

                                                    return {
                                                        title: 'S' + sNum + ' E' + eNum + ' - ' + (ep.Name || 'Episode') + statusIndicator,
                                                        jellyId: ep.Id,
                                                        season: sNum,
                                                        episode: eNum
                                                    };
                                                });

                                                Lampa.Select.show({
                                                    title: 'Оберіть серію',
                                                    items: episodes,
                                                    onSelect: function (sel) {
                                                        startPlayer(sel.jellyId, sel.title, url, token, movie, sel.season, sel.episode);
                                                    },
                                                    onBack: function () { Lampa.Controller.toggle('full_start'); }
                                                });
                                            } else { Lampa.Noty.show('Серій не знайдено'); }
                                        },
                                        error: function () { Lampa.Noty.show('Помилка завантаження списку серій'); }
                                    });
                                } else {
                                    startPlayer(foundItem.Id, foundItem.Name, url, token, movie, null, null);
                                }
                            } else {
                                Lampa.Noty.show('Цього відео немає у вашій медіатеці Jellyfin');
                            }
                        } else {
                            Lampa.Noty.show('Бібліотека сервера порожня або відео не знайдено');
                        }
                    },
                    error: function () { Lampa.Noty.show('Помилка пошуку файлів'); }
                });
            },
            error: function () { Lampa.Noty.show('Помилка авторизації на сервері'); }
        });
    }

    Lampa.Listener.follow('full', function (e) {
        if (e.type == 'complite' || e.type == 'complete') {
            var render = e.object.activity.render();
            
            var btn = render.find('.view--jellyfin');
            if (!btn.length) {
                btn = $('<div class="full-start__button selector view--jellyfin" style="background-color: #8b3ab9;"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg><span style="color:#fff; margin-left: 8px;">Jellyfin</span></div>');
                
                var target = render.find('.view--torrent');
                if (target.length) target.after(btn);
                else render.find('.full-start__buttons').append(btn);
            }
            
            btn.off('hover:enter click').on('hover:enter click', function () {
                findAndPlay(e.data.movie);
            });
        }
    });

    // =====================================================================
    // 4. ДОДАВАННЯ РОЗДІЛУ В ЛІВЕ МЕНЮ
    // =====================================================================
    function addMenu() {
        if ($('[data-action="jellyfin_catalog"]').length) return;
        var item = $('<li class="menu__item selector" data-action="jellyfin_catalog"><div class="menu__ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg></div><div class="menu__text">Jellyfin</div></li>');
        item.on('hover:enter click', function () {
            Lampa.Activity.push({ url: '', title: 'Jellyfin Медіа', component: 'jellyfin_catalog', page: 1 });
        });
        $('.menu__list').eq(0).append(item);
    }

    if (window.appready) addMenu();
    Lampa.Listener.follow('app', function (e) { if (e.type == 'ready') addMenu(); });

    // =====================================================================
    // 5. КОМПОНЕНТ КАТАЛОГУ 
    // =====================================================================
    function JellyfinCatalog(object) {
        var scroll = new Lampa.Scroll({ mask: true, over: true });
        var files = [];
        var html = $('<div></div>');
        var body = $('<div class="category-full"></div>');
        var _this = this;
        
        // Змінна для захисту від багаторазових кліків
        this.isLoading = false;

        this.activity = object.activity;

        // Винесено в окрему функцію для зручності оновлення
        this.loadData = function () {
            if (_this.isLoading) return; // Блокуємо якщо вже йде завантаження
            _this.isLoading = true;

            // Глибоке очищення перед завантаженням (виправляє дублювання кнопок)
            files.forEach(function(c) { c.destroy(); });
            files = [];
            scroll.clear(); // Повністю очищує вміст скролу
            scroll.reset(); // Скидає позицію скролу на гору
            html.empty();
            body.empty();

            var url = Lampa.Storage.get('jellyfin_nas_server', '').replace(/\/$/, '').trim();
            var token = Lampa.Storage.get('jellyfin_nas_token', '').trim();

            if (!url || !token) {
                html.append('<div class="empty">Налаштуйте Jellyfin у налаштуваннях</div>');
                _this.isLoading = false;
                return;
            }

            _this.activity.loader(true);

            // Force Update - без кешу
            var reqUrl = url + '/Items?Recursive=true&IncludeItemTypes=Movie,Series&Fields=ProviderIds,ProductionYear,CommunityRating&SortBy=DateCreated&SortOrder=Descending&api_key=' + token + '&_t=' + Date.now();
            
            $.ajax({
                url: reqUrl,
                type: 'GET',
                dataType: 'json',
                cache: false, 
                success: function (data) {
                    _this.isLoading = false;
                    _this.activity.loader(false);
                    if (data && data.Items && data.Items.length > 0) {
                        _this.build(data.Items, url, token);
                    } else {
                        html.append('<div class="empty">Бібліотека порожня</div>');
                    }
                },
                error: function () {
                    _this.isLoading = false;
                    _this.activity.loader(false);
                    html.append('<div class="empty">Помилка підключення до сервера</div>');
                }
            });
        };

        this.create = function () {
            this.loadData();
            return this.render();
        };

        this.build = function (items, url, token) {
            html.empty();
            scroll.clear(); // Зайвий раз для безпеки
            html.append(scroll.render());

            // ДОДАВАННЯ КНОПКИ ОНОВЛЕННЯ 
            var btnContainer = $('<div class="jellyfin-refresh-wrap" style="padding: 1.5em 2em 0.5em 2em; display: block;"></div>');
            var btnRefresh = $('<div class="selector btn-refresh" style="background: rgba(255,255,255,0.1); color: #fff; padding: 0.8em; border-radius: 0.5em; text-align: center; cursor: pointer; font-size: 1.1em; transition: all 0.2s; box-sizing: border-box;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 1.2em; height: 1.2em; vertical-align: sub; margin-right: 0.5em;"><path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>Оновити список з сервера</div>');
            
            // Налаштування для правильного виділення пультом чи клавіатурою
            btnRefresh.on('hover:focus', function () {
                btnRefresh.css({ background: '#ffffff', color: '#000000', transform: 'scale(1.02)' });
                scroll.update(btnRefresh, true);
            }).on('hover:empty', function () {
                btnRefresh.css({ background: 'rgba(255,255,255,0.1)', color: '#ffffff', transform: 'scale(1)' });
            });

            // Натискання (Пульт / Миша / Сенсор)
            btnRefresh.on('hover:enter click', function (e) {
                e.stopPropagation(); // Захист від подвійного спрацювання від Лампи
                _this.loadData(); // Перезавантажує сторінку
            });

            btnContainer.append(btnRefresh);
            scroll.append(btnContainer); // Кнопка перша
            scroll.append(body);         // Картки під нею

            items.forEach(function (item) {
                var tmdbId = (item.ProviderIds && item.ProviderIds.Tmdb) ? item.ProviderIds.Tmdb : null;
                var type = item.Type === 'Series' ? 'tv' : 'movie';
                var year = item.ProductionYear ? item.ProductionYear + '-01-01' : '';
                
                var card_data = {
                    id: tmdbId || item.Id, 
                    source: tmdbId ? 'tmdb' : 'jellyfin',
                    type: type,
                    title: item.Name,
                    name: item.Name,
                    original_title: item.OriginalTitle || item.Name,
                    release_date: year,
                    first_air_date: year,
                    poster_path: '', 
                    img: '',
                    vote_average: item.CommunityRating || 0
                };

                var card = new Lampa.Card(card_data, { card_category: false });
                card.create(); 
                
                var cardEl = card.render();
                cardEl.removeClass('card--preload').addClass('card--loaded');

                if (tmdbId) {
                    var lang = Lampa.Storage.get('language', 'uk');
                    var apiKey = Lampa.TMDB.key();
                    var tmdbUrl = Lampa.TMDB.api(type + '/' + tmdbId + '?api_key=' + apiKey + '&language=' + lang);

                    $.ajax({
                        url: tmdbUrl,
                        type: 'GET',
                        dataType: 'json',
                        timeout: 5000,
                        success: function(res) {
                            if (res && res.poster_path) {
                                var secureImg = Lampa.TMDB.image('t/p/w300' + res.poster_path);
                                card_data.poster_path = res.poster_path;
                                card_data.img = secureImg;
                                cardEl.find('.card__img').attr('src', secureImg);
                                
                                if (cardEl.hasClass('focus')) {
                                    Lampa.Background.change(secureImg);
                                }
                            } else {
                                var localUrl = url + '/Items/' + item.Id + '/Images/Primary?api_key=' + token;
                                card_data.img = localUrl;
                                cardEl.find('.card__img').attr('src', localUrl);
                            }
                        },
                        error: function() {
                            var localUrl = url + '/Items/' + item.Id + '/Images/Primary?api_key=' + token;
                            card_data.img = localUrl;
                            cardEl.find('.card__img').attr('src', localUrl);
                        }
                    });
                } else {
                    var localUrl = url + '/Items/' + item.Id + '/Images/Primary?api_key=' + token;
                    card_data.img = localUrl;
                    cardEl.find('.card__img').attr('src', localUrl);
                }

                cardEl.on('hover:focus', function() {
                    if (card_data.img) {
                        Lampa.Background.change(card_data.img);
                    }
                });

                cardEl.on('hover:enter click', function () {
                    Lampa.Activity.push({
                        url: '',
                        component: 'full',
                        id: card_data.id,
                        method: card_data.type,
                        card: card_data,
                        source: card_data.source
                    });
                });

                body.append(cardEl);
                files.push(card);
            });

            scroll.onScroll = function() {
                files.forEach(function(c) {
                    if (c.visible) c.visible();
                });
            };

            setTimeout(function() {
                files.forEach(function(c) {
                    if (c.visible) c.visible();
                });
            }, 100);

            // =====================================================================
            // Навігація всередині екрану
            // =====================================================================
            Lampa.Controller.add('content', {
                toggle: function () {
                    Lampa.Controller.collectionSet(scroll.render());
                    // Завжди наводимось на першу картку або на кнопку "Оновити", якщо список пустий
                    Lampa.Controller.collectionFocus(files.length ? files[0].render() : btnRefresh, scroll.render());
                },
                right: function () {
                    Navigator.move('right');
                },
                left: function () {
                    if (Navigator.canmove('left')) Navigator.move('left');
                    else Lampa.Controller.toggle('menu');
                },
                down: function () {
                    Navigator.move('down'); // Завдяки правильному DOM-дереву, пульт сам перескочить з кнопки на картки
                },
                up: function () {
                    if (Navigator.canmove('up')) Navigator.move('up');
                    else Lampa.Controller.toggle('head'); // Дозволяє вийти до шапки застосунку
                },
                back: function () {
                    Lampa.Activity.backward();
                }
            });
            Lampa.Controller.toggle('content');
        };

        this.render = function () { return html; };
        this.start = function () { Lampa.Controller.toggle('content'); };
        this.pause = function () {};
        this.stop = function () {};
        this.destroy = function () { 
            files.forEach(function(card) {
                card.destroy();
            });
            files = []; 
            scroll.destroy(); 
            html.remove(); 
        };
    }

    Lampa.Component.add('jellyfin_catalog', JellyfinCatalog);

})();