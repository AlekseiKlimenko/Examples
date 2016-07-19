
angular.module('gameApp').controller('tryLuckCtrl', ['$scope', 'socketFactory', 'mainFactory', 'tryLuck', 'ngDialog', '$routeParams', '$location', '$timeout', 'balance', '$filter', function($scope, socketFactory, mainFactory, tryLuck, ngDialog, $routeParams, $location, $timeout, balance, $filter) {

	// stuff	
	$scope.socket = socketFactory;
	$scope.datas =  mainFactory;

	if ($scope.datas.hideSdbr === 0) {
		$scope.datas.hideSdbr = 1;
	};

	if ($scope.datas.centerFull === '') {
		$scope.datas.centerFull = 'full-width';
	};

	// GET CONTENT
	// @todo : long-polling
	var longPolling = function() {
		tryLuck.getList().then(function(responseList){
			$scope.offersList = responseList.data.result;

			$scope.offersList.forEach(function(item, i){
				item.players = $filter('toArray')(item.players);
				item.playersCnt = angular.isUndefined(item.players) ? 0 : item.players.length;
			});

			// check where we are
			if (angular.isUndefined($routeParams.gameNumber) && responseList.data.result.length>0) {
				$location.path('try/' + responseList.data.result[responseList.data.result.length-1].number_game);
			}

			// get info about current game
			tryLuck.getOffer($routeParams.gameNumber).then(function(responseOffer){
				$scope.offer = responseOffer.data.result;
				$scope.offer.players = $filter('toArray')($scope.offer.players);
				$scope.offer.playersCnt = angular.isUndefined($scope.offer.players) ? 0 : $scope.offer.players.length;
			});
		});
	};
	longPolling();

	// SINGLE OFFER
	$scope.makeBet = function(offer, auth) {
		if(offer.status_game != 'finished' && auth !== false) {
			ngDialog.open({
			    template: '/templates/try-luck-make-bet.html',
			    scope: $scope
			});
		}
	}

	$scope.makeBetChange = function() {
		$scope.totalPrice = $scope.slotsToBuy * $scope.offer.price_one_slot;
	}

	$scope.makeBetSubmit = function() {
		// for any case
		$scope.makeBetChange();
		
		// check balance
		if (balance.check($scope.totalPrice) === false) {
			balance.showErrorLowBalance($scope);
			return;

		} else {
			// if ok – make the request
			tryLuck.makeBet($scope.offer.number_game, $scope.slotsToBuy).then(function(response){
				if (!angular.isUndefined(response.data.error)) {
					alert(response.data.error.msg);
					return;
				}

				if (!angular.isUndefined(response.data.result)) {
					$scope.offer = response.data.result;
					$scope.offer.players = $filter('toArray')($scope.offer.players);
					$scope.offer.playersCnt = angular.isUndefined($scope.offer.players) ? 0 : $scope.offer.players.length;
					
					ngDialog.close();
				}
			});
		}
	}

	$scope.buildFreeSlotsArray = function() {
		var arr = [];
		for (var i = 0; i < $scope.offer.num_slots - $scope.offer.playersCnt; i++) {
			arr.push(i);
		}

		return arr;
	};
}]);