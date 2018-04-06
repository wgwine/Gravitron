
angular.module('App.services', []);
angular.module('App.filters', []);
angular.module('App.directives', []);
angular.module('App.config', []);
angular.module('App.dataVis', []);
angular.module('App.controllers', ['ngRoute', 'App.services']);

var cltdmapp = angular.module('App', ['App.controllers', 'App.services', 'App.directives', 'App.config', 'ngRoute', 'App.dataVis']);

angular.module('App')
.config(['$routeProvider', function ($routeProvider) {
    $routeProvider
    .when('/', {
        templateUrl: '/app/modules/dataVis/layout.html',
        caseInsensitiveMatch: true
    })
}])
