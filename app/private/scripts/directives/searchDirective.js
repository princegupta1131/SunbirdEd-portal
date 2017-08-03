'use strict';

/**
 * @ngdoc directive
 * @name playerApp.directive:contentPlayer
 * @description
 * # contentPlayer
 */
angular.module('playerApp').directive('search', function () {
    var controller = ['$scope', '$rootScope', 'config', '$timeout',
        '$state', '$stateParams', 'searchService', 'toasterService', '$location',
        'sessionService', 'adminService', function ($scope, $rootScope,
      config, $timeout, $state, $stateParams, searchService, toasterService,
      $location, sessionService, adminService) {
            $scope.search = {};
            $rootScope.search = {};
            $rootScope.search.searchKeyword = '';
            $rootScope.search.filters = {};
            $rootScope.search.typingTimer = -1; // timer identifier
            $rootScope.search.doneTypingInterval = 1000;
            $rootScope.search.languages = config.FILTER.RESOURCES.languages;
            $rootScope.search.contentTypes
            = config.FILTER.RESOURCES.contentTypes;
            $rootScope.search.subjects = config.FILTER.RESOURCES.subjects;
            $rootScope.search.boards = config.FILTER.RESOURCES.boards;
            $scope.search.searchTypeKeys = config.searchTypeKeys;
            $rootScope.search.sortingOptions = config.sortingOptions;
            $rootScope.search.sortBy = { createdOn: 'asc' };
            $scope.search.searchSelectionKeys = config.searchSelectionKeys;
            $rootScope.search.sortIcon = true;
            $rootScope.search.selectedLanguage = [];
            $rootScope.search.selectedContentType = [];
            $rootScope.search.selectedSubject = [];
            $rootScope.search.selectedBoard = [];
            $rootScope.search.sortByOption = {};
            $scope.search.autoSuggest = true;
    // search select dropdown changes
            $rootScope.$watch('searchKey', function () {
                $timeout(function () {
                    $rootScope.search.selectedSearchKey = $rootScope.searchKey;
                    $scope.search.isSearchTypeKey = $scope.search.searchTypeKeys
                    .includes($rootScope.search.selectedSearchKey);
                    $('#headerSearch').dropdown('set selected',
                     $scope.search.isSearchTypeKey === true
                     ? $rootScope.search.selectedSearchKey : 'All');
                }, 0);
            });
            $rootScope.$on('initSearch', function (event, args) {
                $scope.search.initSearch();
            });
            $rootScope.$on('setSearchKey', function (event, args) {
                $rootScope.search.selectedSearchKey = args.key;
                $scope.search.searchRequest(false);
            });

            $rootScope.search.selectFilter =
            function (filterType, value, $event) {
                $timeout(function () {
                    var itemIndex = $rootScope.search[filterType]
                    .indexOf(value);
                    if (itemIndex === -1) {
                        $rootScope.search[filterType].push(value);
                        $($event.target).addClass('active');
                    } else {
                        $rootScope.search[filterType].splice(itemIndex, 1);
                        $($event.target).removeClass('active');
                    }
                }, 0);
            };
            $rootScope.search.removeFilterSelection
            = function (filterType, value) {
                var itemIndex = $rootScope.search[filterType].indexOf(value);
                if (itemIndex !== -1) {
                    $rootScope.search[filterType].splice(itemIndex, 1);
                }
            };

    /**
     * This function called when api failed,
     * and its show failed response for 2 sec.
     * @param {String} message
     */
            function showErrorMessage(isClose, message, messageType) {
                var error = {};
                error.showError = true;
                error.isClose = isClose;
                error.message = message;
                error.messageType = messageType;
                return error;
            }

            $scope.search.initSearch = function () {
                var searchParams = $stateParams;
                $rootScope.search.selectedSearchKey = $rootScope.searchKey || searchParams.type;
                $rootScope.search.searchKeyword = $rootScope.search.searchKeyword
                        || searchParams.query;
                $scope.curSearchText = $rootScope.search.searchKeyword;
                $rootScope.search.filters = JSON.parse(atob(searchParams.filters || btoa('{}')));
                $rootScope.search.sortBy = JSON.parse(atob(searchParams.sort || btoa('{}')));
                $rootScope.search.selectedLanguage = $rootScope.search.filters.language || [];
                $rootScope.search.selectedContentType = $rootScope.search.filters.contentType || [];
                $rootScope.search.selectedBoard = $rootScope.search.filters.board || [];
                $rootScope.search.selectedSubject = $rootScope.search.filters.subject || [];
                $rootScope.search.sortByOption = Object.keys($rootScope.search.sortBy).length > 0
                ? Object.keys($rootScope.search.sortBy)[0] : '';
                $rootScope.search.searchFromSuggestion = $stateParams.autoSuggestSearch;
      // $rootScope.search.sortBy=$rootScope.search.sortBy;
                $scope.search.searchRequest();
            };

            $rootScope.search.openCourseView = function (course, courseType) {
                var showLectureView = 'no';
                if ($rootScope.enrolledCourseIds[course.courseId || course.identifier]) {
                    showLectureView = 'no';
                } else {
                    showLectureView = 'yes';
                }
                var params = { courseType: courseType,
                    courseId: course.courseId || course.identifier,
                    lectureView: showLectureView,
                    progress: course.progress,
                    total: course.total,
                    courseName: course.courseName || course.name,
                    lastReadContentId: course.lastReadContentId };
                sessionService.setSessionData('COURSE_PARAMS', params);
                $state.go('Toc', params);
            };

            $rootScope.search.playContent = function (item) {
                if (item.mimeType === 'application/vnd.ekstep.content-collection') {
                    $state.go('PreviewCollection', { Id: item.identifier, name: item.name });
                } else {
                    $state.go('Player', { content: item,
                        contentName: item.name,
                        contentId: item.identifier });
                }
            };

            $rootScope.search.setSearchText = function (searchText) {
                $rootScope.search.searchKeyword = searchText;
                $rootScope.search.searchFromSuggestion = true;
                $scope.search.searchRequest(false);
            };
            $scope.search.autoSuggestSearch = function () {
                if ($scope.search.autoSuggest && $rootScope.isSearchPage
                        && $rootScope.search.searchKeyword.length > 2) {
                    $scope.search.handleSearch();
                }
            };
            $scope.search.keyUp = function () {
                clearTimeout($rootScope.search.typingTimer);
                $rootScope.search.typingTimer = setTimeout($scope.search.autoSuggestSearch,
                $rootScope.search.doneTypingInterval);
      // $scope.search.autoSuggest=true;
            };

            $scope.search.keyDown = function () {
                clearTimeout($rootScope.search.typingTimer);
            };

            $scope.search.searchRequest = function ($event) {
                clearTimeout($rootScope.search.typingTimer);
                if (!$event || $event.charCode === 13) {
                    $scope.search.autoSuggest = false;
                    if ($rootScope.search.searchKeyword !== '' && $rootScope.isSearchPage) {
                        if ($rootScope.isSearchResultsPage && $rootScope.search.searchKeyword
                            === $stateParams.query && $rootScope.search.selectedSearchKey
                            === $stateParams.type) {
                            $rootScope.search.error = {};
                            $rootScope.search.loader = toasterService.loader(''
                                                    , $rootScope.errorMessages.SEARCH.DATA.START);
                            $scope.search.handleSearch();
                        } else {
                            $scope.search.autoSuggest = false;
                            var searchParams = {
                                type: $rootScope.search.selectedSearchKey,
                                query: $rootScope.search.searchKeyword,
                                filters: btoa(JSON.stringify($rootScope.search.filters)),
                                sort: btoa(JSON.stringify($rootScope.search.sortBy)),
                                autoSuggestSearch: $rootScope.search.searchFromSuggestion || false
                            };
            // $state.go('Search', searchParams);
                            $location.path('search/' + searchParams.type + '/'
                                    + searchParams.query + '/' + searchParams.filters + '/'
                                    + searchParams.sort + '/' + searchParams.autoSuggestSearch);
                        }
                    } else {
                        $rootScope.$emit('initPageSearch', {});
                    }
                }
            };
            $scope.search.handleSearch = function () {
                var req = {
                    query: $rootScope.search.searchKeyword,
                    filters: $rootScope.search.filters,
                    params: {
                        cid: '12'
                    },
                    limit: 20,
                    sort_by: $rootScope.search.sortBy

                };
                // if autosuggest option is clicked
                if ($rootScope.search.searchFromSuggestion === 'true') {
                    req.filters.name = req.query;
                    req.query = '';
                    $rootScope.search.searchFromSuggestion = 'false';
                } else {
                    delete req.filters.name;
                }
                if ($rootScope.search.selectedSearchKey === 'Courses') {
                    $scope.search.searchFn = searchService.courseSearch(req);
                    $scope.search.resultType = 'course';
                } else if ($rootScope.search.selectedSearchKey === 'Resources') {
                    $scope.search.searchFn = searchService.contentSearch(req);
                    $scope.search.resultType = 'content';
                } else if ($rootScope.search.selectedSearchKey === 'All') {
                    $scope.search.searchFn = searchService.search(req);
                    $scope.search.resultType = 'content';
                } else if ($rootScope.search.selectedSearchKey === 'Users'
                          || $rootScope.search.selectedSearchKey === 'Organisations') {
                    req.filters.objectType = $rootScope.search.selectedSearchKey === 'Users'
                                            ? ['user']
                                            : ['org'];
                    $scope.search.searchFn = adminService.search({ request: req });
                    $scope.search.resultType = $rootScope.search.selectedSearchKey === 'Users'
                                              ? 'users'
                                              : 'organisations';
                }

                $scope.search.searchFn.then(function (res) {
                    $scope.curSearchText = $rootScope.search.searchKeyword;
                    if (res !== null && res.responseCode === 'OK') {
                        $rootScope.search.autosuggest_data = [];
                        if ($scope.search.autoSuggest
                                && $rootScope.search.searchKeyword !== $stateParams.query) {
                            $rootScope.search.autosuggest_data = res.result[$scope.search.resultType];
                            if ($rootScope.search.autosuggest_data.length > 0) {
                                $('#search-suggestions').addClass('visible').removeClass('hidden');
                            }
                        } else {
                            $('#search-suggestions').addClass('hidden').removeClass('visible');
                            $rootScope.search.autosuggest_data = [];
                            $rootScope.search.loader.showLoader = false;

                            if (res.result.count === 0) {
                                $rootScope.search.error = showErrorMessage(true,
                                $rootScope.errorMessages.SEARCH.DATA.NO_CONTENT,
                                $rootScope.errorMessages.COMMON.INFO);
                            } else {
                                $rootScope.search.error = {};
                                $rootScope.search.searchResult = res.result;
                            }
                        }
                        $scope.search.autoSuggest = true;
                    } else {
                        $rootScope.search.loader.showLoader = false;
                        $rootScope.search.error = showErrorMessage(true,
                        $rootScope.errorMessages.SEARCH.DATA.FAILED,
                        $rootScope.errorMessages.COMMON.ERROR);
                        $scope.search.autoSuggest = true;
                        throw new Error('');
                    }
                }).catch(function (e) {
                    $rootScope.search.loader.showLoader = false;
                    $rootScope.search.error = showErrorMessage(true,
                    $rootScope.errorMessages.SEARCH.DATA.FAILED,
                    $rootScope.errorMessages.COMMON.ERROR);
                });
            };

            $rootScope.search.applyFilter = function () {
                $rootScope.search.filters.language = $rootScope.search.selectedLanguage;
                $rootScope.search.filters.contentType = $rootScope.search.selectedContentType;
                $rootScope.search.filters.subject = $rootScope.search.selectedSubject;
                $rootScope.search.filters.board = $rootScope.search.selectedBoard;
                $rootScope.isSearchResultsPage = false;
                $scope.search.searchRequest();
            };
            $rootScope.search.resetFilter = function () {
                $rootScope.isSearchPage = false;
                $rootScope.search.selectedLanguage = [];
                $rootScope.search.selectedContentType = [];
                $rootScope.search.selectedSubject = [];
                $rootScope.search.selectedBoard = [];
                $rootScope.search.filters = {};
                $rootScope.isSearchResultsPage = false;
                $rootScope.isSearchPage = true;
                $scope.search.searchRequest();
      // $state.go($rootScope.search.selectedSearchKey);
            };
            $rootScope.search.applySorting = function () {
                var sortByField = $rootScope.search.sortByOption;
                $rootScope.search.sortBy = {};
                $rootScope.search.sortBy[sortByField] = ($rootScope.search.sortIcon === true)
                ? 'asc' : 'desc';
                $scope.search.searchRequest();
            };
            $rootScope.search.close = function () {
                $rootScope.search.selectedSearchKey =
                                                    $rootScope.search.selectedSearchKey === 'Users'
                                                    ? 'Profile'
                                                    : $rootScope.search.selectedSearchKey;
                var closeUrl = ($rootScope.search.selectedSearchKey === 'All')
                ? 'Home' : $rootScope.search.selectedSearchKey;
                $state.go(closeUrl);
            };
            $rootScope.search.setSearchKey = function (key) {
                $rootScope.$emit('setSearchKey', { key: key });
            };
        }];
    return {
        templateUrl: 'views/header/search.html',
        restrict: 'E',
        scope: {
            type: '='
        },
        link: function (scope, element, attrs) {

        },
        controller: controller
    };
});
