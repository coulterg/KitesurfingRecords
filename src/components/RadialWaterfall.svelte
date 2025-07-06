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
	const padding = 20;

	// what gender are we plotting?
	$: heightField = gender === 'men' ? 'menH' : 'womenH';

	$: radiusScale = entries.length
		? scaleLinear()
			.domain([0, max(entries, e => e[heightField])])
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

<p style="position:absolute;top:0;left:0;color:red">
  step={step}
</p>

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
      {#each entries.slice(0, step) as entry, i}
        {@const { start, end } = monthAngles(entry.date)}
        <MonthPath
          innerRadius={radiusScale(entry[gender + 'Prev'])}
          outerRadius={radiusScale(entry[gender + 'H'])}
          startAngle={start}
          endAngle={end}
          color={gender === 'men' ? 'steelblue' : 'hotpink'}
          fillColor="lightgrey"
		  selected={i === step - 1 && !!entry[gender + 'Annotation']}
        />
      {/each}

      <!-- 3) concentric rings -->
      <RadialAxis
        scale={radiusScale}
        cx={0}
        cy={0}
        tickCount={5}
        strokeColor="#ddd"
        labelColor="#444"
        axisLabel="Jump Height (m)"
      />
    </g>
  </svg>

  <!-- 4) optional display of current record's location -->
  {#if entries[step-1]}
    <div class="current-meta">
      Location:
      {entries[step-1][gender + 'Rec']?.location ?? '–'}
    </div>
  {/if}
{:else}
  <p>Loading...</p>
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