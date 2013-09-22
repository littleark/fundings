/*!
 * DataMovinInteractions JavaScript Library v0.2
 * http://datamov.in
 *
 * (c) Copyright 2011, Carlo Zapponi
 * Temporary licensed under the MIT license.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 * Date: Sun Aug 01 00:05:56 2011 (CEST) +0200
 */
function DataMovinInteractions(){
	
	var canvas,
		orientation,
		areas,
		datamovin,
		mouse={
			x:0,
			y:0,
			scrollTop:0,
			scrollLeft:0
		},
		tm;
	
	var eventsCallbacks={
		'click':null,
		'mouseover':null,
		'mousedown':null,
		'mouseup':null,
		'mouseout':null,
		'processing':function(when,where){}
	}
	
	var scroll={
		top:0,
		left:0
	}
	
	this.init=function($datamovin) {
		
		datamovin=$datamovin;
		canvas=datamovin.getCanvas();
		orientation=datamovin.getOrientation();
		areas=datamovin.getAreas();
		
		initEventListeners();
	}
	function initEventListeners(){
		// Init event listeners
		if (canvas.addEventListener){
			
			document.addEventListener('mousemove', documentMouseMove, false);
			document.addEventListener('mousewheel', documentScrollWheelHandler, false);
			// Firefox
			document.addEventListener('DOMMouseScroll', documentScrollWheelHandler, false);

			if(orientation=='vertical') {
				canvas.addEventListener('click', canvasMouseClickHandlerVertical, false);
				canvas.addEventListener('mousemove', canvasMouseMoveHandlerVertical, false);
			} else {
				canvas.addEventListener('click', canvasMouseClickHandlerHorizontal, false);
				canvas.addEventListener('mousemove', canvasMouseMoveHandlerHorizontal, false);
			}
			canvas.addEventListener('mousedown', canvasMouseDownHandler, false);
			canvas.addEventListener('mouseup', canvasMouseUpHandler, false);
			canvas.addEventListener('mouseout', canvasMouseOutHandler, false);
			
		} else if (el.attachEvent){
			
			document.attachEvent('onmousemove', documentMouseMove, false);
			document.attachEvent('onmousewheel', documentScrollWheelHandler, false);
			if(orientation=='vertical') {
				canvas.attachEvent('onclick', canvasMouseClickHandlerVertical);
				canvas.attachEvent('onmousemove', canvasMouseMoveHandlerVertical, false);
			} else {
				canvas.attachEvent('onclick', canvasMouseClickHandlerHorizontal);
				canvas.attachEvent('onmousemove', canvasMouseMoveHandlerHorizontal, false);
			}
			canvas.attachEvent('onmousedown', canvasMouseDownHandler);
			canvas.attachEvent('onmouseup', canvasMouseUpHandler);
			canvas.attachEvent('onmouseout', canvasMouseOutHandler, false);
		};
	}
	this.registerMouseEvents=function(callbacks){
		for(var i in callbacks){
			eventsCallbacks[i]=callbacks[i];
		}
	}
	
	function canvasMouseOutHandler(e){
		e=initEvent(e);
		
		if(eventsCallbacks.mouseout)
			eventsCallbacks.mouseout.call(e,e);
			
		return false;
	}
	function documentMouseMove(e) {
		e=initEvent(e);
		
		if(eventsCallbacks.document_mousemove)
			eventsCallbacks.document_mousemove.call(e,e);
		
		return false;	
	}
	function documentScrollWheelHandler(e){
		if (!e) var e = window.event;
		if(eventsCallbacks.document_scrollwheel)
			eventsCallbacks.document_scrollwheel.call(e,e);
		/*
		var tmp_scroll=getScroll(e);
		
		clearTimeout(tm);
		tm=setTimeout(function(){
			
			
			if(orientation=='vertical') {
				var mouse_event={
					offsetX:mouse.x,
					offsetY:mouse.y+(tmp_scroll.top-scroll.top)
				};
				console.log("!!!!! "+tmp_scroll.top+"-"+scroll.top+" > "+(tmp_scroll.top-scroll.top),mouse.y,mouse_event.offsetY);
				canvasMouseMoveHandlerVertical(mouse_event);
			}
			scroll=tmp_scroll;
		},100);
		*/
				
	}
	function canvasMouseMoveHandlerVertical(e){
		e=initEvent(e);
		
		var point,
			info,
			left,
			position;
		mouse=getPosition(e,canvas);
		
		if(mouse.x>=areas.src.x1 && mouse.x<=areas.src.x2) {
			canvas.style.cursor="pointer";
			
			point=datamovin.lookUp(mouse.y,"src");

			info=datamovin.getPointInfo(point,'src');

			if(eventsCallbacks.mouseover) {
				eventsCallbacks.mouseover.call(e,info);
			}
		} else if(mouse.x>=areas.dst.x1 && mouse.x<=areas.dst.x2) {
			canvas.style.cursor="pointer";
			
			point=datamovin.lookUp(mouse.y,"dst");

			info=datamovin.getPointInfo(point,'dst');
			
			if(eventsCallbacks.mouseover) {
				eventsCallbacks.mouseover.call(e,info);
			}
			
		} else {
			canvas.style.cursor="default";

			if(eventsCallbacks.mouseover) {
				eventsCallbacks.mouseover.call(e,null);
			}
		}
		
		if(e.ownerDocument)
			scroll=getScroll(e);
		
		return false;
	}

	function canvasMouseDownHandler(e){
		e=initEvent(e);
		
		if(eventsCallbacks.mousedown)
			eventsCallbacks.mousedown.call(e);
		return false;
	}

	function canvasMouseUpHandler(e) {
		e=initEvent(e);
		
		if(eventsCallbacks.mouseup)
			eventsCallbacks.mouseup.call(e);
		return false;
	}
	function canvasMouseClickHandlerVertical(e) {
		e=initEvent(e);
		
		var point;
		mouse=getPosition(e,canvas);
		
		if(mouse.x>=areas.src.x1 && mouse.x<=areas.src.x2) {
			point=datamovin.lookUp(mouse.y,"src");
			if(!datamovin.checkCurrent(point,"src")) {
				eventsCallbacks.processing.call(e,'start','src');
				setTimeout(function tm(){
					datamovin.drawOutFlow(point,true);
					if(eventsCallbacks.click)
						eventsCallbacks.click.call(e,datamovin.getPointInfo(point,'src'));
					setTimeout(function ttm(){eventsCallbacks.processing.call(e,'end','src');},250);
				},100);
			} else {
				datamovin.clean();
				if(eventsCallbacks.click)
					eventsCallbacks.click.call(e,null);
			}
		} else if(mouse.x>=areas.dst.x1 && mouse.x<=areas.dst.x2) {
			point=datamovin.lookUp(mouse.y,"dst");
			if(!datamovin.checkCurrent(point,"dst")) {
				eventsCallbacks.processing.call(e,'start','dst');
				setTimeout(function tm(){
					datamovin.drawInFlow(point,true);
					if(eventsCallbacks.click)
						eventsCallbacks.click.call(e,datamovin.getPointInfo(point,'dst'));
					setTimeout(function ttm(){eventsCallbacks.processing.call(e,'end','dst');},250);
				},100);
			} else {
				datamovin.clean();
				if(eventsCallbacks.click)
					eventsCallbacks.click.call(e,null);
			}
		} else {
			if(eventsCallbacks.click)
				eventsCallbacks.click.call(e,-1);
		}
		
		return false;
		
	}

	function canvasMouseClickHandlerHorizontal(e) {
		e=initEvent(e);
		
		
		var point;
		mouse=getPosition(e,canvas);

		if(mouse.y>=areas.src.y1 && mouse.y<=areas.src.y2) {
			point=datamovin.lookUp(mouse.x,"src");
			if(!datamovin.checkCurrent(point,"src")) {
				setTimeout(function tm(){
					datamovin.drawOutFlow(point,true)
					click_callback(datamovin.getPointInfo(point,'src'));
					//setTimeout(function ttm(){$("body").css("cursor","default");processing=false;},0);
				},5);
			} else {
				datamovin.clean();
			}
		} else if(mouse.y>=areas.dst.y1 && mouse.y<=areas.dst.y2) {
			point=datamovin.lookUp(mouse.x,"dst");
			if(!datamovin.checkCurrent(point,"dst")) {
				setTimeout(function tm(){
					datamovin.drawInFlow(point,true)
					click_callback(datamovin.getPointInfo(point,'dst'));
					//setTimeout(function ttm(){$("body").css("cursor","default");processing=false;},0);
				},5);
			} else {
				datamovin.clean();
			}
		}	
		
		return false;
		
	}
	function initEvent(e){
		if (!e) var e = window.event;
		if (e.preventDefault)
		        e.preventDefault();
		    else
		        e.returnValue= false;
		return e;
	}
	/*
	function getPosition(event) {
		var x = 0,
			y = 0;
		
		// Get the mouse position relative to the canvas element.
		if (event.layerX || event.layerX == 0) { // Firefox
			x = event.layerX;
			y = event.layerY;
		} else if (event.offsetX || event.offsetX == 0) { // Opera
			x = event.offsetX;
			y = event.offsetY;
		}
		
		return {x:x,y:y};
	}
	*/
	/*
	*
	* getPosition needs to be improved to avoid the use of jQuery [only case in which I'm using it...]
	*
	*/
	function getPosition(e) {

	    //this section is from http://www.quirksmode.org/js/events_properties.html
	    var targ;
	    if (!e)
	        e = window.event;
	    if (e.target)
	        targ = e.target;
	    else if (e.srcElement)
	        targ = e.srcElement;
	    if (targ.nodeType == 3) // defeat Safari bug
	        targ = targ.parentNode;

	    // jQuery normalizes the pageX and pageY
	    // pageX,Y are the mouse positions relative to the document
	    // offset() returns the position of the element relative to the document
	    var x = e.pageX - $(targ).offset().left;
	    var y = e.pageY - $(targ).offset().top;

	    return {"x": Math.floor(x), "y": Math.floor(y)};
	};
}