d3.csv("data/all_data.csv",function(d){
			return {
				year:+d.Year,
				t:d.Pubblico?"public":"private",
				flow:+d.Weight
			}
		},function(data){

			var totals=d3.nest()
				.key(function(d){
					return d.year;
				})
				.rollup(function(leaves) {
					return  {
						"private": d3.sum(leaves.filter(function(d){
							return d.t=="private"
						}), function(d) {
							return parseFloat(d.flow);
						}),
						"public": d3.sum(leaves.filter(function(d){
							return d.t=="public"
						}), function(d) {
							return parseFloat(d.flow);
						})	
					}
					
				})
				.entries(data);
			var str="";
			totals.forEach(function(d){
				str+=d.key+","+d.values["private"]+","+d.values["public"]+"\n";
			})

			console.log(str);

		});