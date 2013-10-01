function isCanvasSupported(){
	var elem = document.createElement('canvas');
	return !!(elem.getContext && elem.getContext('2d'));
}

if (!isCanvasSupported()){

	var modal = document.createElement("div");
	modal.className="ie8";
	modal.innerHTML="<p>Purtroppo il tuo browser non supporta le ultime tecnologie per il web richieste da questo sito.<br/>Prova con un browser moderno o <a href=\"http://browser-update.org/update.html\">aggiornalo ora</a>.</p>";
	document.getElementsByTagName("body")[0].appendChild(modal);

	
}

var margins={left:180,top:0,right:180,bottom:0,padding:{left:0,right:0}},
	box_w=0,
	step=0;

var WIDTH=960,
	HEIGHT=800;

var flows;

d3.select("#loading").style("display","block");

if (isCanvasSupported()){

		d3.csv("data/files/data2013.csv",function(d){
		return {
			to:d.Target.toLowerCase(),
			from:d.Source.toLowerCase(),
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

		d3.select("#loading")
			.transition()
			.duration(1000)
			.style("opacity",1e-6)
			.each("end",function(d){
				d3.select(this).style("display","none")
			});

		delete rows;

		flows=new BubbleFlowChart(aggregated_rows.filter(function(d){
			return d.flow>0;
		}));
	});
	
	

	d3.csv("data/totali.csv",function(d){
		return {
			"year":+d.year,
			"date":new Date((+d.year),0,1),
			"private":+d.privato,
			"public":+d.pubblico
		}
	},function(data){

		var fundings = d3.layout.stack().offset("zero")(["private", "public"].map(function(type) {
			return data.map(function(d) {
				return {x: (d.date), y: +d[type], t:type};
			});
		}));

		new StackChart(fundings,{
			container:"#stackchart",
			width:960,
			height:150,
			margins:{
				top:25,
				right:130,
				bottom:20,
				left:130
			},
			callback:function(d){
				if(!flows.isLoading) {
					flows.loadCSV(d)	
				}
			}
		})

	});

}