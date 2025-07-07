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
		</div>
    {:else}
		<div class="current-meta">
            No record yet
        </div>
    {/if}
</div>