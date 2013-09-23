function BubbleFlowChart(data) {

	var svg=d3.select("#svg")
				.append("svg")
				.attr("width",WIDTH)
				.attr("height",HEIGHT)
				.append("g")
					.attr("transform","translate("+margins.left+","+margins.top+")");

	HEIGHT=HEIGHT-margins.top-margins.bottom;

	var src_size=[],
		dst_size=[],
		src_public_size=[];
	
	var flows_size=[],
		flows_public_size=[];

	var max={},
		extent={};

	var delta={};

	this.loadCSV=function(url) {
		d3.csv(url,function(d){
			return {
				to:d.Target.toLowerCase(),
				from:d.Source.toLowerCase(),//+(d.Rata||"")+(d.Regione||""),
				rata:d.Rata,
				regione:d.Regione,
				t:d.Pubblico?"public":"private",
				flow:+d.Weight
			}
		},function(error,rows){
			//console.log(rows);

			var rows_name={};

			rows.forEach(function(d){
				if(!rows_name[d.from+d.to]) {
					rows_name[d.from+d.to]=d;
				} else {
					rows_name[d.from+d.to].flow+=d.flow;
				}
			})

			var aggregated_rows=[];
			for(var from in rows_name) {
				aggregated_rows.push(rows_name[from]);
			}

			//console.log("ROWS_NAME",rows_name)

			data=aggregated_rows.filter(function(d){
				return d.flow>0;
			});

			updateData(data);
			updateFlows();

			max=getImportantValues()
			extent=getExtents();

			updateScales();

			delta=getDelta();

			

			updateCircleGroups(src,src_groups,src_sub_groups,src_size,"src");
			updateCircleGroups(src_public,src_public_groups,src_public_sub_groups,src_public_size,"src_public");
			updateCircleGroups(dst,dst_groups,dst_sub_groups,dst_size,"dst");
		});
	}

	function updateData(data){

		function getNestedValues(t,direction,data) {
			var values=d3.nest()
					.key(function(d){
						return d[direction];
					})
					.rollup(function(leaves) { 
						return {
							"length": leaves.length, 
							"total": d3.sum(leaves, function(d) {return parseFloat(d.flow);}),
							"t":t,
							"flows": leaves.map(function(d){
								return {
									from:d.from,
									to:d.to,
									flow:d.flow,
									rata:d.rata,
									regione:d.regione,
									t:d.t

								}
							}).sort(function(a,b){
								return b.flow - a.flow;
							})
						}	
					})
					.entries(data);

				values.sort(function(a,b){
					return b.values.total - a.values.total;
				});

				//CALCULATE STACK
				values.reduce(function(prev,cur){
					if(!prev.values.offset) {
						prev.values.offset=0;
					}
					cur.values.offset=prev.values.offset+prev.values.total;
					return cur;
				});

				values.forEach(function(d){
					d.values.flows.reduce(function(prev,cur){
						if(!prev.offset) {
							prev.offset=0;
						}
						cur.offset=prev.offset+prev.flow;
						return cur;
					});
				})

				return values;
		}

		//PRIVATE
		src_size=[];
		src_size=getNestedValues("private","from",data.filter(function(d){
						return d.t=="private";
					}));

		//PUBLIC
		src_public_size=[];
		src_public_size=getNestedValues("public","from",data.filter(function(d){
						return d.t=="public";
					}));

		//DESTINATION
		dst_size=[];
		dst_size=getNestedValues(null,"to",data);

	}

	updateData(data);



	function updateFlow(data,t) {

		var flows=[];

		data.forEach(function(d,i){
		
			d.values.flows.forEach(function(src_d) {
				var flow={
					t:t,
					from:src_d.from,
					rata:src_d.rata,
					regione:src_d.regione,
					to:src_d.to,
					src_index:i,
					size:src_d.flow,
					src_outer_offset:d.values.offset || 0,
					src_inner_offset:src_d.offset || 0
				};

				var tmp_dst=dst_size.filter(function(t,i){
					t.index=i;
					return t.key==flow.to;
				})[0];

				flow.dst_index=tmp_dst.index;
				//flow.dst_size=tmp_dst.values.total;
				flow.dst_outer_offset=tmp_dst.values.offset || 0;
				
				flow.total=tmp_dst.values.total;

				var tmp_inner_dst=tmp_dst.values.flows.filter(function(t,i){
					t.offset=t.offset || 0;
					return t.from==src_d.from && t.regione==src_d.regione && t.rata==src_d.rata;
				})[0];

				flow.dst_inner_offset=tmp_inner_dst.offset || 0;

				flows.push(flow);
			});

		});

		return flows.sort(function(a,b){
			return b.size - a.size;
		});

	}
	
	
	
	function updateFlows() {
		flows_size=updateFlow(src_size,"private");
		flows_public_size=updateFlow(src_public_size,"public");
		
		console.log("FLOWS",flows_size);
		console.log("FLOWS PUBLIC",flows_public_size);
	}
	
	updateFlows();
	

	function getImportantValues() {
		return {
			src:d3.sum(src_size,function(d){
				return d.values["total"];
			}),
			src_public:d3.sum(src_public_size,function(d){
				return d.values["total"];
			}),
			dst:d3.sum(dst_size,function(d){
				return d.values["total"];
			}),
			y_src:d3.sum(src_size,function(d){
				//console.log(d.values["offset"])
				return d.values["offset"];
			}),
			y_dst:d3.sum(dst_size,function(d){
				return d.values["offset"];
			}),
			total:d3.sum(data,function(d){
				return d.flow;
			}),
			real_total:d3.sum(data,function(d){
				return d.real_flow;
			})
		};
	}

	max=getImportantValues();

	console.log("ALL SUMS",max);

	function getExtents() {
		return {
			src:d3.extent(src_size,function(d){
				return d.values["total"];
			}),
			src_public:d3.extent(src_public_size,function(d){
				return d.values["total"];
			}),
			dst:d3.extent(dst_size,function(d){
				return d.values["total"];
			}),
			flows:d3.extent(flows_size.concat(flows_public_size),function(d){
				return d.size;
			}),
			flows_private:d3.extent(flows_size,function(d){
				return d.size;
			}),
			flows_public:d3.extent(flows_public_size,function(d){
				return d.size;
			})
		};
	}

	extent=getExtents();

	//console.log("extent",extent,[Math.min(extent.src[0],extent.dst[0]),Math.min(extent.src[0],extent.dst[0])])
	console.log("!!!!!!!!",extent,[Math.min(extent.src[0],extent.dst[0]),Math.max(extent.src[0],extent.dst[0])])
	console.log(src_size)

	//var scale_h=d3.scale.sqrt().domain([0,Math.max(max.src,max.dst)]).range([0,HEIGHT-dst_size.length*step])
	var scale_y=d3.scale.linear().domain([0,max.total]).range([0,HEIGHT-d3.max([src_size.length,src_public_size.length,dst_size.length])*step]);

	//var max_r=HEIGHT-d3.max([src_size.length,src_public_size.length,dst_size.length])*step;

	var radius={
		min:scale_y(d3.min([extent.src[0],extent.src_public[0],extent.dst[0]])),
		max:scale_y(d3.max([extent.src[1],extent.src_public[1],extent.dst[1]]))
	}

	var min_r_domain=d3.min([extent.src[0],extent.src_public[0],extent.dst[0]]);

	var scale_r2=d3.scale.sqrt().domain([min_r_domain*1,max.total]).range([0,radius.max/2]);//max_r*max_r*Math.PI])
	
	var scale_r=function(d) {
		var r=scale_r2(d);

		if(r>3) {
			return r*1.5;
		}

		return 0.05;

	}
	
	scale_r=function(d){
		var r=scale_y(d)/2;

		//if(r<1)
		//	return 1;

		return r;
	};

	var scale_color1 = d3.scale.linear()
						    .domain(extent.flows_private)
						    .range(["#23a4db","#23a4db"])
						    .interpolate(d3.interpolateLab);
						    //.range(["#9FC9E1","#1E648C"])
						    //.range(["hsl(72,60%,89%)", "hsl(348,100%,43%)"]);
	var scale_color2 = d3.scale.linear()
						    .domain(extent.flows_public)
						    .range(["#d8232a","#d8232a"])
						    .interpolate(d3.interpolateLab);
						    //.range(["#ffff00","#ff6600"])

	var scale_color={
		"private":scale_color1,
		"public":scale_color2
	};

	//console.log("SCALE_COLOR DOMAIN",scale_color.domain())

	//HEIGHT=HEIGHT*2;
	
	function getDelta() {
		return {
			src:{
				x:0,
				y:(HEIGHT - d3.sum(src_size,function(d){
								return scale_r(d.values["total"])*2;
							}))/2
			},
			src_public:{
					x:(WIDTH-margins.right-margins.left-box_w),
					y:(HEIGHT-d3.sum(src_public_size,function(d){
								return scale_r(d.values["total"])*2;
							}))/2
			},
			dst:{
				x:((WIDTH-margins.right-margins.left)/2-box_w/2),
				y:(HEIGHT-d3.sum(dst_size,function(d){
								return scale_r(d.values["total"])*2;
							}))/2
			}
		}
	}
	delta=getDelta();

	function updateScales() {

		//var scale_h=d3.scale.sqrt().domain([0,Math.max(max.src,max.dst)]).range([0,HEIGHT-dst_size.length*step])
		scale_y.domain([0,max.total]);

		//var max_r=HEIGHT-d3.max([src_size.length,src_public_size.length,dst_size.length])*step;

		var radius={
			min:scale_y(d3.min([extent.src[0],extent.src_public[0],extent.dst[0]])),
			max:scale_y(d3.max([extent.src[1],extent.src_public[1],extent.dst[1]]))
		}

		var min_r_domain=d3.min([extent.src[0],extent.src_public[0],extent.dst[0]]);

		scale_r2.domain([min_r_domain*1,max.total]);
		scale_r2.range([0,radius.max/2]);

		console.log("TESTING:","scale_y(1000000)",scale_y(1000000))

	}

	updateScales(); //useless call, just to test

	//d3.select("svg").attr("height",HEIGHT)

	console.log(delta,HEIGHT,max.src,max.dst)

	var gradientPrivate=generateLinearGradient(svg,"gradientPrivate","#a69ca9","#ac77bb");
	var gradientPublic=generateLinearGradient(svg,"gradientPublic","#6b9abf","#87a4bb");

	svg.append("path")
			.attr("d",function(){
				var x=((WIDTH-margins.right-margins.left)/4-box_w/2);
				return "M"+(x-40)+","+(HEIGHT/2-40)+"l80,40l-80,40z";
			})
			.style("stroke","none")
			.style("fill","#000")
			.style("fill-opacity",0.05)

	svg.append("path")
			.attr("d",function(){
				var x=((WIDTH-margins.right-margins.left)*3/4);
				return "M"+(x+40)+","+(HEIGHT/2-40)+"l-80,40l80,40z";
			})
			.style("stroke","none")
			.style("fill","#000")
			.style("fill-opacity",0.05)

			
	var canvas={
		width:WIDTH-margins.right-margins.left,
		height:HEIGHT-margins.top-margins.bottom
	}
	

	var src=svg.append("g")
				.attr("id","src")
				.attr("transform","translate("+0+","+0+")");

	src.attr("transform","translate("+delta.src.x+","+delta.src.x+")")

	var src_groups,
		src_sub_groups;

	updateCircleGroups(src,src_groups,src_sub_groups,src_size,"src");

	var dst=svg.append("g")
				.attr("id","dst")
				.attr("transform","translate("+delta.dst.x+","+delta.dst.y+")");

	var dst_groups,
		dst_sub_groups;

	updateCircleGroups(dst,dst_groups,dst_sub_groups,dst_size,"dst");

	var src_public=svg.append("g")
				.attr("id","src_public")
				.attr("transform","translate("+delta.src_public.x+","+delta.src_public.y+")");

	var src_public_groups,
		src_public_sub_groups;

	updateCircleGroups(src_public,src_public_groups,src_public_sub_groups,src_public_size,"src_public");

	var flows=svg.append("g")
				.attr("id","flows_v")
				.attr("transform","translate("+0+","+0+")")

	var ux_layer={
			main:svg.append("g")
					.attr("id","ux")
	};



	var inc=0;
	ux_layer.src_groups=ux_layer.main.append("g")
			.attr("transform",src.attr("transform"))
			.selectAll("rect.ux-src")
			.data(src_size,function(d){
				return d.key;
			})
			.enter()
			.append("g")
				.attr("class","ux-src")
				.attr("transform",function(d){
					var x=0,
						new_y=(scale_r(d.values.total))+inc;
						inc=inc+scale_r(d.values.total)*2;
						y=new_y-scale_r(d.values.total);
					return "translate("+x+","+y+")";
				});
	ux_layer.src_groups.append("rect")
				.attr("x",function(d,i){
					return -margins.left;
				})
				.attr("y",0)
				.attr("width",function(d){
					return margins.left + (WIDTH-margins.right-margins.left-box_w)/4;
				})
				.attr("height",function(d){
					return scale_r(d.values.total)*2;
				})
				.style("fill-opacity",0)
	ux_layer.src_groups.append("text")
					.attr("class","label")
					.classed("permanent",function(d){
						return scale_r(d.values.total)*2+step*2>12;
					})
					.attr("x",function(d,i){
						return -scale_r(d.values.total)
					})
					.attr("y",function(d,i){
						return scale_r(d.values.total);
					})
					.attr("dy","0.25em")
					.style("text-anchor","end")
					.text(function(d){
						return d.key;
					});
	inc=0;
	ux_layer.src_public_groups=ux_layer.main.append("g")
			.attr("transform",src_public.attr("transform"))
			.selectAll("g.ux-src_public")
			.data(src_public_size,function(d){
				return d.key;
			})
			.enter()
			.append("g")
				.attr("class","ux-src_public")
				.attr("transform",function(d){
					var x=0,
						new_y=(scale_r(d.values.total))+inc;
						inc=inc+scale_r(d.values.total)*2;
						y=new_y-scale_r(d.values.total);
					return "translate("+x+","+y+")";
				});

	ux_layer.src_public_groups
				.append("rect")
				.attr("x",function(d,i){
					return -((WIDTH-margins.right-margins.left-box_w)/4);
				})
				.attr("y",function(d){
					return 0;
					var new_y=(scale_r(d.values.total))+inc;
					inc=inc+scale_r(d.values.total)*2;
					return new_y-scale_r(d.values.total);
				})
				.attr("width",function(d){
					return (margins.right + (WIDTH-margins.right-margins.left-box_w)/4);
				})
				.attr("height",function(d){
					return scale_r(d.values.total)*2;
				})
				.style("fill-opacity",0)

	ux_layer.src_public_groups
				.append("text")
				.attr("class","label")
				.classed("permanent",function(d){
					return scale_r(d.values.total)*2+step*2>12;
				})
				.attr("x",function(d,i){
					return box_w+scale_r(d.values.total);
				})
				.attr("y",function(d,i){
					return scale_r(d.values.total);
				})
				.attr("dy","0.25em")
				.style("text-anchor","start")
				.text(function(d){
					return d.key;
				});

	inc=0;
	ux_layer.dst_groups=ux_layer.main.append("g")
			.attr("transform",dst.attr("transform"))
			.selectAll("g.ux-dst")
			.data(dst_size,function(d){
				return d.key;
			})
			.enter()
			.append("g")
				.attr("class","ux-dst")
				.attr("transform",function(d){
					var x=0,
						new_y=(scale_r(d.values.total))+inc;
						inc=inc+scale_r(d.values.total)*2;
						y=new_y-scale_r(d.values.total);
					return "translate("+x+","+y+")";
				});

	ux_layer.dst_groups.append("rect")
				.attr("class","ux-dst")
				.attr("x",function(d,i){
					return -(WIDTH-margins.right-margins.left-box_w)/4;
				})
				.attr("y",function(d){
					return 0;
					var new_y=(scale_r(d.values.total))+inc;
					inc=inc+scale_r(d.values.total)*2;
					return new_y-scale_r(d.values.total);
				})
				.attr("width",(WIDTH-margins.right-margins.left-box_w)/2)
				.attr("height",function(d){
					return scale_r(d.values.total)*2;
				})
				.style("fill-opacity",0)

	ux_layer.dst_groups
				.append("text")
				.attr("class","label")
				.classed("permanent",function(d){
					return scale_r(d.values.total)*2+step*2>12;
				})
				.attr("x",function(d,i){
					return box_w;
				})
				.attr("y",function(d,i){
					return scale_r(d.values.total);
				})
				.attr("dx",(-box_w/2)+"px")
				.attr("dy","0.25em")
				.style("text-anchor","middle")
				.text(function(d){
					return d.key;
				});

	var left_arrow=svg.append("g")
						.attr("transform","translate("+(-margins.left)+",0)")
	var right_arrow=svg.append("g")
						.attr("transform","translate("+(canvas.width+margins.right)+",0)")

	var arrow_margin=130;
	left_arrow.append("text")
			.attr("class","title")
			.attr("x",0)
			.attr("y",0)
			.style("text-anchor","start")
			.attr("dy","-0.5em")
			.text("FINANZIAMENTI PRIVATI")
			.style({
				"font-size":"10px",
				"font-weight":100
			})
	left_arrow.append("line")
			.attr("x1",0)
			.attr("y1",0)
			.attr("x2",canvas.width/2)
			.attr("y2",0)
			.style({
				"stroke":"#bbb",
				"shape-rendering":"crispEdges"
			})
	left_arrow.append("path")
			.attr("d",function(){
				var x=canvas.width/2,
					y=0;
				var b=5;

				return "M"+(x-b)+","+(y-b)+"l"+(b*2)+","+b+"l-"+(b*2)+","+b+"z";
			})
			.style({
				"stroke":"none",
				"fill":"#bbb",
				"fill-opacity":1
			})

	right_arrow.append("text")
			.attr("class","title")
			.attr("x",0)
			.attr("y",0)
			.style("text-anchor","end")
			.attr("dy","-0.5em")
			.text("RIMBORSI PUBBLICI")
			.style({
				"font-size":"10px",
				"font-weight":100
			})

	right_arrow.append("line")
			.attr("x1",0)
			.attr("y1",0)
			.attr("x2",-canvas.width/2)
			.attr("y2",0)
			.style({
				"stroke":"#bbb",
				"shape-rendering":"crispEdges"
			})

	right_arrow.append("path")
			.attr("d",function(){
				var x=-canvas.width/2,
					y=0;
				var b=5;
				return "M"+(x+b)+","+(y-b)+"l"+(-b*2)+","+b+"l"+(b*2)+","+b+"z";
			})
			.style({
				"stroke":"none",
				"fill":"#bbb",
				"fill-opacity":1
			})

	var labels_src=svg.append("g")
				.attr("id","labels_src")
				.attr("transform","translate("+0+","+delta.src.y+")")

	var labels_dst=svg.append("g")
				.attr("id","labels_dst")
				.attr("transform","translate("+(WIDTH-margins.right-margins.left-box_w)+","+delta.dst.y+")");

	function updateCircleGroups(node,groups,sub_groups,data,delta_group) {
		var inc=0;
		
		

		node.transition().duration(1000).attr("transform","translate("+delta[delta_group].x+","+delta[delta_group].y+")")

		
		groups=node.selectAll("g.fund").data(data,function(d){
				return d.key;
			});
		
		console.log("exit",groups.exit())
		groups.exit().transition().duration(1000).style("opacity","1e-6").remove();

		var inc=0;
		var new_groups=groups
								.enter()
								.append("g")
								.attr("rel",function(d){
									return d.key;
								})
								.attr("class","fund")
								.style("opacity","1e-6")
								.attr("transform",function(d,i){
									d.delta=i*step
									var new_y=(scale_r(d.values.total))+inc;
									inc=inc+scale_r(d.values.total)*2;
									return "translate(0,0)";
									//return "translate(0,"+(new_y-scale_r(d.values.total))+")";
								});


		console.log("new_groups",new_groups)

		

		new_groups.append("g")
			.attr("class","center")
			.attr("transform",function(d){
				return "translate(0,"+(scale_r(d.values.total))+")"
			});


		new_groups.append("circle")
					.attr("class","center")
					.attr("cx",0)
					.attr("cy",function(d){
						return (scale_r(d.values.total));
					})
					.attr("r",function(d){
						if(scale_r(d.values.total)<5) {
							return 0;
						}
						return 1.5;
					})
					.style({
						"fill":"#fff",
						"stroke":"none"
					})

		sub_groups=groups
							.select("g")
								.attr("transform",function(d){
									return "translate(0,"+(scale_r(d.values.total))+")"
								})
								.selectAll("circle")
								.data(function(d){
									//console.log("MERDA",d)
									return d.values.flows.map(function(sub_d){
										return {
											parent:d.key,
											from:sub_d.from,
											to:sub_d.to,
											flow:sub_d.flow,
											radius: d.values.total - (sub_d.offset||0),
											t:sub_d.t
										}
									})
								},function(d){
									return d.from+"-"+d.to;
								});

		sub_groups.exit().transition().style("opacity","1e-6").remove();

		sub_groups.enter()
				.append("circle")
					.attr("class",function(d){
						return "sub "+d.t;
					})
					.attr("rel",function(d){
						return d.radius+": "+scale_r(d.radius)+" flow:"+d.flow;
					})
					.attr("cx",0)
					.attr("cy",0)
					.style("opacity","1e-6")
					.attr("r",function(d,i){
						return 0;
						var r=scale_r(d.radius);
						if (r<0.5)
							return 0.25;
						return r;
						return scale_r(d.radius);///Math.PI);
						return scale_y(d.radius)/2;
					})
					.classed("no-stroke",function(d,i){
						return scale_r(d.radius)<3;// && i>0;
					})
					.style("fill",function(d){
						//return "#000";
						//scale_color.interpolate(d3.interpolateLab);
						//console.log(d.radius,scale_color(d.radius))
						return scale_color[d.t](d.flow);
					})


		var inc=0;
		groups
			.transition()
			.duration(1000)
			.attr("transform",function(d,i){
				d.delta=i*step
				var new_y=(scale_r(d.values.total))+inc;
				inc=inc+scale_r(d.values.total)*2;
				return "translate(0,"+(new_y-scale_r(d.values.total))+")";
			})
			.select("circle.center")
				.attr("cy",function(d){
					return (scale_r(d.values.total));
				});

		sub_groups
			.transition()
			.duration(1000)
			//.style("opacity","1")
			.attr("r",function(d,i){
				var r=scale_r(d.radius);
				if (r<0.5)
					return 0.25;
				return r;
			})

	}

	

	/*
	var inc=0;
	var src_groups=src.selectAll("g.fund")
			.data(src_size,function(d){
				return d.key;
			})
			.enter()
			.append("g")
			.attr("class","fund")
			.attr("rel",function(d){
				return d.key;
			})
			.attr("transform",function(d,i){
				d.delta=i*step
				var new_y=(scale_r(d.values.total))+inc;
				inc=inc+scale_r(d.values.total)*2;
				return "translate(0,"+(new_y-scale_r(d.values.total))+")";
			});

	var src_sub_groups = src_groups.append("g")
				.attr("transform",function(d){
					return "translate(0,"+(scale_r(d.values.total))+")"
				})
				.selectAll("circle")
				.data(function(d){
					//console.log("MERDA",d)
					return d.values.flows.map(function(sub_d){
						return {
							from:sub_d.from,
							to:sub_d.to,
							flow:sub_d.flow,
							radius: d.values.total - (sub_d.offset||0)
						}
					})
				},function(d){
					return d.from+"-"+d.to;
				})
					.enter()
					.append("circle")
						.attr("class","sub private")
						.attr("rel",function(d){
							return d.radius+": "+scale_r(d.radius)+" flow:"+d.flow;
						})
						.attr("cx",0)
						.attr("cy",0)
						.attr("r",function(d,i){
							var r=scale_r(d.radius);
							if (r<0.5)
								return 0.25;
							return r;
							return scale_r(d.radius);///Math.PI);
							return scale_y(d.radius)/2;
						})
						.classed("no-stroke",function(d,i){
							return scale_r(d.radius)<3;// && i>0;
						})
						.style("fill",function(d){
							scale_color.interpolate(d3.interpolateLab);
							//console.log(d.radius,scale_color(d.radius))
							return scale_color(d.flow);
						})
	
	src_groups.append("circle")
				.attr("class","center")
				.attr("cx",0)
				.attr("cy",function(d){
					return (scale_r(d.values.total));
				})
				.attr("r",function(d){
					if(scale_r(d.values.total)<5) {
						return 0;
					}
					return 1.5;
				})
				.style({
					"fill":"#fff",
					"stroke":"none"
				})
	*/

	
	/*
	inc=0;
	var src_public_groups=src_public.selectAll("g")
			.data(src_public_size,function(d){
				return d.key;
			})
			.enter()
			.append("g")
			.attr("transform",function(d,i){
				d.delta=i*step;
				var new_y=(scale_r(d.values.total))+inc;
				inc=inc+scale_r(d.values.total)*2;
				return "translate(0,"+(new_y-scale_r(d.values.total))+")";
			});

	var src_public_sub_groups = src_public_groups.append("g")
				.attr("transform",function(d){
					return "translate(0,"+(scale_r(d.values.total)/1)+")"
				})
				.selectAll("circle")
				.data(function(d){
					//console.log("MERDA",d)
					return d.values.flows.map(function(sub_d){
						return {
							from:sub_d.from,
							to:sub_d.to,
							flow: sub_d.flow,
							radius: d.values.total - (sub_d.offset||0)
						}
					})
				})
					.enter()
					.append("circle")
						.attr("class","sub public")
						.attr("rel",function(d){
							return d.radius+": "+scale_y(d.radius)+" flow:"+d.flow
						})
						.attr("cx",0)
						.attr("cy",0)
						.attr("r",function(d,i){
							var r=scale_r(d.radius);
							if (r<0.5)
								return 0.25;
							return r;
							return scale_r(d.radius);///Math.PI);
							return scale_y(d.radius)/2;
						})
						.classed("no-stroke",function(d,i){
							return scale_r(d.radius)<3;// && i>0;
						})
						.style("fill",function(d){
							scale_color.interpolate(d3.interpolateLab);
							//console.log(radius.max,d.radius,scale_color(d.radius))
							return scale_color2(d.flow);
						})
	src_public_groups.append("circle")
				.attr("cx",0)
				.attr("cy",function(d){
					return (scale_r(d.values.total));
				})
				.attr("r",function(d){
					if(scale_r(d.values.total)<5) {
						return 0;
					}
					return 1.5;
				})
				.style({
					"fill":"#fff",
					"stroke":"none"
				})
	*/
	/*
	inc=0;
	var dst_groups=dst.selectAll("g")
			.data(dst_size,function(d){
				return d.key;
			})
			.enter()
			.append("g")
				.attr("transform",function(d,i){
					d.delta=i*step;
					var new_y=(scale_r(d.values.total))+inc;
					inc=inc+scale_r(d.values.total)*2;
					return "translate(0,"+(new_y-scale_r(d.values.total))+")";
				});

	var dst_sub_groups=dst_groups.append("g")
				.attr("transform",function(d){
					return "translate(0,"+(scale_r(d.values.total))+")"
				})
				.selectAll("circle")
				.data(function(d){
					//console.log("MERDA",d)
					return d.values.flows.map(function(sub_d){
						return {
							from:sub_d.from,
							to:sub_d.to,
							flow:sub_d.flow,
							radius: d.values.total - (sub_d.offset||0),
							t:sub_d.t
						}
					})
				})
					.enter()
					.append("circle")
						.attr("class",function(d){
							return "sub "+d.t;
						})
						.classed("no-stroke",function(d,i){
							return scale_y(d.flow)<3;// && i>0;
						})
						.attr("rel",function(d){
							return d.radius+": "+scale_y(d.radius)+": "+d.flow
						})
						.attr("cx",0)
						.attr("cy",0)
						.attr("r",function(d,i){
							var r=scale_r(d.radius);
							if (r<0.5)
								return 0.25;
							return r;
							return scale_r(d.radius);///Math.PI);
							return scale_y(d.radius)/2;
						})
						.style("fill",function(d){
							//scale_color.interpolate(d3.interpolateLab);
							//console.log(radius.max,d.radius,scale_color(d.radius))
							return scale_color[d.t](d.flow);
							return d.t=="private"?scale_color(d.flow):scale_color2(d.flow)
							return scale_color(d.flow);
						});

	dst_groups.append("circle")
				.attr("cx",0)
				.attr("cy",function(d){
					return (scale_r(d.values.total));
				})
				.attr("r",function(d){
					if(scale_r(d.values.total)<5) {
						return 0;
					}
					return 1.5;
				})
				.style({
					"fill":"#fff",
					"stroke":"none"
				})
	*/
	function getStraightPath(d) {
		var x0=box_w+5,
			x1=(WIDTH-margins.right-margins.left-box_w-5),
			h=scale_y(d.size),
			y0=scale_y(d.src_outer_offset+d.src_inner_offset),
			y1=scale_y(d.dst_outer_offset+d.dst_inner_offset);

		return "M"+x0+","+y0+"L"+x1+","+y1+"L"+x1+","+(y1+h)+"L"+x0+","+(y0+h)+"Z";
	}
	function getStraightPathPublic(d) {
		var x0=(WIDTH-margins.right-margins.left-box_w-2),
			x1=(WIDTH-margins.right-margins.left)/2+box_w/2+2,
			h=scale_y(d.size),
			y0=scale_y(d.src_outer_offset+d.src_inner_offset)+ delta.src_public.y,
			y1=scale_y(d.dst_outer_offset+d.dst_inner_offset)+ delta.dst.y;

		return "M"+x0+","+y0+"L"+x1+","+y1+"L"+x1+","+(y1+h)+"L"+x0+","+(y0+h)+"Z";
	}

	function getSmoothPath(d,border) {
		var x0=box_w,//+2,
			x1=(WIDTH-margins.right-margins.left)/2-box_w/2,//-2,
			h=scale_y(d.size)/2,
			y0=0,//scale_y(d.src_outer_offset)+scale_y(d.src_inner_offset)/2+d.src_index*step + delta.src,
			y1=delta.dst.y; //scale_y(d.dst_outer_offset)+scale_y(d.dst_inner_offset)/2+d.dst_index*step + delta.dst;//+h/2;

		if(h<1)
			h=1;

		y1= (scale_y(d.dst_outer_offset)+scale_y(d.dst_inner_offset)/2+d.dst_index*step + delta.dst.y) - (scale_y(d.src_outer_offset)+scale_y(d.src_inner_offset)/2+d.src_index*step);
		y1-= delta.src.y;
		
		
		// flows are under the center
		y1-=scale_y(d.dst_inner_offset)/2;
		y1+=scale_y(d.total);
		y1-=scale_y(d.size)/2;
		y1-=scale_y(d.dst_inner_offset)/2;
		
		//console.log(d)
		var c1x=x0+(x1-x0)/2,
			c1y=y0,
			c2x=x1-(x1-x0)/2,
			c2y=y1;

		var path="";
		var m=1;
		if(!border) {
			path="M"+x0+","+y0;
			path+="C"+(c1x+h/2*(y0>y1?-m:m))+","+(c1y)+","+(c2x)+","+c2y+","+x1+","+y1;
			path+="L"+x1+","+(y1+h);
			path+="C"+(c2x+(h/2)*(y0>y1?m:-m))+","+(c2y+h)+","+(c1x)+","+(c1y+h)+","+x0+","+(y0+h)+"Z";
		}

		if(border=="top") {
			path="M"+x0+","+y0;
			path+="C"+(c1x+h/2*(y0>y1?-m:m))+","+(c1y)+","+(c2x)+","+c2y+","+x1+","+y1;;
		}
		if(border=="bottom") {
			path="M"+x1+","+(y1+h);
			path+="C"+(c2x+(h/2)*(y0>y1?m:-m))+","+(c2y+h)+","+(c1x)+","+(c1y+h)+","+x0+","+(y0+h);
		}
		

		return path;

	}

	function getSmoothPathPublic(d,border) {

		//console.log("PATH",d)

		var x0=0,//(WIDTH-margins.right-margins.left-box_w),//-2,
			x1=-(WIDTH-margins.right-margins.left)/2+box_w/2,//+2,
			h=scale_y(d.size)/2,
			y0=0,//scale_y(d.src_outer_offset)+scale_y(d.src_inner_offset)/2+d.src_index*step + delta.src_public,
			y1=delta.dst.y; //scale_y(d.dst_outer_offset)+scale_y(d.dst_inner_offset)/2+d.dst_index*step + delta.dst;//+h/2;
		//console.log(d)
		//y1= (scale_y(d.dst_outer_offset)+scale_y(d.dst_inner_offset)/2+d.dst_index*step + delta.dst) - (scale_y(d.src_outer_offset)+scale_y(d.src_inner_offset)/2+d.src_index*step);

		y1= (scale_y(d.dst_outer_offset)+scale_y(d.dst_inner_offset)/2 + delta.dst.y) - (scale_y(d.src_outer_offset)+scale_y(d.src_inner_offset)/2);

		
		y1-= delta.src_public.y;
		
		/*
		// flows are under the center
		y1-=scale_y(d.dst_inner_offset)/2;

		y1+=scale_y(d.total);

		y1-=scale_y(d.size)/2;

		y1-=scale_y(d.dst_inner_offset)/2;
		*/

		var c1x=x0+(x1-x0)/2,
			c1y=y0,
			c2x=x1-(x1-x0)/2,
			c2y=y1;

		var path="";

		var m=-1;
		if(!border) {
			path="M"+x0+","+y0;
			path+="C"+(c1x+h*(y0>y1?-m:m))+","+(c1y)+","+(c2x)+","+c2y+","+x1+","+y1;
			path+="L"+x1+","+(y1+h);
			path+="C"+(c2x+(h)*(y0>y1?m:-m))+","+(c2y+h)+","+(c1x)+","+(c1y+h)+","+x0+","+(y0+h)+"Z";
		}

		if(border=="top") {
			path="M"+x0+","+y0;
			path+="C"+(c1x+h*(y0>y1?-m:m))+","+(c1y)+","+(c2x)+","+c2y+","+x1+","+y1;;
		}
		if(border=="bottom") {
			path="M"+x1+","+(y1+h);
			path+="C"+(c2x+(h)*(y0>y1?m:-m))+","+(c2y+h)+","+(c1x)+","+(c1y+h)+","+x0+","+(y0+h);
		}
		return path;

	}
	
	var __flows=flows.selectAll("g.flow")
			.data(flows_size.concat(flows_public_size))
			.enter()
			.append("g")
				.attr("class","flow")
				.classed("private",function(d){
					return d.t=="private";
				})
				.classed("public",function(d){
					return d.t=="public";
				})
				.classed("no-stroke",function(d,i){
					//console.log("no-stroke",d.size,scale_y(d.size))
					return scale_y(d.size)<4;
				})
				.attr("transform",function(d){

					var x=(d.t=="private")?box_w:(WIDTH-margins.right-margins.left-box_w);

					var h=scale_y(d.size)/2-1,
						y=scale_y(d.src_outer_offset)+scale_y(d.src_inner_offset)/2+d.src_index*step;
					y+=((d.t=="private")?delta.src.y:delta.src_public.y);

					return "translate("+x+","+y+")";
				})
	/*
	flows.selectAll("path")
		.data(flows_size.concat(flows_public_size))
		.enter()
		.append("path")
	*/
	__flows.append("path")
			.attr("d",function(d){
				var p="";
				if(d.t=="private") {
					p=getSmoothPath(d);
				} else {
					p=getSmoothPathPublic(d);
				}
				return p;

			})
			.attr("class",function(d){
				return d.t;
			})
			.attr("rel",function(d){
				return d.from+","+d.to+":"+d.size;
			})
			.style("fill",function(d){
				return scale_color[d.t](d.flow);
				return d.t=="private"?scale_color(d.size):scale_color2(d.size)
			})
			
	
	__flows.append("path")
			.attr("class","border top")
			.attr("d",function(d){
				var p="";
				if(d.t=="private") {
					p=getSmoothPath(d,"top");
				} else {
					p=getSmoothPathPublic(d,"top");
				}
				return p;

			})
			.classed("no-stroke",function(d,i){
				return scale_y(d.size)<2;
			})
			.style("stroke",function(d){
				if(scale_y(d.size)<2) {
					//????????????
					scale_color[d.t](d.flow);
					//d.t=="private"?scale_color(d.size):scale_color2(d.size)	
					//return "#333";//d.t=="private"?scale_color(d.size):scale_color2(d.size)	
				}
			})
	
	__flows.append("path")
			.attr("class","border bottom")
			.attr("d",function(d){
				var p="";
				if(d.t=="private") {
					p=getSmoothPath(d,"bottom");
				} else {
					p=getSmoothPathPublic(d,"bottom");
				}
				return p;
			})
			.classed("no-stroke",function(d,i){
				return scale_y(d.size)<2;
			})
	

	//src_groups
	//ux_layer.main.selectAll(".ux-src")
	ux_layer.src_groups
			.on("click",function(d){
				svg.classed("interacting",true).classed("clicked",!svg.classed("clicked"));
			})
			.on("mouseover",function(d){
				if(svg.classed("clicked"))
					return;
				svg.classed("interacting",true)

				flows
					.selectAll("path")
						.classed("highlight",function(f){
							return f.from==d.key;
						});

				ux_layer.src_groups
					.filter(function(src){
						return src.key==d.key;
					})
					.classed("highlight",true)


				//d3.select(this)
				src_groups
					.filter(function(src){
						return src.key==d.key;
					})
					.classed("highlight",true)
					.classed("text-visible",true)
						

				dst_groups
					.filter(function(l){
						return l.values.flows.filter(function(f){
							return f.from==d.key;
						}).length>0;
					})
					.classed("highlight",true)
					.classed("text-visible",function(d){
						return scale_y(d.values.total)+step*2>12;
					});

				//console.log("MOUSE OVER",d);

				dst_sub_groups
					.filter(function(sub_d){
						return sub_d.from==d.key;
					})
					.classed("highlight",true)

				src_sub_groups
					.filter(function(sub_d){
						return sub_d.from==d.key;
					})
					.classed("highlight",true)
								
			})
			.on("mouseout",function(d){
				if(svg.classed("clicked"))
					return;

				svg.classed("interacting",false)

				flows
					.selectAll("path.highlight")
						.classed("highlight",false);
				
				
				src_groups.classed("highlight",false).classed("text-visible",false)
				ux_layer.src_groups.classed("highlight",false).classed("text-visible",false)
				dst_groups.classed("highlight",false).classed("text-visible",false);
				ux_layer.dst_groups.classed("highlight",false).classed("text-visible",false);

				dst_sub_groups.classed("highlight",false)
				src_sub_groups.classed("highlight",false)	
			})
	
	//src_public_groups
	//ux_layer.main.selectAll(".ux-src_public")
	ux_layer.src_public_groups
			.on("click",function(d){
				svg.classed("interacting",true).classed("clicked",!svg.classed("clicked"));
			})
			.on("mouseover",function(d){
				if(svg.classed("clicked"))
					return;
				svg.classed("interacting",true)

				flows
					.selectAll("path")
						.classed("highlight",function(f){
							return f.from==d.key;
						});


				//d3.select(this)
				src_public_groups
					.filter(function(src){
						return src.key==d.key;
					})
					.classed("highlight",true)
					.classed("text-visible",true)
						
				ux_layer.src_public_groups
					.filter(function(src){
						return src.key==d.key;
					})
					.classed("highlight",true)	

				dst_groups
					.filter(function(l){
						return l.values.flows.filter(function(f){
							return f.from==d.key;
						}).length>0;
					})
					.classed("highlight",true)
					.classed("text-visible",function(d){
						return scale_y(d.values.total)+step*2>12;
					});

				dst_sub_groups
					.filter(function(sub_d){
						return sub_d.from==d.key;
					})
					.classed("highlight",true)

				src_public_sub_groups
					.filter(function(sub_d){
						return sub_d.from==d.key;
					})
					.classed("highlight",true)

								
			})
			.on("mouseout",function(d){
				if(svg.classed("clicked"))
					return;

				svg.classed("interacting",false)

				flows
					.selectAll("path.highlight")
						.classed("highlight",false);
				
				
				src_public_groups.classed("highlight",false).classed("text-visible",false)
				ux_layer.src_public_groups.classed("highlight",false).classed("text-visible",false)

				dst_groups.classed("highlight",false).classed("text-visible",false);
				ux_layer.dst_groups.classed("highlight",false).classed("text-visible",false);

				dst_sub_groups.classed("highlight",false)
				src_public_sub_groups.classed("highlight",false)
			})
	
	
	
	//dst_groups
	//ux_layer.main.selectAll(".ux-dst")
	ux_layer.dst_groups
			.on("click",function(d){
				svg.classed("interacting",true).classed("clicked",!svg.classed("clicked"));
				expandNodes(d);
			})
			.on("mouseover",function(d){
				if(svg.classed("clicked"))
					return;

				svg.classed("interacting",true)

				flows
					.selectAll("path")
						.classed("highlight",function(f){
							return f.to==d.key;
						});

				//d3.select(this)
				ux_layer.dst_groups
					.filter(function(src){
						return src.key==d.key;
					})
					.classed("highlight",true).classed("text-visible",true)

				dst_groups
					.filter(function(src){
						return src.key==d.key;
					})
					.classed("highlight",true).classed("text-visible",true)

				src_groups
					.filter(function(l){
						return l.values.flows.filter(function(f){
							return f.to==d.key;
						}).length>0;
					})
					.classed("highlight",true)
					.classed("text-visible",function(d){
						return scale_y(d.values.total)+step*2>12;
					})

				src_public_groups
					.filter(function(l){
						return l.values.flows.filter(function(f){
							return f.to==d.key;
						}).length>0;
					})
					.classed("highlight",true)
					.classed("text-visible",function(d){
						return scale_y(d.values.total)+step*2>12;
					})

				ux_layer.src_groups
					.filter(function(l){
						return l.values.flows.filter(function(f){
							return f.to==d.key;
						}).length>0;
					})
					.classed("highlight",true)
					.classed("text-visible",function(d){
						return scale_y(d.values.total)+step*2>12;
					})

				ux_layer.src_public_groups
					.filter(function(l){
						return l.values.flows.filter(function(f){
							return f.to==d.key;
						}).length>0;
					})
					.classed("highlight",true)
					.classed("text-visible",function(d){
						return scale_y(d.values.total)+step*2>12;
					})

				dst_sub_groups
					.filter(function(sub_d){
						return sub_d.to==d.key;
					})
					.classed("highlight",true)

				src_sub_groups
					.filter(function(sub_d){
						return sub_d.to==d.key;
					})
					.classed("highlight",true)

				src_public_sub_groups
					.filter(function(sub_d){
						return sub_d.to==d.key;
					})
					.classed("highlight",true)
				
			})
			.on("mouseout",function(d){
				if(svg.classed("clicked"))
					return;

				svg.classed("interacting",false)

				flows
					.selectAll("path.highlight")
						.classed("highlight",false)
				
				//d3.select(this)
				dst_groups.classed("highlight",false).classed("text-visible",false)
				ux_layer.dst_groups.classed("highlight",false).classed("text-visible",false)
				
				src_groups.classed("highlight",false).classed("text-visible",false)
				src_public_groups.classed("highlight",false).classed("text-visible",false)

				ux_layer.src_groups.classed("highlight",false).classed("text-visible",false)
				ux_layer.src_public_groups.classed("highlight",false).classed("text-visible",false)

				dst_sub_groups.classed("highlight",false)

				src_public_sub_groups.classed("highlight",false)
				src_sub_groups.classed("highlight",false)

			})

	
	function generateLinearGradient(svg,gradient_name,stop0,stop100) {
		var gradient = svg.append("svg:defs")
						  .append("svg:linearGradient")
						    .attr("id", gradient_name)
						    .attr("x1", "0%")
						    .attr("y1", "0%")
						    .attr("x2", "100%")
						    .attr("y2", "0%")
						    .attr("spreadMethod", "pad");

		gradient.append("svg:stop")
		    .attr("offset", "0%")
		    .attr("stop-color", stop0)
		    .attr("stop-opacity", 1);

		gradient.append("svg:stop")
		    .attr("offset", "100%")
		    .attr("stop-color", stop100)
		    .attr("stop-opacity", 1);

		return gradient;
	}
}