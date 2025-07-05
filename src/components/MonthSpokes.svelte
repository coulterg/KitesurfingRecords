<script>
    export let count = 12;
    export let radius = 100;
    export let labelOffset = 16;
    export let labels = [];

    const TWO_PI = 2 * Math.PI;
    $: stepRad = TWO_PI / count;
    $: stepDeg = 360 / count;

    $: indices = Array.from({ length: count }, (_, i) => i);
</script>

<g class='month-spokes'>
    {#each indices as i}
        {@const midRad = (i + 0.5) * stepRad}
        {@const midDeg = (i + 0.5) * stepDeg}
        {@const startAngle = (i * stepRad)}

        <line
            x1 = '0'
            y1 = '0'
            x2 = {Math.cos(startAngle) * radius}
            y2 = {Math.sin(startAngle) * radius}
            stroke='#999'
            stroke-width='1'
        />

        <g transform={`rotate(${midDeg})`}>
            <text 
                x='0'
                y={-(radius + labelOffset)}
                text-anchor='middle'
                alignment-baseline='middle'
                ont-size='0.75rem'
                fill='#333'
            >
                {labels[i] ?? i + 1}    
            </text>
        </g>
    {/each}
</g>