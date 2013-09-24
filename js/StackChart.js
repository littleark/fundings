function StackChart(data,options){

	var margins=options.margins;

	var svg=d3.select(options.container)
				.append("svg")
				.attr("width",options.width)
				.attr("height",options.height)
					.append("g")
						.attr("transform","translate("+margins.left+","+(options.height-margins.bottom)+")")

	var	x = d3.scale.ordinal().rangeRoundBands([0, options.width - margins.left - margins.right]),
		y = d3.scale.linear().range([0, options.height - margins.top - margins.bottom]),
		z = d3.scale.ordinal().range(["#23a4db", "#d8232a"]);

	var xt=d3.extent(data[0].map(function(d) { return d.x; }));

	//console.log("XT",xt)	

	//x.domain(data[0].map(function(d) { return d.x; }));
	x.domain(xt);
	x = d3.scale.linear().range([5, options.width - margins.left - margins.right-5]).domain(xt);

	//console.log(x.domain())

	y.domain([0, d3.max(data[data.length - 1], function(d) { return d.y0 + d.y; })]);
	
	//console.log(y.domain())

	/*	
	// Add a group for each type of funding.
	var fundings = svg.selectAll("g.fundings")
					.data(data)
					.enter().append("svg:g")
					.attr("class", "funding")
					.style("fill", function(d, i) { return z(i); })
					.style("stroke", function(d, i) { return d3.rgb(z(i)).darker(); });

	// Add a rect for each date.
	var rects = fundings.selectAll("rect")
					.data(Object)
					.enter().append("svg:rect")
					.attr("x", function(d) { return x(d.x); })
					.attr("y", function(d) { return -y(d.y0) - y(d.y); })
					.attr("height", function(d) { return y(d.y); })
					.attr("width", x.rangeBand());
	*/

	drawAreas();

	var vrules=svg.selectAll("g.vrule")
					.data(data[1].map(function(d) { return d; }))
    				.enter()
    				.append("svg:g")
    				.attr("class","vrule")
    					.attr("transform",function(d){
    						return "translate("+x(d.x)+",0)";
    					});

	// Add a label per date.
	/*var label = svg.selectAll("text")
					//.data(x.domain())
					.data(data[0].map(function(d) { return d.x; }))
	    				.enter()*/
	vrules
	    				.append("svg:text")
							/*
							.attr("x", function(d) { 
								return x(d);// + x.rangeBand() / 2; 
							})
							*/
							.attr("x",0)
							.attr("y", 6)
							.attr("text-anchor", "middle")
							.attr("dy", ".71em")
							.text(function(d){
								return d3.time.format("%Y")(d.x);
							})
							.classed("clickable",function(d){
								var year= +d3.time.format("%Y")(d.x);
								return [2009,2012,2013].indexOf(year)>-1;
							})
							.on("click",function(d){
								options.callback(d3.time.format("%Y")(d.x));
							})
	vrules
		.append("line")
			.attr("y2",function(d){
				//console.log(d);
				return -y(d.y+d.y0);
			})
			.style("stroke","#fff")
			.style("stroke-opacity",0.2)
	//svg.selectAll("")
	//		.data(data[0].map(function(d) { return d.x; }))

	// Add y-axis rules.
	var rule = svg.selectAll("g.rule")
	      .data(y.ticks(3))
	    .enter().append("svg:g")
	      .attr("class", "rule")
	      .attr("transform", function(d) { return "translate(0," + -y(d) + ")"; });

	rule.append("svg:line")
	      .attr("x2", options.width - margins.left - margins.right)
	      .style("stroke", function(d) { return d ? "#333" : "#000"; })
	      .style("stroke-opacity", function(d) { return d ? .1 : null; });

	rule.append("svg:text")
	      .attr("x", 0)
	      .style("text-anchor","end")
	      .attr("dy", ".35em")
	      .text(function(d){
	      	return d3.format(",.0f")(d/1000000)+"M";
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
							//console.log(i,d)
							return z(i);
						})
						.style("stroke",function(d,i){
							return "none"
							return d3.rgb(z(i)).darker();
						})
		
	}

}