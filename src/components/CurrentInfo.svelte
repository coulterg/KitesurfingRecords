<script>
    export let monthLabel = '';
    export let record = null; 
</script>

<div class='current-info'>
    {#if monthLabel}
        <div class='current-month'></div>
    {/if}
    <div class='info-left'>
        {#if record}
            <div class='height'>{record.height} m</div>
            <div class='name'>{record.name}</div>
        {:else}
            <div class="no-record">
                No record yet
            </div>
        {/if}
    </div>
    <div class='info-right'>
        {#if record}
        <div class='kite'>
                {#if record.kiteBrand !== 'null'}
                    {record.kiteSize}m<sup>2 </sup>{record.kiteBrand+' '+record.kiteModel}
                {/if}
            </div>
            <div class='location'>
                {#if record.location !== 'null'}
                    {record.location}, {record.country}
                {/if}
            </div>
        {/if}
    </div>
</div>

<style>
    .current-info {
        display: grid;
		grid-template-columns: 1fr 1fr;
		align-items: end;
		width: 100%;
		margin: 0 auto;
    }

    .info-left {
        grid-column: 1;
        display: flex;
        flex-direction: column;
        margin-bottom: 4vh;
    }
    .height {
        font-size: 3.5rem;
        font-weight: 150;
        line-height: 1;
    }
    .name {
        font-size: 1.5rem;
        margin-top: 0.25rem;
        font-weight: 200;
    }

    .info-right {
        grid-column: 2;
        text-align: right;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        margin-bottom: 4vh;
        color: var(--color-text-2);
    }
    .location,
    .kite {
        font-size: 1rem;
        line-height: 1.4;
    }
    .no-record {
        font-style: italic;
        color: var(--color-text-2);
    }
</style>