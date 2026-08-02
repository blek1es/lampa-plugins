 function collaps(component, _object) {
      var network = new Lampa.Reguest();
      var extract = {};
      var object = _object;
      var select_title = '';
      var filter_items = {};
      var choice = { season: 0, voice: 0 };

      this.search = function (_object, kinopoisk_id) {
          object = _object;
          select_title = object.movie.title;
          var embed = (component.proxy('collaps') || '') + 'https://api.delivembd.ws/embed/';
          var url = embed + 'kp/' + kinopoisk_id;

          network.silent(url, function (str) {
              if (str) parse(str);
              else component.emptyForQuery(select_title);
              component.loading(false);
          }, function (a, c) {
              component.empty(network.errorDecode(a, c));
          }, false, { dataType: 'text' });
      };

      this.extendChoice = function (saved) {
          Lampa.Arrays.extend(choice, saved, true);
      };

      this.reset = function () {
          component.reset();
          choice = { season: 0, voice: 0 };
          filter();
          append(filtred());
          component.saveChoice(choice);
      };

      this.filter = function (type, a, b) {
          choice[a.stype] = b.index;
          component.reset();
          filter();
          append(filtred());
          component.saveChoice(choice);
      };

      this.destroy = function () {
          network.clear();
          extract = null;
      };

      function parse(str) {
          str = str.replace(/\n/g, '');
          var find = str.match(/makePlayer\(\{(.*?)\}\);/);
          if (find) {
              var json;
              try {
                  json = eval('({' + find[1] + '})');
              } catch (e) {}

              if (json) {
                  extract = json;
                  filter();
                  append(filtred());
              } else component.emptyForQuery(select_title);
          } else component.emptyForQuery(select_title);
      }

      function filter() {
          filter_items = { season: [], voice: [], quality: [] };
          if (extract.playlist && extract.playlist.seasons) {
              extract.playlist.seasons.forEach(function (season) {
                  filter_items.season.push(Lampa.Lang.translate('torrent_serial_season') + ' ' + season.season);
              });
          }
          component.filter(filter_items, choice);
      }

      function filtred() {
          var out = [];
          var fd = Lampa.Storage.get('online_filter', '{}');

          if (extract.playlist && extract.playlist.seasons) {
              extract.playlist.seasons.forEach(function (season, i) {
                  if (i == fd.season) {
                      season.episodes.forEach(function (episode) {
                          // Получаем качество
                          var qualities = {};
                          var max_quality = '';

                          if (episode.hls) {
                              // Если есть объект с качеством
                              if (typeof episode.hls === 'object') {
                                  for (var q in episode.hls) {
                                      qualities[q] = episode.hls[q];
                                      if (!max_quality || parseInt(q) > parseInt(max_quality)) {
                                          max_quality = q;
                                      }
                                  }
                              } else {
                                  // Если это просто строка с URL
                                  qualities['720p'] = episode.hls;
                                  max_quality = '720p';
                              }
                          }

                          out.push({
                              file: qualities[max_quality] || episode.hls,
                              quality: qualities,
                              episode: parseInt(episode.episode),
                              season: season.season,
                              title: episode.title,
                              qualitys: qualities,
                              info: episode.audio && episode.audio.names ? episode.audio.names.slice(0, 5).join(', ') :
  '',
                              subtitles: episode.cc ? episode.cc.map(function (c) {
                                  return { label: c.name, url: c.url };
                              }) : false
                          });
                      });
                  }
              });
          } else if (extract.source) {
              // Для фильмов
              var qualities = {};
              var max_quality = '';

              if (extract.qualityByWidth) {
                  for (var width in extract.qualityByWidth) {
                      var quality = extract.qualityByWidth[width];
                      qualities[quality + 'p'] = extract.source.hls;
                      if (!max_quality || parseInt(quality) > parseInt(max_quality)) {
                          max_quality = quality + 'p';
                      }
                  }
              }

              if (!max_quality) {
                  qualities['720p'] = extract.source.hls;
                  max_quality = '720p';
              }

              out.push({
                  file: extract.source.hls,
                  quality: qualities,
                  qualitys: qualities,
                  title: extract.title || object.movie.title,
                  info: extract.source.audio && extract.source.audio.names ? extract.source.audio.names.slice(0,
  5).join(', ') : '',
                  subtitles: extract.source.cc ? extract.source.cc.map(function (c) {
                      return { label: c.name, url: c.url };
                  }) : false
              });
          }
          return out;
      }

      function append(items) {
          component.reset();
          var viewed = Lampa.Storage.cache('online_view', 5000, []);

          items.forEach(function (element) {
              var hash = Lampa.Utils.hash(element.season ?
                  [element.season, element.episode, object.movie.original_title].join('') :
                  object.movie.original_title);
              var view = Lampa.Timeline.view(hash);
              var item = Lampa.Template.get('online', element);
              var hash_file = Lampa.Utils.hash(element.season ?
                  [element.season, element.episode, object.movie.original_title, element.title].join('') :
                  object.movie.original_title + 'collaps');

              element.timeline = view;
              item.append(Lampa.Timeline.render(view));

              if (Lampa.Timeline.details) {
                  item.find('.online__quality').append(Lampa.Timeline.details(view, ' / '));
              }

              if (viewed.indexOf(hash_file) !== -1) {
                  item.append('<div class="torrent-item__viewed">' +
                      Lampa.Template.get('icon_star', {}, true) + '</div>');
              }

              item.on('hover:enter', function () {
                  if (object.movie.id) Lampa.Favorite.add('history', object.movie, 100);

                  if (!element.file) {
                      Lampa.Noty.show(Lampa.Lang.translate('online_nolink'));
                      return;
                  }

                  var playlist = [];
                  var first = {
                      url: element.file,
                      quality: element.qualitys || element.quality || false,
                      timeline: view,
                      title: element.season ? element.title : object.movie.title,
                      subtitles: element.subtitles
                  };

                  if (element.season) {
                      items.forEach(function (elem) {
                          playlist.push({
                              title: elem.title,
                              url: elem.file,
                              quality: elem.qualitys || elem.quality || false,
                              timeline: elem.timeline,
                              subtitles: elem.subtitles
                          });
                      });
                  } else {
                      playlist.push(first);
                  }

                  if (playlist.length > 1) first.playlist = playlist;

                  Lampa.Player.play(first);
                  Lampa.Player.playlist(playlist);

                  if (viewed.indexOf(hash_file) === -1) {
                      viewed.push(hash_file);
                      item.append('<div class="torrent-item__viewed">' +
                          Lampa.Template.get('icon_star', {}, true) + '</div>');
                      Lampa.Storage.set('online_view', viewed);
                  }
              });

              component.append(item);
              component.contextmenu({
                  item: item,
                  view: view,
                  viewed: viewed,
                  hash_file: hash_file,
                  element: element,
                  file: function (call) {
                      call({
                          file: element.file,
                          quality: element.qualitys || element.quality
                      });
                  }
              });
          });

          component.start(true);
      }
  }
