angular.module('gameApp').factory('mainFactory', function () {
	var data = {};
	data.history = [];
	data.hideTry = 0;
	data.hideSdbr = 0;
	data.centerFull = '';
	data.zeros = '00';
	data.topPlayers_cs = {};
	data.topPlayers_dota = {};
	data.userOnline = '0';
	data.minBid = 0;
	data.maxThngs = 0;
	data.allMoney = 0;
	data.uniqueUser = 0;
	data.maxPrize = 0;
	data.jackpotThousands = 0;
	data.nmbrGames = 0;
	data.nmbrThings = 0;
	data.todayWinSumm = 0;
	data.lastWinner={
		ava: '',
		name: '',
		money:'',
		chance: ''
	};
	//data.history=[];
	data.userBalance = '34 000';
	data.timer_cs={
		minute:'00',
		second:'00'
	}
	data.timer_dota={
		minute:'00',
		second:'00'
	}
	data.timer_big_dota={
		minute:'00',
		second:'00'
	}

	data.carouselWidth = '0';
	return data;
});