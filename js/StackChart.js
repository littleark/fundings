function StackChart(data,options){


	var margins=options.margins;

	var svg=d3.select(options.container)
				.append("svg")
				.attr("width",options.width)
				.attr("height",options.height)
					.append("g")
						.attr("transform","translate("+margins.left+","+(options.height-margins.bottom)+")")

	var yaxis=svg.append("g");

	var	x = d3.scale.ordinal().rangeRoundBands([0, options.width - margins.left - margins.right]),
		y = d3.scale.linear().range([0, options.height - margins.top - margins.bottom]),
		z = d3.scale.ordinal().range(["#23a4db", "#d8232a"]);

	var xt=d3.extent(data[0].map(function(d) { return d.x; }));

	x.domain(xt);
	x = d3.scale.linear().range([5, options.width - margins.left - margins.right-5]).domain(xt);


	y.domain([0, d3.max(data[data.length - 1], function(d) { return d.y0 + d.y; })]);
	

	drawAreas();

	var vrules=svg.append("g")
				.selectAll("g.vrule")
					.data(data[1].map(function(d) { return d; }))
    				.enter()
    				.append("svg:g")
    				.attr("class","vrule")
    					.attr("transform",function(d){
    						return "translate("+x(d.x)+",0)";
    					})
    					
	var w=x(data[0][1].x)-x(data[0][0].x);

	vrules
		.append("svg:text")
			.attr("x",0)
			.attr("y", 6)
			.attr("text-anchor", "middle")
			.attr("dy", ".71em")
			.text(function(d){
				return d3.time.format("%Y")(d.x);
			})
			.classed("clickable",function(d){
				return true;
				var year= +d3.time.format("%Y")(d.x);
				return [2009,2012,2013].indexOf(year)>-1;
			})

	var labels=svg.append("g")
		.selectAll("g.vlabel")
		.data(data[0].concat(data[1]))
		.enter()
		.append("g")
			.attr("class","vlabel")
			.attr("transform",function(d){
				var _x=x(d.x),
					_y=-y(d.y0 + d.y);
				return "translate("+_x+","+_y+")";
			})
			.on("click",function(d){
				options.callback(d3.time.format("%Y")(d.x));
			})
			.on("mouseover",function(d){
				vrules
					.classed("hover",false)
					.filter(function(l){
						return l.x==d.x;
					})
					.classed("hover",true)

				labels
					.classed("hover",false)
					.filter(function(l){
						return l.x==d.x;
					})
					.classed("hover",true)
			})
			.on("mouseout",function(d){
				vrules
					.classed("hover",false);
				labels
					.classed("hover",false);
			})
	
	labels.append("svg:rect")
			.attr("x",function(d){
				return (d.t=="public")?10:-120;
			})
			.attr("y",-20)
			.attr("width",110)
			.attr("height",35)
			//.attr("rx",5)
			//.attr("ry",5)

	labels.append("svg:text")
			.attr("class","vlabel")
			.attr("x",function(d){
				return (d.t=="public")?15:-115;
			})
			.attr("y",-15)
			.attr("text-anchor", "start")			
			.attr("dy", ".71em")
			.text(function(d){
				if(d.t=="private") {
					return "Donazioni private";
				} else {
					return "Rimborsi elettorali";
				}
			})
	labels.append("svg:text")
			.attr("class","vlabel")
			.attr("x",function(d){
				return (d.t=="public")?15:-115;
			})
			.attr("y",0)
			.attr("text-anchor", "start")			
			.attr("dy", ".71em")
			.style("fill",function(d){
				
				return (d.t=="public")?"#d8232a":"#23a4db";
			})
			.text(function(d){
				return "€"+d3.format(",.2f")(d.y/1000000) + " Milioni";
			})

	labels.append("svg:circle")
			.attr("cx",0)
			.attr("cy",0)
			.attr("r", "4");

	labels
		.filter(function(d){
			return d.t=="public";
		})
		.append("svg:rect")
		.attr("class","ux")
		.attr("x",-w/2)
		.attr("y",function(d){
			return y(d.y0 + d.y)-options.height;
		})
		.attr("width",w)
		.attr("height",options.height+margins.bottom)
		.style("opacity",0)

	vrules
		.append("line")
			.attr("y2",function(d){
				return -y(d.y+d.y0);
			})

	// Add y-axis rules.
	var rule = yaxis.selectAll("g.rule")
	      .data(y.ticks(3))
	    .enter().append("svg:g")
	      .attr("class", "rule")
	      .attr("transform", function(d) { return "translate(0," + -y(d) + ")"; });


	rule.append("svg:line")
	      .attr("x2", options.width - margins.left - margins.right)
	      .style("stroke", function(d) { return "#333"; })
	      .style("stroke-opacity", function(d) { return d ? .1 : null; });



	rule.append("svg:text")
	      .attr("x", 0)
	      .style("text-anchor","end")
	      .attr("dy", ".35em")
	      .text(function(d){
	      	if(d>0)
	      		return "€"+d3.format(",.0f")(d/1000000)+" Milioni";//+"M";
	      	return "";
	      });
	
	function drawAreas() {

		var y = d3.scale.linear()
					.domain([0, d3.max(data[data.length - 1], function(d) { return d.y0 + d.y; })])
					.range([0,options.height-margins.top-margins.bottom]);

		var area = d3.svg.area()
					    .x(function(d) {
					    	return x(d.x); 
					    })
					    .y0(function(d) { return -y(d.y0); })
					    .y1(function(d) { return -y(d.y0 + d.y); })
					    .interpolate("monotone")

		svg.selectAll("path")
					.data(data)
					.enter().append("path")
						.attr("d", area)
						.style("fill", function(d,i) { 
							return z(i);
						})
						.style("stroke",function(d,i){
							return "none"
							return d3.rgb(z(i)).darker();
						})
		
	}


	function moneyFormat(money,compact,noeuro) {
		if(!money)
			return "";
		if(money>1000000)
			return (noeuro?"":"&euro;")+d3.format(".2f")(money/1000000)+(compact?"M":" Milioni")
		if(money>1000) {
			return (noeuro?"":"&euro;")+d3.format(".0f")(money)
		}
	}
}