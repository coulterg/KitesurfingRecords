<script>
	import MonthPath from './MonthPath.svelte';
	import RadialAxis from './RadialAxis.svelte';
	import MonthSpokes from './MonthSpokes.svelte';

	import { scaleLinear } from 'd3-scale';
	import { max } from 'd3-array';

	export let step = 0;
	export let entries = [];
	export let gender = 'men'

	// Sizing
	let innerWidth = 0;
	let innerHeight = 0;
	let plotHeightRatio = 4/5;
	$: chartSize = Math.min(innerWidth, innerHeight * plotHeightRatio);
	const padding = 50;

	// what gender are we plotting?
	$: heightField = gender === 'men' ? 'menH' : 'womenH';

	$: radiusScale = entries.length
		? scaleLinear()
			.domain([0, max(entries, e => e.menH)]) // Hardcoded to men scale
			.nice(5)
			.range([0, (chartSize/2) - padding])
		: null;

	const TWO_PI = 2 * Math.PI;

	function monthAngles(date) {
		const m = date.getMonth();
		return {
		
		start: (m/12)*TWO_PI, // - Math.PI/2,
		end:   ((m+1)/12)*TWO_PI // - Math.PI/2
	
		};
	}
</script>

<svelte:window bind:innerWidth bind:innerHeight />

{#if radiusScale}
  <svg
    width={chartSize}
    height={chartSize}
    viewBox={`0 0 ${chartSize} ${chartSize}`}
  >
    <g transform={`translate(${chartSize/2},${chartSize/2})`}>

      <!-- 1) radial spokes -->
      <MonthSpokes
        count={12}
        radius={chartSize/2 - padding}
        labels={['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']}
      />

      <!-- 2) reveal first `step` entries -->
      {#each entries.slice(0, step+1) as entry, i}
        {@const { start, end } = monthAngles(entry.date)}
        <MonthPath
          innerRadius={radiusScale(entry[gender + 'Prev'])}
          outerRadius={radiusScale(entry[gender + 'H'])}
          startAngle={start}
          endAngle={end}
          color={gender === 'men' ? 'steelblue' : 'hotpink'}
          fillColor="lightgrey"
		  selected={i === step && !!entry[gender + 'Annotation']}
        />
      {/each}

      <!-- 3) concentric rings -->
      <RadialAxis
        scale={radiusScale}
        cx={0}
        cy={0}
        tickCount={6}
		subCount={2}
        strokeColor="#ddd"
        labelColor="#444"
        axisLabel="Jump Height (m)"
      />
    </g>
  </svg>
{/if}

<style>
  .wrapper {
    display: flex;
    gap: 2rem;
    justify-content: center;
    align-items: flex-start;
    flex-wrap: wrap;
  }
  svg {
	max-width: 100%;
	height: auto;
    display: block;
    margin: 0 auto;
  }
</style>