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

  $: labelSize = chartSize * 0.02;  // 4% of chart width

	// what gender are we plotting?
	$: heightField = gender === 'men' ? 'menH' : 'womenH';

	$: radiusScale = entries.length
		? scaleLinear()
			.domain([0, max(entries, e => e.menH)]) // Hardcoded to men scale
			.nice(5)
			.range([0, (chartSize/2) - padding])
		: null;

  let colorText1, colorText2, colorFillMen, colorStrokeMen, colorFillWomen, colorStrokeWomen, colorFillHighlight, colorStrokeHighlight;
  const styles = getComputedStyle(document.documentElement);
  colorText1      = styles.getPropertyValue('--color-text-1').trim();
  colorText2      = styles.getPropertyValue('--color-text-2').trim();
  colorFillMen    = styles.getPropertyValue('--color-men-fill').trim();
  colorStrokeMen  = styles.getPropertyValue('--color-men-stroke').trim();
  colorFillWomen  = styles.getPropertyValue('--color-women-fill').trim();
  colorStrokeWomen= styles.getPropertyValue('--color-women-stroke').trim();
  colorFillHighlight = styles.getPropertyValue('--color-highlight-fill').trim();
  colorStrokeHighlight = styles.getPropertyValue('--color-highlight-stroke').trim();
  

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
        spokeColor={colorText2}
        labelColor={colorText1}
        fontSize={labelSize}
      />

      <!-- 3) concentric rings -->
      <RadialAxis
        scale={radiusScale}
        cx={0}
        cy={0}
        tickCount={6}
		    subCount={2}
        strokeColor={colorText1}
        minorColor={colorText2}
        labelColor={colorText1}
        axisLabel="Jump Height (m)"
        fontSize={labelSize}
      />

      <!-- 2) reveal first `step` entries -->
      {#each entries.slice(0, step+1) as entry, i}
        {@const { start, end } = monthAngles(entry.date)}
        <MonthPath
          innerRadius={radiusScale(entry[gender + 'Prev'])}
          outerRadius={radiusScale(entry[gender + 'H'])}
          startAngle={start}
          endAngle={end}
          color={gender === 'men' ? colorStrokeMen : colorStrokeWomen}
          fillColor={gender === 'men' ? colorFillMen : colorFillWomen}
          selected={i === step && !!entry[gender + 'Annotation']}
          current={i === step && !entry[gender + 'Annotation']}
        />
      {/each}


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