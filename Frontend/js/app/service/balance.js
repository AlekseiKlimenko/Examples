angular.module('gameApp').service('balance', ['$http', '$q', 'ngDialog', '$timeout', function($http, $q, ngDialog, $timeout) {

	var currentBalance = 0,
		longPolling = function() {
			refresh().then(function(balance){
		  		currentBalance = 50;
		  		
		  		$timeout(longPolling, 5000);
		  	});
		},
		refresh = function() {
			var deferredBalance = $q.defer();
			
			if (authInit === false) {
				deferredBalance.reject(0);
			}

			$http.get('/app/ajax.php?ctrl=balance&action=get').then(function(response){
				if (response.data.error) {
					error = response.data.error;
					deferredBalance.reject(0);
				}
				
				// resolve
				deferredBalance.resolve(response.data.result);
			});

			return deferredBalance.promise;
		};

	// run long-polling
	longPolling();

	return {
		get : function() {
			return currentBalance;
		},
		check : function(needed) {
			return currentBalance >= needed;
		},

		//test
		longPolling : function(balance){
			longPolling(balance)
		},
		////////
		// @todo remove unused
		showErrorLowBalance : function($scope) {
			$scope.noBalance = true;

			ngDialog.open({ 
				template : 'popup-balance',
				scope : $scope
			});
		}
	};
}]);