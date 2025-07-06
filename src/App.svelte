<script>
	import { onMount } from 'svelte';
	import { csv } from 'd3-fetch';
	import { timeParse, timeFormat } from 'd3-time-format';
	import { timeMonths } from 'd3-time';

	import RadialWaterfall from "./components/RadialWaterfall.svelte";
	import Scrolly from "./components/Scrolly.svelte";
	
	let selectedGender = 'men'
	let step = 0;
	
	// Parsing and storing data
	let raw = []
	onMount(async () => {
		raw = await csv('data/records.csv', row => ({
			date: 	timeParse('%m/%d/%y')(row.Date_US),
			name: 	row.Name,
			height: +row.Height_m,
			gender: row.Gender,
			kiteBrand: row.kite_brand || 'null',
			kiteModel: row.kite_model || 'null',
			kiteSize: +row.kite_size || 'null',
			country: row.loaction_country || 'null',
			location: row.location || 'null',
			annotation: 'null'
		}));
		console.log(raw)
		buildEntries()
		console.log(entries)
	});

	const fmtMonth = timeFormat('%b %Y');
	let entries = []
	function buildEntries() {
		raw.sort((a,b)=>a.date-b.date);

		const[start, end] = [raw[0].date, raw.at(-1).date];
		const months = timeMonths(
			new Date(start.getFullYear(), start.getMonth(), 1),
			new Date(end.getFullYear(), end.getMonth() + 1, 1)
		);

		let lastMenH = 0;
		let lastWomenH = 0;

		entries = months.map(date => {
			// find the raw record object for this month (if any)
			const menRec   = raw.find(r =>
				r.gender==='male'   &&
				r.date.getFullYear()===date.getFullYear() &&
				r.date.getMonth()   ===date.getMonth()
			);
			const womenRec = raw.find(r =>
				r.gender==='female' &&
				r.date.getFullYear()===date.getFullYear() &&
				r.date.getMonth()   ===date.getMonth()
			);

			const menH   = menRec   ? menRec.height   : lastMenH;
			const womenH = womenRec ? womenRec.height : lastWomenH;

			const menPrev   = lastMenH;
    		const womenPrev = lastWomenH;

			if (menRec   && menH   > lastMenH)   lastMenH   = menH;
			if (womenRec && womenH > lastWomenH) lastWomenH = womenH;

			return {
				date,
				label:     fmtMonth(date),
				menH,
				menPrev,
				womenH,
				womenPrev,
				// *** carry the whole record object ***
				menRec,      // undefined if no record this month
				womenRec,    // likewise
				// annotations or other fields you like
				menAnnotation:   menRec?.annotation   || '',
				womenAnnotation: womenRec?.annotation || ''
			};
		});
	}
</script>

<main>
	<h1>Kitesurfing Record Waterfall</h1>

	<fieldset>
		<legend>Show:</legend>

		<label>
			<input
				type="radio"
				name="gender"
				bind:group={selectedGender}
				value="men" />
			Men
		</label>

		<label>
			<input
				type="radio"
				name="gender"
				bind:group={selectedGender}
				value="women" />
			Women
		</label>

	</fieldset>

	{#if entries.length}
		<div class='scrolly-plot-wrapper'>
			<Scrolly bind:value={step}>
				{#each entries as e, i}
					<div class='step' class:active={step === i}>
						<div class='step-label'>{e.label}</div>
						<div class='step-annotation'>
							{selectedGender === 'men' ? e.menAnnotation : e.womenAnnotation}
						</div>
					</div>
				{/each}
			</Scrolly>
			<div class='spacer' />
			<div class='plot-container'>
				<RadialWaterfall 
				entries={entries}
				step={step}
				gender={selectedGender}/>
			</div>
		</div>
	{:else}
		<p>Loading data…</p>
 	{/if}
</main>

<style>
	main {
		max-width: 800px;
		margin: 2rem auto;
		font-family: system-ui, sans-serif;
		text-align: center;
	}
	h1 {
		margin-bottom: 1.5rem;
	}
	fieldset {
		border: none;
		margin-bottom: 1.5rem;
		display: flex;
		justify-content: center;
		gap: 1.5rem;
	}
	label {
		font-size: 1rem;
		cursor: pointer;
	}
	input[type="radio"] {
		margin-right: 0.3rem;
	}
	.step {
		padding: 2rem;
		opacity: 0.3;
		transition: opacity 0.2s;
	}
	.step.active {
		opacity: 1;
	}
	.spacer {
		height: 50vh;
	}
	.scrolly-plot-wrapper {
		display: flex;
		gap: 2rem;
		align-items: start;       /* keep chart pinned to top of its column */
		}
	/* stack on mobile */
	@media (max-width: 600px) {
		.scrolly-plot-wrapper {
			flex-direction: column-reverse;
	}
	}
	.plot-container {
		position: sticky;
		top: 2rem;          /* how far from the top of the viewport */
		align-self: start;  /* if its parent is a flex row, keep it at the top */
	}
</style>