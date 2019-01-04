pragma solidity ^0.4.23;
import "./SafeMath.sol";
import "./Ownable.sol";

//
contract Keno is Ownable {
	using SafeMath for uint;

	struct Bet{
		address player;
		uint8 bet_places;
		uint bet_amount;
		uint8 result_hits;
		uint win_amount;
		uint id;
		uint time;
	}

    uint16[10][] public payoutsTable;
	mapping(uint => Bet) public bets;
	mapping(uint => uint8[]) public resultPlaces;

	uint private randomFactor;
	uint private totalUserBets;
	uint private totalUserWin;

	uint public currentBet;
	uint public gameMaxBet;
	uint public gameMinBet;

	//
    uint private maxPrizeRate;
	uint private totalResult;

	event UserBet(address indexed player, uint8 bet_places, uint bet_amount, uint8 result_hits, uint win_amount, uint id);
	event PaymentDelay(address indexed player, uint8 bet_places, uint bet_amount, uint8 result_hits, uint win_amount, uint id);

	//contract constructor
	constructor() public {
		randomFactor = now.mod(10);
		gameMaxBet = 2000000000;//2000 TRX
		gameMinBet = 1000000;//1 TRX
	    // PAYOUT WITH NUMBERS CHOSEN (2->10 numbers)
	    payoutsTable = new uint16[10][](15);
	    //           hits:    1     2     3     4     5     6     7     8     9     10
	    payoutsTable[2]  = [0    ,40   ,0    ,0    ,0    ,0    ,0    ,0    ,0    ,0     ]; //-> pays = pays/10
	    payoutsTable[3]  = [0    ,15   ,100  ,0    ,0    ,0    ,0    ,0    ,0    ,0     ]; //-> pays
	    payoutsTable[4]  = [0    ,20   ,50   ,150  ,0    ,0    ,0    ,0    ,0    ,0     ]; //-> pays
	    payoutsTable[5]  = [0    ,0    ,30   ,70   ,400  ,0    ,0    ,0    ,0    ,0     ]; //-> pays
	    payoutsTable[6]  = [0    ,0    ,30   ,40   ,300  ,1000 ,0    ,0    ,0    ,0     ]; //-> pays
	    payoutsTable[7]  = [0    ,0    ,15   ,20   ,150  ,800  ,2000 ,0    ,0    ,0     ]; //-> pays
	    payoutsTable[8]  = [0    ,0    ,0    ,20   ,100  ,600  ,1800 ,4000 ,0    ,0     ]; //-> pays
	    payoutsTable[9]  = [0    ,0    ,0    ,15   ,60   ,300  ,1400 ,3000 ,6000 ,0     ]; //-> pays
	    payoutsTable[10] = [0    ,0    ,0    ,0    ,20   ,400  ,1200 ,2000 ,3200 ,10000 ]; //-> pays
		//
		maxPrizeRate = 10;
		totalResult = 20;
	}

	function setPlaceBets(uint numChosen, uint16[] arr) public onlyOwner returns(bool){
	    if (arr.length != 10) revert("Error arr.length != 10.");
	    for(uint8 i = 0; i < arr.length; i++){
	        payoutsTable[numChosen][i] = arr[i];
	    }
	    return true;
	}

	function getMaxPrizeRate() public view returns(uint) {
        return maxPrizeRate;
	}

	function getResultPlaces(uint id) public view returns(uint8[]) {
        return resultPlaces[id];
	}


	function setMaxPrizeRate(uint num) public onlyOwner {
        maxPrizeRate = num;
	}

	function checkArraySameValue(uint8[] arr) private view returns(bool) {
		uint8[] arr_copy;
		for(uint8 i = 0; i < arr.length; i++){
	        for(uint8 j = 0; j < i; j++){
    	        if(arr_copy[j] == arr[i])return true;
    	    }
    	    arr_copy[i] = arr[i];
	    }
        return false;
	}

	function check2ArraySameValue(uint8[] arr, uint8[20] arr2) private view returns(uint8) {
	    uint8 same = 0;
		for(uint8 i = 0; i < totalResult; i++){
	        for(uint8 j = 0; j < arr.length; j++){
    	        if(arr[j] == arr2[i])same++;
    	    }
	    }
        return same;
	}

	function checkValueInArray(uint8[20] arr, uint8 value) private view returns(bool) {
		for(uint8 i = 0; i < arr.length; i++){
    	    if(value == arr[i])return true;
	    }
        return false;
	}

	//test
	/*struct Bet2Test{
		uint8 a; uint16 b; uint8 c1; uint8 c2; uint8 c3; uint8 c4; uint8 c5; uint8 c6;
		uint8 c7; uint8 c8; uint8 c9; uint8 c10; uint8 same; uint time;
	}
	mapping(uint => Bet2Test) public Bet2test;
	uint public currentBet2a;*/
	//uint8[10] public resultArray;
	//end test

	function preparingResults(uint8[] betArray) public returns(uint8[20]) {
	   uint8[20] resultArray;
	   uint8 a; uint16 b;
	   while(a != totalResult){ 
		    b++;
		    uint result = random_uint().mod(80).add(1);
	    	randomFactor = randomFactor.add(result).add(b);
	    	if(checkValueInArray(resultArray, uint8(result)) == false){
        	    resultArray[a] = uint8(result);
        	    a++;
	    	}
	    } 

		//test
	    /*uint8 same = check2ArraySameValue(betArray, resultArray);
		Bet2test[currentBet2a] = Bet2Test({
			a: a, b: b,
			c1: resultArray[0], c2: resultArray[1], c3: resultArray[2], c4: resultArray[3], c5: resultArray[4],
			c6: resultArray[5], c7: resultArray[6], c8: resultArray[7], c9: resultArray[8], c10: resultArray[9],
			same: same,
			time: now
		});*/
		//end test
        return resultArray;
	}

	//
	function userBet(uint8[] betArray, uint amount) public payable returns(uint8){
		if (msg.value < amount) revert("You not enough TRX provided.");
		if (amount < gameMinBet) revert("You place the bet amount smaller than the minimum amount.");
		if (amount > gameMaxBet) revert("You set the bet amount greater than the maximum amount.");
		if (amount.mul(getMaxPrizeRate()) > address(this).balance) revert("This contract not enough TRX provided.");
        totalUserBets = totalUserBets.add(amount);
		//
        uint id = currentBet;
		uint bet_places = betArray.length;
		if(bet_places < 2 || bet_places > 10)revert("Bet Array error");
		if(checkArraySameValue(betArray))revert("There are two similar values");
		uint8[20] memory resultArray = preparingResults(betArray);
		uint8 hits = check2ArraySameValue(betArray, resultArray);
		resultPlaces[id] = resultArray;

		/*string memory resultString = "";
		for(uint8 i = 0; i < resultArray.length; i++){
			if(i < resultArray.length-1){
    	    	resultString = strConcat(resultString, uint2str(uint(resultArray[i])));
    	    	resultString = strConcat(resultString, "-");
			} else{
    	    	resultString = strConcat(resultString, uint2str(uint(resultArray[i])));
			}
	    }*/

		//
		uint win_amount = 0;
		if(hits > 0){
			uint16 pays = payoutsTable[bet_places][hits-1];
			if(pays > 0){
				win_amount = amount.mul(uint256(pays)).div(10);
				totalUserWin = totalUserWin.add(win_amount);
				if(address(this).balance >= win_amount){
					msg.sender.transfer(win_amount);
				} else{
					emit PaymentDelay(msg.sender, uint8(bet_places), amount, hits, win_amount, id);
				}
			}
		}
		bets[currentBet] = Bet({
			player: msg.sender,
			bet_places: uint8(bet_places),
			bet_amount: amount,
			result_hits: hits,
			win_amount: win_amount,
			id: id,
			time: now
		});
		emit UserBet(msg.sender, uint8(bet_places), amount, hits, win_amount, id);
		currentBet++;
		return hits;
	}


	/*function strConcat(string _a, string _b) private returns (string){
        bytes memory _ba = bytes(_a);
        bytes memory _bb = bytes(_b);
        string memory abcde = new string(_ba.length + _bb.length);
        bytes memory babcde = bytes(abcde);
        uint k = 0;
        for (uint i = 0; i < _ba.length; i++) babcde[k++] = _ba[i];
        for (i = 0; i < _bb.length; i++) babcde[k++] = _bb[i];
        return string(babcde);
    }

	function uint2str(uint i) internal pure returns (string){
        if (i == 0) return "0";
        uint j = i;
        uint length;
        while (j != 0){
            length++;
            j /= 10;
        }
        bytes memory bstr = new bytes(length);
        uint k = length - 1;
        while (i != 0){
            bstr[k--] = byte(48 + i % 10);
            i /= 10;
        }
        return string(bstr);
    }*/

	function getRandomFactor() public onlyOwner view returns(uint) {
        	return randomFactor;
	}

	function setRandomFactor(uint num) public onlyOwner {
        	randomFactor = num;
	}

	function getTotalUserBets() public onlyOwner view returns(uint) {
        	return totalUserBets;
	}

	function getTotalUserWin() public onlyOwner view returns(uint) {
        	return totalUserWin;
	}


	function setGameMaxBet(uint num) public onlyOwner {
        	gameMaxBet = num;
	}

	function setGameMinBet(uint num) public onlyOwner {
        	gameMinBet = num;
	}
	//random
	function random_uint() private view returns (uint256) {
		return uint256(blockhash(block.number-1-block.timestamp.mod(100))) + randomFactor;
	}

	//withdraw
	function withdraw(uint amount) public onlyOwner {
		require(amount <= address(this).balance);
		owner().transfer(amount);
	}

    function() public payable{}
}
