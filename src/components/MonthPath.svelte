<script>
    import { arc } from 'd3-shape'

    /*
     * innerRadius: radius at previous month record height
     * outterRadiu: radius at current month record height = innerRadius if no new record that month
     * startAngle, endAngle: in radians, based on month - month to angle logic handled in parent
     * color: stroke color
     * fillColor: fill color
     */

    export let innerRadius;
    export let outerRadius;
    export let startAngle;
    export let endAngle;
    export let color = 'teal';
    export let fillColor='burnt-umber';

    $: arcGen = arc()
        .innerRadius(innerRadius)
        .outerRadius(outerRadius);
</script>

<path
    d={arcGen({ startAngle, endAngle})}
    fill = {fillColor}
    stroke = {color}
    stroke-width = "2"
/>