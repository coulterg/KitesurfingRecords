<script>
	import { onMount } from 'svelte';
	import { csv } from 'd3-fetch';
	import { timeParse, timeFormat } from 'd3-time-format';
	import { timeMonths } from 'd3-time';

	import RadialWaterfall from "./components/RadialWaterfall.svelte";
	import Scrolly from "./components/Scrolly.svelte";

	import { annotationMap } from './lib/data/annotations.js'
	import CurrentInfo from './components/CurrentInfo.svelte';
	
	let gender = 'men'
	let step = 0;

	// let currentEntry = [];
	// let currentRec = [];
	
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

			// get annotations
			const key = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2, '0')}`
			const { men = '', women = '' } = annotationMap[key] || {};

			console.log(key, annotationMap[key])


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
				menAnnotation:   men,
				womenAnnotation: women
			};
		});
	}

	$: currentEntry = entries[step] || null;
	$: currentRec = (
		entries
			.slice(0, step+1)                      // take all up to and including the current step
			.reverse()                              // search backwards
			.find	(e => e[gender + 'Rec'])           // find first entry that has a record
	)?.[gender + 'Rec'] || null;
</script>

<main>
	<h1>Kitesurfing Record Waterfall</h1>

	<fieldset>
		<legend>Show:</legend>

		<label>
			<input
				type="radio"
				name="gender"
				bind:group={gender}
				value="men" />
			Men
		</label>

		<label>
			<input
				type="radio"
				name="gender"
				bind:group={gender}
				value="women" />
			Women
		</label>

	</fieldset>

	<div class='spacer' />
	<div class='spacer' />

	{#if entries.length}
		<div class='scrolly-plot-wrapper'>
			<div class='steps-container'>
				<Scrolly bind:value={step}>
					{#each entries as e, i}
						<div class='step' class:active={step === i}>
							<div class='step-label'>{e.label}</div>
							<div class='step-annotation'>
								{gender === 'men' ? e.menAnnotation : e.womenAnnotation}
							</div>
						</div>
					{/each}
					<div class='spacer' />
					<div class='spacer' />	
				</Scrolly>
			</div>
			<!-- <div class='spacer' /> -->
			<div class='plot-container'>
				<div class='radial-plot'>
					<RadialWaterfall 
						entries={entries}
						step={step ?? 0}
						gender={gender}/>
					<CurrentInfo
						monthLabel = {currentEntry?.label}
						record = {currentRec}
					/>
				</div>
				
			</div>
		</div>
	{:else}
		<p>Loading data…</p>
 	{/if}

	<div class='spacer' />
	<div class='spacer' />
</main>

<style>
	main {
		max-width: 1600px;
		margin: 2rem auto;
		font-family: system-ui, sans-serif;
		text-align: center;
	}
	h1 {
		margin-bottom: 1.5rem;
		text-align: center;
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
		/* width: 90vw; */
		/* max-width:1000px; */
		display: flex;
		align-items: center;
	}
	.scrolly-plot-wrapper {
		width: 100%; /* fill parent container (the viewport) */
		max-width: 3000px; /* but not wider than 1600 */
		margin: 0 auto;
		
		display: grid;
		/* justify-content: center; */
		grid-template-columns: 
			minmax(0, 0.5fr) 
			repeat(8, minmax(0, 2fr)) 
			minmax( 0, 0.5fr);
		gap: 2rem;
		}

	.steps-container {
		grid-column: 2 / 5;
	}
	.plot-container {
		grid-column: 5 / 10;
		position: sticky;
		align-self: start;
		align-items: center;
		top: 5rem;
		max-width: 100%;
		/* min-width: 650px; */
	}
	.radial-plot {
		text-align: center;
		align-self: center;
		max-width: 80%;
		margin: 0 auto;
  }

	*, *::before, *::after {
		box-sizing: border-box;
		}

	/* stack on mobile */
	@media (max-width: 650px) {
		.scrolly-plot-wrapper {
			display: flex;
			flex-direction: column-reverse;
			width: 100vw;
			max-width: none;
			margin: 0;
		}
		.plot-container {
			/* position: static; */
			align-self: start;
			/* justify-content: center; */
			margin: 0 auto;
			top: 2rem;
			width: 90vw;
		}
		.radial-plot {
			max-width: 90%;
		}
		.steps-container {
			display: flex;
			align-self: center;
			z-index: 10;
		}
	}

	.current-month {
		font-size: 1.25rem;
		font-weight: bold;
		margin-bottom: 0.5rem; /* space between label and chart */
		text-align: left;
	}
	
</style>