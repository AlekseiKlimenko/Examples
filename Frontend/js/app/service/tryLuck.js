angular.module('gameApp').service('tryLuck', ['$http', function($http) {
	return {
		getList : function() {
			return $http.get('/app/ajax.php?ctrl=ruffle&action=getList');
		},
		getOffer : function(gameNumber) {
			return $http.get('/app/ajax.php?ctrl=ruffle&action=getOffer&gameNumber=' + gameNumber);
		},
		makeBet : function(gameNumber, slotsToBuy) {
			return $http({
				method : 'POST',
				url : '/app/ajax.php?ctrl=ruffle&action=makeBet',
				data : 'gameNumber='+gameNumber+'&slotsToBuy='+slotsToBuy,
				headers: {'Content-Type': 'application/x-www-form-urlencoded'}
			});
		},
		getHistoryOffer : function(){
			return $http.get('/app/ajax.php?ctrl=ruffle&action=getOld');
		}
	};
}]);