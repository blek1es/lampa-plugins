(function() {
  'use strict';

  var Defined = {
    api: 'collaps',
    localhost: 'http://localhost/',
    apn: ''
  };

  var collaps_unic_id = Lampa.Storage.get('collaps_unic_id', '');
  if (!collaps_unic_id) {
    collaps_unic_id = Lampa.Utils.uid(8).toLowerCase();
    Lampa.Storage.set('collaps_unic_id', collaps_unic_id);
  }

  function account(url) {
    url = url + '';
    if (url.indexOf('account_email=') == -1) {
      var email = Lampa.Storage.get('account_email');
      if (email) url = Lampa.Utils.addUrlComponent(url, 'account_email=' + encodeURIComponent(email));
    }
    if (url.indexOf('uid=') == -1) {
      var uid = Lampa.Storage.get('collaps_unic_id', '');
      if (uid) url = Lampa.Utils.addUrlComponent(url, 'uid=' + encodeURIComponent(uid));
    }
    return url;
  }

  function formatEpisodeNumber(episodeNumber) {
    return (episodeNumber < 10 ? '0' : '') + episodeNumber;
  }

  var Network = Lampa.Reguest;

  function component(object) {
    var network = new Network();
    var scroll = new Lampa.Scroll({
      mask: true,
      over: true
    });
    var files = new Lampa.Explorer(object);
    var filter = new Lampa.Filter(object);
    var last;
    var initialized;
    var images = [];
    var filter_translate = {
      season: Lampa.Lang.translate('torrent_serial_season'),
      voice: Lampa.Lang.translate('torrent_parser_voice')
    };
    var filter_find = {
      season: [],
      voice: []
    };

    this.initialize = function() {
      var _this = this;
      this.loading(true);

      filter.onBack = function() {
        _this.start();
      };

      filter.render().find('.selector').on('hover:enter', function() {
        // Обработка выбора фильтра
      });

      filter.onSelect = function(type, a, b) {
        if (type == 'filter') {
          if (a.reset) {
            _this.replaceChoice({
              season: 0,
              voice: 0,
              voice_name: ''
            });
            setTimeout(function() {
              Lampa.Select.close();
              Lampa.Activity.replace();
            }, 10);
          } else {
            var choice = _this.getChoice();
            if (a.stype == 'voice') {
              choice.voice_name = filter_find.voice[b.index].title;
            }
            choice[a.stype] = b.index;
            _this.saveChoice(choice);
            _this.reset();
            _this.loadContent();
            setTimeout(Lampa.Select.close, 10);
          }
        }
      };

      if (filter.addButtonBack) filter.addButtonBack();
      filter.render().find('.filter--sort span').text('Collaps');

      scroll.body().addClass('torrent-list');
      files.appendFiles(scroll.render());
      files.appendHead(filter.render());
      scroll.minus(files.render().find('.explorer__files-head'));
      scroll.body().append(Lampa.Template.get('collaps_content_loading'));

      Lampa.Controller.enable('content');
      this.loading(false);

      this.externalids().then(function() {
        return _this.createSource();
      }).then(function() {
        _this.search();
      })["catch"](function(e) {
        _this.noConnectToServer(e);
      });
    };

    this.externalids = function() {
      return new Promise(function(resolve, reject) {
        if (!object.movie.imdb_id || !object.movie.kinopoisk_id) {
          var query = [];
          query.push('id=' + encodeURIComponent(object.movie.id));
          query.push('serial=' + (object.movie.name ? 1 : 0));
          if (object.movie.imdb_id) query.push('imdb_id=' + (object.movie.imdb_id || ''));
          if (object.movie.kinopoisk_id) query.push('kinopoisk_id=' + (object.movie.kinopoisk_id || ''));

          var url = Defined.localhost + 'collaps/externalids?' + query.join('&');
          network.timeout(10000);
          network.silent(account(url), function(json) {
            for (var name in json) {
              object.movie[name] = json[name];
            }
            resolve();
          }, function() {
            resolve();
          });
        } else resolve();
      });
    };

    this.createSource = function() {
      return new Promise(function(resolve, reject) {
        resolve();
      });
    };

    this.requestParams = function(url) {
      var query = [];
      query.push('id=' + encodeURIComponent(object.movie.id));

      if (object.movie.imdb_id) query.push('imdb_id=' + (object.movie.imdb_id || ''));
      if (object.movie.kinopoisk_id) query.push('kinopoisk_id=' + (object.movie.kinopoisk_id || ''));

      query.push('title=' + encodeURIComponent(object.movie.title || object.movie.name));
      query.push('original_title=' + encodeURIComponent(object.movie.original_title || object.movie.original_name));
      query.push('serial=' + (object.movie.name ? 1 : 0));
      query.push('year=' + ((object.movie.release_date || object.movie.first_air_date || '0000') + '').slice(0, 4));

      return url + (url.indexOf('?') >= 0 ? '&' : '?') + query.join('&');
    };

    this.create = function() {
      return this.render();
    };

    this.search = function() {
      this.filter({}, this.getChoice());
      this.find();
    };

    this.find = function() {
      var url = this.requestParams(Defined.localhost + 'collaps/index');
      this.request(url);
    };

    this.request = function(url) {
      var _this = this;
      network["native"](account(url), this.parse.bind(this), function(error) {
        _this.doesNotAnswer(error);
      }, false, {
        dataType: 'json'
      });
    };

    this.parse = function(json) {
      var _this = this;

      try {
        if (!json || !json.success) {
          return this.empty();
        }

        this.activity.loader(false);

        if (json.translations && json.translations.length > 0) {
          // Есть переводы - показываем их
          filter_find.voice = json.translations.map(function(t) {
            return {
              title: t.name,
              id: t.id
            };
          });

          var selected_voice = this.getChoice().voice || 0;
          var translation = json.translations[selected_voice];

          if (translation && translation.seasons) {
            // Сериал - показываем сезоны
            this.displaySeasons(translation.seasons, translation);
          } else if (translation && translation.url) {
            // Фильм
            this.displayMovie(translation);
          }
        } else if (json.url) {
          // Прямая ссылка на фильм
          this.displayMovie(json);
        } else {
          this.empty();
        }
      } catch (e) {
        console.error('[Collaps]', 'parse error', e);
        this.doesNotAnswer(e);
      }
    };

    this.displaySeasons = function(seasons, translation) {
      var _this = this;

      filter_find.season = seasons.map(function(s, i) {
        return {
          title: 'Сезон ' + s.season,
          season: s.season
        };
      });

      var selected_season = this.getChoice().season || 0;
      var season = seasons[selected_season];

      if (season && season.episodes) {
        this.displayEpisodes(season.episodes, season.season, translation);
      }

      this.filter({
        season: filter_find.season.map(function(s) { return s.title; }),
        voice: filter_find.voice.map(function(v) { return v.title; })
      }, this.getChoice());
    };

    this.displayMovie = function(data) {
      var _this = this;
      scroll.clear();

      var element = {
        title: object.movie.title || object.movie.name,
        url: data.url,
        quality: data.quality || '1080p',
        translation: data.name || 'Оригинал'
      };

      var html = Lampa.Template.get('collaps_prestige_full', {
        title: element.title,
        info: element.translation,
        quality: element.quality,
        time: ''
      });

      html.find('.online-prestige__img').remove();
      html.find('.online-prestige__timeline').remove();

      html.on('hover:enter', function() {
        if (object.movie.id) Lampa.Favorite.add('history', object.movie, 100);
        _this.playMovie(element);
      }).on('hover:focus', function(e) {
        last = e.target;
        scroll.update($(e.target), true);
      });

      scroll.append(html);
      Lampa.Controller.enable('content');
    };

    this.displayEpisodes = function(episodes, season, translation) {
      var _this = this;
      scroll.clear();

      episodes.forEach(function(episode, index) {
        var element = {
          title: episode.title || 'Серия ' + episode.episode,
          episode: episode.episode,
          season: season,
          url: episode.url,
          translation: translation.name
        };

        var html = Lampa.Template.get('collaps_prestige_full', {
          title: element.title,
          info: translation.name,
          quality: episode.quality || '',
          time: ''
        });

        html.find('.online-prestige__img').append('<div class="online-prestige__episode-number">' + formatEpisodeNumber(episode.episode) + '</div>');

        var hash_timeline = Lampa.Utils.hash([season, episode.episode, object.movie.original_title].join(''));
        var timeline = Lampa.Timeline.view(hash_timeline);
        html.find('.online-prestige__timeline').append(Lampa.Timeline.render(timeline));

        html.on('hover:enter', function() {
          if (object.movie.id) Lampa.Favorite.add('history', object.movie, 100);
          _this.playEpisode(element);
        }).on('hover:focus', function(e) {
          last = e.target;
          scroll.update($(e.target), true);
        });

        scroll.append(html);
      });

      Lampa.Controller.enable('content');
    };

    this.playMovie = function(element) {
      var play = {
        title: element.title,
        url: element.url,
        quality: {},
        timeline: {},
        subtitles: []
      };

      Lampa.Player.play(play);
      Lampa.Player.playlist([play]);
    };

    this.playEpisode = function(element) {
      var hash_timeline = Lampa.Utils.hash([element.season, element.episode, object.movie.original_title].join(''));

      var play = {
        title: element.title,
        url: element.url,
        quality: {},
        timeline: Lampa.Timeline.view(hash_timeline),
        subtitles: [],
        season: element.season,
        episode: element.episode
      };

      Lampa.Player.play(play);
      Lampa.Player.playlist([play]);
    };

    this.getChoice = function() {
      var data = Lampa.Storage.cache('collaps_choice', 3000, {});
      var save = data[object.movie.id] || {};
      Lampa.Arrays.extend(save, {
        season: 0,
        voice: 0,
        voice_name: ''
      });
      return save;
    };

    this.saveChoice = function(choice) {
      var data = Lampa.Storage.cache('collaps_choice', 3000, {});
      data[object.movie.id] = choice;
      Lampa.Storage.set('collaps_choice', data);
    };

    this.replaceChoice = function(choice) {
      var to = this.getChoice();
      Lampa.Arrays.extend(to, choice, true);
      this.saveChoice(to);
    };

    this.clearImages = function() {
      images.forEach(function(img) {
        img.onerror = function() {};
        img.onload = function() {};
        img.src = '';
      });
      images = [];
    };

    this.reset = function() {
      last = false;
      network.clear();
      this.clearImages();
      scroll.render().find('.empty').remove();
      scroll.clear();
      scroll.reset();
      scroll.body().append(Lampa.Template.get('collaps_content_loading'));
    };

    this.loading = function(status) {
      if (status) this.activity.loader(true);
      else {
        this.activity.loader(false);
        this.activity.toggle();
      }
    };

    this.filter = function(filter_items, choice) {
      var _this = this;
      var select = [];

      var add = function(type, title) {
        var need = _this.getChoice();
        var items = filter_items[type];
        var subitems = [];
        var value = need[type];

        items.forEach(function(name, i) {
          subitems.push({
            title: name,
            selected: value == i,
            index: i
          });
        });

        select.push({
          title: title,
          subtitle: items[value],
          items: subitems,
          stype: type
        });
      };

      select.push({
        title: Lampa.Lang.translate('torrent_parser_reset'),
        reset: true
      });

      this.saveChoice(choice);

      if (filter_items.voice && filter_items.voice.length) add('voice', Lampa.Lang.translate('torrent_parser_voice'));
      if (filter_items.season && filter_items.season.length) add('season', Lampa.Lang.translate('torrent_serial_season'));

      filter.set('filter', select);
      this.selected(filter_items);
    };

    this.selected = function(filter_items) {
      var need = this.getChoice(),
        select = [];

      for (var i in need) {
        if (filter_items[i] && filter_items[i].length) {
          if (i == 'voice' || i == 'season') {
            select.push(filter_translate[i] + ': ' + filter_items[i][need[i]]);
          }
        }
      }

      filter.chosen('filter', select);
    };

    this.empty = function() {
      var html = Lampa.Template.get('collaps_does_not_answer', {});
      html.find('.online-empty__buttons').remove();
      html.find('.online-empty__title').text(Lampa.Lang.translate('empty_title_two'));
      html.find('.online-empty__time').text(Lampa.Lang.translate('empty_text'));
      scroll.clear();
      scroll.append(html);
      this.loading(false);
    };

    this.noConnectToServer = function(er) {
      var html = Lampa.Template.get('collaps_does_not_answer', {});
      html.find('.online-empty__buttons').remove();
      html.find('.online-empty__title').text(Lampa.Lang.translate('title_error'));
      html.find('.online-empty__time').text('Не удалось подключиться к серверу Collaps');
      scroll.clear();
      scroll.append(html);
      this.loading(false);
    };

    this.doesNotAnswer = function(er) {
      this.reset();
      var html = Lampa.Template.get('collaps_does_not_answer', {});
      scroll.clear();
      scroll.append(html);
      this.loading(false);
    };

    this.start = function() {
      if (Lampa.Activity.active().activity !== this.activity) return;

      if (!initialized) {
        initialized = true;
        this.initialize();
      }

      Lampa.Background.immediately(Lampa.Utils.cardImgBackgroundBlur(object.movie));

      Lampa.Controller.add('content', {
        toggle: function() {
          Lampa.Controller.collectionSet(scroll.render(), files.render());
          Lampa.Controller.collectionFocus(last || false, scroll.render());
        },
        up: function() {
          if (Navigator.canmove('up')) {
            Navigator.move('up');
          } else Lampa.Controller.toggle('head');
        },
        down: function() {
          Navigator.move('down');
        },
        right: function() {
          if (Navigator.canmove('right')) Navigator.move('right');
          else filter.show(Lampa.Lang.translate('title_filter'), 'filter');
        },
        left: function() {
          if (Navigator.canmove('left')) Navigator.move('left');
          else Lampa.Controller.toggle('menu');
        },
        back: this.back.bind(this)
      });

      Lampa.Controller.toggle('content');
    };

    this.render = function() {
      return files.render();
    };

    this.back = function() {
      Lampa.Activity.backward();
    };

    this.pause = function() {};
    this.stop = function() {};

    this.destroy = function() {
      network.clear();
      this.clearImages();
      files.destroy();
      scroll.destroy();
    };
  }

  function startPlugin() {
    window.collaps_plugin = true;

    var manifest = {
      type: 'video',
      version: '1.0.0',
      name: 'Collaps',
      description: 'Плагин для просмотра через Collaps',
      component: 'collaps',
      onContextMenu: function(object) {
        return {
          name: 'Смотреть на Collaps',
          description: ''
        };
      },
      onContextLauch: function(object) {
        resetTemplates();
        Lampa.Component.add('collaps', component);

        Lampa.Activity.push({
          url: '',
          title: 'Collaps Online',
          component: 'collaps',
          movie: object,
          page: 1
        });
      }
    };

    Lampa.Manifest.plugins = manifest;

    function resetTemplates() {
      Lampa.Template.add('collaps_prestige_full',
        "<div class=\"online-prestige online-prestige--full selector\">\n" +
        "  <div class=\"online-prestige__img\">\n" +
        "    <img alt=\"\">\n" +
        "    <div class=\"online-prestige__loader\"></div>\n" +
        "  </div>\n" +
        "  <div class=\"online-prestige__body\">\n" +
        "    <div class=\"online-prestige__head\">\n" +
        "      <div class=\"online-prestige__title\">{title}</div>\n" +
        "      <div class=\"online-prestige__time\">{time}</div>\n" +
        "    </div>\n" +
        "    <div class=\"online-prestige__timeline\"></div>\n" +
        "    <div class=\"online-prestige__footer\">\n" +
        "      <div class=\"online-prestige__info\">{info}</div>\n" +
        "      <div class=\"online-prestige__quality\">{quality}</div>\n" +
        "    </div>\n" +
        "  </div>\n" +
        "</div>"
      );

      Lampa.Template.add('collaps_content_loading',
        "<div class=\"online-empty\">\n" +
        "  <div class=\"broadcast__scan\"><div></div></div>\n" +
        "  <div class=\"online-empty__templates\">\n" +
        "    <div class=\"online-empty-template selector\">\n" +
        "      <div class=\"online-empty-template__ico\"></div>\n" +
        "      <div class=\"online-empty-template__body\"></div>\n" +
        "    </div>\n" +
        "  </div>\n" +
        "</div>"
      );

      Lampa.Template.add('collaps_does_not_answer',
        "<div class=\"online-empty\">\n" +
        "  <div class=\"online-empty__title\">Ошибка</div>\n" +
        "  <div class=\"online-empty__time\">Попробуйте позже</div>\n" +
        "</div>"
      );
    }

    Lampa.Component.add('collaps', component);
    resetTemplates();

    var button =
      '<div class="full-start__button selector view--collaps" data-subtitle="Collaps v1.0.0">\n' +
      '  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">\n' +
      '    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>\n' +
      '  </svg>\n' +
      '  <span>Collaps</span>\n' +
      '</div>';

    function addButton(e) {
      if (e.render.find('.view--collaps').length) return;

      var btn = $(button);
      btn.on('hover:enter', function() {
        resetTemplates();
        Lampa.Component.add('collaps', component);

        Lampa.Activity.push({
          url: '',
          title: 'Collaps Online',
          component: 'collaps',
          movie: e.movie,
          page: 1
        });
      });

      e.render.after(btn);
    }

    Lampa.Listener.follow('full', function(e) {
      if (e.type == 'complite') {
        addButton({
          render: e.object.activity.render().find('.view--torrent'),
          movie: e.data.movie
        });
      }
    });

    try {
      if (Lampa.Activity.active().component == 'full') {
        addButton({
          render: Lampa.Activity.active().activity.render().find('.view--torrent'),
          movie: Lampa.Activity.active().card
        });
      }
    } catch (e) {}

    if (Lampa.Manifest.app_digital >= 177) {
      Lampa.Storage.sync('collaps_choice', 'object_object');
    }
  }

  if (!window.collaps_plugin) startPlugin();

})();
