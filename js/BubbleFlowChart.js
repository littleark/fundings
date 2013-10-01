function BubbleFlowChart(data) {



	var svg=d3.select("#svg")
				.append("svg")
				.attr("width",WIDTH)
				.attr("height",HEIGHT)
				.append("g")
					.attr("transform","translate("+margins.left+","+margins.top+")");

	var original_height=HEIGHT;

	HEIGHT=HEIGHT-margins.top-margins.bottom;



	var self=this;

	var year=2013;

	var step=0;
	var space=0;

	var open_element=null;

	this.src_size=[];
	this.dst_size=[];
	this.src_public_size=[];
	
	this.flows_size=[];
	this.flows_public_size=[];

	var max={},
		extent={};

	var delta={};

	var animating=false;

	var funding_groups={
		src:{},
		src_public:{},
		dst:{}
	}

	this.isLoading=false;


	this.filter=null;

	var tooltip={
		node:d3.select("#tooltip"),
		title:d3.select("#tooltip").select("h3"),
		money:d3.select("#tooltip").select("h4"),
		mt:d3.select("#tooltip").select("#mt")
	};

	this.loadCSV=function(__year) {

		self.isLoading=true;

		year=__year;
		
		d3.select("#loading")
				.style("display","block")
				.transition()
				.duration(1000)
				.style("opacity",1)
				.each("end",function(){
					d3.csv("data/files/data"+year+".csv",function(d){
							return {
								to:d.Target.toLowerCase(),
								from:d.Source.toLowerCase(),//+(d.Rata||"")+(d.Regione||""),
								rata:d.Rata,
								regione:d.Regione,
								t:d.Pubblico?"public":"private",
								flow:+d.Weight
							}
						},function(error,rows){

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

							delete rows;
							data=[];

							data=aggregated_rows.filter(function(d){
								return d.flow>0;
							});

							backToNormalState();

							if (self.filter) {
								update(data.filter(function(t){
									return self.filter.f(t);
								}));
							} else {
								update(data);
								hideTooltip();
							}
							updateYear(year);

							self.isLoading=false;
						});
				});

		
	}

	function backToNormalState(noupdate){
		if(HEIGHT>original_height) {
			HEIGHT=original_height-margins.top-margins.bottom;
		}
		space=0;
		svg.classed("interacting",false).classed("clicked",false);

		self.filter=null;

		if(!noupdate) {
			update(data);
			updateTooltip(open_element,null,false);
		}
		
		tooltip.node.style("display","none")

		hidePopup(open_element);

		open_element=null;
	}

	function update(__data,keep_scale) {

		d3.select("#loading").style("display","none");


		updateData(__data);

		max=getImportantValues(__data)


		extent=getExtents();

		updateScales();

		delta=getDelta();

		funding_groups.src=updateCircleGroups(src,src_groups,src_sub_groups,self.src_size,"src");
		funding_groups.dst=updateCircleGroups(dst,dst_groups,dst_sub_groups,self.dst_size,"dst");
		funding_groups.src_public=updateCircleGroups(src_public,src_public_groups,src_public_sub_groups,self.src_public_size,"src_public");

		updateFlowsData();
		updateFlows();

		
		updateLegend();

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
								if(!(a.flow-b.flow))
									return a.from < b.from ? -1 : a.from > b.from ? 1 : 0;
								return b.flow - a.flow;
							})
						}	
					})
					.entries(data);

				values.sort(function(a,b){
					if(!(a.values.total-b.values.total))
						return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
					return b.values.total - a.values.total;
				});

				//CALCULATE STACK
				values.reduce(function(prev,cur){
					if(!prev.values.offset) {
						prev.values.offset=0;
					}
					cur.values.offset=prev.values.offset+prev.values.total+cur.values.total;
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

		self.src_size=getNestedValues("private","from",data.filter(function(d){
						return d.t=="private";
					}));

		self.src_public_size=getNestedValues("public","from",data.filter(function(d){
						return d.t=="public";
					}));

		self.dst_size=getNestedValues(null,"to",data);

	}

	updateData(data);


	function updateFlow(data,dst_data,t) {


		var flows=[];

		data.forEach(function(d,i){
		
			d.values.flows.forEach(function(src_d) {
				var flow={
					t:t,
					y0:d.y0,
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

				flow.dst_outer_offset=tmp_dst.values.offset || 0;
				flow.y1=tmp_dst.y0 || 0;
				
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
			if(!(a.size-b.size))
				return a.from < b.from ? -1 : a.from > b.from ? 1 : 0;
			return (b.size - a.size);
		});

	}
	
	
	
	function updateFlowsData() {
		self.flows_size=updateFlow(self.src_size,self.dst_size,"private");
		self.flows_public_size=updateFlow(self.src_public_size,self.dst_size,"public");
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

	function moneyFormat(money,compact,noeuro,nodecimal) {
		var str="";
		if(!money)
			return str;

		if(money<1000000) {
			str=(noeuro?"":"&euro;")+d3.format(",.0f")(money)
		}
		if(money>=1000000)
			str=(noeuro?"":"&euro;")+d3.format(",."+(nodecimal?0:2)+"f")(money/1000000)+(compact?"M":" Milioni")

		return str.replace(".","_").replace(",",".").replace("_",",");
	}

	var scale_y=d3.scale.linear().domain([extent.flows[0],max.total]).range([0,HEIGHT]);

	var radius={
		min:scale_y(d3.min([extent.src[0],extent.src_public[0],extent.dst[0]])),
		max:scale_y(d3.max([extent.src[1],extent.src_public[1],extent.dst[1]]))
	}

	var min_r_domain=d3.min([extent.src[0],extent.src_public[0],extent.dst[0]]);

	var scale_r2=d3.scale.sqrt().domain([min_r_domain*1,max.total]).range([0,radius.max/2]);//max_r*max_r*Math.PI])
	
	var scale_r=function(d){
		var r=Math.floor(scale_y(d)/2);
		return r;
	};

	var scale_color1 = d3.scale.linear()
						    .domain(extent.flows_private)
						    .range(["#23a4db","#23a4db"])
						    .interpolate(d3.interpolateLab);
	var scale_color2 = d3.scale.linear()
						    .domain(extent.flows_public)
						    .range(["#d8232a","#d8232a"])
						    .interpolate(d3.interpolateLab);

	var scale_color={
		"private":scale_color1,
		"public":scale_color2
	};

	
	function getDelta() {

		HEIGHT=original_height-(margins.top+margins.bottom);

		var delta= {
			src:{
				x:0,
				y:(HEIGHT - d3.sum(self.src_size,function(d){
								return scale_r(d.values["total"])*2;
							}))/2 - self.src_size.length*space/2
			},
			src_public:{
					x:(WIDTH-margins.right-margins.left-box_w),
					y:(HEIGHT-d3.sum(self.src_public_size,function(d){
								return scale_r(d.values["total"])*2;
							}))/2 - self.src_public_size.length*space/2
			},
			dst:{
				x:((WIDTH-margins.right-margins.left)/2-box_w/2),
				y:(HEIGHT-d3.sum(self.dst_size,function(d){
								return scale_r(d.values["total"])*2;
							}))/2 - self.dst_size.length*space/2
			}
		}

		if(delta.src.y<0) {
			var diff=Math.abs(delta.src.y);
			HEIGHT = HEIGHT + diff*2 +margins.top+margins.bottom +25*2
			d3.select("#svg svg").attr("height",HEIGHT);
			delta.src.y=0+25;
		} else {
			d3.select("#svg svg").attr("height",original_height);
		}

		return delta;
	}
	

	function updateScales(detail) {
	
		scale_y.domain([0,max.total]); //extent.flows[0]

		
		scale_y.range([0,HEIGHT]);
		

		var max_y=scale_y(d3.max([extent.dst[1],extent.src[1],extent.src_public[1]]));

		if(max_y>200) {
			var k=200/max_y;
			scale_y.range([0,(HEIGHT)*k])
		}
		

		scale_r=function(d){ return (scale_y(d)/2)};

	}

	updateScales();
	delta=getDelta();

	svg.append("path")
			.attr("d",function(){
				var x=((WIDTH-margins.right-margins.left)/4-box_w/2);
				return "M"+(x-40)+","+(HEIGHT/2-40)+"l80,40l-80,40z";
			})
			.style({
				"stroke":"none",
				"fill":"#000",
				"fill-opacity":0.05
			});

	svg.append("path")
			.attr("d",function(){
				var x=((WIDTH-margins.right-margins.left)*3/4);
				return "M"+(x+40)+","+(HEIGHT/2-40)+"l-80,40l80,40z";
			})
			.style({
				"stroke":"none",
				"fill":"#000",
				"fill-opacity":0.05
			});

			
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

	updateFlowsData();

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
		animating=true;
		[ux_layer.src].forEach(function(d){
			d.node.style("opacity",1e-6);
		});

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
						return scale_y(d.values.total)>12;
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
						return scale_y(d.values.total)>12;
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
							return scale_y(d.values.total)>12;
						});
				});
			}
		);

		[ux_layer.src].forEach(function(d){
			d.node.transition().duration(1000).delay(1000).style("opacity",1);
		});

		setTimeout(function(){
			animating=false;
		},750);

	}	

	function updateUXLayer(layer,sizes,from,to,direction,align,over_callback,out_callback) {
		var inc=0;

		layer.node.attr("transform","translate("+delta[layer.delta].x+","+delta[layer.delta].y+")")

		var groups=layer.node.selectAll("g.ux-src")
				.data(sizes,function(d){
					return d.key;
				});

		groups.exit().remove();	

		var clicked=svg.classed("clicked");

		var new_groups=groups.enter()
				.append("g")
					.attr("rel",function(d){
						return d.key;
					})
					.attr("class","ux-src")
					.classed("highlight",clicked);


		

		new_groups.append("text")
						.attr("class","label")
						.attr("dy","0.25em")
						.attr("title",function(d){
							return d.key;
						})
						.style("text-anchor",align)
						.text(function(d){
							var ellipsis="";
							if(d.key.length>25)
								ellipsis="...";
							return d.key.slice(0,25)+ellipsis;
						});

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
					.style("fill-opacity",0);

		groups
				.attr("transform",function(d){
						var x=0,
							new_y=(scale_r(d.values.total))+inc;
							inc=inc+scale_r(d.values.total)*2+space;
							y=new_y-scale_r(d.values.total);

						d.ux_y=y;

						return "translate("+x+","+(y-space/2)+")";
				})
				.select("rect")
					.attr("height",function(d){
						return scale_r(d.values.total)*2+space;
					});

		groups.select("text")
					.classed("permanent",function(d){
						return scale_r(d.values.total)*2>12;
					})
					.attr("x",function(d,i){
						if (align=="middle")
							return 0;
						if (align=="start")
							return scale_r(d.values.total)	
						return -scale_r(d.values.total)
					})
					.attr("y",function(d,i){
						return scale_r(d.values.total)+space/2;
					})

		var tooltip_to=null;

		tooltip.node.select("a#close").on("click",function(d){
			d3.event.preventDefault();


			backToNormalState();

			
		})

		

		groups
				.on("click",function(d){
					if(animating) {
						return;
					}
					if(!svg.classed("clicked")) {
							space=10;

							open_element=d;

							if(d.values.flows.length<30) {
								space=20;
							}

							svg.classed("interacting",true).classed("clicked",true);

							if(!d.values.t) {

								self.filter={
									key:d.key,
									f:function(t){
										return self.filter.key==t.to;
									}
								};

								update(data.filter(function(t){
									return d.key==t.to;
								}),true)
							};
							if(d.values.t=="private") {

								self.filter={
									t:d.values.t,
									key:d.key,
									f:function(t){
										return t.t=="private" && self.filter.key==t.from;
									}
								};

								update(data.filter(function(t){
									return t.t=="private" && d.key==t.from;
								}),true)
							}
							if(d.values.t=="public") {

								self.filter={
									t:d.values.t,
									key:d.key,
									f:function(t){
										return t.t=="public" && d.key==t.from;
									}
								};

								update(data.filter(function(t){
									return t.t=="public" && d.key==t.from;
								}),true)
							}
							
							updateTooltip(d,layer,true);

					} else {
						backToNormalState();
					}
					
					
					
					

				})
				.on("mouseover",function(d){

					if(animating)
						return;

					if(svg.classed("clicked")) {
						showPopup(d);
						return;
					}
					svg.classed("interacting",true);

					var x=margins.left;
					var dy=delta["dst"].y;
					var smt_txt="ricevuti";

					if(d.values.t=="private") {
						dy=delta["src"].y;
						x+=(delta["src"].x-66);
						smt_txt="erogati"
					}
					if(d.values.t=="public") {
						dy=delta["src_public"].y;
						x+=(delta["src_public"].x-66);
						smt_txt="erogati"
					}
					if(!d.values.t){
						x+=delta["dst"].x-66;
					}


					var style={
								display:"block",
								left:x+"px",
								top:(d.ux_y+dy-105)+"px"
							};
					tooltip.node
						.style(style)
					
					tooltip.title
							.text(function(){
								return d.key;
							});

					tooltip.mt
							.text(function(){
								if(d.values.t) {
									return "erogati";
								}
								
								if(d.key=="movimento 5 stelle*") {
									return "fondi assegnati e rifiutati"
								}
								return "ricevuti";
							})
					tooltip.money
							.html(function(){
								return moneyFormat(d.values.total)
							})

					
					from.sub
						.filter(function(sub_d){
							return sub_d[direction]==d.key;
						})
						.classed("highlight",true)
					
					groups
						.filter(function(src){
							return src.key==d.key;
						})
						.classed("highlight",true)

					to.forEach(function(t_group){

						t_group.sub
							.filter(function(sub_d){
								return sub_d[direction]==d.key;
							})
							.classed("highlight",true)
						
					})
					
					if(over_callback)
						over_callback(d);
					
				})
				.on("mouseout",function(d){

					if(animating)
						return;

					if(svg.classed("clicked")) {

						return;
					}

					
					tooltip.node
						.style({
							display:"none"
						});
					


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
	
	var legend=svg.append("g")
					.attr("id","legend")
					.attr("transform","translate("+(WIDTH-margins.right-120)+","+(HEIGHT-100)+")")


	function getArcPath(r) {

		//var r=scale_r(val);

		var p="";

		p+="M"+0+","+r;

		p+="A"+r+","+r; //radii

		p+=",0"	//x-axis-rotation

		p+=",0" //large-arc-flag

		p+=","+1//sweep-flag

		p+=","+r+","+0;

		p+="L"+r+","+r+"Z";
		return p;

	}

	function updateLegend(){
		var w=60,
			h=100;

		legend.attr("transform","translate("+(WIDTH-margins.right-110)+","+(HEIGHT-100)+")");

		var ticks=scale_y.ticks(20)
				.filter(function(d,i){
					return i%2 && d>0  && scale_r(d)<80;
				})
				.sort(function(a,b){
					return b-a;
				})
				.map(function(d){
					return scale_r(d);
				});

		//var ticks=[60,40,20];



		var l=legend.selectAll("path")
				.data(ticks);

		l.exit().remove();

		l.enter()
			.append("path");
		
		l
			.attr("d",function(d){
				return getArcPath(d/1);
			})
			.style("fill",function(d,i){
				if(i%2)
					return "#ddd";
				return "#eee";
			})
			.attr("transform",function(r){
				//var r=scale_r(d/1);
				return "translate("+(w-r)+","+(h-r)+")";
			})
		
		l=legend.selectAll("text")
				.data(ticks);

		l.exit().remove();

		l.enter()
			.append("text");
					
		l
			.attr("x",function(r){
				return w+4;
			})
			.attr("y",function(r){
				return h-r;
			})
			.attr("dy","0.21em")
			.style("text-anchor","start")
			.text(function(d){
				return "€"+moneyFormat(scale_y.invert(d*2),1,1,true);
			})

	}
	updateLegend();

	function hideTooltip(){

		var style={
			display:"none",
			height:"auto",
			width:120+"px"
		}

		tooltip.node
			.classed("expanded",false)
			.classed("dst",false)
			.classed("private",false)
			.classed("public",false)
			.style(style)
	}
	function updateTooltip(d,layer,large){

		if(!d)
			return;

		var x=margins.left;
		var dy=delta["dst"].y;
		var smt_txt="ricevuti";

		var w=(large?300:120),
			h=large?230:40;

		if(large) {
			w=((!d.values.t)?w:180);
			h=((!d.values.t)?h:200);
		}
		

		if(d.values.t=="private") {
			dy=delta["src"].y;
			x+=(delta["src"].x-w/2);
			smt_txt="erogati"
		}
		if(d.values.t=="public") {
			dy=delta["src_public"].y;
			x+=(delta["src_public"].x-w/2);
			smt_txt="erogati"
		}
		if(!d.values.t){
			x+=delta["dst"].x-w/2;
		}


		var style={
					display:"block",
					left:x+"px",
					top:(dy - h)+"px",
					height:large?(h+"px"):"auto",
					width:w+"px"
				};


		tooltip.title
			//.select("h3")
				.text(function(){
					return d.key;
				})
		tooltip.mt
			//.select("#mt")
				.text(function(){
					if(d.values.t) {
						return "erogati";
					}
					if(d.key=="movimento 5 stelle*") {
						return "fondi assegnati e rifiutati"
					}
					return "ricevuti";
				})
		tooltip.money
			//.select("h4")
				.html(function(){
					return moneyFormat(d.values.total)
				})

		tooltip.node
			.classed("expanded",large)
			.classed("dst",!d.values.t)
			.classed("private",d.values.t=="private")
			.classed("public",d.values.t=="public")
			.style(style)

		tooltip
			.node
			.select("#ttContents")

		var fundings={
			"private":0,
			"public":0,
			"private_list":[],
			"public_list":[]
		};
		d.values.flows.forEach(function(f){
			fundings[f.t]+=f.flow;
			if(fundings[f.t+"_list"].length<5) {
				fundings[f.t+"_list"].push({
					name:f[!d.values.t?"from":"to"],
					fund:f.flow
				});
			}
		});

		var types=["private","public"];
		
		types.forEach(function(t){

			var perc=Math.round(fundings[t]/d.values.total*100*100)/100;
			tooltip.node.select(".tt-"+t+" h5 b").text(perc+"%")

			var list=tooltip.node.select(".tt-"+t+" ol")
					.selectAll("li")
					.data(fundings[t+"_list"]);

			list.exit().remove();

			list.enter()
					.append("li");

			list.attr("title",function(f){
						return f.name;
					})
					.html(function(f,i){
						return "<span class=\"name\">"+(i+1)+"."+f.name+"</span><span class=\"val\">"+moneyFormat(f.fund,true)+"</span>"
					})
		})


		
	}

	var subtooltip={
		node:d3.select("#subtooltip"),
		title:d3.select("#subtooltip").select("h3"),
		money:d3.select("#subtooltip").select("h4"),
		mt:d3.select("#subtooltip").select("#smt")
	}
	function hidePopup(){
		subtooltip.node.style({display:"none"});
	}
	function showPopup(d){
		
		if(d.values.t==open_element.values.t) {
			return;
		}

		var x=margins.left;



		var dy=delta["dst"].y;
		var smt_txt="ricevuti";

		if(d.values.t=="private") {
			dy=delta["src"].y - 30;
			x+=(delta["src"].x + 5);
			smt_txt="erogati"
		}
		if(d.values.t=="public") {
			dy=delta["src_public"].y -30;
			x+=(delta["src_public"].x - 135);
			smt_txt="erogati"
		}
		if(!d.values.t){
			x+=delta["dst"].x;
			x+=((open_element.values.t=="private")?20:-155)
		}


		var style={
					display:"block",
					left:x+"px",
					top:(d.ux_y+dy)+"px"
				};

		
		subtooltip.title.text(d.key)
		subtooltip.mt.text(smt_txt)
		subtooltip.money.html(moneyFormat(d.values.total))
		subtooltip.node.style(style)
	}

	d3.selectAll("#totals h3 a").on("click",function(){
		d3.event.preventDefault();
		d3.select("#totals")
			.classed("visible",!d3.select("#totals").classed("visible"));
	})

	function updateYear(year){
		var txt=d3.select("h2.year")
				.data([year])

		txt.text(year);

		d3.select("#tot_private h3 a span")
			.html(moneyFormat(max.src))

		d3.select("#tot_public h3 a span")
			.html(moneyFormat(max.src_public))

		d3.select("#tot h3 span")
			.html(moneyFormat(max.dst))

		d3.select("#totals ol li").remove();

		var li=d3.select("#tot_private ol")
					.selectAll("li")
						.data(self.flows_size.slice(0,10));
		li.exit().remove();
		li.enter().append("li");
		li
			.attr("title",function(d,i){
				return moneyFormat(d.size,false,true)+" da "+d.from+" a "+d.to;
			})
			.html(function(d,i){
				return "<span class=\"num\">"+(i+1)+"</span><span class=\"money\">"+moneyFormat(d.size,true)+"</span> <i>da</i> "+d.from+" <i>a</i> "+d.to;
			});

		var li=d3.select("#tot_public ol")
					.selectAll("li")
						.data(self.flows_public_size.slice(0,10));

		li.exit().remove();
		li.enter().append("li");
		li
			.attr("title",function(d,i){
				return d.from+": "+d.to+" "+moneyFormat(d.size,false,true);
			})
			.html(function(d,i){
				return d.from+": "+d.to+" <span class=\"money\">"+moneyFormat(d.size,true)+"</span><span class=\"num\">"+(i+1)+"</span>";
			});

		//classes for button open/close
	}

	updateYear(2013)

	var left_arrow=svg.append("g")
						.attr("transform","translate("+(-margins.left)+",0)")
	var right_arrow=svg.append("g")
						.attr("transform","translate("+(canvas.width+margins.right)+",0)")

	var labels_src=svg.append("g")
				.attr("id","labels_src")
				.attr("transform","translate("+0+","+delta.src.y+")")

	var labels_dst=svg.append("g")
				.attr("id","labels_dst")
				.attr("transform","translate("+(WIDTH-margins.right-margins.left-box_w)+","+delta.dst.y+")");

	function updateCircleGroups(node,groups,sub_groups,data,delta_group,filter) {
		var inc=0;
		
		var groups={};

		node
			.transition()
			.duration(1000)
			.attr("transform","translate("+delta[delta_group].x+","+delta[delta_group].y+")")

		
		groups.main=node.selectAll("g.fund").data(data.filter(
				filter || function(d){return true;}
			),
			function(d) {
				return d.key;
			});
		
		groups.main.exit().remove();

		var inc=0;
		var new_groups=groups.main
								.enter()
								.append("g")
								.attr("rel",function(d){
									return d.key;
								})
								.attr("class","fund")
								.attr("transform","translate(0,0)");



		

		new_groups.append("g")
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
										if(!(a.flow-b.flow))
											return a.from < b.from ? -1 : a.from > b.from ? 1 : 0;
										return b.flow - a.flow;
									})
								},function(d){
									return d.from+"-"+d.to;
								});

		groups.sub.exit().remove();

		groups.sub.enter()
				.append("circle")
					.attr("class",function(d){
						return "sub "+d.t;
					})
					.attr("rel",function(d){
						return d.from+"-"+d.to+": "+d.radius+"("+scale_y(d.flow)+")";
					})
					.attr("cx",0)
					.attr("cy",0)
					//.style("opacity",1e-6)
					.attr("r",function(d,i){
						return 0;
						var r=scale_r(d.radius);
						if (r<0.5)
							return 0.5;
						return r;
						return scale_r(d.radius);///Math.PI);
						return scale_y(d.radius)/2;
					})			

		var inc=0;
		groups.main
			.transition()
			.duration(1000)
			.attr("transform",function(d,i){
				var y0=inc;
				d.y0=y0;
				inc=inc+scale_r(d.values.total)*2+space;
				return "translate(0,"+(y0)+")";
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
				.attr("r",function(d,i){
					var r=scale_r(d.radius);
					if (r<0.5)
						return 0.25;
					return r;
				})

		return groups;
	}
	
	function getSmoothPath(d,border) {
		var x0=box_w,
			x1=(WIDTH-margins.right-margins.left)/2-box_w/2,//-2,
			h=(scale_y(d.size)/2),
			y1=delta.dst.y-delta.src.y;

		var y0=d.y0 + scale_r(d.src_inner_offset);
		var dy=(d.total-d.dst_inner_offset);
		y1+=d.y1 + scale_r(d.total) + scale_r(dy) - h;

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

		var x0=0,
			x1=-(WIDTH-margins.right-margins.left)/2+box_w/2,
			h=(scale_y(d.size)/2),
			y1=delta.dst.y-delta.src_public.y;

		var y0=d.y0 + scale_r(d.src_inner_offset);
		var dy=(d.total-d.dst_inner_offset);
		y1+=d.y1 + scale_r(d.dst_inner_offset);

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
					
					return d.from+"-"+d.to;
				});



		__flows.style("opacity",1e-6);

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

		__flows
				.classed("no-stroke",function(d,i){
					return scale_y(d.size)<4;
				})
					
		var clicked=svg.classed("clicked");
		new_flows.append("path")
					.attr("class",function(d){
						return d.t+" fill";
					})
					.attr("rel",function(d){
						return d.from+","+d.to+":"+d.size;
					})

		var inc={
			"private":0,
			"public":0
		};

		__flows
				.attr("transform",function(d){

					var x=(d.t=="private")?box_w:(WIDTH-margins.right-margins.left-box_w);
					var y=((d.t=="private")?delta.src.y:delta.src_public.y);
					
					return "translate("+x+","+y+")";
				})
				.classed("highlight",clicked)

		__flows
				.select("path.fill")
					.style("fill",function(d){
						return scale_color[d.t](d.size);
					})
					.attr("d",function(d){
						var p="";
						d.inc=inc[d.t];
						if(d.t=="private") {
							p=getSmoothPath(d,null);
						} else {
							p=getSmoothPathPublic(d,null);
						}
						inc[d.t]=inc[d.t]+scale_r(d.size)*2+space;
						return p;
					})
				

		new_flows.append("path")
				.attr("class","border top");


		__flows.select("path.top")
				.classed("no-stroke",function(d,i){
					return scale_r(d.size)<2;
				})
				.classed("highlight",clicked)
				.style("stroke",function(d){
					if(scale_y(d.size)<2) {
						scale_color[d.t](d.flow);
					}
				})
				.attr("d",function(d){
					var p="";
					if(d.t=="private") {
						p=getSmoothPath(d,"top");
					} else {
						p=getSmoothPathPublic(d,"top");
					}
					return p;

				});

		new_flows.append("path")
				.attr("class","border bottom")
		
		__flows.select("path.bottom")
				.classed("no-stroke",function(d,i){
					return scale_r(d.size)<2;
				})
					.attr("d",function(d){
						var p="";
						if(d.t=="private") {
							p=getSmoothPath(d,"bottom");
						} else {
							p=getSmoothPathPublic(d,"bottom");
						}
						return p;
					})
		
		__flows.transition().delay(1000).duration(1000).style("opacity",1);
	}
	updateFlows();
	
}