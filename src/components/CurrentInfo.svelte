<script>
    export let monthLabel = '';
    export let record = null; 
</script>

<div class='current-info'>
    {#if monthLabel}
        <div class='current-month'>{monthLabel}</div>
    {/if}

    {#if record}
        <div class='current-meta'>
			<strong>Name:</strong> {record.name}  
			&nbsp;|&nbsp;
			<strong>Height:</strong> {record.height} m  
			&nbsp;|&nbsp;
			<strong>Location:</strong> {record.location+', '+record.country}
            &nbsp;|&nbsp;
            <strong>Kite:</strong> {record.kiteSize}m<sup>2 </sup>{record.kiteBrand+' '+record.kiteModel}
		</div>
    {:else}
		<div class="current-meta">
            No record yet
        </div>
    {/if}
</div>