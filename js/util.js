window.requestAnimFrame=(function(){
	return 	window.requestAnimationFrame ||
			window.webkitRequestAnimationFrame ||
			window.mozRequestAnimationFrame ||
			window.oRequestAnimationFrame ||
			window.msRequestAnimationFrame ||
			function(callback,element){
				window.setTimeout(callback,Math.ceil(1000/60))
			};
}());

var Colors=function(){
		
	var current=0,
		rgb=(function(){
			var rgb=[]
			for(var i=255;i>=0;i-=5)
				rgb.push([255,0,i]);
			for(var i=0;i<=255;i+=5)
				rgb.push([255,i,0]);
			for(var i=255;i>=0;i-=5)
				rgb.push([i,255,0]);
			for(var i=0;i<=255;i+=5)
				rgb.push([0,255,i]);
			for(var i=255;i>=0;i-=5)
				rgb.push([0,i,255]);
			return rgb.reverse();
		}());
	this.colors_number=rgb.length;
	this.length=(function(){return rgb.length}());
	this.getNextColor=function(){
		current=(current+1)%rgb.length+1;
		return rgb[current-1][0]+","+rgb[current-1][1]+","+rgb[current-1][2];
	}
	this.getColor=function(i){
		try {
			return rgb[i][0]+","+rgb[i][1]+","+rgb[i][2];
		} catch(e) {
			console.error(i)
			i=0;
			return rgb[i][0]+","+rgb[i][1]+","+rgb[i][2];
		}
		
	}
}
function iterateSorted(a,reference) {
	
    var keys = [],
		tmp_values=[],
		tmp_functions=[];
		
    for (var key in a){
		keys.push(key);
    }
	var sorted={};
	if(reference) {
		keys.sort(function(a,b){
			//return reference[a] < reference[b];
			return reference[a].localeCompare(reference[b]);
		})
	} else {
		keys.sort();	
	}
    

	for(var i = 0; i < keys.length; i++){
		sorted[keys[i]]=a[keys[i]];
	}
	return sorted;
}
/*
Array.prototype.remove=function(i){
	this.splice(i,1);
}
*/
function support_canvas(){
	return !!document.createElement('canvas').getContext
}
function ie9_bug(){
	if($.browser.msie)
		$("<div/>").attr("class","alert").html("You are probably using <span>Internet Explorer 9</span>, great because it supports <span>HTML5</span>! Unfortunately due to some issues you won't be able to fully enjoy <span>people<strong>movin</strong></span>. I hope to fix this soon. Stay tuned for more updates.").prependTo("#contents").fadeIn(1000);
}
function first(obj){
	for(var i in obj)
		return obj[i];
}

Math.map=function(value, istart, istop, ostart, ostop) {
	return ostart + (ostop - ostart) * ((value - istart) / (istop - istart));
};
function Timer(){
	this.gameTime=0;
	this.maxStep= .05;
	this.wallLastTimestamp=0;
}
Timer.prototype.tick=function(){
	var wallCurrent=Date.now(),
		wallDelta=(wallCurrent-this.wallLastTimestamp)/1000;
	this.wallLastTimestamp=wallCurrent;
	
	var gameDelta=Math.min(wallDelta,this.maxStep);
	this.gameTime+=gameDelta;
	return gameDelta;
	
};