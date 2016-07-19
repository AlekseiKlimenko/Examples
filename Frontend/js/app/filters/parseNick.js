angular.module('gameApp')
.filter('parseNick', function() {
	return function (value) {
		if (angular.isUndefined(value)) {
			return value;
		}

		['csgofast.ru', 'csgfofast.com', 'csgoup.up', 'csgo.gl', 'csgo.as', 'luckerskins.ru', 'flashskins', 'csgocasinoo', 'csgo-fire.ru', 'cslots.ru', 'csgoduck.com', 'csgojoker.ru', 'oki91.ru', 'CSGOnest.RU', 'JOYSKINS.TOP', 'm9snik.com', 'm9snik-csgo.com', 'csgoin.com', 'itemgrad.com', 'кс го ап', 'NINJACKPOT.COM', 'joyskins . top', 'JOYSKINS', 'ЖОЙСКИНС ТОП', 'CSGODICEGAME.COM', 'CSGOSELECTOR.RU', 'csgolou.com', 'http://skins-bat', 'CSBRO.RU', 'CSGAMBLING.RU', 'skinlord.ru', 'CSGO-MANIAC.com', 'csgo-rich.ru', 'CSGOHIDE.RU', 'CSGO-FATE.RU', 'csgodiamonds.com', 'CSGO4FUN.RU', 'CSGOPOT.COM', 'SKINOMAT.COM', 'CSGOComeback.com', 'CSGOSpeed.com', 'CSGOJoe.com', 'csgohouse.com', 'kickback.com', 'winaskin.com', 'opcrates.com', 'CSGOOFFLINE.COM', 'https://easydrop.ru/', 'easydrop.ru', 'CSgetto.com', 'csgoskins.net', 'VKCSGO.RU', 'CSGOTrophy.ru', 'CSGOLOU.COM', 'CSGOEASYSKIN.RU', 'csgoeasylot.com', 'itemup.ru', 'foxcs.ru', 'EVIL-BETS.RU', 'ITEAMGRAD.COM', 'csgofade.net', 'CSGO-FATE', 'http://su0.ru/4xqe', 'ONELEDAY.COM', 'CSGO-GOOSE.COM', 'csgo-gambler.com', 'CSGOW.RU', 'csgohot.com', 'csgoeasylot.com', 'CSFOX.RU', 'shurzgbets.com', 'CSGOTONY.COM','CSGO-HF.RU'].forEach(function(sw){
			
			var re = new RegExp(sw, 'gi');
			if (re.test(value)) {
				value = value.replace(re, ' csgo.in');
			}
		})
		
		return value;
	};
});
