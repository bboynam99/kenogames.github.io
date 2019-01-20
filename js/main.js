//
var FOUNDATION_ADDRESS = 'TQLrrPNzp5r9kvHe9N551bGAU4nWoA3yzP';
var game_totalBet = 0;
var profit_WinRate = 0;
var game_MaxBet = 0;
var game_MaxBet_new = 0;
var game_MaxBet_newTRX = 0;
var contract_address = "";
var contract_network = "mainnet";
//
var state = {tronWeb:{}};
this.setState = function(st){
	state.tronWeb = st.tronWeb; //alert(state.tronWeb.installed+" - "+state.tronWeb.loggedIn);
	if(window.tronLinkTimer){
		if(state.tronWeb.loggedIn)tronLinkHandle();
	} else{
		tronLinkHandle();
	}
}
async function componentDidMount() {
	await new Promise(resolve => {
		const tronWebState = {
			installed: !!window.tronWeb,
			loggedIn: window.tronWeb && window.tronWeb.ready
		};

		if(tronWebState.installed) {
			this.setState({
				tronWeb:
				tronWebState
			});
			return resolve();
		}
		//
		let tries = 0;
		const timer = setInterval(() => {
			if(tries >= 10) {
				//const TRONGRID_API = 'https://api.trongrid.io';
				if(contract_network == "mainnet"){
					var fullNode_API = 'https://api.trongrid.io';
					var solidityNode_API = fullNode_API;
					var eventServer_API = fullNode_API;
				} else if(contract_network == "testnet"){
					var fullNode_API = 'https://api.shasta.trongrid.io';
					var solidityNode_API = fullNode_API;
					var eventServer_API = fullNode_API;
				} else{
					var fullNode_API = 'http://127.0.0.1:8090';
					var solidityNode_API = 'http://127.0.0.1:8091';
					var eventServer_API = 'http://127.0.0.1:8092';
				}
				
				const HttpProvider = TronWeb.providers.HttpProvider;
				const fullNode = new HttpProvider(fullNode_API);
				const solidityNode = new HttpProvider(solidityNode_API);
				const eventServer = eventServer_API;
				window.tronWeb = new TronWeb(
					fullNode,
					solidityNode,
					eventServer_API
				);

				this.setState({
					tronWeb: {
						installed: false,
						loggedIn: false
					}
				});
				clearInterval(timer);
				return resolve();
			}
			//
			tronWebState.installed = !!window.tronWeb;
			tronWebState.loggedIn = window.tronWeb && window.tronWeb.ready;

			if(!tronWebState.installed)return tries++;

			this.setState({
				tronWeb: tronWebState
			});

			resolve();
		}, 100);
	});

	if(!state.tronWeb.loggedIn) {
		// Set default address (foundation address) used for contract calls
		// Directly overwrites the address object as TronLink disabled the
		window.tronWeb.defaultAddress = {
			hex: window.tronWeb.address.toHex(FOUNDATION_ADDRESS),
			base58: FOUNDATION_ADDRESS
		};
	}

	window.tronWeb.on('addressChanged', (address) => {console.log('addressChanged:'+address.base58)
		if(state.tronWeb.loggedIn)return;
		this.setState({
			tronWeb: {
				installed: true,
				loggedIn: true
			}
		});
	});
	//window.tronWeb.on('privateKeyChanged', (address) => {console.log('privateKeyChanged:'+address)});
	
	//contract = tronWeb.contract(contracts.abi, contracts.networks["*"].address);
	await $.getJSON("Keno.json", function(contracts) {
		contract_address = contracts.networks["*"].address;console.log("contract_address: "+tronWeb.address.fromHex(contract_address))
		contract = tronWeb.contract(contracts.abi, contract_address);
		var base58 = tronWeb.address.fromHex(contract_address);
		$("#contractaddresslink").html('Contract address: <a target="_blank" href="https://tronscan.org/#/contract/'+base58+'" >'+base58+'</a>');
		initGame();
	}).fail(function() {
		console.log( "get contract error" );
	})
	
	
    //this.fetchMessages();
}

//
function transformData(message) {
	return {
		player: message.player,
		//toNumber function of TronWeb
		bet_places: message.bet_places,
		bet_amount: message.bet_amount.toNumber(),
		result_hits: message.result_hits,//uint8 not use toNumber
		win_amount: message.win_amount.toNumber(),
		id: message.id.toNumber(),
		time: message.time.toNumber()
	}
}

//
async function initGame() {
	await getProfitWinRate();
	await getGameMaxBet();
	await getBalanceContract();
	await getBalanceUser(true);
	//
	contract.UserBet().watch((err, { result }) => {
		if(err)return console.error('Failed to bind event listener:', err);
		//console.log('Detected new message:', result.id);
		//console.log('message:', JSON.stringify(result));
		var id = Number(result.id);
		if(id < game_totalBet)return;
		game_totalBet = id+1;
		if(result.player == tronWeb.defaultAddress.hex){
			addRecentData(result, true);
		} else{
			if(window.timer){
				clearTimeout(window.timer);
				window.timer = null;
			}
			window.timer = setTimeout(function(){getBalanceContract();getBalanceUser();}, 2000);
		}
	});
}



function userBetSend(aList, amount, callBack) {
	if(!amount){
		alert("Please enter the amount to bet!");
		callBack(-1);
		return;
	}
	if(amount < 1){
		alert("Minimum bet is 1 TRX");
		callBack(-1);
		return;
	}
	if(game_MaxBet_newTRX < 1){
		alert("This contract not enough TRX provided.");
		callBack(-1);
		return;
	}
	if(game_MaxBet_newTRX && amount > game_MaxBet_newTRX){
		alert("Maximum bet is "+game_MaxBet_newTRX+" TRX");
		callBack(-1);
		return;
	}
	waitingDialog.show('');
	var sun = tronWeb.toSun(amount); //alert(betNumber+" - "+amount+" - "+sun);//return;
	contract.userBet(aList, sun).send({
		callValue: sun,
		//shouldPollResponse: true
	}).then(function(r) {
		if(window.watchAllBetTimer){
			clearTimeout(window.watchAllBetTimer);
			window.watchAllBetTimer = null;
		}
		window.watchAllBetTimer = setTimeout(function(){watchAllBet();},4000);
		if(window.serverToGameTimer){
			clearTimeout(window.serverToGameTimer);
			window.serverToGameTimer = null;
		}
		window.serverToGameTimer = setTimeout(function(){serverToGameCallback(-1);},10000);
	    //console.log("userBet: "+JSON.stringify(r));
	}).catch(function(e) {
	    //console.log("userBet: "+e);
		serverToGameCallback(-1);
	});
}

function getProfitWinRate() {profit_WinRate = 7;
	/*contract.getMaxPrizeRate().call().then(function(r) {
		profit_WinRate = r;
	    //console.log("getMaxPrizeRate: "+r);
	}).catch(function(e) {
	    //console.log("getMaxPrizeRate: "+e);
	});*/
}

function getGameMinBet() {
	contract.gameMinBet().call().then(function(r) {
	    //console.log("gameMinBet: "+r);
	}).catch(function(e) {
	    //console.log("gameMinBet: "+e);
	});
}

function getGameMaxBet() {
	contract.gameMaxBet().call().then(function(r) {
		game_MaxBet = r;
	    //console.log("gameMaxBet: "+r);
	}).catch(function(e) {
	    //console.log("gameMaxBet: "+e);
	});
}

function getBalanceContract() {
	tronWeb.trx.getBalance(tronWeb.address.fromHex(contract_address)).then(function(r) {
		if(profit_WinRate && r)game_MaxBet_new = Math.floor(r/profit_WinRate);
		if(game_MaxBet && game_MaxBet_new > game_MaxBet)game_MaxBet_new = game_MaxBet;
		if(game_MaxBet_new)game_MaxBet_newTRX = Math.floor(Number(tronWeb.fromSun(game_MaxBet_new)));
		//alert(game_MaxBet_newTRX)
	    //console.log("getBalanceContract: "+r);
	}).catch(function(e) {
	    //console.log("getBalanceContract: "+e);
	});
}

function getBalanceUser(first) {
	tronWeb.trx.getBalance(tronWeb.defaultAddress.base58).then(function(r) {
		START_CREDIT = Number(tronWeb.fromSun(r));
		if(window.s_oGame)s_oGame.updateCredit(START_CREDIT, first);
	    //console.log("getBalanceUser: "+r);
	}).catch(function(e) {
	    //console.log("getBalanceUser: "+e);
	});
}

async function watchAllBet() {//alert('watchAllBet: 1')
	const currentBet = (await contract.currentBet().call()).toNumber();
	if(currentBet <= game_totalBet)return;
	const nextbet = Math.max(currentBet-10, game_totalBet);
	//console.log("currentBet: "+currentBet+", nextbet: "+nextbet);
	game_totalBet = currentBet;
	var has = false;
	for(var i = game_totalBet-1; i >= nextbet; i--){
		await contract.bets(i).call().then(function(r) {
			var bet = transformData(r);
			//console.log("bets: "+JSON.stringify(bet));
			if(bet.player == tronWeb.defaultAddress.hex){
				addRecentData(bet, true);
				i = nextbet;//break
				has = true;
			}
		}).catch(function(e) {
			console.log("bets: "+e);
		});
	}
	if(!has){
		serverToGameCallback(-1);
	}
	
}

//
function serverToGameCallback(resultPlace){
	if(window.s_oGame)s_oGame.serverReturns(resultPlace);
	waitingDialog.hide('');
}

//
function addRecentData(data, watchE){
	if(window.watchAllBetTimer){
		clearTimeout(window.watchAllBetTimer);
		window.watchAllBetTimer = null;
	}
	if(window.timer){
		clearTimeout(window.timer);
		window.timer = null;
	}
	window.timer = setTimeout(function(){getBalanceContract();getBalanceUser();}, 2000);
	//const player = tronWeb.address.fromHex(data.player);
	//const bet_amount = tronWeb.fromSun(data.bet_amount);
	const result_hits = data.result_hits;
	//const win_amount = tronWeb.fromSun(data.win_amount);
	if(watchE){
		if(window.serverToGameTimer){
			clearTimeout(window.serverToGameTimer);
			window.serverToGameTimer = null;
		}
		contract.getResultPlaces(data.id).call().then(function(r) {
			if(window.s_oGame)s_oGame.serverReturns(r, result_hits);
			waitingDialog.hide('');
			//console.log("resultPlaces: "+r);
		}).catch(function(e) {
			serverToGameCallback(-1);
			//console.log("resultPlaces: "+e);
		});
	}
}

//
$( document ).ready(function() {
	tronLinkTimer = setTimeout(function(){tronLinkHandle()},2000);
	//
});

window.onload = function(){
	componentDidMount();
}

function tronLinkHandle(){
	if(state.tronWeb.loggedIn){
		game_ready();
		waitingDialog.hide(''); 
		$("#tronLink-loginModal").modal("hide");
		$("#tronLink-installModal").modal("hide");
	} else{
		waitingDialog.hide(''); 
		if(state.tronWeb.installed){
			$("#tronLink-loginModal").modal("show");
		} else{
			$("#tronLink-installModal").modal("show");
		}
	}
	if(window.tronLinkTimer){
		clearTimeout(tronLinkTimer);
		tronLinkTimer = null;
	}
}

var waitingDialog = waitingDialog || (function ($) {
    'use strict';
	// Creating modal dialog's DOM
	var $dialog = $(
		'<div class="modal fade" data-backdrop="static" data-keyboard="false" tabindex="-1" role="dialog" aria-hidden="true" style="padding-top:15%; overflow-y:visible;">' +
		'<div class="modal-dialog modal-m">' +
		'<div class="modal-content">' +
			'<div class="modal-header"><h3 style="margin:0;"></h3></div>' +
			'<div class="modal-body">' +
				'<div class="progress progress-striped active" style="margin-bottom:0;"><div class="progress-bar" style="width: 100%"></div></div>' +
			'</div>' +
		'</div></div></div>');

	return {
		/**
		 * Opens our dialog
		 * @param message Custom message
		 * @param options Custom options:
		 * 				  options.dialogSize - bootstrap postfix for dialog size, e.g. "sm", "m";
		 * 				  options.progressType - bootstrap postfix for progress bar type, e.g. "success", "warning".
		 */
		show: function (message, options) {
			// Assigning defaults
			if (typeof options === 'undefined') {
				options = {};
			}
			if (typeof message === 'undefined') {
				message = 'Loading';
			}
			var settings = $.extend({
				dialogSize: 'm',
				progressType: '',
				onHide: null // This callback runs after the dialog was hidden
			}, options);

			// Configuring dialog
			$dialog.find('.modal-dialog').attr('class', 'modal-dialog').addClass('modal-' + settings.dialogSize);
			$dialog.find('.progress-bar').attr('class', 'progress-bar');
			if (settings.progressType) {
				$dialog.find('.progress-bar').addClass('progress-bar-' + settings.progressType);
			}
			$dialog.find('h3').text(message);
			// Adding callbacks
			if (typeof settings.onHide === 'function') {
				$dialog.off('hidden.bs.modal').on('hidden.bs.modal', function (e) {
					settings.onHide.call($dialog);
				});
			}
			// Opening dialog
			$dialog.modal();
		},
		/**
		 * Closes dialog
		 */
		hide: function () {
			$dialog.modal('hide');
		}
	};

})(jQuery);