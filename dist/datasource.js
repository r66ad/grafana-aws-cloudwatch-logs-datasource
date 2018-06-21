'use strict';

System.register(['lodash', 'app/core/table_model'], function (_export, _context) {
  "use strict";

  var _, TableModel, _createClass, AwsCloudWatchLogsDatasource;

  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }

  return {
    setters: [function (_lodash) {
      _ = _lodash.default;
    }, function (_appCoreTable_model) {
      TableModel = _appCoreTable_model.default;
    }],
    execute: function () {
      _createClass = function () {
        function defineProperties(target, props) {
          for (var i = 0; i < props.length; i++) {
            var descriptor = props[i];
            descriptor.enumerable = descriptor.enumerable || false;
            descriptor.configurable = true;
            if ("value" in descriptor) descriptor.writable = true;
            Object.defineProperty(target, descriptor.key, descriptor);
          }
        }

        return function (Constructor, protoProps, staticProps) {
          if (protoProps) defineProperties(Constructor.prototype, protoProps);
          if (staticProps) defineProperties(Constructor, staticProps);
          return Constructor;
        };
      }();

      _export('AwsCloudWatchLogsDatasource', AwsCloudWatchLogsDatasource = function () {
        function AwsCloudWatchLogsDatasource(instanceSettings, $q, backendSrv, templateSrv, timeSrv) {
          _classCallCheck(this, AwsCloudWatchLogsDatasource);

          this.type = instanceSettings.type;
          this.url = instanceSettings.url;
          this.name = instanceSettings.name;
          this.id = instanceSettings.id;
          this.defaultRegion = instanceSettings.jsonData.defaultRegion;
          this.q = $q;
          this.backendSrv = backendSrv;
          this.templateSrv = templateSrv;
          this.timeSrv = timeSrv;
        }

        _createClass(AwsCloudWatchLogsDatasource, [{
          key: 'query',
          value: function query(options) {
            var query = this.buildQueryParameters(options);
            query.targets = query.targets.filter(function (t) {
              return !t.hide;
            });

            if (query.targets.length <= 0) {
              return this.q.when({ data: [] });
            }

            return this.doRequest({
              data: query
            });
          }
        }, {
          key: 'testDatasource',
          value: function testDatasource() {
            var _this = this;

            return this.doMetricQueryRequest('log_group_names', {
              region: this.defaultRegion,
              logGroupNamePrefix: 'test'
            }).then(function (res) {
              return _this.q.when({ status: "success", message: "Data source is working", title: "Success" });
            }).catch(function (err) {
              return { status: "error", message: err.message, title: "Error" };
            });
          }
        }, {
          key: 'doRequest',
          value: function doRequest(options) {
            return this.backendSrv.datasourceRequest({
              url: '/api/tsdb/query',
              method: 'POST',
              data: {
                from: options.data.range.from.valueOf().toString(),
                to: options.data.range.to.valueOf().toString(),
                queries: options.data.targets
              }
            }).then(function (result) {
              var res = [];
              _.forEach(result.data.results, function (r) {
                if (!_.isEmpty(r.series)) {
                  _.forEach(r.series, function (s) {
                    res.push({ target: s.name, datapoints: s.points });
                  });
                }
                if (!_.isEmpty(r.tables)) {
                  _.forEach(r.tables, function (t) {
                    var table = new TableModel();
                    table.columns = t.columns;
                    table.rows = t.rows;
                    res.push(table);
                  });
                }
              });

              result.data = res;
              return result;
            });
          }
        }, {
          key: 'buildQueryParameters',
          value: function buildQueryParameters(options) {
            var _this2 = this;

            var targets = _.map(options.targets, function (target) {
              var input = {
                logGroupName: _this2.templateSrv.replace(target.logGroupName, options.scopedVars),
                logStreamNames: target.logStreamNames.filter(function (n) {
                  return n !== "";
                }).map(function (n) {
                  return _this2.templateSrv.replace(n, options.scopedVars);
                }),
                filterPattern: _this2.templateSrv.replace(target.filterPattern, options.scopedVars),
                interleaved: false
              };
              if (input.logStreamNames.length === 0) {
                delete input.logStreamNames;
              }
              return {
                refId: target.refId,
                hide: target.hide,
                datasourceId: _this2.id,
                queryType: 'timeSeriesQuery',
                format: target.type || 'timeserie',
                region: _this2.templateSrv.replace(target.region, options.scopedVars) || _this2.defaultRegion,
                input: input
              };
            });

            options.targets = targets;
            return options;
          }
        }, {
          key: 'metricFindQuery',
          value: function metricFindQuery(query) {
            var region = void 0;

            var logGroupNamesQuery = query.match(/^log_group_names\(([^,]+?),\s?(.+)\)/);
            if (logGroupNamesQuery) {
              region = logGroupNamesQuery[1];
              var prefix = logGroupNamesQuery[2];
              return this.doMetricQueryRequest('log_group_names', {
                region: this.templateSrv.replace(region),
                logGroupNamePrefix: this.templateSrv.replace(prefix)
              });
            }

            var logStreamNamesQuery = query.match(/^log_stream_names\(([^,]+?),\s?(.+)\)/);
            if (logStreamNamesQuery) {
              region = logStreamNamesQuery[1];
              var logGroupName = logStreamNamesQuery[2];
              return this.doMetricQueryRequest('log_stream_names', {
                region: this.templateSrv.replace(region),
                logGroupName: this.templateSrv.replace(logGroupName),
                logStreamNamePrefix: ""
              });
            }

            return this.$q.when([]);
          }
        }, {
          key: 'doMetricQueryRequest',
          value: function doMetricQueryRequest(subtype, parameters) {
            var _this3 = this;

            var range = this.timeSrv.timeRange();
            return this.backendSrv.datasourceRequest({
              url: '/api/tsdb/query',
              method: 'POST',
              data: {
                from: range.from.valueOf().toString(),
                to: range.to.valueOf().toString(),
                queries: [_.extend({
                  refId: 'metricFindQuery',
                  datasourceId: this.id,
                  queryType: 'metricFindQuery',
                  subtype: subtype
                }, parameters)]
              }
            }).then(function (r) {
              return _this3.transformSuggestDataFromTable(r.data);
            });
          }
        }, {
          key: 'transformSuggestDataFromTable',
          value: function transformSuggestDataFromTable(suggestData) {
            return _.map(suggestData.results['metricFindQuery'].tables[0].rows, function (v) {
              return {
                text: v[0],
                value: v[1]
              };
            });
          }
        }, {
          key: 'annotationQuery',
          value: function annotationQuery(options) {
            var _this4 = this;

            var annotation = options.annotation;
            var region = annotation.region || this.defaultRegion;
            var logGroupName = annotation.logGroupName || '';
            var filterPattern = annotation.filterPattern || '';
            var tagKeys = annotation.tagKeys || '';
            tagKeys = tagKeys.split(',');
            var titleFormat = annotation.titleFormat || '';
            var textFormat = annotation.textFormat || '';

            if (_.isEmpty(region) || _.isEmpty(logGroupName)) {
              return Promise.resolve([]);
            }

            var range = this.timeSrv.timeRange();
            return this.backendSrv.datasourceRequest({
              url: '/api/tsdb/query',
              method: 'POST',
              data: {
                from: range.from.valueOf().toString(),
                to: range.to.valueOf().toString(),
                queries: [{
                  refId: 'annotationQuery',
                  datasourceId: this.id,
                  queryType: 'annotationQuery',
                  region: this.templateSrv.replace(region),
                  input: {
                    logGroupName: this.templateSrv.replace(logGroupName),
                    filterPattern: this.templateSrv.replace(filterPattern),
                    interleaved: false
                  }
                }]
              }
            }).then(function (r) {
              if (!r.data.results[""].meta.Events) {
                return [];
              }
              var eventList = r.data.results[""].meta.Events.map(function (event) {
                var messageJson = JSON.parse(event.Message);
                var tags = _.chain(messageJson).filter(function (v, k) {
                  return _.includes(tagKeys, k);
                }).value();

                return {
                  annotation: annotation,
                  time: event.Timestamp,
                  title: _this4.renderTemplate(titleFormat, messageJson),
                  tags: tags,
                  text: _this4.renderTemplate(textFormat, messageJson)
                };
              });

              return eventList;
            });
          }
        }, {
          key: 'renderTemplate',
          value: function renderTemplate(aliasPattern, aliasData) {
            var aliasRegex = /\{\{\s*(.+?)\s*\}\}/g;
            return aliasPattern.replace(aliasRegex, function (match, g1) {
              if (aliasData[g1]) {
                return aliasData[g1];
              }
              return g1;
            });
          }
        }]);

        return AwsCloudWatchLogsDatasource;
      }());

      _export('AwsCloudWatchLogsDatasource', AwsCloudWatchLogsDatasource);
    }
  };
});
//# sourceMappingURL=datasource.js.map
