function BubbleFlowChart(data) {

	var svg=d3.select("#svg")
				.append("svg")
				.attr("width",WIDTH)
				.attr("height",HEIGHT)
				.append("g")
					.attr("transform","translate("+margins.left+","+margins.top+")");

	HEIGHT=HEIGHT-margins.top-margins.bottom;

	var self=this;

	var step=0;

	this.src_size=[];
	this.dst_size=[];
	this.src_public_size=[];
	
	this.flows_size=[];
	this.flows_public_size=[];

	var max={},
		extent={};

	var delta={};

	var funding_groups={
		src:{},
		src_public:{},
		dst:{}
	}

	this.loadCSV=function(year) {
		d3.csv("data/pubblico_privato_"+year+".csv",function(d){
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

			updateYear(year);
			update(data);

			
		});
	}

	function update(__data,max_r) {

		console.log("updating with new data",__data)

		updateData(__data);
		updateFlowsData();

		max=getImportantValues(__data)


		console.log("MAAAAAAAAAAAAAAAX",max)

		extent=getExtents();

		updateScales(max_r);

		delta=getDelta();

		console.log("UPDATED SRC_SIZE",self.src_size.length)
		console.log("UPDATED SRC_PUBLIC_SIZE",self.src_public_size.length)
		console.log("UPDATED DST_SIZE",self.dst_size.length)

		funding_groups.src=updateCircleGroups(src,src_groups,src_sub_groups,self.src_size,"src");
		funding_groups.dst=updateCircleGroups(dst,dst_groups,dst_sub_groups,self.dst_size,"dst");
		funding_groups.src_public=updateCircleGroups(src_public,src_public_groups,src_public_sub_groups,self.src_public_size,"src_public");

		updateFlows();

		updateAllUXLayers(self.src_size,self.src_public_size,self.dst_size);
	}

	function updateData(data){

		function getNestedValues(t,direction,data) {
			if(!data.length>0)
				return [];

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
		//src_size=[];
		self.src_size=getNestedValues("private","from",data.filter(function(d){
						return d.t=="private";
					}));

		//PUBLIC
		//src_public_size=[];
		self.src_public_size=getNestedValues("public","from",data.filter(function(d){
						return d.t=="public";
					}));

		//DESTINATION
		//dst_size=[];
		self.dst_size=getNestedValues(null,"to",data);

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

				var tmp_dst=self.dst_size.filter(function(t,i){
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
	
	
	
	function updateFlowsData() {
		self.flows_size=updateFlow(self.src_size,"private");
		self.flows_public_size=updateFlow(self.src_public_size,"public");
		
		console.log("FLOWS",self.flows_size);
		console.log("FLOWS PUBLIC",self.flows_public_size);
	}
	
	updateFlowsData();
	

	function getImportantValues(data) {

		return {
			src:d3.sum(self.src_size,function(d){
				return d.values["total"];
			}),
			src_public:d3.sum(self.src_public_size,function(d){
				return d.values["total"];
			}),
			dst:d3.sum(self.dst_size,function(d){
				return d.values["total"];
			}),
			y_src:d3.sum(self.src_size,function(d){
				//console.log(d.values["offset"])
				return d.values["offset"];
			}),
			y_dst:d3.sum(self.dst_size,function(d){
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

	max=getImportantValues(data);

	console.log("ALL SUMS",max);

	function getExtents() {
		return {
			src:d3.extent(self.src_size,function(d){
				return d.values["total"];
			}),
			src_public:d3.extent(self.src_public_size,function(d){
				return d.values["total"];
			}),
			dst:d3.extent(self.dst_size,function(d){
				return d.values["total"];
			}),
			flows:d3.extent(self.flows_size.concat(self.flows_public_size),function(d){
				return d.size;
			}),
			flows_private:d3.extent(self.flows_size,function(d){
				return d.size;
			}),
			flows_public:d3.extent(self.flows_public_size,function(d){
				return d.size;
			})
		};
	}

	extent=getExtents();

	//console.log("extent",extent,[Math.min(extent.src[0],extent.dst[0]),Math.min(extent.src[0],extent.dst[0])])
	console.log("!!!!!!!!",extent,[Math.min(extent.src[0],extent.dst[0]),Math.max(extent.src[0],extent.dst[0])])
	console.log(self.src_size)

	//var scale_h=d3.scale.sqrt().domain([0,Math.max(max.src,max.dst)]).range([0,HEIGHT-dst_size.length*step])
	var scale_y=d3.scale.linear().domain([extent.flows[0],max.total]).range([0,HEIGHT-d3.max([self.src_size.length,self.src_public_size.length,self.dst_size.length])*step]);

	//var max_r=HEIGHT-d3.max([src_size.length,src_public_size.length,dst_size.length])*step;

	var radius={
		min:scale_y(d3.min([extent.src[0],extent.src_public[0],extent.dst[0]])),
		max:scale_y(d3.max([extent.src[1],extent.src_public[1],extent.dst[1]]))
	}

	var min_r_domain=d3.min([extent.src[0],extent.src_public[0],extent.dst[0]]);

	var scale_r2=d3.scale.sqrt().domain([min_r_domain*1,max.total]).range([0,radius.max/2]);//max_r*max_r*Math.PI])
	
	var scale_r=function(d){
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
				y:(HEIGHT - d3.sum(self.src_size,function(d){
								return scale_r(d.values["total"])*2;
							}))/2
			},
			src_public:{
					x:(WIDTH-margins.right-margins.left-box_w),
					y:(HEIGHT-d3.sum(self.src_public_size,function(d){
								return scale_r(d.values["total"])*2;
							}))/2
			},
			dst:{
				x:((WIDTH-margins.right-margins.left)/2-box_w/2),
				y:(HEIGHT-d3.sum(self.dst_size,function(d){
								return scale_r(d.values["total"])*2;
							}))/2
			}
		}
	}
	

	function updateScales(max_r) {

		//var scale_h=d3.scale.sqrt().domain([0,Math.max(max.src,max.dst)]).range([0,HEIGHT-dst_size.length*step])




		scale_y.domain([0,max.total]); //extent.flows[0]

		//if(scale_y(extent.flows[1])==HEIGHT)
		//alert(scale_y(extent.flows[1])*2.6+" "+HEIGHT)

		if(scale_y(extent.flows[1])*2.6 < HEIGHT) {
			scale_y.range([0,HEIGHT-self.dst_size.length*step])
		} else {
			scale_y.range([10,200])
		}

		//scale_y.range([0,Math.min(HEIGHT-self.dst_size.length*step,500)])
		//scale_y.range([0,max_r || HEIGHT-self.dst_size.length*step])

		//var max_r=HEIGHT-d3.max([src_size.length,src_public_size.length,dst_size.length])*step;
		/*
		var radius={
			min:scale_y(d3.min([extent.src[0],extent.src_public[0],extent.dst[0]])),
			max:scale_y(d3.max([extent.src[1],extent.src_public[1],extent.dst[1]]))
		}

		var min_r_domain=d3.min([extent.src[0],extent.src_public[0],extent.dst[0]]);

		scale_r2.domain([min_r_domain*1,max.total]);

		scale_r2.range([0,radius.max/2]);

		console.log("TESTING:","scale_y(1000000)",scale_y(1000000))
		*/
		scale_r=function(d){ return scale_y(d)/2};

	}

	updateScales(); //useless call, just to test
	delta=getDelta();

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

	

	funding_groups.src=updateCircleGroups(src,src_groups,src_sub_groups,self.src_size,"src");

	var dst=svg.append("g")
				.attr("id","dst")
				.attr("transform","translate("+delta.dst.x+","+delta.dst.y+")");

	var dst_groups,
		dst_sub_groups;
	
	funding_groups.dst=updateCircleGroups(dst,dst_groups,dst_sub_groups,self.dst_size,"dst");
	
	var src_public=svg.append("g")
				.attr("id","src_public")
				.attr("transform","translate("+delta.src_public.x+","+delta.src_public.y+")");

	var src_public_groups,
		src_public_sub_groups;

	funding_groups.src_public=updateCircleGroups(src_public,src_public_groups,src_public_sub_groups,self.src_public_size,"src_public");

	var flows=svg.append("g")
				.attr("id","flows_v")
				.attr("transform","translate("+0+","+0+")")

	var ux_layer={
			main:svg.append("g")
					.attr("id","ux")
	}
	ux_layer.src={
				node:ux_layer.main.append("g").attr("id","uxSrc"),
				"class":"ux-src",
				x:-margins.left,
				width:margins.left + (WIDTH-margins.right-margins.left-box_w)/4,
				delta:"src"
			};
	ux_layer.src_public={
				node:ux_layer.main.append("g").attr("id","uxSrc_public"),
				"class":"ux-src_public",
				x: -((WIDTH-margins.right-margins.left-box_w)/4),
				width:(margins.right + (WIDTH-margins.right-margins.left-box_w)/4),
				delta:"src_public"
			};
	ux_layer.dst={
				node:ux_layer.main.append("g").attr("id","uxDst"),
				"class":"ux-dst",
				x: -(WIDTH-margins.right-margins.left-box_w)/4,
				width:(WIDTH-margins.right-margins.left-box_w)/2,
				delta:"dst"
			};

	function updateAllUXLayers(src_size,src_public_size,dst_size) {

		ux_layer.src.ux=updateUXLayer(
			ux_layer.src,
			src_size,
			funding_groups.src,
			[funding_groups.dst],
			"from",
			"end",
			function(d){
				
				flows
					.selectAll("path")
						.classed("highlight",function(f){
							return f.from==d.key;
						});

				ux_layer.dst.ux
					.filter(function(l){
						return l.values.flows.filter(function(f){
							return f.from==d.key;
						}).length>0;
					})
					.classed("highlight",true)
					.classed("text-visible",function(d){
						return scale_y(d.values.total)+step*2>12;
					});
			}
		);

		ux_layer.src_public.ux=updateUXLayer(
			ux_layer.src_public,
			src_public_size,
			funding_groups.src_public,
			[funding_groups.dst],
			"from",
			"start",
			function(d){

				flows
					.selectAll("path")
						.classed("highlight",function(f){
							return f.from==d.key;
						});

				ux_layer.dst.ux
					.filter(function(l){
						return l.values.flows.filter(function(f){
							return f.from==d.key;
						}).length>0;
					})
					.classed("highlight",true)
					.classed("text-visible",function(d){
						return scale_y(d.values.total)+step*2>12;
					});
			}
		);

		ux_layer.dst.ux=updateUXLayer(
			ux_layer.dst,
			dst_size,
			funding_groups.dst,
			[funding_groups.src,funding_groups.src_public],
			"to",
			"middle",
			function(d){

				flows
					.selectAll("path")
						.classed("highlight",function(f){
							return f.to==d.key;
						});

				[ux_layer.src.ux,ux_layer.src_public.ux].forEach(function(ux){
					ux
						.filter(function(l){
							return l.values.flows.filter(function(f){
								return f.to==d.key;
							}).length>0;
						})
						.classed("highlight",true)
						.classed("text-visible",function(d){
							return scale_y(d.values.total)+step*2>12;
						});
				});
			}
		);

	}	

	function updateUXLayer(layer,sizes,from,to,direction,align,over_callback,out_callback) {
		var inc=0;
		
		//console.log("UX DATA",from);

		layer.node.attr("transform","translate("+delta[layer.delta].x+","+delta[layer.delta].y+")")

		var groups=layer.node.selectAll("g.ux-src")
				.data(sizes,function(d){
					return d.key;
				});

		groups.exit().remove();

		var new_groups=groups.enter()
				.append("g")
					.attr("rel",function(d){
						return d.key;
					})
					.attr("class","ux-src");		

		new_groups.append("rect")
					.attr("x",function(d,i){
						return layer.x;
						//return -margins.left;
					})
					.attr("y",0)
					.attr("width",function(d){
						return layer.width;
						//return margins.left + (WIDTH-margins.right-margins.left-box_w)/4;
					})
					.style("fill-opacity",0.1)
		new_groups.append("text")
						.attr("class","label")
						.attr("dy","0.25em")
						.style("text-anchor",align)
						.text(function(d){
							return d.key;
						});

		groups.attr("transform",function(d){
						var x=0,
							new_y=(scale_r(d.values.total))+inc;
							inc=inc+scale_r(d.values.total)*2;
							y=new_y-scale_r(d.values.total);
						return "translate("+x+","+y+")";
					})
					.select("rect")
						.attr("height",function(d){
							return scale_r(d.values.total)*2;
						});

		groups.select("text")
					.classed("permanent",function(d){
						return scale_r(d.values.total)*2+step*2>12;
					})
					.attr("x",function(d,i){
						if (align=="middle")
							return 0;
						if (align=="start")
							return scale_r(d.values.total)	
						return -scale_r(d.values.total)
					})
					.attr("y",function(d,i){
						return scale_r(d.values.total);
					})

		//ux_layer.src_group.selectAll("g.ux-src")
		groups
				.on("click",function(d){
					
					if(!svg.classed("clicked")) {
							svg.classed("interacting",true).classed("clicked",true);

							update(data.filter(function(t){
								return d.key==t.to;
							}),250)
					} else {
						svg.classed("interacting",false).classed("clicked",false);
						update(data);
					}
					
					
					
					

				})
				.on("mouseover",function(d){

					if(svg.classed("clicked"))
						return;
					svg.classed("interacting",true)

					from.main
						.filter(function(src){
							return src.key==d.key;
						})
						.classed("highlight",true)

					from.sub
						.filter(function(sub_d){
							//console.log(sub_d.to,"==",d.key)
							return sub_d[direction]==d.key;
						})
						.classed("highlight",true)

					groups
						.filter(function(src){
							return src.key==d.key;
						})
						.classed("highlight",true)

					to.forEach(function(t_group){

						//console.log(t_group)

						t_group.main
							.filter(function(l){
								return l.values.flows.filter(function(f){
									return f[direction]==d.key;
								}).length>0;
							})
							.classed("highlight",true)
							.classed("text-visible",function(d){
								return scale_y(d.values.total)+step*2>12;
							});

						t_group.sub
							.filter(function(sub_d){
								//console.log(d.key,"==",sub_d.from)
								return sub_d[direction]==d.key;
							})
							.classed("highlight",true)

					})

					if(over_callback)
						over_callback(d);
					/*
					
					*/		
				})
				.on("mouseout",function(d){
					if(svg.classed("clicked"))
						return;

					svg
						.classed("interacting",false)
						.selectAll(".highlight")
							.classed("highlight",false);

					if(out_callback)
						out_callback(d);
				})

		return groups;
	}
	updateAllUXLayers(self.src_size,self.src_public_size,self.dst_size);
	

	function updateYear(year){
		var txt=svg.selectAll("text.year")
				.data([year])

		txt
			.enter()
				.append("text")
				.classed("year",true)
				.attr("transform","translate("+(-margins.left+WIDTH/2)+",0)")
				.attr("dy","-0.5em")

		txt.text(year)
	}

	updateYear(2013)

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

	function updateCircleGroups(node,groups,sub_groups,data,delta_group,filter) {
		var inc=0;
		
		var groups={};

		node.transition().duration(1000).attr("transform","translate("+delta[delta_group].x+","+delta[delta_group].y+")")

		
		groups.main=node.selectAll("g.fund").data(data.filter(
				filter || function(d){return true;}
			),
			function(d) {
				return d.key;
			});
		
		console.log("exit",groups.main.exit())
		groups.main.exit().transition().duration(1000).style("opacity","1e-6").remove();

		var inc=0;
		var new_groups=groups.main
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
			//.attr("class","center")
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

		groups.sub=groups.main
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
									}).sort(function(a,b){
										return b.flow - a.flow;
									})
								},function(d){
									return d.from+"-"+d.to;
								});

		groups.sub.exit().transition().style("opacity","1e-6").remove();

		groups.sub.enter()
				.append("circle")
					.attr("class",function(d){
						return "sub "+d.t;
					})
					.attr("rel",function(d){
						return d.from+"-"+d.to+": "+d.radius+"("+scale_y(d.flow)+")";
						//return d.radius+": "+scale_r(d.radius)+" flow:"+d.flow;
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
					/*
					.classed("no-stroke",function(d,i){
						return 1;
						return scale_r(d.radius)<3;// && i>0;
					})
					.style("fill",function(d){
						return scale_color[d.t](d.flow);
					})
					*/
					
					

		var inc=0;
		groups.main
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

		groups.sub
				.order()
				.classed("no-stroke",function(d,i){
					return scale_y(d.flow)<3;// && i>0;
				})
				.style("fill",function(d){
					return scale_color[d.t](d.flow);
				})
				.transition()
				.duration(1000)
				//.style("opacity","1")
				.attr("r",function(d,i){
					var r=scale_r(d.radius);
					if (r<0.5)
						return 0.25;
					return r;
				})

		return groups;
	}

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

		if(d.from=="italia futura romagna - faenza") {
			console.log("FAENZA",d)
			console.log(d.src_outer_offset,scale_y(d.src_outer_offset))
		}

		y1=delta.dst.y-delta.src.y;//scale_y(d.dst_inner_offset)/2
		
		y0+=scale_y(d.src_outer_offset);// + scale_y(d.src_inner_offset)/2

		y1+= scale_y(d.dst_outer_offset) + scale_y(d.dst_inner_offset)/2


		//y1-= delta.src.y;
		
		/*
		// flows are under the center
		y1-=scale_y(d.dst_inner_offset)/2;
		y1+=scale_y(d.total);
		y1-=scale_y(d.size)/2;
		y1-=scale_y(d.dst_inner_offset)/2;
		*/
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

		

		y1=delta.dst.y-delta.src_public.y;//scale_y(d.dst_inner_offset)/2
		
		y0+= scale_y(d.src_outer_offset) + scale_y(d.src_inner_offset)/2

		y1+= scale_y(d.dst_outer_offset) + scale_y(d.dst_inner_offset)/2

		//alert((d.src_outer_offset) + (d.src_inner_offset))

		//y1-= delta.src_public.y;
		
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
	
	function updateFlows() {
		var __flows=flows.selectAll("g.flow")
				.data(self.flows_size.concat(self.flows_public_size),function(d){
					//console.log(d)
					return d.from+"-"+d.to;
				});


		var new_flows=__flows.enter()
				.append("g")
					.attr("class","flow")
					.classed("private",function(d){
						return d.t=="private";
					})
					.classed("public",function(d){
						return d.t=="public";
					})
					
		__flows.exit().remove();

		__flows.attr("transform",function(d){

						var x=(d.t=="private")?box_w:(WIDTH-margins.right-margins.left-box_w);

						var h=scale_y(d.size)/2,
							y=scale_y(d.src_outer_offset)+scale_y(d.src_inner_offset)/2+d.src_index*step;

						y=0;//scale_y(d.src_inner_offset);

						y+=((d.t=="private")?delta.src.y:delta.src_public.y);
						
						return "translate("+x+","+y+")";
					})
					.classed("no-stroke",function(d,i){
						//console.log("no-stroke",d.size,scale_y(d.size))
						return scale_y(d.size)<4;
					});

		new_flows.append("path")
					.attr("class",function(d){
						return d.t+" fill";
					})
					.attr("rel",function(d){
						return d.from+","+d.to+":"+d.size;
					})

		__flows.select("path.fill")
				.attr("d",function(d){
					var p="";
					if(d.t=="private") {
						p=getSmoothPath(d);
					} else {
						p=getSmoothPathPublic(d);
					}
					return p;
				})
				.style("fill",function(d){
					//console.log("FILLING",d.t,d.size,scale_color[d.t](d.size))
					return scale_color[d.t](d.size);
					return d.t=="private"?scale_color(d.size):scale_color2(d.size)
				})
				
		/*
		new_flows.append("path")
				.attr("class","border top");

		__flows.select("path.top")
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
		
		new_flows.append("path")
				.attr("class","border bottom")
		
		__flows.select("path.bottom")
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
		*/
	}
	updateFlows();
	
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