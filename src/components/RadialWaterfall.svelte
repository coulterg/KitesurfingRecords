<script>
	import { onMount } from 'svelte';
	import Scrolly from './Scrolly.svelte';
	import MonthPath from './MonthPath.svelte';
	import RadialAxis from './RadialAxis.svelte';
	import MonthSpokes from './MonthSpokes.svelte';

	import { csv } from 'd3-fetch';
	import { timeParse } from 'd3-time-format';
	import { timeMonths } from 'd3-time';
	import { scaleTime, scaleLinear } from 'd3-scale';
	import { extent, max, min } from 'd3-array';

	let innerWidth = 0;
	let innerHeight = 0;

	let plotHeightRatio = 4/5;

	$: chartSize = Math.min(innerWidth, innerHeight * plotHeightRatio);
	const padding = 20;

	let records = [];
	
	let monthDates = [], angleScale, radiusScale;

	let menRecords = [], womenRecords = [];
	let menTimeline = [], womenTimeline = [];

	export let gender = 'men'

	// Data parsing functions
	const parseDate = timeParse('%m/%d/%y'); // Date-US column

	const TWO_PI = 2 * Math.PI;

	function monthAngles(date) {
		const m = date.getMonth();
		return {
		
		start: (m/12)*TWO_PI, // - Math.PI/2,
		end:   ((m+1)/12)*TWO_PI // - Math.PI/2
	
		};
	}

    console.log('RadialWaterfall mounted');


	// Parsing and storing data
	onMount(async () => {
		const raw = await csv('data/records.csv', row => ({
			date: 	parseDate(row.Date_US),
			name: 	row.Name,
			height: +row.Height_m,
			gender: row.Gender,
			kiteBrand: row.kite_brand || 'null',
			kiteModel: row.kite_model || 'null',
			kiteSize: +row.kite_size || 'null',
			country: row.loaction_country || 'null',
			location: row.location || 'null',
		}));

		console.log(raw)

		records = raw.sort((a, b) => a.date - b.date);
	});

	// Time - I think this will need to change to be 12 steps per 2PI
	$: if (records.length && chartSize) {
		const [start, end] = extent(records, d => d.date);
		monthDates = timeMonths(
			new Date(start.getFullYear(), start.getMonth(), 1),
			new Date(end.getFullYear(), end.getMonth() + 1, 1)
		);

		menRecords = records.filter(d => d.gender === 'male');
		womenRecords = records.filter(d => d.gender === 'female')

		// angleScale = scaleTime()
		// 	.domain([start, end])
		// 	.range([0, 2 * Math.PI]);


		radiusScale = scaleLinear()
			.domain([0, max(records, d => d.height)])
			.range([0, (chartSize/2) - padding]); // Adjust the range as needed for your visualization
	}

	function buildTimeLine(recs) {
		let lastH = 0;
		return monthDates.map(date => {
			const rec = recs.find(r =>
				r.date.getFullYear() === date.getFullYear() &&
				r.date.getMonth() === date.getMonth()
			);
			const hThis = rec ? rec.height : lastH; // ? here is optional chaining (undefined/null if no .height) and ?? returns 0 if LHS is undefined
			
			const innerH = lastH;
			const outerH = hThis;

			const { start, end } = monthAngles(date);

			// Update running max
			if (rec && hThis > lastH) {
				lastH = hThis;
			}
			
			const entry = { 
				date,
				innerRadius: radiusScale(innerH),
				outerRadius: radiusScale(outerH),
				hasRecord: !!rec,
				startAngle: start,
				endAngle: end
			};
			
			return entry;
		});
	}

	$: if (monthDates.length && radiusScale) {
		menTimeline = buildTimeLine(menRecords);
		womenTimeline = buildTimeLine(womenRecords);
	}
</script>

<svelte:window bind:innerWidth bind:innerHeight />

{#if menTimeline.length && gender === 'men'}
  <div class="wrapper">
    <div class="plot">
      <h3>Men’s Record Waterfall</h3>
      <svg width={chartSize} height={chartSize} viewBox={`0 0 ${chartSize} ${chartSize}`}>
        <g transform={`translate(${chartSize/2},${chartSize/2})`}>

			<MonthSpokes
			count={12}
			radius={chartSize/2 - padding}
			labels={['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']}
			/>
			
          {#each menTimeline as m}
			<MonthPath
			innerRadius={m.innerRadius}
			outerRadius={m.outerRadius}
			startAngle={m.startAngle}
			endAngle={m.endAngle}
			color="steelblue"
			fillColor='lightgrey'
			/>
          {/each}
		  
		  <RadialAxis 
				scale={radiusScale}
				cx={0}
				cy={0}
				tickCount={4}
				strokeColor='#ddd'
				labelColor='#444'
				axisLabel='Jump Height (m)' 
			/>
        </g>
      </svg>
    </div>
  </div>
{:else if womenTimeline.length && gender === 'women'}
  <div class="wrapper">
    <div class="plot">
      <h3>Women’s Record Waterfall</h3>
      <svg width={chartSize} height={chartSize} viewBox={`0 0 ${chartSize} ${chartSize}`}>
        <g transform={`translate(${chartSize/2},${chartSize/2})`}>

			<MonthSpokes
			count={12}
			radius={chartSize/2 - padding}
			labels={['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']}
			/>
			
          {#each womenTimeline as w}
			<MonthPath
			innerRadius={w.innerRadius}
			outerRadius={w.outerRadius}
			startAngle={w.startAngle}
			endAngle={w.endAngle}
			color="hotpink"
			fillColor='lightgrey'
			/>
          {/each}
		  
		  <RadialAxis 
				scale={radiusScale}
				cx={0}
				cy={0}
				tickCount={4}
				strokeColor='#ddd'
				labelColor='#444' 
				axisLabel='Jump Height (m)'
			/>
        </g>
      </svg>
    </div>
  </div>
{:else}
  <p>Loading data…</p>
{/if}


<style>
  .wrapper {
    display: flex;
    gap: 2rem;
    justify-content: center;
    align-items: flex-start;
    flex-wrap: wrap;
  }
  .plot {
    text-align: center;
  }
  svg {
    display: block;
    margin: 0 auto;
  }
</style>