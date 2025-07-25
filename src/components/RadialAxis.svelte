<script>
    import { range } from 'd3-array';

    export let scale;
    export let cx = 0;
    export let cy = 0;
    export let tickCount = 4;
    export let subCount = 4;
    export let strokeColor = '#999';
    export let minorColor = '#ccc';
    export let labelColor = '#666';

    export let axisLabel = '';
    export let fontSize;

    // Construct major and minor tick pattern
    let majors = [];
    let minors = [];

    $: majors = scale.ticks(tickCount);

    $: majorStep = majors.length > 1
        ? majors[1] - majors[0]
        : majors[0];

    $: minorStep = majorStep / subCount;

    $: {
        const [d0, d1] = scale.domain();
        const all = range(d0, d1 + 1e-6, minorStep);
        minors = all.filter(v => !majors.includes(v));
    }

    // Figure out axis label placement
    let maxRadius;
    $: {
        const maxDomain = scale.domain()[1];
        maxRadius = scale(maxDomain);
    }

    $: fmt = scale.tickFormat ? scale.tickFormat(tickCount) : v => v;    
</script>

<g class='radial-axis'>
    {#if axisLabel}
        <text 
            x={cx}
            y={cy - maxRadius - fontSize*2}
            text-anchor='middle'
            font-size={fontSize}
            fill={labelColor}
        >
            {axisLabel}
        </text>
    {/if}
    
    {#each minors as t}
        <circle
            class="grid-ring"
            cx={cx}
            cy={cy}
            r={scale(t)}
            fill='none'
            stroke={minorColor}
            stroke-width='1'
            stroke-dasharray='1 3'
        />
    {/each}

    {#each majors as t}
        <circle
            class="grid-ring"
            cx={cx}
            cy={cy}
            r={scale(t)}
            fill='none'
            stroke={strokeColor}
            stroke-width='1'
        />
        <text
            class="grid-label"
            x={cx}
            y={cy - scale(t)}
            dy='-4'
            dx='-10'
            text-anchor='middle'
            fill={labelColor}
            font-size={fontSize}
        >
            {fmt(t)}
        </text>
    {/each}
</g>

<style>
    .grid-ring { pointer-events: none;}
    .grid-label { 
        font-size: fontSize;
        font-family: sans-serif;
    }
</style>