angular.module('gameApp').directive('roulette', ['$timeout', function ($timeout) {
 	return {
 		restrict: 'EA',
 		templateUrl: '/templates/roulette.html',
 		controller: 'rouletteCtrl',
 		scope: {
 			playersAttr: '=players',
 			timeAttr: '=time',
 			winnerAttr: '=winner',
 			soundAttr : '=sound'
 		},
 		link: function (scope, element, attrs) {
 			var inited = false;

			// Animation stopped on 92-th element
			// 92-th elem, is the 5th in the screen + random sugar for fan
			scope.startAnimation = function(force) {
				force = force || false;

				var roulWidth = (92-4.5)*81 + Math.random()*40,	// px
					totalTime = 13;		// sec

				if (inited) {
					return;
				}

				if (force) {
					inited = true;
				}

				var curTransition = roulWidth * (1 - scope.timeAttr / totalTime);

 				element.find('ul').css({
 					'-webkit-transform': 'translate3d(' + (-curTransition.toFixed()) + 'px,0px,0px)',
 					'-moz-transform': 'translate3d(' + (-curTransition.toFixed()) + 'px,0px,0px)',
 					'-o-transform': 'translate3d(' + (-curTransition.toFixed()) + 'px,0px,0px)',
 					'transform': 'translate3d(' + (-curTransition.toFixed()) + 'px,0px,0px)',
 					'-webkit-transition': scope.timeAttr + 's cubic-bezier(0.32, 0.64, 0.45, 1)',
 					'-moz-transition': scope.timeAttr + 's cubic-bezier(0.32, 0.64, 0.45, 1)',
 					'-ms-transition': scope.timeAttr + 's cubic-bezier(0.32, 0.64, 0.45, 1)',
 					'transition': scope.timeAttr + 's cubic-bezier(0.32, 0.64, 0.45, 1)'
 				});

 				$timeout(function () {
	 				element.find('ul').css({
	 					'-webkit-transform': 'translate3d(' + (-roulWidth) + 'px,0px,0px)',
	 					'-moz-transform': 'translate3d(' + (-roulWidth) + 'px,0px,0px)',
	 					'-o-transform': 'translate3d(' + (-roulWidth) + 'px,0px,0px)',
	 					'transform': 'translate3d(' + (-roulWidth) + 'px,0px,0px)'
		 			});
 				}, 0);
			}
 		}
 	};
}]);